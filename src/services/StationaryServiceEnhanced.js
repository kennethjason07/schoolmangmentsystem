/**
 * 🏢 ENHANCED STATIONARY SERVICE
 * Email-based tenant system implementation for Stationary Management
 * NO HARDCODED tenant_id - all tenant context derived from authenticated user's email
 */

import { supabase } from '../utils/supabase';
import { 
  createStationaryTenantQuery, 
  validateStationaryAdminAccess,
  loadStationaryTenantData,
  getStationaryAnalytics 
} from '../utils/stationaryTenantHelper';
import { getCurrentUserTenantByEmail } from '../utils/getTenantByEmail';
import { format } from 'date-fns';

class StationaryServiceEnhanced {
  /**
   * Initialize and validate admin access
   * @param {Object} user - Current authenticated user
   * @returns {Promise<Object>} Validation result with tenant info
   */
  static async initializeAdminAccess(user) {
    console.log('🔐 StationaryServiceEnhanced: Initializing admin access...');
    
    const validation = await validateStationaryAdminAccess(user);
    
    if (!validation.valid) {
      console.error('❌ StationaryServiceEnhanced: Admin access denied:', validation.error);
      throw new Error(`Access Denied: ${validation.error}`);
    }

    console.log('✅ StationaryServiceEnhanced: Admin access granted for tenant:', validation.tenant.name);
    return validation;
  }

  // ============ COMPREHENSIVE DATA LOADING ============

  /**
   * Load all stationary management data for current tenant
   * Single method that loads everything needed for the component
   * @param {Object} user - Current authenticated user
   * @returns {Promise<Object>} Complete stationary data
   */
  static async loadAllData(user) {
    try {
      console.log('📊 StationaryServiceEnhanced: Loading all stationary data...');

      // Step 1: Validate admin access
      const accessValidation = await this.initializeAdminAccess(user);

      // Step 2: Load comprehensive data using tenant helper
      const dataResult = await loadStationaryTenantData();

      if (!dataResult.success) {
        throw new Error(dataResult.error);
      }

      console.log('✅ StationaryServiceEnhanced: All data loaded successfully');

      return {
        success: true,
        tenant: dataResult.tenant,
        data: {
          items: dataResult.data.items,
          classes: dataResult.data.classes,
          schoolDetails: dataResult.data.schoolDetails,
          recentPurchases: dataResult.data.recentPurchases
        },
        permissions: accessValidation.permissions
      };

    } catch (error) {
      console.error('❌ StationaryServiceEnhanced: Failed to load data:', error);
      return {
        success: false,
        error: error.message,
        code: 'DATA_LOAD_FAILED'
      };
    }
  }

  // ============ STATIONARY ITEMS MANAGEMENT ============

  /**
   * Get all stationary items for current tenant (via email)
   * @param {boolean} activeOnly - Whether to fetch only active items
   * @returns {Promise<Array>} Array of stationary items
   */
  static async getStationaryItems(activeOnly = true) {
    try {
      console.log('🔍 StationaryServiceEnhanced: Getting stationary items, activeOnly:', activeOnly);
      
      const itemsQuery = createStationaryTenantQuery('stationary_items');
      console.log('🔧 Debug: itemsQuery created:', typeof itemsQuery);
      
      let query = await itemsQuery.createQuery();
      console.log('🔧 Debug: query from createQuery:', typeof query, query?.constructor?.name);
      console.log('🔧 Debug: query methods:', Object.getOwnPropertyNames(query || {}).slice(0, 5));
      
      if (activeOnly) {
        console.log('🔧 Debug: Adding is_active filter...');
        query = query.eq('is_active', true);
        console.log('🔧 Debug: After eq filter:', typeof query);
      }
      
      console.log('🔧 Debug: Adding order...');
      query = query.order('name', { ascending: true });
      console.log('🔧 Debug: After order:', typeof query);

      console.log('🔧 Debug: Executing query...');
      const { data, error } = await query;
      
      if (error) throw error;

      console.log('✅ StationaryServiceEnhanced: Retrieved', data?.length || 0, 'stationary items');
      return data || [];

    } catch (error) {
      console.error('❌ StationaryServiceEnhanced: Failed to get items:', error);
      throw error;
    }
  }

  /**
   * Add a new stationary item (tenant auto-assigned via email)
   * @param {Object} itemData - The item data
   * @returns {Promise<Object>} The created item
   */
  static async addStationaryItem(itemData) {
    try {
      console.log('📝 StationaryServiceEnhanced: Adding stationary item:', itemData.name);
      
      const itemsQuery = createStationaryTenantQuery('stationary_items');
      const result = await itemsQuery.insert({
        ...itemData,
        is_active: true
      });

      console.log('✅ StationaryServiceEnhanced: Item added successfully:', result.id);
      return result;

    } catch (error) {
      console.error('❌ StationaryServiceEnhanced: Failed to add item:', error);
      throw error;
    }
  }

