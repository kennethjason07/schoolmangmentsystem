import { supabase } from '../utils/supabase';

// Table names
const TABLES = {
  STATIONARY_ITEMS: 'stationary_items',
  STATIONARY_PURCHASES: 'stationary_purchases',
  STUDENTS: 'students',
  CLASSES: 'classes',
};

class StationaryService {
  // ============ STATIONARY ITEMS MANAGEMENT ============

  /**
   * Get all stationary items for a tenant
   * @param {string} tenantId - The tenant ID
   * @param {boolean} activeOnly - Whether to fetch only active items
   * @returns {Promise<Array>} Array of stationary items
   */
  static async getStationaryItems(tenantId, activeOnly = false) {
    try {
      console.log('🔍 StationaryService.getStationaryItems called with:', { tenantId, activeOnly });
      
      let query = supabase
        .from(TABLES.STATIONARY_ITEMS)
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name', { ascending: true });

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      
      console.log('📊 StationaryService query result:', {
        itemsFound: data?.length || 0,
        tenantIdUsed: tenantId,
        firstItem: data?.[0],
        error: error?.message
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching stationary items:', error);
      throw error;
    }
  }


  /**
   * Add a new stationary item
   * @param {Object} itemData - The item data
   * @param {string} tenantId - The tenant ID
   * @returns {Promise<Object>} The created item
   */
  static async addStationaryItem(itemData, tenantId) {
    try {
      const { data, error } = await supabase
        .from(TABLES.STATIONARY_ITEMS)
        .insert([{
          ...itemData,
          tenant_id: tenantId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding stationary item:', error);
      throw error;
    }
  }

  /**
   * Update a stationary item
   * @param {string} itemId - The item ID
   * @param {Object} updates - The updates to apply
   * @param {string} tenantId - The tenant ID
   * @returns {Promise<Object>} The updated item
   */
  static async updateStationaryItem(itemId, updates, tenantId) {
    try {
      const { data, error } = await supabase
        .from(TABLES.STATIONARY_ITEMS)
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', itemId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating stationary item:', error);
      throw error;
    }
  }

  /**
   * Delete a stationary item (soft delete by setting is_active to false)
   * @param {string} itemId - The item ID
   * @param {string} tenantId - The tenant ID
   * @returns {Promise<boolean>} Success status
   */
  static async deleteStationaryItem(itemId, tenantId) {
    try {
      const { error } = await supabase
        .from(TABLES.STATIONARY_ITEMS)
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', itemId)
        .eq('tenant_id', tenantId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting stationary item:', error);
      throw error;
    }
  }

  // ============ CLASS AND STUDENT MANAGEMENT ============

  /**
   * Get all classes for a tenant
   * @param {string} tenantId - The tenant ID
   * @returns {Promise<Array>} Array of classes
   */
  static async getClasses(tenantId) {
    try {
      const { data, error } = await supabase
        .from(TABLES.CLASSES)
        .select('id, class_name, section')
        .eq('tenant_id', tenantId)
        .order('class_name', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching classes:', error);
      throw error;
    }
  }

  /**
   * Get students by class
   * @param {string} classId - The class ID
   * @param {string} tenantId - The tenant ID
   * @returns {Promise<Array>} Array of students in the class
   */
  static async getStudentsByClass(classId, tenantId) {
    try {
      const { data, error } = await supabase
        .from(TABLES.STUDENTS)
        .select('id, name, admission_no, class_id')
        .eq('class_id', classId)
        .eq('tenant_id', tenantId)
        .order('name', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching students by class:', error);
      throw error;
    }
  }

  // ============ PURCHASES MANAGEMENT ============

  /**
   * Record a stationary purchase
   * @param {Object} purchaseData - The purchase data
   * @param {string} tenantId - The tenant ID
   * @returns {Promise<Object>} The created purchase record
   */
  static async recordPurchase(purchaseData, tenantId) {
    try {
      const { data, error } = await supabase
        .from(TABLES.STATIONARY_PURCHASES)
        .insert([{
          ...purchaseData,
          tenant_id: tenantId,
          created_at: new Date().toISOString()
        }])
        .select(`
          *,
          students(name, admission_no, class_id),
          stationary_items(name, fee_amount)
        `)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error recording purchase:', error);
      throw error;
    }
  }

  /**
   * Get all purchases for a tenant with optional date filtering
   * @param {string} tenantId - The tenant ID
   * @param {Object} filters - Optional filters (startDate, endDate, studentId, itemId)
   * @returns {Promise<Array>} Array of purchases
   */
  static async getPurchases(tenantId, filters = {}) {
    try {
      console.log('🔍 StationaryService.getPurchases called with:', { tenantId, filters });
      
      let query = supabase
        .from(TABLES.STATIONARY_PURCHASES)
        .select(`
          *,
          students(name, admission_no, class_id),
          stationary_items(name, fee_amount)
        `)
        .eq('tenant_id', tenantId)
        .order('payment_date', { ascending: false });

      // Apply date filters if provided
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

      const { data, error } = await query;
      
      console.log('📄 StationaryService purchases result:', {
        purchasesFound: data?.length || 0,
        tenantIdUsed: tenantId,
        firstPurchase: data?.[0],
        error: error?.message
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching purchases:', error);
      throw error;
    }
  }

  /**
   * Get purchase by receipt number
   * @param {number} receiptNumber - The receipt number
   * @param {string} tenantId - The tenant ID
   * @returns {Promise<Object>} The purchase record
   */
  static async getPurchaseByReceipt(receiptNumber, tenantId) {
    try {
      const { data, error } = await supabase
        .from(TABLES.STATIONARY_PURCHASES)
        .select(`
          *,
          students(name, admission_no, class_id),
          stationary_items(name, description)
        `)
        .eq('receipt_number', receiptNumber)
        .eq('tenant_id', tenantId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching purchase by receipt:', error);
      throw error;
    }
  }

  // ============ ANALYTICS & REPORTS ============

  /**
   * Get sales analytics for a date range
   * @param {string} tenantId - The tenant ID
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Object>} Sales analytics data
   */
  static async getSalesAnalytics(tenantId, startDate, endDate) {
    try {
      // Get total sales and transaction count
      const { data: salesData, error: salesError } = await supabase
        .from(TABLES.STATIONARY_PURCHASES)
        .select('total_amount, quantity')
        .eq('tenant_id', tenantId)
        .gte('payment_date', startDate)
        .lte('payment_date', endDate);

      if (salesError) throw salesError;

      // Get category-wise sales
      const { data: categoryData, error: categoryError } = await supabase
        .from(TABLES.STATIONARY_PURCHASES)
        .select(`
          total_amount,
          quantity,
          stationary_items(name)
        `)
        .eq('tenant_id', tenantId)
        .gte('payment_date', startDate)
        .lte('payment_date', endDate);

      if (categoryError) throw categoryError;

      // Calculate totals
      const totalRevenue = salesData.reduce((sum, purchase) => sum + Number(purchase.total_amount), 0);
      const totalQuantitySold = salesData.reduce((sum, purchase) => sum + Number(purchase.quantity), 0);
      const totalTransactions = salesData.length;

      // Calculate category-wise breakdown (using item names since category doesn't exist)
      const categoryBreakdown = {};
      categoryData.forEach(purchase => {
        const itemName = purchase.stationary_items?.name || 'Other';
        if (!categoryBreakdown[itemName]) {
          categoryBreakdown[itemName] = {
            revenue: 0,
            quantity: 0,
            transactions: 0
          };
        }
        categoryBreakdown[itemName].revenue += Number(purchase.total_amount);
        categoryBreakdown[itemName].quantity += Number(purchase.quantity);
        categoryBreakdown[itemName].transactions += 1;
      });

      return {
        totalRevenue,
        totalQuantitySold,
        totalTransactions,
        categoryBreakdown
      };
    } catch (error) {
      console.error('Error fetching sales analytics:', error);
      throw error;
    }
  }

  /**
   * Get class-wise purchase reports
   * @param {string} tenantId - The tenant ID
   * @param {string} classId - Optional class ID filter
   * @param {string} startDate - Start date filter
   * @param {string} endDate - End date filter
   * @returns {Promise<Object>} Class-wise purchase report data
   */
  static async getClassWiseReport(tenantId, classId = null, startDate = null, endDate = null) {
    try {
      let query = supabase
        .from(TABLES.STATIONARY_PURCHASES)
        .select(`
          *,
          students(id, name, admission_no, class_id),
          stationary_items(id, name, fee_amount),
          classes!students_class_id_fkey(id, class_name, section)
        `)
        .eq('tenant_id', tenantId)
        .order('payment_date', { ascending: false });

      if (classId) {
        query = query.eq('class_id', classId);
      }

      if (startDate) {
        query = query.gte('payment_date', startDate);
      }

      if (endDate) {
        query = query.lte('payment_date', endDate);
      }

      const { data: purchases, error } = await query;

      if (error) throw error;

      // Group by class
      const classReport = {};
      purchases.forEach(purchase => {
        const classInfo = purchase.classes || { id: 'unknown', class_name: 'Unknown', section: '' };
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

      return classReport;
    } catch (error) {
      console.error('Error fetching class-wise report:', error);
      throw error;
    }
  }

  // ============ UTILITY FUNCTIONS ============

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
   * Generate unique receipt number (if auto-generation fails)
   * @returns {string} Generated receipt number
   */
  static generateReceiptNumber() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `ST${timestamp}${random}`;
  }
}

export default StationaryService;
