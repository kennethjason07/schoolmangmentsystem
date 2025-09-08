#!/usr/bin/env node

/**
 * Expense Management Tenant Diagnostic Script
 * 
 * This script helps diagnose and verify tenant-specific data isolation
 * for the expense management system.
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('🔍 EXPENSE MANAGEMENT TENANT DIAGNOSTIC');
console.log('========================================\n');

async function runDiagnostic() {
  try {
    console.log('1. 📊 CHECKING ALL EXPENSE DATA IN DATABASE');
    console.log('-------------------------------------------');
    
    // Get all expenses without tenant filtering
    const { data: allExpenses, error: expenseError } = await supabase
      .from('school_expenses')
      .select('id, title, amount, tenant_id, expense_date, category, created_at')
      .order('created_at', { ascending: false });

    if (expenseError) {
      console.error('❌ Error fetching expenses:', expenseError.message);
      return;
    }

    console.log(`📈 Total expenses in database: ${allExpenses?.length || 0}`);
    
    if (allExpenses && allExpenses.length > 0) {
      // Group expenses by tenant_id
      const expensesByTenant = {};
      allExpenses.forEach(expense => {
        const tenantId = expense.tenant_id || 'null';
        if (!expensesByTenant[tenantId]) {
          expensesByTenant[tenantId] = [];
        }
        expensesByTenant[tenantId].push(expense);
      });

      console.log('\n📋 Expenses grouped by tenant_id:');
      Object.keys(expensesByTenant).forEach(tenantId => {
        const expenses = expensesByTenant[tenantId];
        console.log(`  🏢 Tenant ${tenantId}: ${expenses.length} expenses`);
        
        // Show sample expenses for this tenant
        expenses.slice(0, 3).forEach(expense => {
          console.log(`    - ${expense.title} (₹${expense.amount}) - ${expense.expense_date}`);
        });
        
        if (expenses.length > 3) {
          console.log(`    ... and ${expenses.length - 3} more`);
        }
      });
      
      // Check for data leakage indicators
      const tenantIds = Object.keys(expensesByTenant);
      if (tenantIds.length > 1) {
        console.log('\n⚠️  POTENTIAL DATA LEAKAGE DETECTED:');
        console.log(`   Found expenses for ${tenantIds.length} different tenant_ids`);
        console.log(`   Tenant IDs: ${tenantIds.join(', ')}`);
      } else {
        console.log('\n✅ GOOD: All expenses belong to the same tenant');
      }
    } else {
      console.log('ℹ️  No expenses found in database');
    }

    console.log('\n\n2. 🏢 CHECKING EXPENSE CATEGORIES');
    console.log('----------------------------------');
    
    // Get all expense categories
    const { data: allCategories, error: categoryError } = await supabase
      .from('expense_categories')
      .select('id, name, monthly_budget, tenant_id, created_at')
      .order('created_at', { ascending: false });

    if (categoryError) {
      console.error('❌ Error fetching categories:', categoryError.message);
    } else {
      console.log(`📋 Total expense categories: ${allCategories?.length || 0}`);
      
      if (allCategories && allCategories.length > 0) {
        // Group categories by tenant_id
        const categoriesByTenant = {};
        allCategories.forEach(category => {
          const tenantId = category.tenant_id || 'null';
          if (!categoriesByTenant[tenantId]) {
            categoriesByTenant[tenantId] = [];
          }
          categoriesByTenant[tenantId].push(category);
        });

        console.log('\n📋 Categories grouped by tenant_id:');
        Object.keys(categoriesByTenant).forEach(tenantId => {
          const categories = categoriesByTenant[tenantId];
          console.log(`  🏢 Tenant ${tenantId}: ${categories.length} categories`);
          
          categories.forEach(category => {
            console.log(`    - ${category.name} (Budget: ₹${category.monthly_budget || 0})`);
          });
        });
      }
    }

    console.log('\n\n3. 👤 CHECKING USER CONTEXT');
    console.log('----------------------------');
    
    // Check current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.log('❌ No authenticated user found');
      console.log('ℹ️  To test tenant filtering, you need to be logged in');
    } else {
      console.log(`✅ Authenticated user: ${user.email}`);
      
      // Check user's tenant_id from users table
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('tenant_id, email, id')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.log('❌ Error fetching user profile:', profileError.message);
      } else if (userProfile) {
        console.log(`🏢 User's tenant_id: ${userProfile.tenant_id}`);
        
        // Test tenant-aware expense query
        console.log('\n4. 🧪 TESTING TENANT-AWARE EXPENSE QUERY');
        console.log('----------------------------------------');
        
        const { data: tenantExpenses, error: tenantError } = await supabase
          .from('school_expenses')
          .select('id, title, amount, tenant_id, expense_date')
          .eq('tenant_id', userProfile.tenant_id)
          .order('expense_date', { ascending: false });

        if (tenantError) {
          console.error('❌ Error in tenant-aware query:', tenantError.message);
        } else {
          console.log(`✅ Tenant-filtered expenses: ${tenantExpenses?.length || 0}`);
          
          if (tenantExpenses && tenantExpenses.length > 0) {
            console.log('\n📊 Sample tenant-filtered expenses:');
            tenantExpenses.slice(0, 5).forEach(expense => {
              console.log(`  - ${expense.title} (₹${expense.amount}) - Tenant: ${expense.tenant_id}`);
            });
            
            // Verify all expenses belong to the correct tenant
            const wrongTenantExpenses = tenantExpenses.filter(exp => exp.tenant_id !== userProfile.tenant_id);
            if (wrongTenantExpenses.length > 0) {
              console.log('\n❌ DATA LEAKAGE DETECTED:');
              console.log(`   Found ${wrongTenantExpenses.length} expenses with wrong tenant_id`);
              wrongTenantExpenses.forEach(expense => {
                console.log(`   - ${expense.title}: Expected ${userProfile.tenant_id}, got ${expense.tenant_id}`);
              });
            } else {
              console.log('\n✅ GOOD: All expenses have correct tenant_id');
            }
          }
        }
      } else {
        console.log('❌ User profile not found in users table');
      }
    }

    console.log('\n\n5. 🏗️ TESTING TABLE STRUCTURE');
    console.log('------------------------------');
    
    // Check table structure for tenant_id column
    const tables = ['school_expenses', 'expense_categories'];
    
    for (const table of tables) {
      console.log(`\n🔍 Checking ${table} table structure:`);
      
      // Try to get one record to check column structure
      const { data: sampleData, error: sampleError } = await supabase
        .from(table)
        .select('*')
        .limit(1);

      if (sampleError) {
        console.log(`❌ Error accessing ${table}:`, sampleError.message);
      } else if (sampleData && sampleData.length > 0) {
        const columns = Object.keys(sampleData[0]);
        console.log(`  📋 Columns: ${columns.join(', ')}`);
        
        if (columns.includes('tenant_id')) {
          console.log('  ✅ tenant_id column exists');
        } else {
          console.log('  ❌ tenant_id column MISSING');
        }
      } else {
        console.log(`  ℹ️  ${table} table is empty`);
      }
    }

    console.log('\n\n6. 🔄 TESTING API FUNCTIONS (if user is authenticated)');
    console.log('-----------------------------------------------------');
    
    if (user && userProfile && userProfile.tenant_id) {
      console.log('Testing getExpenses function behavior...');
      
      // Test date range for current month
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      const startDate = startOfMonth.toISOString().split('T')[0];
      const endDate = endOfMonth.toISOString().split('T')[0];
      
      console.log(`📅 Testing date range: ${startDate} to ${endDate}`);
      console.log(`🏢 Expected tenant filtering: ${userProfile.tenant_id}`);
      
      // This would test the actual API functions if imported properly
      console.log('\nℹ️  To test the API functions, run this in the application context');
      console.log('    where the dbHelpers are available');
    }

    console.log('\n\n7. 📝 DIAGNOSTIC SUMMARY');
    console.log('------------------------');
    
    if (allExpenses && allExpenses.length > 0) {
      const uniqueTenants = [...new Set(allExpenses.map(e => e.tenant_id))].filter(t => t);
      if (uniqueTenants.length > 1) {
        console.log('❌ CRITICAL: Multiple tenants detected in expense data');
        console.log(`   Tenants found: ${uniqueTenants.join(', ')}`);
        console.log('   🔧 SOLUTION: Apply the tenant filtering fixes to getExpenses function');
      } else if (uniqueTenants.length === 1) {
        console.log('✅ GOOD: All expenses belong to single tenant:', uniqueTenants[0]);
      } else {
        console.log('⚠️  WARNING: No tenant_id values found in expenses');
      }
    }

    console.log('\n✅ DIAGNOSTIC COMPLETE');
    console.log('\n🔧 RECOMMENDED ACTIONS:');
    console.log('  1. Apply the tenant filtering fixes to getExpenses functions');
    console.log('  2. Test the Expense Management screen with the fixes');
    console.log('  3. Verify that only your tenant\'s expenses are shown');
    console.log('  4. Check browser console for the new debug logs');
    
  } catch (error) {
    console.error('❌ Diagnostic failed:', error.message);
  }
}

// Run the diagnostic
runDiagnostic().then(() => {
  console.log('\n🏁 Diagnostic complete. You can now test the application.');
}).catch(error => {
  console.error('Fatal error:', error);
});