  /**
   * Update a stationary item with tenant validation
   * @param {string} itemId - The item ID
   * @param {Object} updates - The updates to apply
   * @returns {Promise<Object>} The updated item
   */
  static async updateStationaryItem(itemId, updates) {
    try {
      console.log('📝 StationaryServiceEnhanced: Updating item:', itemId);
      
      const itemsQuery = createStationaryTenantQuery('stationary_items');
      const result = await itemsQuery.update(itemId, updates);

      console.log('✅ StationaryServiceEnhanced: Item updated successfully');
      return result;

    } catch (error) {
      console.error('❌ StationaryServiceEnhanced: Failed to update item:', error);
      throw error;
    }
  }

  /**
   * Delete/deactivate a stationary item with tenant validation
   * @param {string} itemId - The item ID
   * @returns {Promise<boolean>} Success status
   */
  static async deleteStationaryItem(itemId) {
    try {
      console.log('🗑️ StationaryServiceEnhanced: Deleting item:', itemId);
      
      const itemsQuery = createStationaryTenantQuery('stationary_items');
      const result = await itemsQuery.delete(itemId, true); // Soft delete

      console.log('✅ StationaryServiceEnhanced: Item deleted successfully');
      return result;

    } catch (error) {
      console.error('❌ StationaryServiceEnhanced: Failed to delete item:', error);
      throw error;
    }
  }

  // ============ CLASS AND STUDENT MANAGEMENT ============

  /**
   * Get all classes for current tenant (via email)
   * @returns {Promise<Array>} Array of classes
   */
  static async getClasses() {
    try {
      console.log('🏫 StationaryServiceEnhanced: Getting classes');
      
      const classesQuery = createStationaryTenantQuery('classes');
      const query = await classesQuery.createQuery('id, class_name, section');
      const { data, error } = await query.order('class_name', { ascending: true });
      
      if (error) throw error;

      console.log('✅ StationaryServiceEnhanced: Retrieved', data?.length || 0, 'classes');
      return data || [];

    } catch (error) {
      console.error('❌ StationaryServiceEnhanced: Failed to get classes:', error);
      throw error;
    }
  }

  /**
   * Get students by class with tenant validation
   * @param {string} classId - The class ID
   * @returns {Promise<Array>} Array of students in the class
   */
  static async getStudentsByClass(classId) {
    try {
      console.log('👥 StationaryServiceEnhanced: Getting students for class:', classId);
      
      const studentsQuery = createStationaryTenantQuery('students');
      const query = await studentsQuery.createQuery('id, name, admission_no, class_id');
      const { data, error } = await query
        .eq('class_id', classId)
        .order('name', { ascending: true });
      
      if (error) throw error;

      console.log('✅ StationaryServiceEnhanced: Retrieved', data?.length || 0, 'students');
      return data || [];

    } catch (error) {
      console.error('❌ StationaryServiceEnhanced: Failed to get students:', error);
      throw error;
    }
  }

  // ============ PURCHASES MANAGEMENT ============

  /**
   * Record a stationary purchase with automatic tenant assignment
   * @param {Object} purchaseData - The purchase data
   * @returns {Promise<Object>} The created purchase record
   */
  static async recordPurchase(purchaseData) {
    try {
      console.log('💰 StationaryServiceEnhanced: Recording purchase for student:', purchaseData.student_id);
      
      const purchasesQuery = createStationaryTenantQuery('stationary_purchases');
      
      // Add additional fields
      const enhancedPurchaseData = {
        ...purchaseData,
        payment_date: purchaseData.payment_date || format(new Date(), 'yyyy-MM-dd'),
        academic_year: purchaseData.academic_year || new Date().getFullYear().toString()
      };

      const result = await purchasesQuery.insert(enhancedPurchaseData);

      // Get the complete record with joins
      const { data: completeRecord, error } = await supabase
        .from('stationary_purchases')
        .select(`
          *,
          students(name, admission_no, class_id),
          stationary_items(name, fee_amount),
          classes(class_name, section)
        `)
        .eq('id', result.id)
        .single();

      if (error) throw error;

      console.log('✅ StationaryServiceEnhanced: Purchase recorded successfully:', result.id);
      return completeRecord;

    } catch (error) {
      console.error('❌ StationaryServiceEnhanced: Failed to record purchase:', error);
      throw error;
    }
  }

