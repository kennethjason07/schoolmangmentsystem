import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

// Custom storage adapter for persistent sessions
const customStorageAdapter = {
  getItem: (key) => {
    if (Platform.OS === 'web') {
      return globalThis?.localStorage?.getItem(key) ?? null;
    }
    return AsyncStorage.getItem(key);
  },
  setItem: (key, value) => {
    if (Platform.OS === 'web') {
      globalThis?.localStorage?.setItem(key, value);
      return;
    }
    return AsyncStorage.setItem(key, value);
  },
  removeItem: (key) => {
    if (Platform.OS === 'web') {
      globalThis?.localStorage?.removeItem(key);
      return;
    }
    return AsyncStorage.removeItem(key);
  },
};

// Create Supabase client with persistent session configuration
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: customStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// Utility functions
export const isValidUUID = (uuid) => {
  if (!uuid || typeof uuid !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// Tenant management utilities
export const tenantHelpers = {
  // Get current tenant ID from user session
  async getCurrentTenantId() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        console.warn('No authenticated user found for tenant context');
        return null;
      }
      
      // PRIORITIZE database tenant_id over metadata to avoid stale metadata issues
      try {
        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          .select('tenant_id, email, role_id')
          .eq('id', user.id)
          .maybeSingle();

        if (!profileError && userProfile && userProfile.tenant_id) {
          return userProfile.tenant_id;
        }
      } catch (profileError) {
        console.warn('Could not access user profile table for tenant_id:', profileError);
      }
      
      // PRIORITY 2: Check user metadata for tenant_id as fallback
      const metadataTenantId = user.app_metadata?.tenant_id || user.user_metadata?.tenant_id;
      if (metadataTenantId) {
        return metadataTenantId;
      }
      
      // FALLBACK: Use known tenant_id for this school system
      // Since you confirmed all users belong to this tenant, we can safely use it as fallback
      const knownTenantId = 'b8f8b5f0-1234-4567-8901-123456789000';
      console.warn('No tenant_id found in metadata or database, using known school tenant_id as fallback:', knownTenantId);
      return knownTenantId;
    } catch (error) {
      console.error('Error getting current tenant ID:', error);
      // Return known tenant as final fallback for this school
      const knownTenantId = 'b8f8b5f0-1234-4567-8901-123456789000';
      console.warn('Using known school tenant_id due to error:', knownTenantId);
      return knownTenantId;
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
      const { error } = await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
      if (error) {
        console.error('Error setting tenant context:', error);
        return { success: false, error };
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error in setTenantContext:', error);
      return { success: false, error };
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
  async signUp(email, password, userData = {}) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: userData,
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
    console.log('🔍 [getUserTenantId] Starting tenant ID resolution...');
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('❌ [getUserTenantId] No authenticated user found for tenant context');
      return null;
    }

    // PRIORITIZE database tenant_id over metadata to avoid stale metadata issues
    try {
      console.log('🔍 [getUserTenantId] Checking database for tenant_id...');
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('tenant_id, email, role_id')
        .eq('id', user.id)
        .maybeSingle();

      console.log('🔍 [getUserTenantId] Database query result:');
      console.log('   - Profile found:', !!userProfile);
      console.log('   - Profile email:', userProfile?.email);
      console.log('   - Profile tenant_id:', userProfile?.tenant_id);
      console.log('   - Profile role_id:', userProfile?.role_id);
      console.log('   - Error:', profileError?.message || 'None');
      console.log('   - Error code:', profileError?.code || 'None');

      if (!profileError && userProfile && userProfile.tenant_id) {
        console.log(`Found tenant_id in user profile (prioritized): ${userProfile.tenant_id}`);
        return userProfile.tenant_id;
      }

      if (profileError) {
        console.warn('⚠️ [getUserTenantId] Error accessing user profile table:', profileError);
      } else {
        console.warn('⚠️ [getUserTenantId] No tenant_id found in user profile');
      }
    } catch (profileError) {
      console.warn('💥 [getUserTenantId] Could not access user profile table:', profileError);
    }

    // PRIORITY 2: Check user metadata for tenant_id as fallback
    console.log('🔍 [getUserTenantId] Checking JWT metadata for tenant_id...');
    const metadataTenantId = user.app_metadata?.tenant_id || user.user_metadata?.tenant_id;
    console.log('🔍 [getUserTenantId] app_metadata:', JSON.stringify(user.app_metadata || {}, null, 2));
    console.log('🔍 [getUserTenantId] user_metadata:', JSON.stringify(user.user_metadata || {}, null, 2));
    console.log('🔍 [getUserTenantId] metadataTenantId:', metadataTenantId);
    
    if (metadataTenantId) {
      console.log(`✅ [getUserTenantId] Found tenant_id in user metadata: ${metadataTenantId}`);
      return metadataTenantId;
    }

    // FALLBACK: Use known tenant_id for this school system
    // Since you confirmed all users belong to this tenant, we can safely use it as fallback
    const knownTenantId = 'b8f8b5f0-1234-4567-8901-123456789000';
    console.warn(`⚠️ [getUserTenantId] No tenant_id found in metadata or database`);
    console.warn(`💡 [getUserTenantId] Using known school tenant_id as fallback: ${knownTenantId}`);
    console.warn(`💡 [getUserTenantId] This is temporary - should fix user metadata/JWT to include tenant_id`);
    
    return knownTenantId;
  } catch (error) {
    console.error('💥 [getUserTenantId] Error in getUserTenantId:', error);
    // Return known tenant as final fallback for this school
    const knownTenantId = 'b8f8b5f0-1234-4567-8901-123456789000';
    console.warn(`⚠️ [getUserTenantId] Using known school tenant_id due to error: ${knownTenantId}`);
    return knownTenantId;
  }
};

