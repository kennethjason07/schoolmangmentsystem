import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { AuthFix } from '../utils/authFix';
import { supabase } from '../utils/supabase';

/**
 * Example component showing how to integrate AuthFix
 * Use this pattern in your existing authentication components
 */

const AuthFixExample = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [authState, setAuthState] = useState('checking');

  useEffect(() => {
    // Initialize authentication with error handling
    initializeAuth();
    
    // Set up auth state listener with error handling
    const authListener = AuthFix.setupAuthStateListener(handleAuthStateChange);
    
    return () => {
      // Cleanup listener
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const initializeAuth = async () => {
    try {
      setIsLoading(true);
      setAuthState('checking');
      
      console.log('🔄 Initializing authentication...');
      
      // Validate current session and fix any issues
      const sessionResult = await AuthFix.validateAndFixSession();
      
      if (sessionResult.valid && sessionResult.session) {
        // Session is valid
        setUser(sessionResult.session.user);
        setAuthState('authenticated');
        console.log('✅ User is authenticated:', sessionResult.session.user.email);
      } else if (sessionResult.needsReauth) {
        // Need to re-authenticate
        setUser(null);
        setAuthState('unauthenticated');
        console.log('ℹ️ User needs to sign in');
      } else {
        // Some other error
        setUser(null);
        setAuthState('error');
        console.error('❌ Authentication error:', sessionResult.error);
      }
      
    } catch (error) {
      console.error('❌ Initialize auth failed:', error);
      setUser(null);
      setAuthState('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthStateChange = (event, session) => {
    console.log('🔄 Auth state change:', event);
    
    switch (event) {
      case 'SIGNED_IN':
        setUser(session?.user || null);
        setAuthState('authenticated');
        break;
      case 'SIGNED_OUT':
        setUser(null);
        setAuthState('unauthenticated');
        break;
      case 'TOKEN_REFRESHED':
        setUser(session?.user || null);
        setAuthState('authenticated');
        break;
      case 'USER_UPDATED':
        setUser(session?.user || null);
        break;
      default:
        console.log('Unhandled auth event:', event);
    }
  };

  const handleSafeSignIn = async (email, password) => {
    try {
      setIsLoading(true);
      
      const result = await AuthFix.signInSafely(email, password);
      
      if (result.success) {
        // Sign in successful - state will be updated by auth listener
        Alert.alert('Success', 'Signed in successfully!');
      } else {
        // Sign in failed
        Alert.alert('Sign In Failed', result.error?.message || 'Unknown error');
      }
      
    } catch (error) {
      console.error('❌ Sign in error:', error);
      Alert.alert('Error', 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSafeSignOut = async () => {
    try {
      setIsLoading(true);
      
      await AuthFix.forceSignOut();
      
      // State will be updated by auth listener
      Alert.alert('Success', 'Signed out successfully!');
      
    } catch (error) {
      console.error('❌ Sign out error:', error);
      Alert.alert('Error', 'Failed to sign out');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearAuthData = async () => {
    Alert.alert(
      'Clear Authentication Data',
      'This will clear all stored authentication data and sign you out. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              await AuthFix.forceSignOut();
              Alert.alert('Success', 'Authentication data cleared!');
            } catch (error) {
              console.error('❌ Clear auth data error:', error);
              Alert.alert('Error', 'Failed to clear authentication data');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleDebugAuth = async () => {
    await AuthFix.debugAuthState();
    Alert.alert('Debug Complete', 'Check console for debug information');
  };

  const handleGetCurrentUser = async () => {
    try {
      setIsLoading(true);
      
      const result = await AuthFix.getCurrentUserSafely();
      
      if (result.user) {
        Alert.alert('Current User', `Email: ${result.user.email}\nID: ${result.user.id}`);
      } else if (result.needsReauth) {
        Alert.alert('Authentication Required', 'Please sign in again');
        setAuthState('unauthenticated');
      } else {
        Alert.alert('Error', result.error?.message || 'Failed to get user');
      }
      
    } catch (error) {
      console.error('❌ Get current user error:', error);
      Alert.alert('Error', 'Failed to get current user');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={{ marginTop: 16, fontSize: 16 }}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: '#f5f5f5' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' }}>
        Auth Fix Example
      </Text>
      
      <View style={{ backgroundColor: 'white', padding: 15, borderRadius: 8, marginBottom: 20 }}>
        <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>Current State:</Text>
        <Text style={{ fontSize: 14, color: '#666' }}>Auth State: {authState}</Text>
        {user && (
          <View style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 14, color: '#666' }}>User: {user.email}</Text>
            <Text style={{ fontSize: 14, color: '#666' }}>ID: {user.id}</Text>
          </View>
        )}
      </View>

      <View style={{ gap: 12 }}>
        {authState === 'unauthenticated' && (
          <TouchableOpacity
            style={{ backgroundColor: '#0066cc', padding: 15, borderRadius: 8 }}
            onPress={() => handleSafeSignIn('your-email@example.com', 'your-password')}
          >
            <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
              Safe Sign In (Demo)
            </Text>
          </TouchableOpacity>
        )}

        {authState === 'authenticated' && (
          <TouchableOpacity
            style={{ backgroundColor: '#dc3545', padding: 15, borderRadius: 8 }}
            onPress={handleSafeSignOut}
          >
            <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
              Safe Sign Out
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={{ backgroundColor: '#28a745', padding: 15, borderRadius: 8 }}
          onPress={handleGetCurrentUser}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
            Get Current User Safely
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{ backgroundColor: '#ffc107', padding: 15, borderRadius: 8 }}
          onPress={handleClearAuthData}
        >
          <Text style={{ color: 'black', textAlign: 'center', fontWeight: 'bold' }}>
            Clear Auth Data (Emergency)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{ backgroundColor: '#6c757d', padding: 15, borderRadius: 8 }}
          onPress={handleDebugAuth}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
            Debug Auth State
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{ backgroundColor: '#17a2b8', padding: 15, borderRadius: 8 }}
          onPress={initializeAuth}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
            Reinitialize Auth
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ marginTop: 30, padding: 15, backgroundColor: '#e9ecef', borderRadius: 8 }}>
        <Text style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 8 }}>Quick Fix Instructions:</Text>
        <Text style={{ fontSize: 12, color: '#495057', lineHeight: 18 }}>
          1. If you see "Invalid Refresh Token" error, tap "Clear Auth Data"{'\n'}
          2. Sign in again{'\n'}
          3. Use "Safe Sign In" for automatic error handling{'\n'}
          4. Use "Debug Auth State" to check console logs{'\n'}
        </Text>
      </View>
    </View>
  );
};

export default AuthFixExample;
