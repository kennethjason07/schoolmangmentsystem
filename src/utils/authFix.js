import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

/**
 * Fix for "Invalid Refresh Token: Refresh Token Not Found" error
 * This utility provides functions to handle authentication issues
 */

export class AuthFix {
  /**
   * Clear all authentication data from storage
   */
  static async clearAllAuthData() {
    try {
      console.log('🧹 Clearing all authentication data...');
      
      // List of possible auth storage keys
      const authKeys = [
        'sb-dmagnsbdjsnzsddxqrwd-auth-token',
        'supabase.auth.token', 
        'auth-token',
        'session',
        'user',
        'access_token',
        'refresh_token'
      ];
      
      // Clear each key
      for (const key of authKeys) {
        try {
          await AsyncStorage.removeItem(key);
          console.log(`✅ Cleared: ${key}`);
        } catch (error) {
          console.warn(`⚠️ Could not clear ${key}:`, error.message);
        }
      }
      
      // Clear all keys that start with supabase auth pattern
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
          console.log(`✅ Cleared auth-related key: ${key}`);
        } catch (error) {
          console.warn(`⚠️ Could not clear ${key}:`, error.message);
        }
      }
      
      console.log('✅ All authentication data cleared');
      return true;
    } catch (error) {
      console.error('❌ Error clearing auth data:', error);
      return false;
    }
  }

  /**
   * Force sign out and clear all data
   */
  static async forceSignOut() {
    try {
      console.log('🚪 Force signing out...');
      
      // Try to sign out through Supabase (may fail if token is invalid)
      try {
        const { error } = await supabase.auth.signOut();
        if (error) {
          console.warn('⚠️ Supabase signOut error (expected):', error.message);
        } else {
          console.log('✅ Supabase signOut successful');
        }
      } catch (signOutError) {
        console.warn('⚠️ Supabase signOut failed (expected):', signOutError.message);
      }
      
      // Clear all storage regardless of signOut result
      await this.clearAllAuthData();
      
      console.log('✅ Force sign out complete');
      return true;
    } catch (error) {
      console.error('❌ Force sign out error:', error);
      return false;
    }
  }

  /**
   * Check if current session is valid and handle invalid refresh tokens
   */
  static async validateAndFixSession() {
    try {
      console.log('🔍 Validating current session...');
      
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('❌ Session error:', sessionError.message);
        
        // If it's a refresh token error, clear everything
        if (sessionError.message.includes('Invalid Refresh Token') || 
            sessionError.message.includes('Refresh Token Not Found')) {
          console.log('🔧 Detected refresh token issue, clearing auth data...');
          await this.forceSignOut();
          return { valid: false, needsReauth: true };
        }
        
        return { valid: false, needsReauth: true, error: sessionError };
      }
      
      if (!sessionData.session) {
        console.log('ℹ️ No active session');
        return { valid: false, needsReauth: true };
      }
      
      console.log('✅ Session is valid');
      console.log('User:', sessionData.session.user.email);
      
      // Try to refresh the session to ensure it's working
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        console.error('❌ Session refresh failed:', refreshError.message);
        
        if (refreshError.message.includes('Invalid Refresh Token') || 
            refreshError.message.includes('Refresh Token Not Found')) {
          console.log('🔧 Refresh failed, clearing auth data...');
          await this.forceSignOut();
          return { valid: false, needsReauth: true };
        }
        
        return { valid: true, refreshError }; // Session exists but refresh failed
      }
      
      console.log('✅ Session refresh successful');
      return { valid: true, session: sessionData.session };
      
    } catch (error) {
      console.error('❌ Session validation error:', error);
      
      // If it's any auth error, clear everything to be safe
      await this.forceSignOut();
      return { valid: false, needsReauth: true, error };
    }
  }

  /**
   * Wrapper for sign in with automatic error handling
   */
  static async signInSafely(email, password) {
    try {
      console.log('🔐 Attempting safe sign in...');
      
      // Clear any existing invalid session first
      await this.forceSignOut();
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });
      
      if (error) {
        console.error('❌ Sign in error:', error.message);
        return { success: false, error };
      }
      
      console.log('✅ Sign in successful');
      console.log('User:', data.user.email);
      
      return { success: true, user: data.user, session: data.session };
      
    } catch (error) {
      console.error('❌ Sign in failed:', error);
      return { success: false, error };
    }
  }

  /**
   * Enhanced auth state change listener with error handling
   */
  static setupAuthStateListener(onAuthStateChange) {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state changed:', event);
      
      try {
        if (event === 'SIGNED_OUT') {
          console.log('👋 User signed out');
          // Clear any remaining auth data
          await this.clearAllAuthData();
        } else if (event === 'SIGNED_IN') {
          console.log('👋 User signed in:', session?.user?.email);
        } else if (event === 'TOKEN_REFRESHED') {
          console.log('🔄 Token refreshed successfully');
        } else if (event === 'USER_UPDATED') {
          console.log('👤 User updated');
        }
        
        // Call the provided callback
        onAuthStateChange(event, session);
        
      } catch (error) {
        console.error('❌ Auth state change error:', error);
        
        // If there's an error in handling auth state, clear everything
        if (error.message && error.message.includes('refresh')) {
          console.log('🔧 Auth state error contains refresh issue, clearing data...');
          await this.forceSignOut();
          onAuthStateChange('SIGNED_OUT', null);
        }
      }
    });
    
    return authListener;
  }

  /**
   * Get current user safely with error handling
   */
  static async getCurrentUserSafely() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) {
        console.error('❌ Get user error:', error.message);
        
        if (error.message.includes('Invalid Refresh Token') || 
            error.message.includes('Refresh Token Not Found')) {
          console.log('🔧 Get user failed due to token issue, clearing auth data...');
          await this.forceSignOut();
          return { user: null, needsReauth: true };
        }
        
        return { user: null, error };
      }
      
      return { user, error: null };
      
    } catch (error) {
      console.error('❌ Get current user failed:', error);
      await this.forceSignOut();
      return { user: null, needsReauth: true };
    }
  }

  /**
   * Debug function to check current auth state
   */
  static async debugAuthState() {
    console.log('🔍 === AUTH DEBUG INFO ===');
    
    try {
      // Check session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      console.log('Session:', sessionData.session ? 'Active' : 'None');
      if (sessionError) {
        console.log('Session Error:', sessionError.message);
      }
      
      // Check stored data
      const authKeys = [
        'sb-dmagnsbdjsnzsddxqrwd-auth-token',
        'supabase.auth.token'
      ];
      
      for (const key of authKeys) {
        try {
          const value = await AsyncStorage.getItem(key);
          if (value) {
            console.log(`Storage ${key}:`, value ? 'Present' : 'None');
            try {
              const parsed = JSON.parse(value);
              if (parsed.expires_at) {
                const expiresAt = new Date(parsed.expires_at * 1000);
                const isExpired = expiresAt < new Date();
                console.log(`  Expires: ${expiresAt.toISOString()} ${isExpired ? '(EXPIRED)' : '(Valid)'}`);
              }
            } catch (e) {
              console.log('  Data appears corrupted');
            }
          } else {
            console.log(`Storage ${key}: None`);
          }
        } catch (e) {
          console.log(`Storage ${key}: Error -`, e.message);
        }
      }
      
    } catch (error) {
      console.error('Debug failed:', error);
    }
    
    console.log('🔍 === END DEBUG INFO ===');
  }
}

export default AuthFix;
