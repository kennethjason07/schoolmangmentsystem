// Test function to verify authentication is working
import { supabase } from './supabase';

export const testAuthSystem = async (email, password) => {
  try {
    console.log('=== Testing Authentication System ===');
    
    // 1. Test Sign In
    console.log('1. Testing sign in...');
    const { data: { user, session }, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (signInError) {
      console.error('❌ Sign in failed:', signInError.message);
      return false;
    }
    
    if (user && session) {
      console.log('✅ Sign in successful!');
      console.log('   User ID:', user.id);
      console.log('   Email:', user.email);
      console.log('   Session expires:', new Date(session.expires_at * 1000));
      
      // 2. Test getting user profile
      console.log('2. Testing user profile retrieval...');
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();
      
      if (profileError) {
        console.error('❌ Profile retrieval failed:', profileError.message);
      } else {
        console.log('✅ Profile retrieved successfully!');
        console.log('   Full Name:', profile.full_name);
        console.log('   Role ID:', profile.role_id);
        console.log('   Phone:', profile.phone);
        console.log('   Password Column:', profile.password || 'NULL (this is correct!)');
      }
      
      // 3. Test sign out
      console.log('3. Testing sign out...');
      const { error: signOutError } = await supabase.auth.signOut();
      
      if (signOutError) {
        console.error('❌ Sign out failed:', signOutError.message);
      } else {
        console.log('✅ Sign out successful!');
      }
      
      console.log('=== Authentication Test Complete ===');
      return true;
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    return false;
  }
};

// Function to check current auth state
export const checkAuthState = async () => {
  try {
    const { data: { session, user }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error getting session:', error);
      return null;
    }
    
    if (session && user) {
      console.log('✅ User is authenticated:');
      console.log('   User ID:', user.id);
      console.log('   Email:', user.email);
      console.log('   Session valid until:', new Date(session.expires_at * 1000));
      return { user, session };
    } else {
      console.log('❌ No active session');
      return null;
    }
  } catch (error) {
    console.error('Error checking auth state:', error);
    return null;
  }
};
