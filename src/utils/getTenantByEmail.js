/**
 * Utility to get tenant_id by referencing email address
 * This bypasses the user ID matching issue and looks up tenant directly by email
 */

import { supabase } from './supabase';

export const getTenantIdByEmail = async (email) => {
  console.log('📧 EMAIL LOOKUP: Starting tenant lookup by email:', email);
  
  try {
    // Validate email format first
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      console.error('📧 EMAIL LOOKUP: Invalid email format:', email);
      return {
        success: false,
        error: 'Invalid email format provided',
        code: 'INVALID_EMAIL_FORMAT'
      };
    }
    
    // Step 1: Look up user record by email address (case-insensitive)
    console.log('📧 EMAIL LOOKUP: Step 1 - Searching users table by email (case-insensitive)...');
    console.log('📧 EMAIL LOOKUP: Original email:', email);
    console.log('📧 EMAIL LOOKUP: Lowercase email:', email.toLowerCase());
    
    // Try case-insensitive email lookup using ilike
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('id, email, tenant_id, full_name, role_id, created_at')
      .ilike('email', email) // Use ilike for case-insensitive matching
      .maybeSingle(); // Use maybeSingle to avoid error when no rows found
    
    if (userError) {
      console.error('📧 EMAIL LOOKUP: Error querying users by email:', userError);
      return { 
        success: false, 
        error: `Database connection error: ${userError.message}. Please check your internet connection and try again.`,
        code: userError.code,
        isNetworkError: true
      };
    }
    
    if (!userRecord) {
      console.log('📧 EMAIL LOOKUP: ❌ No user record found for email:', email);
      return { 
        success: false, 
        error: `No account found for ${email}. Please contact your administrator to set up your account.`,
        notFound: true,
        userFriendlyError: `Account Setup Required`,
        suggestions: [
          'Contact your school administrator',
          'Verify your email address is correct',
          'Check if you have been registered in the system'
        ]
      };
    }
    
    console.log('📧 EMAIL LOOKUP: ✅ Found user record by email:', {
      id: userRecord.id,
      email: userRecord.email,
      tenant_id: userRecord.tenant_id,
      full_name: userRecord.full_name
    });
    
    if (!userRecord.tenant_id) {
      console.log('📧 EMAIL LOOKUP: ❌ User record exists but has no tenant_id assigned');
      return { 
        success: false, 
        error: `Your account (${email}) is not assigned to a school yet. Please contact your administrator.`,
        userRecord,
        needsTenantAssignment: true,
        userFriendlyError: 'Account Not Assigned',
        suggestions: [
          'Contact your school administrator to assign you to the correct school',
          'Verify you are logging in with the correct email address',
          'Check if your account setup is complete'
        ]
      };
    }
    
    // Step 2: Get tenant details using the tenant_id
    console.log('📧 EMAIL LOOKUP: Step 2 - Fetching tenant details for ID:', userRecord.tenant_id);
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', userRecord.tenant_id)
      .single();
    
    if (tenantError) {
      console.error('📧 EMAIL LOOKUP: Error fetching tenant:', tenantError);
      return { 
        success: false, 
        error: `School information could not be loaded: ${tenantError.message}. Please try again or contact support.`,
        userRecord,
        tenantId: userRecord.tenant_id,
        isNetworkError: true,
        userFriendlyError: 'School Data Loading Error'
      };
    }
    
    if (!tenant) {
      console.log('📧 EMAIL LOOKUP: ❌ Tenant not found for ID:', userRecord.tenant_id);
      return { 
        success: false, 
        error: `Your assigned school (ID: ${userRecord.tenant_id}) could not be found. This may be a system configuration issue.`,
        userRecord,
        tenantId: userRecord.tenant_id,
        userFriendlyError: 'School Configuration Error',
        suggestions: [
          'Contact your system administrator',
          'This appears to be a data configuration issue',
          'Your account may need to be reassigned to the correct school'
        ]
      };
    }
    
    console.log('📧 EMAIL LOOKUP: ✅ Successfully found tenant:', {
      id: tenant.id,
      name: tenant.name,
      subdomain: tenant.subdomain,
      status: tenant.status
    });
    
    // Step 3: Verify tenant is active
    if (tenant.status !== 'active') {
      console.warn('📧 EMAIL LOOKUP: ⚠️ Tenant is not active:', tenant.status);
      return {
        success: false,
        error: `Your school "${tenant.name}" is currently ${tenant.status}. Access is temporarily restricted.`,
        userRecord,
        tenant,
        tenantInactive: true,
        userFriendlyError: 'School Access Restricted',
        suggestions: [
          'Contact your school administrator',
          'Your school account may be temporarily suspended',
          'Check with your IT department for access restoration'
        ]
      };
    }
    
    console.log('📧 EMAIL LOOKUP: 🎉 SUCCESS! Complete tenant lookup successful');
    
    return {
      success: true,
      data: {
        userRecord,
        tenant,
        tenantId: tenant.id,
        tenantName: tenant.name
      }
    };
    
  } catch (error) {
    console.error('📧 EMAIL LOOKUP: Unexpected error:', error);
    return {
      success: false,
      error: `Unexpected error: ${error.message}`
    };
  }
};

