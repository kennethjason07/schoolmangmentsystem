#!/usr/bin/env node

/**
 * Fix Tenant Name Script
 * 
 * This script checks the current tenant name in the database and allows you to update it
 * if it's showing as "Default School" when it should show the actual school name.
 * 
 * Usage:
 *   node fix_tenant_name.js
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Check current tenant information
 */
async function checkCurrentTenantInfo() {
  console.log('🔍 Checking current tenant information...\n');
  
  try {
    // Get all tenants to see what's in the database
    const { data: tenants, error } = await supabase
      .from('tenants')
      .select('id, name, subdomain, status, created_at')
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('❌ Error fetching tenants:', error.message);
      return;
    }
    
    if (!tenants || tenants.length === 0) {
      console.log('❌ No tenants found in database');
      return;
    }
    
    console.log(`📊 Found ${tenants.length} tenant(s) in database:\n`);
    
    tenants.forEach((tenant, index) => {
      console.log(`${index + 1}. Tenant ID: ${tenant.id}`);
      console.log(`   Name: "${tenant.name}"`);
      console.log(`   Subdomain: ${tenant.subdomain || 'N/A'}`);
      console.log(`   Status: ${tenant.status}`);
      console.log(`   Created: ${tenant.created_at}`);
      console.log('');
    });
    
    // Check the specific tenant mentioned in the logs
    const targetTenantId = 'b8f8b5f0-1234-4567-8901-123456789000';
    const targetTenant = tenants.find(t => t.id === targetTenantId);
    
    if (targetTenant) {
      console.log(`🎯 Target tenant (${targetTenantId}):`);
      console.log(`   Current name: "${targetTenant.name}"`);
      console.log(`   Status: ${targetTenant.status}`);
      
      if (targetTenant.name === 'Default School') {
        console.log('\n⚠️  ISSUE IDENTIFIED:');
        console.log('   The tenant name in the database is actually "Default School"');
        console.log('   This explains why you\'re seeing "Default School" in the app');
        console.log('\n💡 SOLUTION:');
        console.log('   You need to update the tenant name in the database to the correct school name');
        console.log('\n   Example SQL to fix this:');
        console.log(`   UPDATE tenants SET name = 'Your Actual School Name' WHERE id = '${targetTenantId}';`);
      } else {
        console.log('\n✅ Tenant name looks correct!');
        console.log('   The "Default School" issue might be a temporary display issue during loading');
      }
    } else {
      console.log(`❌ Target tenant ${targetTenantId} not found in database`);
    }
    
    return tenants;
    
  } catch (error) {
    console.error('❌ Error checking tenant information:', error.message);
  }
}

/**
 * Update tenant name
 */
async function updateTenantName(tenantId, newName) {
  console.log(`\n🔄 Updating tenant ${tenantId} to name: "${newName}"`);
  
  try {
    const { data, error } = await supabase
      .from('tenants')
      .update({ 
        name: newName,
        updated_at: new Date().toISOString()
      })
      .eq('id', tenantId)
      .select();
    
    if (error) {
      console.error('❌ Error updating tenant:', error.message);
      return false;
    }
    
    if (data && data.length > 0) {
      console.log('✅ Tenant name updated successfully!');
      console.log(`   New name: "${data[0].name}"`);
      console.log('   Please refresh your app to see the changes');
      return true;
    } else {
      console.log('❌ No tenant was updated (tenant ID not found)');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error updating tenant name:', error.message);
    return false;
  }
}

/**
 * Interactive prompt for updating tenant name
 */
async function promptForUpdate() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question('\n❓ Would you like to update the tenant name? (y/n): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase().trim() === 'y' || answer.toLowerCase().trim() === 'yes');
    });
  });
}

/**
 * Get new name from user
 */
async function getNewName() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question('📝 Enter the correct school name: ', (name) => {
      rl.close();
      resolve(name.trim());
    });
  });
}

/**
 * Main function
 */
async function main() {
  console.log('🏫 Tenant Name Checker and Fixer');
  console.log('================================\n');
  
  // Check current tenant info
  const tenants = await checkCurrentTenantInfo();
  
  if (!tenants) {
    console.log('❌ Could not retrieve tenant information');
    process.exit(1);
  }
  
  // Check if we found the "Default School" issue
  const targetTenantId = 'b8f8b5f0-1234-4567-8901-123456789000';
  const targetTenant = tenants.find(t => t.id === targetTenantId);
  
  if (targetTenant && targetTenant.name === 'Default School') {
    const shouldUpdate = await promptForUpdate();
    
    if (shouldUpdate) {
      const newName = await getNewName();
      
      if (newName && newName.length > 0) {
        const success = await updateTenantName(targetTenantId, newName);
        
        if (success) {
          console.log('\n🎉 Success! The tenant name has been updated.');
          console.log('📱 Please refresh your React Native app to see the changes.');
          console.log('🔄 You may need to restart the app completely to clear any cached values.');
        }
      } else {
        console.log('❌ No name provided, operation cancelled');
      }
    } else {
      console.log('Operation cancelled');
    }
  }
  
  console.log('\n🏁 Script completed');
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}