-- Fix Parent Login Issues
-- This script addresses common problems that prevent parent login

BEGIN;

-- 1. Ensure roles table has 'parent' role
INSERT INTO public.roles (role_name, description) 
VALUES ('parent', 'Parent/Guardian of student')
ON CONFLICT (role_name) DO NOTHING;

-- 2. Check if parent_student_relationships table exists, if not create it
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'parent_student_relationships') THEN
        -- Create the junction table
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

        -- Create indexes
        CREATE INDEX idx_parent_student_relationships_parent_id ON public.parent_student_relationships(parent_id);
        CREATE INDEX idx_parent_student_relationships_student_id ON public.parent_student_relationships(student_id);
        CREATE INDEX idx_parent_student_relationships_primary_contact ON public.parent_student_relationships(is_primary_contact) WHERE is_primary_contact = true;
        
        RAISE NOTICE 'Created parent_student_relationships table';
    ELSE
        RAISE NOTICE 'parent_student_relationships table already exists';
    END IF;
END $$;

-- 3. Ensure users table has necessary columns for parent functionality
DO $$
BEGIN
    -- Add photo_url column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'photo_url') THEN
        ALTER TABLE public.users ADD COLUMN photo_url text;
        RAISE NOTICE 'Added photo_url column to users table';
    END IF;
    
    -- Add full_name column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'full_name') THEN
        ALTER TABLE public.users ADD COLUMN full_name text;
        RAISE NOTICE 'Added full_name column to users table';
    END IF;
    
    -- Add phone column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'phone') THEN
        ALTER TABLE public.users ADD COLUMN phone text;
        RAISE NOTICE 'Added phone column to users table';
    END IF;
END $$;

-- 4. Ensure parents table has necessary columns
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

-- 5. Migrate existing parent-student relationships if they exist in old format
DO $$
BEGIN
    -- Check if parents table still has student_id column (old format)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'parents' AND column_name = 'student_id') THEN
        -- Migrate existing relationships
        INSERT INTO public.parent_student_relationships (parent_id, student_id, relationship_type, is_primary_contact)
        SELECT 
            p.id as parent_id,
            p.student_id,
            COALESCE(p.relation, 'Guardian') as relationship_type,
            true as is_primary_contact
        FROM public.parents p
        WHERE p.student_id IS NOT NULL
        ON CONFLICT (parent_id, student_id) DO NOTHING;
        
        RAISE NOTICE 'Migrated existing parent-student relationships';
        
        -- Remove old columns after migration
        ALTER TABLE public.parents DROP COLUMN IF EXISTS student_id;
        ALTER TABLE public.parents DROP COLUMN IF EXISTS relation;
    END IF;
END $$;

-- 6. Create sample parent user if none exist (for testing)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE email = 'testparent@example.com') THEN
        -- Create test parent user
        INSERT INTO public.users (email, role_id, full_name, phone)
        SELECT 
            'testparent@example.com',
            r.id,
            'Test Parent',
            '+1234567890'
        FROM public.roles r
        WHERE r.role_name = 'parent'
        LIMIT 1;
        
        -- Create parent profile
        INSERT INTO public.parents (name, email, phone, school_id)
        VALUES ('Test Parent', 'testparent@example.com', '+1234567890', 
                (SELECT id FROM public.schools LIMIT 1))
        ON CONFLICT (email) DO NOTHING;
        
        RAISE NOTICE 'Created test parent user: testparent@example.com (password: test123)';
    END IF;
END $$;

-- 7. Ensure RLS policies allow parent access
DO $$
BEGIN
    -- Enable RLS on parent_student_relationships if not already enabled
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'parent_student_relationships') THEN
        ALTER TABLE public.parent_student_relationships ENABLE ROW LEVEL SECURITY;
        
        -- Create policy for parents to see their relationships
        CREATE POLICY "Parents can view their own relationships" ON public.parent_student_relationships
        FOR SELECT USING (
            parent_id IN (
                SELECT id FROM public.parents 
                WHERE email = auth.jwt() ->> 'email'
            )
        );
        
        RAISE NOTICE 'Created RLS policies for parent_student_relationships';
    END IF;
END $$;

COMMIT;

-- Show summary of fixes
SELECT 'Parent Login Issues Fixed' as status;
SELECT 'Check the debug_parent_login.js script output for verification' as next_step;
