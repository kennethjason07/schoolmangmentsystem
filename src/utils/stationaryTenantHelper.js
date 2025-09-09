/**
 * 🏢 STATIONARY TENANT HELPER
 * Email-based tenant system implementation for Stationary Management
 * Following EMAIL_BASED_TENANT_SYSTEM.md guidelines
 */

import { supabase } from './supabase';
import { getCurrentUserTenantByEmail } from './getTenantByEmail';
import { validateTenantAccess } from './tenantValidation';

/**
 * Enhanced tenant-aware query builder for stationary management
 * Automatically applies tenant filtering based on current authenticated user's email
 */
export class StationaryTenantQuery {
  constructor(tableName) {
    this.tableName = tableName;
    this.tenantId = null;
    this.isInitialized = false;
  }

  /**
   * Initialize tenant context from current authenticated user
   * @returns {Promise<boolean>} True if initialization successful
   */
  async initialize() {
    try {
      console.log('🔍 StationaryTenantQuery: Initializing tenant context for table:', this.tableName);
      
      // Get tenant information via email-based lookup
      const tenantResult = await getCurrentUserTenantByEmail();
      
      if (!tenantResult.success) {
        console.error('❌ StationaryTenantQuery: Failed to get tenant from email:', tenantResult.error);
        throw new Error(`Tenant initialization failed: ${tenantResult.error}`);
      }

      this.tenantId = tenantResult.data.tenant.id;
      this.isInitialized = true;

      console.log('✅ StationaryTenantQuery: Tenant context initialized:', {
        tenantId: this.tenantId,
        tenantName: tenantResult.data.tenant.name,
        tableName: this.tableName
      });

      return true;
    } catch (error) {
      console.error('❌ StationaryTenantQuery: Initialization failed:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * Create a tenant-aware query for the specified table
   * @param {string} selectColumns - Columns to select (default: '*')
   * @returns {Promise<Object>} Supabase query with tenant filtering
   */
  async createQuery(selectColumns = '*') {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.tenantId) {
      throw new Error('Tenant context not available - user may not be assigned to a tenant');
    }

    console.log('🔍 StationaryTenantQuery: Creating query for table:', this.tableName, 'tenant:', this.tenantId);

    // Return the base query builder with select applied, but without tenant filter
    // The tenant filter will be applied by the calling method to avoid premature execution
    const baseQuery = supabase.from(this.tableName).select(selectColumns);
    
    console.log('🔧 StationaryTenantQuery: Base query created, adding tenant filter manually');
    
    // Apply tenant filter and return the query builder (not executed)
    const tenantQuery = baseQuery.eq('tenant_id', this.tenantId);
    
    console.log('🔧 StationaryTenantQuery: Query methods after tenant filter:', Object.getOwnPropertyNames(tenantQuery || {}).slice(0, 10));
    
    return tenantQuery;
  }

  /**
   * Insert data with automatic tenant_id assignment
   * @param {Object} data - Data to insert
   * @returns {Promise<Object>} Insert result
   */
  async insert(data) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const dataWithTenant = {
      ...data,
      tenant_id: this.tenantId,
      created_at: new Date().toISOString()
    };

    console.log('📝 StationaryTenantQuery: Inserting data with tenant:', this.tenantId);

    const { data: result, error } = await supabase
      .from(this.tableName)
      .insert(dataWithTenant)
      .select()
      .single();

    if (error) {
      console.error('❌ StationaryTenantQuery: Insert failed:', error);
      throw error;
    }

    return result;
  }

  /**
   * Update data with tenant validation
   * @param {string} id - Record ID to update
   * @param {Object} updates - Data to update
   * @returns {Promise<Object>} Update result
   */
  async update(id, updates) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const updatesWithTimestamp = {
      ...updates,
      updated_at: new Date().toISOString()
    };

    console.log('📝 StationaryTenantQuery: Updating record:', id, 'in tenant:', this.tenantId);

    const { data: result, error } = await supabase
      .from(this.tableName)
      .update(updatesWithTimestamp)
      .eq('id', id)
      .eq('tenant_id', this.tenantId) // Ensure tenant isolation
      .select()
      .single();

    if (error) {
      console.error('❌ StationaryTenantQuery: Update failed:', error);
      throw error;
    }

    return result;
  }

