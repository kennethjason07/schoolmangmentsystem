// Debug script for tenant validation issues in AdminNotifications
// Run this in your app console or as a standalone script

console.log("🔍 Starting Tenant Validation Debug for AdminNotifications");

// Function to check tenant IDs mismatch
async function debugTenantIDs() {
  console.log("\n=== TENANT ID ANALYSIS ===");
  
  try {
    // Get current user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      console.error("❌ No active session found:", sessionError?.message);
      return;
    }
    
    const userId = session.user.id;
    console.log("👤 Current User ID:", userId);
    
    // Check user record in database
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('id, email, role_id, tenant_id')
      .eq('id', userId)
      .single();
      
    if (userError) {
      console.error("❌ User record error:", userError);
    } else {
      console.log("👤 User Record:", {
        id: userRecord.id,
        email: userRecord.email,
        role_id: userRecord.role_id,
        tenant_id: userRecord.tenant_id
      });
    }
    
    // Check tenant context
    if (window.tenantContext) {
      console.log("🏢 Tenant Context:", window.tenantContext);
    } else {
      console.log("⚠️ No global tenant context found");
    }
    
    // Check if tenant exists in database
    if (userRecord?.tenant_id) {
      const { data: tenantRecord, error: tenantError } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', userRecord.tenant_id)
        .single();
        
      if (tenantError) {
        console.error("❌ Tenant record error:", tenantError);
      } else {
        console.log("🏢 User's Tenant Record:", {
          id: tenantRecord.id,
          name: tenantRecord.name,
          status: tenantRecord.status,
          created_at: tenantRecord.created_at
        });
      }
    }
    
  } catch (error) {
    console.error("💥 Debug error:", error);
  }
}

// Function to check notification access
async function debugNotificationAccess() {
  console.log("\n=== NOTIFICATION ACCESS TEST ===");
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error("❌ No session for notification test");
      return;
    }
    
    const userId = session.user.id;
    
    // Get user's tenant ID
    const { data: userRecord } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', userId)
      .single();
      
    if (!userRecord?.tenant_id) {
      console.error("❌ No tenant ID found for user");
      return;
    }
    
    const tenantId = userRecord.tenant_id;
    console.log("🔍 Testing notification access with tenant ID:", tenantId);
    
    // Test notification_recipients query
    const { data: recipients, error: recipientsError } = await supabase
      .from('notification_recipients')
      .select('*, notifications(*)')
      .eq('tenant_id', tenantId)
      .eq('recipient_id', userId)
      .limit(5);
      
    if (recipientsError) {
      console.error("❌ Notification recipients error:", recipientsError);
    } else {
      console.log("✅ Notification recipients found:", recipients.length);
      if (recipients.length > 0) {
        console.log("📋 Sample recipient:", recipients[0]);
      }
    }
    
    // Test general notifications query
    const { data: general, error: generalError } = await supabase
      .from('notifications')
      .select('*')
      .eq('tenant_id', tenantId)
      .limit(5);
      
    if (generalError) {
      console.error("❌ General notifications error:", generalError);
    } else {
      console.log("✅ General notifications found:", general.length);
      if (general.length > 0) {
        console.log("📋 Sample notification:", general[0]);
      }
    }
    
  } catch (error) {
    console.error("💥 Notification access debug error:", error);
  }
}

// Function to test tenant validation function
async function testTenantValidation() {
  console.log("\n=== TENANT VALIDATION FUNCTION TEST ===");
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error("❌ No session for validation test");
      return;
    }
    
    const userId = session.user.id;
    
    // Get user's tenant ID
    const { data: userRecord } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', userId)
      .single();
      
    if (!userRecord?.tenant_id) {
      console.error("❌ No tenant ID found for user");
      return;
    }
    
    const tenantId = userRecord.tenant_id;
    
    console.log("🧪 Testing validateTenantAccess function...");
    console.log("Parameters:", { tenantId, userId });
    
    // Test the validation function (assuming it's available globally)
    if (typeof validateTenantAccess === 'function') {
      const result = await validateTenantAccess(tenantId, userId, 'DEBUG_TEST');
      console.log("🧪 Validation result:", result);
    } else {
      console.log("⚠️ validateTenantAccess function not available globally");
      
      // Manual validation test
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .eq('status', 'active')
        .single();
        
      if (tenantError) {
        console.error("❌ Manual tenant validation error:", tenantError);
      } else {
        console.log("✅ Manual tenant validation success:", {
          id: tenant.id,
          name: tenant.name,
          status: tenant.status
        });
      }
    }
    
  } catch (error) {
    console.error("💥 Tenant validation test error:", error);
  }
}

// Function to check all tenants in database
async function debugAllTenants() {
  console.log("\n=== ALL TENANTS ANALYSIS ===");
  
  try {
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (tenantsError) {
      console.error("❌ Error fetching tenants:", tenantsError);
    } else {
      console.log("🏢 All tenants in database:", tenants.length);
      tenants.forEach((tenant, index) => {
        console.log(`${index + 1}. ${tenant.name} (${tenant.id}) - ${tenant.status}`);
      });
      
      // Check which tenant the current user belongs to
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: userRecord } = await supabase
          .from('users')
          .select('tenant_id')
          .eq('id', session.user.id)
          .single();
          
        if (userRecord?.tenant_id) {
          const userTenant = tenants.find(t => t.id === userRecord.tenant_id);
          if (userTenant) {
            console.log("👤 User belongs to tenant:", userTenant.name, `(${userTenant.id})`);
          } else {
            console.error("❌ User's tenant not found in tenants list!");
            console.error("User tenant ID:", userRecord.tenant_id);
          }
        }
      }
    }
    
  } catch (error) {
    console.error("💥 All tenants debug error:", error);
  }
}

// Main debug function
async function runFullTenantDebug() {
  console.log("🔍 Starting comprehensive tenant validation debug...\n");
  
  await debugTenantIDs();
  await debugNotificationAccess();
  await testTenantValidation();
  await debugAllTenants();
  
  console.log("\n=== DEBUG SUMMARY ===");
  console.log("✅ Debug completed. Check logs above for issues.");
  console.log("🔧 Common fixes:");
  console.log("1. Ensure user has correct tenant_id in users table");
  console.log("2. Verify tenant exists and is active in tenants table");
  console.log("3. Check parameter order in validateTenantAccess calls");
  console.log("4. Verify tenant context is properly initialized");
}

// Auto-run the debug
runFullTenantDebug();

// Export functions for manual use
window.tenantDebug = {
  runAll: runFullTenantDebug,
  checkTenantIDs: debugTenantIDs,
  checkNotificationAccess: debugNotificationAccess,
  testValidation: testTenantValidation,
  checkAllTenants: debugAllTenants
};

console.log("🛠️ Debug functions available as window.tenantDebug");