export const getCurrentUserTenantByEmail = async () => {
  console.log('📧 CURRENT USER: Getting tenant for current authenticated user...');
  console.log('📧 CURRENT USER: Timestamp:', new Date().toISOString());
  
  try {
    // Get current authenticated user with enhanced debugging
    console.log('📧 CURRENT USER: Calling supabase.auth.getUser()...');
    const authResult = await supabase.auth.getUser();
    console.log('📧 CURRENT USER: Auth result received:', {
      hasData: !!authResult.data,
      hasUser: !!authResult.data?.user,
      hasError: !!authResult.error,
      errorMessage: authResult.error?.message || 'none',
      userEmail: authResult.data?.user?.email || 'none',
      userId: authResult.data?.user?.id || 'none'
    });
    
    const { data: { user }, error: authError } = authResult;
    
    if (authError || !user) {
      console.log('📧 CURRENT USER: No authenticated user found (expected for login screen):', authError?.message || 'Auth session missing!');
      console.log('📧 CURRENT USER: Detailed auth error:', {
        errorCode: authError?.status || 'unknown',
        errorMessage: authError?.message || 'no message',
        hasUser: !!user,
        authErrorObject: authError
      });
      return { 
        success: false, 
        error: 'No authenticated user found',
        code: 'NO_AUTH_USER',
        isAuthError: true,
        debugInfo: {
          authError,
          hasUser: !!user,
          timestamp: new Date().toISOString()
        }
      };
    }
    
    console.log('📧 CURRENT USER: ✅ Authenticated user:', {
      id: user.id,
      email: user.email,
      emailLength: user.email?.length,
      emailCase: {
        original: user.email,
        lowercase: user.email?.toLowerCase(),
        uppercase: user.email?.toUpperCase()
      }
    });
    
    // Get tenant by email with case debugging
    console.log('📧 CURRENT USER: Calling getTenantIdByEmail with email:', user.email);
    const result = await getTenantIdByEmail(user.email);
    
    if (result.success) {
      console.log('📧 CURRENT USER: ✅ Tenant found for current user:', result.data.tenantName);
    } else {
      console.log('📧 CURRENT USER: ❌ Failed to get tenant for current user:', result.error);
    }
    
    return result;
    
  } catch (error) {
    console.error('📧 CURRENT USER: Unexpected error:', error);
    return {
      success: false,
      error: `Unexpected error: ${error.message}`
    };
  }
};

export const getAllUserEmails = async () => {
  console.log('📧 ALL USERS: Getting all user emails for debugging...');
  
  try {
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, tenant_id, full_name, created_at')
      .order('created_at', { ascending: false });
    
    if (usersError) {
      console.error('📧 ALL USERS: Error fetching users:', usersError);
      return { success: false, error: `Error fetching users: ${usersError.message}` };
    }
    
    console.log('📧 ALL USERS: ✅ Found users:', users?.length || 0);
    users?.forEach((user, index) => {
      console.log(`📧 ALL USERS: ${index + 1}. ${user.email} (ID: ${user.id}) - Tenant: ${user.tenant_id || 'NONE'}`);
    });
    
    return {
      success: true,
      data: {
        users: users || [],
        count: users?.length || 0
      }
    };
    
  } catch (error) {
    console.error('📧 ALL USERS: Unexpected error:', error);
    return {
      success: false,
      error: `Unexpected error: ${error.message}`
    };
  }
};

/**
 * Get user-friendly error message and suggestions from tenant lookup result
 * @param {Object} result - Result from getTenantIdByEmail or getCurrentUserTenantByEmail
 * @returns {Object} - { title, message, suggestions, isRetryable }
 */
export const getUserFriendlyTenantError = (result) => {
  if (!result || result.success) {
    return null;
  }

  const defaultError = {
    title: 'Access Error',
    message: result.error || 'Unable to access your account',
    suggestions: ['Please try again', 'Contact support if the issue persists'],
    isRetryable: true
  };

  // Handle specific error types with user-friendly messages
  if (result.userFriendlyError) {
    return {
      title: result.userFriendlyError,
      message: result.error,
      suggestions: result.suggestions || defaultError.suggestions,
      isRetryable: result.isNetworkError || false
    };
  }

  // Handle auth errors
  if (result.isAuthError || result.code === 'NO_AUTH_USER') {
    return {
      title: 'Login Required',
      message: 'Please log in to access your account',
      suggestions: ['Log in with your school credentials', 'Contact your administrator if you need help'],
      isRetryable: false
    };
  }

  // Handle network errors
  if (result.isNetworkError) {
    return {
      title: 'Connection Error',
      message: 'Unable to connect to the server',
      suggestions: ['Check your internet connection', 'Try again in a moment'],
      isRetryable: true
    };
  }

  return defaultError;
};

/**
 * Display user-friendly tenant error using React Native Alert
 * @param {Object} result - Result from tenant lookup
 * @param {Function} onRetry - Optional retry function
 * @param {Function} onCancel - Optional cancel function
 */
export const showTenantErrorAlert = (result, onRetry = null, onCancel = null) => {
  const errorInfo = getUserFriendlyTenantError(result);
  if (!errorInfo) return;

  const { Alert } = require('react-native');

  const buttons = [];
  
  if (onCancel) {
    buttons.push({ text: 'Cancel', style: 'cancel', onPress: onCancel });
  }
  
  if (onRetry && errorInfo.isRetryable) {
    buttons.push({ text: 'Retry', onPress: onRetry });
  } else {
    buttons.push({ text: 'OK' });
  }

  const message = `${errorInfo.message}\n\nSuggestions:\n${errorInfo.suggestions.map(s => `• ${s}`).join('\n')}`;

  Alert.alert(errorInfo.title, message, buttons);
};
