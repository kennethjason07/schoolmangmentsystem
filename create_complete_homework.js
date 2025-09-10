const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createCompleteHomework() {
  console.log('🚀 CREATING COMPLETE HOMEWORK FOR PARENT VIEW...\n');

  try {
    // Get parent and student info
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

    console.log('✅ Parent:', parentUser.full_name);
    console.log('✅ Student:', studentData.name);
    console.log('✅ Class:', `${studentData.classes.class_name} ${studentData.classes.section}`);

    // Get a teacher for the same tenant
    const { data: teachers } = await supabase
      .from('users')
      .select('*')
      .eq('role_id', 2) // Teacher role
      .eq('tenant_id', parentUser.tenant_id)
      .limit(1);

    if (!teachers || teachers.length === 0) {
      console.log('❌ No teachers found. Creating a sample teacher...');
      
      // Create a sample teacher user first
      const { data: newTeacher, error: teacherError } = await supabase
        .from('users')
        .upsert({
          email: 'teacher.sample@school.com',
          role_id: 2,
          tenant_id: parentUser.tenant_id,
          full_name: 'Sample Teacher',
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (teacherError) {
        console.log('❌ Failed to create sample teacher:', teacherError.message);
        return false;
      }
      
      console.log('✅ Created sample teacher:', newTeacher.full_name);
      teachers[0] = newTeacher;
    }

    const teacher = teachers[0];
    console.log('✅ Using teacher:', teacher.full_name);

    // Get subjects
    const { data: subjects } = await supabase
      .from('subjects')
      .select('*')
      .eq('tenant_id', parentUser.tenant_id)
      .limit(3);

    if (!subjects || subjects.length === 0) {
      console.log('❌ No subjects found');
      return false;
    }

    console.log('✅ Available subjects:', subjects.map(s => s.subject_name || s.name));

    // Create multiple homework assignments
    const homeworkList = [
      {
        title: 'Mathematics - Fractions Practice',
        description: 'Complete worksheet on adding and subtracting fractions. Show all work clearly. Due next Monday.',
        subject_id: subjects[0].id,
        class_id: studentData.class_id,
        assigned_by: teacher.id,
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        assigned_date: new Date().toISOString(),
        tenant_id: parentUser.tenant_id,
        status: 'assigned',
        created_at: new Date().toISOString()
      },
      {
        title: 'English - Story Writing',
        description: 'Write a creative story of 300 words about your summer vacation. Include proper grammar and punctuation.',
        subject_id: subjects[1] ? subjects[1].id : subjects[0].id,
        class_id: studentData.class_id,
        assigned_by: teacher.id,
        due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        assigned_date: new Date().toISOString(),
        tenant_id: parentUser.tenant_id,
        status: 'assigned',
        created_at: new Date().toISOString()
      },
      {
        title: 'Science - Plant Observation',
        description: 'Observe a plant at home for one week. Record daily changes in a notebook with drawings or photos.',
        subject_id: subjects[2] ? subjects[2].id : subjects[0].id,
        class_id: studentData.class_id,
        assigned_by: teacher.id,
        due_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        assigned_date: new Date().toISOString(),
        tenant_id: parentUser.tenant_id,
        status: 'assigned',
        created_at: new Date().toISOString()
      }
    ];

    let successCount = 0;
    for (const homework of homeworkList) {
      const { data: createdHomework, error } = await supabase
        .from('assignments')
        .insert(homework)
        .select();

      if (error) {
        console.log('❌ Failed to create homework:', homework.title);
        console.log('   Error:', error.message);
      } else {
        console.log('✅ Created homework:', homework.title);
        successCount++;
      }
    }

    if (successCount > 0) {
      console.log(`\n🎉 Successfully created ${successCount} homework assignments!`);
      
      // Now create corresponding homework records for the student
      console.log('\n📝 Creating homework records for student...');
      
      const { data: createdAssignments } = await supabase
        .from('assignments')
        .select('*')
        .eq('class_id', studentData.class_id)
        .eq('tenant_id', parentUser.tenant_id)
        .order('created_at', { ascending: false })
        .limit(3);

      if (createdAssignments && createdAssignments.length > 0) {
        for (const assignment of createdAssignments) {
          const { error: homeworkError } = await supabase
            .from('homeworks')
            .upsert({
              assignment_id: assignment.id,
              student_id: studentData.id,
              status: 'not_submitted',
              submitted_at: null,
              tenant_id: parentUser.tenant_id,
              created_at: new Date().toISOString()
            });

          if (homeworkError) {
            console.log('❌ Failed to create homework record for student:', homeworkError.message);
          } else {
            console.log('✅ Created homework record for:', assignment.title);
          }
        }
      }
    }

    return successCount > 0;

  } catch (error) {
    console.error('❌ Script failed:', error.message);
    return false;
  }
}

// Quick tenant context check function
async function checkTenantContext() {
  console.log('\n🔍 CHECKING TENANT CONTEXT...\n');
  
  const { data: parentUser } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'Arshadpatel1431@gmail.com')
    .single();

  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', parentUser.tenant_id)
    .single();

  console.log('📊 Database Context:');
  console.log('   Parent Email:', parentUser.email);
  console.log('   Parent Tenant ID:', parentUser.tenant_id);
  console.log('   Tenant Name:', tenant.name);
  console.log('   Tenant Status:', tenant.status);
  
  console.log('\n💡 DEBUGGING TIPS:');
  console.log('   1. In your app, open browser console (F12)');
  console.log('   2. Run: window.debugParentHomeworkTenantContext()');
  console.log('   3. Check if tenantId matches:', parentUser.tenant_id);
  console.log('   4. If not matching, run: window.retryTenantLoading()');
  console.log('   5. Pull down to refresh the homework screen');
}

// Main execution
if (require.main === module) {
  createCompleteHomework().then(async (success) => {
    await checkTenantContext();
    
    if (success) {
      console.log('\n' + '='.repeat(60));
      console.log('🎉 HOMEWORK CREATED SUCCESSFULLY!');
      console.log('='.repeat(60));
      console.log('\n📱 Now test your parent homework screen:');
      console.log('   1. Make sure tenant context is loaded');
      console.log('   2. Go to homework screen');
      console.log('   3. Pull down to refresh');
      console.log('   4. You should see 3 homework assignments');
      console.log('\n🔧 If homework is not visible:');
      console.log('   • Check tenant context in browser console');
      console.log('   • Restart the app');
      console.log('   • Clear app cache');
    }
    
    console.log('\n🏁 Script complete');
    process.exit(0);
  }).catch(err => {
    console.error('❌ Script failed:', err.message);
    process.exit(1);
  });
}
