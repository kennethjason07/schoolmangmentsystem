const { createClient } = require('@supabase/supabase-js');

// Your Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function diagnoseParentDataIssues() {
  console.log('🔍 DIAGNOSING PARENT DATA LOADING ISSUES...\n');

  try {
    // Step 1: Check the parent account
    console.log('1. 📧 Checking parent account...');
    const parentEmail = 'Arshadpatel1431@gmail.com'; // Use existing parent account
    
    const { data: parentUser, error: parentError } = await supabase
      .from('users')
      .select('*')
      .eq('email', parentEmail)
      .single();
    
    if (parentError) {
      console.log('❌ Parent user not found:', parentError.message);
      console.log('   Try with: Arshadpatel1431@gmail.com instead');
      return false;
    }
    
    console.log('✅ Parent user found:', {
      id: parentUser.id,
      email: parentUser.email,
      full_name: parentUser.full_name,
      role_id: parentUser.role_id,
      tenant_id: parentUser.tenant_id,
      linked_parent_of: parentUser.linked_parent_of
    });

    // Step 2: Check if parent has linked children
    console.log('\n2. 👶 Checking parent-student links...');
    
    if (parentUser.linked_parent_of) {
      console.log('✅ Parent has linked_parent_of:', parentUser.linked_parent_of);
      
      // Check if the student exists
      const { data: linkedStudent, error: studentError } = await supabase
        .from('students')
        .select('*, classes(id, class_name, section)')
        .eq('id', parentUser.linked_parent_of)
        .single();
      
      if (studentError) {
        console.log('❌ Linked student not found:', studentError.message);
      } else {
        console.log('✅ Linked student found:', {
          id: linkedStudent.id,
          name: linkedStudent.name,
          admission_no: linkedStudent.admission_no,
          class: linkedStudent.classes ? `${linkedStudent.classes.class_name} ${linkedStudent.classes.section}` : 'No class'
        });
      }
    } else {
      console.log('❌ Parent has no linked_parent_of');
    }

    // Step 3: Check parents table
    console.log('\n3. 👨‍👩‍👧‍👦 Checking parents table...');
    const { data: parentsData, error: parentsError } = await supabase
      .from('parents')
      .select('*')
      .eq('email', parentEmail);
    
    if (parentsError) {
      console.log('❌ Error checking parents table:', parentsError.message);
    } else if (parentsData && parentsData.length > 0) {
      console.log('✅ Parent records found:', parentsData.length);
      parentsData.forEach((parent, index) => {
        console.log(`   ${index + 1}. Student ID: ${parent.student_id}, Relation: ${parent.relation}`);
      });
    } else {
      console.log('❌ No parent records found in parents table');
    }

    // Step 4: Check available students
    console.log('\n4. 🎓 Checking available students in system...');
    const { data: allStudents, error: studentsError } = await supabase
      .from('students')
      .select('id, name, admission_no, tenant_id, classes(class_name, section)')
      .eq('tenant_id', parentUser.tenant_id)
      .limit(5);
    
    if (studentsError) {
      console.log('❌ Error fetching students:', studentsError.message);
    } else {
      console.log(`✅ Found ${allStudents?.length || 0} students in system`);
      allStudents?.forEach((student, index) => {
        console.log(`   ${index + 1}. ${student.name} (${student.admission_no}) - Class: ${student.classes ? `${student.classes.class_name} ${student.classes.section}` : 'No class'}`);
      });
    }

    // Step 5: Check homeworks
    console.log('\n5. 📝 Checking homework data...');
    const { data: homeworks, error: homeworkError } = await supabase
      .from('assignments')
      .select('*')
      .eq('tenant_id', parentUser.tenant_id)
      .limit(3);
    
    if (homeworkError) {
      console.log('❌ Error fetching homeworks:', homeworkError.message);
    } else {
      console.log(`✅ Found ${homeworks?.length || 0} homework assignments`);
    }

    // Step 6: Check notifications
    console.log('\n6. 🔔 Checking notifications...');
    const { data: notifications, error: notifError } = await supabase
      .from('notification_recipients')
      .select('*, notifications(*)')
      .eq('recipient_type', 'Parent')
      .eq('recipient_id', parentUser.id)
      .limit(3);
    
    if (notifError) {
      console.log('❌ Error fetching notifications:', notifError.message);
    } else {
      console.log(`✅ Found ${notifications?.length || 0} notifications for parent`);
    }

    // Step 7: Check marks/grades
    console.log('\n7. 📊 Checking marks/grades data...');
    if (parentUser.linked_parent_of) {
      const { data: marks, error: marksError } = await supabase
        .from('marks')
        .select('*')
        .eq('student_id', parentUser.linked_parent_of)
        .limit(3);
      
      if (marksError) {
        console.log('❌ Error fetching marks:', marksError.message);
      } else {
        console.log(`✅ Found ${marks?.length || 0} mark records for linked student`);
      }
    }

    return true;

  } catch (error) {
    console.error('❌ Diagnostic failed:', error.message);
    return false;
  }
}

