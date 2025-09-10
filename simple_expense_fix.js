#!/usr/bin/env node

/**
 * Simple Expense Categories Constraint Test
 * This script tests and demonstrates the multi-tenant constraint issue
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration  
const supabaseUrl = 'https://tbvkstucyjhohvbdqenq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRidmtzdHVjeWpob2h2YmRxZW5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA1MDI1NjEsImV4cCI6MjA0NjA3ODU2MX0.iGCMgqZGtJ4lfKOqy3z8Rlr_Ww-p1H4PKOBvEPhNBUk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('🔧 EXPENSE CATEGORIES MULTI-TENANT ISSUE DIAGNOSIS');
console.log('=================================================\n');

async function diagnoseExpenseIssue() {
  try {
    // Check current expense categories
    console.log('📊 Current expense categories in database:');
    const { data: categories, error: categoryError } = await supabase
      .from('expense_categories')
      .select('id, name, tenant_id, monthly_budget')
      .order('name');
    
    if (categoryError) {
      console.error('❌ Error fetching categories:', categoryError);
      return;
    }
    
    console.log(`Found ${categories?.length || 0} categories:`);
    
    // Group by name to show the issue
    const nameGroups = {};
    categories?.forEach(cat => {
      if (!nameGroups[cat.name]) nameGroups[cat.name] = [];
      nameGroups[cat.name].push(cat);
    });
    
    console.log('\n📋 Categories grouped by name:');
    Object.entries(nameGroups).forEach(([name, cats]) => {
      console.log(`  "${name}":`);
      cats.forEach(cat => {
        console.log(`    - Tenant: ${cat.tenant_id} | Budget: ₹${cat.monthly_budget || 0}`);
      });
      
      if (cats.length > 1) {
        const uniqueTenants = new Set(cats.map(c => c.tenant_id));
        if (uniqueTenants.size > 1) {
          console.log(`    ✅ Multiple tenants using same name (${uniqueTenants.size} tenants)`);
        } else {
          console.log(`    ⚠️ Duplicate name in same tenant`);
        }
      }
    });
    
    // Check tenants
    console.log('\n🏢 Available tenants:');
    const { data: tenants, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name')
      .order('name');
      
    if (!tenantError && tenants) {
      tenants.forEach((tenant, index) => {
        const tenantCategories = categories?.filter(c => c.tenant_id === tenant.id) || [];
        console.log(`  ${index + 1}. ${tenant.name} (${tenant.id}) - ${tenantCategories.length} categories`);
      });
    }
    
    // Test creating a category
    console.log('\n🧪 Testing category creation:');
    
    if (tenants && tenants.length > 0) {
      const testTenantId = tenants[0].id;
      const testName = `Test Category ${Date.now()}`;
      
      console.log(`Attempting to create "${testName}" for tenant: ${tenants[0].name}`);
      
      const { data: newCategory, error: createError } = await supabase
        .from('expense_categories')
        .insert({
          name: testName,
          tenant_id: testTenantId,
          monthly_budget: 50000
        })
        .select()
        .single();
        
      if (createError) {
        console.log('❌ Creation failed:', createError.message);
        console.log('   Code:', createError.code);
        
        if (createError.code === '23505') {
          console.log('   🔍 This is the unique constraint violation we need to fix!');
        }
      } else {
        console.log('✅ Category created successfully:', newCategory.name);
        
        // Clean up
        await supabase
          .from('expense_categories')
          .delete()
          .eq('id', newCategory.id);
        console.log('🧹 Test category cleaned up');
      }
    }
    
    console.log('\n💡 SOLUTION NEEDED:');
    console.log('   The database needs this SQL command run by an admin:');
    console.log('   ');
    console.log('   -- Drop current global unique constraint');
    console.log('   ALTER TABLE expense_categories DROP CONSTRAINT expense_categories_name_key;');
    console.log('   ');
    console.log('   -- Add tenant-scoped unique constraint');
    console.log('   ALTER TABLE expense_categories');
    console.log('   ADD CONSTRAINT expense_categories_name_tenant_unique UNIQUE (name, tenant_id);');
    console.log('   ');
    console.log('   This will allow different schools to have the same category names!');
    
  } catch (error) {
    console.error('❌ Diagnosis failed:', error);
  }
}

// Run diagnosis
diagnoseExpenseIssue().then(() => {
  console.log('\n✅ Diagnosis complete. Check the output above for the solution.');
}).catch(error => {
  console.error('💥 Unexpected error:', error);
});
