-- ROLLBACK SCRIPT: Revert to Original Simple Parent-Student Relationship Schema
-- This script reverts the database from the complex many-to-many structure back to the original simple structure

BEGIN;

-- Step 1: Drop all views that depend on the junction table
DROP VIEW IF EXISTS public.v_parent_student_details;
DROP VIEW IF EXISTS public.v_parents_with_children;
DROP VIEW IF EXISTS public.v_students_with_contacts;

-- Step 2: Re-add the parent_id column to students table
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS parent_id uuid;

-- Step 3: Re-add the student_id and relation columns to parents table
ALTER TABLE public.parents ADD COLUMN IF NOT EXISTS student_id uuid;
ALTER TABLE public.parents ADD COLUMN IF NOT EXISTS relation text CHECK (relation = ANY (ARRAY['Father'::text, 'Mother'::text, 'Guardian'::text]));

-- Step 4: Re-add the linked_parent_of column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS linked_parent_of uuid;

-- Step 5: Migrate data back from junction table to simple structure
-- First, update students table with primary parent contact
UPDATE public.students s 
SET parent_id = (
    SELECT u.id 
    FROM public.parent_student_relationships psr
    JOIN public.parents p ON psr.parent_id = p.id
    JOIN public.users u ON p.email = u.email OR (p.phone = u.phone AND p.phone IS NOT NULL)
    WHERE psr.student_id = s.id 
    AND psr.is_primary_contact = true
    LIMIT 1
);

-- If no primary contact found, use any parent
UPDATE public.students s 
SET parent_id = (
    SELECT u.id 
    FROM public.parent_student_relationships psr
    JOIN public.parents p ON psr.parent_id = p.id
    JOIN public.users u ON p.email = u.email OR (p.phone = u.phone AND p.phone IS NOT NULL)
    WHERE psr.student_id = s.id 
    AND s.parent_id IS NULL
    LIMIT 1
)
WHERE s.parent_id IS NULL;

-- Update parents table with student_id and relation from junction table
UPDATE public.parents p
SET 
    student_id = psr.student_id,
    relation = psr.relationship_type
FROM public.parent_student_relationships psr
WHERE p.id = psr.parent_id
AND psr.is_primary_contact = true;

-- If no primary contact relation, use any relation
UPDATE public.parents p
SET 
    student_id = psr.student_id,
    relation = psr.relationship_type
FROM public.parent_student_relationships psr
WHERE p.id = psr.parent_id
AND p.student_id IS NULL;

-- Update users table with linked_parent_of
UPDATE public.users u
SET linked_parent_of = p.student_id
FROM public.parents p
WHERE (u.email = p.email OR (u.phone = p.phone AND p.phone IS NOT NULL))
AND p.student_id IS NOT NULL;

-- Step 6: Re-create foreign key constraints
ALTER TABLE public.students ADD CONSTRAINT students_parent_id_fkey 
    FOREIGN KEY (parent_id) REFERENCES public.users(id);

ALTER TABLE public.parents ADD CONSTRAINT parents_student_id_fkey 
    FOREIGN KEY (student_id) REFERENCES public.students(id);

ALTER TABLE public.users ADD CONSTRAINT users_linked_parent_of_fkey 
    FOREIGN KEY (linked_parent_of) REFERENCES public.students(id);

-- Step 7: Drop the junction table and related objects
DROP TRIGGER IF EXISTS update_parent_student_relationships_updated_at ON public.parent_student_relationships;
DROP FUNCTION IF EXISTS update_parent_student_relationships_updated_at();
DROP INDEX IF EXISTS idx_parent_student_relationships_parent_id;
DROP INDEX IF EXISTS idx_parent_student_relationships_student_id;
DROP INDEX IF EXISTS idx_parent_student_relationships_primary_contact;
DROP TABLE IF EXISTS public.parent_student_relationships;

-- Step 8: Clean up any orphaned records
DELETE FROM public.parents WHERE student_id IS NULL;

COMMIT;

-- Verification queries (run these after the rollback)
-- SELECT 'Students with parents' as check_type, COUNT(*) as count FROM public.students WHERE parent_id IS NOT NULL;
-- SELECT 'Parents with students' as check_type, COUNT(*) as count FROM public.parents WHERE student_id IS NOT NULL;  
-- SELECT 'Users with linked students' as check_type, COUNT(*) as count FROM public.users WHERE linked_parent_of IS NOT NULL;
