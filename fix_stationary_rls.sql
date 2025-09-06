-- Disable RLS temporarily and drop all existing policies for stationary_items
ALTER TABLE public.stationary_items DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view stationary items for their tenant" ON public.stationary_items;
DROP POLICY IF EXISTS "Users can insert stationary items for their tenant" ON public.stationary_items;
DROP POLICY IF EXISTS "Users can update stationary items for their tenant" ON public.stationary_items;
DROP POLICY IF EXISTS "Users can delete stationary items for their tenant" ON public.stationary_items;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.stationary_items;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.stationary_items;
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.stationary_items;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON public.stationary_items;

-- Re-enable RLS
ALTER TABLE public.stationary_items ENABLE ROW LEVEL SECURITY;

-- Create very permissive policies for debugging
CREATE POLICY "Allow all for authenticated users" ON public.stationary_items
    FOR ALL USING (auth.role() = 'authenticated');

-- Alternative: If the above doesn't work, use this more permissive policy
-- CREATE POLICY "Allow all operations" ON public.stationary_items
--     FOR ALL USING (true);

-- Grant permissions
GRANT ALL ON public.stationary_items TO authenticated;
GRANT ALL ON public.stationary_items TO anon;

-- Also fix the purchases table
ALTER TABLE public.stationary_purchases DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view stationary purchases for their tenant" ON public.stationary_purchases;
DROP POLICY IF EXISTS "Users can insert stationary purchases for their tenant" ON public.stationary_purchases;
DROP POLICY IF EXISTS "Users can update stationary purchases for their tenant" ON public.stationary_purchases;
DROP POLICY IF EXISTS "Users can delete stationary purchases for their tenant" ON public.stationary_purchases;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.stationary_purchases;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.stationary_purchases;
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.stationary_purchases;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON public.stationary_purchases;

ALTER TABLE public.stationary_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON public.stationary_purchases
    FOR ALL USING (auth.role() = 'authenticated');

GRANT ALL ON public.stationary_purchases TO authenticated;
GRANT ALL ON public.stationary_purchases TO anon;
