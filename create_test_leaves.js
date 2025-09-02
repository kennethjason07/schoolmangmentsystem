// Script to create test leave applications
const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createTestLeaves() {
  console.log('🏥 Creating Test Leave Applications');
  console.log('==================================');

  try {
    // First, let's check what users and teachers we have to work with
    console.log('\\n1. CHECKING AVAILABLE USERS:');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, full_name, email, linked_teacher_id, tenant_id')
      .not('linked_teacher_id', 'is', null)
      .limit(5);

    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return;
    }

    console.log(`Found ${users?.length || 0} users with teacher links`);
    if (users && users.length > 0) {
      users.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.full_name} (${user.email}) - Teacher: ${user.linked_teacher_id}, Tenant: ${user.tenant_id}`);
      });
    } else {
      console.log('❌ No users with teacher links found. Need to create teacher accounts first.');
      return;
    }

    // Check if we have teachers in the database
    console.log('\\n2. CHECKING AVAILABLE TEACHERS:');
    const { data: teachers, error: teachersError } = await supabase
      .from('teachers')
      .select('id, name, tenant_id')
      .limit(5);

    if (teachersError) {
      console.error('❌ Error fetching teachers:', teachersError);
      return;
    }

    console.log(`Found ${teachers?.length || 0} teachers`);
    if (teachers && teachers.length > 0) {
      teachers.forEach((teacher, index) => {
        console.log(`  ${index + 1}. ${teacher.name} (ID: ${teacher.id}, Tenant: ${teacher.tenant_id})`);
      });
    } else {
      console.log('❌ No teachers found. Need to create teachers first.');
      return;
    }

    // Now let's create some test leave applications
    const currentDate = new Date();
    const tomorrow = new Date(currentDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const nextWeek = new Date(currentDate);
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    const nextMonth = new Date(currentDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    // Create sample leave applications for each user-teacher combination
    console.log('\\n3. CREATING TEST LEAVE APPLICATIONS:');
    
    const testLeaves = [];
    
    for (let i = 0; i < Math.min(users.length, 3); i++) {
      const user = users[i];
      const teacher = teachers.find(t => t.id === user.linked_teacher_id) || teachers[0];
      
      if (!teacher) continue;
      
      // Create different types of leaves
      const leaveData = [
        {
          teacher_id: teacher.id,
          leave_type: 'Sick Leave',
          start_date: tomorrow.toISOString().split('T')[0],
          end_date: tomorrow.toISOString().split('T')[0],
          reason: 'Not feeling well, need to rest and recover',
          status: 'Pending',
          applied_by: user.id,
          applied_date: currentDate.toISOString(),
          total_days: 1,
          academic_year: '2024-25',
          tenant_id: user.tenant_id,
          created_at: currentDate.toISOString(),
          updated_at: currentDate.toISOString()
        },
        {
          teacher_id: teacher.id,
          leave_type: 'Casual Leave',
          start_date: nextWeek.toISOString().split('T')[0],
          end_date: nextWeek.toISOString().split('T')[0],
          reason: 'Personal work that cannot be postponed',
          status: 'Approved',
          applied_by: user.id,
          applied_date: currentDate.toISOString(),
          reviewed_by: user.id,
          reviewed_at: currentDate.toISOString(),
          admin_remarks: 'Approved. Please ensure class coverage is arranged.',
          total_days: 1,
          academic_year: '2024-25',
          tenant_id: user.tenant_id,
          created_at: currentDate.toISOString(),
          updated_at: currentDate.toISOString()
        }
      ];
      
      // Add another leave for variety if we have multiple users
      if (i === 1) {
        leaveData.push({
          teacher_id: teacher.id,
          leave_type: 'Emergency Leave',
          start_date: nextMonth.toISOString().split('T')[0],
          end_date: nextMonth.toISOString().split('T')[0],
          reason: 'Family emergency requiring immediate attention',
          status: 'Rejected',
          applied_by: user.id,
          applied_date: currentDate.toISOString(),
          reviewed_by: user.id,
          reviewed_at: currentDate.toISOString(),
          admin_remarks: 'Need more documentation. Please reapply with proper medical certificate.',
          total_days: 1,
          academic_year: '2024-25',
          tenant_id: user.tenant_id,
          created_at: currentDate.toISOString(),
          updated_at: currentDate.toISOString()
        });
      }
      
      testLeaves.push(...leaveData);
    }

    // Insert the test leaves
    console.log(`\\nInserting ${testLeaves.length} test leave applications...`);
    
    const { data: insertedLeaves, error: insertError } = await supabase
      .from('leave_applications')
      .insert(testLeaves)
      .select('*');

    if (insertError) {
      console.error('❌ Error inserting test leaves:', insertError);
      return;
    }

    console.log(`✅ Successfully created ${insertedLeaves?.length || 0} test leave applications!`);
    
    // Display summary
    console.log('\\n4. SUMMARY OF CREATED LEAVES:');
    if (insertedLeaves && insertedLeaves.length > 0) {
      insertedLeaves.forEach((leave, index) => {
        console.log(`  ${index + 1}. ${leave.leave_type} - ${leave.status}`);
        console.log(`     Teacher: ${leave.teacher_id}`);
        console.log(`     Date: ${leave.start_date} to ${leave.end_date}`);
        console.log(`     Reason: ${leave.reason}`);
        console.log(`     Tenant: ${leave.tenant_id}`);
        console.log('     ---');
      });
    }

    // Verify the data was created correctly
    console.log('\\n5. VERIFICATION - CHECKING INSERTED DATA:');
    const { data: verifyData, error: verifyError } = await supabase
      .from('leave_applications')
      .select('id, leave_type, status, start_date, teacher_id, tenant_id')
      .order('created_at', { ascending: false })
      .limit(10);

    if (verifyError) {
      console.error('❌ Error verifying data:', verifyError);
    } else {
      console.log(`📊 Total leave applications in database: ${verifyData?.length || 0}`);
      if (verifyData && verifyData.length > 0) {
        console.log('Recent applications:');
        verifyData.slice(0, 5).forEach((leave, index) => {
          console.log(`  ${index + 1}. ${leave.leave_type} - ${leave.status} (Tenant: ${leave.tenant_id})`);
        });
      }
    }

    console.log('\\n🎉 Test leave applications created successfully!');
    console.log('💡 You should now be able to see leaves in your application.');
    console.log('💡 Make sure you are logged in as a user from the same tenant.');

  } catch (error) {
    console.error('💥 Script error:', error);
  }
}

// Run the script
createTestLeaves().then(() => {
  console.log('\\n✅ Script completed');
}).catch(error => {
  console.error('💥 Script failed:', error);
});
