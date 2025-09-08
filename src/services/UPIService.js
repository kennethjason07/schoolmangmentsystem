// UPI Payment Service
// Handles UPI QR code generation and transaction management
import { supabase } from '../utils/supabase';

export class UPIService {
  // Fallback UPI ID for development/testing (will be removed in production)
  static FALLBACK_UPI_ID = 'hanokalure0@okhdfcbank';
  static MERCHANT_NAME = 'School Management System';
  
  // Cache for UPI settings to avoid repeated database queries
  static upiCache = new Map();
  static cacheExpiry = 5 * 60 * 1000; // 5 minutes

  /**
   * Get tenant-specific UPI settings from database
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Object>} UPI settings object
   */
  static async getTenantUPISettings(tenantId) {
    try {
      console.log('🔍 UPI DEBUG: Fetching UPI settings for tenant:', tenantId);
      
      // Check cache first
      const cacheKey = `upi_settings_${tenantId}`;
      const cachedData = this.upiCache.get(cacheKey);
      
      if (cachedData && (Date.now() - cachedData.timestamp) < this.cacheExpiry) {
        console.log('📦 UPI DEBUG: Using cached UPI settings:', cachedData.data);
        return cachedData.data;
      }
      
      console.log('🔄 UPI DEBUG: No cache found, querying database...');
      
      // Fetch from database
      const { data, error } = await supabase
        .from('school_upi_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      console.log('📊 UPI DEBUG: Database query result:', { data, error, tenantId });
      
      if (error) {
        console.error('❌ UPI DEBUG: Error fetching UPI settings:', error);
        console.error('❌ UPI DEBUG: Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        
        // If no UPI settings found, return null (will trigger fallback)
        if (error.code === 'PGRST116') {
          console.warn('⚠️ UPI DEBUG: No UPI settings configured for tenant:', tenantId);
          return null;
        }
        
        throw new Error(`Failed to fetch UPI settings: ${error.message}`);
      }
      
      console.log('✅ UPI DEBUG: UPI settings fetched from database:', data);
      
      // Cache the result
      this.upiCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });
      
      return data;
      
    } catch (error) {
      console.error('Exception in getTenantUPISettings:', error);
      throw error;
    }
  }
  
  /**
   * Get primary UPI ID for tenant (with fallback)
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<string>} UPI ID
   */
  static async getPrimaryUPIId(tenantId) {
    try {
      if (!tenantId) {
        console.warn('No tenant ID provided, using fallback UPI ID');
        return this.FALLBACK_UPI_ID;
      }
      
      const upiSettings = await this.getTenantUPISettings(tenantId);
      
      if (upiSettings && upiSettings.upi_id) {
        console.log('Using tenant-specific UPI ID:', upiSettings.upi_id);
        return upiSettings.upi_id;
      }
      
      console.warn(`No UPI settings found for tenant ${tenantId}, using fallback UPI ID`);
      return this.FALLBACK_UPI_ID;
      
    } catch (error) {
      console.error('Error getting primary UPI ID:', error);
      console.warn('Falling back to default UPI ID due to error');
      return this.FALLBACK_UPI_ID;
    }
  }
  
  /**
   * Clear cache for tenant
   * @param {string} tenantId - Tenant ID
   */
  static clearCache(tenantId = null) {
    if (tenantId) {
      const cacheKey = `upi_settings_${tenantId}`;
      this.upiCache.delete(cacheKey);
      console.log('Cleared UPI cache for tenant:', tenantId);
    } else {
      this.upiCache.clear();
      console.log('Cleared all UPI cache');
    }
  }

  /**
   * Generate UPI payment string for QR code
   * @param {Object} paymentDetails - Payment information
   * @returns {string} UPI payment string
   */
  static generateUPIString(paymentDetails) {
    const {
      amount,
      transactionRef,
      merchantName = this.MERCHANT_NAME,
      upiId = this.FALLBACK_UPI_ID,
      note
    } = paymentDetails;

    // Create a shorter transaction ID for UPI (max 20 characters)
    const shortTid = transactionRef.split('-').pop(); // Use only the last part (timestamp)
    
    // Standard UPI QR code format with proper parameters
    // pa = payee address, pn = payee name, am = amount, cu = currency
    // tn = transaction note (includes full reference), tid = short transaction id
    const upiString = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(merchantName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note + ' - Ref: ' + transactionRef)}&tid=${shortTid}`;
    
    console.log('Generated UPI String:', upiString);
    return upiString;
  }

  /**
   * Generate transaction reference including student admission number
   * @param {string} admissionNo - Student admission number
   * @returns {string} Transaction reference
   */
  static generateTransactionRef(admissionNo) {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = today.getTime().toString().slice(-6);
    
    return `${admissionNo}-${dateStr}-${timeStr}`;
  }

  /**
   * Create payment note for UPI transaction
   * @param {Object} studentInfo - Student information
   * @param {Object} feeInfo - Fee information
   * @returns {string} Payment note
   */
  static createPaymentNote(studentInfo, feeInfo) {
    return `Fee Payment - ${studentInfo.name} (${studentInfo.admissionNo}) - ${feeInfo.feeComponent}`;
  }

  /**
   * Get complete payment details for QR generation (async version)
   * @param {Object} studentInfo - Student information
   * @param {Object} feeInfo - Fee information
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Object>} Complete payment details
   */
  static async getPaymentDetails(studentInfo, feeInfo, tenantId) {
    const transactionRef = this.generateTransactionRef(studentInfo.admissionNo);
    const note = this.createPaymentNote(studentInfo, feeInfo);
    
    // Get tenant-specific UPI ID
    const upiId = await this.getPrimaryUPIId(tenantId);
    
    return {
      upiId,
      merchantName: this.MERCHANT_NAME,
      amount: feeInfo.amount,
      transactionRef,
      note,
      studentInfo,
      feeInfo,
      tenantId
    };
  }
  
  /**
   * Get complete payment details for QR generation (legacy sync version - deprecated)
   * @param {Object} studentInfo - Student information  
   * @param {Object} feeInfo - Fee information
   * @returns {Object} Complete payment details (using fallback UPI ID)
   * @deprecated Use async version with tenantId parameter instead
   */
  static getPaymentDetailsSync(studentInfo, feeInfo) {
    console.warn('Using deprecated sync getPaymentDetails method. Please use async version with tenantId.');
    
    const transactionRef = this.generateTransactionRef(studentInfo.admissionNo);
    const note = this.createPaymentNote(studentInfo, feeInfo);

    return {
      upiId: this.FALLBACK_UPI_ID,
      merchantName: this.MERCHANT_NAME,
      amount: feeInfo.amount,
      transactionRef,
      note,
      studentInfo,
      feeInfo
    };
  }

  /**
   * Validate UPI transaction reference format
   * @param {string} transactionRef - Transaction reference
   * @returns {boolean} Is valid
   */
  static isValidTransactionRef(transactionRef) {
    // Format: ADM123-20241207-123456
    const pattern = /^[A-Z0-9]+-\d{8}-\d{6}$/;
    return pattern.test(transactionRef);
  }

  /**
   * Extract admission number from transaction reference
   * @param {string} transactionRef - Transaction reference
   * @returns {string} Admission number
   */
  static extractAdmissionNo(transactionRef) {
    return transactionRef.split('-')[0];
  }

  /**
   * Format amount for display
   * @param {number} amount - Amount
   * @returns {string} Formatted amount
   */
  static formatAmount(amount) {
    return `₹${parseFloat(amount).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }
}
