// EMERGENCY FIX FOR LOGIN TIMEOUT ISSUES
// Import this component and use it immediately when you see auth errors

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './src/utils/supabase'; // Adjust path as needed

const AuthEmergencyFix = () => {
  const [isFixing, setIsFixing] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');

  // IMMEDIATE FIX for "Force sign out also timed out after 3000ms" error
  const emergencyFix = async () => {
    setIsFixing(true);
    let logs = '🚨 EMERGENCY AUTH FIX STARTING...\n\n';
    
    try {
      // Step 1: Force clear all auth storage WITHOUT waiting for Supabase
      logs += 'Step 1: Clearing all auth storage keys...\n';
      
      const authKeys = [
        'sb-dmagnsbdjsnzsddxqrwd-auth-token',
        'supabase.auth.token',
        'auth-token',
        'session',
        'user',
        'access_token',
        'refresh_token'
      ];
      
      // Clear each key with individual try/catch to prevent one failure from stopping the process
      for (const key of authKeys) {
        try {
          await AsyncStorage.removeItem(key);
          logs += `✅ Cleared: ${key}\n`;
        } catch (error) {
          logs += `⚠️ Could not clear ${key}: ${error.message}\n`;
        }
      }
      
      // Step 2: Try to clear additional auth-related keys (non-blocking)
      logs += '\nStep 2: Clearing additional auth keys...\n';
      try {
        const allKeys = await AsyncStorage.getAllKeys();
        const authRelatedKeys = allKeys.filter(key => 
          key.includes('supabase') || 
          key.includes('auth') || 
          key.includes('session') ||
          key.includes('dmagnsbdjsnzsddxqrwd')
        );
        
        for (const key of authRelatedKeys) {
          try {
            await AsyncStorage.removeItem(key);
            logs += `✅ Cleared auth-related: ${key}\n`;
          } catch (error) {
            logs += `⚠️ Could not clear ${key}: ${error.message}\n`;
          }
        }
      } catch (error) {
        logs += `⚠️ Could not enumerate storage keys: ${error.message}\n`;
      }
      
      // Step 3: Force sign out with timeout (don't wait if it hangs)
      logs += '\nStep 3: Attempting sign out (with timeout)...\n';
      
      try {
        // Use Promise.race to timeout the sign out after 2 seconds
        const signOutPromise = supabase.auth.signOut();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Sign out timed out')), 2000)
        );
        
        await Promise.race([signOutPromise, timeoutPromise]);
        logs += '✅ Sign out completed successfully\n';
      } catch (error) {
        if (error.message.includes('timed out')) {
          logs += '⚠️ Sign out timed out (this is OK, storage already cleared)\n';
        } else {
          logs += `⚠️ Sign out error (this is OK): ${error.message}\n`;
        }
      }
      
      logs += '\n✅ EMERGENCY FIX COMPLETED!\n';
      logs += '\n🎯 WHAT TO DO NEXT:\n';
      logs += '1. Close and restart your app completely\n';
      logs += '2. Try to sign in again with your credentials\n';
      logs += '3. If you still have issues, contact support\n';
      
      setDebugInfo(logs);
      
      Alert.alert(
        'Fix Applied Successfully!',
        'Authentication data has been cleared. Please:\n\n1. Close and restart the app completely\n2. Try signing in again\n\nThe login timeout issue should now be resolved.',
        [{ text: 'OK' }]
      );
      
    } catch (error) {
      logs += `\n❌ Emergency fix failed: ${error.message}\n`;
      logs += '\n🔧 MANUAL STEPS:\n';
      logs += '1. Close the app completely\n';
      logs += '2. Clear app cache/data from device settings\n';
      logs += '3. Restart the app and try signing in again\n';
      
      setDebugInfo(logs);
      
      Alert.alert(
        'Emergency Fix Error',
        'Automatic fix encountered issues. Please manually clear the app cache from your device settings and restart the app.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsFixing(false);
    }
  };

  const debugCurrentState = async () => {
    setIsFixing(true);
    let logs = '🔍 AUTH DEBUG INFORMATION\n\n';
    
    try {
      // Check current session
      logs += 'Checking current session...\n';
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        logs += `❌ Session error: ${sessionError.message}\n`;
      } else {
        logs += `Session status: ${sessionData.session ? 'Active' : 'None'}\n`;
        if (sessionData.session) {
          logs += `User email: ${sessionData.session.user?.email}\n`;
        }
      }
      
      // Check storage keys
      logs += '\nChecking storage keys...\n';
      const authKeys = [
        'sb-dmagnsbdjsnzsddxqrwd-auth-token',
        'supabase.auth.token',
        'auth-token',
        'session',
        'user'
      ];
      
      for (const key of authKeys) {
        try {
          const value = await AsyncStorage.getItem(key);
          logs += `${key}: ${value ? 'Present' : 'None'}\n`;
          
          if (value) {
            try {
              const parsed = JSON.parse(value);
              if (parsed.expires_at) {
                const expiresAt = new Date(parsed.expires_at * 1000);
                const isExpired = expiresAt < new Date();
                logs += `  Expires: ${expiresAt.toISOString()} ${isExpired ? '(EXPIRED)' : '(Valid)'}\n`;
              }
            } catch (e) {
              logs += '  Data appears corrupted\n';
            }
          }
        } catch (error) {
          logs += `${key}: Error - ${error.message}\n`;
        }
      }
      
    } catch (error) {
      logs += `\n❌ Debug failed: ${error.message}\n`;
    }
    
    logs += '\n=== END DEBUG INFO ===';
    setDebugInfo(logs);
    setIsFixing(false);
  };

  return (
    <ScrollView style={{ flex: 1, padding: 20 }}>
      <View style={{ marginBottom: 30 }}>
        <Text style={{ 
          fontSize: 24, 
          fontWeight: 'bold', 
          textAlign: 'center', 
          marginBottom: 10,
          color: '#d32f2f'
        }}>
          🚨 Emergency Auth Fix
        </Text>
        <Text style={{ 
          fontSize: 14, 
          textAlign: 'center', 
          color: '#666',
          marginBottom: 20
        }}>
          Use this if you're getting "Force sign out timed out" errors
        </Text>
      </View>

      <TouchableOpacity
        style={{
          backgroundColor: '#d32f2f',
          padding: 15,
          marginBottom: 15,
          borderRadius: 8,
          opacity: isFixing ? 0.5 : 1
        }}
        onPress={emergencyFix}
        disabled={isFixing}
      >
        <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: 16 }}>
          {isFixing ? 'Fixing...' : '🔧 Apply Emergency Fix'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={{
          backgroundColor: '#1976d2',
          padding: 15,
          marginBottom: 15,
          borderRadius: 8,
          opacity: isFixing ? 0.5 : 1
        }}
        onPress={debugCurrentState}
        disabled={isFixing}
      >
        <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
          {isFixing ? 'Checking...' : '🔍 Debug Current State'}
        </Text>
      </TouchableOpacity>

      {isFixing && (
        <View style={{ alignItems: 'center', marginVertical: 20 }}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={{ marginTop: 10, textAlign: 'center' }}>Working...</Text>
        </View>
      )}

      {debugInfo ? (
        <View style={{
          backgroundColor: '#f5f5f5',
          padding: 15,
          borderRadius: 8,
          marginTop: 20
        }}>
          <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>
            {debugInfo}
          </Text>
        </View>
      ) : null}

      <View style={{ marginTop: 30, padding: 15, backgroundColor: '#e8f5e8', borderRadius: 8 }}>
        <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 10 }}>
          🎯 How to Use This Fix:
        </Text>
        <Text style={{ fontSize: 14, lineHeight: 20 }}>
          1. Tap "Apply Emergency Fix" when you see login errors{'\n'}
          2. Wait for the process to complete{'\n'}
          3. Close and restart your app completely{'\n'}
          4. Try signing in again{'\n\n'}
          This fix clears corrupted authentication tokens that cause timeout errors.
        </Text>
      </View>
    </ScrollView>
  );
};

export default AuthEmergencyFix;
