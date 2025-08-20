-- Create student_attendance table for tracking daily attendance
-- This table supports the AttendanceSummary.js component requirements

CREATE TABLE IF NOT EXISTS public.student_attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  class_id uuid NOT NULL,
  date date NOT NULL,
  status text NOT NULL,
  marked_by uuid NULL,
  created_at timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Primary key
  CONSTRAINT student_attendance_pkey PRIMARY KEY (id),
  
  -- Unique constraint to prevent duplicate attendance records for same student on same day
  CONSTRAINT unique_attendance_per_day UNIQUE (student_id, date),
  
  -- Foreign key constraints
  CONSTRAINT student_attendance_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes (id),
  CONSTRAINT student_attendance_marked_by_fkey FOREIGN KEY (marked_by) REFERENCES users (id),
  CONSTRAINT student_attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE,
  
  -- Check constraint for valid status values
  CONSTRAINT student_attendance_status_check CHECK (
    status = ANY (ARRAY['Present'::text, 'Absent'::text])
  )
) TABLESPACE pg_default;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_student_attendance_student_date 
ON public.student_attendance USING btree (student_id, date DESC) 
TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_student_attendance_date 
ON public.student_attendance USING btree (date) 
TABLESPACE pg_default;

-- Optional: Create index for class-based queries
CREATE INDEX IF NOT EXISTS idx_student_attendance_class_date 
ON public.student_attendance USING btree (class_id, date DESC) 
TABLESPACE pg_default;

-- Optional: Create index for status-based queries
CREATE INDEX IF NOT EXISTS idx_student_attendance_status 
ON public.student_attendance USING btree (status) 
TABLESPACE pg_default;

-- Add comments for documentation
COMMENT ON TABLE public.student_attendance IS 'Daily attendance records for students';
COMMENT ON COLUMN public.student_attendance.id IS 'Unique identifier for attendance record';
COMMENT ON COLUMN public.student_attendance.student_id IS 'Reference to student in students table';
COMMENT ON COLUMN public.student_attendance.class_id IS 'Reference to class in classes table';
COMMENT ON COLUMN public.student_attendance.date IS 'Date of attendance (YYYY-MM-DD format)';
COMMENT ON COLUMN public.student_attendance.status IS 'Attendance status: Present or Absent';
COMMENT ON COLUMN public.student_attendance.marked_by IS 'User who marked the attendance';
COMMENT ON COLUMN public.student_attendance.created_at IS 'Timestamp when record was created';
