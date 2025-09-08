/**
 * 🔧 USER TENANT ASSIGNMENT FIX SCRIPT
 * 
 * This script helps identify and fix users who are missing tenant_id assignments
 * or assigned to the wrong tenant.
 */

import { supabase } from './src/utils/supabase.js';

async function fixUserTenantAssignments() {
  console.log('🔧 FIXING USER TENANT ASSIGNMENTS');
  console.log('=' .repeat(60));

  try {
    // Step 1: Get all tenants in the system
    console.log('\n📋 STEP 1: Getting all tenants...');
    const { data: allTenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, name, subdomain, status')
      .order('created_at', { ascending: true });

    if (tenantsError) {
      console.error('❌ Error fetching tenants:', tenantsError.message);
      return;
    }

    console.log(`🏢 Found ${allTenants?.length || 0} tenants:`);
    allTenants.forEach((tenant, index) => {
      console.log(`   ${index + 1}. ${tenant.name} (${tenant.subdomain}) - ID: ${tenant.id}`);
    });

    if (!allTenants || allTenants.length === 0) {
      console.log('❌ No tenants found. Please create tenants first.');
      return;
    }

    // Step 2: Get all users and check their tenant assignments
    console.log('\n📋 STEP 2: Checking user tenant assignments...');
    const { data: allUsers, error: usersError } = await supabase
      .from('users')
      .select('id, email, full_name, tenant_id')
      .order('created_at', { ascending: true });

    if (usersError) {
      console.error('❌ Error fetching users:', usersError.message);
      return;
    }

    console.log(`👥 Found ${allUsers?.length || 0} users:`);

    const usersWithoutTenant = [];
    const usersWithInvalidTenant = [];
    const usersWithValidTenant = [];

    allUsers.forEach(user => {
      if (!user.tenant_id) {
        usersWithoutTenant.push(user);
      } else {
        const tenantExists = allTenants.find(t => t.id === user.tenant_id);
        if (tenantExists) {
          usersWithValidTenant.push({ user, tenant: tenantExists });
        } else {
          usersWithInvalidTenant.push(user);
        }
      }
    });

    console.log(`\n📊 User Tenant Assignment Summary:`);
    console.log(`   ✅ Users with valid tenant: ${usersWithValidTenant.length}`);
    console.log(`   ❌ Users without tenant: ${usersWithoutTenant.length}`);
    console.log(`   ⚠️ Users with invalid tenant: ${usersWithInvalidTenant.length}`);

    // Step 3: Show users with valid tenants
    if (usersWithValidTenant.length > 0) {
      console.log('\n✅ USERS WITH VALID TENANT ASSIGNMENTS:');
      usersWithValidTenant.forEach(({ user, tenant }) => {
        console.log(`   👤 ${user.email} → 🏢 ${tenant.name} (${tenant.subdomain})`);
      });
    }

    // Step 4: Show users without tenants
    if (usersWithoutTenant.length > 0) {
      console.log('\n❌ USERS WITHOUT TENANT ASSIGNMENT:');
      usersWithoutTenant.forEach(user => {
        console.log(`   👤 ${user.email} (${user.full_name || 'No name'}) - ID: ${user.id}`);
      });
      
      console.log('\n💡 RECOMMENDATION: Assign these users to appropriate tenants.');
    }

    // Step 5: Show users with invalid tenants
    if (usersWithInvalidTenant.length > 0) {
      console.log('\n⚠️ USERS WITH INVALID TENANT ASSIGNMENT:');
      usersWithInvalidTenant.forEach(user => {
        console.log(`   👤 ${user.email} → ❌ Invalid tenant_id: ${user.tenant_id}`);
      });
      
      console.log('\n💡 RECOMMENDATION: Update these users with valid tenant_ids.');
    }

    // Step 6: Interactive fix (if needed)
    if (usersWithoutTenant.length > 0 || usersWithInvalidTenant.length > 0) {
      console.log('\n🔧 AUTO-FIX OPTIONS:');
      console.log('=' .repeat(40));
      
      // Option 1: Assign all users to the first tenant
      if (allTenants.length === 1) {
        const defaultTenant = allTenants[0];
        console.log(`\n🎯 OPTION 1: Assign all users to the only tenant: ${defaultTenant.name}`);
        console.log('   This is recommended when you have a single-tenant system.');
        
        const usersToFix = [...usersWithoutTenant, ...usersWithInvalidTenant];
        
        for (const user of usersToFix) {
          console.log(`   📝 Would update: ${user.email} → ${defaultTenant.name}`);
        }
        
        console.log('\n🔄 To apply this fix, uncomment the code below and run again:');
        console.log(`/*
        for (const user of usersToFix) {
          const { error: updateError } = await supabase
            .from('users')
            .update({ tenant_id: '${defaultTenant.id}' })
            .eq('id', user.id);
          
          if (updateError) {
            console.error('❌ Error updating user:', user.email, updateError.message);
          } else {
            console.log('✅ Updated user:', user.email);
          }
        }
        */`);
      }
      
      // Option 2: Multiple tenants - manual assignment needed
      else {
        console.log('\n🎯 OPTION 2: Manual tenant assignment (multiple tenants detected)');
        console.log('   You need to manually assign each user to the appropriate tenant.');
        console.log('\n   Example assignment commands:');
        
        const usersToFix = [...usersWithoutTenant, ...usersWithInvalidTenant];
        usersToFix.forEach(user => {
          console.log(`   // Assign ${user.email} to a tenant:`);
          console.log(`   await supabase.from('users').update({ tenant_id: 'TENANT_ID_HERE' }).eq('id', '${user.id}');`);
          console.log('');
        });
      }
    }

    // Step 7: Check for the hardcoded tenant issue
    console.log('\n🔍 STEP 7: Checking for hardcoded tenant issue...');
    const hardcodedTenantId = 'b8f8b5f0-1234-4567-8901-123456789000';
    
    const usersWithHardcodedTenant = allUsers.filter(user => user.tenant_id === hardcodedTenantId);
    const tenantWithHardcodedId = allTenants.find(tenant => tenant.id === hardcodedTenantId);
    
    if (usersWithHardcodedTenant.length > 0) {
      console.log(`⚠️ Found ${usersWithHardcodedTenant.length} users with the hardcoded tenant ID:`);
      console.log(`   Tenant: ${tenantWithHardcodedId?.name || 'UNKNOWN'} (${hardcodedTenantId})`);
      console.log('   Users:');
      usersWithHardcodedTenant.forEach(user => {
        console.log(`   👤 ${user.email}`);
      });
      
      if (!tenantWithHardcodedId) {
        console.log('❌ WARNING: The hardcoded tenant ID does not exist in the tenants table!');
        console.log('   This explains why tenant filtering is not working properly.');
      }
    } else {
      console.log('✅ No users found with the hardcoded tenant ID.');
    }

  } catch (error) {
    console.error('❌ Fix script failed:', error);
  }
}

// Run the fix script
fixUserTenantAssignments()
  .then(() => {
    console.log('\n🏁 User tenant assignment check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fix script failed:', error);
    process.exit(1);
  });

console.log(`
📝 HOW TO USE THIS SCRIPT:

1. Run: node fix_user_tenants.js
2. Review the output to understand tenant assignments
3. If auto-fix options are shown, uncomment the suggested code and run again
4. For manual assignments, use the provided commands
5. After fixing assignments, test the app to ensure tenant isolation works

This script helps ensure every user has a proper tenant_id assignment.
`);
