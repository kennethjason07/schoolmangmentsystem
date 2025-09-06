-- Create Stationary Items Table
CREATE TABLE IF NOT EXISTS public.stationary_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text NOT NULL CHECK (category = ANY (ARRAY['Notebooks'::text, 'Stationery'::text, 'Uniforms'::text, 'Books'::text, 'Sports'::text, 'Other'::text])),
  unit_price numeric NOT NULL CHECK (unit_price >= 0),
  stock_quantity integer NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  minimum_stock integer NOT NULL DEFAULT 10 CHECK (minimum_stock >= 0),
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  tenant_id uuid NOT NULL,
  CONSTRAINT stationary_items_pkey PRIMARY KEY (id),
  CONSTRAINT stationary_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- Create Stationary Purchases Table
CREATE TABLE IF NOT EXISTS public.stationary_purchases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  item_id uuid NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric NOT NULL CHECK (unit_price >= 0),
  total_amount numeric NOT NULL CHECK (total_amount >= 0),
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_mode text DEFAULT 'Cash'::text CHECK (payment_mode = ANY (ARRAY['Cash'::text, 'Card'::text, 'Online'::text, 'UPI'::text])),
  receipt_number bigint NOT NULL DEFAULT nextval('receipt_number_seq'::regclass) UNIQUE,
  remarks text,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  tenant_id uuid NOT NULL,
  CONSTRAINT stationary_purchases_pkey PRIMARY KEY (id),
  CONSTRAINT stationary_purchases_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT stationary_purchases_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.stationary_items(id),
  CONSTRAINT stationary_purchases_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- Create Stationary Stock Adjustments Table (for inventory management)
CREATE TABLE IF NOT EXISTS public.stationary_stock_adjustments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  adjustment_type text NOT NULL CHECK (adjustment_type = ANY (ARRAY['Add'::text, 'Remove'::text, 'Damage'::text, 'Return'::text])),
  quantity integer NOT NULL,
  reason text,
  adjusted_by uuid,
  adjustment_date timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  tenant_id uuid NOT NULL,
  CONSTRAINT stationary_stock_adjustments_pkey PRIMARY KEY (id),
  CONSTRAINT stationary_stock_adjustments_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.stationary_items(id),
  CONSTRAINT stationary_stock_adjustments_adjusted_by_fkey FOREIGN KEY (adjusted_by) REFERENCES public.users(id),
  CONSTRAINT stationary_stock_adjustments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_stationary_items_tenant_category ON public.stationary_items(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_stationary_items_active ON public.stationary_items(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_stationary_purchases_tenant_date ON public.stationary_purchases(tenant_id, purchase_date);
CREATE INDEX IF NOT EXISTS idx_stationary_purchases_student ON public.stationary_purchases(student_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_stationary_stock_adjustments_item ON public.stationary_stock_adjustments(item_id, tenant_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.stationary_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stationary_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stationary_stock_adjustments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view stationary items for their tenant" ON public.stationary_items;
DROP POLICY IF EXISTS "Admins can insert stationary items for their tenant" ON public.stationary_items;
DROP POLICY IF EXISTS "Admins can update stationary items for their tenant" ON public.stationary_items;
DROP POLICY IF EXISTS "Admins can delete stationary items for their tenant" ON public.stationary_items;
DROP POLICY IF EXISTS "Users can view stationary purchases for their tenant" ON public.stationary_purchases;
DROP POLICY IF EXISTS "Admins can insert stationary purchases for their tenant" ON public.stationary_purchases;
DROP POLICY IF EXISTS "Admins can update stationary purchases for their tenant" ON public.stationary_purchases;
DROP POLICY IF EXISTS "Users can view stock adjustments for their tenant" ON public.stationary_stock_adjustments;
DROP POLICY IF EXISTS "Admins can insert stock adjustments for their tenant" ON public.stationary_stock_adjustments;

-- Helper function to get tenant_id for current user
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS UUID AS $$
BEGIN
  -- First try to get tenant_id from user's metadata
  DECLARE
    user_tenant_id UUID;
  BEGIN
    -- Get tenant_id from users table
    SELECT tenant_id INTO user_tenant_id 
    FROM public.users 
    WHERE id = auth.uid() 
    LIMIT 1;
    
    -- If found, return it
    IF user_tenant_id IS NOT NULL THEN
      RETURN user_tenant_id;
    END IF;
    
    -- Fallback: try to get from auth metadata
    SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID INTO user_tenant_id;
    IF user_tenant_id IS NOT NULL THEN
      RETURN user_tenant_id;
    END IF;
    
    -- Final fallback: return null (will be handled by policies)
    RETURN NULL;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create more flexible RLS Policies for stationary_items
CREATE POLICY "Enable all for authenticated users with matching tenant" ON public.stationary_items
  FOR ALL
  TO authenticated
  USING (
    -- Allow if tenant_id matches user's tenant OR if user is service_role
    tenant_id = get_user_tenant_id() OR 
    auth.role() = 'service_role' OR
    -- Temporary bypass for admins - you can remove this later
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND tenant_id = stationary_items.tenant_id)
  )
  WITH CHECK (
    -- Same check for inserts/updates
    tenant_id = get_user_tenant_id() OR 
    auth.role() = 'service_role' OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND tenant_id = stationary_items.tenant_id)
  );

-- Create RLS Policies for stationary_purchases
CREATE POLICY "Enable all for authenticated users with matching tenant" ON public.stationary_purchases
  FOR ALL
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id() OR 
    auth.role() = 'service_role' OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND tenant_id = stationary_purchases.tenant_id)
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id() OR 
    auth.role() = 'service_role' OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND tenant_id = stationary_purchases.tenant_id)
  );

