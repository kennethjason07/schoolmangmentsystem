// UPI Payment Service
// Handles UPI QR code generation and transaction management
import { supabase } from '../utils/supabase';
import { generateUniqueReferenceNumber } from '../utils/referenceNumberGenerator';

export class UPIService {
  // Fallback UPI ID for development/testing (will be removed in production)
  static FALLBACK_UPI_ID = 'other@primarybank'; // TODO: Replace with your primary UPI ID
  static MERCHANT_NAME = 'School Management System';
  
  // Cache for UPI settings to avoid repeated database queries
  static upiCache = new Map();
  static cacheExpiry = 5 * 60 * 1000; // 5 minutes
  static lastCacheInvalidation = null;
  
  // Global cache invalidation flag for UPI settings changes
  static shouldInvalidateCache = false;

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
      console.log('🔍 [UPI DEBUG] getPrimaryUPIId called with tenantId:', tenantId);
      
      if (!tenantId) {
        console.warn('❌ [UPI DEBUG] No tenant ID provided, using fallback UPI ID:', this.FALLBACK_UPI_ID);
        return this.FALLBACK_UPI_ID;
      }
      
      console.log('📞 [UPI DEBUG] Calling getTenantUPISettings for tenant:', tenantId);
      const upiSettings = await this.getTenantUPISettings(tenantId);
      console.log('📊 [UPI DEBUG] getTenantUPISettings result:', upiSettings);
      
      if (upiSettings && upiSettings.upi_id) {
        console.log('✅ [UPI DEBUG] Using tenant-specific UPI ID:', upiSettings.upi_id);
        console.log('🎯 [UPI DEBUG] UPI Settings details:', {
          id: upiSettings.id,
          upi_id: upiSettings.upi_id,
          upi_name: upiSettings.upi_name,
          is_primary: upiSettings.is_primary,
          is_active: upiSettings.is_active,
          tenant_id: upiSettings.tenant_id
        });
        return upiSettings.upi_id;
      }
      
      console.warn(`⚠️ [UPI DEBUG] No UPI settings found for tenant ${tenantId}, using fallback UPI ID:`, this.FALLBACK_UPI_ID);
      console.warn('💡 [UPI DEBUG] This means either:');
      console.warn('   1. No UPI settings configured for this tenant');
      console.warn('   2. No active UPI settings found');
      console.warn('   3. Database query failed');
      console.warn('   4. RLS policies are blocking the query');
      return this.FALLBACK_UPI_ID;
      
    } catch (error) {
      console.error('❌ [UPI DEBUG] Error getting primary UPI ID:', error);
      console.error('❌ [UPI DEBUG] Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        stack: error.stack
      });
      console.warn('🔄 [UPI DEBUG] Falling back to default UPI ID due to error:', this.FALLBACK_UPI_ID);
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
      console.log('🗑️ [UPI CACHE] Cleared UPI cache for tenant:', tenantId);
    } else {
      this.upiCache.clear();
      console.log('🗑️ [UPI CACHE] Cleared all UPI cache');
    }
    this.lastCacheInvalidation = Date.now();
  }
  
  /**
   * Force refresh UPI settings for a tenant by clearing cache and fetching fresh data
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Object>} Fresh UPI settings
   */
  static async forceRefreshUPISettings(tenantId) {
    console.log('🔄 [UPI REFRESH] Force refreshing UPI settings for tenant:', tenantId);
    
    // Clear the specific tenant cache
    this.clearCache(tenantId);
    
    // Fetch fresh data
    const freshSettings = await this.getTenantUPISettings(tenantId);
    console.log('✅ [UPI REFRESH] Fresh UPI settings retrieved:', freshSettings?.upi_id || 'fallback');
    
    return freshSettings;
  }
  
  /**
   * Check if cache should be invalidated based on global invalidation flag
   * @param {string} tenantId - Tenant ID
   * @returns {boolean} Should invalidate cache
   */
  static shouldInvalidateTenantCache(tenantId) {
    if (this.shouldInvalidateCache) {
      console.log('🚨 [UPI CACHE] Global cache invalidation flag is set, clearing cache for tenant:', tenantId);
      this.clearCache(tenantId);
      return true;
    }
    return false;
  }
  
  /**
   * Set global cache invalidation flag (called when admin updates UPI settings)
   */
  static markCacheForInvalidation() {
    console.log('🚨 [UPI CACHE] Marking all UPI caches for invalidation');
    this.shouldInvalidateCache = true;
    // Clear all cache immediately
    this.clearCache();
  }
  
  /**
   * Reset global cache invalidation flag
   */
  static resetCacheInvalidationFlag() {
    console.log('✅ [UPI CACHE] Resetting cache invalidation flag');
    this.shouldInvalidateCache = false;
  }
  
  /**
   * Get fresh payment details with cache refresh option
   * @param {Object} studentInfo - Student information
   * @param {Object} feeInfo - Fee information
   * @param {string} tenantId - Tenant ID
   * @param {boolean} forceRefresh - Force refresh from database
   * @returns {Promise<Object>} Payment details
   */
  static async getPaymentDetailsWithRefresh(studentInfo, feeInfo, tenantId, forceRefresh = false) {
    console.log('💳 [UPI DETAILS] Getting payment details with refresh option:', {
      forceRefresh,
      tenantId,
      studentName: studentInfo.name
    });
    
    if (forceRefresh) {
      // Force refresh UPI settings before generating payment details
      await this.forceRefreshUPISettings(tenantId);
    }
    
    // Get payment details (will use fresh data if refreshed)
    return await this.getPaymentDetails(studentInfo, feeInfo, tenantId);
  }

  /**
   * Generate UPI payment string for QR code
   * @param {Object} paymentDetails - Payment information
   * @returns {string} UPI payment string
   */
  static generateUPIString(paymentDetails) {
    const {
      amount,
      referenceNumber,
      merchantName = this.MERCHANT_NAME,
      upiId = this.FALLBACK_UPI_ID,
      note
    } = paymentDetails;

    // Use the 6-digit reference number as transaction ID (compact and readable)
    const shortTid = referenceNumber || 'REF001';
    
    // Standard UPI QR code format with proper parameters
    // pa = payee address, pn = payee name, am = amount, cu = currency
    // tn = transaction note (includes 6-digit reference), tid = 6-digit reference
    const upiString = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(merchantName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note + ' - Ref: ' + referenceNumber)}&tid=${shortTid}`;
    
    console.log('Generated UPI String with 6-digit reference:', upiString);
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
    // Generate 6-digit reference number for this payment
    const referenceNumber = await generateUniqueReferenceNumber(
      studentInfo.name,
      tenantId
    );
    
    const note = this.createPaymentNote(studentInfo, feeInfo);
    
    // Get tenant-specific UPI ID
    const upiId = await this.getPrimaryUPIId(tenantId);
    
    console.log('💳 [UPI SERVICE] Generated 6-digit reference number:', referenceNumber);
    
    return {
      upiId,
      merchantName: this.MERCHANT_NAME,
      amount: feeInfo.amount,
      referenceNumber,
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
    console.warn('⚠️ Cannot generate unique 6-digit reference in sync method. Using fallback.');
    
    // Generate a mock reference number since this is sync (not ideal but better than old format)
    const referenceNumber = 'SYNC' + Math.floor(Math.random() * 100).toString().padStart(2, '0');
    const note = this.createPaymentNote(studentInfo, feeInfo);

    return {
      upiId: this.FALLBACK_UPI_ID,
      merchantName: this.MERCHANT_NAME,
      amount: feeInfo.amount,
      referenceNumber,
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
