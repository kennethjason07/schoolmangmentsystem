const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createUserProfile() {
  console.log('🔧 Creating User Profile for kenj7214@gmail.com');
  console.log('===============================================');

  const defaultTenantId = 'b8f8b5f0-1234-4567-8901-123456789000';
  const userEmail = 'kenj7214@gmail.com';
  
  // First, check if user already exists
  console.log('\n1. 🔍 Checking if user already exists...');
  const { data: existingUser, error: checkError } = await supabase
    .from('users')
    .select('*')
    .eq('email', userEmail)
    .single();
    
  if (checkError && checkError.code !== 'PGRST116') {
    console.error('❌ Error checking existing user:', checkError);
    return;
  }
  
  if (existingUser) {
    console.log('✅ User already exists in database:');
    console.log(`   - Name: ${existingUser.full_name}`);
    console.log(`   - Role ID: ${existingUser.role_id}`);
    console.log(`   - Tenant ID: ${existingUser.tenant_id}`);
    return;
  }
  
  console.log('ℹ️  User not found in database, creating new profile...');
  
  // Create user profile
  console.log('\n2. 📝 Creating user profile...');
  
  const userData = {
    email: userEmail,
    full_name: 'Ken Admin', // You can change this name
    role_id: 1, // Admin role (from the screenshot we saw role ID 1 = Admin)
    tenant_id: defaultTenantId,
    phone: '+1234567890', // Sample phone number
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_active: true
  };
  
  console.log('🔧 Creating user with data:', userData);
  
  const { data: newUser, error: createError } = await supabase
    .from('users')
    .insert(userData)
    .select()
    .single();
    
  if (createError) {
    console.error('❌ Error creating user:', createError);
    
    if (createError.code === '42501') {
      console.log('\n🚨 RLS is blocking user creation!');
      console.log('💡 You need to run this SQL in your Supabase SQL Editor:');
      console.log('');
      console.log('INSERT INTO public.users (email, full_name, role_id, tenant_id, phone, is_active) VALUES');
      console.log(`('${userEmail}', 'Ken Admin', 1, '${defaultTenantId}', '+1234567890', true);`);
      console.log('');
    }
    return;
  }
  
  console.log('✅ User profile created successfully!');
  console.log('📋 User details:');
  console.log(`   - ID: ${newUser.id}`);
  console.log(`   - Name: ${newUser.full_name}`);
  console.log(`   - Email: ${newUser.email}`);
  console.log(`   - Role ID: ${newUser.role_id}`);
  console.log(`   - Tenant ID: ${newUser.tenant_id}`);
  
  console.log('\n🎉 User profile creation completed!');
  console.log('🚀 You should now be able to log in successfully!');
}

// Also provide SQL alternative
console.log('📋 ALTERNATIVE: Manual SQL Creation');
console.log('===================================');
console.log('If the script fails due to RLS, copy this SQL into Supabase SQL Editor:');
console.log('');
console.log(`INSERT INTO public.users (email, full_name, role_id, tenant_id, phone, is_active) VALUES 
('kenj7214@gmail.com', 'Ken Admin', 1, 'b8f8b5f0-1234-4567-8901-123456789000', '+1234567890', true);`);
console.log('');

createUserProfile().catch(console.error);
