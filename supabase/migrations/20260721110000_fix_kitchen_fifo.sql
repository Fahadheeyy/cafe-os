-- Fix upsert_order_with_items to bump sent_to_kitchen_at when items are added (total increases)
CREATE OR REPLACE FUNCTION public.upsert_order_with_items(
  _table_id uuid,
  _items jsonb,
  _order_type public.order_type DEFAULT 'dine_in',
  _parcel_fee numeric DEFAULT 0,
  _order_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bid uuid;
  caller uuid := auth.uid();
  caller_name text;
  existing_order_id uuid;
  existing_kitchen kitchen_status;
  existing_total numeric(10,2) := 0;
  target_order_id uuid;
  total_amount numeric(10,2) := 0;
  item jsonb;
  t_name text := 'Takeaway';
  new_status table_status;
  item_count int;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT business_id, name INTO bid, caller_name FROM public.profiles WHERE id = caller;
  IF bid IS NULL THEN RAISE EXCEPTION 'Not a member of any business'; END IF;

  IF _table_id IS NOT NULL THEN
    SELECT name INTO t_name FROM public.restaurant_tables WHERE id = _table_id AND business_id = bid;
    IF t_name IS NULL THEN RAISE EXCEPTION 'Table not found'; END IF;
  END IF;

  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' THEN
    RAISE EXCEPTION 'Items must be an array';
  END IF;

  item_count := jsonb_array_length(_items);

  FOR item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    IF (item->>'qty')::int <= 0 THEN RAISE EXCEPTION 'Qty must be positive'; END IF;
    IF (item->>'price')::numeric < 0 THEN RAISE EXCEPTION 'Price must be non-negative'; END IF;
    total_amount := total_amount + (item->>'price')::numeric * (item->>'qty')::int;
  END LOOP;

  total_amount := total_amount + _parcel_fee;

  IF _order_id IS NOT NULL THEN
    SELECT id, kitchen_status, total INTO existing_order_id, existing_kitchen, existing_total
    FROM public.orders
    WHERE id = _order_id AND business_id = bid AND status = 'pending' AND payment = 'unpaid';
  ELSIF _table_id IS NOT NULL THEN
    SELECT id, kitchen_status, total INTO existing_order_id, existing_kitchen, existing_total
    FROM public.orders
    WHERE table_id = _table_id AND business_id = bid
      AND status = 'pending' AND payment = 'unpaid'
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  IF existing_order_id IS NOT NULL THEN
    target_order_id := existing_order_id;
    UPDATE public.orders SET
      total = total_amount,
      table_name = COALESCE(t_name, 'Takeaway'),
      order_type = _order_type,
      parcel_fee = _parcel_fee,
      updated_at = now(),
      kitchen_status = CASE
        WHEN total_amount > existing_total AND existing_kitchen IN ('preparing', 'ready') THEN 'queued'::kitchen_status
        WHEN existing_kitchen = 'served' AND item_count > 0 THEN 'queued'::kitchen_status
        ELSE existing_kitchen
      END,
      sent_to_kitchen_at = CASE
        WHEN total_amount > existing_total THEN now()
        WHEN existing_kitchen = 'served' AND item_count > 0 THEN now()
        ELSE sent_to_kitchen_at
      END
    WHERE id = target_order_id;

    DELETE FROM public.order_items WHERE order_id = target_order_id;
  ELSE
    INSERT INTO public.orders (business_id, table_id, table_name, total, staff_id, staff_name, order_type, parcel_fee)
    VALUES (bid, _table_id, COALESCE(t_name, 'Takeaway'), total_amount, caller, COALESCE(caller_name, 'Staff'), _order_type, _parcel_fee)
    RETURNING id INTO target_order_id;
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    INSERT INTO public.order_items (business_id, order_id, product_id, name, price, qty)
    VALUES (
      bid, target_order_id,
      NULLIF(item->>'product_id','')::uuid,
      item->>'name',
      (item->>'price')::numeric,
      (item->>'qty')::int
    );
  END LOOP;

  IF _table_id IS NOT NULL THEN
    IF item_count = 0 THEN
      new_status := 'available';
    ELSE
      SELECT status INTO new_status FROM public.restaurant_tables WHERE id = _table_id;
      IF new_status = 'available' THEN new_status := 'occupied'; END IF;
    END IF;
    UPDATE public.restaurant_tables SET status = new_status WHERE id = _table_id;
  END IF;

  RETURN target_order_id;
END;
$$;
