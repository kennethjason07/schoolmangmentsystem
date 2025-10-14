const { createClient } = require('@supabase/supabase-js');

// Your Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Mock the tables object like in the app
const TABLES = {
  USERS: 'users',
  STUDENTS: 'students'
};

// Copy the updated getParentStudents function logic
const getParentStudents = async (parentUserId) => {
  try {
    const DEBUG_PARENT_AUTH = true; // Enable debugging to troubleshoot issues
    
    if (DEBUG_PARENT_AUTH) {
      console.log('🔍 [PARENT AUTH] Fetching students for parent user ID:', parentUserId);
    }

    // Method 1: Check if user has linked_parent_of (primary method for this schema)
    const { data: userData, error: userError } = await supabase
      .from(TABLES.USERS)
      .select(`
        id,
        email,
        full_name,
        linked_parent_of
      `)
      .eq('id', parentUserId)
      .single();

    if (userError) {
      console.error('❌ [PARENT AUTH] Error fetching user data:', userError);
      return { success: false, error: userError.message };
    }

    let students = [];

    // If linked_parent_of exists, get the student directly
    if (userData.linked_parent_of) {
      if (DEBUG_PARENT_AUTH) {
        console.log('✅ [PARENT AUTH] Found linked_parent_of:', userData.linked_parent_of);
      }
      
      // Get the student details
      const { data: studentData, error: studentError } = await supabase
        .from(TABLES.STUDENTS)
        .select(`
          id,
          name,
          admission_no,
          class_id,
          academic_year,
          classes(id, class_name, section)
        `)
        .eq('id', userData.linked_parent_of)
        .single();

      if (!studentError && studentData) {
        console.log('✅ [PARENT AUTH] Found linked student via users.linked_parent_of:', studentData.name);
        students = [studentData];
      } else {
        console.error('❌ [PARENT AUTH] Error fetching linked student:', studentError);
      }
    }

    // Method 2: Fallback - search for parent records that might reference this user via email matching
    if (students.length === 0) {
      if (DEBUG_PARENT_AUTH) {
        console.log('🔍 [PARENT AUTH] No linked_parent_of found, trying email match fallback...');
      }
      
      // Try to find parent records that match by email
      const { data: parentRecords, error: parentError } = await supabase
        .from('parents')
        .select(`
          id,
          student_id,
          email,
          students!parents_student_id_fkey(
            id,
            name,
            admission_no,
            class_id,
            academic_year,
            classes(id, class_name, section)
          )
        `)
        .eq('email', userData.email);

      if (!parentError && parentRecords && parentRecords.length > 0) {
        console.log('✅ [PARENT AUTH] Found students via email matching in parents table');
        students = parentRecords
          .filter(parent => parent.students) // Only include valid student records
          .map(parent => parent.students);
      } else if (DEBUG_PARENT_AUTH) {
        console.log('⚠️ [PARENT AUTH] No parent records found matching email:', userData.email);
      }
    }

    if (students.length === 0) {
      if (DEBUG_PARENT_AUTH) {
        console.warn('⚠️ [PARENT AUTH] No students found for parent user:', parentUserId);
      }
      return {
        success: false,
        error: 'No students found for this parent account. Please contact the school administrator.'
      };
    }

    // Remove duplicates and format student data
    const uniqueStudents = students.filter((student, index, self) => 
      self.findIndex(s => s.id === student.id) === index
    );

    const formattedStudents = [];

    for (const student of uniqueStudents) {
      // Get student's profile photo from users table
      const { data: studentUserData, error: studentUserError } = await supabase
        .from(TABLES.USERS)
        .select('profile_url')
        .eq('linked_student_id', student.id)
        .maybeSingle();

      formattedStudents.push({
        id: student.id,
        name: student.name,
        admission_no: student.admission_no,
        class_id: student.class_id,
        academic_year: student.academic_year,
        profile_url: studentUserData?.profile_url || null,
        class_name: student.classes?.class_name,
        section: student.classes?.section,
        full_class_name: student.classes ? 
          `${student.classes.class_name} ${student.classes.section}` : 
          'Unknown Class'
      });
    }

    console.log('🎉 [PARENT AUTH] Successfully found students:', formattedStudents.length);
    
    return {
      success: true,
      students: formattedStudents,
      primaryStudent: formattedStudents[0] // First student as primary
    };

  } catch (error) {
    console.error('💥 [PARENT AUTH] Unexpected error:', error);
    return {
      success: false,
      error: `Failed to fetch student data: ${error.message}`
    };
  }
};

async function testParentAuth() {
  console.log('🧪 TESTING PARENT AUTHENTICATION HELPER...\n');

  try {
    // Get all parent users
    const { data: parentUsers, error: userError } = await supabase
      .from('users')
      .select('id, email, full_name, linked_parent_of')
      .eq('role_id', 3) // Parent role ID
      .order('created_at', { ascending: false });

    if (userError) {
      console.log('❌ Error getting parent users:', userError.message);
      return;
    }

    console.log(`✅ Found ${parentUsers.length} parent users to test\n`);

    for (const parent of parentUsers) {
      console.log(`\n🧪 TESTING PARENT: ${parent.email} (${parent.full_name})`);
      console.log(`   ID: ${parent.id}`);
      console.log(`   Linked Parent Of: ${parent.linked_parent_of || 'None'}`);
      
      // Test the getParentStudents function
      const result = await getParentStudents(parent.id);
      
      console.log(`\n   📊 RESULT:`);
      if (result.success) {
        console.log(`   ✅ SUCCESS: Found ${result.students.length} student(s)`);
        result.students.forEach((student, index) => {
          console.log(`      ${index + 1}. ${student.name} (${student.admission_no})`);
          console.log(`         Class: ${student.full_class_name || 'Unknown'}`);
          console.log(`         ID: ${student.id}`);
        });
      } else {
        console.log(`   ❌ FAILED: ${result.error}`);
      }
      
      console.log(`   ${'='.repeat(60)}`);
    }

    console.log('\n\n📋 SUMMARY:');
    console.log('If you see "SUCCESS" messages above, the parent authentication is now working correctly.');
    console.log('If you see "FAILED" messages, there might be missing relationships in your database.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
if (require.main === module) {
  testParentAuth().then(() => {
    console.log('\n🏁 Test complete');
    process.exit(0);
  }).catch(err => {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  });
}

module.exports = { testParentAuth };