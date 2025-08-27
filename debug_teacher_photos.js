const { createClient } = require('@supabase/supabase-js');

// Debug script to check teacher photo issues
console.log('=== TEACHER PHOTO DEBUG SCRIPT ===\n');

console.log('To debug why teacher photos are not showing, please run these SQL queries in your Supabase SQL Editor:\n');

console.log('1. Check if Bheem Rao Patil exists as a teacher:');
console.log('SELECT * FROM teachers WHERE name ILIKE \'%bheem%\' OR name ILIKE \'%patil%\';\n');

console.log('2. Check all teacher-user relationships:');
console.log(`SELECT 
    t.id as teacher_id,
    t.name as teacher_name,
    u.id as user_id,
    u.email as user_email,
    u.full_name as user_full_name,
    u.profile_url,
    u.linked_teacher_id,
    r.role_name
FROM teachers t
LEFT JOIN users u ON u.linked_teacher_id = t.id
LEFT JOIN roles r ON u.role_id = r.id
ORDER BY t.name;`);

console.log('\n3. Check users with teacher role:');
console.log(`SELECT 
    u.id as user_id,
    u.email,
    u.full_name,
    u.profile_url,
    u.linked_teacher_id,
    r.role_name,
    t.name as linked_teacher_name
FROM users u
JOIN roles r ON u.role_id = r.id
LEFT JOIN teachers t ON u.linked_teacher_id = t.id
WHERE r.role_name = 'teacher'
ORDER BY u.full_name;`);

console.log('\n4. Check if profile_url column exists in users table:');
console.log('SELECT column_name FROM information_schema.columns WHERE table_name = \'users\' AND column_name = \'profile_url\';');

console.log('\n5. Look for Bheem Rao Patil specifically:');
console.log(`SELECT 
    'Teacher Record' as type,
    t.id,
    t.name,
    NULL as email,
    NULL as profile_url,
    NULL as linked_teacher_id
FROM teachers t 
WHERE t.name ILIKE '%bheem%' OR t.name ILIKE '%patil%'

UNION ALL

SELECT 
    'User Record' as type,
    u.linked_teacher_id as id,
    u.full_name as name,
    u.email,
    u.profile_url,
    u.linked_teacher_id
FROM users u 
WHERE u.full_name ILIKE '%bheem%' OR u.full_name ILIKE '%patil%'
ORDER BY type, name;`);

console.log('\n=== TROUBLESHOOTING STEPS ===\n');
console.log('After running the above queries, check:');
console.log('');
console.log('A. Is there a teacher record for "Bheem Rao Patil"?');
console.log('   - If NO: Create the teacher record first');
console.log('');
console.log('B. Is there a user account for "Bheem Rao Patil"?');
console.log('   - If NO: Create a user account and link it to the teacher');
console.log('');
console.log('C. Is the user account properly linked to the teacher?');
console.log('   - Check if linked_teacher_id in users table matches the teacher ID');
console.log('');
console.log('D. Does the user account have a profile_url?');
console.log('   - If NO: Upload a photo for the user');
console.log('   - If YES: Check if the URL is valid and accessible');
console.log('');
console.log('E. Does the profile_url column exist in the users table?');
console.log('   - If NO: Run the SQL to add it: ALTER TABLE users ADD COLUMN profile_url TEXT;');

console.log('\n=== COMMON FIXES ===\n');

console.log('If the teacher exists but has no linked user:');
console.log(`-- Create user account for existing teacher
INSERT INTO users (
    email, 
    full_name, 
    role_id, 
    linked_teacher_id, 
    password
) VALUES (
    'bheem.patil@school.com',
    'Bheem Rao Patil',
    (SELECT id FROM roles WHERE role_name = 'teacher' LIMIT 1),
    (SELECT id FROM teachers WHERE name ILIKE '%bheem%' LIMIT 1),
    '$2a$10$example.hash.for.password123'
);`);

console.log('\nIf the user exists but is not linked to teacher:');
console.log(`-- Link existing user to teacher
UPDATE users 
SET linked_teacher_id = (SELECT id FROM teachers WHERE name ILIKE '%bheem%' LIMIT 1)
WHERE full_name ILIKE '%bheem%';`);

console.log('\n=== RUN THIS SCRIPT ===');
console.log('node debug_teacher_photos.js');