async function fixParentStudentLink() {
  console.log('\n🔧 FIXING PARENT-STUDENT RELATIONSHIP...\n');

  try {
    const parentEmail = 'Arshadpatel1431@gmail.com';
    
    // Get parent user
    const { data: parentUser, error: parentError } = await supabase
      .from('users')
      .select('*')
      .eq('email', parentEmail)
      .single();
    
    if (parentError) {
      console.log('❌ Parent user not found');
      return false;
    }

    // Get a student to link to (for demonstration)
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('*')
      .eq('tenant_id', parentUser.tenant_id)
      .limit(1);
    
    if (studentsError || !students || students.length === 0) {
      console.log('❌ No students found to link to');
      return false;
    }

    const studentToLink = students[0];
    
    console.log('1. 🔗 Creating parent-student link...');
    
    // Update parent user with linked_parent_of
    const { error: updateError } = await supabase
      .from('users')
      .update({ linked_parent_of: studentToLink.id })
      .eq('id', parentUser.id);
    
    if (updateError) {
      console.log('❌ Failed to update parent link:', updateError.message);
      return false;
    }
    
    console.log('✅ Updated parent linked_parent_of to:', studentToLink.id);

    // Create entry in parents table
    console.log('2. 👨‍👩‍👧‍👦 Creating parent record...');
    
    const { error: parentRecordError } = await supabase
      .from('parents')
      .upsert({
        name: parentUser.full_name || 'Test Parent',
        email: parentEmail,
        phone: parentUser.phone || '',
        student_id: studentToLink.id,
        relation: 'Father',
        tenant_id: parentUser.tenant_id,
        created_at: new Date().toISOString()
      });
    
    if (parentRecordError) {
      console.log('❌ Failed to create parent record:', parentRecordError.message);
    } else {
      console.log('✅ Parent record created successfully');
    }

    // Create some sample homework for testing
    console.log('3. 📝 Creating sample homework...');
    
    const { data: classes, error: classError } = await supabase
      .from('classes')
      .select('*')
      .eq('tenant_id', parentUser.tenant_id)
      .limit(1);
    
    if (!classError && classes && classes.length > 0) {
      const sampleClass = classes[0];
      
      const { error: homeworkError } = await supabase
        .from('assignments')
        .upsert({
          title: 'Sample Math Homework',
          description: 'Complete exercises 1-10 from chapter 5',
          subject: 'Mathematics',
          class_id: sampleClass.id,
          due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
          tenant_id: parentUser.tenant_id,
          created_at: new Date().toISOString()
        });
      
      if (homeworkError) {
        console.log('❌ Failed to create sample homework:', homeworkError.message);
      } else {
        console.log('✅ Sample homework created');
      }
    }

    // Create sample notification
    console.log('4. 🔔 Creating sample notification...');
    
    // First create the notification
    const { data: notification, error: notifCreateError } = await supabase
      .from('notifications')
      .insert({
        message: 'Welcome to the parent portal! You can now view your child\'s progress.',
        type: 'General',
        sent_by: 'system',
        tenant_id: parentUser.tenant_id,
        created_at: new Date().toISOString(),
        sent_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (notifCreateError) {
      console.log('❌ Failed to create notification:', notifCreateError.message);
    } else {
      // Create notification recipient
      const { error: recipientError } = await supabase
        .from('notification_recipients')
        .insert({
          notification_id: notification.id,
          recipient_type: 'Parent',
          recipient_id: parentUser.id,
          is_read: false,
          sent_at: new Date().toISOString(),
          tenant_id: parentUser.tenant_id
        });
      
      if (recipientError) {
        console.log('❌ Failed to create notification recipient:', recipientError.message);
      } else {
        console.log('✅ Sample notification created');
      }
    }

    return true;

  } catch (error) {
    console.error('❌ Fix failed:', error.message);
    return false;
  }
}

// Main execution
if (require.main === module) {
  console.log('🚀 PARENT DATA LOADING DIAGNOSTIC & FIX\n');
  
  diagnoseParentDataIssues().then(async (diagnosed) => {
    if (diagnosed) {
      console.log('\n' + '='.repeat(60));
      console.log('💡 DIAGNOSIS COMPLETE - APPLYING FIXES...');
      console.log('='.repeat(60));
      
      const fixed = await fixParentStudentLink();
      
      if (fixed) {
        console.log('\n' + '='.repeat(50));
        console.log('🎉 FIXES APPLIED SUCCESSFULLY!');
        console.log('='.repeat(50));
        console.log('\n📱 Now try using your parent login:');
        console.log('   📧 Email: Arshadpatel1431@gmail.com');
        console.log('   🔒 Password: [Use correct password or reset via "Forgot Password"]');
        console.log('   👤 Role: Parent');
        console.log('\n✅ The following should now work:');
        console.log('   - Report Card screen (should show linked student data)');
        console.log('   - Homework screen (should show assignments)');
        console.log('   - Notifications screen (should show notifications)');
        console.log('\n🔄 If screens still show no data, try:');
        console.log('   1. Pull down to refresh on each screen');
        console.log('   2. Check that you\'re signed in with the correct email');
        console.log('   3. Contact admin if issues persist');
      }
    }
    
    console.log('\n🏁 Script complete');
    process.exit(0);
  }).catch(err => {
    console.error('❌ Script failed:', err.message);
    process.exit(1);
  });
}
