const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://qtdokdbcuhqkupjqfmxq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0ZG9rZGJjdWhxa3VwanFmbXhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzUxMjMzNDksImV4cCI6MjA1MDY5OTM0OX0.g5Ik5lR1fhd7xz1VNPNGLWXDHhv4GgXXWb1tl2ELMj4';
const supabase = createClient(supabaseUrl, supabaseKey);

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

    if (studentUsers.length === 0) {
      console.log('⚠️  No student users found in the system');
      return;
    }

    // Check each student user's tenant assignments
    let matchCount = 0;
    let mismatchCount = 0;
    let noTenantCount = 0;
    let fixedCount = 0;

    for (const user of studentUsers) {
      console.log(`\n🔍 Checking user: ${user.email}`);
      
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

      console.log(`   User tenant: ${userTenant || 'NULL'}`);
      console.log(`   Student tenant: ${studentTenant || 'NULL'}`);
      console.log(`   Student name: ${studentRecord.name}`);

      if (!userTenant) {
        noTenantCount++;
        console.log(`⚠️  User ${user.email} has NO tenant_id assigned`);
        
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
            fixedCount++;
            noTenantCount--; // Adjust count since we fixed it
          }
        } else {
          console.error(`❌ Student ${studentRecord.name} also has no tenant assigned!`);
        }
      } else if (userTenant === studentTenant) {
        matchCount++;
        console.log(`✅ MATCH: ${user.email} - tenant: ${userTenant}`);
      } else {
        mismatchCount++;
        console.log(`❌ MISMATCH: ${user.email}`);
        
        // Fix this by using the student's tenant
        if (studentTenant) {
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
            fixedCount++;
          }
        }
      }
    }

    console.log('\n📈 Summary:');
    console.log(`✅ Matching assignments: ${matchCount}`);
    console.log(`❌ Mismatched assignments: ${mismatchCount}`);
    console.log(`⚠️  No tenant assigned: ${noTenantCount}`);
    console.log(`🔧 Fixed assignments: ${fixedCount}`);

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
      console.log(`🎓 Linked student ID: ${updatedUser.linked_student_id}`);
      
      // Test the exact same query that StudentDashboard uses
      if (updatedUser.tenant_id && updatedUser.linked_student_id) {
        console.log('🔍 Testing StudentDashboard query pattern...');
        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select('id, class_id, tenant_id, name')
          .eq('tenant_id', updatedUser.tenant_id)
          .eq('id', updatedUser.linked_student_id)
          .single();
        
        if (studentError) {
          console.error(`❌ Student dashboard query would fail:`, studentError);
        } else {
          console.log(`✅ Student dashboard query would succeed:`, {
            student_id: studentData.id,
            student_name: studentData.name,
            class_id: studentData.class_id,
            tenant_id: studentData.tenant_id
          });
          
          // Also test tenant validation function
          console.log('🔍 Testing tenant access validation...');
          
          // Check if tenant exists and is active
          const { data: tenantCheck, error: tenantError } = await supabase
            .from('tenants')
            .select('id, name, status')
            .eq('id', updatedUser.tenant_id)
            .single();
          
          if (tenantError) {
            console.error(`❌ Tenant validation would fail:`, tenantError);
          } else {
            console.log(`✅ Tenant validation would succeed:`, {
              tenant_id: tenantCheck.id,
              tenant_name: tenantCheck.name,
              tenant_status: tenantCheck.status
            });
            
            console.log('\n🎯 CONCLUSION: Student dashboard should work properly now!');
          }
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
}).catch((error) => {
  console.error('💥 Script failed:', error);
});
