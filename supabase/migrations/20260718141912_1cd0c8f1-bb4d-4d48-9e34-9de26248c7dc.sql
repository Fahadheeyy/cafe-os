
-- ============================================================================
-- CLEAN SLATE — drop everything from phase 1
-- ============================================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TABLE IF EXISTS public.waste_entries CASCADE;
DROP TABLE IF EXISTS public.expenses CASCADE;
DROP TABLE IF EXISTS public.purchase_lines CASCADE;
DROP TABLE IF EXISTS public.purchases CASCADE;
DROP TABLE IF EXISTS public.purchase_requests CASCADE;
DROP TABLE IF EXISTS public.stock_history CASCADE;
DROP TABLE IF EXISTS public.stock_items CASCADE;
DROP TABLE IF EXISTS public.order_items CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.restaurant_tables CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.suppliers CASCADE;
DROP TABLE IF EXISTS public.settings CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.businesses CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.is_owner() CASCADE;
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role) CASCADE;
DROP FUNCTION IF EXISTS public.current_business_id() CASCADE;
DROP FUNCTION IF EXISTS public.touch_updated_at() CASCADE;

-- ============================================================================
-- Shared updated_at trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============================================================================
-- BUSINESSES (tenant root)
-- ============================================================================
CREATE TABLE public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo TEXT,
  currency TEXT NOT NULL DEFAULT '₹',
  tax_percent NUMERIC(5,2) NOT NULL DEFAULT 5,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.businesses TO authenticated;
GRANT ALL ON public.businesses TO service_role;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_businesses_updated BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================================
-- PROFILES
-- ============================================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_profiles_business ON public.profiles(business_id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================================
-- USER ROLES (scoped to a business)
-- ============================================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, business_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_user_roles_business ON public.user_roles(business_id);

-- ============================================================================
-- Security helpers
-- ============================================================================
CREATE OR REPLACE FUNCTION public.current_business_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT business_id FROM public.profiles WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _business_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND business_id = _business_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(auth.uid(), public.current_business_id(), 'owner') $$;

REVOKE EXECUTE ON FUNCTION public.current_business_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_owner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_business_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_owner() TO authenticated;

-- ============================================================================
-- Handle new user: create minimal profile shell. No auto-business.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- PROFILES + USER_ROLES + BUSINESSES policies
-- ============================================================================
CREATE POLICY "profiles_select_own_business" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR business_id = public.current_business_id());
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_owner_manage" ON public.profiles FOR ALL TO authenticated
  USING (business_id = public.current_business_id() AND public.is_owner())
  WITH CHECK (business_id = public.current_business_id() AND public.is_owner());

CREATE POLICY "user_roles_select_own_business" ON public.user_roles FOR SELECT TO authenticated
  USING (business_id = public.current_business_id());
CREATE POLICY "user_roles_owner_manage" ON public.user_roles FOR ALL TO authenticated
  USING (business_id = public.current_business_id() AND public.is_owner())
  WITH CHECK (business_id = public.current_business_id() AND public.is_owner());
GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

CREATE POLICY "businesses_select_own" ON public.businesses FOR SELECT TO authenticated
  USING (id = public.current_business_id());
CREATE POLICY "businesses_owner_update" ON public.businesses FOR UPDATE TO authenticated
  USING (id = public.current_business_id() AND public.is_owner())
  WITH CHECK (id = public.current_business_id() AND public.is_owner());

-- ============================================================================
-- PRODUCTS
-- ============================================================================
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
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
CREATE INDEX idx_products_business ON public.products(business_id);
CREATE INDEX idx_products_category ON public.products(business_id, category);
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE POLICY "products_tenant_read" ON public.products FOR SELECT TO authenticated
  USING (business_id = public.current_business_id());
CREATE POLICY "products_tenant_owner_write" ON public.products FOR ALL TO authenticated
  USING (business_id = public.current_business_id() AND public.is_owner())
  WITH CHECK (business_id = public.current_business_id() AND public.is_owner());

-- ============================================================================
-- RESTAURANT TABLES
-- ============================================================================
CREATE TABLE public.restaurant_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status table_status NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_tables TO authenticated;
GRANT ALL ON public.restaurant_tables TO service_role;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_tables_business ON public.restaurant_tables(business_id);
CREATE TRIGGER trg_tables_updated BEFORE UPDATE ON public.restaurant_tables
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE POLICY "tables_tenant_read" ON public.restaurant_tables FOR SELECT TO authenticated
  USING (business_id = public.current_business_id());
CREATE POLICY "tables_tenant_status_update" ON public.restaurant_tables FOR UPDATE TO authenticated
  USING (business_id = public.current_business_id())
  WITH CHECK (business_id = public.current_business_id());
