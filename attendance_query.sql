-- Query to check student attendance on date 08-09-2025 for class 3 A student with admission number 1023
-- Date: 2025-09-08 (ISO format for database query)
-- Class: 3 A (class_name = '3' and section = 'A')
-- Student: admission_no = '1023'

-- Main query to get attendance details
SELECT 
    s.name AS student_name,
    s.admission_no,
    c.class_name,
    c.section,
    sa.date,
    sa.status,
    sa.marked_by,
    sa.created_at,
    s.tenant_id,
    -- Additional student info
    s.roll_no,
    s.dob,
    s.gender
FROM students s
INNER JOIN classes c ON s.class_id = c.id
LEFT JOIN student_attendance sa ON s.id = sa.student_id 
    AND sa.date = '2025-09-08'  -- Date in ISO format (YYYY-MM-DD)
WHERE 
    s.admission_no = '1023'
    AND c.class_name = '3'
    AND c.section = 'A'
ORDER BY sa.date DESC;

-- Alternative query if the class name format is different (e.g., "Class 3")
SELECT 
    s.name AS student_name,
    s.admission_no,
    c.class_name,
    c.section,
    sa.date,
    sa.status,
    sa.marked_by,
    sa.created_at,
    s.tenant_id
FROM students s
INNER JOIN classes c ON s.class_id = c.id
LEFT JOIN student_attendance sa ON s.id = sa.student_id 
    AND sa.date = '2025-09-08'
WHERE 
    s.admission_no = '1023'
    AND (c.class_name = '3' OR c.class_name = 'Class 3' OR c.class_name = 'Grade 3')
    AND c.section = 'A'
ORDER BY sa.date DESC;

-- Query to check if student exists (in case attendance record is not found)
SELECT 
    s.id,
    s.name AS student_name,
    s.admission_no,
    c.class_name,
    c.section,
    s.tenant_id,
    'Student exists but no attendance record for this date' AS note
FROM students s
INNER JOIN classes c ON s.class_id = c.id
WHERE 
    s.admission_no = '1023'
    AND c.class_name = '3'
    AND c.section = 'A';

-- Query to check all attendance records for this student (last 10 days)
SELECT 
    s.name AS student_name,
    s.admission_no,
    c.class_name,
    c.section,
    sa.date,
    sa.status,
    sa.marked_by,
    sa.created_at
FROM students s
INNER JOIN classes c ON s.class_id = c.id
INNER JOIN student_attendance sa ON s.id = sa.student_id
WHERE 
    s.admission_no = '1023'
    AND c.class_name = '3'
    AND c.section = 'A'
    AND sa.date >= '2025-08-29'  -- Last 10 days from 08-09-2025
ORDER BY sa.date DESC
LIMIT 10;

-- Detailed query with teacher information who marked the attendance
SELECT 
    s.name AS student_name,
    s.admission_no,
    c.class_name,
    c.section,
    sa.date,
    sa.status,
    u.full_name AS marked_by_teacher,
    u.email AS teacher_email,
    sa.created_at
FROM students s
INNER JOIN classes c ON s.class_id = c.id
LEFT JOIN student_attendance sa ON s.id = sa.student_id 
    AND sa.date = '2025-09-08'
LEFT JOIN users u ON sa.marked_by = u.id
WHERE 
    s.admission_no = '1023'
    AND c.class_name = '3'
    AND c.section = 'A';

-- Count total attendance records for this student
SELECT 
    COUNT(*) AS total_attendance_records,
    COUNT(CASE WHEN sa.status = 'Present' THEN 1 END) AS present_days,
    COUNT(CASE WHEN sa.status = 'Absent' THEN 1 END) AS absent_days,
    ROUND(
        (COUNT(CASE WHEN sa.status = 'Present' THEN 1 END) * 100.0 / COUNT(*)), 2
    ) AS attendance_percentage
FROM students s
INNER JOIN classes c ON s.class_id = c.id
INNER JOIN student_attendance sa ON s.id = sa.student_id
WHERE 
    s.admission_no = '1023'
    AND c.class_name = '3'
    AND c.section = 'A';
