const { createClient } = require('@supabase/supabase-js');

// Supabase configuration from the app
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function listStudents() {
  console.log('📚 Listing all students...\n');
  
  try {
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, name, tenant_id, class_id, admission_no')
      .order('name');
    
    if (studentsError) {
      console.error('❌ Error fetching students:', studentsError);
      return;
    }
    
    console.log(`Found ${students.length} students:\n`);
    
    students.forEach((student, index) => {
      console.log(`${index + 1}. ${student.name} (${student.admission_no})`);
      console.log(`   ID: ${student.id}`);
      console.log(`   Class ID: ${student.class_id}`);
      console.log(`   Tenant ID: ${student.tenant_id || 'MISSING'}`);
      console.log('');
    });
    
    // Check for students missing tenant_id
    const studentsWithoutTenant = students.filter(s => !s.tenant_id);
    if (studentsWithoutTenant.length > 0) {
      console.log(`⚠️ ${studentsWithoutTenant.length} students are missing tenant_id:`);
      studentsWithoutTenant.forEach(student => {
        console.log(`   - ${student.name} (ID: ${student.id})`);
      });
    } else {
      console.log('✅ All students have tenant_id assigned');
    }
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

// Run the listing
listStudents().then(() => {
  console.log('\n🏁 Student listing completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
