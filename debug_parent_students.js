const { createClient } = require('@supabase/supabase-js');

// Your Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugParentStudentRelationships() {
  console.log('🔍 DEBUGGING PARENT-STUDENT RELATIONSHIPS...\n');

  try {
    // Get all parent accounts first
    console.log('1. 👥 Getting parent accounts...');
    const { data: parentUsers, error: userError } = await supabase
      .from('users')
      .select('id, email, full_name, linked_parent_of')
      .eq('role_id', 3) // Parent role ID
      .order('created_at', { ascending: false });

    if (userError) {
      console.log('❌ Error getting parent users:', userError.message);
      return;
    }

    console.log(`✅ Found ${parentUsers.length} parent users`);

    for (const parent of parentUsers) {
      console.log(`\n📧 PARENT: ${parent.email} (${parent.full_name})`);
      console.log(`   ID: ${parent.id}`);
      console.log(`   Linked Parent Of: ${parent.linked_parent_of || 'None'}`);
      
      // Method 1: Check linked_parent_of field
      if (parent.linked_parent_of) {
        console.log(`\n   🔗 Method 1: Checking linked_parent_of...`);
        const { data: linkedStudent, error: linkedError } = await supabase
          .from('students')
          .select('id, name, admission_no, class_id')
          .eq('id', parent.linked_parent_of)
          .single();

        if (linkedError) {
          console.log(`   ❌ Error getting linked student:`, linkedError.message);
        } else if (linkedStudent) {
          console.log(`   ✅ Found linked student: ${linkedStudent.name} (ID: ${linkedStudent.id})`);
          console.log(`      Admission No: ${linkedStudent.admission_no}`);
          console.log(`      Class ID: ${linkedStudent.class_id}`);
        }
      }

      // Method 2: Check parent_student_relationships table
      console.log(`\n   🔗 Method 2: Checking parent_student_relationships...`);
      const { data: relationships, error: relError } = await supabase
        .from('parent_student_relationships')
        .select(`
          id,
          relationship_type,
          students!parent_student_relationships_student_id_fkey(
            id,
            name,
            admission_no
          ),
          parents!parent_student_relationships_parent_id_fkey(
            id,
            user_id
          )
        `)
        .eq('parents.user_id', parent.id);

      if (relError) {
        console.log(`   ❌ Error checking relationships:`, relError.message);
      } else if (relationships && relationships.length > 0) {
        console.log(`   ✅ Found ${relationships.length} relationship(s):`);
        relationships.forEach((rel, index) => {
          console.log(`      ${index + 1}. Student: ${rel.students?.name} (${rel.relationship_type})`);
          console.log(`         Student ID: ${rel.students?.id}`);
        });
      } else {
        console.log(`   ⚠️  No relationships found in parent_student_relationships table`);
      }

      // Method 3: Check direct parents table
      console.log(`\n   🔗 Method 3: Checking parents table...`);
      const { data: directParents, error: directError } = await supabase
        .from('parents')
        .select(`
          id,
          student_id,
          relation,
          students!parents_student_id_fkey(
            id,
            name,
            admission_no
          )
        `)
        .eq('user_id', parent.id);

      if (directError) {
        console.log(`   ❌ Error checking parents table:`, directError.message);
      } else if (directParents && directParents.length > 0) {
        console.log(`   ✅ Found ${directParents.length} direct parent record(s):`);
        directParents.forEach((parentRec, index) => {
          console.log(`      ${index + 1}. Student: ${parentRec.students?.name} (${parentRec.relation})`);
          console.log(`         Student ID: ${parentRec.students?.id}`);
        });
      } else {
        console.log(`   ⚠️  No records found in parents table`);
      }

      console.log(`\n   ${'='.repeat(50)}`);
    }

    // Check how many students exist in total
    console.log(`\n\n2. 👨‍🎓 Checking total students in system...`);
    const { data: allStudents, error: studentsError } = await supabase
      .from('students')
      .select('id, name, admission_no, class_id')
      .limit(10);

    if (studentsError) {
      console.log('❌ Error getting students:', studentsError.message);
    } else {
      console.log(`✅ Found ${allStudents.length} students (showing first 10):`);
      allStudents.forEach((student, index) => {
        console.log(`   ${index + 1}. ${student.name} (ID: ${student.id}, Admission: ${student.admission_no})`);
      });
    }

    // Check parent_student_relationships table structure
    console.log(`\n\n3. 🔗 Checking parent_student_relationships table...`);
    const { data: allRelationships, error: allRelError } = await supabase
      .from('parent_student_relationships')
      .select('*')
      .limit(5);

    if (allRelError) {
      console.log('❌ Error accessing parent_student_relationships:', allRelError.message);
    } else {
      console.log(`✅ Found ${allRelationships.length} relationships (showing first 5):`);
      console.log(JSON.stringify(allRelationships, null, 2));
    }

    // Check parents table structure
    console.log(`\n\n4. 👪 Checking parents table...`);
    const { data: allParentRecords, error: allParentError } = await supabase
      .from('parents')
      .select('*')
      .limit(5);

    if (allParentError) {
      console.log('❌ Error accessing parents table:', allParentError.message);
    } else {
      console.log(`✅ Found ${allParentRecords.length} parent records (showing first 5):`);
      console.log(JSON.stringify(allParentRecords, null, 2));
    }

  } catch (error) {
    console.error('❌ Debug script failed:', error.message);
  }
}

// Run the debug
if (require.main === module) {
  debugParentStudentRelationships().then(() => {
    console.log('\n🏁 Debug complete');
    process.exit(0);
  }).catch(err => {
    console.error('❌ Debug failed:', err.message);
    process.exit(1);
  });
}

module.exports = { debugParentStudentRelationships };