  /**
   * Delete/deactivate data with tenant validation
   * @param {string} id - Record ID to delete
   * @param {boolean} softDelete - Whether to soft delete (set is_active = false)
   * @returns {Promise<boolean>} Success status
   */
  async delete(id, softDelete = true) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    console.log('🗑️ StationaryTenantQuery: Deleting record:', id, 'in tenant:', this.tenantId, 'soft:', softDelete);

    if (softDelete && this.tableName === 'stationary_items') {
      // Soft delete for stationary items
      const { error } = await supabase
        .from(this.tableName)
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('tenant_id', this.tenantId);

      if (error) {
        console.error('❌ StationaryTenantQuery: Soft delete failed:', error);
        throw error;
      }
    } else {
      // Hard delete
      const { error } = await supabase
        .from(this.tableName)
        .delete()
        .eq('id', id)
        .eq('tenant_id', this.tenantId);

      if (error) {
        console.error('❌ StationaryTenantQuery: Hard delete failed:', error);
        throw error;
      }
    }

    return true;
  }

  /**
   * Get tenant information
   * @returns {string|null} Current tenant ID
   */
  getTenantId() {
    return this.tenantId;
  }
}

/**
 * Create a tenant-aware query helper for stationary management
 * @param {string} tableName - Database table name
 * @returns {StationaryTenantQuery} Configured query helper
 */
export const createStationaryTenantQuery = (tableName) => {
  return new StationaryTenantQuery(tableName);
};

/**
 * Validate admin access to stationary management
 * Ensures user is authenticated, has admin role, and belongs to an active tenant
 * @param {Object} user - Current authenticated user
 * @returns {Promise<Object>} Validation result
 */
export const validateStationaryAdminAccess = async (user) => {
  try {
    console.log('🔐 StationaryTenantHelper: Validating admin access for:', user?.email);

    // Step 1: Ensure user is authenticated
    if (!user || !user.email) {
      return {
        valid: false,
        error: 'User not authenticated',
        code: 'NO_AUTH'
      };
    }

    // Step 2: Get tenant information via email
    const tenantResult = await getCurrentUserTenantByEmail();
    
    if (!tenantResult.success) {
      return {
        valid: false,
        error: tenantResult.error,
        code: 'NO_TENANT',
        recommendation: 'User may not be assigned to a tenant. Contact administrator.'
      };
    }

    const { tenant, userRecord } = tenantResult.data;

    // Step 3: Validate tenant is active
    if (tenant.status !== 'active') {
      return {
        valid: false,
        error: `Tenant "${tenant.name}" is ${tenant.status}`,
        code: 'INACTIVE_TENANT',
        recommendation: 'Contact administrator to activate tenant.'
      };
    }

    // Step 4: Validate user role (should be admin for stationary management)
    if (userRecord.role_id !== 1) { // Assuming role_id 1 = Admin
      return {
        valid: false,
        error: 'Admin access required for stationary management',
        code: 'INSUFFICIENT_PERMISSIONS',
        recommendation: 'Only admin users can access stationary management.'
      };
    }

    // Step 5: Additional security validation
    const accessValidation = await validateTenantAccess(userRecord.id, tenant.id, 'StationaryManagement');
    
    if (!accessValidation.isValid) {
      return {
        valid: false,
        error: accessValidation.error,
        code: 'ACCESS_DENIED'
      };
    }

    console.log('✅ StationaryTenantHelper: Admin access validated for tenant:', tenant.name);

    return {
      valid: true,
      tenant,
      userRecord,
      permissions: ['read', 'write', 'delete'] // Admin has full permissions
    };

  } catch (error) {
    console.error('❌ StationaryTenantHelper: Access validation failed:', error);
    return {
      valid: false,
      error: error.message,
      code: 'VALIDATION_ERROR',
      recommendation: 'Contact support if this error persists.'
    };
  }
};

/**
 * Get comprehensive stationary data for current tenant
 * Loads all required data for stationary management in a single call
 * @returns {Promise<Object>} Complete stationary data
 */
