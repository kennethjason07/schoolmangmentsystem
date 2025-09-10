const { createClient } = require('@supabase/supabase-js');

// Your Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createSampleParentData() {
  console.log('🚀 CREATING SAMPLE DATA FOR PARENT SCREENS...\n');

  try {
    // Get parent and student info
    const { data: parentUser, error: parentError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'Arshadpatel1431@gmail.com')
      .single();

    if (parentError) {
      console.log('❌ Parent user not found:', parentError.message);
      return false;
    }

    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .select('*, classes(*)')
      .eq('id', parentUser.linked_parent_of)
      .single();

    if (studentError) {
      console.log('❌ Student not found:', studentError.message);
      return false;
    }

    console.log('✅ Parent:', parentUser.full_name);
    console.log('✅ Student:', studentData.name);
    console.log('✅ Class:', `${studentData.classes.class_name} ${studentData.classes.section}`);

    // 1. Create homework assignments
    console.log('\n1. 📝 Creating homework assignments...');
    
    const homeworkData = [
      {
        title: 'Mathematics - Chapter 5 Exercises',
        description: 'Complete all exercises from Chapter 5: Fractions and Decimals. Due next Monday.',
        subject_id: null, // We'll set this generically
        class_id: studentData.class_id,
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        assigned_date: new Date().toISOString(),
        tenant_id: parentUser.tenant_id,
        created_at: new Date().toISOString()
      },
      {
        title: 'English - Essay Writing',
        description: 'Write a 200-word essay on "My Favorite Season" with proper grammar and punctuation.',
        subject_id: null,
        class_id: studentData.class_id,
        due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now
        assigned_date: new Date().toISOString(),
        tenant_id: parentUser.tenant_id,
        created_at: new Date().toISOString()
      },
      {
        title: 'Science - Plant Study',
        description: 'Observe a plant at home for one week. Note changes in leaves, growth, etc. Bring photos.',
        subject_id: null,
        class_id: studentData.class_id,
        due_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days from now
        assigned_date: new Date().toISOString(),
        tenant_id: parentUser.tenant_id,
        created_at: new Date().toISOString()
      }
    ];

    for (const homework of homeworkData) {
      const { error: homeworkError } = await supabase
        .from('assignments')
        .upsert(homework);
      
      if (homeworkError) {
        console.log('❌ Failed to create homework:', homework.title, homeworkError.message);
      } else {
        console.log('✅ Created homework:', homework.title);
      }
    }

    // 2. Create some marks for report card
    console.log('\n2. 📊 Creating marks for report card...');
    
    const marksData = [
      {
        student_id: studentData.id,
        subject: 'Mathematics',
        marks_obtained: 85,
        total_marks: 100,
        exam_type: 'Monthly Test',
        exam_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days ago
        teacher_remarks: 'Good performance in problem solving',
        tenant_id: parentUser.tenant_id,
        created_at: new Date().toISOString()
      },
      {
        student_id: studentData.id,
        subject: 'English',
        marks_obtained: 78,
        total_marks: 100,
        exam_type: 'Monthly Test',
        exam_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        teacher_remarks: 'Needs improvement in grammar',
        tenant_id: parentUser.tenant_id,
        created_at: new Date().toISOString()
      },
      {
        student_id: studentData.id,
        subject: 'Science',
        marks_obtained: 92,
        total_marks: 100,
        exam_type: 'Monthly Test',
        exam_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        teacher_remarks: 'Excellent understanding of concepts',
        tenant_id: parentUser.tenant_id,
        created_at: new Date().toISOString()
      }
    ];

    for (const mark of marksData) {
      const { error: markError } = await supabase
        .from('marks')
        .upsert(mark);
      
      if (markError) {
        console.log('❌ Failed to create mark:', mark.subject, markError.message);
      } else {
        console.log('✅ Created mark:', mark.subject, `-`, mark.marks_obtained, '/', mark.total_marks);
      }
    }

    // 3. Create additional notifications
    console.log('\n3. 🔔 Creating additional notifications...');
    
    // First create notifications in notifications table
    const notificationData = [
      {
        message: `New homework assigned to ${studentData.name} in Mathematics. Please check the homework section.`,
        type: 'HOMEWORK_UPLOADED',
        tenant_id: parentUser.tenant_id,
        created_at: new Date().toISOString(),
        sent_at: new Date().toISOString()
      },
      {
        message: `Monthly test results are now available for ${studentData.name}. Check the report card section.`,
        type: 'GRADE_ENTERED',
        tenant_id: parentUser.tenant_id,
        created_at: new Date().toISOString(),
        sent_at: new Date().toISOString()
      }
    ];

    for (const notification of notificationData) {
      const { data: createdNotification, error: notifError } = await supabase
        .from('notifications')
        .insert(notification)
        .select()
        .single();
      
      if (notifError) {
        console.log('❌ Failed to create notification:', notifError.message);
      } else {
        console.log('✅ Created notification:', notification.message.substring(0, 50) + '...');
        
        // Create recipient record
        const { error: recipientError } = await supabase
          .from('notification_recipients')
          .insert({
            notification_id: createdNotification.id,
            recipient_type: 'Parent',
            recipient_id: parentUser.id,
            is_read: false,
            sent_at: new Date().toISOString(),
            tenant_id: parentUser.tenant_id
          });
        
        if (recipientError) {
          console.log('❌ Failed to create notification recipient:', recipientError.message);
        }
      }
    }

    return true;

  } catch (error) {
    console.error('❌ Script failed:', error.message);
    return false;
  }
}

// Main execution
if (require.main === module) {
  createSampleParentData().then((success) => {
    if (success) {
      console.log('\n' + '='.repeat(60));
      console.log('🎉 SAMPLE DATA CREATED SUCCESSFULLY!');
      console.log('='.repeat(60));
      console.log('\n📱 Now try your parent login:');
      console.log('   📧 Email: Arshadpatel1431@gmail.com');
      console.log('   🔒 Password: [Use "Forgot Password" to reset if needed]');
      console.log('   👤 Role: Parent');
      console.log('\n✅ Your parent screens should now show:');
      console.log('   📊 Report Card: Monthly test marks for Mathematics, English, Science');
      console.log('   📝 Homework: 3 assignments (Math, English, Science)');
      console.log('   🔔 Notifications: New homework and grade notifications');
      console.log('\n💡 Tips:');
      console.log('   - Pull down to refresh if data doesn\'t appear immediately');
      console.log('   - Check that you\'re viewing data for the correct student (Justus)');
      console.log('   - All data is linked to your parent account automatically');
    } else {
      console.log('\n❌ Failed to create sample data');
      console.log('💡 The parent login should still work, but screens may be empty');
      console.log('   Try using the "Forgot Password" feature first');
    }
    
    console.log('\n🏁 Script complete');
    process.exit(0);
  }).catch(err => {
    console.error('❌ Script failed:', err.message);
    process.exit(1);
  });
}
