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
  target_order_id uuid;
  total_amount numeric(10,2) := 0;
  item record;
  t_name text := 'Takeaway';
  new_status table_status;
  item_count int;
  
  -- diffing vars
  existing_qty int;
  in_qty int;
  delta int;
  new_kot_id uuid := NULL;
  rec record;
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
    IF (item.value->>'qty')::int <= 0 THEN RAISE EXCEPTION 'Qty must be positive'; END IF;
    IF (item.value->>'price')::numeric < 0 THEN RAISE EXCEPTION 'Price must be non-negative'; END IF;
    total_amount := total_amount + (item.value->>'price')::numeric * (item.value->>'qty')::int;
  END LOOP;

  total_amount := total_amount + _parcel_fee;

  IF _order_id IS NOT NULL THEN
    SELECT id INTO existing_order_id
    FROM public.orders
    WHERE id = _order_id AND business_id = bid AND status = 'pending' AND payment = 'unpaid';
  ELSIF _table_id IS NOT NULL THEN
    SELECT id INTO existing_order_id
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
      updated_at = now()
    WHERE id = target_order_id;
  ELSE
    INSERT INTO public.orders (business_id, table_id, table_name, total, staff_id, staff_name, order_type, parcel_fee)
    VALUES (bid, _table_id, COALESCE(t_name, 'Takeaway'), total_amount, caller, COALESCE(caller_name, 'Staff'), _order_type, _parcel_fee)
    RETURNING id INTO target_order_id;
  END IF;

  -- 2. Find items in the DB that are NOT in incoming items and delete them
  DELETE FROM public.order_items oi
  WHERE oi.order_id = target_order_id
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(_items) i 
      WHERE (
        NULLIF(i->>'product_id', '')::uuid = oi.product_id 
        OR (NULLIF(i->>'product_id', '') IS NULL AND oi.product_id IS NULL AND i->>'name' = oi.name)
      )
    );

  -- 3. Loop through incoming items to diff quantities
  FOR item IN 
    SELECT 
      NULLIF(i->>'product_id', '')::uuid as product_id,
      i->>'name' as name,
      (i->>'price')::numeric as price,
      (i->>'qty')::int as qty
    FROM jsonb_array_elements(_items) i
  LOOP
    SELECT COALESCE(SUM(qty), 0) INTO existing_qty 
    FROM public.order_items oi
    WHERE oi.order_id = target_order_id 
      AND (oi.product_id = item.product_id OR (oi.product_id IS NULL AND item.product_id IS NULL AND oi.name = item.name));
      
    in_qty := item.qty;
    delta := in_qty - existing_qty;

    IF delta > 0 THEN
      -- We need to add items. Create a new KOT if not already created for this RPC call
      IF new_kot_id IS NULL THEN
        INSERT INTO public.kots (business_id, order_id) VALUES (bid, target_order_id) RETURNING id INTO new_kot_id;
      END IF;
      
      INSERT INTO public.order_items (business_id, order_id, kot_id, product_id, name, price, qty)
      VALUES (bid, target_order_id, new_kot_id, item.product_id, item.name, item.price, delta);
      
    ELSIF delta < 0 THEN
      -- We need to remove items. Iterate through existing rows for this item, newest first.
      delta := abs(delta);
      FOR rec IN 
        SELECT id, qty FROM public.order_items oi
        WHERE oi.order_id = target_order_id 
          AND (oi.product_id = item.product_id OR (oi.product_id IS NULL AND item.product_id IS NULL AND oi.name = item.name))
        ORDER BY created_at DESC 
      LOOP
        IF delta = 0 THEN EXIT; END IF;
        
        IF rec.qty <= delta THEN
          DELETE FROM public.order_items WHERE id = rec.id;
          delta := delta - rec.qty;
        ELSE
          UPDATE public.order_items SET qty = qty - delta WHERE id = rec.id;
          delta := 0;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
  
  -- Clean up empty KOTs
  DELETE FROM public.kots k WHERE k.order_id = target_order_id AND NOT EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.kot_id = k.id);

  -- Update table status
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
