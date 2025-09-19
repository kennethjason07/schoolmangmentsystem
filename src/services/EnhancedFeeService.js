/**
 * 🚀 ENHANCED FEE MANAGEMENT SERVICE
 * 
 * Breaking changes implementation for Fee Management using enhanced tenant system
 * - Full tenant isolation with performance optimizations
 * - Advanced caching and real-time updates
 * - Service functions following enhanced tenant pattern
 * - Breaking changes to replace existing fee management logic
 */

import { enhancedTenantDB } from './EnhancedTenantService';
import { TABLES } from '../utils/supabase';
import { getCachedTenantId } from '../utils/tenantHelpers';

/**
 * 🚀 ENHANCED FEE MANAGEMENT SERVICE CLASS
 * Breaking changes: Complete replacement of existing fee management logic
 */
export class EnhancedFeeManagementService {
  constructor() {
    this.cache = new Map();
    this.subscriptions = new Map();
  }

  /**
   * 🚀 BREAKING CHANGE: Get all fee data with enhanced performance
   * Replaces: getOptimizedFeeManagementData
   */
  async getAllFeeData(options = {}) {
    const { 
      useCache = true, 
      academicYear,
      classId,
      onProgress 
    } = options;

    try {
      if (onProgress) onProgress({ step: 'Starting enhanced fee data loading', progress: 5 });

      // Build filters
      const filters = {};
      if (academicYear) filters.academic_year = academicYear;
      if (classId) filters.class_id = classId;

      // Parallel data loading with enhanced performance
      const [
        classesResult,
        feeStructuresResult,
        studentsResult,
        paymentsResult,
        discountsResult
      ] = await Promise.all([
        enhancedTenantDB.read(TABLES.CLASSES, filters, {
          selectClause: 'id, class_name, section, academic_year',
          useCache,
          orderBy: 'class_name'
        }),
        enhancedTenantDB.read(TABLES.FEE_STRUCTURE, filters, {
          selectClause: 'id, class_id, student_id, fee_component, amount, base_amount, due_date, academic_year, discount_applied',
          useCache,
          orderBy: 'fee_component'
        }),
        enhancedTenantDB.read(TABLES.STUDENTS, filters, {
          selectClause: 'id, name, class_id, admission_no, academic_year',
          useCache,
          orderBy: 'name'
        }),
        enhancedTenantDB.read(TABLES.STUDENT_FEES, filters, {
          selectClause: 'id, student_id, fee_component, amount_paid, payment_date, payment_mode, academic_year',
          useCache,
          orderBy: { column: 'payment_date', ascending: false }
        }),
        enhancedTenantDB.read(TABLES.STUDENT_DISCOUNTS, { ...filters, is_active: true }, {
          selectClause: 'id, student_id, class_id, fee_component, discount_type, discount_value, academic_year',
          useCache
        })
      ]);

      if (onProgress) onProgress({ step: 'Processing fee data', progress: 60 });

      // Check for errors
      const results = [classesResult, feeStructuresResult, studentsResult, paymentsResult, discountsResult];
      for (const result of results) {
        if (result.error) throw result.error;
      }

      // Process data into optimized format
      const processedData = this.processFeeManagementData({
        classes: classesResult.data || [],
        feeStructures: feeStructuresResult.data || [],
        students: studentsResult.data || [],
        payments: paymentsResult.data || [],
        discounts: discountsResult.data || []
      });

      if (onProgress) onProgress({ step: 'Enhanced fee data loaded successfully', progress: 100 });

      console.log('✅ Enhanced Fee Management: Data loaded successfully');
      return {
        success: true,
        data: processedData,
        fromCache: classesResult.fromCache || false
      };

    } catch (error) {
      console.error('❌ Enhanced Fee Management: Error loading fee data:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }

  /**
   * 🚀 BREAKING CHANGE: Calculate payment statistics with enhanced performance
   * Replaces: calculateOptimizedClassPaymentStats
   */
  async calculatePaymentStatistics(processedData, options = {}) {
    const { onProgress } = options;

    try {
      if (onProgress) onProgress({ step: 'Calculating payment statistics', progress: 10 });

      const classStats = [];
      let totalCollected = 0;
      let totalDue = 0;
      let totalOutstanding = 0;

      // Enhanced calculation with better performance
      for (const [classId, classData] of processedData.classesMap) {
        const studentsInClass = processedData.studentsByClassMap.get(classId) || [];
        const feeStructuresForClass = processedData.feeStructuresMap.get(classId) || [];

        let classExpectedFees = 0;
        let classPaidAmount = 0;
        let classDiscounts = 0;
        let studentsWithPayments = 0;
        let studentsWithDiscounts = 0;

        // Enhanced per-student calculation with caching
        studentsInClass.forEach(student => {
          const studentPayments = processedData.paymentsMap.get(student.id) || [];
          const studentDiscounts = processedData.discountsMap.get(student.id) || [];

          // Calculate student's expected fees with enhanced logic
          const studentExpected = feeStructuresForClass.reduce((sum, fee) => {
            if (!fee.student_id || fee.student_id === student.id) {
              return sum + (parseFloat(fee.amount) || 0);
            }
            return sum;
          }, 0);

          // Calculate student's payments with enhanced aggregation
          const studentPaid = studentPayments.reduce((sum, payment) => 
            sum + (parseFloat(payment.amount_paid) || 0), 0);

          // Calculate student's discounts with enhanced logic
          const studentDiscountAmount = studentDiscounts.reduce((sum, discount) => {
            if (discount.discount_type === 'percentage') {
              const baseAmount = feeStructuresForClass
                .filter(fee => fee.fee_component === discount.fee_component)
                .reduce((sum, fee) => sum + (parseFloat(fee.base_amount) || parseFloat(fee.amount) || 0), 0);
              return sum + (baseAmount * (parseFloat(discount.discount_value) || 0) / 100);
            } else {
              return sum + (parseFloat(discount.discount_value) || 0);
            }
          }, 0);

          classExpectedFees += studentExpected;
          classPaidAmount += studentPaid;
          classDiscounts += studentDiscountAmount;

          if (studentPaid > 0) studentsWithPayments++;
          if (studentDiscountAmount > 0) studentsWithDiscounts++;
        });

        const classOutstanding = Math.max(0, classExpectedFees - classPaidAmount - classDiscounts);
        const collectionRate = classExpectedFees > 0 ? (classPaidAmount / classExpectedFees) * 100 : 0;

        const classStat = {
          classId,
          className: `${classData.class_name}${classData.section ? ` - ${classData.section}` : ''}`,
          totalStudents: studentsInClass.length,
          totalExpectedFees: classExpectedFees,
          totalPaid: classPaidAmount,
          totalDiscounts: classDiscounts,
          outstanding: classOutstanding,
          collectionRate: Math.round(collectionRate * 100) / 100,
          studentsWithPayments,
          studentsWithoutPayments: studentsInClass.length - studentsWithPayments,
          studentsWithDiscounts,
          feeStructures: feeStructuresForClass
        };

        classStats.push(classStat);

        totalDue += classExpectedFees;
        totalCollected += classPaidAmount;
        totalOutstanding += classOutstanding;
      }

      if (onProgress) onProgress({ step: 'Payment statistics calculated', progress: 100 });

      // Sort by outstanding amount (highest first)
      classStats.sort((a, b) => b.outstanding - a.outstanding);

      const overallCollectionRate = totalDue > 0 ? 
        Math.round((totalCollected / totalDue) * 10000) / 100 : 0;

      const result = {
        classStats,
        summary: {
          totalCollected,
          totalDue,
          totalOutstanding,
          collectionRate: overallCollectionRate
        }
      };

      console.log('✅ Enhanced Fee Management: Payment statistics calculated');
      return { success: true, data: result };

    } catch (error) {
      console.error('❌ Enhanced Fee Management: Error calculating payment statistics:', error);
      return { success: false, error: error.message, data: null };
    }
  }

  /**
   * 🚀 BREAKING CHANGE: Create fee structure with enhanced validation
   * Replaces: handleFeeOperation
   */
  async createFeeStructure(feeData, options = {}) {
    const { validateAccess = true, onProgress } = options;

    try {
      if (onProgress) onProgress({ step: 'Validating fee structure data', progress: 10 });

      // Enhanced validation
      this.validateFeeStructureData(feeData);

      if (onProgress) onProgress({ step: 'Creating fee structure', progress: 50 });

      const result = await enhancedTenantDB.create(TABLES.FEE_STRUCTURE, feeData, {
        validateAccess,
        onProgress: (progress) => {
          if (onProgress) onProgress({ 
            step: `Creating fee structure: ${progress.step}`, 
            progress: 50 + (progress.progress * 0.4) 
          });
        }
      });

      if (result.error) throw result.error;

      if (onProgress) onProgress({ step: 'Fee structure created successfully', progress: 100 });

      console.log('✅ Enhanced Fee Management: Fee structure created');
      return { success: true, data: result.data };

    } catch (error) {
      console.error('❌ Enhanced Fee Management: Error creating fee structure:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 🚀 BREAKING CHANGE: Process payment with enhanced features
   * Replaces: handlePaymentSubmission
   */
  async processPayment(paymentData, options = {}) {
    const { validateAccess = true, onProgress } = options;

    try {
      if (onProgress) onProgress({ step: 'Validating payment data', progress: 10 });

      // Enhanced payment validation
      this.validatePaymentData(paymentData);

      if (onProgress) onProgress({ step: 'Processing payment', progress: 30 });

      // Create payment record
      const paymentResult = await enhancedTenantDB.create(TABLES.STUDENT_FEES, paymentData, {
        validateAccess,
        onProgress: (progress) => {
          if (onProgress) onProgress({ 
            step: `Processing payment: ${progress.step}`, 
            progress: 30 + (progress.progress * 0.5) 
          });
        }
      });

      if (paymentResult.error) throw paymentResult.error;

      if (onProgress) onProgress({ step: 'Updating fee status', progress: 80 });

      // Update fee structure status if needed
      await this.updateFeeStatus(paymentData.student_id, paymentData.fee_component);

      if (onProgress) onProgress({ step: 'Payment processed successfully', progress: 100 });

      console.log('✅ Enhanced Fee Management: Payment processed');
      return { success: true, data: paymentResult.data };

    } catch (error) {
      console.error('❌ Enhanced Fee Management: Error processing payment:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 🚀 BREAKING CHANGE: Get recent payments with enhanced filtering
   * Replaces: getRecentPayments
   */
  async getRecentPayments(options = {}) {
    const { 
      limit = 20, 
      classId, 
      studentId, 
      dateFrom, 
      dateTo,
      useCache = true,
      onProgress 
    } = options;

    try {
      if (onProgress) onProgress({ step: 'Loading recent payments', progress: 20 });

      const filters = {};
      if (classId) filters.class_id = classId;
      if (studentId) filters.student_id = studentId;

      const result = await enhancedTenantDB.read(TABLES.STUDENT_FEES, filters, {
        selectClause: `
          id, student_id, fee_component, amount_paid, payment_date, payment_mode, academic_year,
          students:student_id(id, name, admission_no, class_id)
        `,
        useCache,
        orderBy: { column: 'payment_date', ascending: false },
        limit,
        onProgress: (progress) => {
          if (onProgress) onProgress({ 
            step: `Loading payments: ${progress.step}`, 
            progress: 20 + (progress.progress * 0.7) 
          });
        }
      });

      if (result.error) throw result.error;

      // Filter by date range if specified
      let payments = result.data || [];
      if (dateFrom || dateTo) {
        payments = payments.filter(payment => {
          const paymentDate = new Date(payment.payment_date);
          const isAfterFrom = !dateFrom || paymentDate >= new Date(dateFrom);
          const isBeforeTo = !dateTo || paymentDate <= new Date(dateTo);
          return isAfterFrom && isBeforeTo;
        });
      }

      if (onProgress) onProgress({ step: 'Recent payments loaded', progress: 100 });

      console.log('✅ Enhanced Fee Management: Recent payments loaded:', payments.length);
      return { success: true, data: payments };

    } catch (error) {
      console.error('❌ Enhanced Fee Management: Error loading recent payments:', error);
      return { success: false, error: error.message, data: [] };
    }
  }

  /**
   * 🚀 BREAKING CHANGE: Subscribe to real-time fee updates
   * New feature: Real-time data synchronization
   */
  async subscribeToFeeUpdates(callback, options = {}) {
    const { classId, studentId } = options;

    try {
      const filters = {};
      if (classId) filters.class_id = classId;
      if (studentId) filters.student_id = studentId;

      // Subscribe to fee structure changes
      const feeStructureSubscription = await enhancedTenantDB.subscribe(
        TABLES.FEE_STRUCTURE,
        filters,
        (payload) => callback({ type: 'fee_structure', data: payload }),
        { subscriptionKey: `fee_structure_${classId || 'all'}_${studentId || 'all'}` }
      );

      // Subscribe to payment changes
      const paymentsSubscription = await enhancedTenantDB.subscribe(
        TABLES.STUDENT_FEES,
        filters,
        (payload) => callback({ type: 'payment', data: payload }),
        { subscriptionKey: `payments_${classId || 'all'}_${studentId || 'all'}` }
      );

      console.log('✅ Enhanced Fee Management: Real-time subscriptions created');
      return {
        success: true,
        subscriptions: [feeStructureSubscription, paymentsSubscription],
        unsubscribe: () => {
          feeStructureSubscription.unsubscribe();
          paymentsSubscription.unsubscribe();
        }
      };

    } catch (error) {
      console.error('❌ Enhanced Fee Management: Error creating subscriptions:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 🚀 Process fee management data into optimized format
   */
  processFeeManagementData(rawData) {
    // Create efficient lookup maps
    const classesMap = new Map();
    const studentsMap = new Map();
    const studentsByClassMap = new Map();
    const feeStructuresMap = new Map();
    const paymentsMap = new Map();
    const discountsMap = new Map();

    // Process classes
    rawData.classes?.forEach(cls => {
      classesMap.set(cls.id, cls);
      studentsByClassMap.set(cls.id, []);
    });

    // Process students
    rawData.students?.forEach(student => {
      studentsMap.set(student.id, student);
      if (studentsByClassMap.has(student.class_id)) {
        studentsByClassMap.get(student.class_id).push(student);
      }
    });

    // Process fee structures - group by class
    rawData.feeStructures?.forEach(fee => {
      if (fee.class_id) {
        if (!feeStructuresMap.has(fee.class_id)) {
          feeStructuresMap.set(fee.class_id, []);
        }
        feeStructuresMap.get(fee.class_id).push(fee);
      }
    });

    // Process payments - group by student
    rawData.payments?.forEach(payment => {
      if (!paymentsMap.has(payment.student_id)) {
        paymentsMap.set(payment.student_id, []);
      }
      paymentsMap.get(payment.student_id).push(payment);
    });

    // Process discounts - group by student
    rawData.discounts?.forEach(discount => {
      if (!discountsMap.has(discount.student_id)) {
        discountsMap.set(discount.student_id, []);
      }
      discountsMap.get(discount.student_id).push(discount);
    });

    return {
      classesMap,
      studentsMap,
      studentsByClassMap,
      feeStructuresMap,
      paymentsMap,
      discountsMap,
      rawData
    };
  }

  /**
   * 🚀 Validate fee structure data
   */
  validateFeeStructureData(feeData) {
    if (!feeData.fee_component || !feeData.amount) {
      throw new Error('Fee component and amount are required');
    }
    
    if (parseFloat(feeData.amount) <= 0) {
      throw new Error('Fee amount must be greater than zero');
    }
    
    if (!feeData.class_id) {
      throw new Error('Class ID is required');
    }
  }

  /**
   * 🚀 Validate payment data
   */
  validatePaymentData(paymentData) {
    if (!paymentData.student_id || !paymentData.amount_paid) {
      throw new Error('Student ID and payment amount are required');
    }
    
    if (parseFloat(paymentData.amount_paid) <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }
    
    if (!paymentData.payment_mode) {
      throw new Error('Payment mode is required');
    }
  }

  /**
   * 🚀 Update fee status after payment
   */
  async updateFeeStatus(studentId, feeComponent) {
    try {
      // Get total paid for this fee component
      const paymentsResult = await enhancedTenantDB.read(TABLES.STUDENT_FEES, {
        student_id: studentId,
        fee_component: feeComponent
      });

      if (paymentsResult.error) return;

      const totalPaid = (paymentsResult.data || []).reduce(
        (sum, payment) => sum + parseFloat(payment.amount_paid || 0), 0
      );

      // Get fee structure amount
      const feeStructureResult = await enhancedTenantDB.read(TABLES.FEE_STRUCTURE, {
        student_id: studentId,
        fee_component: feeComponent
      });

      if (feeStructureResult.error || !feeStructureResult.data?.length) return;

      const feeAmount = parseFloat(feeStructureResult.data[0].amount || 0);
      const status = totalPaid >= feeAmount ? 'paid' : 'partial';

      // Update fee structure status
      await enhancedTenantDB.update(TABLES.FEE_STRUCTURE, {
        student_id: studentId,
        fee_component: feeComponent
      }, {
        payment_status: status,
        amount_paid: totalPaid
      });

      console.log('✅ Enhanced Fee Management: Fee status updated');

    } catch (error) {
      console.error('❌ Enhanced Fee Management: Error updating fee status:', error);
    }
  }

  /**
   * 🚀 Get enhanced fee management health status
   */
  async getHealthStatus() {
    try {
      const dbHealth = await enhancedTenantDB.healthCheck();
      
      return {
        status: 'healthy',
        database: dbHealth,
        cache: {
          size: this.cache.size,
          subscriptions: this.subscriptions.size
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 🚀 Clear all caches and subscriptions
   */
  async cleanup() {
    this.cache.clear();
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    this.subscriptions.clear();
    await enhancedTenantDB.clearAllCache();
    console.log('🧹 Enhanced Fee Management: Cleanup completed');
  }
}

// Create singleton instance
export const enhancedFeeService = new EnhancedFeeManagementService();

export default enhancedFeeService;