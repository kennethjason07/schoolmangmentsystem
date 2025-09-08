import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase } from './supabase';

/**
 * Fix for "Invalid Refresh Token: Refresh Token Not Found" error
 * This utility provides functions to handle authentication issues
 */

export class AuthFix {
  /**
   * Timeout wrapper for async operations
   */
  static async withTimeout(promise, timeoutMs = 5000) {
    return Promise.race([
      promise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }

  /**
   * Clear all authentication data from storage (web-compatible)
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
          await this.withTimeout(AsyncStorage.removeItem(key), 2000);
          console.log(`✅ Cleared: ${key}`);
        } catch (error) {
          console.warn(`⚠️ Could not clear ${key}:`, error.message);
        }
      }
      
      // Only try to get all keys on non-web platforms to avoid hanging
      if (Platform.OS !== 'web') {
        try {
          const allKeys = await this.withTimeout(AsyncStorage.getAllKeys(), 3000);
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
        } catch (error) {
          console.warn('⚠️ Could not enumerate all storage keys (this is normal on web):', error.message);
        }
      } else {
        console.log('🌐 Web platform - skipping key enumeration to prevent hanging');
        
        // On web, try to clear additional web-specific keys
        const webAuthKeys = [
          'supabase.auth.token.dmagnsbdjsnzsddxqrwd',
          'sb.auth.token',
          'auth.session',
          'user.session'
        ];
        
        for (const key of webAuthKeys) {
          try {
            await AsyncStorage.removeItem(key);
            console.log(`✅ Cleared web key: ${key}`);
          } catch (error) {
            // Ignore errors for web-specific keys
          }
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
   * Check if current session is valid and handle invalid refresh tokens (web-safe with timeout)
   */
  static async validateAndFixSession() {
    const VALIDATION_TIMEOUT = Platform.OS === 'web' ? 8000 : 10000; // Shorter timeout for web
    
    try {
      console.log('🔍 Validating current session...');
      
      // Wrap the validation in a timeout to prevent hanging
      const result = await this.withTimeout(this._performSessionValidation(), VALIDATION_TIMEOUT);
      return result;
      
    } catch (error) {
      console.error('❌ Session validation failed or timed out:', error.message);
      
      // If validation times out or fails, assume we need to reauth
      if (error.message.includes('timed out')) {
        console.log('⏱️ Session validation timed out - forcing sign out to prevent infinite loading');
        
        // Don't wait for force sign out to complete if it might also hang
        try {
          await this.withTimeout(this.forceSignOut(), 3000);
        } catch (signOutError) {
          console.warn('⚠️ Force sign out also timed out, continuing anyway:', signOutError.message);
        }
      }
      
      return { valid: false, needsReauth: true, error };
    }
  }
  
  /**
   * Internal method to perform the actual session validation
   */
  static async _performSessionValidation() {
    try {
      // Step 1: Get current session
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
      
      // Step 2: On web, skip refresh to avoid hanging - just return valid session
      if (Platform.OS === 'web') {
        console.log('🌐 Web platform - skipping session refresh to prevent hanging');
        return { valid: true, session: sessionData.session };
      }
      
      // Step 3: On native platforms, try to refresh the session to ensure it's working
      try {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          console.error('❌ Session refresh failed:', refreshError.message);
          
          if (refreshError.message.includes('Invalid Refresh Token') || 
              refreshError.message.includes('Refresh Token Not Found')) {
            console.log('🔧 Refresh failed, clearing auth data...');
            await this.forceSignOut();
            return { valid: false, needsReauth: true };
          }
          
          // Refresh failed but session exists, allow it
          console.log('⚠️ Session refresh failed but session is valid, allowing access');
          return { valid: true, refreshError, session: sessionData.session };
        }
        
        console.log('✅ Session refresh successful');
        return { valid: true, session: refreshData.session || sessionData.session };
        
      } catch (refreshError) {
        console.error('❌ Session refresh exception:', refreshError.message);
        // If refresh throws an error, but we have a session, allow it
        return { valid: true, refreshError, session: sessionData.session };
      }
      
    } catch (error) {
      console.error('❌ Internal session validation error:', error);
      throw error; // Re-throw to be handled by the wrapper
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
