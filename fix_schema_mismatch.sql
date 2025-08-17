-- Fix Schema Mismatch for Parent Login
-- This script aligns the database structure with what the code expects

BEGIN;

-- 1. Create the parent_student_relationships table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.parent_student_relationships (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    parent_id uuid NOT NULL,
    student_id uuid NOT NULL,
    relationship_type text NOT NULL DEFAULT 'Guardian' CHECK (relationship_type = ANY (ARRAY['Father'::text, 'Mother'::text, 'Guardian'::text])),
    is_primary_contact boolean DEFAULT true,
    is_emergency_contact boolean DEFAULT true,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT parent_student_relationships_pkey PRIMARY KEY (id),
    CONSTRAINT parent_student_relationships_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT parent_student_relationships_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE,
    CONSTRAINT unique_parent_student UNIQUE (parent_id, student_id)
);

-- 2. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_parent_student_relationships_parent_id ON public.parent_student_relationships(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_student_relationships_student_id ON public.parent_student_relationships(student_id);
CREATE INDEX IF NOT EXISTS idx_parent_student_relationships_primary_contact ON public.parent_student_relationships(is_primary_contact) WHERE is_primary_contact = true;

-- 3. Migrate existing parent-student relationships from the old structure
INSERT INTO public.parent_student_relationships (parent_id, student_id, relationship_type, is_primary_contact, is_emergency_contact)
SELECT 
    s.parent_id as parent_id,
    s.id as student_id,
    'Guardian' as relationship_type,  -- Default to Guardian since we don't have relation info
    true as is_primary_contact,
    true as is_emergency_contact
FROM public.students s
WHERE s.parent_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM public.parent_student_relationships psr 
      WHERE psr.parent_id = s.parent_id AND psr.student_id = s.id
  );

-- 4. Create a parents table if it doesn't exist (for the code that expects it)
CREATE TABLE IF NOT EXISTS public.parents (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    email text NOT NULL UNIQUE,
    phone text,
    photo_url text,
    school_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT parents_pkey PRIMARY KEY (id)
);

-- 5. Populate parents table from users table for parent users
INSERT INTO public.parents (id, name, email, phone, photo_url)
SELECT 
    u.id,
    COALESCE(u.full_name, 'Parent') as name,
    u.email,
    u.phone,
    u.profile_url as photo_url
FROM public.users u
JOIN public.roles r ON u.role_id = r.id
WHERE r.role_name = 'parent'
  AND NOT EXISTS (SELECT 1 FROM public.parents p WHERE p.id = u.id);

-- 6. Update the parent_student_relationships to use the parents table
-- First, drop the old foreign key constraint
ALTER TABLE public.parent_student_relationships DROP CONSTRAINT IF EXISTS parent_student_relationships_parent_id_fkey;

-- Add new foreign key to parents table
ALTER TABLE public.parent_student_relationships 
ADD CONSTRAINT parent_student_relationships_parent_id_fkey 
FOREIGN KEY (parent_id) REFERENCES public.parents(id) ON DELETE CASCADE;

-- 7. Update existing relationships to use parent records from parents table
UPDATE public.parent_student_relationships 
SET parent_id = p.id
FROM public.parents p
WHERE p.email = (
    SELECT email FROM public.users WHERE id = parent_student_relationships.parent_id
);

-- 8. Ensure RLS policies are in place
ALTER TABLE public.parent_student_relationships ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Parents can view their own relationships" ON public.parent_student_relationships;

-- Create new policy
CREATE POLICY "Parents can view their own relationships" ON public.parent_student_relationships
FOR SELECT USING (
    parent_id IN (
        SELECT id FROM public.parents 
        WHERE email = auth.jwt() ->> 'email'
    )
);

-- 9. Create a view to maintain backward compatibility
CREATE OR REPLACE VIEW public.parent_student_view AS
SELECT 
    p.id as parent_id,
    p.name as parent_name,
    p.email as parent_email,
    p.phone as parent_phone,
    s.id as student_id,
    s.name as student_name,
    s.admission_no,
    s.roll_no,
    psr.relationship_type,
    psr.is_primary_contact,
    psr.is_emergency_contact
FROM public.parents p
JOIN public.parent_student_relationships psr ON p.id = psr.parent_id
JOIN public.students s ON psr.student_id = s.id;

-- 10. Grant necessary permissions
GRANT SELECT ON public.parent_student_view TO authenticated;
GRANT SELECT ON public.parent_student_relationships TO authenticated;
GRANT SELECT ON public.parents TO authenticated;

COMMIT;

-- Show summary of what was fixed
SELECT 'Schema mismatch fixed successfully!' as status;
SELECT 'parent_student_relationships table created and populated' as detail1;
SELECT 'parents table created and populated' as detail2;
SELECT 'Existing relationships migrated' as detail3;
SELECT 'RLS policies configured' as detail4;
