-- Quick Fix for Parent Login
-- This creates the missing table structure that the code expects

-- 1. Create parent_student_relationships table
CREATE TABLE IF NOT EXISTS public.parent_student_relationships (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    parent_id uuid NOT NULL,
    student_id uuid NOT NULL,
    relationship_type text NOT NULL DEFAULT 'Guardian',
    is_primary_contact boolean DEFAULT true,
    is_emergency_contact boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT parent_student_relationships_pkey PRIMARY KEY (id),
    CONSTRAINT parent_student_relationships_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.users(id),
    CONSTRAINT parent_student_relationships_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id)
);

-- 2. Create parents table
CREATE TABLE IF NOT EXISTS public.parents (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    email text NOT NULL UNIQUE,
    phone text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT parents_pkey PRIMARY KEY (id)
);

-- 3. Populate parent_student_relationships from existing data
INSERT INTO public.parent_student_relationships (parent_id, student_id, relationship_type)
SELECT 
    s.parent_id,
    s.id,
    'Guardian'
FROM public.students s
WHERE s.parent_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM public.parent_student_relationships psr 
      WHERE psr.parent_id = s.parent_id AND psr.student_id = s.id
  );

-- 4. Populate parents table from users
INSERT INTO public.parents (id, name, email, phone)
SELECT 
    u.id,
    COALESCE(u.full_name, 'Parent'),
    u.email,
    u.phone
FROM public.users u
JOIN public.roles r ON u.role_id = r.id
WHERE r.role_name = 'parent'
  AND NOT EXISTS (SELECT 1 FROM public.parents p WHERE p.id = u.id);

-- 5. Enable RLS
ALTER TABLE public.parent_student_relationships ENABLE ROW LEVEL SECURITY;

-- 6. Create basic policy
CREATE POLICY IF NOT EXISTS "Parents can view their relationships" ON public.parent_student_relationships
FOR SELECT USING (true);

SELECT 'Quick fix applied! Parent login should work now.' as status;
