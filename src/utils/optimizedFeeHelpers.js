// Optimized Fee Calculation Helpers
// These functions replace the existing multiple-query approach with efficient batched operations

import { supabase, TABLES } from './supabase';
import { validateTenantAccess } from './tenantValidation';

// Cache for frequently accessed data (in-memory cache with TTL)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCacheKey = (tenantId, key, params = '') => `${tenantId}_${key}_${params}`;

const setCache = (key, data) => {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
};

const getCache = (key) => {
  const cached = cache.get(key);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }
  cache.delete(key);
  return null;
};

/**
 * Get comprehensive fee management data in a single optimized query batch
 * This replaces multiple individual queries with a single efficient operation
 */
export const getOptimizedFeeManagementData = async (tenantId, user) => {
  // 🛡️ Validate tenant access first
  const validation = await validateTenantAccess(user?.id, tenantId, 'OptimizedFeeHelpers - getOptimizedFeeManagementData');
  if (!validation.isValid) {
    throw new Error(`Tenant validation failed: ${validation.error}`);
  }

  const cacheKey = getCacheKey(tenantId, 'fee_management_data');
  const cached = getCache(cacheKey);
  if (cached) {
    return cached;
  }

  const startTime = performance.now();

  try {
    // Skip RPC and go directly to batch queries
    return await getFeeManagementDataBatch(tenantId);

  } catch (error) {
    throw error;
  }
};

/**
 * Fallback batch query method when RPC is not available
 */
const getFeeManagementDataBatch = async (tenantId, providedAcademicYear = null) => {
  const startTime = performance.now();
  
  
  
  // Execute all queries in parallel for maximum efficiency
  const [
    classesResult,
    feeStructuresResult,
    studentsResult,
    paymentsResult,
    discountsResult
  ] = await Promise.all([
    // Classes - get all classes for tenant
    supabase
      .from(TABLES.CLASSES)
      .select('id, class_name, section, academic_year')
      .eq('tenant_id', tenantId),

    // Fee structures - get all for tenant
    supabase
      .from(TABLES.FEE_STRUCTURE)
      .select(`
        id,
        class_id,
        student_id,
        fee_component,
        amount,
        base_amount,
        due_date,
        academic_year,
        discount_applied
      `)
      .eq('tenant_id', tenantId),

    // Students - get all for tenant
    supabase
      .from(TABLES.STUDENTS)
      .select('id, name, class_id, academic_year')
      .eq('tenant_id', tenantId),

    // All payments
    supabase
      .from(TABLES.STUDENT_FEES)
      .select(`
        id,
        student_id,
        fee_component,
        amount_paid,
        payment_date,
        payment_mode,
        academic_year
      `)
      .eq('tenant_id', tenantId)
      .order('payment_date', { ascending: false }),

    // Active discounts - get all for tenant
    supabase
      .from(TABLES.STUDENT_DISCOUNTS)
      .select(`
        id,
        student_id,
        class_id,
        fee_component,
        discount_type,
        discount_value,
        academic_year
      `)
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
  ]);

  // Check for errors
  const results = [classesResult, feeStructuresResult, studentsResult, paymentsResult, discountsResult];
  for (const result of results) {
    if (result.error) throw result.error;
  }

  const processedData = {
    classes: classesResult.data || [],
    feeStructures: feeStructuresResult.data || [],
    students: studentsResult.data || [],
    payments: paymentsResult.data || [],
    discounts: discountsResult.data || []
  };

  const result = processFeeManagementData(processedData);
  
  // Cache the result
  const cacheKey = getCacheKey(tenantId, 'fee_management_data');
  setCache(cacheKey, result);
  
  return result;
};

/**
 * Process and organize the fee management data for optimal access
 */
const processFeeManagementData = (rawData) => {
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
};

/**
 * Calculate class-wise payment statistics efficiently
 * This replaces the expensive loop-based calculation in FeeManagement.js
 */
