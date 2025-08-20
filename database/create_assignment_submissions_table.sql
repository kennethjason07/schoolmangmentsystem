-- Create assignment_submissions table for student submissions
-- This table stores student submissions for both assignments and homeworks

CREATE TABLE IF NOT EXISTS assignment_submissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    assignment_id UUID NOT NULL,
    assignment_type VARCHAR(20) NOT NULL CHECK (assignment_type IN ('assignment', 'homework')),
    student_id UUID NOT NULL,
    submitted_files JSONB DEFAULT '[]',
    status VARCHAR(20) DEFAULT 'submitted' CHECK (status IN ('submitted', 'graded', 'late')),
    grade VARCHAR(10) NULL,
    feedback TEXT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    graded_at TIMESTAMP WITH TIME ZONE NULL,
    academic_year VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment_id ON assignment_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_student_id ON assignment_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment_type ON assignment_submissions(assignment_type);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_status ON assignment_submissions(status);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_academic_year ON assignment_submissions(academic_year);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_submitted_at ON assignment_submissions(submitted_at);

-- Add foreign key constraints (these may fail if referenced tables don't exist)
-- You can run these separately after ensuring the referenced tables exist

-- ALTER TABLE assignment_submissions 
-- ADD CONSTRAINT fk_assignment_submissions_student_id 
-- FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

-- Note: We don't add FK constraints for assignment_id because it can reference either
-- assignments table or homeworks table depending on assignment_type

-- Create RLS (Row Level Security) policies for data access
ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;

-- Policy: Students can only see their own submissions
CREATE POLICY "Students can view their own submissions" ON assignment_submissions
    FOR SELECT USING (student_id IN (
        SELECT students.id FROM students 
        INNER JOIN student_users ON students.id = student_users.student_id 
        WHERE student_users.user_id = auth.uid()
    ));

-- Policy: Students can insert their own submissions
CREATE POLICY "Students can insert their own submissions" ON assignment_submissions
    FOR INSERT WITH CHECK (student_id IN (
        SELECT students.id FROM students 
        INNER JOIN student_users ON students.id = student_users.student_id 
        WHERE student_users.user_id = auth.uid()
    ));

-- Policy: Students can update their own submissions (before grading)
CREATE POLICY "Students can update their own submissions" ON assignment_submissions
    FOR UPDATE USING (
        student_id IN (
            SELECT students.id FROM students 
            INNER JOIN student_users ON students.id = student_users.student_id 
            WHERE student_users.user_id = auth.uid()
        )
        AND status != 'graded' -- Prevent updates after grading
    );

-- Policy: Teachers can view submissions for their assignments
CREATE POLICY "Teachers can view submissions for their assignments" ON assignment_submissions
    FOR SELECT USING (
        -- For regular assignments
        (assignment_type = 'assignment' AND assignment_id IN (
            SELECT assignments.id FROM assignments
            INNER JOIN teacher_users ON assignments.teacher_id = teacher_users.teacher_id
            WHERE teacher_users.user_id = auth.uid()
        ))
        OR
        -- For homeworks
        (assignment_type = 'homework' AND assignment_id IN (
            SELECT homeworks.id FROM homeworks
            INNER JOIN teacher_users ON homeworks.teacher_id = teacher_users.teacher_id
            WHERE teacher_users.user_id = auth.uid()
        ))
    );

-- Policy: Teachers can update (grade) submissions for their assignments
CREATE POLICY "Teachers can grade submissions for their assignments" ON assignment_submissions
    FOR UPDATE USING (
        -- For regular assignments
        (assignment_type = 'assignment' AND assignment_id IN (
            SELECT assignments.id FROM assignments
            INNER JOIN teacher_users ON assignments.teacher_id = teacher_users.teacher_id
            WHERE teacher_users.user_id = auth.uid()
        ))
        OR
        -- For homeworks
        (assignment_type = 'homework' AND assignment_id IN (
            SELECT homeworks.id FROM homeworks
            INNER JOIN teacher_users ON homeworks.teacher_id = teacher_users.teacher_id
            WHERE teacher_users.user_id = auth.uid()
        ))
    );

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_assignment_submissions_updated_at 
    BEFORE UPDATE ON assignment_submissions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE assignment_submissions IS 'Stores student submissions for assignments and homeworks';
COMMENT ON COLUMN assignment_submissions.assignment_id IS 'References either assignments.id or homeworks.id depending on assignment_type';
COMMENT ON COLUMN assignment_submissions.assignment_type IS 'Type of assignment: assignment or homework';
COMMENT ON COLUMN assignment_submissions.student_id IS 'References students.id';
COMMENT ON COLUMN assignment_submissions.submitted_files IS 'JSON array of submitted file objects with URLs and metadata';
COMMENT ON COLUMN assignment_submissions.status IS 'Submission status: submitted, graded, late';
COMMENT ON COLUMN assignment_submissions.grade IS 'Grade given by teacher (optional)';
COMMENT ON COLUMN assignment_submissions.feedback IS 'Teacher feedback (optional)';
COMMENT ON COLUMN assignment_submissions.submitted_at IS 'When the assignment was submitted';
COMMENT ON COLUMN assignment_submissions.graded_at IS 'When the assignment was graded';
COMMENT ON COLUMN assignment_submissions.academic_year IS 'Academic year for the submission';
