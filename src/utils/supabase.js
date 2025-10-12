import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

// Enhanced storage adapter with detailed logging for debugging
const customStorageAdapter = {
  getItem: (key) => {
    try {
      if (Platform.OS === 'web') {
        // Use window.localStorage directly on web for better compatibility
        if (typeof window !== 'undefined' && window.localStorage) {
          const value = window.localStorage.getItem(key);
          console.log(`📦 [Storage] GET ${key}:`, value ? 'Found' : 'Not found');
          return value ?? null;
        }
        console.warn('📦 [Storage] localStorage not available');
        return null;
      }
      return AsyncStorage.getItem(key);
    } catch (error) {
      console.error('📦 [Storage] getItem error for', key, ':', error);
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      if (Platform.OS === 'web') {
        // Use window.localStorage directly on web for better compatibility
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
          console.log(`📦 [Storage] SET ${key}:`, 'Stored successfully');
          
          // Verify storage worked
          const stored = window.localStorage.getItem(key);
          if (!stored) {
            console.error(`📦 [Storage] VERIFICATION FAILED for ${key} - value not stored`);
          }
          
          return Promise.resolve();
        }
        console.warn('📦 [Storage] localStorage not available for setItem');
        return Promise.resolve();
      }
      return AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error('📦 [Storage] setItem error for', key, ':', error);
      return Promise.resolve();
    }
  },
  removeItem: (key) => {
    try {
      if (Platform.OS === 'web') {
        // Use window.localStorage directly on web for better compatibility
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
          console.log(`📦 [Storage] REMOVE ${key}:`, 'Removed successfully');
          return Promise.resolve();
        }
        console.warn('📦 [Storage] localStorage not available for removeItem');
        return Promise.resolve();
      }
      return AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('📦 [Storage] removeItem error for', key, ':', error);
      return Promise.resolve();
    }
  },
};

// Create Supabase client with proper web storage
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Use different storage based on platform
    ...(Platform.OS === 'web' ? {
      // For web: use built-in web storage (don't specify custom storage)
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storageKey: 'sb-dmagnsbdjsnzsddxqrwd-auth-token',
      debug: false,
    } : {
      // For mobile: use custom AsyncStorage adapter
      storage: customStorageAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      storageKey: 'sb-dmagnsbdjsnzsddxqrwd-auth-token',
    }),
  },
  // Add fetch options for better web compatibility
  ...(Platform.OS === 'web' && {
    fetch: (url, options = {}) => {
      console.log('🌐 [Supabase] Web fetch request:', { url: url.replace(supabaseUrl, '[SUPABASE_URL]') });
      
      return fetch(url, {
        ...options,
        // Add CORS headers
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        // Set timeout for web requests (with fallback for older browsers)
        signal: (() => {
          try {
            // Modern browsers support AbortSignal.timeout
            if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
              return AbortSignal.timeout(30000); // 30 second timeout
            }
          } catch (error) {
            console.warn('AbortSignal.timeout not supported, using manual controller');
          }
          // Fallback for older browsers
          const controller = new AbortController();
          setTimeout(() => controller.abort(), 30000);
          return controller.signal;
        })()
      }).catch(error => {
        console.error('🌐 [Supabase] Web fetch error:', error);
        
        // Provide more specific error information
        if (error.name === 'AbortError') {
          throw new Error('Request timed out. Please check your internet connection.');
        }
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
          throw new Error('Network error. Please check your internet connection and firewall settings.');
        }
        throw error;
      });
    }
  })
});

// Utility functions
export const isValidUUID = (uuid) => {
  if (!uuid || typeof uuid !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// Tenant management utilities
export const tenantHelpers = {
  // Get current tenant ID using email-based lookup
  async getCurrentTenantId() {
    try {
      console.log('🏢 tenantHelpers: Getting tenant ID via email lookup...');
      
      // Get authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.warn('🏢 tenantHelpers: No authenticated user found');
        return null;
      }
      
      console.log('🏢 tenantHelpers: Authenticated user:', user.email);
      
      // Look up user record by email address
      const { data: userRecord, error: userError } = await supabase
        .from('users')
        .select('tenant_id, email')
        .eq('email', user.email)
        .maybeSingle();
      
      if (userError) {
        console.error('🏢 tenantHelpers: Error querying users by email:', userError);
        return null;
      }
      
      if (!userRecord) {
        console.warn('🏢 tenantHelpers: No user record found for email:', user.email);
        return null;
      }
      
      if (!userRecord.tenant_id) {
        console.warn('🏢 tenantHelpers: User record exists but no tenant_id assigned:', user.email);
        return null;
      }
      
      console.log('🏢 tenantHelpers: ✅ Found tenant ID via email:', userRecord.tenant_id);
      return userRecord.tenant_id;
      
    } catch (error) {
      console.error('🏢 tenantHelpers: Error getting tenant ID:', error);
      return null;
    }
  },

  // Set tenant context for database queries
  async setTenantContext(tenantId) {
    try {
      if (!tenantId) {
        console.warn('Cannot set empty tenant context');
        return { success: false };
      }
      
      // Set tenant context using Supabase RPC function
      // Handle the case where the RPC function doesn't exist or fails
      try {
        const { error } = await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
        if (error) {
          console.warn('⚠️ RPC set_tenant_context failed:', error.message);
          console.log('📍 Continuing with client-side tenant filtering for tenant:', tenantId);
          // Still return success since the app can work with client-side tenant filtering
          return { success: true, clientSideOnly: true };
        }
        
        console.log('✅ Successfully set tenant context via RPC for tenant:', tenantId);
        return { success: true };
      } catch (rpcError) {
        // If the RPC function doesn't exist or there's a configuration parameter error
        console.warn('⚠️ RPC set_tenant_context not available or failed:', rpcError.message);
        console.log('📍 App will use client-side tenant filtering instead for tenant:', tenantId);
        
        // This is not a fatal error - the app can still work without the RPC function
        // by using client-side tenant filtering in queries
        return { success: true, clientSideOnly: true };
      }
    } catch (error) {
      console.error('❌ Error in setTenantContext:', error);
      // Even if setting tenant context fails, the app can continue with client-side filtering
      return { success: true, clientSideOnly: true, error };
    }
  },

  // Validate tenant access for a user
  async validateTenantAccess(userId, tenantId) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', userId)
        .eq('tenant_id', tenantId)
        .single();
        
      return { valid: !!data && !error, error };
    } catch (error) {
      return { valid: false, error };
    }
  }
};

// Database table names matching your schema
export const TABLES = {
  USERS: 'users',
  ROLES: 'roles',
  CLASSES: 'classes',
  PARENTS: 'parents',
  STUDENTS: 'students',
  TEACHERS: 'teachers',
  SUBJECTS: 'subjects',
  TEACHER_SUBJECTS: 'teacher_subjects',
  STUDENT_ATTENDANCE: 'student_attendance',
  TEACHER_ATTENDANCE: 'teacher_attendance',
  FEE_STRUCTURE: 'fee_structure',
  STUDENT_FEES: 'student_fees',
  EXAMS: 'exams',
  MARKS: 'marks',
  HOMEWORKS: 'homeworks',
  HOMEWORK: 'homeworks',
  ASSIGNMENTS: 'assignments',
  TIMETABLE: 'timetable_entries',
  PERIOD_SETTINGS: 'period_settings',
  NOTIFICATIONS: 'notifications',
  NOTIFICATION_RECIPIENTS: 'notification_recipients',
  TASKS: 'tasks',
  PERSONAL_TASKS: 'personal_tasks',
  SCHOOL_DETAILS: 'school_details',
  MESSAGES: 'messages',
  EVENTS: 'events',
  FEES: 'fees',
  SCHOOL_EXPENSES: 'school_expenses',
  EXPENSE_CATEGORIES: 'expense_categories',
  STUDENT_DISCOUNTS: 'student_discounts',
  LEAVE_APPLICATIONS: 'leave_applications',
};

// Authentication helper functions
export const authHelpers = {
  // Sign up a new user
  async signUp(email, password, userData = {}, emailRedirectTo) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: userData,
          ...(emailRedirectTo ? { emailRedirectTo } : {}),
        },
      });
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Sign in user
  async signIn(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Sign out user
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      return { error };
    } catch (error) {
      return { error };
    }
  },

  // Get current user
  async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      return { user, error };
    } catch (error) {
      return { user: null, error };
    }
  },

  // Listen to auth state changes
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  },
};

// Get current user ID helper function
export const getCurrentUserId = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      console.warn('No authenticated user found');
      return null;
    }
    return user.id;
  } catch (error) {
    console.error('Error getting current user ID:', error);
    return null;
  }
};

// User tenant helper function
export const getUserTenantId = async () => {
  try {
    const DEBUG_TENANT_LOOKUP = false; // Set to true to see detailed tenant lookup logs
    
    if (DEBUG_TENANT_LOOKUP) {
      console.log('🔍 getUserTenantId: Starting tenant lookup...');
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('❌ getUserTenantId: No user found');
      return null;
    }
    
    if (DEBUG_TENANT_LOOKUP) {
      console.log('👤 getUserTenantId: User found:', user.email);
    }

    // Check database for tenant_id first
    try {
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('tenant_id, email')
        .eq('id', user.id)
        .maybeSingle();

      if (DEBUG_TENANT_LOOKUP) {
        console.log('📊 getUserTenantId: Database query result:', {
          found: !!userProfile,
          tenantId: userProfile?.tenant_id,
          email: userProfile?.email,
          error: profileError?.message
        });
      }

      if (!profileError && userProfile?.tenant_id) {
        if (DEBUG_TENANT_LOOKUP) {
          console.log('✅ getUserTenantId: Found tenant_id in database:', userProfile.tenant_id);
        }
        return userProfile.tenant_id;
      }
    } catch (profileError) {
      console.error('❌ getUserTenantId: Database query failed:', profileError);
      // Continue to metadata check
    }

    // Check user metadata for tenant_id as fallback
    const metadataTenantId = user.app_metadata?.tenant_id || user.user_metadata?.tenant_id;
    console.log('📊 getUserTenantId: Metadata check:', {
      appMetadata: user.app_metadata?.tenant_id,
      userMetadata: user.user_metadata?.tenant_id,
      foundTenantId: metadataTenantId
    });
    
    if (metadataTenantId) {
      console.log('✅ getUserTenantId: Found tenant_id in metadata:', metadataTenantId);
      return metadataTenantId;
    }

    // 🚫 REMOVED HARDCODED FALLBACK - Users must have proper tenant assignment
    console.error('❌ getUserTenantId: CRITICAL - No tenant_id found for user:', user.email);
    console.error('❌ getUserTenantId: User must be properly assigned to a tenant in the users table');
    return null;
  } catch (error) {
    console.error('❌ getUserTenantId: Unexpected error:', error);
    // 🚫 REMOVED HARDCODED FALLBACK - Return null to force proper error handling
    return null;
  }
};

