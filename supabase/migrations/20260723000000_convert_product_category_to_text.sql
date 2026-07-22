-- Migration to allow dynamic custom categories (e.g. "shake", "Starters", "Beverages") for products.
-- Converts products.category column from fixed product_category enum to text.

ALTER TABLE public.products ALTER COLUMN category TYPE text USING category::text;
