// Script to check existing data
const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkData() {
  console.log('🔍 Checking Existing Data');
  console.log('=========================');

  try {
    // Check users table
    console.log('\n1. USERS TABLE:');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, full_name, email, linked_teacher_id, linked_student_id, tenant_id, role_id')
      .limit(10);

    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
    } else {
      console.log(`📊 Found ${users?.length || 0} users`);
      if (users && users.length > 0) {
        users.forEach((user, index) => {
          console.log(`  ${index + 1}. ${user.full_name || 'No name'} (${user.email})`);
          console.log(`     Teacher link: ${user.linked_teacher_id || 'None'}`);
          console.log(`     Student link: ${user.linked_student_id || 'None'}`);
          console.log(`     Tenant: ${user.tenant_id || 'None'}`);
          console.log(`     Role: ${user.role_id || 'None'}`);
          console.log('     ---');
        });
      }
    }

    // Check teachers table
    console.log('\n2. TEACHERS TABLE:');
    const { data: teachers, error: teachersError } = await supabase
      .from('teachers')
      .select('id, name, tenant_id')
      .limit(10);

    if (teachersError) {
      console.error('❌ Error fetching teachers:', teachersError);
    } else {
      console.log(`📊 Found ${teachers?.length || 0} teachers`);
      if (teachers && teachers.length > 0) {
        teachers.forEach((teacher, index) => {
          console.log(`  ${index + 1}. ${teacher.name} (ID: ${teacher.id})`);
          console.log(`     Tenant: ${teacher.tenant_id || 'None'}`);
          console.log('     ---');
        });
      }
    }

    // Check students table
    console.log('\n3. STUDENTS TABLE:');
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, name, admission_no, tenant_id')
      .limit(5);

    if (studentsError) {
      console.error('❌ Error fetching students:', studentsError);
    } else {
      console.log(`📊 Found ${students?.length || 0} students`);
    }

    // Check roles table
    console.log('\n4. ROLES TABLE:');
    const { data: roles, error: rolesError } = await supabase
      .from('roles')
      .select('id, role_name')
      .limit(10);

    if (rolesError) {
      console.error('❌ Error fetching roles:', rolesError);
    } else {
      console.log(`📊 Found ${roles?.length || 0} roles`);
      if (roles && roles.length > 0) {
        roles.forEach((role, index) => {
          console.log(`  ${index + 1}. ${role.role_name} (ID: ${role.id})`);
        });
      }
    }

    // Check classes table
    console.log('\n5. CLASSES TABLE:');
    const { data: classes, error: classesError } = await supabase
      .from('classes')
      .select('id, class_name, section, tenant_id')
      .limit(5);

    if (classesError) {
      console.error('❌ Error fetching classes:', classesError);
    } else {
      console.log(`📊 Found ${classes?.length || 0} classes`);
      if (classes && classes.length > 0) {
        classes.forEach((cls, index) => {
          console.log(`  ${index + 1}. ${cls.class_name} ${cls.section} (Tenant: ${cls.tenant_id})`);
        });
      }
    }

  } catch (error) {
    console.error('💥 Script error:', error);
  }
}

// Run the script
checkData().then(() => {
  console.log('\n✅ Data check completed');
}).catch(error => {
  console.error('💥 Script failed:', error);
});
