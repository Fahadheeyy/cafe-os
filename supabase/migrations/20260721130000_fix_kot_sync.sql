-- Bug 2: mark_order_paid must also set kots.kitchen_status = 'served'
CREATE OR REPLACE FUNCTION public.mark_order_paid(_order_id uuid, _method payment_method)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bid uuid;
  tid uuid;
  ord_exists boolean;
BEGIN
  SELECT business_id INTO bid FROM public.profiles WHERE id = auth.uid();
  IF bid IS NULL THEN RAISE EXCEPTION 'Not a member of any business'; END IF;

  SELECT table_id, true INTO tid, ord_exists FROM public.orders WHERE id = _order_id AND business_id = bid;
  IF ord_exists IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;

  UPDATE public.orders
  SET payment = 'paid',
      payment_method = _method,
      status = 'completed',
      paid_at = now(),
      kitchen_status = 'served',
      updated_at = now()
  WHERE id = _order_id AND business_id = bid;

  -- Mark all KOTs as served when order is paid
  UPDATE public.kots SET kitchen_status = 'served', updated_at = now()
  WHERE order_id = _order_id;

  IF tid IS NOT NULL THEN
    UPDATE public.restaurant_tables SET status = 'available' WHERE id = tid AND business_id = bid;
  END IF;
END;
$$;

-- Bug 3: cancel_order must also set kots.kitchen_status = 'served'
CREATE OR REPLACE FUNCTION public.cancel_order(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bid uuid;
  tid uuid;
  ord_exists boolean;
BEGIN
  SELECT business_id INTO bid FROM public.profiles WHERE id = auth.uid();
  IF bid IS NULL THEN RAISE EXCEPTION 'Not a member of any business'; END IF;

  SELECT table_id, true INTO tid, ord_exists FROM public.orders WHERE id = _order_id AND business_id = bid;
  IF NOT ord_exists THEN RAISE EXCEPTION 'Order not found'; END IF;

  UPDATE public.orders SET status = 'cancelled', updated_at = now()
  WHERE id = _order_id AND business_id = bid;

  -- Mark all KOTs as served when order is cancelled
  UPDATE public.kots SET kitchen_status = 'served', updated_at = now()
  WHERE order_id = _order_id;

  IF tid IS NOT NULL THEN
    UPDATE public.restaurant_tables SET status = 'available' WHERE id = tid AND business_id = bid;
  END IF;
END;
$$;

-- Bug 4: Backfill existing order_items that have no kot_id (created before KOT migration)
-- For each order that has items with NULL kot_id, create one KOT and assign those items to it.
DO $$
DECLARE
  rec RECORD;
  new_kot_id uuid;
BEGIN
  FOR rec IN
    SELECT DISTINCT oi.order_id, o.business_id
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.kot_id IS NULL
  LOOP
    INSERT INTO public.kots (business_id, order_id, kitchen_status, created_at)
    VALUES (rec.business_id, rec.order_id, COALESCE(
      (SELECT kitchen_status FROM public.orders WHERE id = rec.order_id),
      'queued'
    ), (SELECT COALESCE(sent_to_kitchen_at, created_at) FROM public.orders WHERE id = rec.order_id))
    RETURNING id INTO new_kot_id;

    UPDATE public.order_items SET kot_id = new_kot_id
    WHERE order_id = rec.order_id AND kot_id IS NULL;
  END LOOP;
END;
$$;
