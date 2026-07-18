REVOKE ALL ON FUNCTION public.set_stock_balance(uuid, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_purchase(text, text, timestamptz, numeric, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_waste(uuid, numeric, unit_type, waste_reason, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_stock_balance(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_purchase(text, text, timestamptz, numeric, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_waste(uuid, numeric, unit_type, waste_reason, text) TO authenticated;