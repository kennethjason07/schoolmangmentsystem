const { createClient } = require('@supabase/supabase-js');

// Supabase configuration from the app
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function diagnoseHomeworkData() {
  console.log('🔍 Diagnosing homework data and tenant isolation...\n');
  
  const expectedTenantId = 'b8f8b5f0-1234-4567-8901-123456789000'; // Default School
  const studentId = 'ffe76754-617e-4386-bc22-1f0d72289689'; // Justus
  const classId = '37b82e22-ff67-45f7-9df4-1e0201376fb9'; // Class 3A
  
  try {
    // Step 1: Check all homeworks (without tenant filter)
    console.log('📋 Step 1: Checking ALL homeworks in database...');
    const { data: allHomeworks, error: allHomeworksError } = await supabase
      .from('homeworks')
      .select('id, title, tenant_id, class_id, teacher_id, due_date')
      .order('created_at', { ascending: false });
    
    if (allHomeworksError) {
      console.log('❌ Could not fetch homeworks:', allHomeworksError.message);
    } else {
      console.log(`Found ${allHomeworks.length} total homeworks:`);
      allHomeworks.forEach((hw, index) => {
        const tenantMatch = hw.tenant_id === expectedTenantId ? '✅' : '❌';
        const classMatch = hw.class_id === classId ? '✅' : '❌';
        console.log(`   ${index + 1}. "${hw.title}"`);
        console.log(`      - Tenant ID: ${hw.tenant_id || 'NULL'} ${tenantMatch}`);
        console.log(`      - Class ID: ${hw.class_id || 'NULL'} ${classMatch}`);
        console.log(`      - Due Date: ${hw.due_date || 'Not set'}`);
        console.log('');
      });
    }
    
    // Step 2: Check homeworks with correct tenant filter
    console.log('📋 Step 2: Checking homeworks with tenant filter...');
    const { data: tenantHomeworks, error: tenantHomeworksError } = await supabase
      .from('homeworks')
      .select('id, title, tenant_id, class_id, assigned_students')
      .eq('tenant_id', expectedTenantId);
    
    if (tenantHomeworksError) {
      console.log('❌ Could not fetch tenant homeworks:', tenantHomeworksError.message);
    } else {
      console.log(`Found ${tenantHomeworks.length} homeworks for tenant ${expectedTenantId}:`);
      tenantHomeworks.forEach((hw, index) => {
        console.log(`   ${index + 1}. "${hw.title}" (Class: ${hw.class_id})`);
        if (hw.assigned_students && Array.isArray(hw.assigned_students)) {
          const studentAssigned = hw.assigned_students.includes(studentId);
          console.log(`      - Assigned students: ${hw.assigned_students.length} ${studentAssigned ? '✅ Includes Justus' : '❌ Does not include Justus'}`);
        }
      });
    }
    
    // Step 3: Check assignments
    console.log('\n📋 Step 3: Checking assignments...');
    const { data: allAssignments, error: allAssignmentsError } = await supabase
      .from('assignments')
      .select('id, title, tenant_id, class_id, due_date')
      .order('created_at', { ascending: false });
    
    if (allAssignmentsError) {
      console.log('❌ Could not fetch assignments:', allAssignmentsError.message);
    } else {
      console.log(`Found ${allAssignments.length} total assignments:`);
      allAssignments.forEach((assign, index) => {
        const tenantMatch = assign.tenant_id === expectedTenantId ? '✅' : '❌';
        const classMatch = assign.class_id === classId ? '✅' : '❌';
        console.log(`   ${index + 1}. "${assign.title}"`);
        console.log(`      - Tenant ID: ${assign.tenant_id || 'NULL'} ${tenantMatch}`);
        console.log(`      - Class ID: ${assign.class_id || 'NULL'} ${classMatch}`);
        console.log(`      - Due Date: ${assign.due_date || 'Not set'}`);
        console.log('');
      });
    }
    
    // Step 4: Check class and student data
    console.log('📋 Step 4: Checking class and student data...');
    
    // Check class
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('id, class_name, section, tenant_id')
      .eq('id', classId);
    
    if (classError) {
      console.log('❌ Could not fetch class:', classError.message);
    } else if (classData.length === 0) {
      console.log('❌ Class not found');
    } else {
      const cls = classData[0];
      const tenantMatch = cls.tenant_id === expectedTenantId ? '✅' : '❌';
      console.log(`Class: ${cls.class_name}-${cls.section}`);
      console.log(`   - Tenant ID: ${cls.tenant_id || 'NULL'} ${tenantMatch}`);
    }
    
    // Check student (might fail due to RLS)
    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .select('id, name, tenant_id, class_id')
      .eq('id', studentId);
    
    if (studentError) {
      console.log('❌ Could not fetch student (likely RLS protected):', studentError.message);
    } else if (studentData.length === 0) {
      console.log('❌ Student not found (likely RLS protected)');
    } else {
      const student = studentData[0];
      const tenantMatch = student.tenant_id === expectedTenantId ? '✅' : '❌';
      console.log(`Student: ${student.name}`);
      console.log(`   - Tenant ID: ${student.tenant_id || 'NULL'} ${tenantMatch}`);
      console.log(`   - Class ID: ${student.class_id} ${student.class_id === classId ? '✅' : '❌'}`);
    }
    
    // Step 5: Test the specific query from homework screen
    console.log('\n📋 Step 5: Testing homework query from parent screen...');
    const { data: parentHomeworks, error: parentHomeworksError } = await supabase
      .from('homeworks')
      .select('*')
      .eq('tenant_id', expectedTenantId)
      .or(`class_id.eq.${classId},assigned_students.cs.{${studentId}}`);
    
    if (parentHomeworksError) {
      console.log('❌ Parent homework query failed:', parentHomeworksError.message);
    } else {
      console.log(`Parent homework query returned ${parentHomeworks.length} results`);
      parentHomeworks.forEach((hw, index) => {
        console.log(`   ${index + 1}. "${hw.title}" - Class: ${hw.class_id}, Due: ${hw.due_date}`);
      });
    }
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

// Run the diagnosis
diagnoseHomeworkData().then(() => {
  console.log('\n🏁 Homework data diagnosis completed');
  console.log('\n💡 RECOMMENDATIONS:');
  console.log('   - If homeworks exist but have wrong tenant_id, update them');
  console.log('   - If assignments exist but have wrong tenant_id, update them');
  console.log('   - If class/student missing tenant_id, update them');
  console.log('   - Check RLS policies if student data is not accessible');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
