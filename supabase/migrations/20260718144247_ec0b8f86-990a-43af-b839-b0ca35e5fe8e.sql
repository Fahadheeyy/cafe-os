CREATE OR REPLACE FUNCTION public.set_stock_balance(
  _stock_item_id uuid,
  _new_balance numeric,
  _note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  bid uuid; caller uuid := auth.uid(); caller_name text; prev numeric;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _new_balance < 0 THEN RAISE EXCEPTION 'New balance must be >= 0'; END IF;
  SELECT business_id, name INTO bid, caller_name FROM public.profiles WHERE id = caller;
  IF bid IS NULL THEN RAISE EXCEPTION 'Not a member of any business'; END IF;
  SELECT current_balance INTO prev FROM public.stock_items WHERE id = _stock_item_id AND business_id = bid;
  IF prev IS NULL THEN RAISE EXCEPTION 'Stock item not found'; END IF;
  UPDATE public.stock_items SET current_balance = _new_balance, updated_at = now()
    WHERE id = _stock_item_id AND business_id = bid;
  INSERT INTO public.stock_history (business_id, stock_item_id, updated_by_id, updated_by_name, previous_balance, new_balance, note, kind)
  VALUES (bid, _stock_item_id, caller, COALESCE(caller_name, 'System'), prev, _new_balance, _note, 'update');
END;
$$;

CREATE OR REPLACE FUNCTION public.record_purchase(
  _supplier text, _invoice_number text, _purchase_date timestamptz, _tax numeric, _lines jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  bid uuid; caller uuid := auth.uid(); caller_name text; purchase_id uuid;
  line jsonb; subtotal_amt numeric := 0; total_amt numeric;
  sid uuid; qty numeric; rate numeric; line_total numeric; line_name text; line_unit unit_type; prev_bal numeric;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _supplier IS NULL OR length(trim(_supplier)) = 0 THEN RAISE EXCEPTION 'Supplier is required'; END IF;
  IF _lines IS NULL OR jsonb_typeof(_lines) <> 'array' OR jsonb_array_length(_lines) = 0 THEN
    RAISE EXCEPTION 'At least one line item is required';
  END IF;
  SELECT business_id, name INTO bid, caller_name FROM public.profiles WHERE id = caller;
  IF bid IS NULL THEN RAISE EXCEPTION 'Not a member of any business'; END IF;

  FOR line IN SELECT * FROM jsonb_array_elements(_lines) LOOP
    qty := (line->>'quantity')::numeric; rate := (line->>'rate')::numeric;
    IF qty <= 0 THEN RAISE EXCEPTION 'Quantity must be > 0'; END IF;
    IF rate < 0 THEN RAISE EXCEPTION 'Rate must be >= 0'; END IF;
    subtotal_amt := subtotal_amt + qty * rate;
  END LOOP;
  total_amt := subtotal_amt + COALESCE(_tax, 0);

  INSERT INTO public.purchases (business_id, supplier, invoice_number, purchase_date, subtotal, tax, total)
  VALUES (bid, trim(_supplier), NULLIF(trim(_invoice_number), ''), COALESCE(_purchase_date, now()), subtotal_amt, COALESCE(_tax, 0), total_amt)
  RETURNING id INTO purchase_id;

  FOR line IN SELECT * FROM jsonb_array_elements(_lines) LOOP
    sid := NULLIF(line->>'stock_item_id', '')::uuid;
    qty := (line->>'quantity')::numeric; rate := (line->>'rate')::numeric;
    line_total := qty * rate; line_name := line->>'name'; line_unit := (line->>'unit')::unit_type;

    INSERT INTO public.purchase_lines (business_id, purchase_id, stock_item_id, name, quantity, unit, rate, total)
    VALUES (bid, purchase_id, sid, line_name, qty, line_unit, rate, line_total);

    IF sid IS NOT NULL THEN
      SELECT current_balance INTO prev_bal FROM public.stock_items WHERE id = sid AND business_id = bid;
      IF prev_bal IS NOT NULL THEN
        UPDATE public.stock_items SET current_balance = prev_bal + qty, updated_at = now()
          WHERE id = sid AND business_id = bid;
        INSERT INTO public.stock_history (business_id, stock_item_id, updated_by_id, updated_by_name, previous_balance, new_balance, note, kind)
        VALUES (bid, sid, caller, COALESCE(caller_name, 'Owner'), prev_bal, prev_bal + qty, 'Purchase from ' || trim(_supplier), 'purchase');
      END IF;
    END IF;
  END LOOP;

  INSERT INTO public.expenses (business_id, title, category, amount, expense_date, notes, purchase_id)
  VALUES (bid, 'Purchase: ' || trim(_supplier), 'Purchases', total_amt, COALESCE(_purchase_date, now())::date,
    CASE WHEN NULLIF(trim(_invoice_number), '') IS NOT NULL THEN 'Invoice ' || trim(_invoice_number) ELSE NULL END,
    purchase_id);

  INSERT INTO public.suppliers (business_id, name) VALUES (bid, trim(_supplier)) ON CONFLICT DO NOTHING;

  RETURN purchase_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_waste(
  _stock_item_id uuid, _quantity numeric, _unit unit_type, _reason waste_reason, _notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  bid uuid; caller uuid := auth.uid(); caller_name text;
  prev_bal numeric; new_bal numeric; waste_id uuid; rate numeric := 0; cost numeric;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be > 0'; END IF;
  SELECT business_id, name INTO bid, caller_name FROM public.profiles WHERE id = caller;
  IF bid IS NULL THEN RAISE EXCEPTION 'Not a member of any business'; END IF;
  SELECT current_balance INTO prev_bal FROM public.stock_items WHERE id = _stock_item_id AND business_id = bid;
  IF prev_bal IS NULL THEN RAISE EXCEPTION 'Stock item not found'; END IF;
  new_bal := GREATEST(0, prev_bal - _quantity);

  SELECT pl.rate INTO rate FROM public.purchase_lines pl
  JOIN public.purchases p ON p.id = pl.purchase_id
  WHERE pl.stock_item_id = _stock_item_id AND pl.business_id = bid
  ORDER BY p.purchase_date DESC LIMIT 1;
  rate := COALESCE(rate, 0); cost := rate * _quantity;

  INSERT INTO public.waste_entries (business_id, stock_item_id, quantity, unit, reason, notes, reported_by_id, reported_by_name, estimated_cost)
  VALUES (bid, _stock_item_id, _quantity, _unit, _reason, _notes, caller, COALESCE(caller_name, 'Chef'), cost)
  RETURNING id INTO waste_id;

  UPDATE public.stock_items SET current_balance = new_bal, updated_at = now()
    WHERE id = _stock_item_id AND business_id = bid;

  INSERT INTO public.stock_history (business_id, stock_item_id, updated_by_id, updated_by_name, previous_balance, new_balance, note, kind)
  VALUES (bid, _stock_item_id, caller, COALESCE(caller_name, 'Chef'), prev_bal, new_bal, 'Waste: ' || _reason::text, 'waste');

  RETURN waste_id;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS suppliers_business_name_uidx ON public.suppliers (business_id, name);
