/**
 * 🔍 TENANT DATA DEBUGGING SCRIPT
 * 
 * This script helps diagnose tenant data isolation issues in the stationary management system.
 * Run this to check if data is properly isolated between tenants.
 */

const { supabase } = require('./src/utils/supabase.js');

async function debugTenantData() {
  console.log('🔍 DEBUGGING TENANT DATA ISOLATION');
  console.log('=' .repeat(60));

  try {
    // Step 1: Check current user and tenant information
    console.log('\n📋 STEP 1: Current User & Tenant Info');
    console.log('-'.repeat(40));
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.log('❌ No authenticated user found');
      return;
    }
    
    console.log('👤 Current User:', {
      id: user.id,
      email: user.email
    });

    // Get user's tenant info
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('id, email, full_name, tenant_id')
      .eq('id', user.id)
      .single();
    
    if (userError) {
      console.log('❌ Error fetching user record:', userError.message);
    } else {
      console.log('🏢 User Tenant Info:', userRecord);
    }

    // Step 2: Check all tenants in the system
    console.log('\n📋 STEP 2: All Tenants in System');
    console.log('-'.repeat(40));
    
    const { data: allTenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, name, subdomain, status');
    
    if (tenantsError) {
      console.log('❌ Error fetching tenants:', tenantsError.message);
    } else {
      console.log('🏢 All Tenants:');
      allTenants.forEach((tenant, index) => {
        const isCurrentUserTenant = tenant.id === userRecord?.tenant_id;
        console.log(`   ${index + 1}. ${tenant.name} (${tenant.subdomain}) - ID: ${tenant.id} ${isCurrentUserTenant ? '← YOUR TENANT' : ''}`);
      });
    }

    // Step 3: Check stationary items by tenant
    console.log('\n📋 STEP 3: Stationary Items by Tenant');
    console.log('-'.repeat(40));
    
    for (const tenant of allTenants || []) {
      const { data: items, error: itemsError } = await supabase
        .from('stationary_items')
        .select('id, name, fee_amount, tenant_id, created_at')
        .eq('tenant_id', tenant.id);
      
      if (itemsError) {
        console.log(`❌ Error fetching items for tenant ${tenant.name}:`, itemsError.message);
      } else {
        const isCurrentUserTenant = tenant.id === userRecord?.tenant_id;
        console.log(`\n📦 Tenant: ${tenant.name} ${isCurrentUserTenant ? '(YOUR TENANT)' : ''}`);
        console.log(`   Items: ${items?.length || 0}`);
        
        if (items && items.length > 0) {
          items.slice(0, 3).forEach((item, index) => {
            console.log(`   ${index + 1}. ${item.name} - ₹${item.fee_amount} (ID: ${item.id})`);
          });
          if (items.length > 3) {
            console.log(`   ... and ${items.length - 3} more items`);
          }
        }
        
        // Check if wrong tenant data is showing
        if (!isCurrentUserTenant && items && items.length > 0) {
          console.log('   ⚠️  WARNING: This tenant has items, but it\'s not your tenant!');
        }
      }
    }

    // Step 4: Check stationary purchases by tenant
    console.log('\n📋 STEP 4: Stationary Purchases by Tenant');
    console.log('-'.repeat(40));
    
    for (const tenant of allTenants || []) {
      const { data: purchases, error: purchasesError } = await supabase
        .from('stationary_purchases')
        .select(`
          id, 
          total_amount, 
          payment_date, 
          tenant_id,
          students(name),
          stationary_items(name)
        `)
        .eq('tenant_id', tenant.id);
      
      if (purchasesError) {
        console.log(`❌ Error fetching purchases for tenant ${tenant.name}:`, purchasesError.message);
      } else {
        const isCurrentUserTenant = tenant.id === userRecord?.tenant_id;
        console.log(`\n💳 Tenant: ${tenant.name} ${isCurrentUserTenant ? '(YOUR TENANT)' : ''}`);
        console.log(`   Purchases: ${purchases?.length || 0}`);
        
        if (purchases && purchases.length > 0) {
          purchases.slice(0, 3).forEach((purchase, index) => {
            console.log(`   ${index + 1}. ${purchase.students?.name} - ${purchase.stationary_items?.name} - ₹${purchase.total_amount}`);
          });
          if (purchases.length > 3) {
            console.log(`   ... and ${purchases.length - 3} more purchases`);
          }
        }
        
        // Check if wrong tenant data is showing
        if (!isCurrentUserTenant && purchases && purchases.length > 0) {
          console.log('   ⚠️  WARNING: This tenant has purchases, but it\'s not your tenant!');
        }
      }
    }

    // Step 5: Test the exact query that StationaryService uses
    console.log('\n📋 STEP 5: Testing StationaryService Queries');
    console.log('-'.repeat(40));
    
    if (userRecord?.tenant_id) {
      console.log(`🔍 Testing queries for your tenant: ${userRecord.tenant_id}`);
      
      // Test getStationaryItems query
      const { data: testItems, error: testItemsError } = await supabase
        .from('stationary_items')
        .select('*')
        .eq('tenant_id', userRecord.tenant_id)
        .eq('is_active', true)
        .order('name', { ascending: true });
      
      console.log('📦 getStationaryItems test result:', {
        itemsFound: testItems?.length || 0,
        tenantId: userRecord.tenant_id,
        error: testItemsError?.message,
        firstItem: testItems?.[0]
      });
      
      // Test getPurchases query  
      const { data: testPurchases, error: testPurchasesError } = await supabase
        .from('stationary_purchases')
        .select(`
          *,
          students(name, admission_no, class_id),
          stationary_items(name, fee_amount)
        `)
        .eq('tenant_id', userRecord.tenant_id)
        .order('payment_date', { ascending: false });
      
      console.log('💳 getPurchases test result:', {
        purchasesFound: testPurchases?.length || 0,
        tenantId: userRecord.tenant_id,
        error: testPurchasesError?.message,
        firstPurchase: testPurchases?.[0]
      });
    }

    // Step 6: Summary and recommendations
    console.log('\n📋 STEP 6: SUMMARY & RECOMMENDATIONS');
    console.log('-'.repeat(40));
    
    console.log('✅ Diagnostic completed. Check the output above for:');
    console.log('   1. Your current tenant ID');
    console.log('   2. Whether other tenants have data that you shouldn\'t see');
    console.log('   3. If the StationaryService queries return correct data');
    console.log('   4. Any error messages that might indicate permission issues');
    
    console.log('\n💡 If you see data from other tenants, the issue might be:');
    console.log('   - Wrong tenant_id in TenantContext');
    console.log('   - User assigned to wrong tenant in users table');
    console.log('   - Data in database has wrong tenant_id values');
    console.log('   - Row Level Security (RLS) not working properly');

  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
  }
}

// Run the diagnostic
debugTenantData()
  .then(() => {
    console.log('\n🏁 Diagnostic completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Diagnostic failed:', error);
    process.exit(1);
  });

console.log(`
📝 HOW TO RUN THIS DIAGNOSTIC:

1. Make sure you're logged into the app with the user experiencing the issue
2. Run this script: node debug_tenant_data.js
3. Review the output to identify:
   - What tenant_id your user is assigned to
   - Whether data exists for other tenants
   - If the queries are filtering correctly
   - Any error messages

This will help pinpoint exactly where the tenant isolation is breaking down.
`);
