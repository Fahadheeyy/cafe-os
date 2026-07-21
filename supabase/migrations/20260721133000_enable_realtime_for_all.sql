-- Enable realtime for newly added tables that were missed
ALTER TABLE public.kots REPLICA IDENTITY FULL;
ALTER TABLE public.expenses REPLICA IDENTITY FULL;
ALTER TABLE public.waste_entries REPLICA IDENTITY FULL;
ALTER TABLE public.suppliers REPLICA IDENTITY FULL;
ALTER TABLE public.purchases REPLICA IDENTITY FULL;
ALTER TABLE public.stock_history REPLICA IDENTITY FULL;

-- Add them to the supabase_realtime publication
-- We use a DO block to avoid errors if they are already in the publication
DO $$
BEGIN
  -- kots
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'kots'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.kots;
  END IF;

  -- expenses
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'expenses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
  END IF;

  -- waste_entries
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'waste_entries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.waste_entries;
  END IF;

  -- suppliers
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'suppliers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.suppliers;
  END IF;

  -- purchases
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'purchases'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.purchases;
  END IF;

  -- stock_history
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'stock_history'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_history;
  END IF;
END $$;
