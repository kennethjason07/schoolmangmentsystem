const { createClient } = require('@supabase/supabase-js');

// Supabase configuration from the app
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// The tenant we want to keep
const CORRECT_TENANT_ID = 'b8f8b5f0-1234-4567-8901-123456789000';
// The tenant we want to remove
const UNWANTED_TENANT_ID = '0d172096-a836-4ecb-99b2-ee87c57b1b8f';

async function consolidateTenants() {
  console.log('🔄 Starting tenant consolidation process...\n');
  console.log(`✅ Keeping tenant: ${CORRECT_TENANT_ID}`);
  console.log(`❌ Removing tenant: ${UNWANTED_TENANT_ID}`);
  
  try {
    // Step 1: Check current state
    console.log('\n📋 Step 1: Analyzing current database state...');
    
    // Check users distribution
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, full_name, tenant_id, role_id')
      .not('tenant_id', 'is', null);
    
    if (usersError) {
      console.error('❌ Error checking users:', usersError.message);
      return;
    }
    
    const correctTenantUsers = users?.filter(u => u.tenant_id === CORRECT_TENANT_ID) || [];
    const unwantedTenantUsers = users?.filter(u => u.tenant_id === UNWANTED_TENANT_ID) || [];
    
    console.log(`📊 Current user distribution:`);
    console.log(`   - Correct tenant (${CORRECT_TENANT_ID}): ${correctTenantUsers.length} users`);
    console.log(`   - Unwanted tenant (${UNWANTED_TENANT_ID}): ${unwantedTenantUsers.length} users`);
    
    if (unwantedTenantUsers.length > 0) {
      console.log('👥 Users in unwanted tenant:');
      unwantedTenantUsers.forEach(user => {
        console.log(`   - ${user.email} (${user.full_name || 'No name'}) - Role ${user.role_id}`);
      });
    }
    
    // Check notifications distribution
    const { data: notifications, error: notifsError } = await supabase
      .from('notifications')
      .select('id, tenant_id, type, message, created_at');
    
    if (notifsError) {
      console.log('❌ Cannot check notifications (likely RLS protected):', notifsError.message);
    } else {
      const correctTenantNotifs = notifications?.filter(n => n.tenant_id === CORRECT_TENANT_ID) || [];
      const unwantedTenantNotifs = notifications?.filter(n => n.tenant_id === UNWANTED_TENANT_ID) || [];
      const nullTenantNotifs = notifications?.filter(n => !n.tenant_id) || [];
      
      console.log(`📋 Current notification distribution:`);
      console.log(`   - Correct tenant: ${correctTenantNotifs.length} notifications`);
      console.log(`   - Unwanted tenant: ${unwantedTenantNotifs.length} notifications`);
      console.log(`   - NULL tenant_id: ${nullTenantNotifs.length} notifications`);
      
      if (nullTenantNotifs.length > 0) {
        console.log('📝 NULL tenant_id notifications (these will be fixed):');
        nullTenantNotifs.slice(0, 5).forEach((notif, index) => {
          console.log(`   ${index + 1}. ${notif.type}: ${notif.message.substring(0, 50)}...`);
        });
      }
    }
    
    // Step 2: Update users with unwanted tenant_id
    if (unwantedTenantUsers.length > 0) {
      console.log(`\n📋 Step 2: Moving ${unwantedTenantUsers.length} users from unwanted tenant to correct tenant...`);
      
      const { data: updatedUsers, error: updateUsersError } = await supabase
        .from('users')
        .update({ tenant_id: CORRECT_TENANT_ID })
        .eq('tenant_id', UNWANTED_TENANT_ID)
        .select('email, full_name');
      
      if (updateUsersError) {
        console.error('❌ Error updating users tenant_id:', updateUsersError.message);
        if (updateUsersError.code === '42501') {
          console.log('🔒 RLS policy prevented user updates. This might need to be done with elevated permissions.');
        }
      } else {
        console.log(`✅ Successfully updated ${updatedUsers?.length || 0} users`);
        if (updatedUsers && updatedUsers.length > 0) {
          updatedUsers.forEach(user => {
            console.log(`   - ${user.email} (${user.full_name || 'No name'})`);
          });
        }
      }
    }
    
    // Step 3: Update notifications with unwanted tenant_id or NULL tenant_id
    console.log('\n📋 Step 3: Updating notifications to use correct tenant_id...');
    
    // First, try to update notifications with unwanted tenant_id
    const { data: updatedNotifs1, error: updateNotifs1Error } = await supabase
      .from('notifications')
      .update({ tenant_id: CORRECT_TENANT_ID })
      .eq('tenant_id', UNWANTED_TENANT_ID)
      .select('id, type, message');
    
    if (updateNotifs1Error) {
      console.log('❌ Error updating notifications with unwanted tenant_id:', updateNotifs1Error.message);
      if (updateNotifs1Error.code === '42501') {
        console.log('🔒 RLS policy prevented notification updates with unwanted tenant_id');
      }
    } else {
      console.log(`✅ Updated ${updatedNotifs1?.length || 0} notifications from unwanted tenant`);
    }
    
    // Then, try to update notifications with NULL tenant_id
    const { data: updatedNotifs2, error: updateNotifs2Error } = await supabase
      .from('notifications')
      .update({ tenant_id: CORRECT_TENANT_ID })
      .is('tenant_id', null)
      .select('id, type, message');
    
    if (updateNotifs2Error) {
      console.log('❌ Error updating notifications with NULL tenant_id:', updateNotifs2Error.message);
      if (updateNotifs2Error.code === '42501') {
        console.log('🔒 RLS policy prevented notification updates with NULL tenant_id');
      }
    } else {
      console.log(`✅ Updated ${updatedNotifs2?.length || 0} notifications with NULL tenant_id`);
      if (updatedNotifs2 && updatedNotifs2.length > 0) {
        updatedNotifs2.slice(0, 3).forEach((notif, index) => {
          console.log(`   ${index + 1}. ${notif.type}: ${notif.message.substring(0, 50)}...`);
        });
      }
    }
    
    // Step 4: Update notification_recipients with unwanted tenant_id or NULL tenant_id
    console.log('\n📋 Step 4: Updating notification recipients to use correct tenant_id...');
    
    // Update recipients with unwanted tenant_id
    const { data: updatedRecipients1, error: updateRecipients1Error } = await supabase
      .from('notification_recipients')
      .update({ tenant_id: CORRECT_TENANT_ID })
      .eq('tenant_id', UNWANTED_TENANT_ID)
      .select('notification_id, recipient_id');
    
    if (updateRecipients1Error) {
      console.log('❌ Error updating recipients with unwanted tenant_id:', updateRecipients1Error.message);
    } else {
      console.log(`✅ Updated ${updatedRecipients1?.length || 0} notification recipients from unwanted tenant`);
    }
    
    // Update recipients with NULL tenant_id
    const { data: updatedRecipients2, error: updateRecipients2Error } = await supabase
      .from('notification_recipients')
      .update({ tenant_id: CORRECT_TENANT_ID })
      .is('tenant_id', null)
      .select('notification_id, recipient_id');
    
    if (updateRecipients2Error) {
      console.log('❌ Error updating recipients with NULL tenant_id:', updateRecipients2Error.message);
    } else {
      console.log(`✅ Updated ${updatedRecipients2?.length || 0} notification recipients with NULL tenant_id`);
    }
    
    // Step 5: Update other tables that might have tenant_id references
    console.log('\n📋 Step 5: Updating other tables with tenant_id...');
    
    // List of tables that likely have tenant_id columns
    const tenantTables = [
      'students', 'teachers', 'parents', 'classes', 'subjects', 
      'student_attendance', 'teacher_attendance', 'student_fees', 
      'exams', 'marks', 'homeworks', 'assignments', 'tasks',
      'personal_tasks', 'school_details', 'messages', 'events',
      'fees', 'school_expenses', 'expense_categories', 'student_discounts',
      'leave_applications'
    ];
    
    for (const tableName of tenantTables) {
      try {
        // Check if table exists and has records with unwanted tenant_id
        const { count: unwantedCount, error: countError } = await supabase
          .from(tableName)
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', UNWANTED_TENANT_ID);
        
        if (!countError && unwantedCount > 0) {
          console.log(`🔄 Updating ${unwantedCount} records in ${tableName}...`);
          
          const { data: updated, error: updateError } = await supabase
            .from(tableName)
            .update({ tenant_id: CORRECT_TENANT_ID })
            .eq('tenant_id', UNWANTED_TENANT_ID)
            .select('id');
          
          if (updateError) {
            console.log(`   ❌ Error updating ${tableName}:`, updateError.message);
          } else {
            console.log(`   ✅ Updated ${updated?.length || 0} records in ${tableName}`);
          }
        } else if (countError) {
          // Table might not exist or not accessible
          console.log(`   ⏭️ Skipping ${tableName} (${countError.message})`);
        } else {
          console.log(`   ✅ No records to update in ${tableName}`);
        }
        
        // Also update NULL tenant_ids in this table
        const { count: nullCount, error: nullCountError } = await supabase
          .from(tableName)
          .select('id', { count: 'exact', head: true })
          .is('tenant_id', null);
        
        if (!nullCountError && nullCount > 0) {
          console.log(`🔄 Updating ${nullCount} NULL tenant_id records in ${tableName}...`);
          
          const { data: nullUpdated, error: nullUpdateError } = await supabase
            .from(tableName)
            .update({ tenant_id: CORRECT_TENANT_ID })
            .is('tenant_id', null)
            .select('id');
          
          if (nullUpdateError) {
            console.log(`   ❌ Error updating NULL tenant_ids in ${tableName}:`, nullUpdateError.message);
          } else {
            console.log(`   ✅ Updated ${nullUpdated?.length || 0} NULL tenant_id records in ${tableName}`);
          }
        }
        
      } catch (error) {
        console.log(`   ⏭️ Skipping ${tableName} (table access error)`);
      }
    }
    
    // Step 6: Remove the unwanted tenant from tenants table
    console.log('\n📋 Step 6: Removing unwanted tenant from tenants table...');
    
    const { error: deleteTenantError } = await supabase
      .from('tenants')
      .delete()
      .eq('id', UNWANTED_TENANT_ID);
    
    if (deleteTenantError) {
      console.error('❌ Error deleting unwanted tenant:', deleteTenantError.message);
      if (deleteTenantError.code === '42501') {
        console.log('🔒 RLS policy prevented tenant deletion. You may need to do this manually in the Supabase dashboard.');
      }
    } else {
      console.log('✅ Successfully removed unwanted tenant from tenants table');
    }
    
    // Step 7: Verify final state
    console.log('\n📋 Step 7: Verifying final state...');
    
    // Check final user distribution
    const { data: finalUsers, error: finalUsersError } = await supabase
      .from('users')
      .select('tenant_id, email, full_name')
      .not('tenant_id', 'is', null);
    
    if (finalUsersError) {
      console.error('❌ Error checking final user state:', finalUsersError.message);
    } else {
      const tenantGroups = {};
      finalUsers?.forEach(user => {
        if (!tenantGroups[user.tenant_id]) tenantGroups[user.tenant_id] = [];
        tenantGroups[user.tenant_id].push(user);
      });
      
      console.log('📊 Final user distribution:');
      Object.keys(tenantGroups).forEach(tenantId => {
        const isCorrect = tenantId === CORRECT_TENANT_ID;
        const icon = isCorrect ? '✅' : '⚠️';
        console.log(`   ${icon} Tenant ${tenantId}: ${tenantGroups[tenantId].length} users`);
        
        if (!isCorrect) {
          console.log(`   ⚠️ WARNING: Still found users in unexpected tenant!`);
        }
      });
    }
    
    // Check final notification distribution
    const { data: finalNotifs, error: finalNotifsError } = await supabase
      .from('notifications')
      .select('id, tenant_id, type');
    
    if (finalNotifsError) {
      console.log('❌ Cannot check final notification state (RLS protected):', finalNotifsError.message);
    } else {
      const notifTenantGroups = {};
      finalNotifs?.forEach(notif => {
        const tid = notif.tenant_id || 'NULL';
        if (!notifTenantGroups[tid]) notifTenantGroups[tid] = 0;
        notifTenantGroups[tid]++;
      });
      
      console.log('📋 Final notification distribution:');
      Object.keys(notifTenantGroups).forEach(tenantId => {
        const isCorrect = tenantId === CORRECT_TENANT_ID;
        const icon = isCorrect ? '✅' : '⚠️';
        console.log(`   ${icon} Tenant ${tenantId}: ${notifTenantGroups[tenantId]} notifications`);
      });
    }
    
    // Check remaining tenants
    const { data: remainingTenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, name, subdomain, status');
    
    if (tenantsError) {
      console.error('❌ Error checking remaining tenants:', tenantsError.message);
    } else {
      console.log('🏢 Remaining tenants:');
      remainingTenants?.forEach(tenant => {
        const isCorrect = tenant.id === CORRECT_TENANT_ID;
        const icon = isCorrect ? '✅' : '⚠️';
        console.log(`   ${icon} ${tenant.name} (${tenant.id}) - ${tenant.status}`);
      });
    }
    
    console.log('\n🎯 CONSOLIDATION SUMMARY:');
    console.log('✅ All data should now be consolidated under tenant:', CORRECT_TENANT_ID);
    console.log('🔄 The NotificationManagement screen should now show existing notifications');
    console.log('💡 Test the app now - notifications should be visible again');
    
    // Success recommendations
    console.log('\n📱 NEXT STEPS:');
    console.log('1. Test the NotificationManagement screen in your app');
    console.log('2. Check if existing notifications are now visible');
    console.log('3. Try creating a new notification to ensure everything works');
    console.log('4. If issues persist, check the console logs for remaining tenant mismatches');
    
  } catch (error) {
    console.error('💥 Unexpected error during consolidation:', error);
  }
}

// Run the consolidation
consolidateTenants().then(() => {
  console.log('\n🏁 Tenant consolidation completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
