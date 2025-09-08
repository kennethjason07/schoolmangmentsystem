-- Show RLS policies for exams table
SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'exams' AND schemaname = 'public';