// Database helper functions
export const dbHelpers = {
  // Ensure default roles exist
  async ensureRolesExist() {
    try {
      const defaultRoles = ['admin', 'teacher', 'student', 'parent'];

      for (const roleName of defaultRoles) {
        const { data: existingRole, error: selectError } = await supabase
          .from(TABLES.ROLES)
          .select('id')
          .eq('role_name', roleName)
          .maybeSingle();

        if (selectError && selectError.code !== 'PGRST116') {
          continue;
        }

        if (!existingRole) {
          await supabase
            .from(TABLES.ROLES)
            .insert({ role_name: roleName });
        }
      }

      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  },

  // Get role ID with fallback for when RLS prevents access
  async getRoleIdSafely(roleName) {
    try {
      // Input validation
      if (!roleName || typeof roleName !== 'string') {
        return 1; // Default fallback
      }
      
      const { data: role, error } = await supabase
        .from(TABLES.ROLES)
        .select('id')
        .eq('role_name', roleName)
        .maybeSingle();

      if (error || !role?.id) {
        // Return a fallback role ID based on role name
        const fallbackRoleIds = {
          'admin': 1,
          'teacher': 2,
          'student': 4, // Student moved to 4
          'parent': 3   // Parent is role ID 3
        };
        return fallbackRoleIds[roleName.toLowerCase()] || 1;
      }

      return role.id;
    } catch (error) {
      // Return fallback
      const fallbackRoleIds = {
        'admin': 1,
        'teacher': 2,
        'student': 4, // Student moved to 4
        'parent': 3   // Parent is role ID 3
      };
      return fallbackRoleIds[roleName.toLowerCase()] || 1;
    }
  },
  // Tables that do not require tenant_id filtering (system-wide)
  getTenantFreeTable(table) {
    const tenantFreeTables = ['tenants', 'roles'];
    return tenantFreeTables.includes(table.toLowerCase());
  },

  // Generic CRUD operations - now tenant-aware
  async create(table, data, options = {}) {
    try {
      const { skipTenantId = false } = options;
      
      // Only add tenant_id if table requires it and not explicitly skipped
      if (!this.getTenantFreeTable(table) && !skipTenantId) {
        const tenantId = await tenantHelpers.getCurrentTenantId();
        if (!tenantId) {
          throw new Error('Tenant context required but not found');
        }
        data = { ...data, tenant_id: tenantId };
      }
      
      const { data: result, error } = await supabase
        .from(table)
        .insert(data)
        .select();
      return { data: result, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async read(table, filters = {}, options = {}) {
    try {
      const { skipTenantId = false, selectClause = '*' } = options;
      let query = supabase.from(table).select(selectClause);
      
      // Add tenant_id filter for tenant-aware tables
      if (!this.getTenantFreeTable(table) && !skipTenantId) {
        const tenantId = await tenantHelpers.getCurrentTenantId();
        if (tenantId) {
          query = query.eq('tenant_id', tenantId);
        } else {
          console.warn(`No tenant context for reading from ${table}`);
        }
      }
      
      // Apply additional filters
      Object.keys(filters).forEach(key => {
        query = query.eq(key, filters[key]);
      });
      
      const { data, error } = await query;
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async update(table, id, updates, options = {}) {
    try {
      const { skipTenantId = false } = options;
      let query = supabase.from(table).update(updates).eq('id', id);
      
      // Add tenant_id constraint for tenant-aware tables
      if (!this.getTenantFreeTable(table) && !skipTenantId) {
        const tenantId = await tenantHelpers.getCurrentTenantId();
        if (tenantId) {
          query = query.eq('tenant_id', tenantId);
        } else {
          throw new Error('Tenant context required for update operation');
        }
      }
      
      const { data, error } = await query.select();
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async delete(table, id, options = {}) {
    try {
      const { skipTenantId = false } = options;
      let query = supabase.from(table).delete().eq('id', id);
      
      // Add tenant_id constraint for tenant-aware tables
      if (!this.getTenantFreeTable(table) && !skipTenantId) {
        const tenantId = await tenantHelpers.getCurrentTenantId();
        if (tenantId) {
          query = query.eq('tenant_id', tenantId);
        } else {
          throw new Error('Tenant context required for delete operation');
        }
      }
      
      const { error } = await query;
      return { error };
    } catch (error) {
      return { error };
    }
  },

  // User management functions - now tenant-aware
  async getUserByEmail(email, options = {}) {
    try {
      const { skipTenantId = false } = options;
      let query = supabase
        .from(TABLES.USERS)
        .select('*')
        .eq('email', email);
      
      // Add tenant_id filter unless explicitly skipped
      if (!skipTenantId) {
        const tenantId = await tenantHelpers.getCurrentTenantId();
        if (tenantId) {
          query = query.eq('tenant_id', tenantId);
        }
      }
      
      const { data, error } = await query.single();
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async createUser(userData, options = {}) {
    try {
      const { skipTenantId = false } = options;
      
      // Add tenant_id unless explicitly skipped
      if (!skipTenantId) {
        const tenantId = await tenantHelpers.getCurrentTenantId();
        if (!tenantId) {
          throw new Error('Tenant context required for user creation');
        }
        userData = { ...userData, tenant_id: tenantId };
      }
      
      const { data, error } = await supabase
        .from(TABLES.USERS)
        .insert(userData)
        .select()
        .single();
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Class and Section management - now tenant-aware
  async getClasses() {
    try {
      // Classes are tenant-specific, so this will automatically filter by tenant_id
      // when using the tenant-aware read function
      const result = await this.read(TABLES.CLASSES, {}, { selectClause: '*' });
      
      if (result.data) {
        // Sort classes numerically by extracting the numeric part from class_name
        result.data.sort((a, b) => {
          // Extract numeric part from class names like "Class 1", "Class 10", "1st Grade", etc.
          const getNumericPart = (className) => {
            if (!className) return 0;
            // Try to extract first number from the string
            const match = className.match(/(\d+)/);
            return match ? parseInt(match[1]) : 0;
          };
          
          const numA = getNumericPart(a.class_name);
          const numB = getNumericPart(b.class_name);
          
          // If numeric parts are the same, fall back to alphabetical
          if (numA === numB) {
            return (a.class_name || '').localeCompare(b.class_name || '');
          }
          
          return numA - numB;
        });
      }
      
      return result;
    } catch (error) {
      return { data: null, error };
    }
  },

  async getSectionsByClass(classId = null) {
    try {
      const tenantId = await tenantHelpers.getCurrentTenantId();
      let query = supabase
        .from(TABLES.CLASSES)
        .select('section');
      
      // Add tenant_id filter
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }
      
      if (classId) {
        query = query.eq('id', classId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Extract unique sections
      const uniqueSections = [...new Set(data.map(item => item.section))];
      return { data: uniqueSections.map(s => ({ id: s, section_name: s })), error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Fee utility functions
  async getFeeComponentsSortedByAmount(classId, academicYear = '2024-25') {
    try {
      const tenantId = await tenantHelpers.getCurrentTenantId();
      if (!tenantId) {
        return { data: null, error: new Error('Tenant context required') };
      }

      console.log('🔍 Getting fee components sorted by amount for:', { classId, academicYear, tenantId });
      
      // Get class-level fees only (student_id = null) sorted by amount descending
      const { data: feeStructures, error } = await supabase
        .from(TABLES.FEE_STRUCTURE)
        .select('id, fee_component, amount, base_amount')
        .eq('class_id', classId)
        .eq('academic_year', academicYear)
        .eq('tenant_id', tenantId)
        .is('student_id', null) // Only class-level fees
        .order('amount', { ascending: false }); // Highest amount first
      
      if (error) {
        console.error('❌ Error fetching fee components:', error);
        return { data: null, error };
      }

      console.log('✅ Found fee components:', feeStructures?.map(f => `${f.fee_component}: ₹${f.amount}`) || []);
      return { data: feeStructures || [], error: null };
    } catch (error) {
      console.error('❌ Error in getFeeComponentsSortedByAmount:', error);
      return { data: null, error };
    }
  },

  // Student management - now tenant-aware
  async getStudentsByClass(classId, sectionId = null) {
    try {
      const tenantId = await tenantHelpers.getCurrentTenantId();
      
      // First, get students with tenant filtering
      let query = supabase
        .from(TABLES.STUDENTS)
        .select(`
          *,
          classes(class_name, section)
        `)
        .eq('class_id', classId);
      
      // Add tenant_id filter
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      if (sectionId) {
        query = query.eq('classes.section', sectionId);
      }

      const { data: studentsData, error: studentsError } = await query.order('roll_no');
      if (studentsError) {
        return { data: null, error: studentsError };
      }

      if (!studentsData || studentsData.length === 0) {
        return { data: [], error: null };
      }

      // Get all unique parent_ids and student_ids
      const parentIds = studentsData
        .map(student => student.parent_id)
        .filter(id => id != null);
      const studentIds = studentsData.map(student => student.id);

      // Fetch parent data from parents table (for new parent relationships)
      let parentsLookup = {};
      if (parentIds.length > 0) {
        let parentQuery = supabase
          .from(TABLES.PARENTS)
          .select('id, name, phone, email, student_id')
          .in('id', parentIds);
          
        // Add tenant filtering to parents query
        if (tenantId) {
          parentQuery = parentQuery.eq('tenant_id', tenantId);
        }
        
        const { data: parentsData, error: parentsError } = await parentQuery;
        
        if (!parentsError && parentsData) {
          parentsData.forEach(parent => {
            parentsLookup[parent.id] = parent;
          });
        }
      }

      // Fetch parent user data from users table (for old parent relationships)
      let parentUsersLookup = {};
      if (studentIds.length > 0) {
        let userQuery = supabase
          .from(TABLES.USERS)
          .select('id, full_name, phone, email, linked_parent_of')
          .in('linked_parent_of', studentIds)
          .not('linked_parent_of', 'is', null);
          
        // Add tenant filtering to users query
        if (tenantId) {
          userQuery = userQuery.eq('tenant_id', tenantId);
        }
        
        const { data: parentUsers, error: parentUsersError } = await userQuery;
        
        if (!parentUsersError && parentUsers) {
          parentUsers.forEach(user => {
            parentUsersLookup[user.linked_parent_of] = {
              name: user.full_name,
              phone: user.phone,
              email: user.email
            };
          });
        }
      }

      // Combine student data with parent information
      const studentsWithParents = studentsData.map(student => {
        let parentData = null;
        
        // Try to get parent from parents table first (new relationship)
        if (student.parent_id && parentsLookup[student.parent_id]) {
          parentData = {
            name: parentsLookup[student.parent_id].name,
            phone: parentsLookup[student.parent_id].phone,
            email: parentsLookup[student.parent_id].email
          };
        }
        // Fall back to users table parent data (old relationship)
        else if (parentUsersLookup[student.id]) {
          parentData = parentUsersLookup[student.id];
        }

        return {
          ...student,
          parents: parentData // Use 'parents' key for consistency with existing code
        };
      });

      return { data: studentsWithParents, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async getStudentById(studentId) {
    try {
      const tenantId = await tenantHelpers.getCurrentTenantId();
      console.log('getStudentById: Fetching student with ID:', studentId, 'for tenant:', tenantId);

      // First try a simple query without joins with tenant filtering
      let studentQuery = supabase
        .from(TABLES.STUDENTS)
        .select('*')
        .eq('id', studentId);
      
      // Add tenant_id filter
      if (tenantId) {
        studentQuery = studentQuery.eq('tenant_id', tenantId);
      }
      
      const { data: basicData, error: basicError } = await studentQuery.single();

      if (basicError) {
        console.error('getStudentById: Basic query failed:', basicError);
        return { data: null, error: basicError };
      }

      console.log('getStudentById: Basic student data:', basicData);

      // Try to get class info separately with tenant filtering
      let classData = null;
      if (basicData.class_id) {
        let classQuery = supabase
          .from(TABLES.CLASSES)
          .select('class_name, section')
          .eq('id', basicData.class_id);
          
        // Add tenant filtering to classes query
        if (tenantId) {
          classQuery = classQuery.eq('tenant_id', tenantId);
        }
        
        const { data: classInfo, error: classError } = await classQuery.single();

        if (!classError) {
          classData = classInfo;
        } else {
          console.warn('getStudentById: Class query failed:', classError);
        }
      }

      // Try to get parent info separately with tenant filtering
      let parentData = null;
      if (basicData.parent_id) {
        let parentQuery = supabase
          .from(TABLES.PARENTS)
          .select('name, phone, email')
          .eq('id', basicData.parent_id);
          
        // Add tenant filtering to parents query
        if (tenantId) {
          parentQuery = parentQuery.eq('tenant_id', tenantId);
        }
        
        const { data: parentInfo, error: parentError } = await parentQuery.single();

        if (!parentError) {
          parentData = parentInfo;
        } else {
          console.warn('getStudentById: Parent query failed:', parentError);
        }
      }

      // Combine the data
      const combinedData = {
        ...basicData,
        classes: classData,
        users: parentData
      };

      console.log('getStudentById: Combined data:', combinedData);
      return { data: combinedData, error: null };

    } catch (error) {
      console.error('getStudentById: Unexpected error:', error);
      return { data: null, error };
    }
  },

  // Teacher management - Optimized for better performance with optional search
  async getTeachers(options = {}) {
    try {
      const {
        pageSize = 50,
        page = 0,
        includeUserDetails = false,
        selectColumns = 'id,name,phone,qualification,salary_amount,age,address,tenant_id,created_at,salary_type,is_class_teacher,assigned_class_id',
        searchQuery = '',
        searchByEmail = true
      } = options;

      // Get current tenant ID for filtering
      const tenantId = await tenantHelpers.getCurrentTenantId();
      console.log('🔍 getTeachers: Current tenant ID:', tenantId);

      // Base query for teachers
      let baseQuery = supabase
        .from(TABLES.TEACHERS)
        .select(selectColumns);

      if (tenantId) {
        baseQuery = baseQuery.eq('tenant_id', tenantId);
      }

      let teachersQuery = baseQuery.order('name', { ascending: true });

      // Optional server-side search
      if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.trim();
        const ilikeQ = `%${q}%`;
        console.log('🔎 getTeachers: Applying server-side search for:', q);

        // Find teacher IDs that match teacher fields
        let teacherIdFilter = baseQuery;
        const teacherOrFilter = `name.ilike.${ilikeQ},qualification.ilike.${ilikeQ},phone.ilike.${ilikeQ}`;
        teacherIdFilter = teacherIdFilter.select('id');
        teacherIdFilter = teacherIdFilter.or(teacherOrFilter);

        const { data: teacherIdRows, error: teacherIdError } = await teacherIdFilter;
        if (teacherIdError) {
          console.warn('⚠️ getTeachers: Teacher field search failed:', teacherIdError.message);
        }
        const idsFromTeacherFields = (teacherIdRows || []).map(r => r.id);

        // Optionally include matches by user email
        let idsFromUsers = [];
        if (includeUserDetails && searchByEmail) {
          let usersQuery = supabase
            .from(TABLES.USERS)
            .select('linked_teacher_id')
            .not('linked_teacher_id', 'is', null)
            .ilike('email', ilikeQ);
          if (tenantId) {
            usersQuery = usersQuery.eq('tenant_id', tenantId);
          }
          const { data: userRows, error: usersError } = await usersQuery;
          if (usersError) {
            console.warn('⚠️ getTeachers: User email search failed:', usersError.message);
          }
          idsFromUsers = (userRows || [])
            .filter(u => !!u.linked_teacher_id)
            .map(u => u.linked_teacher_id);
        }

        const filteredIds = Array.from(new Set([...(idsFromTeacherFields || []), ...(idsFromUsers || [])]));
        console.log('🔎 getTeachers: Filtered teacher IDs count:', filteredIds.length);

        if (filteredIds.length === 0) {
          return { data: [], error: null };
        }

        teachersQuery = baseQuery
          .in('id', filteredIds)
          .order('name', { ascending: true });
      }

      // Add pagination
      if (pageSize && pageSize > 0) {
        const start = page * pageSize;
        const end = start + pageSize - 1;
        teachersQuery = teachersQuery.range(start, end);
      }

      const { data: teachersData, error } = await teachersQuery;
      console.log('📋 getTeachers: Teachers query result:', {
        success: !error,
        count: teachersData?.length || 0,
        includeUserDetails,
        error: error?.message
      });

      if (error) {
        return { data: null, error };
      }

      // Optionally fetch linked user details only when needed
      if (includeUserDetails && teachersData && teachersData.length > 0) {
        const teacherIds = teachersData.map(teacher => teacher.id);
        console.log('👥 getTeachers: Fetching user details for teacher IDs:', teacherIds);

        // Add tenant filtering to users query as well
        let usersQuery = supabase
          .from(TABLES.USERS)
          .select('id, email, full_name, phone, linked_teacher_id, tenant_id')
          .in('linked_teacher_id', teacherIds)
          .not('linked_teacher_id', 'is', null);

        // Add tenant filtering for users if available
        if (tenantId) {
          usersQuery = usersQuery.eq('tenant_id', tenantId);
        }

        const { data: usersData, error: usersError } = await usersQuery;

        console.log('👤 getTeachers: Users query result:', {
          success: !usersError,
          count: usersData?.length || 0,
          error: usersError?.message,
          foundUsers: usersData?.map(u => ({ email: u.email, linkedTeacherId: u.linked_teacher_id }))
        });

        if (!usersError && usersData) {
          // Map user data to teachers
          const usersLookup = {};
          usersData.forEach(user => {
            if (user.linked_teacher_id) {
              usersLookup[user.linked_teacher_id] = user;
            }
          });

          console.log('🔗 getTeachers: Users lookup created:', Object.keys(usersLookup));

          // Enhance teachers with user data - fix the structure expected by UI
          teachersData.forEach(teacher => {
            const linkedUser = usersLookup[teacher.id];
            // The UI expects teacher.users to be an array, not a single object
            teacher.users = linkedUser ? [linkedUser] : [];

            console.log(`👨‍🏫 Teacher ${teacher.name}: ${linkedUser ? 'HAS ACCOUNT' : 'NO ACCOUNT'} (${linkedUser?.email || 'none'})`);
          });
        } else {
          // Ensure all teachers have empty users array when query fails
          teachersData.forEach(teacher => {
            teacher.users = [];
          });
        }
      } else {
        // When user details are not requested, still initialize the users field
        if (teachersData) {
          teachersData.forEach(teacher => {
            teacher.users = [];
          });
        }
      }

      return { data: teachersData || [], error: null };
    } catch (error) {
      console.error('❌ Error in getTeachers:', error);
      return { data: null, error };
    }
  },

  // Student management - Optimized with optional search and user linking
  async getStudents(options = {}) {
    try {
      const {
        pageSize = 50,
        page = 0,
        includeUserDetails = false,
        includeClass = true,
        selectColumns = 'id,name,admission_no,roll_no,class_id,tenant_id,created_at',
        searchQuery = '',
        searchByEmail = true,
        classId = null
      } = options;

      const tenantId = await tenantHelpers.getCurrentTenantId();
      console.log('🔍 getStudents: Current tenant ID:', tenantId);

      // Build select with optional class join
      const baseSelect = includeClass
        ? `${selectColumns},classes(id,class_name,section)`
        : selectColumns;

      let baseQuery = supabase
        .from(TABLES.STUDENTS)
        .select(baseSelect);

      if (tenantId) {
        baseQuery = baseQuery.eq('tenant_id', tenantId);
      }

      if (classId) {
        baseQuery = baseQuery.eq('class_id', classId);
      }

      let studentsQuery = baseQuery.order('name', { ascending: true });

      // Optional server-side search
      if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.trim();
        const ilikeQ = `%${q}%`;
        console.log('🔎 getStudents: Applying server-side search for:', q);

        // Search student fields
        let idsFromStudentFields = [];
        let studentIdFilter = supabase
          .from(TABLES.STUDENTS)
          .select('id');
        if (tenantId) studentIdFilter = studentIdFilter.eq('tenant_id', tenantId);
        if (classId) studentIdFilter = studentIdFilter.eq('class_id', classId);
        studentIdFilter = studentIdFilter.or(`name.ilike.${ilikeQ},admission_no.ilike.${ilikeQ},roll_no.ilike.${ilikeQ}`);
        const { data: studentIdRows, error: studentIdError } = await studentIdFilter;
        if (studentIdError) {
          console.warn('⚠️ getStudents: Student field search failed:', studentIdError.message);
        }
        idsFromStudentFields = (studentIdRows || []).map(r => r.id);

        // Optionally search by user email linked to student
        let idsFromUsers = [];
        if (includeUserDetails && searchByEmail) {
          let usersQuery = supabase
            .from(TABLES.USERS)
            .select('linked_student_id')
            .not('linked_student_id', 'is', null)
            .ilike('email', ilikeQ);
          if (tenantId) usersQuery = usersQuery.eq('tenant_id', tenantId);
          const { data: userRows, error: usersError } = await usersQuery;
          if (usersError) {
            console.warn('⚠️ getStudents: User email search failed:', usersError.message);
          }
          idsFromUsers = (userRows || []).map(u => u.linked_student_id).filter(Boolean);
        }

        const filteredIds = Array.from(new Set([...(idsFromStudentFields || []), ...(idsFromUsers || [])]));
        console.log('🔎 getStudents: Filtered student IDs count:', filteredIds.length);

        if (filteredIds.length === 0) {
          return { data: [], error: null };
        }

        studentsQuery = baseQuery
          .in('id', filteredIds)
          .order('name', { ascending: true });
      }

      // Pagination
      if (pageSize && pageSize > 0) {
        const start = page * pageSize;
        const end = start + pageSize - 1;
        studentsQuery = studentsQuery.range(start, end);
      }

      const { data: studentsData, error } = await studentsQuery;
      if (error) return { data: null, error };

      // Optionally fetch linked user details for students
      if (includeUserDetails && studentsData && studentsData.length > 0) {
        const studentIds = studentsData.map(s => s.id);
        let usersQuery = supabase
          .from(TABLES.USERS)
          .select('id, email, full_name, phone, linked_student_id, tenant_id')
          .in('linked_student_id', studentIds)
          .not('linked_student_id', 'is', null);
        if (tenantId) usersQuery = usersQuery.eq('tenant_id', tenantId);
        const { data: usersData, error: usersError } = await usersQuery;
        if (!usersError && usersData) {
          const lookup = {};
          usersData.forEach(u => { if (u.linked_student_id) lookup[u.linked_student_id] = u; });
          studentsData.forEach(s => {
            const linkedUser = lookup[s.id];
            s.users = linkedUser ? [linkedUser] : [];
          });
        } else if (studentsData) {
          studentsData.forEach(s => { s.users = []; });
        }
      } else if (studentsData) {
        studentsData.forEach(s => { s.users = []; });
      }

      return { data: studentsData || [], error: null };
    } catch (error) {
      console.error('❌ Error in getStudents:', error);
      return { data: null, error };
    }
  },

  async getTeacherByUserId(userId) {
    try {
      // Validate userId early to avoid 22P02 errors when null/invalid
      const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
      if (!userId || typeof userId !== 'string' || userId === 'null' || userId === 'undefined' || !isUuid(userId)) {
        console.error('❌ getTeacherByUserId: Invalid userId provided:', userId);
        return { data: null, error: new Error('Invalid user identifier') };
      }

      // Get current tenant ID for filtering
      const tenantId = await tenantHelpers.getCurrentTenantId();
      
      // First get the user to find linked_teacher_id
      const { data: user, error: userError } = await supabase
        .from(TABLES.USERS)
        .select('linked_teacher_id, full_name, email, phone, tenant_id')
        .eq('id', userId)
        .single();

      if (userError) {
        console.error('❌ getTeacherByUserId: User lookup failed:', userError);
        return { data: null, error: userError };
      }
      
      if (!user?.linked_teacher_id) {
        console.error('❌ getTeacherByUserId: No teacher linked to this user:', userId);
        return { data: null, error: new Error('Teacher information not found for this tenant.') };
      }

      // Then get the teacher with related data
      const { data: teacherData, error: teacherError } = await supabase
        .from(TABLES.TEACHERS)
        .select(`
          *,
          teacher_subjects(
            subjects(id, name, class_id)
          )
        `)
        .eq('id', user.linked_teacher_id)
        .single();
        
      if (teacherError) {
        console.error('❌ getTeacherByUserId: Teacher lookup failed:', teacherError);
        console.error('❌ Teacher not found for user:', userId, 'in tenant:', tenantId);
        
        // Create a minimal teacher record for testing (if needed)
        if (teacherError.code === 'PGRST116') {
          console.log('🚑 Creating minimal teacher record for testing...');
          
          const newTeacherData = {
            id: user.linked_teacher_id,
            name: user.full_name || 'Teacher',
            phone: user.phone || '',
            tenant_id: user.tenant_id
          };
          
          // Try to create teacher record
          const { data: createdTeacher, error: createError } = await supabase
            .from(TABLES.TEACHERS)
            .insert(newTeacherData)
            .select()
            .single();
            
          if (createdTeacher && !createError) {
            console.log('✅ Created teacher record:', createdTeacher.name);
            return { data: createdTeacher, error: null };
          } else {
            console.error('❌ Failed to create teacher record:', createError);
          }
        }
        
        return { data: null, error: new Error('Teacher information not found for this tenant.') };
      }
      
      // Validate teacher belongs to correct tenant
      if (teacherData && tenantId && teacherData.tenant_id !== tenantId) {
        console.error('❌ getTeacherByUserId: Teacher tenant mismatch:', {
          teacherTenant: teacherData.tenant_id,
          expectedTenant: tenantId
        });
        return { data: null, error: new Error('Teacher information not found for this tenant.') };
      }
      
      return { data: teacherData, error: null };
    } catch (error) {
      console.error('❌ getTeacherByUserId: Unexpected error:', error);
      return { data: null, error: new Error('Teacher information not found for this tenant.') };
    }
  },

  async createTeacherAccount(teacherData, authData) {
    try {
      console.log('🚀 createTeacherAccount: Starting teacher account creation...');
      console.log('📋 createTeacherAccount: Teacher data:', { teacherId: teacherData.teacherId });
      console.log('📋 createTeacherAccount: Auth data:', { email: authData.email, fullName: authData.full_name });
      
      // Get current tenant ID for linking
      const tenantId = await tenantHelpers.getCurrentTenantId();
      if (!tenantId) {
        throw new Error('No tenant context available. Please refresh the page and try again.');
      }
      console.log('🏢 createTeacherAccount: Using tenant ID:', tenantId);
      
      // 0. Ensure roles exist
      await this.ensureRolesExist();

      // 1. Create auth user using regular signup
      console.log('👤 createTeacherAccount: Creating Supabase auth user...');
      const { data: authUser, error: authError } = await supabase.auth.signUp({
        email: authData.email,
        password: authData.password,
        options: {
          data: {
            full_name: authData.full_name,
            role: 'teacher',
            tenant_id: tenantId
          },
          emailRedirectTo: undefined // Disable email confirmation for admin-created accounts
        }
      });

      if (authError) {
        console.error('❌ createTeacherAccount: Auth signup error:', authError);
        throw authError;
      }

      if (!authUser.user) {
        console.error('❌ createTeacherAccount: No user returned from signup');
        throw new Error('Failed to create user account');
      }
      
      console.log('✅ createTeacherAccount: Auth user created with ID:', authUser.user.id);

      // 1. Check if user already exists in auth or users table
      const { data: existingUser, error: existingUserError } = await supabase
        .from(TABLES.USERS)
        .select('id, email, linked_teacher_id')
        .eq('email', authData.email)
        .maybeSingle();

      if (existingUserError && existingUserError.code !== 'PGRST116') {
        throw new Error(`Error checking existing user: ${existingUserError.message}`);
      }

      if (existingUser) {
        if (existingUser.linked_teacher_id === teacherData.teacherId) {
          throw new Error(`Account already exists for ${authData.email} and is properly linked to this teacher.`);
        } else {
          throw new Error(`Email ${authData.email} is already registered to another user. Please use a different email.`);
        }
      }

      // 2. Ensure roles exist
      await this.ensureRolesExist();

      // 3. Get teacher role ID safely
      const teacherRoleId = await this.getRoleIdSafely('teacher');
      console.log(`📝 createTeacherAccount: Using teacher role ID: ${teacherRoleId}`);
      
      if (!teacherRoleId || teacherRoleId === undefined || teacherRoleId === null) {
        console.error('❌ teacherRoleId is invalid:', teacherRoleId);
        throw new Error('Could not determine teacher role ID - received undefined or null value');
      }
      
      // Ensure it's a valid number
      if (typeof teacherRoleId !== 'number' || isNaN(teacherRoleId)) {
        console.error('❌ teacherRoleId is not a valid number:', teacherRoleId, typeof teacherRoleId);
        throw new Error(`Invalid teacher role ID: expected number, got ${typeof teacherRoleId}`);
      }

      // 3. Create user profile with linked_teacher_id and tenant_id
      console.log('👥 createTeacherAccount: Creating user profile...');
      const userProfileData = {
        id: authUser.user.id,
        email: authData.email,
        full_name: authData.full_name,
        phone: authData.phone || '',
        role_id: teacherRoleId,
        linked_teacher_id: teacherData.teacherId,  // ✅ Link to teacher record
        tenant_id: tenantId  // ✅ Add tenant context
      };
      
      console.log('📊 createTeacherAccount: User profile data:', userProfileData);
      
      const { data: userProfile, error: userError } = await supabase
        .from(TABLES.USERS)
        .insert(userProfileData)
        .select()
        .single();

      if (userError) {
        console.error('❌ createTeacherAccount: User profile creation error:', userError);
        throw userError;
      }
      
      console.log('✅ createTeacherAccount: User profile created:', {
        id: userProfile.id,
        email: userProfile.email,
        linkedTeacherId: userProfile.linked_teacher_id
      });

      // 4. Get the teacher record for return with tenant filtering
      console.log('🔍 createTeacherAccount: Fetching teacher record...');
      const { data: teacher, error: teacherError } = await supabase
        .from(TABLES.TEACHERS)
        .select('*')
        .eq('id', teacherData.teacherId)
        .eq('tenant_id', tenantId)  // ✅ Ensure tenant context
        .single();

      if (teacherError) {
        console.error('❌ createTeacherAccount: Teacher fetch error:', teacherError);
        throw teacherError;
      }
      
      console.log('✅ createTeacherAccount: Teacher record fetched:', {
        id: teacher.id,
        name: teacher.name,
        tenantId: teacher.tenant_id
      });

      const result = {
        data: {
          authUser: authUser.user,
          userProfile,
          teacher
        },
        error: null
      };
      
      console.log('🎉 createTeacherAccount: Account creation completed successfully!');
      return result;
      
    } catch (error) {
      console.error('❌ createTeacherAccount: Failed with error:', error);
      return { data: null, error };
    }
  },

  async createStudentAccount(studentData, authData) {
    try {
      console.log('Creating student account - Step 1: Ensuring roles exist');
      // 0. Ensure roles exist
      await this.ensureRolesExist();

      console.log('Creating student account - Step 2: Creating auth user for email:', authData.email);
      // 1. Create auth user using regular signup
      const { data: authUser, error: authError } = await supabase.auth.signUp({
        email: authData.email,
        password: authData.password,
        options: {
          data: {
            full_name: authData.full_name,
            role: 'student'
          },
          emailRedirectTo: undefined // Disable email confirmation for admin-created accounts
        }
      });

      if (authError) {
        console.error('Auth signup error:', authError);
        throw authError;
      }

      if (!authUser.user) {
        throw new Error('Failed to create user account - no user returned');
      }

      console.log('Creating student account - Step 3: Auth user created with ID:', authUser.user.id);

      // 2. Get student role ID safely
      console.log('Creating student account - Step 4: Getting student role');
      const studentRoleId = await this.getRoleIdSafely('student');
      console.log('Creating student account - Step 5: Student role ID:', studentRoleId);
      
      if (!studentRoleId || studentRoleId === undefined || studentRoleId === null) {
        console.error('❌ studentRoleId is invalid:', studentRoleId);
        throw new Error('Could not determine student role ID - received undefined or null value');
      }
      
      // Ensure it's a valid number
      if (typeof studentRoleId !== 'number' || isNaN(studentRoleId)) {
        console.error('❌ studentRoleId is not a valid number:', studentRoleId, typeof studentRoleId);
        throw new Error(`Invalid student role ID: expected number, got ${typeof studentRoleId}`);
      }

      // 3. Create user profile with linked_student_id
      console.log('Creating student account - Step 6: Creating user profile');
      const userProfileData = {
        id: authUser.user.id,
        email: authData.email,
        full_name: authData.full_name,
        phone: authData.phone || '',
        role_id: studentRoleId,
        linked_student_id: studentData.studentId,  // ✅ Link to student record
        tenant_id: studentInfoTenant.tenant_id     // ✅ Include tenant context (NOT NULL)
      };

      console.log('User profile data:', userProfileData);

      const { data: userProfile, error: userError } = await supabase
        .from(TABLES.USERS)
        .insert(userProfileData)
        .select()
        .single();

      if (userError) {
        console.error('Error creating user profile:', userError);
        throw userError;
      }

      console.log('Creating student account - Step 7: User profile created:', userProfile);

      // 4. Get the student record for return
      console.log('Creating student account - Step 8: Getting student record for ID:', studentData.studentId);
      const { data: student, error: studentError } = await supabase
        .from(TABLES.STUDENTS)
        .select('*')
        .eq('id', studentData.studentId)
        .single();

      if (studentError) {
        console.error('Error getting student record:', studentError);
        throw studentError;
      }

      console.log('Creating student account - Step 9: Success! Account created for student:', student.name);

      return {
        data: {
          authUser: authUser.user,
          userProfile,
          student
        },
        error: null
      };
    } catch (error) {
      console.error('Error in createStudentAccount:', error);
      return { data: null, error };
    }
  },

  async createParentAccount(studentData, authData) {
    try {
      console.log('Creating parent account - Step 1: Ensuring roles exist');
      // 0. Ensure roles exist
      await this.ensureRolesExist();

      console.log('Creating parent account - Step 2: Creating auth user for email:', authData.email);
      // 1. Create auth user using regular signup
      const { data: authUser, error: authError } = await supabase.auth.signUp({
        email: authData.email,
        password: authData.password,
        options: {
          data: {
            full_name: authData.full_name,
            role: 'parent'
          },
          emailRedirectTo: undefined // Disable email confirmation for admin-created accounts
        }
      });

      if (authError) {
        console.error('Auth signup error:', authError);
        throw authError;
      }

      if (!authUser.user) {
        throw new Error('Failed to create user account - no user returned');
      }

      console.log('Creating parent account - Step 3: Auth user created with ID:', authUser.user.id);

      // 2. Get parent role ID safely
      console.log('Creating parent account - Step 4: Getting parent role');
      const parentRoleId = await this.getRoleIdSafely('parent');
      console.log('Creating parent account - Step 5: Parent role ID:', parentRoleId);
      
      if (!parentRoleId || parentRoleId === undefined || parentRoleId === null) {
        console.error('❌ parentRoleId is invalid:', parentRoleId);
        throw new Error('Could not determine parent role ID - received undefined or null value');
      }
      
      // Ensure it's a valid number
      if (typeof parentRoleId !== 'number' || isNaN(parentRoleId)) {
        console.error('❌ parentRoleId is not a valid number:', parentRoleId, typeof parentRoleId);
        throw new Error(`Invalid parent role ID: expected number, got ${typeof parentRoleId}`);
      }

      // 3. Get tenant_id from student record first
      console.log('Creating parent account - Step 6: Getting student tenant info');
      const { data: studentInfo, error: studentInfoError } = await supabase
        .from(TABLES.STUDENTS)
        .select('tenant_id')
        .eq('id', studentData.studentId)
        .single();
      
      if (studentInfoError || !studentInfo.tenant_id) {
        console.error('Error getting student tenant_id:', studentInfoError);
        throw new Error('Could not determine tenant context from student record');
      }
      
      console.log('Creating parent account - Step 7: Student tenant_id:', studentInfo.tenant_id);
      
      // 4. Create user profile with linked_parent_of and tenant_id
      console.log('Creating parent account - Step 8: Creating user profile');
      const userProfileData = {
        id: authUser.user.id,
        email: authData.email,
        full_name: authData.full_name,
        phone: authData.phone || '',
        role_id: parentRoleId,
        linked_parent_of: studentData.studentId,  // ✅ Link to student record as parent
        tenant_id: studentInfo.tenant_id         // ✅ Set tenant_id from student
      };

      console.log('User profile data:', userProfileData);

      const { data: userProfile, error: userError } = await supabase
        .from(TABLES.USERS)
        .insert(userProfileData)
        .select()
        .single();

      if (userError) {
        console.error('Error creating user profile:', userError);
        throw userError;
      }

      console.log('Creating parent account - Step 9: User profile created:', userProfile);

      // 5. Create parent record in parents table
      console.log('Creating parent account - Step 10: Creating parent record');
      const parentRecordData = {
        name: authData.full_name,
        relation: authData.relation || 'Guardian', // Default to Guardian if not specified
        phone: authData.phone || '',
        email: authData.email,
        student_id: studentData.studentId,
        tenant_id: studentInfo.tenant_id  // ✅ Set tenant_id from student
      };

      console.log('Parent record data:', parentRecordData);

      const { data: parentRecord, error: parentError } = await supabase
        .from(TABLES.PARENTS)
        .insert(parentRecordData)
        .select()
        .single();

      if (parentError) {
        console.error('Error creating parent record:', parentError);
        throw parentError;
      }

      console.log('Creating parent account - Step 11: Parent record created:', parentRecord);

      // 6. Update student record to link to the parent record
      console.log('Creating parent account - Step 12: Updating student parent_id');
      const { error: studentUpdateError } = await supabase
        .from(TABLES.STUDENTS)
        .update({ parent_id: parentRecord.id })
        .eq('id', studentData.studentId);

      if (studentUpdateError) {
        console.error('Error updating student parent_id:', studentUpdateError);
        throw studentUpdateError;
      }

      console.log('Creating parent account - Step 13: Student parent_id updated successfully');

      // 7. Get the student record for return
      console.log('Creating parent account - Step 14: Getting student record for ID:', studentData.studentId);
      const { data: student, error: studentError } = await supabase
        .from(TABLES.STUDENTS)
        .select('*')
        .eq('id', studentData.studentId)
        .single();

      if (studentError) {
        console.error('Error getting student record:', studentError);
        throw studentError;
      }

      console.log('Creating parent account - Step 15: Success! Parent account and record created for student:', student.name);

      return {
        data: {
          authUser: authUser.user,
          userProfile,
          parentRecord,
          student
        },
        error: null
      };
    } catch (error) {
      console.error('Error in createParentAccount:', error);
      // Note: In a production environment, you might want to implement rollback logic here
      // to clean up any partially created records if the transaction fails
      return { data: null, error };
    }
  },

  // Link an existing parent account to an additional student
  async linkParentToAdditionalStudent(parentEmail, studentId, relation = 'Guardian') {
    try {
      console.log('🔗 ADMIN LINKING: Starting linkParentToAdditionalStudent');
      console.log('🔗 Parameters:', { parentEmail, studentId, relation });
      console.log('🔗 Step 1: Finding parent user with email:', parentEmail);
      
      // 1. Find the existing parent user account
      const { data: existingParentUser, error: userError } = await supabase
        .from(TABLES.USERS)
        .select('id, email, full_name, phone, role_id, linked_parent_of')
        .eq('email', parentEmail)
        .eq('role_id', (await this.getParentRoleId()))
        .single();
      
      console.log('🔗 Step 1 Result:', { existingParentUser, userError });
      
      if (userError) {
        console.error('❌ Error finding parent user:', userError);
        throw new Error(`Parent account with email ${parentEmail} not found`);
      }
      
      console.log('✅ Step 2: Found existing parent user:', existingParentUser.full_name);
      console.log('📋 Parent user details:', existingParentUser);
      
      // 2. Check if this student is already linked to this parent
      const { data: existingParentRecord, error: existingError } = await supabase
        .from(TABLES.PARENTS)
        .select('id')
        .eq('email', parentEmail)
        .eq('student_id', studentId)
        .maybeSingle();
      
      if (existingParentRecord) {
        throw new Error('This student is already linked to this parent account');
      }
      
      // Also check if student already has this parent_id in students table
      const { data: currentStudent, error: currentStudentError } = await supabase
        .from(TABLES.STUDENTS)
        .select('parent_id')
        .eq('id', studentId)
        .single();
      
      if (currentStudentError) {
        console.error('Error getting current student:', currentStudentError);
        throw new Error('Student not found');
      }
      
      // 3. Create new parent record linking this parent to the additional student
      console.log('Linking parent - Step 3: Creating parent record for additional student');
      const parentRecordData = {
        name: existingParentUser.full_name,
        relation: relation,
        phone: existingParentUser.phone || '',
        email: existingParentUser.email,
        student_id: studentId
      };
      
      const { data: newParentRecord, error: parentRecordError } = await supabase
        .from(TABLES.PARENTS)
        .insert(parentRecordData)
        .select()
        .single();
      
      if (parentRecordError) {
        console.error('Error creating parent record for additional student:', parentRecordError);
        throw parentRecordError;
      }
      
      console.log('Linking parent - Step 4: Parent record created:', newParentRecord);
      
      // 4. Set the student's parent_id to link back to the parent record
      console.log('Linking parent - Step 5: Setting student parent_id');
      const { error: studentUpdateError } = await supabase
        .from(TABLES.STUDENTS)
        .update({ parent_id: newParentRecord.id })
        .eq('id', studentId);
      
      if (studentUpdateError) {
        console.error('Error updating student parent_id:', studentUpdateError);
        // Don't throw here as the parent record was created successfully
        console.log('Warning: Parent record created but student parent_id not updated');
      } else {
        console.log('Student parent_id updated successfully');
      }
      
      // 5. Check if this is the first student being linked to this parent
      // If the user doesn't have a linked_parent_of set, set it to this student
      if (!existingParentUser.linked_parent_of) {
        console.log('Linking parent - Step 6: Setting primary linked_parent_of');
        const { error: userUpdateError } = await supabase
          .from(TABLES.USERS)
          .update({ linked_parent_of: studentId })
          .eq('id', existingParentUser.id);
        
        if (userUpdateError) {
          console.error('Error setting linked_parent_of:', userUpdateError);
          // Don't throw as the main linking was successful
        } else {
          console.log('Primary linked_parent_of set successfully');
        }
      }
      
      // 6. Get the updated student record
      const { data: student, error: studentError } = await supabase
        .from(TABLES.STUDENTS)
        .select('*')
        .eq('id', studentId)
        .single();
      
      if (studentError) {
        console.error('Error getting student record:', studentError);
        throw studentError;
      }
      
      console.log('Linking parent - Step 7: Success! Parent linked to additional student:', student.name);
      
      return {
        data: {
          parentUser: existingParentUser,
          parentRecord: newParentRecord,
          student
        },
        error: null
      };
    } catch (error) {
      console.error('Error in linkParentToAdditionalStudent:', error);
      return { data: null, error };
    }
  },

  // Helper function to get parent role ID
  async getParentRoleId() {
    const { data: parentRole, error: roleError } = await supabase
      .from(TABLES.ROLES)
      .select('id')
      .eq('role_name', 'parent')
      .single();
    
    if (roleError) {
      throw new Error('Parent role not found');
    }
    
    return parentRole.id;
  },

  // Search for existing parent accounts by email or name
  async searchParentAccounts(searchTerm) {
    try {
      const { data: parentUsers, error: userError } = await supabase
        .from(TABLES.USERS)
        .select('id, email, full_name, phone')
        .eq('role_id', (await this.getParentRoleId()))
        .or(`email.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%`);
      
      if (userError) {
        console.error('Error searching parent accounts:', userError);
        throw userError;
      }
      
      // For each parent, get their associated students
      const parentsWithStudents = await Promise.all(
        (parentUsers || []).map(async (parent) => {
          const { data: parentRecords, error: recordError } = await supabase
            .from(TABLES.PARENTS)
            .select(`
              id, relation, student_id,
              students(id, name, admission_no, classes(class_name, section))
            `)
            .eq('email', parent.email);
          
          return {
            ...parent,
            linkedStudents: recordError ? [] : (parentRecords || []).map(record => ({
              ...record.students,
              relation: record.relation
            }))
          };
        })
      );
      
      return { data: parentsWithStudents, error: null };
    } catch (error) {
      console.error('Error in searchParentAccounts:', error);
      return { data: null, error };
    }
  },

  // Test function to verify auth is working
  async testAuthConnection() {
    try {
      console.log('Testing Supabase Auth connection...');
      const { data: { session }, error } = await supabase.auth.getSession();
      console.log('Current session:', session);
      console.log('Auth test completed, error:', error);
      return { session, error };
    } catch (error) {
      console.error('Auth connection test failed:', error);
      return { session: null, error };
    }
  },

  // Verify if a user exists in auth.users table
  async verifyAuthUser(email) {
    try {
      console.log('Verifying auth user for email:', email);
      // Note: This requires RLS policies to be set up properly
      const { data, error } = await supabase.auth.admin.listUsers();
      if (error) {
        console.log('Cannot access admin.listUsers, checking via sign-in attempt');
        return { exists: 'unknown', error: 'Admin access required' };
      }

      const userExists = data.users.some(user => user.email === email);
      console.log('Auth user exists:', userExists);
      return { exists: userExists, error: null };
    } catch (error) {
      console.error('Error verifying auth user:', error);
      return { exists: 'unknown', error };
    }
  },

  async getTeacherSubjects(teacherId) {
    try {
      const { data, error } = await supabase
        .from(TABLES.TEACHER_SUBJECTS)
        .select(`
          *,
          subjects(
            id,
            name,
            class_id,
            classes(id, class_name, section)
          )
        `)
        .eq('teacher_id', teacherId);
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Attendance management
  async getAttendanceByDate(date, classId = null, sectionId = null) {
    try {
      let query = supabase
        .from(TABLES.STUDENT_ATTENDANCE)
        .select(`
          *,
          students(
            name,
            roll_no,
            classes(class_name, section)
          )
        `)
        .eq('date', date);
      
      if (classId) {
        query = query.eq('students.class_id', classId);
      }
      
      if (sectionId) {
        query = query.eq('students.classes.section', sectionId);
      }
      
      const { data, error } = await query;
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async markAttendance(attendanceData) {
    try {
      const { data, error } = await supabase
        .from(TABLES.STUDENT_ATTENDANCE)
        .upsert(attendanceData, { onConflict: 'student_id,date,tenant_id' })
        .select();
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Fee management - Updated to follow clean approach
  async getFeeStructure(classId, academicYear = '2024-25') {
    try {
      const tenantId = await tenantHelpers.getCurrentTenantId();
      if (!tenantId) {
        return { data: null, error: new Error('Tenant context required') };
      }

      // 🎯 CLEAN APPROACH: Only get class-level fees (student_id = null)
      const { data, error } = await supabase
        .from(TABLES.FEE_STRUCTURE)
        .select('*')
        .eq('class_id', classId)
        .eq('academic_year', academicYear)
        .eq('tenant_id', tenantId)
        .is('student_id', null) // Only class-level fees
        .order('fee_component');
      
      console.log('📋 Retrieved class-level fees only:', data?.length || 0);
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Create class-level fee structure entry (clean approach)
  async createClassFee(feeData) {
    try {
      const tenantId = await tenantHelpers.getCurrentTenantId();
      if (!tenantId) {
        return { data: null, error: new Error('Tenant context required') };
      }

      // 🎯 CLEAN APPROACH: Ensure this is a class-level fee with base_amount = amount
      const classLevelFeeData = {
        ...feeData,
        student_id: null, // Always null for class fees
        base_amount: feeData.amount, // base_amount should always equal amount for class fees
        tenant_id: tenantId
      };

      console.log('💾 Creating class-level fee:', classLevelFeeData);

      const { data, error } = await supabase
        .from(TABLES.FEE_STRUCTURE)
        .insert(classLevelFeeData)
        .select()
        .single();
      
      if (error) {
        console.error('❌ Error creating class fee:', error);
        return { data: null, error };
      }

      console.log('✅ Successfully created class-level fee:', data.fee_component);
      return { data, error: null };
    } catch (error) {
      console.error('❌ Error in createClassFee:', error);
      return { data: null, error };
    }
  },

  // Update class-level fee (clean approach)
  async updateClassFee(feeId, updates) {
    try {
      const tenantId = await tenantHelpers.getCurrentTenantId();
      if (!tenantId) {
        return { data: null, error: new Error('Tenant context required') };
      }

      // 🎯 CLEAN APPROACH: Ensure base_amount = amount when updating class fees
      if (updates.amount !== undefined) {
        updates.base_amount = updates.amount; // Keep base_amount in sync
      }

      console.log('🔄 Updating class-level fee:', feeId, updates);

      const { data, error } = await supabase
        .from(TABLES.FEE_STRUCTURE)
        .update(updates)
        .eq('id', feeId)
        .eq('tenant_id', tenantId)
        .is('student_id', null) // Only update class-level fees
        .select()
        .single();
      
      if (error) {
        console.error('❌ Error updating class fee:', error);
        return { data: null, error };
      }

      console.log('✅ Successfully updated class-level fee');
      return { data, error: null };
    } catch (error) {
      console.error('❌ Error in updateClassFee:', error);
      return { data: null, error };
    }
  },

  async getStudentFees(studentId) {
    try {
      console.log('getStudentFees: Fetching fees for student ID:', studentId);

      // First try a simple query without joins
      const { data, error } = await supabase
        .from(TABLES.STUDENT_FEES)
        .select('*')
        .eq('student_id', studentId)
        .order('payment_date', { ascending: false });

      console.log('getStudentFees: Query result:', { data, error });
      return { data, error };
    } catch (error) {
      console.error('getStudentFees: Unexpected error:', error);
      return { data: null, error };
    }
  },

  // Timetable management
  async getTeacherTimetable(teacherId, academicYear = null) {
    try {
      // If no academic year provided, use current year
      if (!academicYear) {
        const currentYear = new Date().getFullYear();
        academicYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
      }

      const { data, error } = await supabase
        .from(TABLES.TIMETABLE)
        .select(`
          *,
          classes(class_name, section),
          subjects(subject_name)
        `)
        .eq('teacher_id', teacherId)
        .eq('academic_year', academicYear)
        .order('day_of_week')
        .order('period_number');

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Exam and Marks management
  async getExams(classId) {
    try {
      const { data, error } = await supabase
        .from(TABLES.EXAMS)
        .select('*')
        .eq('class_id', classId)
        .order('start_date', { ascending: false });
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async getMarksByStudent(studentId, examId = null) {
    try {
      let query = supabase
        .from(TABLES.MARKS)
        .select(`
          *,
          exams(name, start_date),
          subjects(name)
        `)
        .eq('student_id', studentId);
      
      if (examId) {
        query = query.eq('exam_id', examId);
      }
      
      const { data, error } = await query;
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Homework management
  async getHomeworks(classId) {
    try {
      let query = supabase
        .from(TABLES.HOMEWORKS)
        .select('*')
        .eq('class_id', classId);

      const { data, error } = await query.order('due_date');

      // Handle case where homeworks table doesn't exist
      if (error && error.code === '42P01') {
        console.log('Homeworks table does not exist');
        return { data: [], error: null };
      }

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Parent management
  async getParentByUserId(userId) {
    try {
      // Get current tenant ID (but don't require it for parents)
      const tenantId = await tenantHelpers.getCurrentTenantId();
      if (!tenantId) {
        console.log('No tenant context found for getParentByUserId, but proceeding for parent access');
      }
      
      // Get user data with linked student information
      // For parents, we don't filter by tenant_id since they might not have one
      let query = supabase
        .from(TABLES.USERS)
        .select(`
          *,
          roles(role_name),
          students!users_linked_parent_of_fkey(
            id,
            name,
            admission_no,
            roll_no,
            dob,
            gender,
            address,
            class_id,
            tenant_id,
            classes(id, class_name, section, tenant_id)
          )
        `)
        .eq('id', userId);
      
      // Only filter by tenant_id if it exists (for backward compatibility)
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }
      
      const { data: userData, error: userError } = await query.single();

      if (userError) {
        console.error('Error fetching parent user data:', userError);
        return { data: null, error: userError };
      }

      if (!userData.linked_parent_of) {
        return { data: null, error: new Error('No student linked to this user') };
      }

      // For parents, we don't enforce strict tenant validation since they may access
      // their children's data across different tenant contexts
      console.log('Successfully fetched parent data:', {
        userId,
        tenantId: tenantId || 'NOT REQUIRED FOR PARENTS',
        studentId: userData.students?.id,
        studentName: userData.students?.name
      });

      return { data: userData, error: null };
    } catch (error) {
      console.error('Error in getParentByUserId:', error);
      return { data: null, error };
    }
  },

  async getStudentsByParentId(userId) {
    try {
      // Get current tenant ID (but don't require it for parents)
      const tenantId = await getUserTenantId();
      if (!tenantId) {
        console.log('No tenant context found for getStudentsByParentId, but proceeding for parent access');
      }

      // Get parent's linked student - for parents, we don't require tenant filtering
      let query = supabase
        .from(TABLES.USERS)
        .select(`
          id,
          email,
          full_name,
          linked_parent_of,
          students!users_linked_parent_of_fkey(
            id,
            name,
            admission_no,
            roll_no,
            class_id,
            academic_year,
            dob,
            gender,
            address,
            tenant_id,
            classes(
              id,
              class_name,
              section,
              academic_year,
              tenant_id
            )
          )
        `)
        .eq('id', userId);
      
      // Only filter by tenant_id if it exists
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }
      
      const { data, error } = await query.single();

      if (error) {
        console.error('Error fetching students by parent ID:', error);
        return { data: null, error };
      }

      if (!data || !data.students) {
        return { data: null, error: new Error('No students found for this parent') };
      }

      console.log('Successfully fetched student data for parent:', {
        parentId: userId,
        studentId: data.students.id,
        studentName: data.students.name
      });

      return { data: data.students, error: null };
    } catch (error) {
      console.error('Error in getStudentsByParentId:', error);
      return { data: null, error };
    }
  },

  // Student management
  async getStudentByUserId(userId) {
    try {
      // Get user data with linked student information
      const { data: userData, error: userError } = await supabase
        .from(TABLES.USERS)
        .select(`
          *,
          roles(role_name),
          students!users_linked_student_id_fkey(
            id,
            name,
            admission_no,
            roll_no,
            dob,
            gender,
            address,
            class_id,
            tenant_id,
            classes(id, class_name, section)
          )
        `)
        .eq('id', userId)
        .single();

      if (userError) {
        return { data: null, error: userError };
      }

      if (!userData.linked_student_id) {
        return { data: null, error: new Error('No student linked to this user') };
      }

      return { data: userData, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async getStudentAttendance(studentId, startDate = null, endDate = null) {
    try {
      let query = supabase
        .from(TABLES.STUDENT_ATTENDANCE)
        .select('*')
        .eq('student_id', studentId)
        .order('date', { ascending: false });

      if (startDate) {
        query = query.gte('date', startDate);
      }
      if (endDate) {
        query = query.lte('date', endDate);
      }

      const { data, error } = await query;
      return { data: data || [], error };
    } catch (error) {
      return { data: [], error };
    }
  },

  async getStudentMarks(studentId, examId = null) {
    try {
      let query = supabase
        .from(TABLES.MARKS)
        .select(`
          *,
          subjects(name),
          exams(name, start_date)
        `)
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

      if (examId) {
        query = query.eq('exam_id', examId);
      }

      const { data, error } = await query;
      return { data: data || [], error };
    } catch (error) {
      return { data: [], error };
    }
  },

  // Timetable management
  async getTimetable(classId) {
    try {
      let query = supabase
        .from(TABLES.TIMETABLE)
        .select(`
          *,
          subjects(id, name),
          teachers(id, name),
          classes(id, class_name, section)
        `)
        .eq('class_id', classId)
        .order('day_of_week, period_number');

      const { data, error } = await query;
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async createTimetableEntry(timetableData) {
    try {
      const { data, error } = await supabase
        .from(TABLES.TIMETABLE)
        .insert([timetableData])
        .select(`
          *,
          subjects(id, name),
          classes(id, class_name, section)
        `);
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async updateTimetableEntry(id, updates) {
    try {
      const { data, error } = await supabase
        .from(TABLES.TIMETABLE)
        .update(updates)
        .eq('id', id)
        .select(`
          *,
          subjects(id, name),
          classes(id, class_name, section)
        `);
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async deleteTimetableEntry(id) {
    try {
      const { data, error } = await supabase
        .from(TABLES.TIMETABLE)
        .delete()
        .eq('id', id);
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async getTimetableByClass(classId) {
    try {
      const { data, error } = await supabase
        .from(TABLES.TIMETABLE)
        .select(`
          *,
          subjects(id, name),
          classes(id, class_name, section)
        `)
        .eq('class_id', classId)
        .order('day_of_week, start_time');
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Notifications
  async getNotificationsByUserId(userId) {
    try {
      const { data, error } = await supabase
        .from(TABLES.NOTIFICATIONS)
        .select(`
          *,
          notification_recipients!inner(recipient_id, recipient_type)
        `)
        .eq('notification_recipients.recipient_id', userId)
        .order('created_at', { ascending: false });

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async getNotificationsByRole(role, userId = null) {
    try {
      // For backward compatibility, redirect to user-based query if userId provided
      if (userId) {
        return this.getNotificationsByUserId(userId);
      }

      // For role-based queries, we need to join through users and roles
      const { data, error } = await supabase
        .from(TABLES.NOTIFICATIONS)
        .select(`
          *,
          notification_recipients!inner(
            recipient_id,
            recipient_type,
            users!notification_recipients_recipient_id_fkey(
              id,
              roles(role_name)
            )
          )
        `)
        .eq('notification_recipients.users.roles.role_name', role)
        .order('created_at', { ascending: false });

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async getTasks() {
    try {
      // Use the tenant-aware read function to filter tasks by tenant_id
      return await this.read(TABLES.TASKS, {}, { selectClause: '*', orderBy: 'due_date' });
    } catch (error) {
      return { data: null, error };
    }
  },

  // Dashboard statistics
  async getDashboardStats() {
    try {
      const [
        { data: students, error: studentsError },
        { data: teachers, error: teachersError },
        { data: classes, error: classesError },
        { data: todayAttendance, error: attendanceError }
      ] = await Promise.all([
        supabase.from(TABLES.STUDENTS).select('id', { count: 'exact' }),
        supabase.from(TABLES.TEACHERS).select('id', { count: 'exact' }),
        supabase.from(TABLES.CLASSES).select('id', { count: 'exact' }),
        supabase.from(TABLES.STUDENT_ATTENDANCE)
          .select('id', { count: 'exact' })
          .eq('date', new Date().toISOString().split('T')[0])
          .eq('status', 'present')
      ]);

      return {
        data: {
          totalStudents: students?.length || 0,
          totalTeachers: teachers?.length || 0,
          totalClasses: classes?.length || 0,
          todayAttendance: todayAttendance?.length || 0
        },
        error: studentsError || teachersError || classesError || attendanceError
      };
    } catch (error) {
      return { data: null, error };
    }
  },

  // School Details management
  async getSchoolDetails() {
    try {
      // Get the current tenant_id to filter results
      const currentTenantId = await tenantHelpers.getCurrentTenantId();
      
      if (!currentTenantId) {
        console.warn('No tenant_id found for getSchoolDetails');
        return { data: null, error: new Error('No tenant context available') };
      }

      const { data, error } = await supabase
        .from(TABLES.SCHOOL_DETAILS)
        .select('*')
        .eq('tenant_id', currentTenantId)
        .maybeSingle();

      if (error) {
        return { data: null, error };
      }

      // Return the data directly (already single object or null)
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Standardized attendance utilities
  normalizeAttendanceStatus(status) {
    if (!status) return 'absent';
    const normalizedStatus = status.toLowerCase().trim();

    switch (normalizedStatus) {
      case 'present':
      case 'p':
        return 'present';
      case 'absent':
      case 'a':
        return 'absent';
      case 'late':
      case 'l':
        return 'late';
      case 'excused':
      case 'e':
        return 'excused';
      default:
        console.warn(`Unknown attendance status: ${status}, defaulting to absent`);
        return 'absent';
    }
  },

  isAttendedStatus(status) {
    const normalizedStatus = this.normalizeAttendanceStatus(status);
    return ['present', 'late', 'excused'].includes(normalizedStatus);
  },

  // Get standardized attendance statistics for a student
  async getStudentAttendanceStats(studentId, options = {}) {
    try {
      const {
        startDate = null,
        endDate = null,
        countMethod = 'attended', // 'attended' or 'present_only'
        groupBy = null // 'month', 'week', 'day', or null
      } = options;

      let query = supabase
        .from(TABLES.STUDENT_ATTENDANCE)
        .select('date, status')
        .eq('student_id', studentId)
        .order('date', { ascending: true });

      if (startDate) {
        query = query.gte('date', startDate);
      }
      if (endDate) {
        query = query.lte('date', endDate);
      }

      const { data: attendanceRecords, error } = await query;
      if (error) return { data: null, error };

      if (!attendanceRecords || attendanceRecords.length === 0) {
        return {
          data: {
            totalDays: 0,
            attendedDays: 0,
            presentDays: 0,
            absentDays: 0,
            lateDays: 0,
            excusedDays: 0,
            attendancePercentage: 0,
            presentOnlyPercentage: 0,
            breakdown: {}
          },
          error: null
        };
      }

      // Process records with standardized status
      const processedRecords = attendanceRecords.map(record => ({
        ...record,
        normalizedStatus: this.normalizeAttendanceStatus(record.status),
        isAttended: this.isAttendedStatus(record.status)
      }));

      // Calculate basic stats
      const totalDays = processedRecords.length;
      const attendedDays = processedRecords.filter(r => r.isAttended).length;
      const presentDays = processedRecords.filter(r => r.normalizedStatus === 'present').length;
      const absentDays = processedRecords.filter(r => r.normalizedStatus === 'absent').length;
      const lateDays = processedRecords.filter(r => r.normalizedStatus === 'late').length;
      const excusedDays = processedRecords.filter(r => r.normalizedStatus === 'excused').length;

      const attendancePercentage = totalDays > 0 ? Math.round((attendedDays / totalDays) * 100) : 0;
      const presentOnlyPercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

      // Group by period if requested
      let breakdown = {};
      if (groupBy) {
        processedRecords.forEach(record => {
          let key;
          const date = new Date(record.date);

          switch (groupBy) {
            case 'month':
              key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
              break;
            case 'week':
              const weekStart = new Date(date);
              weekStart.setDate(date.getDate() - date.getDay());
              key = weekStart.toISOString().split('T')[0];
              break;
            case 'day':
              key = record.date;
              break;
            default:
              key = 'all';
          }

          if (!breakdown[key]) {
            breakdown[key] = {
              totalDays: 0,
              attendedDays: 0,
              presentDays: 0,
              absentDays: 0,
              lateDays: 0,
              excusedDays: 0
            };
          }

          breakdown[key].totalDays++;
          breakdown[key][`${record.normalizedStatus}Days`]++;
          if (record.isAttended) {
            breakdown[key].attendedDays++;
          }
        });

        // Calculate percentages for each group
        Object.keys(breakdown).forEach(key => {
          const group = breakdown[key];
          group.attendancePercentage = group.totalDays > 0 ?
            Math.round((group.attendedDays / group.totalDays) * 100) : 0;
          group.presentOnlyPercentage = group.totalDays > 0 ?
            Math.round((group.presentDays / group.totalDays) * 100) : 0;
        });
      }

      return {
        data: {
          totalDays,
          attendedDays,
          presentDays,
          absentDays,
          lateDays,
          excusedDays,
          attendancePercentage,
          presentOnlyPercentage,
          breakdown,
          records: processedRecords
        },
        error: null
      };
    } catch (error) {
      return { data: null, error };
    }
  },

  async updateSchoolDetails(schoolData) {
    try {
      // First check if school details exist
      const { data: existing, error: getError } = await this.getSchoolDetails();

      if (getError) {
        return { data: null, error: getError };
      }

      if (existing && existing.id) {
        // Update existing record
        const { data, error } = await supabase
          .from(TABLES.SCHOOL_DETAILS)
          .update(schoolData)
          .eq('id', existing.id)
          .select()
          .single();

        if (error) {
          return { data: null, error };
        }

        return { data, error: null };
      } else {
        // Create new record - add tenant_id
        const currentTenantId = await tenantHelpers.getCurrentTenantId();
        if (!currentTenantId) {
          return { data: null, error: new Error('No tenant context available for creating school details') };
        }
        
        const schoolDataWithTenant = { ...schoolData, tenant_id: currentTenantId };
        const { data, error } = await supabase
          .from(TABLES.SCHOOL_DETAILS)
          .insert(schoolDataWithTenant)
          .select()
          .single();

        if (error) {
          return { data: null, error };
        }

        return { data, error: null };
      }
    } catch (error) {
      return { data: null, error };
    }
  },

  // ========================================
  // ADVANCED ATTENDANCE QUERIES
  // ========================================

  // Fetch attendance by student name, father's name, and class
  async getAttendanceByStudentDetails(searchCriteria, options = {}) {
    try {
      const {
        studentName = null,
        fatherName = null,
        className = null,
        section = null,
        startDate = null,
        endDate = null,
        limit = 100
      } = searchCriteria;

      const {
        includeStudentDetails = true,
        includeClassDetails = true,
        includeParentDetails = true,
        orderBy = 'date',
        orderDirection = 'desc'
      } = options;

      console.log('Searching attendance with criteria:', searchCriteria);

      // Build the query step by step
      let query = supabase
        .from(TABLES.STUDENT_ATTENDANCE)
        .select(`
          id,
          student_id,
          class_id,
          date,
          status,
          marked_by,
          created_at,
          ${includeStudentDetails ? `
          students!inner (
            id,
            name,
            admission_no,
            roll_no,
            dob,
            gender,
            academic_year,
            parent_id
          ),` : ''}
          ${includeClassDetails ? `
          classes!inner (
            id,
            class_name,
            section,
            academic_year
          )` : ''}
        `)
        .order(orderBy, { ascending: orderDirection === 'asc' })
        .limit(limit);

      // Apply student name filter
      if (studentName && studentName.trim()) {
        query = query.ilike('students.name', `%${studentName.trim()}%`);
      }

      // Apply class name filter
      if (className && className.trim()) {
        query = query.ilike('classes.class_name', `%${className.trim()}%`);
      }

      // Apply section filter
      if (section && section.trim()) {
        query = query.ilike('classes.section', `%${section.trim()}%`);
      }

      // Apply date range filters
      if (startDate) {
        query = query.gte('date', startDate);
      }
      if (endDate) {
        query = query.lte('date', endDate);
      }

      const { data: attendanceRecords, error: attendanceError } = await query;

      if (attendanceError) {
        console.error('Error fetching attendance records:', attendanceError);
        return { data: null, error: attendanceError };
      }

      console.log(`Found ${attendanceRecords?.length || 0} attendance records`);

      // If father's name is specified, we need to filter by parent data
      let filteredRecords = attendanceRecords || [];

      if (fatherName && fatherName.trim() && includeParentDetails) {
        console.log('Filtering by father name:', fatherName);
        
        // Get parent information for each student
        const studentIds = [...new Set(filteredRecords.map(record => record.student_id))];
        
        if (studentIds.length > 0) {
          const { data: parentData, error: parentError } = await supabase
            .from(TABLES.PARENTS)
            .select('student_id, name, relation')
            .in('student_id', studentIds)
            .ilike('name', `%${fatherName.trim()}%`)
            .eq('relation', 'Father');

          if (parentError) {
            console.error('Error fetching parent data:', parentError);
          } else {
            const validStudentIds = new Set(parentData.map(parent => parent.student_id));
            filteredRecords = filteredRecords.filter(record => 
              validStudentIds.has(record.student_id)
            );
            
            // Add parent information to the records
            filteredRecords = filteredRecords.map(record => {
              const parentInfo = parentData.find(parent => parent.student_id === record.student_id);
              return {
                ...record,
                father_name: parentInfo?.name || null
              };
            });
          }
        }
      }

      console.log(`Final filtered records: ${filteredRecords.length}`);

      return {
        data: filteredRecords,
        error: null,
        totalCount: filteredRecords.length,
        searchCriteria
      };
    } catch (error) {
      console.error('Error in getAttendanceByStudentDetails:', error);
      return { data: null, error };
    }
  },

  // Search students by name and father's name
  async searchStudentsByNameAndFather(searchCriteria) {
    try {
      const {
        studentName = null,
        fatherName = null,
        className = null,
        section = null,
        limit = 50
      } = searchCriteria;

      console.log('Searching students with criteria:', searchCriteria);

      let query = supabase
        .from(TABLES.STUDENTS)
        .select(`
          id,
          name,
          admission_no,
          roll_no,
          dob,
          gender,
          academic_year,
          class_id,
          parent_id,
          classes!inner (
            id,
            class_name,
            section,
            academic_year
          )
        `)
        .limit(limit);

      // Apply student name filter
      if (studentName && studentName.trim()) {
        query = query.ilike('name', `%${studentName.trim()}%`);
      }

      // Apply class name filter
      if (className && className.trim()) {
        query = query.ilike('classes.class_name', `%${className.trim()}%`);
      }

      // Apply section filter
      if (section && section.trim()) {
        query = query.ilike('classes.section', `%${section.trim()}%`);
      }

      const { data: students, error: studentsError } = await query;

      if (studentsError) {
        console.error('Error fetching students:', studentsError);
        return { data: null, error: studentsError };
      }

      let filteredStudents = students || [];

      // Filter by father's name if specified
      if (fatherName && fatherName.trim()) {
        console.log('Filtering students by father name:', fatherName);
        
        const studentIds = filteredStudents.map(student => student.id);
        
        if (studentIds.length > 0) {
          const { data: parentData, error: parentError } = await supabase
            .from(TABLES.PARENTS)
            .select('student_id, name, relation')
            .in('student_id', studentIds)
            .ilike('name', `%${fatherName.trim()}%`)
            .eq('relation', 'Father');

          if (parentError) {
            console.error('Error fetching parent data for filtering:', parentError);
          } else {
            const validStudentIds = new Set(parentData.map(parent => parent.student_id));
            filteredStudents = filteredStudents.filter(student => 
              validStudentIds.has(student.id)
            );
            
            // Add father's name to student records
            filteredStudents = filteredStudents.map(student => {
              const fatherInfo = parentData.find(parent => parent.student_id === student.id);
              return {
                ...student,
                father_name: fatherInfo?.name || null
              };
            });
          }
        }
      }

      console.log(`Found ${filteredStudents.length} matching students`);

      return {
        data: filteredStudents,
        error: null,
        totalCount: filteredStudents.length,
        searchCriteria
      };
    } catch (error) {
      console.error('Error in searchStudentsByNameAndFather:', error);
      return { data: null, error };
    }
  },

  // Get detailed attendance report for specific students
  async getDetailedAttendanceReport(studentIds, options = {}) {
    try {
      const {
        startDate = null,
        endDate = null,
        includeStats = true,
        groupByMonth = false
      } = options;

      if (!studentIds || studentIds.length === 0) {
        return { data: [], error: null };
      }

      console.log('Generating detailed attendance report for students:', studentIds);

      // Fetch attendance records
      let query = supabase
        .from(TABLES.STUDENT_ATTENDANCE)
        .select(`
          id,
          student_id,
          class_id,
          date,
          status,
          marked_by,
          created_at,
          students!inner (
            id,
            name,
            admission_no,
            roll_no,
            academic_year
          ),
          classes!inner (
            id,
            class_name,
            section,
            academic_year
          )
        `)
        .in('student_id', studentIds)
        .order('date', { ascending: false });

      if (startDate) {
        query = query.gte('date', startDate);
      }
      if (endDate) {
        query = query.lte('date', endDate);
      }

      const { data: attendanceRecords, error: attendanceError } = await query;

      if (attendanceError) {
        console.error('Error fetching attendance for report:', attendanceError);
        return { data: null, error: attendanceError };
      }

      let reportData = attendanceRecords || [];

      // Add statistics if requested
      if (includeStats) {
        const statsPromises = studentIds.map(async (studentId) => {
          const studentRecords = reportData.filter(record => record.student_id === studentId);
          const totalDays = studentRecords.length;
          const presentDays = studentRecords.filter(record => record.status === 'Present').length;
          const absentDays = studentRecords.filter(record => record.status === 'Absent').length;
          const attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

          const student = studentRecords[0]?.students;
          
          return {
            student_id: studentId,
            student_name: student?.name || 'Unknown',
            admission_no: student?.admission_no || 'N/A',
            roll_no: student?.roll_no || 'N/A',
            total_days: totalDays,
            present_days: presentDays,
            absent_days: absentDays,
            attendance_percentage: attendancePercentage,
            records: studentRecords
          };
        });

        const stats = await Promise.all(statsPromises);
        
        return {
          data: reportData,
          statistics: stats,
          error: null,
          summary: {
            total_students: studentIds.length,
            date_range: { startDate, endDate },
            total_records: reportData.length
          }
        };
      }

      return {
        data: reportData,
        error: null
      };
    } catch (error) {
      console.error('Error generating attendance report:', error);
      return { data: null, error };
    }
  },

  // ========================================
  // EXPENSE MANAGEMENT FUNCTIONS
  // ========================================

  // Get expense categories
  async getExpenseCategories(tenantId = null) {
    try {
      // Get current tenant ID if not explicitly provided
      const currentTenantId = tenantId || await tenantHelpers.getCurrentTenantId();
      
      if (!currentTenantId) {
        console.warn('No tenant ID available for getExpenseCategories, this may return data from all tenants!');
        return { data: [], error: new Error('Tenant context required for expense categories') };
      }
      
      let query = supabase
        .from(TABLES.EXPENSE_CATEGORIES)
        .select('*')
        .eq('tenant_id', currentTenantId)  // Always filter by tenant_id
        .order('name');
      
      const { data, error } = await query;
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Get expenses with date filtering
  async getExpenses(filters = {}) {
    try {
      const { startDate = null, endDate = null, category = null, tenantId = null } = filters;
      
      console.log('🏢 getExpenses: Input filters:', { startDate, endDate, category, providedTenantId: tenantId });
      
      // Get current tenant ID if not explicitly provided
      const currentTenantId = tenantId || await tenantHelpers.getCurrentTenantId();
      
      console.log('🏢 getExpenses: Using tenant ID:', currentTenantId);
      
      if (!currentTenantId) {
        console.warn('❌ getExpenses: No tenant ID available, this may return data from all tenants!');
        return { data: [], error: new Error('Tenant context required for expense data') };
      }
      
      let query = supabase
        .from(TABLES.SCHOOL_EXPENSES)
        .select('*')
        .eq('tenant_id', currentTenantId)  // Always filter by tenant_id
        .order('expense_date', { ascending: false });
      
      if (startDate) {
        query = query.gte('expense_date', startDate);
      }
      if (endDate) {
        query = query.lte('expense_date', endDate);
      }
      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;
      
      console.log('✅ getExpenses: Retrieved', data?.length || 0, 'expenses for tenant:', currentTenantId);
      if (data && data.length > 0) {
        console.log('📊 getExpenses: Sample data (first expense):', {
          id: data[0].id,
          title: data[0].title,
          amount: data[0].amount,
          tenant_id: data[0].tenant_id,
          expense_date: data[0].expense_date
        });
      }
      
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Create a new expense
  async createExpense(expenseData, tenantId = null) {
    try {
      // Add tenant_id to the expense data if provided
      const finalExpenseData = tenantId ? { ...expenseData, tenant_id: tenantId } : expenseData;
      
      const { data, error } = await supabase
        .from(TABLES.SCHOOL_EXPENSES)
        .insert(finalExpenseData)
        .select()
        .single();
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Update an expense
  async updateExpense(expenseId, updates, tenantId = null) {
    try {
      let query = supabase
        .from(TABLES.SCHOOL_EXPENSES)
        .update(updates)
        .eq('id', expenseId);
        
      // Add tenant filter for security
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }
        
      const { data, error } = await query.select().single();
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Delete an expense
  async deleteExpense(expenseId, tenantId = null) {
    try {
      let query = supabase
        .from(TABLES.SCHOOL_EXPENSES)
        .delete()
        .eq('id', expenseId);
        
      // Add tenant filter for security
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }
        
      const { error } = await query;
      return { error };
    } catch (error) {
      return { error };
    }
  },

  // Create a new expense category
  async createExpenseCategory(categoryData, tenantId = null) {
    try {
      // Add tenant_id to the category data if provided
      const finalCategoryData = tenantId ? { ...categoryData, tenant_id: tenantId } : categoryData;
      
      const { data, error } = await supabase
        .from(TABLES.EXPENSE_CATEGORIES)
        .insert(finalCategoryData)
        .select()
        .single();
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Update an expense category
  async updateExpenseCategory(categoryName, updates, tenantId = null) {
    try {
      let query = supabase
        .from(TABLES.EXPENSE_CATEGORIES)
        .update(updates)
        .eq('name', categoryName);
        
      // Add tenant filter for security
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }
        
      const { data, error } = await query.select().single();
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Delete an expense category
  async deleteExpenseCategory(categoryName, tenantId = null) {
    try {
      let query = supabase
        .from(TABLES.EXPENSE_CATEGORIES)
        .delete()
        .eq('name', categoryName);
        
      // Add tenant filter for security
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }
        
      const { error } = await query;
      return { error };
    } catch (error) {
      return { error };
    }
  },

  // Get expense statistics for a date range
  async getExpenseStats(startDate, endDate) {
    try {
      // Get current tenant ID to ensure tenant-aware queries
      const currentTenantId = await tenantHelpers.getCurrentTenantId();
      
      if (!currentTenantId) {
        return { data: null, error: new Error('Tenant context required for expense statistics') };
      }
      
      const { data: expenses, error } = await this.getExpenses({ 
        startDate, 
        endDate, 
        tenantId: currentTenantId 
      });
      
      if (error) return { data: null, error };

      const { data: categories, error: categoriesError } = await this.getExpenseCategories(currentTenantId);
      
      if (categoriesError) return { data: null, error: categoriesError };

      // Calculate totals
      const totalAmount = expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
      const totalTransactions = expenses.length;

      // Group by category
      const categoryStats = categories.map(category => {
        const categoryExpenses = expenses.filter(exp => exp.category === category.name);
        const categoryTotal = categoryExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
        
        return {
          name: category.name,
          amount: categoryTotal,
          budget: category.monthly_budget || 0,
          count: categoryExpenses.length,
          percentage: totalAmount > 0 ? ((categoryTotal / totalAmount) * 100).toFixed(1) : 0,
          budgetUsage: category.monthly_budget > 0 ? ((categoryTotal / category.monthly_budget) * 100).toFixed(1) : 0
        };
      });

      return {
        data: {
          totalAmount,
          totalTransactions,
          categoryStats,
          expenses
        },
        error: null
      };
    } catch (error) {
      return { data: null, error };
    }
  },

  // ========================================
  // STUDENT FEE CONCESSION MANAGEMENT FUNCTIONS
  // ========================================

  // Get all fee concessions for a class
  async getDiscountsByClass(classId, academicYear = '2024-25') {
    try {
      const { data, error } = await supabase
        .from(TABLES.STUDENT_DISCOUNTS)
        .select(`
          *,
          students(id, name, admission_no, roll_no),
          classes(class_name, section)
        `)
        .eq('class_id', classId)
        .eq('academic_year', academicYear)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Get fee concessions for a specific student
  async getDiscountsByStudent(studentId, academicYear = '2024-25') {
    try {
      const { data, error } = await supabase
        .from(TABLES.STUDENT_DISCOUNTS)
        .select(`
          *,
          students(id, name, admission_no, roll_no),
          classes(class_name, section)
        `)
        .eq('student_id', studentId)
        .eq('academic_year', academicYear)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Create a new fee concession for a student - CLEAN VERSION (NO fee_structure modifications)
  async createStudentDiscount(discountData) {
    try {
      console.log('🎯 ULTRA CLEAN: Creating discount ONLY in student_discounts table');
      console.log('📋 Input data:', discountData);
      
      // Get tenant context
      const tenantId = await tenantHelpers.getCurrentTenantId();
      if (!tenantId) {
        console.error('❌ No tenant context available for creating student discount');
        return { data: null, error: new Error('Tenant context required') };
      }
      
      // Prepare clean discount data - ONLY for student_discounts table
      const cleanDiscountData = {
        student_id: discountData.student_id,
        class_id: discountData.class_id,
        academic_year: discountData.academic_year || '2024-25',
        discount_type: discountData.discount_type || 'fixed_amount',
        discount_value: Number(discountData.discount_value),
        fee_component: discountData.fee_component || null,
        description: discountData.description || null,
        tenant_id: tenantId,
        is_active: true,
        created_by: discountData.created_by || null
      };
      
      console.log('💾 Clean discount data to insert:', cleanDiscountData);
      
      // ONLY insert into student_discounts table - NO OTHER OPERATIONS
      const { data: discountResult, error: discountError } = await supabase
        .from(TABLES.STUDENT_DISCOUNTS)
        .insert(cleanDiscountData)
        .select('*')
        .single();
      
      if (discountError) {
        console.error('❌ Error inserting into student_discounts:', discountError);
        return { data: null, error: discountError };
      }
      
      console.log('✅ SUCCESS: Discount created in student_discounts table only');
      console.log('💡 The discount will be applied dynamically when fees are calculated');
      console.log('🚫 NO modifications made to fee_structure table');
      
      return { data: discountResult, error: null };
      
    } catch (error) {
      console.error('❌ Unexpected error in createStudentDiscount:', error);
      return { data: null, error };
    }
  },

  // Create bulk fee concessions for multiple students
  async createBulkStudentDiscounts(discountDataArray) {
    try {
      const { data, error } = await supabase
        .from(TABLES.STUDENT_DISCOUNTS)
        .insert(discountDataArray)
        .select(`
          *,
          students(id, name, admission_no, roll_no),
          classes(class_name, section)
        `);
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Update a fee concession
  async updateStudentDiscount(discountId, updates) {
    try {
      // Step 1: Get the original discount data first
      const { data: originalDiscount, error: fetchError } = await supabase
        .from(TABLES.STUDENT_DISCOUNTS)
        .select('*')
        .eq('id', discountId)
        .single();

      if (fetchError) {
        console.error('Error fetching original discount:', fetchError);
        return { data: null, error: fetchError };
      }

      // Step 2: Update the discount record
      const { data: updatedDiscount, error: updateError } = await supabase
        .from(TABLES.STUDENT_DISCOUNTS)
        .update(updates)
        .eq('id', discountId)
        .select(`
          *,
          students(id, name, admission_no, roll_no),
          classes(class_name, section)
        `)
        .single();

      if (updateError) {
        console.error('Error updating discount:', updateError);
        return { data: null, error: updateError };
      }

      // No need to update fee_structure anymore - discounts are calculated dynamically
      if (updates.discount_value && updates.discount_value !== originalDiscount.discount_value) {
        console.log('🎯 Discount value changed, will be applied dynamically during fee calculations');
        // Nothing to do here - discounts are applied dynamically during fee calculations
      }

      return { data: updatedDiscount, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Delete/Deactivate a fee concession
  async deleteStudentDiscount(discountId, hardDelete = false) {
    try {
      // Step 1: Get the discount details first so we can clean up related fee entries
      const { data: discountData, error: fetchError } = await supabase
        .from(TABLES.STUDENT_DISCOUNTS)
        .select('*')
        .eq('id', discountId)
        .single();

      if (fetchError) {
        console.error('Error fetching discount for deletion:', fetchError);
        return { error: fetchError };
      }

      console.log('🗑️ Deleting student discount:', discountData);

      if (hardDelete) {
        // Step 2A: Hard delete - Remove the discount record completely
        const { error } = await supabase
          .from(TABLES.STUDENT_DISCOUNTS)
          .delete()
          .eq('id', discountId);
        
        if (error) return { error };
        
        // No need to modify fee_structure table anymore
        console.log('🎯 CLEAN APPROACH: Discount removal will be applied dynamically during fee calculations');
        
        console.log('✅ Hard deleted discount and cleaned up student-specific fee entries');
        return { error: null };
      } else {
        // Step 2B: Soft delete by setting is_active to false
        const { data, error } = await supabase
          .from(TABLES.STUDENT_DISCOUNTS)
          .update({ is_active: false })
          .eq('id', discountId)
          .select()
          .single();
        
        if (error) return { data: null, error };
        
        // No need to modify fee_structure table anymore
        console.log('🎯 CLEAN APPROACH: Discount deactivation will be applied dynamically during fee calculations');
        
        console.log('✅ Soft deleted discount and cleaned up student-specific fee entries');
        return { data, error: null };
      }
    } catch (error) {
      console.error('Error in deleteStudentDiscount:', error);
      return { error };
    }
  },

  // Get students with their fee concession information for a class
  async getStudentsWithDiscounts(classId, academicYear = '2024-25') {
    try {
      console.log('🔍 Getting students with discounts for class:', classId);
      
      const tenantId = await tenantHelpers.getCurrentTenantId();
      if (!tenantId) {
        return { data: null, error: new Error('Tenant context required') };
      }

      // Get students in the class
      const { data: students, error: studentsError } = await supabase
        .from(TABLES.STUDENTS)
        .select(`
          id, name, admission_no, roll_no,
          classes(id, class_name, section)
        `)
        .eq('class_id', classId)
        .eq('tenant_id', tenantId);

      if (studentsError) {
        return { data: null, error: studentsError };
      }

      // Get all discounts for this class
      const { data: discounts, error: discountsError } = await supabase
        .from(TABLES.STUDENT_DISCOUNTS)
        .select('*')
        .eq('class_id', classId)
        .eq('academic_year', academicYear)
        .eq('tenant_id', tenantId)
        .eq('is_active', true);

      if (discountsError) {
        return { data: null, error: discountsError };
      }

      // Combine students with their discount information
      const studentsWithDiscounts = students.map(student => {
        const studentDiscounts = discounts.filter(d => d.student_id === student.id);
        const totalDiscount = studentDiscounts.reduce((sum, d) => sum + (d.discount_value || 0), 0);
        
        return {
          ...student,
          discounts: studentDiscounts,
          total_discount: totalDiscount,
          has_discount: studentDiscounts.length > 0
        };
      });

      return { data: studentsWithDiscounts, error: null };
    } catch (error) {
      console.error('Error in getStudentsWithDiscounts:', error);
      return { data: null, error };
    }
  },

  // Calculate fee with concession for a student
  async calculateStudentFee(studentId, classId, academicYear, feeComponent, baseAmount) {
    try {
      console.log('🧮 Calculating student fee:', { studentId, feeComponent, baseAmount });
      
      const tenantId = await tenantHelpers.getCurrentTenantId();
      if (!tenantId) {
        return { data: null, error: new Error('Tenant context required') };
      }

      // Get active discounts for this student and fee component
      const { data: discounts, error: discountsError } = await supabase
        .from(TABLES.STUDENT_DISCOUNTS)
        .select('*')
        .eq('student_id', studentId)
        .eq('class_id', classId)
        .eq('academic_year', academicYear)
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .or(`fee_component.eq.${feeComponent},fee_component.is.null`);

      if (discountsError) {
        return { data: null, error: discountsError };
      }

      let finalAmount = baseAmount;
      let discountApplied = 0;

      // Apply the discount if found
      if (discounts && discounts.length > 0) {
        const discount = discounts[0]; // Use first matching discount
        
        if (discount.discount_type === 'percentage') {
          discountApplied = (baseAmount * discount.discount_value) / 100;
        } else if (discount.discount_type === 'fixed_amount') {
          discountApplied = Math.min(discount.discount_value, baseAmount);
        }
        
        finalAmount = Math.max(0, baseAmount - discountApplied);
      }

      return {
        data: {
          student_id: studentId,
          fee_component: feeComponent,
          base_amount: baseAmount,
          discount_applied: discountApplied,
          final_amount: finalAmount
        },
        error: null
      };
    } catch (error) {
      console.error('Error in calculateStudentFee:', error);
      return { data: null, error };
    }
  },

  // Apply fee concession to fee structure (Clean approach: No longer modifies fee_structure)
  async applyDiscountToFeeStructure(studentId, classId, academicYear) {
    try {
      console.log('🎯 CLEAN APPROACH: Discounts are now managed only in student_discounts table');
      console.log('📋 Fee calculations are done dynamically using calculateStudentFeesWithDiscounts()');
      
      // Just return success as discounts are managed in student_discounts table
      return { 
        data: { 
          message: 'Discounts are managed in student_discounts table and applied dynamically',
          approach: 'clean'
        }, 
        error: null 
      };
    } catch (error) {
      return { data: null, error };
    }
  },

  // 🎯 NEW APPROACH: Calculate student fees dynamically from class fees + discounts
  async calculateStudentFeesWithDiscounts(studentId, classId, academicYear) {
    try {
      console.log('🧮 Calculating student fees dynamically:', { studentId, classId, academicYear });
      
      const tenantId = await tenantHelpers.getCurrentTenantId();
      if (!tenantId) {
        console.error('❌ No tenant context found');
        return { data: null, error: new Error('Tenant context required') };
      }

      // Step 1: Get class-level fees (base fees for the class)
      const { data: classFees, error: classFeesError } = await supabase
        .from(TABLES.FEE_STRUCTURE)
        .select('id, fee_component, amount, base_amount, due_date')
        .eq('class_id', classId)
        .eq('academic_year', academicYear)
        .eq('tenant_id', tenantId)
        .is('student_id', null) // Only class-level fees
        .order('fee_component');

      if (classFeesError) {
        console.error('❌ Error fetching class fees:', classFeesError);
        return { data: null, error: classFeesError };
      }

      if (!classFees || classFees.length === 0) {
        console.warn('⚠️ No class-level fees found for class:', classId);
        return { data: [], error: null };
      }

      // Step 2: Get active discounts for this student
      const { data: studentDiscounts, error: discountsError } = await supabase
        .from(TABLES.STUDENT_DISCOUNTS)
        .select('fee_component, discount_type, discount_value, description')
        .eq('student_id', studentId)
        .eq('class_id', classId)
        .eq('academic_year', academicYear)
        .eq('tenant_id', tenantId)
        .eq('is_active', true);

      if (discountsError) {
        console.error('❌ Error fetching student discounts:', discountsError);
        return { data: null, error: discountsError };
      }

      console.log('📋 Found class fees:', classFees.length);
      console.log('🎫 Found active discounts:', studentDiscounts?.length || 0);

      // Step 3: Apply discounts to class fees
      const studentFees = classFees.map(classFee => {
        // Find discount for this fee component (if any)
        const discount = studentDiscounts?.find(d => 
          d.fee_component === classFee.fee_component || 
          d.fee_component === null || 
          d.fee_component === 'ALL'
        );

        let finalAmount = classFee.amount;
        let discountApplied = 0;
        let discountDescription = null;

        if (discount) {
          if (discount.discount_type === 'percentage') {
            discountApplied = (classFee.amount * discount.discount_value) / 100;
            finalAmount = classFee.amount - discountApplied;
          } else if (discount.discount_type === 'fixed_amount') {
            discountApplied = Math.min(discount.discount_value, classFee.amount); // Don't exceed fee amount
            finalAmount = classFee.amount - discountApplied;
          }
          discountDescription = discount.description;
        }

        return {
          id: classFee.id, // Keep original fee structure ID for reference
          student_id: studentId, // Add student context
          class_id: classId,
          academic_year: academicYear,
          fee_component: classFee.fee_component,
          base_amount: classFee.amount, // Original class fee amount
          amount: Math.max(0, finalAmount), // Final amount after discount (never negative)
          discount_applied: discountApplied,
          due_date: classFee.due_date,
          has_discount: !!discount,
          discount_description: discountDescription,
          tenant_id: tenantId
        };
      });

      const totalBaseFees = classFees.reduce((sum, fee) => sum + fee.amount, 0);
      const totalDiscountAmount = studentFees.reduce((sum, fee) => sum + (fee.discount_applied || 0), 0);
      const totalFinalAmount = studentFees.reduce((sum, fee) => sum + fee.amount, 0);

      console.log('💰 Fee calculation summary:');
      console.log(`   Base fees: ₹${totalBaseFees}`);
      console.log(`   Discount: ₹${totalDiscountAmount}`);
      console.log(`   Final amount: ₹${totalFinalAmount}`);

      return {
        data: studentFees,
        summary: {
          totalBaseFees,
          totalDiscountAmount,
          totalFinalAmount,
          discountPercentage: totalBaseFees > 0 ? ((totalDiscountAmount / totalBaseFees) * 100).toFixed(1) : 0
        },
        error: null
      };
    } catch (error) {
      console.error('❌ Error in calculateStudentFeesWithDiscounts:', error);
      return { data: null, error };
    }
  },

  // Clean approach: Only manage student_discounts table, never modify fee_structure
  async applyStudentDiscountToFeeStructure(studentId, classId, academicYear, discountValue, feeComponent = null) {
    try {
      console.log('🎯 CLEAN APPROACH: Only validating discount application:', {
        studentId, classId, academicYear, discountValue, feeComponent
      });

      // Just validate that class fees exist - don't modify fee_structure table
      const tenantId = await tenantHelpers.getCurrentTenantId();
      if (!tenantId) {
        return { data: null, error: new Error('Tenant context required') };
      }

      // Verify class fees exist
      let feeQuery = supabase
        .from(TABLES.FEE_STRUCTURE)
        .select('fee_component, amount')
        .eq('class_id', classId)
        .eq('academic_year', academicYear)
        .eq('tenant_id', tenantId)
        .is('student_id', null); // Only class-level fees

      if (feeComponent) {
        feeQuery = feeQuery.eq('fee_component', feeComponent);
      }

      const { data: classFees, error: feeError } = await feeQuery;

      if (feeError || !classFees || classFees.length === 0) {
        return { data: null, error: new Error('No class fees found. Create class fees first.') };
      }

      console.log('✅ Class fees verified. Discount will apply dynamically during calculation.');
      return { data: { verified: true, classFees }, error: null };
    } catch (error) {
      console.error('❌ Error in applyStudentDiscountToFeeStructure:', error);
      return { data: null, error };
    }
  },

  // Get fee concession summary view
  async getDiscountSummary(filters = {}) {
    try {
      let query = supabase.from('discount_summary').select('*');
      
      if (filters.classId) {
        query = query.eq('class_id', filters.classId);
      }
      if (filters.academicYear) {
        query = query.eq('academic_year', filters.academicYear);
      }
      if (filters.isActive !== undefined) {
        query = query.eq('is_active', filters.isActive);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Get fee components for fee concession selection
  async getFeeComponents(classId = null, academicYear = '2024-25') {
    try {
      let query = supabase
        .from(TABLES.FEE_STRUCTURE)
        .select('fee_component')
        .eq('academic_year', academicYear);
      
      if (classId) {
        query = query.eq('class_id', classId);
      }
      
      const { data, error } = await query;
      
      if (error) return { data: null, error };
      
      // Return unique fee components
      const uniqueComponents = [...new Set(data.map(item => item.fee_component))]
        .filter(component => component && component.trim())
        .sort();
      
      return { data: uniqueComponents, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // DEPRECATED: This function is no longer needed as we don't modify fee_structure directly
  // Kept for backward compatibility but it now does nothing
  async removeStudentSpecificFeeEntries(studentId, classId, academicYear, feeComponent = null) {
    console.log('🎯 CLEAN APPROACH: removeStudentSpecificFeeEntries is deprecated');
    console.log('No modifications to fee_structure needed - discounts are applied dynamically');
    return { error: null };
  },

  // Delete class fee and cascade to student-specific fee entries
  async deleteClassFeeWithCascade(classFeeId) {
    try {
      console.log('🗑️ Deleting class fee with cascade for ID:', classFeeId);
      
      // Step 1: Get the class fee details first
      const { data: classFee, error: fetchError } = await supabase
        .from(TABLES.FEE_STRUCTURE)
        .select('*')
        .eq('id', classFeeId)
        .is('student_id', null) // Ensure it's a class-level fee
        .single();

      if (fetchError) {
        console.error('Error fetching class fee for deletion:', fetchError);
        return { error: fetchError };
      }

      if (!classFee) {
        return { error: new Error('Class fee not found or is not a class-level fee') };
      }

      console.log('📋 Class fee to delete:', classFee);

      const tenantId = await tenantHelpers.getCurrentTenantId();
      if (!tenantId) {
        console.error('No tenant context found');
        return { error: new Error('Tenant context required') };
      }

      // Step 2: Find and delete all related student-specific fee entries
      const { data: relatedStudentFees, error: studentFeesError } = await supabase
        .from(TABLES.FEE_STRUCTURE)
        .select('id, student_id')
        .eq('class_id', classFee.class_id)
        .eq('academic_year', classFee.academic_year)
        .eq('fee_component', classFee.fee_component)
        .eq('tenant_id', tenantId)
        .not('student_id', 'is', null); // Only student-specific fees

      if (studentFeesError) {
        console.error('Error finding related student fees:', studentFeesError);
        return { error: studentFeesError };
      }

      console.log('📋 Related student-specific fees to delete:', relatedStudentFees?.length || 0);

      // Step 3: Delete related student-specific fees first
      if (relatedStudentFees && relatedStudentFees.length > 0) {
        const studentFeeIds = relatedStudentFees.map(fee => fee.id);
        
        const { error: deleteStudentFeesError } = await supabase
          .from(TABLES.FEE_STRUCTURE)
          .delete()
          .in('id', studentFeeIds);

        if (deleteStudentFeesError) {
          console.error('Error deleting related student fees:', deleteStudentFeesError);
          return { error: deleteStudentFeesError };
        }

        console.log('✅ Deleted', relatedStudentFees.length, 'related student-specific fee entries');
      }

      // Step 4: Find and delete related student discounts
      const { data: relatedDiscounts, error: discountsError } = await supabase
        .from(TABLES.STUDENT_DISCOUNTS)
        .select('id, student_id')
        .eq('class_id', classFee.class_id)
        .eq('academic_year', classFee.academic_year)
        .eq('fee_component', classFee.fee_component)
        .eq('tenant_id', tenantId);

      if (discountsError) {
        console.error('Error finding related discounts:', discountsError);
        // Don't fail the operation, just log the warning
      } else if (relatedDiscounts && relatedDiscounts.length > 0) {
        console.log('📋 Related discounts to deactivate:', relatedDiscounts.length);
        
        // Soft delete the discounts by setting is_active to false
        const { error: deactivateDiscountsError } = await supabase
          .from(TABLES.STUDENT_DISCOUNTS)
          .update({ is_active: false })
          .in('id', relatedDiscounts.map(discount => discount.id));

        if (deactivateDiscountsError) {
          console.error('Error deactivating related discounts:', deactivateDiscountsError);
          // Don't fail the operation, just log the warning
        } else {
          console.log('✅ Deactivated', relatedDiscounts.length, 'related student discounts');
        }
      }

      // Step 5: Delete the main class fee
      const { error: deleteClassFeeError } = await supabase
        .from(TABLES.FEE_STRUCTURE)
        .delete()
        .eq('id', classFeeId);

      if (deleteClassFeeError) {
        console.error('Error deleting class fee:', deleteClassFeeError);
        return { error: deleteClassFeeError };
      }

      console.log('✅ Successfully deleted class fee and all related entries');

      return {
        data: {
          deletedClassFee: classFee,
          deletedStudentFees: relatedStudentFees?.length || 0,
          deactivatedDiscounts: relatedDiscounts?.length || 0
        },
        error: null
      };
    } catch (error) {
      console.error('Error in deleteClassFeeWithCascade:', error);
      return { error };
    }
  },

  // Delete all class fees for a class and academic year with cascade
  async deleteAllClassFeesWithCascade(classId, academicYear) {
    try {
      console.log('🗑️ Deleting all class fees with cascade for class:', classId, 'year:', academicYear);
      
      const tenantId = await tenantHelpers.getCurrentTenantId();
      if (!tenantId) {
        console.error('No tenant context found');
        return { error: new Error('Tenant context required') };
      }

      // Step 1: Get all class-level fees for this class and academic year
      const { data: classFees, error: fetchError } = await supabase
        .from(TABLES.FEE_STRUCTURE)
        .select('*')
        .eq('class_id', classId)
        .eq('academic_year', academicYear)
        .eq('tenant_id', tenantId)
        .is('student_id', null); // Only class-level fees

      if (fetchError) {
        console.error('Error fetching class fees for deletion:', fetchError);
        return { error: fetchError };
      }

      if (!classFees || classFees.length === 0) {
        console.log('No class fees found to delete');
        return { data: { deletedClassFees: 0, deletedStudentFees: 0, deactivatedDiscounts: 0 }, error: null };
      }

      console.log('📋 Class fees to delete:', classFees.length);

      // Step 2: Delete all related student-specific fees for this class and year
      const { data: deletedStudentFees, error: deleteStudentFeesError } = await supabase
        .from(TABLES.FEE_STRUCTURE)
        .delete()
        .eq('class_id', classId)
        .eq('academic_year', academicYear)
        .eq('tenant_id', tenantId)
        .not('student_id', 'is', null) // Only student-specific fees
        .select('id');

      if (deleteStudentFeesError) {
        console.error('Error deleting student fees:', deleteStudentFeesError);
        return { error: deleteStudentFeesError };
      }

      console.log('✅ Deleted', deletedStudentFees?.length || 0, 'student-specific fee entries');

      // Step 3: Deactivate all related student discounts for this class and year
      const { data: deactivatedDiscounts, error: discountsError } = await supabase
        .from(TABLES.STUDENT_DISCOUNTS)
        .update({ is_active: false })
        .eq('class_id', classId)
        .eq('academic_year', academicYear)
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .select('id');

      if (discountsError) {
        console.error('Error deactivating discounts:', discountsError);
        // Don't fail the operation, just log the warning
      }

      console.log('✅ Deactivated', deactivatedDiscounts?.length || 0, 'student discounts');

      // Step 4: Delete all class-level fees
      const classFeeIds = classFees.map(fee => fee.id);
      const { error: deleteClassFeesError } = await supabase
        .from(TABLES.FEE_STRUCTURE)
        .delete()
        .in('id', classFeeIds);

      if (deleteClassFeesError) {
        console.error('Error deleting class fees:', deleteClassFeesError);
        return { error: deleteClassFeesError };
      }

      console.log('✅ Successfully deleted all class fees and related entries');

      return {
        data: {
          deletedClassFees: classFees.length,
          deletedStudentFees: deletedStudentFees?.length || 0,
          deactivatedDiscounts: deactivatedDiscounts?.length || 0,
          classFeesDeleted: classFees
        },
        error: null
      };
    } catch (error) {
      console.error('Error in deleteAllClassFeesWithCascade:', error);
      return { error };
    }
  },

  // Get the actual fees that apply to a specific student (class fees OR student-specific fees)
  async getStudentApplicableFees(studentId, classId, academicYear) {
    try {
      console.log('🔍 Getting applicable fees for student:', studentId);
      
      const tenantId = await tenantHelpers.getCurrentTenantId();
      if (!tenantId) {
        return { data: null, error: new Error('Tenant context required') };
      }

      // Step 1: Get student-specific fees (if any)
      const { data: studentSpecificFees, error: studentError } = await supabase
        .from(TABLES.FEE_STRUCTURE)
        .select('*')
        .eq('student_id', studentId)
        .eq('class_id', classId)
        .eq('academic_year', academicYear)
        .eq('tenant_id', tenantId)
        .order('fee_component');

      if (studentError) {
        return { data: null, error: studentError };
      }

      // Step 2: Get class-level fees
      const { data: classFees, error: classError } = await supabase
        .from(TABLES.FEE_STRUCTURE)
        .select('*')
        .eq('class_id', classId)
        .eq('academic_year', academicYear)
        .eq('tenant_id', tenantId)
        .is('student_id', null) // Only class-level fees
        .order('fee_component');

      if (classError) {
        return { data: null, error: classError };
      }

      // Step 3: Build the applicable fees list
      // For each fee component, use student-specific fee if exists, otherwise use class fee
      const applicableFees = [];
      const studentFeeComponents = new Set((studentSpecificFees || []).map(f => f.fee_component));

      console.log('📋 Student has specific fees for components:', Array.from(studentFeeComponents));

      // Add student-specific fees
      if (studentSpecificFees && studentSpecificFees.length > 0) {
        studentSpecificFees.forEach(fee => {
          applicableFees.push({
            ...fee,
            fee_type: 'student_specific',
            applicable_reason: 'Student has specific fee (concession applied)'
          });
        });
      }

      // Add class fees for components that don't have student-specific overrides
      if (classFees && classFees.length > 0) {
        classFees.forEach(fee => {
          if (!studentFeeComponents.has(fee.fee_component)) {
            applicableFees.push({
              ...fee,
              fee_type: 'class_level',
              applicable_reason: 'No student-specific override, using class fee'
            });
          }
        });
      }

      // Sort by fee component for consistency
      applicableFees.sort((a, b) => (a.fee_component || '').localeCompare(b.fee_component || ''));

      console.log('✅ Applicable fees for student:', studentId);
      applicableFees.forEach(fee => {
        console.log(`   ${fee.fee_component}: ${fee.amount} (${fee.fee_type})`);
      });

      return { data: applicableFees, error: null };
    } catch (error) {
      console.error('Error in getStudentApplicableFees:', error);
      return { data: null, error };
    }
  },

  // Check for fee structure integrity - ensure no class fees were accidentally modified
  async verifyFeeStructureIntegrity(classId, academicYear) {
    try {
      console.log('🔍 Verifying fee structure integrity for class:', classId);
      
      const tenantId = await tenantHelpers.getCurrentTenantId();
      if (!tenantId) {
        return { data: null, error: new Error('Tenant context required') };
      }

      // Get all fees for this class
      const { data: allFees, error } = await supabase
        .from(TABLES.FEE_STRUCTURE)
        .select('id, fee_component, amount, student_id')
        .eq('class_id', classId)
        .eq('academic_year', academicYear)
        .eq('tenant_id', tenantId)
        .order('fee_component, student_id');

      if (error) {
        return { data: null, error };
      }

      // Group by fee component
      const feesByComponent = {};
      allFees.forEach(fee => {
        if (!feesByComponent[fee.fee_component]) {
          feesByComponent[fee.fee_component] = { class: null, students: [] };
        }
        
        if (fee.student_id === null) {
          feesByComponent[fee.fee_component].class = fee;
        } else {
          feesByComponent[fee.fee_component].students.push(fee);
        }
      });

      // Analyze each component
      const report = {
        components: [],
        issues: [],
        summary: {
          totalComponents: 0,
          classFeesFound: 0,
          studentFeesFound: 0,
          integrityIssues: 0
        }
      };

      Object.keys(feesByComponent).forEach(component => {
        const componentData = feesByComponent[component];
        const componentReport = {
          component,
          classFee: componentData.class,
          studentFees: componentData.students,
          hasClassFee: !!componentData.class,
          studentCount: componentData.students.length,
          issues: []
        };

        // Check for issues
        if (!componentData.class) {
          componentReport.issues.push('Missing class-level fee (students will have no fallback)');
          report.issues.push(`${component}: Missing class-level fee`);
        }

        // Check if student fees have proper base_amount
        componentData.students.forEach(studentFee => {
          if (componentData.class && studentFee.base_amount !== componentData.class.amount) {
            componentReport.issues.push(`Student ${studentFee.student_id}: base_amount (${studentFee.base_amount}) doesn't match class fee (${componentData.class.amount})`);
            report.issues.push(`${component}: Student ${studentFee.student_id} has mismatched base_amount`);
          }
        });

        report.components.push(componentReport);
        report.summary.totalComponents++;
        if (componentData.class) report.summary.classFeesFound++;
        report.summary.studentFeesFound += componentData.students.length;
        report.summary.integrityIssues += componentReport.issues.length;
      });

      console.log('📊 Fee Structure Integrity Report:');
      console.log(`   Components: ${report.summary.totalComponents}`);
      console.log(`   Class fees: ${report.summary.classFeesFound}`);
      console.log(`   Student fees: ${report.summary.studentFeesFound}`);
      console.log(`   Issues: ${report.summary.integrityIssues}`);

      if (report.issues.length > 0) {
        console.log('❌ Issues found:');
        report.issues.forEach(issue => console.log(`   - ${issue}`));
      } else {
        console.log('✅ No integrity issues found');
      }

      return { data: report, error: null };
    } catch (error) {
      console.error('Error in verifyFeeStructureIntegrity:', error);
      return { data: null, error };
    }
  },

  // Create student discount with automatic distribution logic
  async createStudentDiscount(discountData) {
    try {
      console.log('🔧 Creating student discount with distribution logic:', discountData);
      
      // Validate input data
      const validation = this.validateDiscountData(discountData);
      if (!validation.isValid) {
        return { 
          data: null, 
          error: new Error(`Validation failed: ${validation.errors.join(', ')}`) 
        };
      }

      const tenantId = await tenantHelpers.getCurrentTenantId();
      if (!tenantId) {
        return { data: null, error: new Error('Tenant context required') };
      }

      // Check if fee_component is empty or null (meaning apply to all components)
      const applyToAllComponents = !discountData.fee_component || discountData.fee_component.trim() === '';
      
      if (!applyToAllComponents) {
        // Simple case: specific fee component, create single discount
        console.log('📝 Creating discount for specific component:', discountData.fee_component);
        
        const singleDiscountData = {
          ...discountData,
          tenant_id: tenantId,
          is_active: true,
          created_at: new Date().toISOString()
        };
        
        const { data, error } = await supabase
          .from(TABLES.STUDENT_DISCOUNTS)
          .insert(singleDiscountData)
          .select()
          .single();
        
        if (error) {
          console.error('❌ Error creating single discount:', error);
          return { data: null, error };
        }
        
        console.log('✅ Single discount created successfully');
        return { 
          data: [data], // Return as array for consistency
          distributionDetails: {
            originalAmount: discountData.discount_value,
            distribution: [{
              component: discountData.fee_component,
              amount: discountData.discount_value
            }]
          },
          error: null 
        };
      }
      
      // Complex case: Apply to all components - implement distribution logic
      console.log('🎯 Applying discount to all components with distribution logic');
      
      // Get fee components sorted by amount (highest first)
      const { data: sortedFees, error: feesError } = await this.getFeeComponentsSortedByAmount(
        discountData.class_id, 
        discountData.academic_year
      );
      
      if (feesError || !sortedFees || sortedFees.length === 0) {
        return { 
          data: null, 
          error: new Error('No fee components found for this class. Please set up fee structure first.') 
        };
      }
      
      console.log('💰 Fee components sorted by amount:', sortedFees.map(f => `${f.fee_component}: ₹${f.amount}`));
      
      // Distribute the concession amount starting from highest fee
      let remainingConcession = parseFloat(discountData.discount_value);
      const distributionPlan = [];
      
      for (const feeComponent of sortedFees) {
        if (remainingConcession <= 0) break;
        
        const componentAmount = parseFloat(feeComponent.amount);
        const concessionToApply = Math.min(remainingConcession, componentAmount);
        
        if (concessionToApply > 0) {
          distributionPlan.push({
            component: feeComponent.fee_component,
            componentAmount: componentAmount,
            concessionAmount: concessionToApply
          });
          
          remainingConcession -= concessionToApply;
        }
      }
      
      console.log('📊 Distribution plan:', distributionPlan);
      
      if (distributionPlan.length === 0) {
        return { 
          data: null, 
          error: new Error('No valid fee components found to apply concession') 
        };
      }
      
      // Create multiple discount records based on distribution plan
      const createdDiscounts = [];
      
      for (const plan of distributionPlan) {
        const distributedDiscountData = {
          student_id: discountData.student_id,
          class_id: discountData.class_id,
          academic_year: discountData.academic_year,
          discount_type: 'fixed_amount', // Always fixed amount for distributed concessions
          discount_value: plan.concessionAmount,
          fee_component: plan.component,
          description: `${discountData.description || 'Fee concession'} (Auto-distributed: ₹${plan.concessionAmount} from ₹${discountData.discount_value})`,
          tenant_id: tenantId,
          is_active: true,
          created_at: new Date().toISOString()
        };
        
        console.log('💾 Creating discount record:', distributedDiscountData);
        
        const { data: createdDiscount, error: createError } = await supabase
          .from(TABLES.STUDENT_DISCOUNTS)
          .insert(distributedDiscountData)
          .select()
          .single();
        
        if (createError) {
          console.error('❌ Error creating distributed discount:', createError);
          
          // If we've created some discounts already, we should clean them up
          if (createdDiscounts.length > 0) {
            console.log('🧹 Cleaning up partially created discounts...');
            const idsToCleanup = createdDiscounts.map(d => d.id);
            await supabase
              .from(TABLES.STUDENT_DISCOUNTS)
              .delete()
              .in('id', idsToCleanup);
          }
          
          return { data: null, error: createError };
        }
        
        createdDiscounts.push(createdDiscount);
      }
      
      console.log(`✅ Successfully created ${createdDiscounts.length} distributed discount records`);
      
      return { 
        data: createdDiscounts,
        distributionDetails: {
          originalAmount: parseFloat(discountData.discount_value),
          totalDistributed: createdDiscounts.reduce((sum, d) => sum + parseFloat(d.discount_value), 0),
          remainingAmount: remainingConcession,
          distribution: distributionPlan.map(p => ({
            component: p.component,
            componentAmount: p.componentAmount,
            concessionAmount: p.concessionAmount
          }))
        },
        error: null 
      };
      
    } catch (error) {
      console.error('❌ Error in createStudentDiscount:', error);
      return { data: null, error };
    }
  },

  // Get discounts by student
  async getDiscountsByStudent(studentId, academicYear = '2024-25') {
    try {
      const tenantId = await tenantHelpers.getCurrentTenantId();
      if (!tenantId) {
        return { data: null, error: new Error('Tenant context required') };
      }

      const { data, error } = await supabase
        .from(TABLES.STUDENT_DISCOUNTS)
        .select(`
          *,
          students(name),
          classes(class_name, section)
        `)
        .eq('student_id', studentId)
        .eq('academic_year', academicYear)
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      return { data: data || [], error };
    } catch (error) {
      console.error('❌ Error in getDiscountsByStudent:', error);
      return { data: null, error };
    }
  },

  // Update student discount
  async updateStudentDiscount(discountId, updates) {
    try {
      const tenantId = await tenantHelpers.getCurrentTenantId();
      if (!tenantId) {
        return { data: null, error: new Error('Tenant context required') };
      }

      const { data, error } = await supabase
        .from(TABLES.STUDENT_DISCOUNTS)
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', discountId)
        .eq('tenant_id', tenantId)
        .select()
        .single();
      
      return { data, error };
    } catch (error) {
      console.error('❌ Error in updateStudentDiscount:', error);
      return { data: null, error };
    }
  },

  // Delete student discount
  async deleteStudentDiscount(discountId, hardDelete = false) {
    try {
      const tenantId = await tenantHelpers.getCurrentTenantId();
      if (!tenantId) {
        return { error: new Error('Tenant context required') };
      }

      if (hardDelete) {
        const { error } = await supabase
          .from(TABLES.STUDENT_DISCOUNTS)
          .delete()
          .eq('id', discountId)
          .eq('tenant_id', tenantId);
        
        return { error };
      } else {
        // Soft delete - mark as inactive
        const { error } = await supabase
          .from(TABLES.STUDENT_DISCOUNTS)
          .update({ 
            is_active: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', discountId)
          .eq('tenant_id', tenantId);
        
        return { error };
      }
    } catch (error) {
      console.error('❌ Error in deleteStudentDiscount:', error);
      return { error };
    }
  },

  // Validate fee concession data before creation
  validateDiscountData(discountData) {
    const errors = [];
    
    if (!discountData.student_id) errors.push('Student ID is required');
    if (!discountData.class_id) errors.push('Class ID is required');
    if (!discountData.academic_year) errors.push('Academic year is required');
    if (!discountData.discount_type) errors.push('Fee concession type is required');
    if (discountData.discount_value === undefined || discountData.discount_value === null) {
      errors.push('Fee concession value is required');
    }
    
    if (discountData.discount_type === 'percentage') {
      if (discountData.discount_value < 0 || discountData.discount_value > 100) {
        errors.push('Percentage fee concession must be between 0 and 100');
      }
    } else if (discountData.discount_type === 'fixed_amount') {
      if (discountData.discount_value < 0) {
        errors.push('Fixed amount fee concession must be positive');
      }
    } else {
      errors.push('Fee concession type must be either "percentage" or "fixed_amount"');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  },
};

export default supabase; 
