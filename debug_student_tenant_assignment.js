const { supabase } = require('./src/utils/supabase');

async function checkStudentTenantAssignments() {
  console.log('🔍 Checking student tenant assignments...');
  
  try {
    // Get all student users
    const { data: studentUsers, error: usersError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        tenant_id,
        linked_student_id,
        full_name
      `)
      .not('linked_student_id', 'is', null)
      .order('email');

    if (usersError) {
      console.error('❌ Error fetching student users:', usersError);
      return;
    }

    console.log(`📊 Found ${studentUsers.length} student users`);

    // Check each student user's tenant assignments
    let matchCount = 0;
    let mismatchCount = 0;
    let noTenantCount = 0;

    for (const user of studentUsers) {
      // Get the linked student record
      const { data: studentRecord, error: studentError } = await supabase
        .from('students')
        .select('id, name, tenant_id, class_id')
        .eq('id', user.linked_student_id)
        .single();

      if (studentError) {
        console.error(`❌ Error fetching student record for user ${user.email}:`, studentError);
        continue;
      }

      // Check tenant consistency
      const userTenant = user.tenant_id;
      const studentTenant = studentRecord.tenant_id;

      if (!userTenant) {
        noTenantCount++;
        console.log(`⚠️  User ${user.email} has NO tenant_id assigned`);
        console.log(`    Linked student: ${studentRecord.name} (tenant: ${studentTenant})`);
        
        // Fix this by assigning the student's tenant to the user
        if (studentTenant) {
          console.log(`🔧 Fixing tenant assignment for ${user.email}...`);
          const { error: updateError } = await supabase
            .from('users')
            .update({ tenant_id: studentTenant })
            .eq('id', user.id);
          
          if (updateError) {
            console.error(`❌ Failed to update tenant for ${user.email}:`, updateError);
          } else {
            console.log(`✅ Fixed tenant assignment for ${user.email}`);
            matchCount++;
          }
        }
      } else if (userTenant === studentTenant) {
        matchCount++;
        console.log(`✅ MATCH: ${user.email} - tenant: ${userTenant}`);
      } else {
        mismatchCount++;
        console.log(`❌ MISMATCH: ${user.email}`);
        console.log(`    User tenant: ${userTenant}`);
        console.log(`    Student tenant: ${studentTenant}`);
        console.log(`    Student name: ${studentRecord.name}`);
        
        // Fix this by using the student's tenant
        console.log(`🔧 Fixing tenant mismatch for ${user.email}...`);
        const { error: updateError } = await supabase
          .from('users')
          .update({ tenant_id: studentTenant })
          .eq('id', user.id);
        
        if (updateError) {
          console.error(`❌ Failed to update tenant for ${user.email}:`, updateError);
        } else {
          console.log(`✅ Fixed tenant mismatch for ${user.email}`);
          matchCount++;
          mismatchCount--;
        }
      }
    }

    console.log('\n📈 Summary:');
    console.log(`✅ Matching assignments: ${matchCount}`);
    console.log(`❌ Mismatched assignments: ${mismatchCount}`);
    console.log(`⚠️  No tenant assigned: ${noTenantCount}`);

    // Check available tenants
    console.log('\n🏢 Available tenants:');
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, name, status')
      .order('name');

    if (tenantsError) {
      console.error('❌ Error fetching tenants:', tenantsError);
    } else {
      tenants.forEach(tenant => {
        console.log(`   - ${tenant.name} (${tenant.id}) - ${tenant.status}`);
      });
    }

    console.log('\n🔍 Checking student dashboard access requirements...');
    
    // Test the tenant validation that's failing in StudentDashboard
    console.log('\n🧪 Testing tenant validation for first student user...');
    if (studentUsers.length > 0) {
      const testUser = studentUsers[0];
      
      // Get updated user data after fixes
      const { data: updatedUser, error: fetchError } = await supabase
        .from('users')
        .select('id, email, tenant_id, linked_student_id')
        .eq('id', testUser.id)
        .single();
      
      if (fetchError) {
        console.error('❌ Error fetching updated user:', fetchError);
        return;
      }
      
      console.log(`👤 Test user: ${updatedUser.email}`);
      console.log(`🏢 User tenant: ${updatedUser.tenant_id}`);
      
      // Test the exact same query that StudentDashboard uses
      if (updatedUser.tenant_id && updatedUser.linked_student_id) {
        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select('id, class_id, tenant_id')
          .eq('tenant_id', updatedUser.tenant_id)
          .eq('id', updatedUser.linked_student_id)
          .single();
        
        if (studentError) {
          console.error(`❌ Student dashboard query would fail:`, studentError);
        } else {
          console.log(`✅ Student dashboard query would succeed:`, {
            student_id: studentData.id,
            class_id: studentData.class_id,
            tenant_id: studentData.tenant_id
          });
        }
      } else {
        console.log(`❌ User missing required fields:`, {
          has_tenant_id: !!updatedUser.tenant_id,
          has_linked_student_id: !!updatedUser.linked_student_id
        });
      }
    }

  } catch (error) {
    console.error('💥 Fatal error:', error);
  }
}

// Run the check
checkStudentTenantAssignments().then(() => {
  console.log('\n🎯 Tenant assignment check complete!');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