CREATE POLICY "tables_tenant_owner_modify" ON public.restaurant_tables FOR ALL TO authenticated
  USING (business_id = public.current_business_id() AND public.is_owner())
  WITH CHECK (business_id = public.current_business_id() AND public.is_owner());

-- ============================================================================
-- ORDERS + ORDER ITEMS
-- ============================================================================
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
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
CREATE INDEX idx_orders_business ON public.orders(business_id);
CREATE INDEX idx_orders_table ON public.orders(business_id, table_id);
CREATE INDEX idx_orders_status ON public.orders(business_id, status, payment);
CREATE INDEX idx_orders_created ON public.orders(business_id, created_at DESC);
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE POLICY "orders_tenant_all" ON public.orders FOR ALL TO authenticated
  USING (business_id = public.current_business_id())
  WITH CHECK (business_id = public.current_business_id());

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
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
CREATE INDEX idx_order_items_business ON public.order_items(business_id);
CREATE POLICY "order_items_tenant_all" ON public.order_items FOR ALL TO authenticated
  USING (business_id = public.current_business_id())
  WITH CHECK (business_id = public.current_business_id());

-- ============================================================================
-- STOCK ITEMS + HISTORY
-- ============================================================================
CREATE TABLE public.stock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
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
CREATE INDEX idx_stock_items_business ON public.stock_items(business_id);
CREATE TRIGGER trg_stock_items_updated BEFORE UPDATE ON public.stock_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE POLICY "stock_items_tenant_read" ON public.stock_items FOR SELECT TO authenticated
  USING (business_id = public.current_business_id());
CREATE POLICY "stock_items_tenant_balance_update" ON public.stock_items FOR UPDATE TO authenticated
  USING (business_id = public.current_business_id())
  WITH CHECK (business_id = public.current_business_id());
CREATE POLICY "stock_items_tenant_owner_modify" ON public.stock_items FOR ALL TO authenticated
  USING (business_id = public.current_business_id() AND public.is_owner())
  WITH CHECK (business_id = public.current_business_id() AND public.is_owner());

CREATE TABLE public.stock_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
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
CREATE INDEX idx_stock_history_business ON public.stock_history(business_id);
CREATE POLICY "stock_history_tenant_all" ON public.stock_history FOR ALL TO authenticated
  USING (business_id = public.current_business_id())
  WITH CHECK (business_id = public.current_business_id());

-- ============================================================================
-- PURCHASE REQUESTS
-- ============================================================================
CREATE TABLE public.purchase_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
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
CREATE INDEX idx_requests_business ON public.purchase_requests(business_id, status, created_at DESC);
CREATE POLICY "requests_tenant_all" ON public.purchase_requests FOR ALL TO authenticated
  USING (business_id = public.current_business_id())
  WITH CHECK (business_id = public.current_business_id());

-- ============================================================================
-- PURCHASES + LINES
-- ============================================================================
CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  supplier TEXT NOT NULL,
  invoice_number TEXT,
  purchase_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_purchases_business ON public.purchases(business_id, purchase_date DESC);
CREATE POLICY "purchases_tenant_read" ON public.purchases FOR SELECT TO authenticated
  USING (business_id = public.current_business_id());
CREATE POLICY "purchases_tenant_owner_write" ON public.purchases FOR ALL TO authenticated
  USING (business_id = public.current_business_id() AND public.is_owner())
  WITH CHECK (business_id = public.current_business_id() AND public.is_owner());

CREATE TABLE public.purchase_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
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
CREATE INDEX idx_purchase_lines_business ON public.purchase_lines(business_id);
CREATE POLICY "purchase_lines_tenant_read" ON public.purchase_lines FOR SELECT TO authenticated
  USING (business_id = public.current_business_id());
CREATE POLICY "purchase_lines_tenant_owner_write" ON public.purchase_lines FOR ALL TO authenticated
  USING (business_id = public.current_business_id() AND public.is_owner())
  WITH CHECK (business_id = public.current_business_id() AND public.is_owner());

-- ============================================================================
-- EXPENSES
-- ============================================================================
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
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
CREATE INDEX idx_expenses_business ON public.expenses(business_id, expense_date DESC);
CREATE POLICY "expenses_tenant_read" ON public.expenses FOR SELECT TO authenticated
  USING (business_id = public.current_business_id());
CREATE POLICY "expenses_tenant_owner_write" ON public.expenses FOR ALL TO authenticated
  USING (business_id = public.current_business_id() AND public.is_owner())
  WITH CHECK (business_id = public.current_business_id() AND public.is_owner());