  /**
   * Get purchases with optional filtering (tenant auto-applied via email)
   * @param {Object} filters - Optional filters (startDate, endDate, studentId, itemId)
   * @returns {Promise<Array>} Array of purchases
   */
  static async getPurchases(filters = {}) {
    try {
      console.log('📄 StationaryServiceEnhanced: Getting purchases with filters:', filters);
      
      const purchasesQuery = createStationaryTenantQuery('stationary_purchases');
      let query = await purchasesQuery.createQuery(`
        *,
        students(name, admission_no, class_id),
        stationary_items(name, fee_amount),
        classes(class_name, section)
      `);

      // Apply filters
      if (filters.startDate) {
        query = query.gte('payment_date', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('payment_date', filters.endDate);
      }
      if (filters.studentId) {
        query = query.eq('student_id', filters.studentId);
      }
      if (filters.itemId) {
        query = query.eq('item_id', filters.itemId);
      }
      if (filters.classId) {
        query = query.eq('class_id', filters.classId);
      }

      query = query.order('payment_date', { ascending: false });

      const { data, error } = await query;
      
      if (error) throw error;

      console.log('✅ StationaryServiceEnhanced: Retrieved', data?.length || 0, 'purchases');
      return data || [];

    } catch (error) {
      console.error('❌ StationaryServiceEnhanced: Failed to get purchases:', error);
      throw error;
    }
  }

  /**
   * Get purchase by receipt number with tenant validation
   * @param {string} receiptNumber - The receipt number
   * @returns {Promise<Object>} The purchase record
   */
  static async getPurchaseByReceipt(receiptNumber) {
    try {
      console.log('🧾 StationaryServiceEnhanced: Getting purchase by receipt:', receiptNumber);
      
      const purchasesQuery = createStationaryTenantQuery('stationary_purchases');
      const query = await purchasesQuery.createQuery(`
        *,
        students(name, admission_no, class_id),
        stationary_items(name, description, fee_amount),
        classes(class_name, section)
      `);

      const { data, error } = await query
        .eq('receipt_number', receiptNumber)
        .single();
      
      if (error) throw error;

      console.log('✅ StationaryServiceEnhanced: Found purchase by receipt');
      return data;

    } catch (error) {
      console.error('❌ StationaryServiceEnhanced: Failed to get purchase by receipt:', error);
      throw error;
    }
  }

  // ============ ANALYTICS & REPORTS ============

  /**
   * Get sales analytics for date range (tenant auto-applied via email)
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)  
   * @returns {Promise<Object>} Sales analytics data
   */
  static async getSalesAnalytics(startDate, endDate) {
    try {
      console.log('📊 StationaryServiceEnhanced: Getting analytics for:', startDate, 'to', endDate);
      
      const analytics = await getStationaryAnalytics(startDate, endDate);

      console.log('✅ StationaryServiceEnhanced: Analytics calculated:', {
        revenue: analytics.totalRevenue,
        transactions: analytics.totalTransactions
      });

      return analytics;

    } catch (error) {
      console.error('❌ StationaryServiceEnhanced: Failed to get analytics:', error);
      throw error;
    }
  }

  /**
   * Get class-wise purchase reports with tenant validation
   * @param {string} classId - Optional class ID filter
   * @param {string} startDate - Start date filter
   * @param {string} endDate - End date filter
   * @returns {Promise<Object>} Class-wise purchase report data
   */
  static async getClassWiseReport(classId = null, startDate = null, endDate = null) {
    try {
      console.log('📈 StationaryServiceEnhanced: Getting class-wise report');
      
      const filters = {};
      if (classId) filters.classId = classId;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      const purchases = await this.getPurchases(filters);

      // Group by class
      const classReport = {};
      purchases.forEach(purchase => {
        const classInfo = purchase.classes || { class_name: 'Unknown', section: '' };
        const classKey = `${classInfo.class_name}-${classInfo.section}`;

        if (!classReport[classKey]) {
          classReport[classKey] = {
            classInfo,
            students: {},
            totalAmount: 0,
            totalTransactions: 0
          };
        }

        const studentKey = purchase.student_id;
        if (!classReport[classKey].students[studentKey]) {
          classReport[classKey].students[studentKey] = {
            studentInfo: purchase.students,
            purchases: [],
            totalAmount: 0
          };
        }

        classReport[classKey].students[studentKey].purchases.push(purchase);
        classReport[classKey].students[studentKey].totalAmount += Number(purchase.total_amount);
        classReport[classKey].totalAmount += Number(purchase.total_amount);
        classReport[classKey].totalTransactions += 1;
      });

      console.log('✅ StationaryServiceEnhanced: Class-wise report generated');
      return classReport;

    } catch (error) {
      console.error('❌ StationaryServiceEnhanced: Failed to generate class report:', error);
      throw error;
    }
  }

  // ============ RECEIPT MANAGEMENT ============

  /**
   * Generate unique receipt number for tenant
   * @returns {Promise<string>} Generated receipt number
   */
  static async generateReceiptNumber() {
    try {
      const purchasesQuery = createStationaryTenantQuery('stationary_purchases');
      
      // Get tenant ID first
      await purchasesQuery.initialize();
      const tenantId = purchasesQuery.getTenantId();

      // Get latest receipt for this tenant
      const { data: latestPurchase, error } = await supabase
        .from('stationary_purchases')
        .select('receipt_number')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw error;
      }
      
      let nextNumber = 1000; // Start from 1000
      
      if (latestPurchase && latestPurchase.receipt_number) {
        const currentNumber = parseInt(latestPurchase.receipt_number.replace(/\D/g, ''));
        nextNumber = currentNumber + 1;
      }
      
      console.log('🧾 Generated receipt number:', nextNumber);
      return nextNumber.toString();

    } catch (error) {
      console.error('❌ StationaryServiceEnhanced: Failed to generate receipt number:', error);
      // Fallback to timestamp-based receipt number
      return Date.now().toString();
    }
  }

