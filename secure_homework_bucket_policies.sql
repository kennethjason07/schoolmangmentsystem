-- Create secure RLS policies for homework-files bucket
-- This allows teachers to upload files only to their own folders

-- 1. Ensure the bucket exists and is not public (more secure)
UPDATE storage.buckets 
SET public = false 
WHERE id = 'homework-files';

-- 2. Drop any existing conflicting policies (if they exist)
DROP POLICY IF EXISTS "Allow authenticated uploads to homework-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads from homework-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to homework-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes from homework-files" ON storage.objects;

-- 3. Create policy for teachers to upload files to their own folders
CREATE POLICY "Teachers can upload to their own folder" ON storage.objects
FOR INSERT 
TO authenticated 
WITH CHECK (
  bucket_id = 'homework-files' 
  AND 
  -- Check if the path starts with teacher_{user_teacher_id}/
  name LIKE 'teacher_' || (
    SELECT t.id::text 
    FROM teachers t 
    WHERE t.user_id = auth.uid()
  ) || '/%'
);

-- 4. Create policy for teachers to read files from their own folders
CREATE POLICY "Teachers can read from their own folder" ON storage.objects
FOR SELECT 
TO authenticated 
USING (
  bucket_id = 'homework-files' 
  AND 
  name LIKE 'teacher_' || (
    SELECT t.id::text 
    FROM teachers t 
    WHERE t.user_id = auth.uid()
  ) || '/%'
);

-- 5. Create policy for teachers to update files in their own folders
CREATE POLICY "Teachers can update their own files" ON storage.objects
FOR UPDATE 
TO authenticated 
USING (
  bucket_id = 'homework-files' 
  AND 
  name LIKE 'teacher_' || (
    SELECT t.id::text 
    FROM teachers t 
    WHERE t.user_id = auth.uid()
  ) || '/%'
);

-- 6. Create policy for teachers to delete files from their own folders
CREATE POLICY "Teachers can delete their own files" ON storage.objects
FOR DELETE 
TO authenticated 
USING (
  bucket_id = 'homework-files' 
  AND 
  name LIKE 'teacher_' || (
    SELECT t.id::text 
    FROM teachers t 
    WHERE t.user_id = auth.uid()
  ) || '/%'
);

-- 7. Allow students to read homework files from their assigned classes (optional)
CREATE POLICY "Students can read homework files from their classes" ON storage.objects
FOR SELECT 
TO authenticated 
USING (
  bucket_id = 'homework-files' 
  AND 
  -- Check if student is in the class that matches the file path
  EXISTS (
    SELECT 1 
    FROM students s
    JOIN classes c ON s.class_id = c.id
    WHERE s.user_id = auth.uid()
    AND name LIKE '%/class_' || c.id::text || '/%'
  )
);

-- Alternative simpler policy (if the above is too complex):
-- CREATE POLICY "Allow all authenticated users" ON storage.objects
-- FOR ALL 
-- TO authenticated 
-- USING (bucket_id = 'homework-files')
-- WITH CHECK (bucket_id = 'homework-files');

-- Verify the bucket and policies
SELECT id, name, public, created_at 
FROM storage.buckets 
WHERE id = 'homework-files';

SELECT policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
AND policyname LIKE '%homework%';