-- ============================================================================
-- WASTE
-- ============================================================================
CREATE TABLE public.waste_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
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
CREATE INDEX idx_waste_business ON public.waste_entries(business_id, created_at DESC);
CREATE POLICY "waste_tenant_all" ON public.waste_entries FOR ALL TO authenticated
  USING (business_id = public.current_business_id())
  WITH CHECK (business_id = public.current_business_id());

-- ============================================================================
-- SUPPLIERS
-- ============================================================================
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_suppliers_business ON public.suppliers(business_id);
CREATE POLICY "suppliers_tenant_all" ON public.suppliers FOR ALL TO authenticated
  USING (business_id = public.current_business_id())
  WITH CHECK (business_id = public.current_business_id());

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  target_role app_role,
  read_by UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notifications_business ON public.notifications(business_id, created_at DESC);
CREATE POLICY "notifications_tenant_all" ON public.notifications FOR ALL TO authenticated
  USING (business_id = public.current_business_id())
  WITH CHECK (business_id = public.current_business_id());

-- ============================================================================
-- create_business_and_owner RPC (activates a signed-in user as first Owner)
-- Seeds default menu / tables / stock / suppliers for the new business.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_business_and_owner(_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_business_id UUID;
  caller UUID := auth.uid();
  existing UUID;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _name IS NULL OR length(trim(_name)) = 0 THEN
    RAISE EXCEPTION 'Business name is required';
  END IF;

  SELECT business_id INTO existing FROM public.profiles WHERE id = caller;
  IF existing IS NOT NULL THEN
    RAISE EXCEPTION 'You already belong to a business';
  END IF;

  INSERT INTO public.businesses (name, created_by)
  VALUES (trim(_name), caller)
  RETURNING id INTO new_business_id;

  UPDATE public.profiles SET business_id = new_business_id WHERE id = caller;
  INSERT INTO public.user_roles (user_id, business_id, role) VALUES (caller, new_business_id, 'owner');

  -- Seed default menu
  INSERT INTO public.products (business_id, name, category, price) VALUES
    (new_business_id, 'Masala Chai', 'Tea', 40),
    (new_business_id, 'Green Tea', 'Tea', 60),
    (new_business_id, 'Lemon Tea', 'Tea', 50),
    (new_business_id, 'Espresso', 'Coffee', 90),
    (new_business_id, 'Cappuccino', 'Coffee', 140),
    (new_business_id, 'Latte', 'Coffee', 150),
    (new_business_id, 'Cold Brew', 'Coffee', 180),
    (new_business_id, 'Samosa', 'Snacks', 30),
    (new_business_id, 'Veg Sandwich', 'Snacks', 120),
    (new_business_id, 'French Fries', 'Snacks', 130),
    (new_business_id, 'Paneer Wrap', 'Meals', 220),
    (new_business_id, 'Pasta Alfredo', 'Meals', 280),
    (new_business_id, 'Orange Juice', 'Juice', 110),
    (new_business_id, 'Watermelon Juice', 'Juice', 100),
    (new_business_id, 'Chocolate Brownie', 'Desserts', 150),
    (new_business_id, 'Cheesecake', 'Desserts', 190);

  -- Seed default tables (8)
  INSERT INTO public.restaurant_tables (business_id, name)
  SELECT new_business_id, 'Table ' || g FROM generate_series(1, 8) g;

  -- Seed default stock
  INSERT INTO public.stock_items (business_id, name, category, current_balance, unit, minimum_balance) VALUES
    (new_business_id, 'Milk', 'Dairy', 8, 'L', 10),
    (new_business_id, 'Tea Powder', 'Beverages', 700, 'g', 1000),
    (new_business_id, 'Coffee Beans', 'Beverages', 2.5, 'kg', 2),
    (new_business_id, 'Sugar', 'Groceries', 4, 'kg', 3),
    (new_business_id, 'Bread Loaves', 'Bakery', 6, 'pcs', 15),
    (new_business_id, 'Chicken', 'Meat', 1, 'kg', 5),
    (new_business_id, 'Tomatoes', 'Produce', 3, 'kg', 2);

  -- Seed suppliers
  INSERT INTO public.suppliers (business_id, name) VALUES
    (new_business_id, 'Fresh Dairy Co.'),
    (new_business_id, 'Metro Wholesale'),
    (new_business_id, 'Green Farms');

  RETURN new_business_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_business_and_owner(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_business_and_owner(TEXT) TO authenticated;

-- ============================================================================
-- REALTIME
-- ============================================================================
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.order_items REPLICA IDENTITY FULL;
ALTER TABLE public.restaurant_tables REPLICA IDENTITY FULL;
ALTER TABLE public.stock_items REPLICA IDENTITY FULL;
ALTER TABLE public.purchase_requests REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurant_tables;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.purchase_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
