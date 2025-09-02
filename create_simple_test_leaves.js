// Simple script to create test leave applications using existing teachers
const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Use the existing tenant ID from the data we saw
const TENANT_ID = 'b8f8b5f0-1234-4567-8901-123456789000';

async function createSimpleTestLeaves() {
  console.log('🏥 Creating Simple Test Leave Applications');
  console.log('=========================================');

  try {
    // Get existing teachers
    console.log('\\n1. GETTING EXISTING TEACHERS:');
    const { data: teachers, error: teachersError } = await supabase
      .from('teachers')
      .select('id, name, tenant_id')
      .eq('tenant_id', TENANT_ID)
      .limit(5);

    if (teachersError) {
      console.error('❌ Error fetching teachers:', teachersError);
      return;
    }

    console.log(`✅ Found ${teachers?.length || 0} teachers for tenant ${TENANT_ID}`);
    if (!teachers || teachers.length === 0) {
      console.log('❌ No teachers found. Cannot create leave applications.');
      return;
    }

    // Create test leave applications
    const currentDate = new Date();
    const yesterday = new Date(currentDate);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const tomorrow = new Date(currentDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const nextWeek = new Date(currentDate);
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    const nextMonth = new Date(currentDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    console.log('\\n2. CREATING TEST LEAVE APPLICATIONS:');
    
    // Create a dummy user ID for the applied_by field (since we have no users)
    const dummyUserId = '00000000-0000-0000-0000-000000000001';
    
    const testLeaves = [
      {
        teacher_id: teachers[0].id,
        leave_type: 'Sick Leave',
        start_date: tomorrow.toISOString().split('T')[0],
        end_date: tomorrow.toISOString().split('T')[0],
        reason: 'Feeling unwell, need to rest and recover from fever',
        status: 'Pending',
        applied_by: dummyUserId,
        applied_date: currentDate.toISOString(),
        total_days: 1,
        academic_year: '2024-25',
        tenant_id: TENANT_ID,
        created_at: currentDate.toISOString(),
        updated_at: currentDate.toISOString()
      },
      {
        teacher_id: teachers[1] ? teachers[1].id : teachers[0].id,
        leave_type: 'Casual Leave',
        start_date: nextWeek.toISOString().split('T')[0],
        end_date: nextWeek.toISOString().split('T')[0],
        reason: 'Personal work - need to attend family function',
        status: 'Approved',
        applied_by: dummyUserId,
        applied_date: yesterday.toISOString(),
        reviewed_by: dummyUserId,
        reviewed_at: currentDate.toISOString(),
        admin_remarks: 'Leave approved. Please ensure class coverage is arranged with substitute teacher.',
        total_days: 1,
        academic_year: '2024-25',
        tenant_id: TENANT_ID,
        created_at: yesterday.toISOString(),
        updated_at: currentDate.toISOString()
      },
      {
        teacher_id: teachers[2] ? teachers[2].id : teachers[0].id,
        leave_type: 'Medical Leave',
        start_date: nextMonth.toISOString().split('T')[0],
        end_date: new Date(nextMonth.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 days
        reason: 'Scheduled medical procedure - doctor appointment and recovery time needed',
        status: 'Rejected',
        applied_by: dummyUserId,
        applied_date: yesterday.toISOString(),
        reviewed_by: dummyUserId,
        reviewed_at: currentDate.toISOString(),
        admin_remarks: 'Please provide medical certificate from doctor. Resubmit with proper documentation.',
        total_days: 3,
        academic_year: '2024-25',
        tenant_id: TENANT_ID,
        created_at: yesterday.toISOString(),
        updated_at: currentDate.toISOString()
      },
      {
        teacher_id: teachers[3] ? teachers[3].id : teachers[0].id,
        leave_type: 'Emergency Leave',
        start_date: currentDate.toISOString().split('T')[0],
        end_date: currentDate.toISOString().split('T')[0],
        reason: 'Urgent family emergency - need to travel immediately',
        status: 'Pending',
        applied_by: dummyUserId,
        applied_date: currentDate.toISOString(),
        total_days: 1,
        academic_year: '2024-25',
        tenant_id: TENANT_ID,
        created_at: currentDate.toISOString(),
        updated_at: currentDate.toISOString()
      },
      {
        teacher_id: teachers[4] ? teachers[4].id : teachers[0].id,
        leave_type: 'Personal Leave',
        start_date: new Date(currentDate.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // day after tomorrow
        end_date: new Date(currentDate.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 days
        reason: 'Moving to new house - need time to relocate and settle',
        status: 'Approved',
        applied_by: dummyUserId,
        applied_date: yesterday.toISOString(),
        reviewed_by: dummyUserId,
        reviewed_at: currentDate.toISOString(),
        admin_remarks: 'Approved. Good luck with your move!',
        replacement_teacher_id: teachers[0].id, // assign first teacher as replacement
        replacement_notes: 'Please cover math classes for grade 3A and 3B during absence',
        total_days: 2,
        academic_year: '2024-25',
        tenant_id: TENANT_ID,
        created_at: yesterday.toISOString(),
        updated_at: currentDate.toISOString()
      }
    ];

    console.log(`Creating ${testLeaves.length} test leave applications...`);
    
    // Insert the test data
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
    console.log('\\n3. SUMMARY OF CREATED LEAVES:');
    if (insertedLeaves && insertedLeaves.length > 0) {
      insertedLeaves.forEach((leave, index) => {
        const teacher = teachers.find(t => t.id === leave.teacher_id);
        console.log(`  ${index + 1}. ${leave.leave_type} - ${leave.status}`);
        console.log(`     Teacher: ${teacher ? teacher.name : 'Unknown'} (${leave.teacher_id})`);
        console.log(`     Date: ${leave.start_date} to ${leave.end_date} (${leave.total_days} days)`);
        console.log(`     Reason: ${leave.reason}`);
        if (leave.admin_remarks) {
          console.log(`     Admin Remarks: ${leave.admin_remarks}`);
        }
        console.log('     ---');
      });
    }

    // Verify the creation
    console.log('\\n4. VERIFICATION:');
    const { data: allLeaves, error: verifyError } = await supabase
      .from('leave_applications')
      .select('id, leave_type, status, teacher_id, tenant_id')
      .eq('tenant_id', TENANT_ID);

    if (verifyError) {
      console.error('❌ Error verifying data:', verifyError);
    } else {
      console.log(`📊 Total leave applications for tenant ${TENANT_ID}: ${allLeaves?.length || 0}`);
    }

    console.log('\\n🎉 SUCCESS!');
    console.log('💡 Test leave applications have been created.');
    console.log('💡 You should now be able to see leaves in your application.');
    console.log(`💡 All leaves are created for tenant: ${TENANT_ID}`);
    console.log('💡 Make sure your user has the same tenant_id to see these leaves.');

  } catch (error) {
    console.error('💥 Script error:', error);
  }
}

// Run the script
createSimpleTestLeaves().then(() => {
  console.log('\\n✅ Script completed successfully');
}).catch(error => {
  console.error('💥 Script failed:', error);
});
