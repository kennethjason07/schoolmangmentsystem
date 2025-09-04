const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SERVICE_ROLE_KEY';
const correctTenantId = 'b8f8b5f0-1234-4567-8901-123456789000';

if (supabaseServiceKey === 'YOUR_SERVICE_ROLE_KEY') {
  console.log('❌ Please set your service role key:');
  console.log('   SUPABASE_SERVICE_ROLE_KEY=your_service_key node scripts/fix_user_metadata.js');
  process.exit(1);
}

console.log('=== FIXING USER METADATA WITH CORRECT TENANT_ID ===\n');

async function fixUserMetadata() {
  // Create admin client that can update auth metadata
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    // Get all users in the correct tenant
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, tenant_id');
    
    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return;
    }
    
    console.log(`Found ${users.length} users to update:\n`);
    
    for (const user of users) {
      console.log(`🔧 Updating user: ${user.email}`);
      console.log(`   - Current tenant_id in database: ${user.tenant_id}`);
      
      // Update database tenant_id if it doesn't match
      if (user.tenant_id !== correctTenantId) {
        console.log(`   ⚠️ Database tenant_id mismatch! Updating database record...`);
        
        const { error: dbUpdateError } = await supabase
          .from('users')
          .update({ tenant_id: correctTenantId })
          .eq('id', user.id);
        
        if (dbUpdateError) {
          console.log(`   ❌ Failed to update database tenant_id: ${dbUpdateError.message}`);
        } else {
          console.log(`   ✅ Database tenant_id updated to: ${correctTenantId}`);
        }
      }
      
      try {
        // Get current metadata to merge with new tenant_id
        const { data: currentUser, error: getUserError } = await supabase.auth.admin.getUserById(user.id);
        
        if (getUserError) {
          console.log(`   ❌ Could not get current user metadata: ${getUserError.message}`);
          continue;
        }
        
        const currentAppMetadata = currentUser.user?.app_metadata || {};
        console.log(`   📋 Current app_metadata:`, JSON.stringify(currentAppMetadata, null, 2));
        
        // Update user JWT metadata to include correct tenant_id
        const newAppMetadata = {
          ...currentAppMetadata,
          tenant_id: correctTenantId,
          updated_at: new Date().toISOString(),
          updated_by: 'metadata_fix_script'
        };
        
        console.log(`   📝 New app_metadata:`, JSON.stringify(newAppMetadata, null, 2));
        
        const { data: updateResult, error: updateError } = await supabase.auth.admin.updateUserById(
          user.id, 
          {
            app_metadata: newAppMetadata
          }
        );
        
        if (updateError) {
          console.log(`   ❌ Failed to update JWT metadata: ${updateError.message}`);
        } else {
          console.log(`   ✅ JWT metadata updated successfully`);
          console.log(`   💡 User must log out and log back in for changes to take effect`);
        }
        
      } catch (metaError) {
        console.log(`   ❌ Error updating user ${user.email}:`, metaError.message);
      }
      
      console.log('');
    }
    
    console.log('=== RESULTS ===');
    console.log('✅ User metadata update process completed');
    console.log('');
    console.log('=== NEXT STEPS ===');
    console.log('1. Users need to log out and log back in for JWT changes to take effect');
    console.log('2. Test the NotificationManagement.js screen after re-login');
    console.log('3. Check the console logs for JWT_DEBUG information');
    console.log('4. If JWT now contains correct tenant_id, notifications should appear');
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

fixUserMetadata();
