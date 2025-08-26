const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkAndFixUserRoles() {
  try {
    console.log('🔍 Checking user roles issue...');
    
    // 1. Check if the user exists
    const userEmail = 'arshadpatel1431@gmail.com';
    console.log(`\n1. Checking user: ${userEmail}`);
    
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', userEmail)
      .maybeSingle();
    
    if (userError) {
      console.error('❌ Error fetching user:', userError);
      return;
    }
    
    if (!userData) {
      console.log('❌ User not found');
      return;
    }
    
    console.log('✅ User found:', {
      id: userData.id,
      email: userData.email,
      role_id: userData.role_id,
      full_name: userData.full_name
    });
    
    // 2. Check if roles table exists and has data
    console.log('\n2. Checking roles table...');
    
    const { data: rolesData, error: rolesError } = await supabase
      .from('roles')
      .select('*');
    
    if (rolesError) {
      console.log('⚠️ Roles table error:', rolesError);
      console.log('📝 This is likely why role lookup is failing');
      
      if (rolesError.code === '42P01') {
        console.log('🔧 Roles table does not exist, need to create it');
        await createRolesTable();
      } else {
        console.log('🔧 Attempting to create default roles...');
        await createDefaultRoles();
      }
    } else {
      console.log('✅ Roles table exists with data:', rolesData);
      
      if (!rolesData || rolesData.length === 0) {
        console.log('📝 Roles table is empty, creating default roles...');
        await createDefaultRoles();
      } else {
        // Check if user's role_id exists
        const userRole = rolesData.find(role => role.id === userData.role_id);
        if (userRole) {
          console.log(`✅ User role found: ${userRole.role_name} (ID: ${userRole.id})`);
        } else {
          console.log(`⚠️ User role_id ${userData.role_id} not found in roles table`);
          console.log('🔧 Available roles:', rolesData.map(r => `${r.role_name} (ID: ${r.id})`));
          
          // Try to fix by assigning a default role
          await fixUserRole(userData);
        }
      }
    }
    
    // 3. Test the auth flow
    console.log('\n3. Testing auth flow...');
    await testAuthFlow(userEmail);
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

async function createDefaultRoles() {
  try {
    console.log('🔧 Creating default roles...');
    
    const defaultRoles = [
      { id: 1, role_name: 'Admin' },
      { id: 2, role_name: 'Teacher' },
      { id: 3, role_name: 'Parent' },
      { id: 4, role_name: 'Student' }
    ];
    
    for (const role of defaultRoles) {
      const { data, error } = await supabase
        .from('roles')
        .upsert(role, { onConflict: 'id' })
        .select();
      
      if (error) {
        console.log(`❌ Error creating role ${role.role_name}:`, error);
      } else {
        console.log(`✅ Created/Updated role: ${role.role_name}`);
      }
    }
  } catch (error) {
    console.error('💥 Error creating default roles:', error);
  }
}

async function fixUserRole(userData) {
  try {
    console.log('🔧 Attempting to fix user role...');
    
    // Map role_id to likely role names
    const roleMap = {
      1: 'Admin',
      2: 'Teacher', 
      3: 'Parent',
      4: 'Student'
    };
    
    const expectedRoleName = roleMap[userData.role_id] || 'Teacher'; // Default to Teacher
    
    // Check if the role exists
    const { data: roleData, error: roleError } = await supabase
      .from('roles')
      .select('*')
      .eq('role_name', expectedRoleName)
      .maybeSingle();
    
    if (roleError || !roleData) {
      console.log(`⚠️ Role ${expectedRoleName} not found, creating it...`);
      
      const { data: newRole, error: createError } = await supabase
        .from('roles')
        .insert({ id: userData.role_id, role_name: expectedRoleName })
        .select()
        .single();
      
      if (createError) {
        console.error('❌ Error creating role:', createError);
      } else {
        console.log(`✅ Created role: ${expectedRoleName} with ID: ${userData.role_id}`);
      }
    } else {
      console.log(`✅ Role ${expectedRoleName} already exists`);
      
      // If role exists but with different ID, update user's role_id
      if (roleData.id !== userData.role_id) {
        console.log(`🔧 Updating user role_id from ${userData.role_id} to ${roleData.id}`);
        
        const { error: updateError } = await supabase
          .from('users')
          .update({ role_id: roleData.id })
          .eq('id', userData.id);
        
        if (updateError) {
          console.error('❌ Error updating user role_id:', updateError);
        } else {
          console.log('✅ User role_id updated successfully');
        }
      }
    }
  } catch (error) {
    console.error('💥 Error fixing user role:', error);
  }
}

async function testAuthFlow(userEmail) {
  try {
    console.log('🧪 Testing auth flow...');
    
    // Simulate the auth context flow
    const { data: userProfile, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', userEmail)
      .maybeSingle();
    
    if (error) {
      console.error('❌ User profile query failed:', error);
      return;
    }
    
    if (!userProfile) {
      console.log('❌ User profile not found');
      return;
    }
    
    console.log('✅ User profile retrieved successfully');
    
    // Test role lookup
    if (userProfile.role_id) {
      const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .select('role_name')
        .eq('id', userProfile.role_id)
        .maybeSingle();
      
      if (roleError) {
        console.log('⚠️ Role lookup failed:', roleError);
      } else if (roleData) {
        console.log(`✅ Role lookup successful: ${roleData.role_name}`);
      } else {
        console.log('⚠️ Role not found for role_id:', userProfile.role_id);
      }
    }
  } catch (error) {
    console.error('💥 Error testing auth flow:', error);
  }
}

// Run the script
checkAndFixUserRoles().then(() => {
  console.log('\n🏁 Script completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
