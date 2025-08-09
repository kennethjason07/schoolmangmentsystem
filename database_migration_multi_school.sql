-- Multi-School Support Migration Script
-- WARNING: This will modify existing tables. Please backup your database first.

-- Step 1: Add school_id column to all relevant tables
-- Note: Execute these one by one, not all at once

-- Add school_id to users table
ALTER TABLE public.users ADD COLUMN school_id uuid;
ALTER TABLE public.users ADD CONSTRAINT users_school_id_fkey 
  FOREIGN KEY (school_id) REFERENCES public.school_details(id);

-- Add school_id to teachers table
ALTER TABLE public.teachers ADD COLUMN school_id uuid;
ALTER TABLE public.teachers ADD CONSTRAINT teachers_school_id_fkey 
  FOREIGN KEY (school_id) REFERENCES public.school_details(id);

-- Add school_id to students table
ALTER TABLE public.students ADD COLUMN school_id uuid;
ALTER TABLE public.students ADD CONSTRAINT students_school_id_fkey 
  FOREIGN KEY (school_id) REFERENCES public.school_details(id);

-- Add school_id to classes table
ALTER TABLE public.classes ADD COLUMN school_id uuid;
ALTER TABLE public.classes ADD CONSTRAINT classes_school_id_fkey 
  FOREIGN KEY (school_id) REFERENCES public.school_details(id);

-- Add school_id to subjects table
ALTER TABLE public.subjects ADD COLUMN school_id uuid;
ALTER TABLE public.subjects ADD CONSTRAINT subjects_school_id_fkey 
  FOREIGN KEY (school_id) REFERENCES public.school_details(id);

-- Add school_id to parents table
ALTER TABLE public.parents ADD COLUMN school_id uuid;
ALTER TABLE public.parents ADD CONSTRAINT parents_school_id_fkey 
  FOREIGN KEY (school_id) REFERENCES public.school_details(id);

-- Add school_id to exams table
ALTER TABLE public.exams ADD COLUMN school_id uuid;
ALTER TABLE public.exams ADD CONSTRAINT exams_school_id_fkey 
  FOREIGN KEY (school_id) REFERENCES public.school_details(id);

-- Add school_id to assignments table
ALTER TABLE public.assignments ADD COLUMN school_id uuid;
ALTER TABLE public.assignments ADD CONSTRAINT assignments_school_id_fkey 
  FOREIGN KEY (school_id) REFERENCES public.school_details(id);

-- Add school_id to homeworks table
ALTER TABLE public.homeworks ADD COLUMN school_id uuid;
ALTER TABLE public.homeworks ADD CONSTRAINT homeworks_school_id_fkey 
  FOREIGN KEY (school_id) REFERENCES public.school_details(id);

-- Add school_id to notifications table
ALTER TABLE public.notifications ADD COLUMN school_id uuid;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_school_id_fkey 
  FOREIGN KEY (school_id) REFERENCES public.school_details(id);

-- Add school_id to tasks table
ALTER TABLE public.tasks ADD COLUMN school_id uuid;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_school_id_fkey 
  FOREIGN KEY (school_id) REFERENCES public.school_details(id);

-- Add school_id to fee_structure table
ALTER TABLE public.fee_structure ADD COLUMN school_id uuid;
ALTER TABLE public.fee_structure ADD CONSTRAINT fee_structure_school_id_fkey 
  FOREIGN KEY (school_id) REFERENCES public.school_details(id);

-- Add school_id to student_fees table
ALTER TABLE public.student_fees ADD COLUMN school_id uuid;
ALTER TABLE public.student_fees ADD CONSTRAINT student_fees_school_id_fkey 
  FOREIGN KEY (school_id) REFERENCES public.school_details(id);

-- Add school_id to student_attendance table
ALTER TABLE public.student_attendance ADD COLUMN school_id uuid;
ALTER TABLE public.student_attendance ADD CONSTRAINT student_attendance_school_id_fkey 
  FOREIGN KEY (school_id) REFERENCES public.school_details(id);

-- Add school_id to teacher_attendance table
ALTER TABLE public.teacher_attendance ADD COLUMN school_id uuid;
ALTER TABLE public.teacher_attendance ADD CONSTRAINT teacher_attendance_school_id_fkey 
  FOREIGN KEY (school_id) REFERENCES public.school_details(id);

-- Add school_id to marks table
ALTER TABLE public.marks ADD COLUMN school_id uuid;
ALTER TABLE public.marks ADD CONSTRAINT marks_school_id_fkey 
  FOREIGN KEY (school_id) REFERENCES public.school_details(id);

-- Add school_id to messages table
ALTER TABLE public.messages ADD COLUMN school_id uuid;
ALTER TABLE public.messages ADD CONSTRAINT messages_school_id_fkey 
  FOREIGN KEY (school_id) REFERENCES public.school_details(id);

-- Add school_id to timetable_entries table
ALTER TABLE public.timetable_entries ADD COLUMN school_id uuid;
ALTER TABLE public.timetable_entries ADD CONSTRAINT timetable_entries_school_id_fkey 
  FOREIGN KEY (school_id) REFERENCES public.school_details(id);

