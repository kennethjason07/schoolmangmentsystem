-- Simple query to check if student with admission number 1023 in class 3 A was present or absent on 08-09-2025

SELECT 
    s.name AS student_name,
    s.admission_no,
    c.class_name,
    c.section,
    CASE 
        WHEN sa.status IS NULL THEN 'NOT MARKED'
        WHEN sa.status = 'Present' THEN 'PRESENT'
        WHEN sa.status = 'Absent' THEN 'ABSENT'
        ELSE sa.status
    END AS attendance_status,
    sa.date
FROM students s
INNER JOIN classes c ON s.class_id = c.id
LEFT JOIN student_attendance sa ON s.id = sa.student_id 
    AND sa.date = '2025-09-08'
WHERE 
    s.admission_no = '1023'
    AND c.class_name = '3'
    AND c.section = 'A';

-- Even simpler version - just shows the attendance status
SELECT 
    CASE 
        WHEN sa.status IS NULL THEN 'NOT MARKED'
        WHEN sa.status = 'Present' THEN 'PRESENT'
        WHEN sa.status = 'Absent' THEN 'ABSENT'
        ELSE sa.status
    END AS result
FROM students s
INNER JOIN classes c ON s.class_id = c.id
LEFT JOIN student_attendance sa ON s.id = sa.student_id 
    AND sa.date = '2025-09-08'
WHERE 
    s.admission_no = '1023'
    AND c.class_name = '3'
    AND c.section = 'A';

-- One-liner version with just PRESENT/ABSENT/NOT MARKED result
SELECT 
    COALESCE(sa.status, 'NOT MARKED') AS attendance_status
FROM students s
INNER JOIN classes c ON s.class_id = c.id
LEFT JOIN student_attendance sa ON s.id = sa.student_id AND sa.date = '2025-09-08'
WHERE s.admission_no = '1023' AND c.class_name = '3' AND c.section = 'A';
