// PASTE THIS INTO YOUR REACT NATIVE APP TO DEBUG AUTH ISSUES
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
          console.log(`Storage ${key}:`, value ? 'Present' : 'None');
        } catch (e) {
          console.log(`Storage ${key}: Error`, e.message);
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
          console.log(`✅ Cleared: ${key}`);
        } catch (e) {
          console.log(`⚠️ Could not clear ${key}:`, e.message);
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

export default AuthDebugScreen;