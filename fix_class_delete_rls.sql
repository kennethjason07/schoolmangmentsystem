-- Fix RLS policies for class deletion
-- Run this in your Supabase SQL Editor

-- First, check if there are existing DELETE policies
SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies 
WHERE tablename = 'classes' AND cmd = 'DELETE';

-- Drop existing DELETE policies if they exist (optional - only if needed)
-- DROP POLICY IF EXISTS "Allow delete for authenticated users" ON classes;
-- DROP POLICY IF EXISTS "Allow delete for admin users" ON classes;

-- Create a new DELETE policy for classes table
-- This allows authenticated users to delete classes from their own tenant
CREATE POLICY "Enable delete for authenticated users on own tenant classes"
ON classes
FOR DELETE
TO authenticated
USING (
  tenant_id = (
    SELECT tenant_id 
    FROM user_profiles 
    WHERE user_id = auth.uid()
  )
);

-- Alternative policy if you use a different user/tenant relationship
-- Uncomment and modify this if your setup is different:
/*
CREATE POLICY "Enable delete for admin users on classes"
ON classes
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = auth.uid() 
    AND tenant_id = classes.tenant_id
    AND role = 'admin'
  )
);
*/

-- Check the new policy was created
SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies 
WHERE tablename = 'classes' AND cmd = 'DELETE';