const { createClient } = require('@supabase/supabase-js');

// Your Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY1NDYxMSwiZXhwIjoyMDY4MjMwNjExfQ.OZnmr5e_hxbAKu-5WmTDGFXrLqTgLNpNwY3uNqRjJGY';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function diagnoseAzherUser() {
  console.log('🔍 DIAGNOSING azherpa84@gmail.com USER...\n');
  
  const userEmail = 'azherpa84@gmail.com';
  
  try {
    // Step 1: Check if user exists in auth.users
    console.log('1. 🔐 Checking Supabase Auth Users...');
    const { data: { users: authUsers }, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Error listing auth users:', authError);
    } else {
      const authUser = authUsers.find(u => u.email === userEmail);
      if (authUser) {
        console.log('✅ Found in auth.users:');
        console.log(`   - ID: ${authUser.id}`);
        console.log(`   - Email: ${authUser.email}`);
        console.log(`   - Created: ${authUser.created_at}`);
        console.log(`   - Email Confirmed: ${authUser.email_confirmed_at ? 'Yes' : 'No'}`);
        console.log(`   - Last Sign In: ${authUser.last_sign_in_at || 'Never'}`);
        
        // Check auth metadata
        if (authUser.raw_user_meta_data) {
          console.log('   - Auth Metadata:', JSON.stringify(authUser.raw_user_meta_data, null, 2));
        }
      } else {
        console.log('❌ NOT found in auth.users');
      }
    }
    
    // Step 2: Check if user exists in public.users table
    console.log('\n2. 🗄️ Checking Public Users Table...');
    const { data: dbUsers, error: dbError } = await supabaseAdmin
      .from('users')
      .select('id, email, tenant_id, role_id, full_name, created_at')
      .eq('email', userEmail);
    
    if (dbError) {
      console.error('❌ Error querying users table:', dbError);
    } else if (dbUsers.length === 0) {
      console.log('❌ NOT found in public.users table');
    } else {
      console.log(`✅ Found ${dbUsers.length} record(s) in public.users:`);
      dbUsers.forEach((user, index) => {
        console.log(`   ${index + 1}. User:`);
        console.log(`      - ID: ${user.id}`);
        console.log(`      - Email: ${user.email}`);
        console.log(`      - Tenant ID: ${user.tenant_id}`);
        console.log(`      - Role ID: ${user.role_id}`);
        console.log(`      - Full Name: ${user.full_name}`);
        console.log(`      - Created: ${user.created_at}`);
      });
      
      // Get tenant info for this user
      if (dbUsers[0]?.tenant_id) {
        const { data: tenant, error: tenantError } = await supabaseAdmin
          .from('tenants')
          .select('id, name, subdomain, status')
          .eq('id', dbUsers[0].tenant_id)
          .single();
          
        if (tenantError) {
          console.log('❌ Error getting tenant info:', tenantError);
        } else {
          console.log(`   👥 Assigned to tenant: ${tenant.name} (${tenant.subdomain})`);
        }
      }
    }
    
    // Step 3: Check all available tenants
    console.log('\n3. 🏢 Available Tenants:');
    const { data: tenants, error: tenantsError } = await supabaseAdmin
      .from('tenants')
      .select('id, name, subdomain, status, created_at')
      .order('created_at', { ascending: true });
      
    if (tenantsError) {
      console.error('❌ Error querying tenants:', tenantsError);
    } else {
      tenants.forEach((tenant, index) => {
        console.log(`   ${index + 1}. ${tenant.name}`);
        console.log(`      - ID: ${tenant.id}`);
        console.log(`      - Subdomain: ${tenant.subdomain}`);
        console.log(`      - Status: ${tenant.status}`);
        console.log(`      - Created: ${tenant.created_at}`);
      });
    }
    
    // Step 4: Check data distribution
    console.log('\n4. 📊 Data Distribution Across Tenants:');
    
    const tables = ['students', 'classes', 'teachers', 'school_details'];
    
    for (const table of tables) {
      try {
        const { data: records, error } = await supabaseAdmin
          .from(table)
          .select('tenant_id')
          .not('tenant_id', 'is', null);
          
        if (!error && records) {
          const tenantCounts = records.reduce((acc, record) => {
            acc[record.tenant_id] = (acc[record.tenant_id] || 0) + 1;
            return acc;
          }, {});
          
          console.log(`   📋 ${table.toUpperCase()}:`);
          if (Object.keys(tenantCounts).length === 0) {
            console.log('      - No data found');
          } else {
            Object.entries(tenantCounts).forEach(([tenantId, count]) => {
              const tenant = tenants.find(t => t.id === tenantId);
              const tenantName = tenant ? tenant.name : 'Unknown Tenant';
              console.log(`      - ${tenantName}: ${count} records`);
            });
          }
        }
      } catch (error) {
        console.log(`   ❌ Error checking ${table}:`, error.message);
      }
    }
    
    // Step 5: Recommendations
    console.log('\n' + '='.repeat(80));
    console.log('💡 DIAGNOSIS SUMMARY & RECOMMENDATIONS:');
    console.log('='.repeat(80));
    
    const dbUser = dbUsers?.[0];
    if (!dbUser) {
      console.log('\n🚨 ISSUE: User azherpa84@gmail.com does not exist in the users table.');
      console.log('✅ SOLUTION: User needs to complete the signup process or be manually added.');
    } else if (dbUser.tenant_id === 'b8f8b5f0-1234-4567-8901-123456789000') {
      console.log('\n🚨 ISSUE: User is assigned to the default tenant (main school).');
      console.log('✅ SOLUTION: Create a new tenant for this user or reassign to appropriate tenant.');
    } else {
      console.log('\n✅ User has a proper tenant assignment.');
    }
    
    console.log('\n🔧 NEXT STEPS:');
    console.log('1. Create a new tenant specifically for azherpa84@gmail.com');
    console.log('2. Update the user\'s tenant_id to the new tenant');
    console.log('3. Update the auth.users metadata to include the correct tenant_id');
    console.log('4. Verify RLS policies are working correctly');
    
  } catch (error) {
    console.error('❌ Diagnosis failed:', error);
  }
}

// Run the diagnosis
if (require.main === module) {
  diagnoseAzherUser().then(() => {
    console.log('\n🏁 Diagnosis complete');
    process.exit(0);
  }).catch(err => {
    console.error('❌ Diagnosis failed:', err);
    process.exit(1);
  });
}

module.exports = { diagnoseAzherUser };
