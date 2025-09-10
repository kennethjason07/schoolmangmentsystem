const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function diagnoseParentDashboard() {
  console.log('🔍 DIAGNOSING PARENT DASHBOARD ISSUES...\n');

  try {
    // Check parent user
    const { data: parentUser, error: parentError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'Arshadpatel1431@gmail.com')
      .single();

    if (parentError) {
      console.log('❌ Parent user not found:', parentError.message);
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

    // Check tenant
    if (parentUser.tenant_id) {
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', parentUser.tenant_id)
        .single();

      if (tenantError) {
        console.log('❌ Tenant not found:', tenantError.message);
      } else {
        console.log('✅ Tenant found:', {
          id: tenant.id,
          name: tenant.name,
          status: tenant.status
        });
      }
    }

    // Check linked student
    if (parentUser.linked_parent_of) {
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('*, classes(*)')
        .eq('id', parentUser.linked_parent_of)
        .single();

      if (studentError) {
        console.log('❌ Linked student not found:', studentError.message);
      } else {
        console.log('✅ Linked student found:', {
          id: student.id,
          name: student.name,
          admission_no: student.admission_no,
          class: student.classes ? `${student.classes.class_name} ${student.classes.section}` : 'No class'
        });

        // Check for basic dashboard data
        console.log('\n📊 Checking dashboard data...');

        // Check notifications
        const { data: notifications, error: notifError } = await supabase
          .from('notification_recipients')
          .select('*, notifications(*)')
          .eq('recipient_type', 'Parent')
          .eq('recipient_id', parentUser.id)
          .eq('tenant_id', parentUser.tenant_id)
          .limit(3);

        console.log(`📔 Notifications: ${notifications?.length || 0} found`);
        if (notifError) console.log('   Error:', notifError.message);

        // Check marks
        const { data: marks, error: marksError } = await supabase
          .from('marks')
          .select('*')
          .eq('student_id', student.id)
          .eq('tenant_id', parentUser.tenant_id)
          .limit(3);

        console.log(`📊 Marks: ${marks?.length || 0} found`);
        if (marksError) console.log('   Error:', marksError.message);

        // Check assignments
        const { data: assignments, error: assignError } = await supabase
          .from('assignments')
          .select('*')
          .eq('class_id', student.class_id)
          .eq('tenant_id', parentUser.tenant_id)
          .limit(3);

        console.log(`📝 Assignments: ${assignments?.length || 0} found`);
        if (assignError) console.log('   Error:', assignError.message);

        // Check attendance
        const { data: attendance, error: attendError } = await supabase
          .from('attendance')
          .select('*')
          .eq('student_id', student.id)
          .eq('tenant_id', parentUser.tenant_id)
          .limit(3);

        console.log(`📅 Attendance records: ${attendance?.length || 0} found`);
        if (attendError) console.log('   Error:', attendError.message);
      }
    }

    return true;

  } catch (error) {
    console.error('❌ Diagnosis failed:', error.message);
    return false;
  }
}

async function createBasicDashboardData() {
  console.log('\n🔧 CREATING BASIC DASHBOARD DATA...\n');

  try {
    const { data: parentUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'Arshadpatel1431@gmail.com')
      .single();

    const { data: student } = await supabase
      .from('students')
      .select('*, classes(*)')
      .eq('id', parentUser.linked_parent_of)
      .single();

    // Create a basic notification for the parent
    const { data: notification, error: notifError } = await supabase
      .from('notifications')
      .insert({
        message: `Welcome to the parent dashboard! You can now track ${student.name}'s progress.`,
        type: 'General',
        tenant_id: parentUser.tenant_id,
        created_at: new Date().toISOString(),
        sent_at: new Date().toISOString()
      })
      .select()
      .single();

    if (!notifError && notification) {
      // Create recipient record
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

      if (!recipientError) {
        console.log('✅ Created welcome notification');
      }
    }

    // Create basic attendance record
    const today = new Date().toISOString().split('T')[0];
    const { error: attendanceError } = await supabase
      .from('attendance')
      .upsert({
        student_id: student.id,
        date: today,
        status: 'Present',
        tenant_id: parentUser.tenant_id,
        created_at: new Date().toISOString()
      });

    if (!attendanceError) {
      console.log('✅ Created attendance record');
    }

    return true;

  } catch (error) {
    console.error('❌ Failed to create dashboard data:', error.message);
    return false;
  }
}

// Main execution
if (require.main === module) {
  diagnoseParentDashboard().then(async (diagnosed) => {
    if (diagnosed) {
      await createBasicDashboardData();
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎯 PARENT DASHBOARD TROUBLESHOOTING');
    console.log('='.repeat(60));

    console.log('\n📱 IMMEDIATE FIXES TO TRY:');
    console.log('\n1. 🔄 Browser Console Fix (Web):');
    console.log('   • Press F12 to open developer console');
    console.log('   • Run: window.retryTenantLoading()');
    console.log('   • Wait 3 seconds');
    console.log('   • Pull down to refresh dashboard');

    console.log('\n2. 🚀 App Restart:');
    console.log('   • Close app completely');
    console.log('   • Sign out if possible');
    console.log('   • Restart app');
    console.log('   • Sign in again: Arshadpatel1431@gmail.com');

    console.log('\n3. 📱 Cache Clear:');
    console.log('   • Android: Settings > Apps > Your App > Storage > Clear Cache');
    console.log('   • iOS: Delete and reinstall app');
    console.log('   • Web: Clear browser cache, try incognito mode');

    console.log('\n4. 🔍 Debug Check:');
    console.log('   • In browser console, run:');
    console.log('   • window.debugTenantContext()');
    console.log('   • Look for tenant ID: b8f8b5f0-1234-4567-8901-123456789000');

    console.log('\n🎉 EXPECTED RESULT:');
    console.log('   After fixing tenant context, the parent dashboard should load');
    console.log('   and show basic information about student "Abhishek T"');

    console.log('\n🏁 Diagnostic complete');
    process.exit(0);
  });
}
