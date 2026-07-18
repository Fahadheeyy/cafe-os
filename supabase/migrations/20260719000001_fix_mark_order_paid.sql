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

  IF tid IS NOT NULL THEN
    UPDATE public.restaurant_tables SET status = 'available' WHERE id = tid AND business_id = bid;
  END IF;
END;
$$;
