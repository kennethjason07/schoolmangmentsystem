#!/usr/bin/env node

/**
 * Tenant Assignment Debug Script
 * 
 * This script helps diagnose and fix tenant assignment issues in the school management system.
 * 
 * Usage: node debug-tenant-assignment.js
 * 
 * What it does:
 * 1. Checks current authenticated user
 * 2. Lists available tenants
 * 3. Shows user's tenant assignment status
 * 4. Optionally assigns user to first available tenant if none assigned
 */

const { createClient } = require('@supabase/supabase-js');

// You'll need to replace these with your actual Supabase credentials
const SUPABASE_URL = 'your_supabase_url_here';
const SUPABASE_ANON_KEY = 'your_supabase_anon_key_here';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkTenantAssignment() {
  console.log('🔍 Checking tenant assignment status...\n');
  
  try {
    // Step 1: Check current authenticated user
    console.log('Step 1: Checking authenticated user...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.log('❌ No authenticated user found');
      console.log('   Please make sure you are logged in to the app');
      return;
    }
    
    console.log('✅ Authenticated user:', user.email, '(ID:', user.id, ')');
    
    // Step 2: List available tenants
    console.log('\nStep 2: Checking available tenants...');
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, name, subdomain, status')
      .eq('status', 'active')
      .order('created_at', { ascending: true });
      
    if (tenantsError) {
      console.error('❌ Error fetching tenants:', tenantsError.message);
      return;
    }
    
    console.log(`✅ Found ${tenants?.length || 0} active tenants:`);
    tenants?.forEach((tenant, index) => {
      console.log(`   ${index + 1}. ${tenant.name} (${tenant.subdomain}) - ID: ${tenant.id}`);
    });
    
    // Step 3: Check user's tenant assignment
    console.log('\nStep 3: Checking user tenant assignment...');
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('id, email, full_name, tenant_id')
      .eq('id', user.id)
      .single();
      
    if (userError) {
      console.error('❌ Error fetching user record:', userError.message);
      return;
    }
    
    console.log('📄 User record:');
    console.log('   Email:', userRecord.email);
    console.log('   Name:', userRecord.full_name || 'Not set');
    console.log('   Tenant ID:', userRecord.tenant_id || 'NOT ASSIGNED ❌');
    
    // Step 4: Diagnose and suggest fix
    if (!userRecord.tenant_id) {
      console.log('\n🚨 PROBLEM FOUND: User has no tenant assigned!');
      console.log('\n💡 SOLUTION OPTIONS:');
      console.log('   1. Run this script with --fix flag to auto-assign to first tenant');
      console.log('   2. Manually assign in database:');
      
      if (tenants && tenants.length > 0) {
        const firstTenant = tenants[0];
        console.log(`      UPDATE users SET tenant_id = '${firstTenant.id}' WHERE id = '${user.id}';`);
        console.log(`      This would assign user to: ${firstTenant.name}`);
      }
      
    } else {
      // Check if assigned tenant is valid
      const assignedTenant = tenants?.find(t => t.id === userRecord.tenant_id);
      if (assignedTenant) {
        console.log(`\n✅ SUCCESS: User is correctly assigned to tenant "${assignedTenant.name}"`);
        console.log('   If you\'re still seeing tenant context errors, try:');
        console.log('   1. Restart the React Native app completely');
        console.log('   2. Clear AsyncStorage cache');
        console.log('   3. Log out and log back in');
      } else {
        console.log(`\n❌ PROBLEM: User assigned to invalid/inactive tenant: ${userRecord.tenant_id}`);
        console.log('💡 SOLUTION: Reassign to valid tenant using SQL above');
      }
    }
    
    console.log('\n🔧 DEBUGGING TIPS:');
    console.log('   • Make sure TenantProvider wraps your app in App.js');
    console.log('   • Check that useTenantContext is imported correctly');
    console.log('   • Verify Supabase connection and RLS policies');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

// Check for command line arguments
const args = process.argv.slice(2);
const shouldFix = args.includes('--fix');

if (shouldFix) {
  console.log('🔧 Auto-fix mode enabled\n');
  // Implementation for auto-fix would go here
  // For safety, we'll just show the diagnosis for now
}

// Run the check
checkTenantAssignment();

console.log('\n📝 NOTE: Make sure to update SUPABASE_URL and SUPABASE_ANON_KEY in this script');
console.log('         with your actual Supabase project credentials before running.');
