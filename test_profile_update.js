// Test Profile Update Functionality
// This script can be used to test profile updates in the browser console

// Test function to verify profile update
async function testProfileUpdate() {
  try {
    console.log('🧪 Testing Profile Update Functionality...');
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('❌ Auth Error:', authError);
      return;
    }
    
    if (!user) {
      console.error('❌ No authenticated user found');
      return;
    }
    
    console.log('✅ Authenticated user:', user.id);
    
    // Try to fetch current profile
    console.log('📖 Fetching current profile...');
    const { data: currentProfile, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (fetchError) {
      console.error('❌ Error fetching profile:', fetchError);
      return;
    }
    
    console.log('✅ Current profile:', currentProfile);
    
    // Test update with minimal changes
    console.log('🔄 Testing profile update...');
    const testUpdate = {
      full_name: currentProfile.full_name || 'Test User',
      email: currentProfile.email,
      phone: currentProfile.phone || '1234567890',
      updated_at: new Date().toISOString()
    };
    
    const { data: updateResult, error: updateError } = await supabase
      .from('users')
      .update(testUpdate)
      .eq('id', user.id)
      .select();
    
    if (updateError) {
      console.error('❌ Update Error:', updateError);
      console.error('Error details:', {
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
        code: updateError.code
      });
      return;
    }
    
    console.log('✅ Profile update successful!', updateResult);
    
    // Verify the update
    console.log('🔍 Verifying update...');
    const { data: verifyProfile, error: verifyError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (verifyError) {
      console.error('❌ Error verifying update:', verifyError);
      return;
    }
    
    console.log('✅ Updated profile verified:', verifyProfile);
    console.log('🎉 Profile update test completed successfully!');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Test RLS policies
async function testRLSPolicies() {
  try {
    console.log('🔒 Testing RLS Policies...');
    
    // Check if we can read our own profile
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error('❌ No authenticated user');
      return;
    }
    
    // Test SELECT policy
    const { data: selectData, error: selectError } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('id', user.id);
    
    if (selectError) {
      console.error('❌ SELECT policy failed:', selectError);
    } else {
      console.log('✅ SELECT policy working:', selectData);
    }
    
    // Test UPDATE policy
    const { data: updateData, error: updateError } = await supabase
      .from('users')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select();
    
    if (updateError) {
      console.error('❌ UPDATE policy failed:', updateError);
    } else {
      console.log('✅ UPDATE policy working:', updateData);
    }
    
  } catch (error) {
    console.error('❌ RLS test error:', error);
  }
}

// Export functions for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testProfileUpdate, testRLSPolicies };
}

// Auto-run if in browser console
if (typeof window !== 'undefined') {
  console.log('🚀 Profile Update Test Functions Available:');
  console.log('- testProfileUpdate() - Test the profile update functionality');
  console.log('- testRLSPolicies() - Test Row Level Security policies');
  console.log('');
  console.log('Run either function in the console to test!');
}
