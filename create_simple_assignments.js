const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createSimpleAssignments() {
  console.log('📝 CREATING SIMPLE HOMEWORK ASSIGNMENTS...\n');

  try {
    // Get parent, student, teacher, and subject info
    const { data: parentUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'Arshadpatel1431@gmail.com')
      .single();

    const { data: studentData } = await supabase
      .from('students')
      .select('*, classes(*)')
      .eq('id', parentUser.linked_parent_of)
      .single();

    const { data: teacher } = await supabase
      .from('users')
      .select('*')
      .eq('role_id', 2)
      .eq('tenant_id', parentUser.tenant_id)
      .limit(1)
      .single();

    const { data: subjects } = await supabase
      .from('subjects')
      .select('*')
      .eq('tenant_id', parentUser.tenant_id)
      .limit(3);

    console.log('✅ Parent:', parentUser.full_name);
    console.log('✅ Student:', studentData.name);
    console.log('✅ Class:', `${studentData.classes.class_name} ${studentData.classes.section}`);
    console.log('✅ Teacher:', teacher.full_name);
    console.log('✅ Subjects available:', subjects.length);

    // Create simple assignments without status field
    const assignments = [
      {
        title: 'Math Practice - Addition',
        description: 'Complete pages 15-20 in your math workbook. Focus on addition problems.',
        subject_id: subjects[0].id,
        class_id: studentData.class_id,
        assigned_by: teacher.id,
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        tenant_id: parentUser.tenant_id,
        created_at: new Date().toISOString()
      },
      {
        title: 'English Reading',
        description: 'Read chapter 3 of your English book and answer the questions at the end.',
        subject_id: subjects[1] ? subjects[1].id : subjects[0].id,
        class_id: studentData.class_id,
        assigned_by: teacher.id,
        due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        tenant_id: parentUser.tenant_id,
        created_at: new Date().toISOString()
      }
    ];

    let created = 0;
    for (const assignment of assignments) {
      const { data, error } = await supabase
        .from('assignments')
        .insert(assignment)
        .select();

      if (error) {
        console.log('❌ Failed:', assignment.title, '-', error.message);
      } else {
        console.log('✅ Created:', assignment.title);
        created++;
      }
    }

    console.log(`\n🎉 Created ${created} assignments successfully!`);
    return created > 0;

  } catch (error) {
    console.error('❌ Script failed:', error.message);
    return false;
  }
}

async function checkCurrentHomework() {
  console.log('\n🔍 CHECKING EXISTING HOMEWORK...\n');

  const { data: parentUser } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'Arshadpatel1431@gmail.com')
    .single();

  const { data: studentData } = await supabase
    .from('students')
    .select('class_id')
    .eq('id', parentUser.linked_parent_of)
    .single();

  // Check assignments for the student's class
  const { data: assignments, error } = await supabase
    .from('assignments')
    .select('*')
    .eq('class_id', studentData.class_id)
    .eq('tenant_id', parentUser.tenant_id)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.log('❌ Error checking homework:', error.message);
  } else {
    console.log(`📊 Found ${assignments.length} assignments for this class:`);
    assignments.forEach((assignment, index) => {
      console.log(`   ${index + 1}. ${assignment.title}`);
      console.log(`      Due: ${new Date(assignment.due_date).toLocaleDateString()}`);
    });
  }
}

// Main execution
if (require.main === module) {
  createSimpleAssignments().then(async (success) => {
    await checkCurrentHomework();
    
    console.log('\n' + '='.repeat(50));
    console.log('🎯 HOMEWORK TROUBLESHOOTING GUIDE');
    console.log('='.repeat(50));
    console.log('\n📱 TO FIX HOMEWORK NOT SHOWING:');
    console.log('   1. Open your app');
    console.log('   2. Press F12 (if web) to open developer console');
    console.log('   3. Run: window.debugParentHomeworkTenantContext()');
    console.log('   4. Check if tenantId shows: b8f8b5f0-1234-4567-8901-123456789000');
    console.log('   5. If not, run: window.retryTenantLoading()');
    console.log('   6. Go to homework screen and pull down to refresh');
    
    console.log('\n🔄 IF STILL NOT WORKING:');
    console.log('   • Restart the app completely');
    console.log('   • Sign out and sign in again');
    console.log('   • Clear app cache');
    
    if (success) {
      console.log('\n✅ Homework assignments are now in the database!');
    }
    
    console.log('\n🏁 Done');
    process.exit(0);
  });
}