-- Create RLS Policies for stationary_stock_adjustments
CREATE POLICY "Enable all for authenticated users with matching tenant" ON public.stationary_stock_adjustments
  FOR ALL
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id() OR 
    auth.role() = 'service_role' OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND tenant_id = stationary_stock_adjustments.tenant_id)
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id() OR 
    auth.role() = 'service_role' OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND tenant_id = stationary_stock_adjustments.tenant_id)
  );

-- Function to update stock quantity after purchase
CREATE OR REPLACE FUNCTION update_stationary_stock_after_purchase()
RETURNS TRIGGER AS $$
BEGIN
  -- Reduce stock quantity after purchase
  UPDATE public.stationary_items 
  SET stock_quantity = stock_quantity - NEW.quantity,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.item_id AND tenant_id = NEW.tenant_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update stock after purchase
CREATE TRIGGER trigger_update_stock_after_purchase
  AFTER INSERT ON public.stationary_purchases
  FOR EACH ROW
  EXECUTE FUNCTION update_stationary_stock_after_purchase();

-- Function to update stock quantity after stock adjustment
CREATE OR REPLACE FUNCTION update_stationary_stock_after_adjustment()
RETURNS TRIGGER AS $$
BEGIN
  -- Update stock quantity based on adjustment type
  IF NEW.adjustment_type = 'Add' THEN
    UPDATE public.stationary_items 
    SET stock_quantity = stock_quantity + NEW.quantity,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.item_id AND tenant_id = NEW.tenant_id;
  ELSIF NEW.adjustment_type IN ('Remove', 'Damage') THEN
    UPDATE public.stationary_items 
    SET stock_quantity = stock_quantity - NEW.quantity,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.item_id AND tenant_id = NEW.tenant_id;
  ELSIF NEW.adjustment_type = 'Return' THEN
    UPDATE public.stationary_items 
    SET stock_quantity = stock_quantity + NEW.quantity,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.item_id AND tenant_id = NEW.tenant_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update stock after adjustment
CREATE TRIGGER trigger_update_stock_after_adjustment
  AFTER INSERT ON public.stationary_stock_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION update_stationary_stock_after_adjustment();

-- Insert some default stationary items (optional)
-- INSERT INTO public.stationary_items (name, description, category, unit_price, stock_quantity, minimum_stock, tenant_id) VALUES
-- ('Notebook (200 pages)', 'Standard lined notebook', 'Notebooks', 45.00, 100, 20, 'your-tenant-id'),
-- ('Blue Pen', 'Ball point pen - blue ink', 'Stationery', 10.00, 500, 50, 'your-tenant-id'),
-- ('School Uniform Shirt', 'White cotton shirt with school logo', 'Uniforms', 350.00, 50, 10, 'your-tenant-id'),
-- ('School Uniform Pant', 'Navy blue formal pant', 'Uniforms', 450.00, 50, 10, 'your-tenant-id'),
-- ('Geometry Box', 'Complete geometry set with compass, ruler, protractor', 'Stationery', 120.00, 30, 5, 'your-tenant-id');

-- Note: Run this SQL script in your Supabase SQL editor to create the required tables and functions.