-- Add school_id to personal_tasks table
ALTER TABLE public.personal_tasks ADD COLUMN school_id uuid;
ALTER TABLE public.personal_tasks ADD CONSTRAINT personal_tasks_school_id_fkey 
  FOREIGN KEY (school_id) REFERENCES public.school_details(id);

-- Step 2: Create school_users junction table for multi-school user access
CREATE TABLE public.school_users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role_in_school text NOT NULL CHECK (role_in_school = ANY (ARRAY['Admin'::text, 'Teacher'::text, 'Student'::text, 'Parent'::text])),
  is_primary_school boolean DEFAULT true,
  joined_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT school_users_pkey PRIMARY KEY (id),
  CONSTRAINT school_users_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.school_details(id),
  CONSTRAINT school_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT school_users_unique UNIQUE (school_id, user_id)
);

-- Step 3: Update school_details table with additional fields
ALTER TABLE public.school_details ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.school_details ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Asia/Kolkata';
ALTER TABLE public.school_details ADD COLUMN IF NOT EXISTS academic_year_format text DEFAULT 'YYYY-YYYY';
ALTER TABLE public.school_details ADD COLUMN IF NOT EXISTS current_academic_year text;
ALTER TABLE public.school_details ADD COLUMN IF NOT EXISTS school_code text;
ALTER TABLE public.school_details ADD COLUMN IF NOT EXISTS school_board text;

-- Add unique constraint on school_code
ALTER TABLE public.school_details ADD CONSTRAINT school_details_school_code_unique UNIQUE (school_code);

-- Step 4: Create indexes for better performance
CREATE INDEX idx_users_school_id ON public.users(school_id);
CREATE INDEX idx_teachers_school_id ON public.teachers(school_id);
CREATE INDEX idx_students_school_id ON public.students(school_id);
CREATE INDEX idx_classes_school_id ON public.classes(school_id);
CREATE INDEX idx_subjects_school_id ON public.subjects(school_id);
CREATE INDEX idx_student_attendance_school_id ON public.student_attendance(school_id);
CREATE INDEX idx_teacher_attendance_school_id ON public.teacher_attendance(school_id);
CREATE INDEX idx_school_users_school_id ON public.school_users(school_id);
CREATE INDEX idx_school_users_user_id ON public.school_users(user_id);

-- Step 5: Insert sample data (optional - remove if you have existing data)
-- Insert a default school if none exists
INSERT INTO public.school_details (
  name, 
  type, 
  school_code, 
  current_academic_year,
  is_active,
  created_at
) VALUES (
  'Default School', 
  'School', 
  'SCH001', 
  '2024-2025',
  true,
  CURRENT_TIMESTAMP
) ON CONFLICT (school_code) DO NOTHING;

-- Step 6: Create RLS (Row Level Security) policies for multi-school isolation
-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homeworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_structure ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY;

-- Create RLS policy function
CREATE OR REPLACE FUNCTION get_user_school_ids(user_uuid uuid)
RETURNS uuid[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT school_id 
    FROM school_users 
    WHERE user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Example RLS policies (create similar for all tables)
-- Users table policy
CREATE POLICY school_isolation_users ON public.users
  FOR ALL
  TO authenticated
  USING (school_id = ANY(get_user_school_ids(auth.uid())))
  WITH CHECK (school_id = ANY(get_user_school_ids(auth.uid())));

-- Teachers table policy
CREATE POLICY school_isolation_teachers ON public.teachers
  FOR ALL
  TO authenticated
  USING (school_id = ANY(get_user_school_ids(auth.uid())))
  WITH CHECK (school_id = ANY(get_user_school_ids(auth.uid())));

-- Students table policy
CREATE POLICY school_isolation_students ON public.students
  FOR ALL
  TO authenticated
  USING (school_id = ANY(get_user_school_ids(auth.uid())))
  WITH CHECK (school_id = ANY(get_user_school_ids(auth.uid())));

-- Add similar policies for other tables...

-- Step 7: Create helper functions
CREATE OR REPLACE FUNCTION get_user_primary_school(user_uuid uuid)
RETURNS uuid AS $$
BEGIN
  RETURN (
    SELECT school_id 
    FROM school_users 
    WHERE user_id = user_uuid AND is_primary_school = true
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to switch user's active school
CREATE OR REPLACE FUNCTION switch_user_school(user_uuid uuid, new_school_id uuid)
RETURNS boolean AS $$
BEGIN
  -- Check if user has access to this school
  IF EXISTS (SELECT 1 FROM school_users WHERE user_id = user_uuid AND school_id = new_school_id) THEN
    -- Update all schools to non-primary
    UPDATE school_users 
    SET is_primary_school = false 
    WHERE user_id = user_uuid;
    
    -- Set new primary school
    UPDATE school_users 
    SET is_primary_school = true 
    WHERE user_id = user_uuid AND school_id = new_school_id;
    
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