// Database helper functions
export const dbHelpers = {
  // Ensure default roles exist
  async ensureRolesExist() {
    try {
      const defaultRoles = ['admin', 'teacher', 'student', 'parent'];
      console.log('🔍 Checking if roles exist...');

      for (const roleName of defaultRoles) {
        const { data: existingRole, error: selectError } = await supabase
          .from(TABLES.ROLES)
          .select('id')
          .eq('role_name', roleName)
          .maybeSingle();

        if (selectError && selectError.code !== 'PGRST116') {
          console.warn(`⚠️  Could not check role ${roleName}:`, selectError.message);
          continue;
        }

        if (!existingRole) {
          console.log(`➕ Creating role: ${roleName}`);
          const { error: insertError } = await supabase
            .from(TABLES.ROLES)
            .insert({ role_name: roleName });
          
          if (insertError) {
            console.warn(`⚠️  Could not create role ${roleName}:`, insertError.message);
            // Continue with other roles
          } else {
            console.log(`✅ Created role: ${roleName}`);
          }
        } else {
          console.log(`✅ Role ${roleName} already exists (ID: ${existingRole.id})`);
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Error ensuring roles exist:', error);
      return { success: false, error };
    }
  },

  // Get role ID with fallback for when RLS prevents access
  async getRoleIdSafely(roleName) {
    try {
      console.log(`🔍 getRoleIdSafely: Attempting to fetch role ID for '${roleName}'`);
      
      // Input validation
      if (!roleName || typeof roleName !== 'string') {
        console.error('❌ getRoleIdSafely: Invalid role name provided:', roleName);
        return 1; // Default fallback
      }
      
      const { data: role, error } = await supabase
        .from(TABLES.ROLES)
        .select('id')
        .eq('role_name', roleName)
        .maybeSingle();

      if (error) {
        console.warn(`⚠️  Could not fetch role ${roleName}:`, error.message);
        // Return a fallback role ID based on role name
        // This is a temporary solution for when RLS prevents role access
        const fallbackRoleIds = {
          'admin': 1,
          'teacher': 2,
          'student': 3,
          'parent': 4
        };
        const fallbackId = fallbackRoleIds[roleName.toLowerCase()] || 1;
        console.log(`🔄 Using fallback role ID ${fallbackId} for ${roleName}`);
        return fallbackId;
      }

      if (!role || role.id === null || role.id === undefined) {
        console.warn(`⚠️  Role ${roleName} not found or has invalid ID, using fallback`);
        const fallbackRoleIds = {
          'admin': 1,
          'teacher': 2,
          'student': 3,
          'parent': 4
        };
        const fallbackId = fallbackRoleIds[roleName.toLowerCase()] || 1;
        console.log(`🔄 Using fallback role ID ${fallbackId} for ${roleName}`);
        return fallbackId;
      }

      console.log(`✅ Found role ${roleName} with ID: ${role.id}`);
      return role.id;
    } catch (error) {
      console.error(`❌ Error getting role ID for ${roleName}:`, error);
      // Return fallback
      const fallbackRoleIds = {
        'admin': 1,
        'teacher': 2,
        'student': 3,
        'parent': 4
      };
      const fallbackId = fallbackRoleIds[roleName.toLowerCase()] || 1;
      console.log(`🔄 Exception fallback: Using role ID ${fallbackId} for ${roleName}`);
      return fallbackId;
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

  // Teacher management
  async getTeachers() {
    try {
      const { data, error } = await supabase
        .from(TABLES.TEACHERS)
        .select(`
          *,
          users!users_linked_teacher_id_fkey(id, email, full_name, phone)
        `)
        .order('name');
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async getTeacherByUserId(userId) {
    try {
      // First get the user to find linked_teacher_id
      const { data: user, error: userError } = await supabase
        .from(TABLES.USERS)
        .select('linked_teacher_id')
        .eq('id', userId)
        .single();

      if (userError || !user?.linked_teacher_id) {
        return { data: null, error: userError || new Error('No teacher linked to this user') };
      }

      // Then get the teacher with related data
      const { data, error } = await supabase
        .from(TABLES.TEACHERS)
        .select(`
          *,
          teacher_subjects(
            subjects(id, name, class_id)
          )
        `)
        .eq('id', user.linked_teacher_id)
        .single();
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async createTeacherAccount(teacherData, authData) {
    try {
      // 0. Ensure roles exist
      await this.ensureRolesExist();

      // 1. Create auth user using regular signup
      const { data: authUser, error: authError } = await supabase.auth.signUp({
        email: authData.email,
        password: authData.password,
        options: {
          data: {
            full_name: authData.full_name,
            role: 'teacher'
          },
          emailRedirectTo: undefined // Disable email confirmation for admin-created accounts
        }
      });

      if (authError) throw authError;

      if (!authUser.user) {
        throw new Error('Failed to create user account');
      }

      // 2. Get teacher role ID safely
      const teacherRoleId = await this.getRoleIdSafely('teacher');
      console.log(`✅ Using teacher role ID: ${teacherRoleId}`);
      
      if (!teacherRoleId || teacherRoleId === undefined || teacherRoleId === null) {
        console.error('❌ teacherRoleId is invalid:', teacherRoleId);
        throw new Error('Could not determine teacher role ID - received undefined or null value');
      }
      
      // Ensure it's a valid number
      if (typeof teacherRoleId !== 'number' || isNaN(teacherRoleId)) {
        console.error('❌ teacherRoleId is not a valid number:', teacherRoleId, typeof teacherRoleId);
        throw new Error(`Invalid teacher role ID: expected number, got ${typeof teacherRoleId}`);
      }

      // 3. Create user profile with linked_teacher_id
      const { data: userProfile, error: userError } = await supabase
        .from(TABLES.USERS)
        .insert({
          id: authUser.user.id,
          email: authData.email,
          full_name: authData.full_name,
          phone: authData.phone || '',
          role_id: teacherRoleId,
          linked_teacher_id: teacherData.teacherId  // ✅ Link to teacher record
        })
        .select()
        .single();

      if (userError) throw userError;

      // 4. Get the teacher record for return
      const { data: teacher, error: teacherError } = await supabase
        .from(TABLES.TEACHERS)
        .select('*')
        .eq('id', teacherData.teacherId)
        .single();

      if (teacherError) throw teacherError;

      return {
        data: {
          authUser: authUser.user,
          userProfile,
          teacher
        },
        error: null
      };
    } catch (error) {
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
        linked_student_id: studentData.studentId  // ✅ Link to student record
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

      // 3. Create user profile with linked_parent_of
      console.log('Creating parent account - Step 6: Creating user profile');
      const userProfileData = {
        id: authUser.user.id,
        email: authData.email,
        full_name: authData.full_name,
        phone: authData.phone || '',
        role_id: parentRoleId,
        linked_parent_of: studentData.studentId  // ✅ Link to student record as parent
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

      console.log('Creating parent account - Step 7: User profile created:', userProfile);

      // 4. Create parent record in parents table
      console.log('Creating parent account - Step 8: Creating parent record');
      const parentRecordData = {
        name: authData.full_name,
        relation: authData.relation || 'Guardian', // Default to Guardian if not specified
        phone: authData.phone || '',
        email: authData.email,
        student_id: studentData.studentId
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

      console.log('Creating parent account - Step 9: Parent record created:', parentRecord);

      // 5. Update student record to link to the parent record
      console.log('Creating parent account - Step 10: Updating student parent_id');
      const { error: studentUpdateError } = await supabase
        .from(TABLES.STUDENTS)
        .update({ parent_id: parentRecord.id })
        .eq('id', studentData.studentId);

      if (studentUpdateError) {
        console.error('Error updating student parent_id:', studentUpdateError);
        throw studentUpdateError;
      }

      console.log('Creating parent account - Step 11: Student parent_id updated successfully');

      // 6. Get the student record for return
      console.log('Creating parent account - Step 12: Getting student record for ID:', studentData.studentId);
      const { data: student, error: studentError } = await supabase
        .from(TABLES.STUDENTS)
        .select('*')
        .eq('id', studentData.studentId)
        .single();

      if (studentError) {
        console.error('Error getting student record:', studentError);
        throw studentError;
      }

      console.log('Creating parent account - Step 13: Success! Parent account and record created for student:', student.name);

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
        .upsert(attendanceData, { onConflict: 'student_id,date' })
        .select();
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Fee management
  async getFeeStructure(classId) {
    try {
      const { data, error } = await supabase
        .from(TABLES.FEE_STRUCTURE)
        .select('*')
        .eq('class_id', classId);
      return { data, error };
    } catch (error) {
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
      // Get user data with linked student information
      const { data: userData, error: userError } = await supabase
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
            classes(id, class_name, section)
          )
        `)
        .eq('id', userId)
        .single();

      if (userError) {
        return { data: null, error: userError };
      }

      if (!userData.linked_parent_of) {
        return { data: null, error: new Error('No student linked to this user') };
      }

      return { data: userData, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async getStudentsByParentId(userId) {
    try {
      // Get all students linked to this parent user
      const { data: userData, error: userError } = await supabase
        .from(TABLES.USERS)
        .select('linked_parent_of')
        .eq('id', userId)
        .single();

      if (userError || !userData.linked_parent_of) {
        return { data: [], error: userError || new Error('No students linked to this parent') };
      }

      // Get student details
      const { data: studentData, error: studentError } = await supabase
        .from(TABLES.STUDENTS)
        .select(`
          *,
          classes(id, class_name, section)
        `)
        .eq('id', userData.linked_parent_of)
        .single();

      if (studentError) {
        return { data: [], error: studentError };
      }

      return { data: [studentData], error: null };
    } catch (error) {
      return { data: [], error };
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
      const { data, error } = await supabase
        .from(TABLES.SCHOOL_DETAILS)
        .select('*')
        .limit(1);

      if (error) {
        return { data: null, error };
      }

      // Return the first record if exists, otherwise null
      return { data: data && data.length > 0 ? data[0] : null, error: null };
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
        // Create new record
        const { data, error } = await supabase
          .from(TABLES.SCHOOL_DETAILS)
          .insert(schoolData)
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
  async getExpenseCategories() {
    try {
      const { data, error } = await supabase
        .from(TABLES.EXPENSE_CATEGORIES)
        .select('*')
        .order('name');
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Get expenses with date filtering
  async getExpenses(filters = {}) {
    try {
      const { startDate = null, endDate = null, category = null } = filters;
      
      let query = supabase
        .from(TABLES.SCHOOL_EXPENSES)
        .select('*')
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
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Create a new expense
  async createExpense(expenseData) {
    try {
      const { data, error } = await supabase
        .from(TABLES.SCHOOL_EXPENSES)
        .insert(expenseData)
        .select()
        .single();
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Update an expense
  async updateExpense(expenseId, updates) {
    try {
      const { data, error } = await supabase
        .from(TABLES.SCHOOL_EXPENSES)
        .update(updates)
        .eq('id', expenseId)
        .select()
        .single();
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Delete an expense
  async deleteExpense(expenseId) {
    try {
      const { error } = await supabase
        .from(TABLES.SCHOOL_EXPENSES)
        .delete()
        .eq('id', expenseId);
      return { error };
    } catch (error) {
      return { error };
    }
  },

  // Create a new expense category
  async createExpenseCategory(categoryData) {
    try {
      const { data, error } = await supabase
        .from(TABLES.EXPENSE_CATEGORIES)
        .insert(categoryData)
        .select()
        .single();
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Update an expense category
  async updateExpenseCategory(categoryName, updates) {
    try {
      const { data, error } = await supabase
        .from(TABLES.EXPENSE_CATEGORIES)
        .update(updates)
        .eq('name', categoryName)
        .select()
        .single();
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Delete an expense category
  async deleteExpenseCategory(categoryName) {
    try {
      const { error } = await supabase
        .from(TABLES.EXPENSE_CATEGORIES)
        .delete()
        .eq('name', categoryName);
      return { error };
    } catch (error) {
      return { error };
    }
  },

  // Get expense statistics for a date range
  async getExpenseStats(startDate, endDate) {
    try {
      const { data: expenses, error } = await this.getExpenses({ startDate, endDate });
      
      if (error) return { data: null, error };

      const { data: categories, error: categoriesError } = await this.getExpenseCategories();
      
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

  // Create a new fee concession for a student
  async createStudentDiscount(discountData) {
    try {
      const { data, error } = await supabase
        .from(TABLES.STUDENT_DISCOUNTS)
        .insert(discountData)
        .select(`
          *,
          students(id, name, admission_no, roll_no),
          classes(class_name, section)
        `)
        .single();
      return { data, error };
    } catch (error) {
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
      const { data, error } = await supabase
        .from(TABLES.STUDENT_DISCOUNTS)
        .update(updates)
        .eq('id', discountId)
        .select(`
          *,
          students(id, name, admission_no, roll_no),
          classes(class_name, section)
        `)
        .single();
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Delete/Deactivate a fee concession
  async deleteStudentDiscount(discountId, hardDelete = false) {
    try {
      if (hardDelete) {
        const { error } = await supabase
          .from(TABLES.STUDENT_DISCOUNTS)
          .delete()
          .eq('id', discountId);
        return { error };
      } else {
        // Soft delete by setting is_active to false
        const { data, error } = await supabase
          .from(TABLES.STUDENT_DISCOUNTS)
          .update({ is_active: false })
          .eq('id', discountId)
          .select()
          .single();
        return { data, error };
      }
    } catch (error) {
      return { error };
    }
  },

  // Get students with their fee concession information for a class
  async getStudentsWithDiscounts(classId, academicYear = '2024-25') {
    try {
      const { data, error } = await supabase.rpc('get_students_with_discounts', {
        p_class_id: classId,
        p_academic_year: academicYear
      });
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Calculate fee with concession for a student
  async calculateStudentFee(studentId, classId, academicYear, feeComponent, baseAmount) {
    try {
      const { data, error } = await supabase.rpc('calculate_student_fee', {
        p_student_id: studentId,
        p_class_id: classId,
        p_academic_year: academicYear,
        p_fee_component: feeComponent,
        p_base_amount: baseAmount
      });
      return { data: data && data.length > 0 ? data[0] : null, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Apply fee concession to fee structure
  async applyDiscountToFeeStructure(studentId, classId, academicYear) {
    try {
      const { data, error } = await supabase.rpc('apply_discount_to_fee_structure', {
        p_student_id: studentId,
        p_class_id: classId,
        p_academic_year: academicYear
      });
      return { data, error };
    } catch (error) {
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
