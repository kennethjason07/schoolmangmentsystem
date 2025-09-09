const { createClient } = require('@supabase/supabase-js');

// Supabase configuration from the app
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function fixStudentTenantId() {
  console.log('🔧 Fixing student tenant_id...\n');
  
  const studentId = 'ffe76754-617e-4386-bc22-1f0d72289689'; // Justus (from logs)
  const expectedTenantId = 'b8f8b5f0-1234-4567-8901-123456789000'; // Default School
  
  // Also fix class if needed
  const classId = '37b82e22-ff67-45f7-9df4-1e0201376fb9'; // Class 3A
  
  try {
    // Step 1: Check current student record
    console.log('📋 Step 1: Checking current student record...');
    const { data: currentStudent, error: fetchError } = await supabase
      .from('students')
      .select('id, name, tenant_id, class_id')
      .eq('id', studentId)
      .single();
    
    if (fetchError) {
      console.error('❌ Error fetching student:', fetchError);
      return;
    }
    
    console.log('Current student record:', {
      id: currentStudent.id,
      name: currentStudent.name,
      tenant_id: currentStudent.tenant_id || 'NULL/UNDEFINED',
      class_id: currentStudent.class_id
    });
    
    // Step 2: Update student tenant_id if missing
    if (!currentStudent.tenant_id) {
      console.log('\n📋 Step 2: Updating student tenant_id...');
      
      const { data: updatedStudent, error: updateError } = await supabase
        .from('students')
        .update({ tenant_id: expectedTenantId })
        .eq('id', studentId)
        .select()
        .single();
      
      if (updateError) {
        console.error('❌ Error updating student:', updateError);
        return;
      }
      
      console.log('✅ Student tenant_id updated successfully:', {
        id: updatedStudent.id,
        name: updatedStudent.name,
        tenant_id: updatedStudent.tenant_id,
        class_id: updatedStudent.class_id
      });
    } else {
      console.log('✅ Student already has tenant_id:', currentStudent.tenant_id);
    }
    
    // Step 3: Verify the class also has correct tenant_id
    console.log('\n📋 Step 3: Checking class tenant_id...');
    const { data: classRecord, error: classError } = await supabase
      .from('classes')
      .select('id, class_name, section, tenant_id')
      .eq('id', currentStudent.class_id)
      .single();
    
    if (classError) {
      console.log('⚠️ Could not fetch class record:', classError.message);
    } else {
      console.log('Class record:', {
        id: classRecord.id,
        name: `${classRecord.class_name}-${classRecord.section}`,
        tenant_id: classRecord.tenant_id || 'NULL/UNDEFINED'
      });
      
      if (!classRecord.tenant_id) {
        console.log('⚠️ Class is missing tenant_id - fixing it now...');
        
        const { data: updatedClass, error: classUpdateError } = await supabase
          .from('classes')
          .update({ tenant_id: expectedTenantId })
          .eq('id', classRecord.id)
          .select()
          .single();
        
        if (classUpdateError) {
          console.error('❌ Error updating class tenant_id:', classUpdateError);
        } else {
          console.log('✅ Class tenant_id updated successfully:', {
            id: updatedClass.id,
            name: `${updatedClass.class_name}-${updatedClass.section}`,
            tenant_id: updatedClass.tenant_id
          });
        }
      }
    }
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

// Run the fix
fixStudentTenantId().then(() => {
  console.log('\n🏁 Student tenant_id fix completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
