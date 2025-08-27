const { createClient } = require('@supabase/supabase-js');
const { format, parseISO } = require('date-fns');

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://hcqxjdmvgtfrqajkfugo.supabase.co';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjcXhqZG12Z3RmcnFhamtmdWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQwMjU4MzEsImV4cCI6MjA0OTYwMTgzMX0.4tJgSo8LT3Xrsy9LDcJNnwFOJ1sE3K5jZhyaGX1jgR8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugLeaveNotifications() {
  console.log('🔍 Debugging Leave Notifications...\n');

  try {
    // 1. Check for pending leave applications
    console.log('📝 Checking for pending leave applications...');
    const { data: pendingLeaves, error: leaveError } = await supabase
      .from('leave_applications')
      .select(`
        id, teacher_id, leave_type, start_date, end_date, status, reason,
        teacher:teachers!leave_applications_teacher_id_fkey(id, name)
      `)
      .eq('status', 'Pending')
      .limit(5);

    if (leaveError) {
      console.error('❌ Error fetching leave applications:', leaveError);
      return;
    }

    if (!pendingLeaves || pendingLeaves.length === 0) {
      console.log('ℹ️ No pending leave applications found');
    } else {
      console.log(`✅ Found ${pendingLeaves.length} pending leave applications:`);
      pendingLeaves.forEach((leave, index) => {
        console.log(`   ${index + 1}. ${leave.teacher?.name || 'Unknown'} - ${leave.leave_type}`);
        console.log(`      ${leave.start_date} to ${leave.end_date}`);
        console.log(`      ID: ${leave.id}\n`);
      });
    }

    // 2. Check for recent leave notifications
    console.log('📧 Checking for recent leave notifications...');
    const { data: notifications, error: notifError } = await supabase
      .from('notifications')
      .select('*')
      .or('message.ilike.%[LEAVE_APPROVED]%,message.ilike.%[LEAVE_REJECTED]%')
      .order('created_at', { ascending: false })
      .limit(10);

    if (notifError) {
      console.error('❌ Error fetching notifications:', notifError);
      return;
    }

    if (!notifications || notifications.length === 0) {
      console.log('ℹ️ No leave notifications found');
    } else {
      console.log(`✅ Found ${notifications.length} recent leave notifications:`);
      notifications.forEach((notif, index) => {
        console.log(`   ${index + 1}. ${notif.message.substring(0, 80)}...`);
        console.log(`      Created: ${notif.created_at}`);
        console.log(`      ID: ${notif.id}\n`);
      });
    }

    // 3. Check teacher-user linking
    console.log('👥 Checking teacher-user linking...');
    const { data: teachers, error: teacherError } = await supabase
      .from('teachers')
      .select(`
        id, name,
        user:users!users_linked_teacher_id_fkey(id, email, full_name)
      `)
      .limit(10);

    if (teacherError) {
      console.error('❌ Error fetching teacher-user links:', teacherError);
      return;
    }

    if (!teachers || teachers.length === 0) {
      console.log('ℹ️ No teachers found');
    } else {
      console.log(`✅ Found ${teachers.length} teachers:`);
      teachers.forEach((teacher, index) => {
        const hasUser = teacher.user && teacher.user.length > 0;
        console.log(`   ${index + 1}. ${teacher.name}`);
        console.log(`      Linked User: ${hasUser ? `${teacher.user[0].email} (${teacher.user[0].id})` : 'NOT LINKED'}`);
        console.log(`      Teacher ID: ${teacher.id}\n`);
      });
    }

    // 4. If there are pending leaves, simulate approval notification creation
    if (pendingLeaves && pendingLeaves.length > 0) {
      const testLeave = pendingLeaves[0];
      console.log(`🧪 Testing notification creation for leave: ${testLeave.teacher?.name}'s ${testLeave.leave_type}`);
      
      // Find the user account linked to this teacher
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('linked_teacher_id', testLeave.teacher_id)
        .single();

      if (userError || !userData) {
        console.log('❌ Teacher does not have a linked user account');
      } else {
        console.log(`✅ Found linked user: ${userData.email} (${userData.id})`);
        
        // Create a test notification
        const baseMessage = `Your ${testLeave.leave_type} request from ${format(parseISO(testLeave.start_date), 'MMM dd, yyyy')} to ${format(parseISO(testLeave.end_date), 'MMM dd, yyyy')} has been approved.`;
        const enhancedMessage = `[LEAVE_APPROVED] ${baseMessage}`;
        
        console.log('📤 Creating test notification...');
        const { data: notification, error: createError } = await supabase
          .from('notifications')
          .insert({
            message: enhancedMessage,
            type: 'General',
            delivery_mode: 'InApp',
            delivery_status: 'Sent',
            sent_by: '00000000-0000-0000-0000-000000000000', // Dummy admin ID
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (createError) {
          console.error('❌ Error creating test notification:', createError);
        } else {
          console.log(`✅ Test notification created successfully!`);
          console.log(`   Notification ID: ${notification.id}`);
          console.log(`   Message: ${enhancedMessage}`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Debug script error:', error);
  }
}

// Run the debug function
debugLeaveNotifications().then(() => {
  console.log('\n🏁 Debug script completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
