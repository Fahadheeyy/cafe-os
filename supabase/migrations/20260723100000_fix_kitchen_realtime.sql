-- Fix kitchen realtime updates not appearing on chef dashboard.
-- Root cause: kots and order_items tables need REPLICA IDENTITY FULL so that
-- Supabase Realtime can apply RLS filters on UPDATE/DELETE events.
-- Without FULL replica identity, UPDATE events on kots (kitchen_status changes)
-- and order_items (new items) are silently dropped for RLS-filtered subscribers.

ALTER TABLE public.kots REPLICA IDENTITY FULL;
ALTER TABLE public.order_items REPLICA IDENTITY FULL;
ALTER TABLE public.orders REPLICA IDENTITY FULL;

-- Make sure kots is in the realtime publication (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'kots'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.kots;
  END IF;
END $$;

-- Make sure orders is in the realtime publication (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END $$;

-- Make sure order_items is in the realtime publication (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'order_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
  END IF;
END $$;
