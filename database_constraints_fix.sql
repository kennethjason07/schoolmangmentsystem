-- Database constraints and indexes to prevent parent-student relationship issues
-- Run this script to add proper constraints and improve data integrity

-- 1. Add unique constraint to prevent multiple parent records with same email for same student
-- This will prevent duplicate parent records that could cause confusion
ALTER TABLE parents 
ADD CONSTRAINT parents_email_student_unique 
UNIQUE (email, student_id);

-- 2. Add index on parents.email for faster queries
CREATE INDEX IF NOT EXISTS idx_parents_email ON parents(email);

-- 3. Add index on users.linked_parent_of for faster parent-student lookups  
CREATE INDEX IF NOT EXISTS idx_users_linked_parent_of ON users(linked_parent_of);

-- 4. Add constraint to ensure linked_parent_of actually exists in students table
ALTER TABLE users 
ADD CONSTRAINT fk_users_linked_parent_of 
FOREIGN KEY (linked_parent_of) REFERENCES students(id) ON DELETE SET NULL;

-- 5. Add constraint to ensure parent_id in students table exists in parents table
ALTER TABLE students 
ADD CONSTRAINT fk_students_parent_id 
FOREIGN KEY (parent_id) REFERENCES parents(id) ON DELETE SET NULL;

-- 6. Clean up any orphaned records (optional - run with caution)
-- Uncomment these queries if you want to clean up existing data issues

/*
-- Remove parent records that don't have corresponding students
DELETE FROM parents 
WHERE student_id NOT IN (SELECT id FROM students);

-- Remove parent records where the student's parent_id doesn't match
DELETE FROM parents p1
WHERE EXISTS (
    SELECT 1 FROM students s 
    WHERE s.id = p1.student_id 
    AND s.parent_id != p1.id
    AND s.parent_id IS NOT NULL
);

-- Update students table to set parent_id correctly based on parents table
UPDATE students 
SET parent_id = (
    SELECT id FROM parents 
    WHERE parents.student_id = students.id 
    LIMIT 1
)
WHERE parent_id IS NULL 
AND EXISTS (
    SELECT 1 FROM parents 
    WHERE parents.student_id = students.id
);
*/

-- 7. Create a view for better parent-student relationship queries
CREATE OR REPLACE VIEW parent_student_relationships AS
SELECT 
    u.id as user_id,
    u.email as user_email,
    u.full_name as user_name,
    u.linked_parent_of,
    s.id as student_id,
    s.name as student_name,
    s.admission_no,
    s.class_id,
    c.class_name,
    c.section,
    p.id as parent_record_id,
    p.name as parent_name,
    p.relation,
    p.phone as parent_phone
FROM users u
LEFT JOIN students s ON u.linked_parent_of = s.id
LEFT JOIN classes c ON s.class_id = c.id
LEFT JOIN parents p ON (p.student_id = s.id AND p.email = u.email)
WHERE u.linked_parent_of IS NOT NULL;

-- Add comment explaining the relationship structure
COMMENT ON VIEW parent_student_relationships IS 
'This view shows the complete parent-student relationships. Users should only see students via their linked_parent_of field, and additional children should only be found via matching parent_id in the students table.';

-- 8. Create a function to get children for a parent user (secure approach)
CREATE OR REPLACE FUNCTION get_parent_children(parent_user_id UUID)
RETURNS TABLE (
    student_id UUID,
    student_name TEXT,
    admission_no TEXT,
    roll_no INTEGER,
    class_name TEXT,
    section TEXT,
    relationship_type TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH primary_student AS (
        -- Get the primary student linked to this parent user
        SELECT s.id, s.name, s.admission_no, s.roll_no, s.parent_id,
               c.class_name, c.section
        FROM users u
        JOIN students s ON u.linked_parent_of = s.id
        LEFT JOIN classes c ON s.class_id = c.id
        WHERE u.id = parent_user_id
    )
    -- Return primary student
    SELECT ps.id, ps.name, ps.admission_no, ps.roll_no, 
           ps.class_name, ps.section, 'Primary'::TEXT
    FROM primary_student ps
    
    UNION ALL
    
    -- Return siblings (students with same parent_id)
    SELECT s.id, s.name, s.admission_no, s.roll_no,
           c.class_name, c.section, 'Sibling'::TEXT
    FROM primary_student ps
    JOIN students s ON s.parent_id = ps.parent_id AND s.id != ps.id
    LEFT JOIN classes c ON s.class_id = c.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