export const calculateOptimizedClassPaymentStats = async (processedData) => {
  const classStats = [];
  let totalCollected = 0;
  let totalDue = 0;
  let totalOutstanding = 0;

  // Process each class efficiently
  for (const [classId, classData] of processedData.classesMap) {
    const studentsInClass = processedData.studentsByClassMap.get(classId) || [];
    const feeStructuresForClass = processedData.feeStructuresMap.get(classId) || [];

    // Calculate class totals
    let classExpectedFees = 0;
    let classPaidAmount = 0;
    let classDiscounts = 0;
    let studentsWithPayments = 0;
    let studentsWithDiscounts = 0;

    // Efficient per-student calculation
    studentsInClass.forEach(student => {
      const studentPayments = processedData.paymentsMap.get(student.id) || [];
      const studentDiscounts = processedData.discountsMap.get(student.id) || [];

      // Calculate student's expected fees
      const studentExpected = feeStructuresForClass.reduce((sum, fee) => {
        // Check if fee applies to this student (class-level vs student-specific)
        if (!fee.student_id || fee.student_id === student.id) {
          return sum + (parseFloat(fee.amount) || 0);
        }
        return sum;
      }, 0);

      // Calculate student's payments
      const studentPaid = studentPayments.reduce((sum, payment) => 
        sum + (parseFloat(payment.amount_paid) || 0), 0);

      // Calculate student's discounts
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

    // Update totals
    totalDue += classExpectedFees;
    totalCollected += classPaidAmount;
    totalOutstanding += classOutstanding;
  }

  // Sort by outstanding amount (highest first)
  classStats.sort((a, b) => b.outstanding - a.outstanding);

  const overallCollectionRate = totalDue > 0 ? 
    Math.round((totalCollected / totalDue) * 10000) / 100 : 0;

  return {
    classStats,
    summary: {
      totalCollected,
      totalDue,
      totalOutstanding,
      collectionRate: overallCollectionRate
    }
  };
};

/**
 * Get recent payments efficiently
 */
export const getRecentPayments = (processedData, limit = 20) => {
  const allPayments = [];
  
  // Collect all payments with student info
  for (const [studentId, payments] of processedData.paymentsMap) {
    const student = processedData.studentsMap.get(studentId);
    if (student) {
      payments.forEach(payment => {
        allPayments.push({
          ...payment,
          student,
          students: { full_name: student.name } // Maintain compatibility with existing UI
        });
      });
    }
  }

  // Sort by payment date (most recent first) and limit
  return allPayments
    .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))
    .slice(0, limit);
};

/**
 * Get fee structure data organized by class
 */
export const getOrganizedFeeStructures = (processedData) => {
  const organizedStructures = [];

  for (const [classId, classData] of processedData.classesMap) {
    const feeStructuresForClass = processedData.feeStructuresMap.get(classId) || [];
    
    if (feeStructuresForClass.length > 0) {
      organizedStructures.push({
        classId,
        name: `${classData.class_name}${classData.section ? ` - ${classData.section}` : ''}`,
        fees: feeStructuresForClass.map(fee => ({
          id: fee.id,
          type: fee.fee_component,
          amount: fee.amount,
          due_date: fee.due_date,
          description: fee.fee_component,
          academic_year: fee.academic_year
        }))
      });
    }
  }

  return organizedStructures;
};

/**
 * Clear cache for a specific tenant
 */
export const clearFeeCache = (tenantId) => {
  const keysToDelete = [];
  for (const key of cache.keys()) {
    if (key.startsWith(`${tenantId}_`)) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach(key => cache.delete(key));
};

/**
 * Get cache statistics
 */
export const getCacheStats = () => {
  const now = Date.now();
  let activeEntries = 0;
  let expiredEntries = 0;

  for (const [key, value] of cache) {
    if ((now - value.timestamp) < CACHE_TTL) {
      activeEntries++;
    } else {
      expiredEntries++;
    }
  }

  return {
    totalEntries: cache.size,
    activeEntries,
    expiredEntries,
    cacheTTL: CACHE_TTL
  };
};