  // ============ UTILITY FUNCTIONS ============

  /**
   * Get school details for current tenant
   * @returns {Promise<Object|null>} School details
   */
  static async getSchoolDetails() {
    try {
      console.log('🏫 StationaryServiceEnhanced: Getting school details');
      
      const schoolQuery = createStationaryTenantQuery('school_details');
      const query = await schoolQuery.createQuery();
      const { data, error } = await query.single();
      
      if (error && error.code !== 'PGRST116') { // Ignore "no rows found"
        throw error;
      }

      console.log('✅ StationaryServiceEnhanced: School details retrieved');
      return data || null;

    } catch (error) {
      console.error('❌ StationaryServiceEnhanced: Failed to get school details:', error);
      return null; // Non-critical, return null
    }
  }

  /**
   * Validate tenant consistency across related records
   * Ensures all related records (student, class, item) belong to same tenant
   * @param {Object} purchaseData - Purchase data to validate
   * @returns {Promise<boolean>} True if consistent
   */
  static async validateTenantConsistency(purchaseData) {
    try {
      console.log('🔍 StationaryServiceEnhanced: Validating tenant consistency');
      
      // Get current tenant
      const tenantResult = await getCurrentUserTenantByEmail();
      if (!tenantResult.success) {
        throw new Error('Cannot determine current tenant');
      }
      const currentTenantId = tenantResult.data.tenant.id;

      // Validate student belongs to current tenant
      if (purchaseData.student_id) {
        const { data: student, error } = await supabase
          .from('students')
          .select('tenant_id')
          .eq('id', purchaseData.student_id)
          .single();
        
        if (error || student.tenant_id !== currentTenantId) {
          console.error('❌ Student does not belong to current tenant');
          return false;
        }
      }

      // Validate class belongs to current tenant
      if (purchaseData.class_id) {
        const { data: classRecord, error } = await supabase
          .from('classes')
          .select('tenant_id')
          .eq('id', purchaseData.class_id)
          .single();
        
        if (error || classRecord.tenant_id !== currentTenantId) {
          console.error('❌ Class does not belong to current tenant');
          return false;
        }
      }

      // Validate item belongs to current tenant
      if (purchaseData.item_id) {
        const { data: item, error } = await supabase
          .from('stationary_items')
          .select('tenant_id')
          .eq('id', purchaseData.item_id)
          .single();
        
        if (error || item.tenant_id !== currentTenantId) {
          console.error('❌ Stationary item does not belong to current tenant');
          return false;
        }
      }

      console.log('✅ StationaryServiceEnhanced: Tenant consistency validated');
      return true;

    } catch (error) {
      console.error('❌ StationaryServiceEnhanced: Tenant consistency validation failed:', error);
      return false;
    }
  }

  /**
   * Get available categories
   * @returns {Array} Array of available categories
   */
  static getAvailableCategories() {
    return ['Notebooks', 'Stationery', 'Uniforms', 'Books', 'Sports', 'Other'];
  }

  /**
   * Get available payment modes
   * @returns {Array} Array of available payment modes
   */
  static getAvailablePaymentModes() {
    return ['Cash', 'Card', 'Online', 'UPI'];
  }

  /**
   * Format currency for display
   * @param {number} amount - The amount to format
   * @returns {string} Formatted currency string
   */
  static formatCurrency(amount) {
    return `₹${Number(amount || 0).toFixed(2)}`;
  }

  /**
   * Get current tenant information
   * @returns {Promise<Object>} Current tenant information
   */
  static async getCurrentTenant() {
    try {
      const tenantResult = await getCurrentUserTenantByEmail();
      if (!tenantResult.success) {
        throw new Error(tenantResult.error);
      }
      return tenantResult.data.tenant;
    } catch (error) {
      console.error('❌ StationaryServiceEnhanced: Failed to get current tenant:', error);
      throw error;
    }
  }
}

export default StationaryServiceEnhanced;