export const loadStationaryTenantData = async () => {
  try {
    console.log('📊 StationaryTenantHelper: Loading comprehensive tenant data...');

    // Initialize tenant context
    const tenantResult = await getCurrentUserTenantByEmail();
    
    if (!tenantResult.success) {
      throw new Error(`Failed to get tenant: ${tenantResult.error}`);
    }

    const tenantId = tenantResult.data.tenant.id;
    console.log('🏢 Loading data for tenant:', tenantResult.data.tenant.name);

    // Load all stationary data in parallel
    const [
      itemsData,
      classesData,
      schoolDetailsData,
      recentPurchasesData
    ] = await Promise.all([
      // Stationary items
      supabase
        .from('stationary_items')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('name'),
      
      // Classes
      supabase
        .from('classes')
        .select('id, class_name, section')
        .eq('tenant_id', tenantId)
        .order('class_name'),
      
      // School details
      supabase
        .from('school_details')
        .select('*')
        .eq('tenant_id', tenantId)
        .single(),
      
      // Recent purchases (last 30 days)
      supabase
        .from('stationary_purchases')
        .select(`
          *,
          students(name, admission_no),
          stationary_items(name, fee_amount)
        `)
        .eq('tenant_id', tenantId)
        .gte('payment_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('payment_date', { ascending: false })
    ]);

    // Handle errors
    if (itemsData.error) throw itemsData.error;
    if (classesData.error) throw classesData.error;
    if (schoolDetailsData.error && schoolDetailsData.error.code !== 'PGRST116') {
      throw schoolDetailsData.error; // Ignore "no rows found" error
    }
    if (recentPurchasesData.error) throw recentPurchasesData.error;

    console.log('✅ StationaryTenantHelper: Data loaded successfully:', {
      items: itemsData.data?.length || 0,
      classes: classesData.data?.length || 0,
      recentPurchases: recentPurchasesData.data?.length || 0,
      schoolDetails: !!schoolDetailsData.data
    });

    return {
      success: true,
      tenant: tenantResult.data.tenant,
      data: {
        items: itemsData.data || [],
        classes: classesData.data || [],
        schoolDetails: schoolDetailsData.data || null,
        recentPurchases: recentPurchasesData.data || []
      }
    };

  } catch (error) {
    console.error('❌ StationaryTenantHelper: Failed to load tenant data:', error);
    return {
      success: false,
      error: error.message,
      recommendation: 'Check tenant assignment and database access permissions.'
    };
  }
};

/**
 * Create analytics query for current tenant
 * @param {string} startDate - Start date for analytics
 * @param {string} endDate - End date for analytics
 * @returns {Promise<Object>} Analytics data
 */
export const getStationaryAnalytics = async (startDate, endDate) => {
  try {
    const tenantQuery = createStationaryTenantQuery('stationary_purchases');
    await tenantQuery.initialize();

    const tenantId = tenantQuery.getTenantId();
    
    // Get sales data with joins
    const { data: salesData, error } = await supabase
      .from('stationary_purchases')
      .select(`
        total_amount,
        quantity,
        payment_date,
        stationary_items(name)
      `)
      .eq('tenant_id', tenantId)
      .gte('payment_date', startDate)
      .lte('payment_date', endDate);

    if (error) throw error;

    // Calculate analytics
    const totalRevenue = salesData.reduce((sum, purchase) => sum + Number(purchase.total_amount), 0);
    const totalQuantity = salesData.reduce((sum, purchase) => sum + Number(purchase.quantity), 0);
    const totalTransactions = salesData.length;

    // Item-wise breakdown
    const itemBreakdown = {};
    salesData.forEach(purchase => {
      const itemName = purchase.stationary_items?.name || 'Unknown';
      if (!itemBreakdown[itemName]) {
        itemBreakdown[itemName] = {
          revenue: 0,
          quantity: 0,
          transactions: 0
        };
      }
      itemBreakdown[itemName].revenue += Number(purchase.total_amount);
      itemBreakdown[itemName].quantity += Number(purchase.quantity);
      itemBreakdown[itemName].transactions += 1;
    });

    return {
      totalRevenue,
      totalQuantity,
      totalTransactions,
      itemBreakdown,
      dateRange: { startDate, endDate }
    };

  } catch (error) {
    console.error('❌ StationaryTenantHelper: Analytics query failed:', error);
    throw error;
  }
};
