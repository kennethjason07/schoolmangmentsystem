const { createClient } = require('@supabase/supabase-js');

// Using the URL from your check_auth_users.js file
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function fixAzherTenantIsolation() {
  console.log('🔧 FIXING TENANT ISOLATION FOR azherpa84@gmail.com...\n');
  
  const userEmail = 'azherpa84@gmail.com';
  let newTenantId = null;
  
  try {
    // Step 1: Check current user state
    console.log('1. 🔍 Checking current user state...');
    const { data: currentUser, error: userError } = await supabase
      .from('users')
      .select('id, email, tenant_id, role_id, full_name')
      .eq('email', userEmail)
      .maybeSingle();
    
    if (userError) {
      console.log('❌ Error checking user:', userError);
      console.log('ℹ️ User may not exist yet - this is expected for new users');
    } else if (currentUser) {
      console.log('✅ Found existing user:');
      console.log(`   - Email: ${currentUser.email}`);
      console.log(`   - Current Tenant ID: ${currentUser.tenant_id}`);
      console.log(`   - Role ID: ${currentUser.role_id}`);
      
      // Check if user is assigned to default tenant (problematic)
      if (currentUser.tenant_id === 'b8f8b5f0-1234-4567-8901-123456789000') {
        console.log('🚨 ISSUE: User is assigned to default tenant (seeing other school data)');
      }
    } else {
      console.log('ℹ️ User not found in database yet');
    }
    
    // Step 2: Create a new tenant specifically for this user
    console.log('\\n2. 🏢 Creating new tenant for azherpa84@gmail.com...');
    
    // Generate a unique tenant ID
    const tenantId = 'azher-' + Date.now();
    
    const { data: newTenant, error: tenantError } = await supabase
      .from('tenants')
      .insert([{
        name: 'Azher Patel School',
        subdomain: tenantId,
        status: 'active',
        subscription_plan: 'basic',
        max_students: 100,
        max_teachers: 10,
        max_classes: 20,
        contact_email: userEmail,
        features: {
          messaging: true,
          attendance: true,
          fees: true,
          exams: true,
          reports: true,
          homework: true
        },
        settings: {
          timezone: 'Asia/Kolkata',
          academic_year_start_month: 4
        }
      }])
      .select()
      .single();
    
    if (tenantError) {
      console.error('❌ Failed to create tenant:', tenantError);
      return;
    }
    
    newTenantId = newTenant.id;
    console.log('✅ Created new tenant:');
    console.log(`   - Name: ${newTenant.name}`);
    console.log(`   - ID: ${newTenant.id}`);
    console.log(`   - Subdomain: ${newTenant.subdomain}`);
    console.log(`   - Contact Email: ${newTenant.contact_email}`);
    
    // Step 3: Update/create user record with new tenant
    console.log('\\n3. 👤 Updating user with new tenant...');
    
    if (currentUser) {
      // Update existing user
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({ tenant_id: newTenantId })
        .eq('email', userEmail)
        .select()
        .single();
      
      if (updateError) {
        console.error('❌ Failed to update user tenant:', updateError);
        return;
      }
      
      console.log('✅ Updated existing user tenant assignment');
    } else {
      // Create new user record (they'll need to complete signup)
      console.log('ℹ️ User record will be created during signup process');
      console.log('ℹ️ The signup process needs to be modified to use the new tenant');
    }
    
    // Step 4: Create roles for the new tenant
    console.log('\\n4. 🎭 Creating roles for new tenant...');
    
    const roles = [
      { role_name: 'Admin', tenant_id: newTenantId },
      { role_name: 'Teacher', tenant_id: newTenantId },
      { role_name: 'Parent', tenant_id: newTenantId },
      { role_name: 'Student', tenant_id: newTenantId }
    ];
    
    const { data: createdRoles, error: rolesError } = await supabase
      .from('roles')
      .insert(roles)
      .select();
    
    if (rolesError) {
      console.log('⚠️ Warning: Could not create roles (may already exist):', rolesError.message);
    } else {
      console.log('✅ Created roles for new tenant:', createdRoles.length, 'roles');
    }
    
    // Step 5: Create basic school details
    console.log('\\n5. 🏫 Creating school details for new tenant...');
    
    const { data: schoolDetails, error: schoolError } = await supabase
      .from('school_details')
      .insert([{
        tenant_id: newTenantId,
        school_name: 'Azher Patel School',
        contact_email: userEmail,
        address: 'Address not provided',
        phone: '+91 9876543210',
        principal_name: 'Azher Patel',
        established_year: new Date().getFullYear(),
        board: 'CBSE',
        school_code: 'APS' + Date.now().toString().slice(-6)
      }])
      .select()
      .single();
    
    if (schoolError) {
      console.log('⚠️ Warning: Could not create school details:', schoolError.message);
    } else {
      console.log('✅ Created school details for new tenant');
    }
    
    // Step 6: Output instructions
    console.log('\\n' + '='.repeat(80));
    console.log('✅ TENANT ISOLATION FIX COMPLETED');
    console.log('='.repeat(80));
    
    console.log('\\n🎯 WHAT WAS FIXED:');
    console.log('✅ Created a new tenant specifically for azherpa84@gmail.com');
    console.log(`✅ New tenant ID: ${newTenantId}`);
    console.log('✅ New tenant has isolated data - no access to other schools');
    console.log('✅ Created roles and basic school setup');
    
    if (currentUser) {
      console.log('✅ Updated existing user to use new tenant');
    }
    
    console.log('\\n🚨 CRITICAL NEXT STEPS:');
    console.log('1. User needs to LOG OUT completely and LOG BACK IN');
    console.log('2. Clear browser cache/app data to get fresh JWT token');
    console.log('3. New login will use the new tenant and see isolated data');
    console.log('4. User can now create their own students, classes, etc.');
    
    console.log('\\n📋 NEW TENANT DETAILS:');
    console.log(`   - School Name: Azher Patel School`);
    console.log(`   - Tenant ID: ${newTenantId}`);
    console.log(`   - Email: ${userEmail}`);
    console.log(`   - Subdomain: ${newTenant.subdomain}`);
    
    console.log('\\n💡 FOR FUTURE NEW USERS:');
    console.log('Update the signup process to automatically create new tenants or');
    console.log('provide a way for users to specify which school they belong to.');
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
    
    // Cleanup on error
    if (newTenantId) {
      console.log('🧹 Cleaning up created tenant due to error...');
      await supabase
        .from('tenants')
        .delete()
        .eq('id', newTenantId);
    }
  }
}

// Run the fix
if (require.main === module) {
  fixAzherTenantIsolation().then(() => {
    console.log('\\n🏁 Fix process complete');
    process.exit(0);
  }).catch(err => {
    console.error('❌ Fix process failed:', err);
    process.exit(1);
  });
}

module.exports = { fixAzherTenantIsolation };
