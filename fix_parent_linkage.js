const { createClient } = require('@supabase/supabase-js');

// You need to get these from your .env file or Supabase dashboard
const SUPABASE_URL = 'your_supabase_url_here';
const SUPABASE_ANON_KEY = 'your_supabase_anon_key_here';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fixParentStudentLinkage() {
  try {
    console.log('🔧 Starting Parent-Student Linkage Fix...\n');

    // Step 1: Find all parent users without proper linkage
    console.log('1️⃣ Finding parent users...');
    const { data: parentUsers, error: parentError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        linked_parent_of,
        roles(role_name)
      `)
      .eq('roles.role_name', 'parent');

    if (parentError) {
      console.error('❌ Error finding parent users:', parentError);
      return;
    }

    console.log(`✅ Found ${parentUsers.length} parent users`);
    
    for (const user of parentUsers) {
      console.log(`📧 Parent: ${user.email} - Linked to: ${user.linked_parent_of || 'NONE'}`);
    }

    // Step 2: Find all students in the database
    console.log('\n2️⃣ Finding available students...');
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select(`
        id,
        name,
        admission_no,
        roll_no,
        classes(class_name, section)
      `)
      .order('name');

    if (studentsError) {
      console.error('❌ Error finding students:', studentsError);
      return;
    }

    console.log(`✅ Found ${students.length} students:`);
    for (let i = 0; i < Math.min(students.length, 5); i++) {
      const student = students[i];
      console.log(`   ${i + 1}. ${student.name} (${student.admission_no}) - Class: ${student.classes?.class_name || 'N/A'} ${student.classes?.section || ''}`);
    }
    if (students.length > 5) {
      console.log(`   ... and ${students.length - 5} more students`);
    }

    // Step 3: Auto-link first parent to first student (if no linkage exists)
    const unlinkeredParents = parentUsers.filter(user => !user.linked_parent_of);
    
    if (unlinkeredParents.length > 0 && students.length > 0) {
      console.log('\n3️⃣ Auto-linking first unlinked parent to first student...');
      
      const parentToLink = unlinkeredParents[0];
      const studentToLink = students[0];
      
      console.log(`🔗 Linking ${parentToLink.email} → ${studentToLink.name} (${studentToLink.admission_no})`);
      
      const { data: updateResult, error: updateError } = await supabase
        .from('users')
        .update({ linked_parent_of: studentToLink.id })
        .eq('id', parentToLink.id);

      if (updateError) {
        console.error('❌ Error linking parent to student:', updateError);
        return;
      }

      console.log('✅ Successfully linked parent to student!');
      
      // Verify the link
      console.log('\n4️⃣ Verifying the link...');
      const { data: verifyUser, error: verifyError } = await supabase
        .from('users')
        .select(`
          id,
          email,
          linked_parent_of,
          students!users_linked_parent_of_fkey(
            id,
            name,
            admission_no,
            classes(class_name, section)
          )
        `)
        .eq('id', parentToLink.id)
        .single();

      if (verifyError) {
        console.error('❌ Error verifying link:', verifyError);
      } else {
        console.log('✅ Link verified successfully!');
        console.log(`📧 Parent: ${verifyUser.email}`);
        console.log(`👤 Linked Student: ${verifyUser.students?.name || 'Not found'}`);
        console.log(`🎓 Class: ${verifyUser.students?.classes?.class_name || 'N/A'} ${verifyUser.students?.classes?.section || ''}`);
      }
    } else {
      console.log('\n3️⃣ All parents already have proper linkage or no students available.');
    }

    console.log('\n🎉 Parent-Student linkage fix completed!');
    console.log('\n📱 Now try the parent app again - it should show real student data instead of sample data.');

  } catch (error) {
    console.error('💥 Script error:', error);
  }
}

// Instruction for the user
console.log(`
🔧 PARENT-STUDENT LINKAGE FIX SCRIPT
=====================================

BEFORE RUNNING THIS SCRIPT:
1. Open your Supabase dashboard
2. Go to Settings → API
3. Copy your Project URL and anon/public key
4. Replace the placeholders at the top of this file:
   - SUPABASE_URL = 'your_supabase_url_here'
   - SUPABASE_ANON_KEY = 'your_supabase_anon_key_here'

THEN RUN: node fix_parent_linkage.js

This script will:
✅ Find all parent users
✅ Find all students
✅ Link the first unlinked parent to the first student
✅ Verify the linkage works

After running this, your parent app should show real data!
=====================================
`);

// Uncomment the line below after adding your Supabase credentials
// fixParentStudentLinkage();
