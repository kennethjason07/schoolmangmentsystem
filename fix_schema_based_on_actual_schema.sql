-- Fix Parent Login Schema Based on Actual Database Structure
-- This script creates the missing parent_student_relationships table and migrates existing data

BEGIN;

-- 1. Create the missing parent_student_relationships table
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

-- 3. Migrate existing parent-student relationships from students.parent_id
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

-- 4. Also migrate from parents.student_id (if any exist)
INSERT INTO public.parent_student_relationships (parent_id, student_id, relationship_type, is_primary_contact, is_emergency_contact)
SELECT 
    p.id as parent_id,
    p.student_id as student_id,
    COALESCE(p.relation, 'Guardian') as relationship_type,
    true as is_primary_contact,
    true as is_emergency_contact
FROM public.parents p
WHERE p.student_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM public.parent_student_relationships psr 
      WHERE psr.parent_id = p.id AND psr.student_id = p.student_id
  );

-- 5. Ensure the parents table has the structure the code expects
-- Add missing columns if they don't exist
DO $$
BEGIN
    -- Add photo_url column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'parents' AND column_name = 'photo_url') THEN
        ALTER TABLE public.parents ADD COLUMN photo_url text;
        RAISE NOTICE 'Added photo_url column to parents table';
    END IF;
    
    -- Add school_id column if it doesn't exist (for multi-school support)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'parents' AND column_name = 'school_id') THEN
        ALTER TABLE public.parents ADD COLUMN school_id uuid;
        RAISE NOTICE 'Added school_id column to parents table';
    END IF;
END $$;

-- 6. Ensure users table has necessary columns for parent functionality
DO $$
BEGIN
    -- Add photo_url column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'photo_url') THEN
        ALTER TABLE public.users ADD COLUMN photo_url text;
        RAISE NOTICE 'Added photo_url column to users table';
    END IF;
    
    -- Add full_name column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'full_name') THEN
        ALTER TABLE public.users ADD COLUMN full_name text NOT NULL DEFAULT '';
        RAISE NOTICE 'Added full_name column to users table';
    END IF;
    
    -- Add phone column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'phone') THEN
        ALTER TABLE public.users ADD COLUMN phone text;
        RAISE NOTICE 'Added phone column to users table';
    END IF;
END $$;

-- 7. Enable RLS on the new table
ALTER TABLE public.parent_student_relationships ENABLE ROW LEVEL SECURITY;

-- 8. Create RLS policy for parents to see their relationships
CREATE POLICY IF NOT EXISTS "Parents can view their own relationships" ON public.parent_student_relationships
FOR SELECT USING (
    parent_id IN (
        SELECT id FROM public.users 
        WHERE email = auth.jwt() ->> 'email'
    )
);

-- 9. Grant necessary permissions
GRANT SELECT ON public.parent_student_relationships TO authenticated;
GRANT SELECT ON public.parents TO authenticated;

-- 10. Create a view for backward compatibility
CREATE OR REPLACE VIEW public.parent_student_view AS
SELECT 
    u.id as parent_user_id,
    u.email as parent_email,
    u.full_name as parent_name,
    u.phone as parent_phone,
    u.profile_url as parent_photo_url,
    s.id as student_id,
    s.name as student_name,
    s.admission_no,
    s.roll_no,
    psr.relationship_type,
    psr.is_primary_contact,
    psr.is_emergency_contact
FROM public.users u
JOIN public.parent_student_relationships psr ON u.id = psr.parent_id
JOIN public.students s ON psr.student_id = s.id;

-- 11. Grant permissions on the view
GRANT SELECT ON public.parent_student_view TO authenticated;

COMMIT;

-- Show summary of what was fixed
SELECT 'Schema fix completed successfully!' as status;
SELECT 'parent_student_relationships table created and populated' as detail1;
SELECT 'Existing relationships migrated from students.parent_id' as detail2;
SELECT 'RLS policies configured' as detail3;
SELECT 'Backward compatibility view created' as detail4;

-- Verify the fix
SELECT 
    'Verification Results:' as info,
    (SELECT COUNT(*) FROM public.parent_student_relationships) as relationships_count,
    (SELECT COUNT(*) FROM public.students WHERE parent_id IS NOT NULL) as students_with_parents,
    (SELECT COUNT(*) FROM public.parents WHERE student_id IS NOT NULL) as parents_with_students;
