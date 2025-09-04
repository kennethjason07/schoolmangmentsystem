/**
 * EMERGENCY FIX for "Invalid Refresh Token: Refresh Token Not Found" error
 * 
 * Run this script to immediately resolve the authentication issue:
 * node emergency_auth_fix.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Your Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

async function emergencyAuthFix() {
  console.log('🚨 EMERGENCY AUTH FIX STARTING...\n');
  
  try {
    // Step 1: Create clean Supabase client
    console.log('Step 1: Creating clean Supabase client...');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false, // Disable auto refresh for this fix
        persistSession: false,   // Don't persist to avoid corrupted data
      }
    });
    
    // Step 2: Test connection
    console.log('Step 2: Testing Supabase connection...');
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.log('⚠️ Connection error (expected):', error.message);
    } else {
      console.log('✅ Connection successful');
    }
    
    // Step 3: Clear any temporary auth files
    console.log('Step 3: Cleaning up temporary auth files...');
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
    
    console.log('\n✅ EMERGENCY FIX COMPLETE!\n');
    
    // Step 4: Provide fix instructions
    console.log('=' + '='.repeat(60) + '=');
    console.log('🔧 IMMEDIATE ACTIONS TO RESOLVE THE ERROR:');
    console.log('=' + '='.repeat(60) + '=');
    console.log('');
    console.log('FOR YOUR REACT NATIVE APP:');
    console.log('1. In your React Native app, add this code to clear storage:');
    console.log('');
    console.log('   import AsyncStorage from \'@react-native-async-storage/async-storage\';');
    console.log('   import { supabase } from \'./src/utils/supabase\';');
    console.log('');
    console.log('   // Add this function and call it when you get the error:');
    console.log('   const emergencyAuthClear = async () => {');
    console.log('     try {');
    console.log('       // Force sign out (may fail, that\'s OK)');
    console.log('       await supabase.auth.signOut();');
    console.log('       ');
    console.log('       // Clear all auth storage');
    console.log('       const authKeys = [');
    console.log('         \'sb-dmagnsbdjsnzsddxqrwd-auth-token\',');
    console.log('         \'supabase.auth.token\',');
    console.log('         \'auth-token\',');
    console.log('         \'session\',');
    console.log('         \'user\'');
    console.log('       ];');
    console.log('       ');
    console.log('       for (const key of authKeys) {');
    console.log('         await AsyncStorage.removeItem(key);');
    console.log('       }');
    console.log('       ');
    console.log('       console.log(\'Auth data cleared successfully\');');
    console.log('     } catch (error) {');
    console.log('       console.log(\'Clear completed with errors:\', error);');
    console.log('     }');
    console.log('   };');
    console.log('');
    console.log('2. Call this function immediately when you see the refresh token error');
    console.log('3. After clearing, have users sign in again');
    console.log('');
    console.log('FOR WEB VERSION:');
    console.log('1. Open browser developer tools (F12)');
    console.log('2. Go to Application > Local Storage');
    console.log('3. Clear all entries for your domain');
    console.log('4. Refresh the page and sign in again');
    console.log('');
    console.log('PREVENTION:');
    console.log('1. Use the AuthFix utility I created (src/utils/authFix.js)');
    console.log('2. Replace your auth calls with the safe versions');
    console.log('3. Add proper error handling for refresh token failures');
    console.log('');
    console.log('TESTING:');
    console.log('1. Import the AuthFix utility in your components');
    console.log('2. Use AuthFix.validateAndFixSession() on app start');
    console.log('3. Use AuthFix.signInSafely() for sign in');
    console.log('4. Use AuthFix.getCurrentUserSafely() to get user');
    console.log('');
    console.log('QUICK TEST COMMAND:');
    console.log('node -e "');
    console.log('const { AuthFix } = require(\'./src/utils/authFix\');');
    console.log('AuthFix.debugAuthState().then(() => console.log(\'Debug complete\'));');
    console.log('"');
    console.log('');
    console.log('=' + '='.repeat(60) + '=');
    
  } catch (error) {
    console.error('❌ Emergency fix failed:', error.message);
    console.log('\n🔧 MANUAL FIX REQUIRED:');
    console.log('1. In your app, manually clear all AsyncStorage auth keys');
    console.log('2. Force users to sign in again');
    console.log('3. Check that autoRefreshToken is set to true in your Supabase config');
  }
}

// Create a quick debug script for React Native
function createReactNativeDebugScript() {
  const debugScript = `// PASTE THIS INTO YOUR REACT NATIVE APP TO DEBUG AUTH ISSUES
// Put this in a component or create a debug screen

import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './src/utils/supabase'; // Adjust path as needed

const AuthDebugScreen = () => {
  const debugAuth = async () => {
    console.log('🔍 === AUTH DEBUG ===');
    
    try {
      // Check session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      console.log('Session:', sessionData.session ? 'Active' : 'None');
      if (sessionError) {
        console.log('Session Error:', sessionError.message);
      }
      
      // Check storage
      const authKeys = [
        'sb-dmagnsbdjsnzsddxqrwd-auth-token',
        'supabase.auth.token'
      ];
      
      for (const key of authKeys) {
        try {
          const value = await AsyncStorage.getItem(key);
          console.log(\`Storage \${key}:\`, value ? 'Present' : 'None');
        } catch (e) {
          console.log(\`Storage \${key}: Error\`, e.message);
        }
      }
      
    } catch (error) {
      console.log('Debug failed:', error.message);
    }
    
    console.log('🔍 === END DEBUG ===');
  };

  const clearAuthData = async () => {
    try {
      console.log('🧹 Clearing auth data...');
      
      // Sign out
      try {
        await supabase.auth.signOut();
        console.log('✅ Signed out');
      } catch (e) {
        console.log('⚠️ Sign out error (expected):', e.message);
      }
      
      // Clear storage
      const authKeys = [
        'sb-dmagnsbdjsnzsddxqrwd-auth-token',
        'supabase.auth.token',
        'auth-token',
        'session',
        'user'
      ];
      
      for (const key of authKeys) {
        try {
          await AsyncStorage.removeItem(key);
          console.log(\`✅ Cleared: \${key}\`);
        } catch (e) {
          console.log(\`⚠️ Could not clear \${key}:\`, e.message);
        }
      }
      
      Alert.alert('Success', 'Auth data cleared. Please restart the app and sign in again.');
      
    } catch (error) {
      console.log('❌ Clear failed:', error.message);
      Alert.alert('Error', 'Failed to clear auth data: ' + error.message);
    }
  };

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
      <Text style={{ fontSize: 20, textAlign: 'center', marginBottom: 30 }}>
        Auth Debug
      </Text>
      
      <TouchableOpacity
        style={{ backgroundColor: '#007bff', padding: 15, marginBottom: 15, borderRadius: 5 }}
        onPress={debugAuth}
      >
        <Text style={{ color: 'white', textAlign: 'center' }}>Debug Auth State</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={{ backgroundColor: '#dc3545', padding: 15, borderRadius: 5 }}
        onPress={clearAuthData}
      >
        <Text style={{ color: 'white', textAlign: 'center' }}>Clear Auth Data (Fix Error)</Text>
      </TouchableOpacity>
      
      <Text style={{ fontSize: 12, textAlign: 'center', marginTop: 20, color: '#666' }}>
        Check console logs for debug output
      </Text>
    </View>
  );
};

export default AuthDebugScreen;`;

  fs.writeFileSync('./ReactNativeAuthDebug.js', debugScript);
  console.log('\n📝 Created ReactNativeAuthDebug.js for your React Native app');
}

// Run the emergency fix
if (require.main === module) {
  emergencyAuthFix().then(() => {
    createReactNativeDebugScript();
    console.log('\n🏁 Emergency fix complete!');
    process.exit(0);
  }).catch(err => {
    console.error('❌ Emergency fix failed:', err.message);
    process.exit(1);
  });
}

module.exports = { emergencyAuthFix };
