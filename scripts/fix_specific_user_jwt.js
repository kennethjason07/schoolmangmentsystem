const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY1NDYxMSwiZXhwIjoyMDY4MjMwNjExfQ.cZU6n8_mjB5KhTd4mlc-UYTe04rqfRXWg1m8YPYGUM4';
const correctTenantId = 'b8f8b5f0-1234-4567-8901-123456789000';
const targetEmail = 'kenj7214@gmail.com';
const targetUserId = 'b601fdfe-9800-4c12-a762-e07e5ca57e37'; // From the logs

console.log('=== FIXING SPECIFIC USER JWT METADATA ===\n');

async function fixSpecificUserJWT() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    console.log('Target user:', targetEmail);
    console.log('Target user ID:', targetUserId);
    console.log('Correct tenant_id:', correctTenantId);
    console.log('');
    
    // Method 1: Try with email lookup
    console.log('🔍 Method 1: Finding user by email in auth...');
    try {
      const { data: usersByEmail, error: emailError } = await supabase.auth.admin.listUsers();
      
      if (emailError) {
        console.log('❌ Could not list users:', emailError.message);
      } else {
        const targetUser = usersByEmail.users.find(u => u.email === targetEmail);
        if (targetUser) {
          console.log('✅ Found user by email:', targetUser.email);
          console.log('   - Auth user ID:', targetUser.id);
          console.log('   - Current app_metadata:', JSON.stringify(targetUser.app_metadata, null, 2));
          
          // Update this user's metadata
          const newAppMetadata = {
            ...targetUser.app_metadata,
            tenant_id: correctTenantId,
            updated_at: new Date().toISOString(),
            updated_by: 'specific_jwt_fix_script'
          };
          
          console.log('   📝 Updating to:', JSON.stringify(newAppMetadata, null, 2));
          
          const { data: updateResult, error: updateError } = await supabase.auth.admin.updateUserById(
            targetUser.id,
            { app_metadata: newAppMetadata }
          );
          
          if (updateError) {
            console.log('   ❌ Update failed:', updateError.message);
          } else {
            console.log('   ✅ JWT metadata updated successfully!');
          }
        } else {
          console.log('❌ User not found in auth users list');
        }
      }
    } catch (listError) {
      console.log('❌ Method 1 failed:', listError.message);
    }
    
    // Method 2: Try direct update by user ID
    console.log('\n🔍 Method 2: Direct update by user ID...');
    try {
      // Get current user data
      const { data: currentUserData, error: getCurrentError } = await supabase.auth.admin.getUserById(targetUserId);
      
      if (getCurrentError) {
        console.log('❌ Could not get user by ID:', getCurrentError.message);
      } else if (currentUserData.user) {
        console.log('✅ Found user by ID:', currentUserData.user.email);
        console.log('   - Current app_metadata:', JSON.stringify(currentUserData.user.app_metadata, null, 2));
        
        const newAppMetadata = {
          ...currentUserData.user.app_metadata,
          tenant_id: correctTenantId,
          updated_at: new Date().toISOString(),
          updated_by: 'specific_jwt_fix_script_method2'
        };
        
        console.log('   📝 Updating to:', JSON.stringify(newAppMetadata, null, 2));
        
        const { data: updateResult, error: updateError } = await supabase.auth.admin.updateUserById(
          targetUserId,
          { app_metadata: newAppMetadata }
        );
        
        if (updateError) {
          console.log('   ❌ Update failed:', updateError.message);
        } else {
          console.log('   ✅ JWT metadata updated successfully via Method 2!');
        }
      } else {
        console.log('❌ No user data returned');
      }
    } catch (directError) {
      console.log('❌ Method 2 failed:', directError.message);
    }
    
    // Method 3: Also update the database record to make sure it's consistent
    console.log('\n🔍 Method 3: Ensuring database record is correct...');
    try {
      const { data: dbUser, error: dbError } = await supabase
        .from('users')
        .select('id, email, tenant_id')
        .eq('id', targetUserId);
      
      console.log('Database user query result:');
      console.log('   - Found:', dbUser?.length || 0);
      console.log('   - Error:', dbError?.message || 'None');
      
      if (dbUser && dbUser.length > 0) {
        console.log('   - Current DB tenant_id:', dbUser[0].tenant_id);
        
        if (dbUser[0].tenant_id !== correctTenantId) {
          console.log('   ⚠️ Database tenant_id needs update');
          
          const { error: updateDbError } = await supabase
            .from('users')
            .update({ tenant_id: correctTenantId })
            .eq('id', targetUserId);
          
          if (updateDbError) {
            console.log('   ❌ Failed to update DB tenant_id:', updateDbError.message);
          } else {
            console.log('   ✅ Database tenant_id updated');
          }
        } else {
          console.log('   ✅ Database tenant_id already correct');
        }
      } else {
        console.log('   ❌ User not found in database users table!');
        console.log('   💡 This explains why database queries fail - user record missing');
        
        // Create the missing user record
        console.log('   🔧 Creating missing user database record...');
        const { error: createError } = await supabase
          .from('users')
          .insert({
            id: targetUserId,
            email: targetEmail,
            full_name: 'Kenneth Jason ',
            phone: '7619107621',
            role_id: 1,
            tenant_id: correctTenantId,
            created_at: new Date().toISOString()
          });
        
        if (createError) {
          console.log('   ❌ Failed to create user record:', createError.message);
        } else {
          console.log('   ✅ Created missing user database record');
        }
      }
    } catch (dbCheckError) {
      console.log('❌ Method 3 failed:', dbCheckError.message);
    }
    
    console.log('\n=== VERIFICATION ===');
    console.log('Testing if the fix worked...');
    
    // Test if we can now access notifications with the correct tenant_id
    const { data: testNotifications, error: testError } = await supabase
      .from('notifications')
      .select('id, type, message, tenant_id')
      .eq('tenant_id', correctTenantId);
    
    console.log('Direct service role query result:');
    console.log('   - Found notifications:', testNotifications?.length || 0);
    console.log('   - Error:', testError?.message || 'None');
    
    if (testNotifications && testNotifications.length > 0) {
      console.log('✅ Notifications exist with correct tenant_id!');
      testNotifications.forEach(n => {
        console.log(`   - "${n.message?.substring(0, 40)}..." (${n.type})`);
      });
    }
    
    console.log('\n=== NEXT STEPS ===');
    console.log('🚨 CRITICAL: You MUST log out and log back in for JWT changes to take effect!');
    console.log('');
    console.log('1. ⚠️ LOG OUT of your mobile app completely');
    console.log('2. 🔐 LOG BACK IN with your credentials');
    console.log('3. 📱 Go to NotificationManagement screen');
    console.log('4. 🔍 Check JWT_DEBUG logs - should now show correct tenant_id');
    console.log('5. 📋 Notifications should now appear!');
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

fixSpecificUserJWT();
