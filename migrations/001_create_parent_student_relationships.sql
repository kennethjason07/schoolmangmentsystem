-- Migration: Create Parent-Student Relationships Junction Table
-- This script implements a many-to-many relationship between parents and students

BEGIN;

-- Step 1: Create the junction table first
CREATE TABLE public.parent_student_relationships (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    parent_id uuid NOT NULL,
    student_id uuid NOT NULL,
    relationship_type text NOT NULL CHECK (relationship_type = ANY (ARRAY['Father'::text, 'Mother'::text, 'Guardian'::text])),
    is_primary_contact boolean DEFAULT false,
    is_emergency_contact boolean DEFAULT false,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT parent_student_relationships_pkey PRIMARY KEY (id),
    CONSTRAINT parent_student_relationships_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.parents(id) ON DELETE CASCADE,
    CONSTRAINT parent_student_relationships_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE,
    CONSTRAINT unique_parent_student UNIQUE (parent_id, student_id)
);

-- Step 2: Create indexes for better query performance
CREATE INDEX idx_parent_student_relationships_parent_id ON public.parent_student_relationships(parent_id);
CREATE INDEX idx_parent_student_relationships_student_id ON public.parent_student_relationships(student_id);
CREATE INDEX idx_parent_student_relationships_primary_contact ON public.parent_student_relationships(is_primary_contact) WHERE is_primary_contact = true;

-- Step 3: Migrate existing data from parents table to junction table
INSERT INTO public.parent_student_relationships (parent_id, student_id, relationship_type, is_primary_contact)
SELECT 
    p.id as parent_id,
    p.student_id,
    p.relation as relationship_type,
    true as is_primary_contact  -- Mark existing relationships as primary contacts
FROM public.parents p
WHERE p.student_id IS NOT NULL;

-- Step 4: Drop the foreign key constraint from parents table
ALTER TABLE public.parents DROP CONSTRAINT IF EXISTS parents_student_id_fkey;

-- Step 5: Remove the student_id column from parents table
ALTER TABLE public.parents DROP COLUMN IF EXISTS student_id;

-- Step 6: Remove the relation column from parents table (now stored in junction table)
ALTER TABLE public.parents DROP COLUMN IF EXISTS relation;

-- Step 7: Drop the parent_id column from students table since relationships are now managed via junction table
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_parent_id_fkey;
ALTER TABLE public.students DROP COLUMN IF EXISTS parent_id;

-- Step 8: Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_parent_student_relationships_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Step 9: Create trigger for updated_at
CREATE TRIGGER update_parent_student_relationships_updated_at
    BEFORE UPDATE ON public.parent_student_relationships
    FOR EACH ROW
    EXECUTE FUNCTION update_parent_student_relationships_updated_at();

COMMIT;
