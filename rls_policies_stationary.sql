-- Enable RLS on stationary_items table
ALTER TABLE public.stationary_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view stationary items for their tenant" ON public.stationary_items;
DROP POLICY IF EXISTS "Users can insert stationary items for their tenant" ON public.stationary_items;
DROP POLICY IF EXISTS "Users can update stationary items for their tenant" ON public.stationary_items;
DROP POLICY IF EXISTS "Users can delete stationary items for their tenant" ON public.stationary_items;

-- Create policies for stationary_items table
CREATE POLICY "Users can view stationary items for their tenant"
ON public.stationary_items
FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.users WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can insert stationary items for their tenant"
ON public.stationary_items
FOR INSERT
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM public.users WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can update stationary items for their tenant"
ON public.stationary_items
FOR UPDATE
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.users WHERE id = auth.uid()
  )
)
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM public.users WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can delete stationary items for their tenant"
ON public.stationary_items
FOR DELETE
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.users WHERE id = auth.uid()
  )
);

-- Enable RLS on stationary_purchases table
ALTER TABLE public.stationary_purchases ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view stationary purchases for their tenant" ON public.stationary_purchases;
DROP POLICY IF EXISTS "Users can insert stationary purchases for their tenant" ON public.stationary_purchases;
DROP POLICY IF EXISTS "Users can update stationary purchases for their tenant" ON public.stationary_purchases;
DROP POLICY IF EXISTS "Users can delete stationary purchases for their tenant" ON public.stationary_purchases;

-- Create policies for stationary_purchases table
CREATE POLICY "Users can view stationary purchases for their tenant"
ON public.stationary_purchases
FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.users WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can insert stationary purchases for their tenant"
ON public.stationary_purchases
FOR INSERT
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM public.users WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can update stationary purchases for their tenant"
ON public.stationary_purchases
FOR UPDATE
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.users WHERE id = auth.uid()
  )
)
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM public.users WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can delete stationary purchases for their tenant"
ON public.stationary_purchases
FOR DELETE
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.users WHERE id = auth.uid()
  )
);

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stationary_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stationary_purchases TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
