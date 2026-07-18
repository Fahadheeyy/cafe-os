
-- ============================================================================
-- ENUMS
-- ============================================================================
CREATE TYPE public.app_role AS ENUM ('owner', 'manager', 'staff', 'chef');
CREATE TYPE public.product_category AS ENUM ('Tea', 'Coffee', 'Snacks', 'Meals', 'Juice', 'Desserts');
CREATE TYPE public.table_status AS ENUM ('available', 'occupied', 'bill_ready');
CREATE TYPE public.order_status AS ENUM ('pending', 'completed', 'cancelled');
CREATE TYPE public.payment_status AS ENUM ('unpaid', 'paid');
CREATE TYPE public.payment_method AS ENUM ('upi', 'cash');
CREATE TYPE public.kitchen_status AS ENUM ('queued', 'preparing', 'ready', 'served');
CREATE TYPE public.stock_category AS ENUM ('Dairy', 'Beverages', 'Bakery', 'Produce', 'Meat', 'Groceries', 'Other');
CREATE TYPE public.unit_type AS ENUM ('L', 'ml', 'kg', 'g', 'pcs', 'pack');
CREATE TYPE public.priority_level AS ENUM ('low', 'medium', 'high');
CREATE TYPE public.request_status AS ENUM ('pending', 'approved', 'purchased', 'rejected');
CREATE TYPE public.expense_category AS ENUM ('Rent', 'Electricity', 'Gas', 'Salary', 'Maintenance', 'Cleaning', 'Internet', 'Purchases', 'Miscellaneous');
CREATE TYPE public.waste_reason AS ENUM ('Spillage', 'Expired', 'Burnt', 'Damaged', 'Other');
CREATE TYPE public.stock_history_kind AS ENUM ('update', 'purchase', 'waste');

-- ============================================================================
-- Shared updated_at trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ============================================================================
-- PROFILES + USER ROLES
-- ============================================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security-definer function (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.is_owner() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(auth.uid(), 'owner') $$;

-- New-user handler: create profile, first user becomes owner, otherwise staff
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE assigned_role app_role;
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'owner') THEN
    assigned_role := 'owner';
  ELSE
    assigned_role := 'staff';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Profile policies
CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_owner_all" ON public.profiles FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- user_roles policies
CREATE POLICY "user_roles_select_authenticated" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_roles_owner_all" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- ============================================================================
-- SETTINGS (single row)
-- ============================================================================
CREATE TABLE public.settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  restaurant_name TEXT NOT NULL DEFAULT 'CafeOS',
  logo TEXT,
  currency TEXT NOT NULL DEFAULT '₹',
  tax_percent NUMERIC(5,2) NOT NULL DEFAULT 5,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE POLICY "settings_select_auth" ON public.settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_owner_write" ON public.settings FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());
GRANT INSERT, UPDATE ON public.settings TO authenticated;

-- ============================================================================
-- PRODUCTS
-- ============================================================================
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category product_category NOT NULL,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  description TEXT,
  image TEXT,
  available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_products_category ON public.products(category);
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE POLICY "products_select_auth" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "products_owner_write" ON public.products FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- ============================================================================
-- RESTAURANT TABLES
-- ============================================================================
CREATE TABLE public.restaurant_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status table_status NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_tables TO authenticated;
GRANT ALL ON public.restaurant_tables TO service_role;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_tables_updated BEFORE UPDATE ON public.restaurant_tables
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE POLICY "tables_select_auth" ON public.restaurant_tables FOR SELECT TO authenticated USING (true);
CREATE POLICY "tables_write_auth" ON public.restaurant_tables FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "tables_owner_modify" ON public.restaurant_tables FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- ============================================================================
-- ORDERS + ORDER ITEMS
-- ============================================================================
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE RESTRICT,
  table_name TEXT NOT NULL,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  status order_status NOT NULL DEFAULT 'pending',
  payment payment_status NOT NULL DEFAULT 'unpaid',
  payment_method payment_method,
  staff_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  staff_name TEXT NOT NULL DEFAULT 'Staff',
  kitchen_status kitchen_status NOT NULL DEFAULT 'queued',
  sent_to_kitchen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_orders_table ON public.orders(table_id);
