
-- =========================================================================
-- Phase 3 - Atomic order RPC + tenancy-safe helpers
-- =========================================================================

-- Automatically stamp business_id on orders/order_items/products/tables from the caller's profile
-- so the client can never spoof a business_id. RLS still enforces isolation.
CREATE OR REPLACE FUNCTION public.stamp_business_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE bid uuid;
BEGIN
  IF NEW.business_id IS NULL THEN
    SELECT business_id INTO bid FROM public.profiles WHERE id = auth.uid();
    IF bid IS NULL THEN RAISE EXCEPTION 'Not a member of any business'; END IF;
    NEW.business_id := bid;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stamp_business_id_products ON public.products;
CREATE TRIGGER stamp_business_id_products BEFORE INSERT ON public.products
FOR EACH ROW EXECUTE FUNCTION public.stamp_business_id();

DROP TRIGGER IF EXISTS stamp_business_id_tables ON public.restaurant_tables;
CREATE TRIGGER stamp_business_id_tables BEFORE INSERT ON public.restaurant_tables
FOR EACH ROW EXECUTE FUNCTION public.stamp_business_id();

DROP TRIGGER IF EXISTS stamp_business_id_orders ON public.orders;
CREATE TRIGGER stamp_business_id_orders BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.stamp_business_id();

DROP TRIGGER IF EXISTS stamp_business_id_order_items ON public.order_items;
CREATE TRIGGER stamp_business_id_order_items BEFORE INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.stamp_business_id();

-- updated_at triggers for records we mutate
DROP TRIGGER IF EXISTS touch_products ON public.products;
CREATE TRIGGER touch_products BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_tables ON public.restaurant_tables;
CREATE TRIGGER touch_tables BEFORE UPDATE ON public.restaurant_tables
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_orders ON public.orders;
CREATE TRIGGER touch_orders BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================================
-- ATOMIC ORDER UPSERT
-- Creates or replaces the open (pending + unpaid) order for a table.
-- Replaces all items, recomputes total, requeues kitchen if it was served,
-- and flips the table to occupied (or available if items is empty).
-- =========================================================================
CREATE OR REPLACE FUNCTION public.upsert_order_with_items(
  _table_id uuid,
  _items jsonb   -- [{ product_id, name, price, qty }]
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
  target_order_id uuid;
  total_amount numeric(10,2) := 0;
  item jsonb;
  table_name text;
  new_status table_status;
  item_count int;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT business_id, name INTO bid, caller_name FROM public.profiles WHERE id = caller;
  IF bid IS NULL THEN RAISE EXCEPTION 'Not a member of any business'; END IF;

  -- Verify the table belongs to caller's business
  SELECT name INTO table_name FROM public.restaurant_tables WHERE id = _table_id AND business_id = bid;
  IF table_name IS NULL THEN RAISE EXCEPTION 'Table not found'; END IF;

  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' THEN
    RAISE EXCEPTION 'Items must be an array';
  END IF;

  item_count := jsonb_array_length(_items);

  -- Compute total (server-authoritative)
  FOR item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    IF (item->>'qty')::int <= 0 THEN RAISE EXCEPTION 'Qty must be positive'; END IF;
    IF (item->>'price')::numeric < 0 THEN RAISE EXCEPTION 'Price must be non-negative'; END IF;
    total_amount := total_amount + (item->>'price')::numeric * (item->>'qty')::int;
  END LOOP;

  -- Find existing open order
  SELECT id, kitchen_status INTO existing_order_id, existing_kitchen
  FROM public.orders
  WHERE table_id = _table_id AND business_id = bid
    AND status = 'pending' AND payment = 'unpaid'
  ORDER BY created_at DESC LIMIT 1;

  IF existing_order_id IS NOT NULL THEN
    target_order_id := existing_order_id;
    UPDATE public.orders SET
      total = total_amount,
      table_name = table_name,
      updated_at = now(),
      kitchen_status = CASE
        WHEN existing_kitchen = 'served' AND item_count > 0 THEN 'queued'::kitchen_status
        ELSE existing_kitchen
      END,
      sent_to_kitchen_at = CASE
        WHEN existing_kitchen = 'served' AND item_count > 0 THEN now()
        ELSE sent_to_kitchen_at
      END
    WHERE id = target_order_id;

    DELETE FROM public.order_items WHERE order_id = target_order_id;
  ELSE
    INSERT INTO public.orders (business_id, table_id, table_name, total, staff_id, staff_name)
    VALUES (bid, _table_id, table_name, total_amount, caller, COALESCE(caller_name, 'Staff'))
    RETURNING id INTO target_order_id;
  END IF;

  -- Insert items
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

  -- Flip table status
  new_status := CASE WHEN item_count > 0 THEN 'occupied'::table_status ELSE 'available'::table_status END;
  UPDATE public.restaurant_tables SET status = new_status WHERE id = _table_id AND business_id = bid;

  RETURN target_order_id;
END;
$$;

-- Mark an order paid atomically: sets payment, method, timestamps, closes kitchen ticket,
-- frees the table.
CREATE OR REPLACE FUNCTION public.mark_order_paid(_order_id uuid, _method payment_method)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bid uuid;
  tid uuid;
BEGIN
  SELECT business_id INTO bid FROM public.profiles WHERE id = auth.uid();
  IF bid IS NULL THEN RAISE EXCEPTION 'Not a member of any business'; END IF;

  SELECT table_id INTO tid FROM public.orders WHERE id = _order_id AND business_id = bid;
  IF tid IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;

  UPDATE public.orders
  SET payment = 'paid',
      payment_method = _method,
      status = 'completed',
      paid_at = now(),
      kitchen_status = 'served',
      updated_at = now()
  WHERE id = _order_id AND business_id = bid;

  UPDATE public.restaurant_tables SET status = 'available' WHERE id = tid AND business_id = bid;
END;
$$;

-- Cancel an order atomically
CREATE OR REPLACE FUNCTION public.cancel_order(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bid uuid;
  tid uuid;
BEGIN
  SELECT business_id INTO bid FROM public.profiles WHERE id = auth.uid();
  IF bid IS NULL THEN RAISE EXCEPTION 'Not a member of any business'; END IF;

  SELECT table_id INTO tid FROM public.orders WHERE id = _order_id AND business_id = bid;
  IF tid IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;

  UPDATE public.orders SET status = 'cancelled', updated_at = now()
  WHERE id = _order_id AND business_id = bid;

  UPDATE public.restaurant_tables SET status = 'available' WHERE id = tid AND business_id = bid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_order_with_items(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_order_paid(uuid, payment_method) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order(uuid) TO authenticated;
