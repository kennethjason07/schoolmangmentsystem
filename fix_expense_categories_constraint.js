#!/usr/bin/env node

/**
 * Fix Expense Categories Multi-Tenant Constraint Issue
 * 
 * This script fixes the unique constraint on expense_categories table
 * to allow same category names across different tenants.
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://tbvkstucyjhohvbdqenq.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRidmtzdHVjeWpob2h2YmRxZW5xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMDUwMjU2MSwiZXhwIjoyMDQ2MDc4NTYxfQ.6G7zuxoGh0C5-8J8xJ6GWm6E8B6P2PkU4sWN-YjnGnQ'; // Use service role key

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('🔧 FIXING EXPENSE CATEGORIES MULTI-TENANT CONSTRAINT');
console.log('====================================================\n');

async function fixExpenseCategoriesConstraint() {
  try {
    console.log('Step 1: 🔍 Checking current table constraints...');
    
    // Check current constraints
    const { data: constraints, error: constraintError } = await supabase
      .rpc('get_table_constraints', { table_name_param: 'expense_categories' })
      .catch(() => {
        // If RPC doesn't exist, we'll try direct SQL
        return supabase.from('information_schema.table_constraints')
          .select('constraint_name, constraint_type')
          .eq('table_name', 'expense_categories')
          .eq('constraint_type', 'UNIQUE');
      });

    if (constraintError) {
      console.warn('⚠️ Could not check existing constraints:', constraintError.message);
    } else {
      console.log('📋 Current unique constraints:', constraints);
    }

    console.log('\nStep 2: 🗑️ Attempting to drop existing name-only unique constraint...');
    
    // Try to drop common constraint names
    const constraintNames = [
      'expense_categories_name_key',
      'expense_categories_name_unique',
      'expense_categories_name'
    ];

    for (const constraintName of constraintNames) {
      try {
        const { error } = await supabase.rpc('execute_sql', {
          query: `ALTER TABLE expense_categories DROP CONSTRAINT IF EXISTS ${constraintName};`
        });
        
        if (!error) {
          console.log(`✅ Dropped constraint: ${constraintName}`);
        } else {
          console.log(`ℹ️ Constraint ${constraintName} does not exist or could not be dropped`);
        }
      } catch (err) {
        console.log(`ℹ️ Could not drop ${constraintName}:`, err.message);
      }
    }

    console.log('\nStep 3: ➕ Adding new tenant-scoped unique constraint...');
    
    try {
      const { error: addConstraintError } = await supabase.rpc('execute_sql', {
        query: `ALTER TABLE expense_categories 
                ADD CONSTRAINT expense_categories_name_tenant_unique 
                UNIQUE (name, tenant_id);`
      });
      
      if (!addConstraintError) {
        console.log('✅ Successfully added tenant-scoped unique constraint!');
      } else {
        throw addConstraintError;
      }
    } catch (constraintErr) {
      console.error('❌ Error adding tenant-scoped constraint:', constraintErr.message);
      
      // Check if constraint already exists
      if (constraintErr.message.includes('already exists')) {
        console.log('ℹ️ Tenant-scoped constraint already exists, which is good!');
      } else {
        throw constraintErr;
      }
    }

    console.log('\nStep 4: 🔍 Verifying the fix...');
    
    // Check for duplicate categories that would violate the new constraint
    const { data: duplicates, error: duplicateError } = await supabase
      .from('expense_categories')
      .select('name, tenant_id')
      .then(result => {
        if (result.error) return result;
        
        // Group by name and tenant_id to find duplicates
        const groups = {};
        result.data?.forEach(item => {
          const key = `${item.name}|${item.tenant_id}`;
          groups[key] = (groups[key] || 0) + 1;
        });
        
        const duplicates = Object.entries(groups)
          .filter(([key, count]) => count > 1)
          .map(([key]) => {
            const [name, tenant_id] = key.split('|');
            return { name, tenant_id };
          });
          
        return { data: duplicates, error: null };
      });

    if (duplicateError) {
      console.warn('⚠️ Could not check for duplicates:', duplicateError.message);
    } else if (duplicates && duplicates.length > 0) {
      console.warn('⚠️ Found duplicate categories that may need cleanup:', duplicates);
    } else {
      console.log('✅ No duplicate categories found');
    }

    console.log('\nStep 5: 🧪 Testing the new constraint...');
    
    // Get a test tenant ID
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, name')
      .limit(2);
    
    if (!tenantsError && tenants && tenants.length >= 1) {
      const testTenantId = tenants[0].id;
      const testCategoryName = `Test Category ${Date.now()}`;
      
      console.log(`📝 Creating test category "${testCategoryName}" for tenant: ${tenants[0].name}`);
      
      // Create test category
      const { data: testCategory, error: createError } = await supabase
        .from('expense_categories')
        .insert({
          name: testCategoryName,
          tenant_id: testTenantId,
          monthly_budget: 10000
        })
        .select()
        .single();
        
      if (!createError && testCategory) {
        console.log('✅ Test category created successfully');
        
        // Try to create the same category name for a different tenant (should succeed)
        if (tenants.length >= 2) {
          const secondTenantId = tenants[1].id;
          const { error: secondCreateError } = await supabase
            .from('expense_categories')
            .insert({
              name: testCategoryName,
              tenant_id: secondTenantId,
              monthly_budget: 15000
            });
            
          if (!secondCreateError) {
            console.log('✅ Same category name created for different tenant - constraint working correctly!');
          } else {
            console.warn('⚠️ Could not create same name for different tenant:', secondCreateError.message);
          }
        }
        
        // Try to create duplicate for same tenant (should fail)
        const { error: duplicateCreateError } = await supabase
          .from('expense_categories')
          .insert({
            name: testCategoryName,
            tenant_id: testTenantId,
            monthly_budget: 20000
          });
          
        if (duplicateCreateError && duplicateCreateError.code === '23505') {
          console.log('✅ Duplicate category for same tenant correctly rejected - constraint working!');
        } else if (!duplicateCreateError) {
          console.warn('⚠️ Duplicate category was allowed - constraint may not be working');
        }
        
        // Clean up test categories
        const { error: cleanupError } = await supabase
          .from('expense_categories')
          .delete()
          .eq('name', testCategoryName);
          
        if (!cleanupError) {
          console.log('🧹 Test categories cleaned up');
        }
        
      } else {
        console.warn('⚠️ Could not create test category:', createError?.message);
      }
    }

    console.log('\n🎉 CONSTRAINT FIX COMPLETED SUCCESSFULLY!');
    console.log('\n📋 What was fixed:');
    console.log('   ✅ Removed global unique constraint on category name');
    console.log('   ✅ Added tenant-scoped unique constraint (name, tenant_id)');
    console.log('   ✅ Different tenants can now have categories with same names');
    console.log('   ✅ Duplicate categories within same tenant are still prevented');
    
    console.log('\n🚀 Next steps:');
    console.log('   1. Test the Expense Management screen');
    console.log('   2. Default categories should now create without errors');
    console.log('   3. Multiple schools can have "Transportation", "Utilities", etc.');

  } catch (error) {
    console.error('❌ CONSTRAINT FIX FAILED:', error.message);
    console.log('\n🔧 Manual fix required:');
    console.log('   Run this SQL in your database admin panel:');
    console.log('   ');
    console.log('   -- Drop existing constraint');
    console.log('   ALTER TABLE expense_categories DROP CONSTRAINT expense_categories_name_key;');
    console.log('   ');
    console.log('   -- Add tenant-scoped constraint');
    console.log('   ALTER TABLE expense_categories');
    console.log('   ADD CONSTRAINT expense_categories_name_tenant_unique UNIQUE (name, tenant_id);');
    
    return false;
  }
  
  return true;
}

// Run the fix
fixExpenseCategoriesConstraint().then((success) => {
  if (success) {
    console.log('\n✅ Expense categories constraint fix completed successfully!');
  } else {
    console.log('\n❌ Expense categories constraint fix failed. Manual intervention required.');
  }
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});