CREATE INDEX idx_orders_status ON public.orders(status, payment);
CREATE INDEX idx_orders_created ON public.orders(created_at DESC);
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE POLICY "orders_all_auth" ON public.orders FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  qty INTEGER NOT NULL CHECK (qty > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_order_items_order ON public.order_items(order_id);
CREATE POLICY "order_items_all_auth" ON public.order_items FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ============================================================================
-- STOCK ITEMS + HISTORY
-- ============================================================================
CREATE TABLE public.stock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category stock_category NOT NULL DEFAULT 'Other',
  current_balance NUMERIC(12,3) NOT NULL DEFAULT 0,
  unit unit_type NOT NULL,
  minimum_balance NUMERIC(12,3) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_items TO authenticated;
GRANT ALL ON public.stock_items TO service_role;
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_stock_items_updated BEFORE UPDATE ON public.stock_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE POLICY "stock_items_select_auth" ON public.stock_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "stock_items_update_auth" ON public.stock_items FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "stock_items_owner_modify" ON public.stock_items FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE TABLE public.stock_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_item_id UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  updated_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by_name TEXT NOT NULL,
  previous_balance NUMERIC(12,3) NOT NULL,
  new_balance NUMERIC(12,3) NOT NULL,
  note TEXT,
  kind stock_history_kind NOT NULL DEFAULT 'update',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.stock_history TO authenticated;
GRANT ALL ON public.stock_history TO service_role;
ALTER TABLE public.stock_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_stock_history_item ON public.stock_history(stock_item_id, created_at DESC);
CREATE POLICY "stock_history_all_auth" ON public.stock_history FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ============================================================================
-- PURCHASE REQUESTS
-- ============================================================================
CREATE TABLE public.purchase_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_item_id UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  requested_quantity NUMERIC(12,3) NOT NULL CHECK (requested_quantity > 0),
  unit unit_type NOT NULL,
  priority priority_level NOT NULL DEFAULT 'medium',
  notes TEXT,
  requested_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_by_name TEXT NOT NULL,
  status request_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_requests TO authenticated;
GRANT ALL ON public.purchase_requests TO service_role;
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_requests_status ON public.purchase_requests(status, created_at DESC);
CREATE POLICY "requests_all_auth" ON public.purchase_requests FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ============================================================================
-- PURCHASES + LINES
-- ============================================================================
CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier TEXT NOT NULL,
  invoice_number TEXT,
  purchase_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.purchases TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_purchases_date ON public.purchases(purchase_date DESC);
CREATE POLICY "purchases_select_auth" ON public.purchases FOR SELECT TO authenticated USING (true);
CREATE POLICY "purchases_owner_write" ON public.purchases FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE TABLE public.purchase_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  stock_item_id UUID REFERENCES public.stock_items(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  unit unit_type NOT NULL,
  rate NUMERIC(12,2) NOT NULL CHECK (rate >= 0),
  total NUMERIC(12,2) NOT NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_lines TO authenticated;
GRANT ALL ON public.purchase_lines TO service_role;
ALTER TABLE public.purchase_lines ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_purchase_lines_purchase ON public.purchase_lines(purchase_id);
CREATE POLICY "purchase_lines_select_auth" ON public.purchase_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "purchase_lines_owner_write" ON public.purchase_lines FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- ============================================================================
-- EXPENSES
-- ============================================================================
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category expense_category NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  notes TEXT,
  expense_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  purchase_id UUID REFERENCES public.purchases(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_expenses_date ON public.expenses(expense_date DESC);
CREATE POLICY "expenses_select_auth" ON public.expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "expenses_owner_write" ON public.expenses FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- ============================================================================
-- WASTE
-- ============================================================================
CREATE TABLE public.waste_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_item_id UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  quantity NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  unit unit_type NOT NULL,
  reason waste_reason NOT NULL,
  notes TEXT,
  reported_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_by_name TEXT NOT NULL,
  estimated_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.waste_entries TO authenticated;
GRANT ALL ON public.waste_entries TO service_role;
ALTER TABLE public.waste_entries ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_waste_date ON public.waste_entries(created_at DESC);
CREATE POLICY "waste_all_auth" ON public.waste_entries FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ============================================================================
-- SUPPLIERS
-- ============================================================================
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers_all_auth" ON public.suppliers FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ============================================================================
-- SEED DATA
-- ============================================================================
INSERT INTO public.settings (id) VALUES (true);

INSERT INTO public.products (name, category, price) VALUES
  ('Masala Chai', 'Tea', 40), ('Green Tea', 'Tea', 60), ('Lemon Tea', 'Tea', 50),
  ('Espresso', 'Coffee', 90), ('Cappuccino', 'Coffee', 140), ('Latte', 'Coffee', 150), ('Cold Brew', 'Coffee', 180),
  ('Samosa', 'Snacks', 30), ('Veg Sandwich', 'Snacks', 120), ('French Fries', 'Snacks', 130),
  ('Paneer Wrap', 'Meals', 220), ('Pasta Alfredo', 'Meals', 280),
  ('Orange Juice', 'Juice', 110), ('Watermelon Juice', 'Juice', 100),
  ('Chocolate Brownie', 'Desserts', 150), ('Cheesecake', 'Desserts', 190);

INSERT INTO public.restaurant_tables (name) VALUES
  ('Table 1'), ('Table 2'), ('Table 3'), ('Table 4'),
  ('Table 5'), ('Table 6'), ('Table 7'), ('Table 8');

INSERT INTO public.stock_items (name, category, current_balance, unit, minimum_balance) VALUES
  ('Milk', 'Dairy', 8, 'L', 10),
  ('Tea Powder', 'Beverages', 700, 'g', 1000),
  ('Coffee Beans', 'Beverages', 2.5, 'kg', 2),
  ('Sugar', 'Groceries', 4, 'kg', 3),
  ('Bread Loaves', 'Bakery', 6, 'pcs', 15),
  ('Chicken', 'Meat', 1, 'kg', 5),
  ('Tomatoes', 'Produce', 3, 'kg', 2);

INSERT INTO public.suppliers (name) VALUES
  ('Fresh Dairy Co.'), ('Metro Wholesale'), ('Green Farms');
