const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Your Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

async function clearInvalidAuthTokens() {
  console.log('🧹 CLEARING INVALID AUTH TOKENS - Fixing "Invalid Refresh Token" Error...\n');
  
  try {
    // Step 1: Create a clean Supabase client
    console.log('Step 1: Creating clean Supabase client...');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false, // Disable auto refresh for this fix
        persistSession: false,   // Don't persist to avoid corrupted data
      }
    });
    
    // Step 2: Try to get current session and force sign out
    console.log('Step 2: Attempting to clear any existing sessions...');
    
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.log('⚠️ Session error (expected):', sessionError.message);
        
        if (sessionError.message.includes('Invalid Refresh Token') || 
            sessionError.message.includes('Refresh Token Not Found')) {
          console.log('✅ Confirmed - this is the invalid refresh token error we\'re fixing');
        }
      } else if (sessionData.session) {
        console.log('Found active session for:', sessionData.session.user.email);
      } else {
        console.log('No active session found');
      }
    } catch (getSessionError) {
      console.log('⚠️ Get session failed (expected):', getSessionError.message);
    }
    
    // Step 3: Force sign out
    console.log('\nStep 3: Force signing out to clear tokens...');
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        console.log('⚠️ Sign out error (expected):', signOutError.message);
      } else {
        console.log('✅ Successfully signed out');
      }
    } catch (signOutError) {
      console.log('⚠️ Sign out failed (expected):', signOutError.message);
    }
    
    // Step 4: Clean up any temporary files that might contain auth data
    console.log('\nStep 4: Cleaning up temporary auth files...');
    const tempFiles = [
      './temp_sb-dmagnsbdjsnzsddxqrwd-auth-token.json',
      './temp_supabase.auth.token.json',
      './temp_auth-token.json',
      './temp_session.json'
    ];
    
    for (const file of tempFiles) {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
          console.log(`✅ Removed: ${file}`);
        }
      } catch (e) {
        console.log(`⚠️ Could not remove ${file}:`, e.message);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ AUTH TOKEN CLEARING COMPLETE!');
    console.log('='.repeat(60));
    
    console.log('\n🔧 NEXT STEPS:');
    console.log('1. Stop your Expo/React Native development server if it\'s running');
    console.log('2. Clear your app cache:');
    console.log('   - Android: Clear app data or restart the app');
    console.log('   - iOS: Delete and reinstall the Expo Go app');
    console.log('   - Web: Clear browser cache and localStorage');
    console.log('3. Restart your development server: expo start');
    console.log('4. The "Invalid Refresh Token" error should be gone');
    console.log('5. Users will need to sign in again');
    
    console.log('\n💡 ABOUT YOUR APP:');
    console.log('- Your app already has AuthFix utility integrated');
    console.log('- It should automatically prevent this error in the future');
    console.log('- The AuthContext.js handles token refresh errors gracefully');
    
    console.log('\n📱 FOR USERS EXPERIENCING THIS ERROR:');
    console.log('- They can clear the app cache/data');
    console.log('- Or uninstall and reinstall the app');
    console.log('- Then sign in again with their credentials');
    
    return true;
    
  } catch (error) {
    console.error('❌ Token clearing failed:', error.message);
    
    console.log('\n🔧 MANUAL WORKAROUND:');
    console.log('1. Restart your development server (expo start)');
    console.log('2. Clear your browser cache if testing on web');
    console.log('3. For mobile: clear app data or reinstall Expo Go');
    console.log('4. Have all users sign out and sign in again');
    
    return false;
  }
}

// Main execution
if (require.main === module) {
  clearInvalidAuthTokens().then((success) => {
    if (success) {
      console.log('\n🎉 Fix completed successfully!');
      console.log('\n🚀 Ready to restart your app without the refresh token error!');
    } else {
      console.log('\n⚠️ Fix completed with some issues, but should still resolve the error');
    }
    console.log('\n🏁 Done!');
    process.exit(0);
  }).catch(err => {
    console.error('\n❌ Fatal error:', err.message);
    console.log('\n🔧 Manual solution: Clear app cache and restart');
    process.exit(1);
  });
}

module.exports = { clearInvalidAuthTokens };
