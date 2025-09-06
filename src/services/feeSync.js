import { supabase, TABLES, getUserTenantId } from '../utils/supabase';
import { calculateStudentFees } from '../utils/feeCalculation';

/**
 * Unified Fee Synchronization Service
 * Ensures consistent fee data across admin, parent, and student views
 */

/**
 * Sync fee data after payment insertion
 * @param {string} studentId - The student's ID
 * @param {string} feeComponent - The fee component that was paid
 * @param {number} amountPaid - Amount that was paid
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<Object>} Sync result
 */
export const syncFeeAfterPayment = async (studentId, feeComponent, amountPaid, tenantId = null) => {
  try {
    console.log('🔄 FeeSync: Starting fee sync after payment...', {
      studentId,
      feeComponent,
      amountPaid,
      tenantId
    });

    // Get actual tenant ID if not provided
    let actualTenantId = tenantId;
    if (!actualTenantId) {
      actualTenantId = await getUserTenantId();
      if (!actualTenantId) {
        throw new Error('Tenant context required but not found');
      }
    }

    // Recalculate fees using the centralized utility
    const feeCalculation = await calculateStudentFees(studentId, null, actualTenantId);
    if (!feeCalculation) {
      throw new Error('Failed to recalculate fees after payment');
    }

    console.log('✅ FeeSync: Fee recalculation complete', {
      totalAmount: feeCalculation.totalAmount,
      totalPaid: feeCalculation.totalPaid,
      totalOutstanding: feeCalculation.totalOutstanding
    });

    // Update any cached fee status if needed
    await updateFeeStatusCache(studentId, feeCalculation, actualTenantId);

    return {
      success: true,
      feeCalculation,
      syncedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ FeeSync: Error syncing fees after payment:', error);
    return {
      success: false,
      error: error.message,
      syncedAt: new Date().toISOString()
    };
  }
};

/**
 * Update fee status cache (if any caching mechanism exists)
 * @param {string} studentId - The student's ID
 * @param {Object} feeCalculation - Fee calculation result
 * @param {string} tenantId - Tenant ID
 */
const updateFeeStatusCache = async (studentId, feeCalculation, tenantId) => {
  try {
    // This function can be extended to update any caching layers
    // For now, it's a placeholder for future caching implementation
    console.log('💾 FeeSync: Cache update placeholder', {
      studentId,
      totalOutstanding: feeCalculation.totalOutstanding,
      tenantId
    });
  } catch (error) {
    console.warn('⚠️ FeeSync: Cache update failed (non-critical):', error);
  }
};

/**
 * Validate payment consistency across fee structure and payments
 * @param {string} studentId - The student's ID
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<Object>} Validation result
 */
export const validateFeeConsistency = async (studentId, tenantId = null) => {
  try {
    console.log('🔍 FeeSync: Validating fee consistency for student:', studentId);

    // Get actual tenant ID if not provided
    let actualTenantId = tenantId;
    if (!actualTenantId) {
      actualTenantId = await getUserTenantId();
      if (!actualTenantId) {
        throw new Error('Tenant context required but not found');
      }
    }

    // Get fee calculation
    const feeCalculation = await calculateStudentFees(studentId, null, actualTenantId);
    if (!feeCalculation) {
      return {
        isConsistent: false,
        error: 'Failed to calculate fees',
        issues: ['Fee calculation failed']
      };
    }

    // Check for issues
    const issues = [];
    const warnings = [];

    // Check for orphaned payments
    if (feeCalculation.orphanedPayments && feeCalculation.orphanedPayments.length > 0) {
      issues.push(`${feeCalculation.orphanedPayments.length} orphaned payments found`);
      console.warn('⚠️ FeeSync: Orphaned payments detected:', feeCalculation.orphanedPayments);
    }

    // Check for negative outstanding amounts
    if (feeCalculation.totalOutstanding < 0) {
      warnings.push('Overpayment detected');
      console.warn('⚠️ FeeSync: Overpayment detected:', {
        totalPaid: feeCalculation.totalPaid,
        totalDue: feeCalculation.totalAmount,
        overpaid: Math.abs(feeCalculation.totalOutstanding)
      });
    }

    // Check for missing fee structures
    if (feeCalculation.details.length === 0) {
      issues.push('No fee structure found for student');
    }

    const isConsistent = issues.length === 0;

    console.log('✅ FeeSync: Consistency validation complete', {
      isConsistent,
      issuesCount: issues.length,
      warningsCount: warnings.length
    });

    return {
      isConsistent,
      issues,
      warnings,
      feeCalculation,
      validatedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ FeeSync: Error validating fee consistency:', error);
    return {
      isConsistent: false,
      error: error.message,
      issues: ['Validation failed'],
      validatedAt: new Date().toISOString()
    };
  }
};

/**
 * Sync all students' fee data for a class (admin utility)
 * @param {string} classId - The class ID
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<Object>} Bulk sync result
 */
export const syncClassFees = async (classId, tenantId = null) => {
  try {
    console.log('🔄 FeeSync: Starting bulk class fee sync for class:', classId);

    // Get actual tenant ID if not provided
    let actualTenantId = tenantId;
    if (!actualTenantId) {
      actualTenantId = await getUserTenantId();
      if (!actualTenantId) {
        throw new Error('Tenant context required but not found');
      }
    }

    // Get all students in the class
    const { data: students, error: studentsError } = await supabase
      .from(TABLES.STUDENTS)
      .select('id, name')
      .eq('class_id', classId)
      .eq('tenant_id', actualTenantId);

    if (studentsError) {
      throw new Error(`Failed to fetch students: ${studentsError.message}`);
    }

    if (!students || students.length === 0) {
      return {
        success: true,
        message: 'No students found in class',
        studentCount: 0,
        syncedAt: new Date().toISOString()
      };
    }

    console.log(`📊 FeeSync: Processing ${students.length} students in class ${classId}`);

    // Process each student's fees
    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const student of students) {
      try {
        const feeCalculation = await calculateStudentFees(student.id, classId, actualTenantId);
        if (feeCalculation) {
          results.push({
            studentId: student.id,
            studentName: student.name,
            success: true,
            totalAmount: feeCalculation.totalAmount,
            totalPaid: feeCalculation.totalPaid,
            totalOutstanding: feeCalculation.totalOutstanding
          });
          successCount++;
        } else {
          results.push({
            studentId: student.id,
            studentName: student.name,
            success: false,
            error: 'Fee calculation returned null'
          });
          errorCount++;
        }
      } catch (error) {
        console.error(`Error processing student ${student.id}:`, error);
        results.push({
          studentId: student.id,
          studentName: student.name,
          success: false,
          error: error.message
        });
        errorCount++;
      }
    }

    console.log('✅ FeeSync: Bulk class sync complete', {
      classId,
      totalStudents: students.length,
      successCount,
      errorCount
    });

    return {
      success: errorCount === 0,
      classId,
      studentCount: students.length,
      successCount,
      errorCount,
      results,
      syncedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ FeeSync: Error in bulk class sync:', error);
    return {
      success: false,
      error: error.message,
      syncedAt: new Date().toISOString()
    };
  }
};

/**
 * Get payment receipt number with tenant scoping
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<number>} Next receipt number
 */
export const getNextReceiptNumber = async (tenantId = null) => {
  try {
    // Get actual tenant ID if not provided
    let actualTenantId = tenantId;
    if (!actualTenantId) {
      actualTenantId = await getUserTenantId();
      if (!actualTenantId) {
        throw new Error('Tenant context required but not found');
      }
    }

    // Get the highest receipt number for this tenant
    const { data: lastPayment, error } = await supabase
      .from(TABLES.STUDENT_FEES)
      .select('receipt_number')
      .eq('tenant_id', actualTenantId)
      .not('receipt_number', 'is', null)
      .order('receipt_number', { ascending: false })
      .limit(1);

    if (error) {
      console.warn('Warning: Could not fetch last receipt number:', error);
      // Fallback to timestamp-based receipt number
      return Date.now() % 1000000; // Last 6 digits of timestamp
    }

    const lastReceiptNumber = lastPayment && lastPayment.length > 0 
      ? parseInt(lastPayment[0].receipt_number) || 1000
      : 1000;

    return lastReceiptNumber + 1;

  } catch (error) {
    console.error('Error generating receipt number:', error);
    // Fallback to timestamp-based receipt number
    return Date.now() % 1000000;
  }
};

/**
 * Validate payment data before insertion
 * @param {Object} paymentData - Payment data to validate
 * @returns {Object} Validation result
 */
export const validatePaymentData = (paymentData) => {
  const errors = [];
  const warnings = [];

  // Required fields validation
  if (!paymentData.student_id) {
    errors.push('Student ID is required');
  }

  if (!paymentData.tenant_id) {
    errors.push('Tenant ID is required');
  }

  if (!paymentData.fee_component) {
    errors.push('Fee component is required');
  }

  if (!paymentData.amount_paid || paymentData.amount_paid <= 0) {
    errors.push('Valid payment amount is required');
  }

  if (!paymentData.payment_date) {
    errors.push('Payment date is required');
  }

  if (!paymentData.payment_mode) {
    errors.push('Payment mode is required');
  }

  // Data type validation
  if (paymentData.amount_paid && isNaN(parseFloat(paymentData.amount_paid))) {
    errors.push('Payment amount must be a valid number');
  }

  // Business logic validation
  if (paymentData.amount_paid && parseFloat(paymentData.amount_paid) > 1000000) {
    warnings.push('Large payment amount detected (>₹10,00,000)');
  }

  // Date validation
  if (paymentData.payment_date) {
    const paymentDate = new Date(paymentData.payment_date);
    const today = new Date();
    const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());

    if (paymentDate > today) {
      errors.push('Payment date cannot be in the future');
    }

    if (paymentDate < oneYearAgo) {
      warnings.push('Payment date is more than 1 year old');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    validatedAt: new Date().toISOString()
  };
};

/**
 * Insert payment with proper validation and synchronization
 * @param {Object} paymentData - Payment data to insert
 * @returns {Promise<Object>} Insert result
 */
export const insertPaymentWithSync = async (paymentData) => {
  try {
    console.log('💳 FeeSync: Starting payment insertion with sync...', {
      studentId: paymentData.student_id,
      feeComponent: paymentData.fee_component,
      amount: paymentData.amount_paid
    });

    // Validate payment data
    const validation = validatePaymentData(paymentData);
    if (!validation.isValid) {
      return {
        success: false,
        error: 'Payment validation failed',
        validationErrors: validation.errors,
        validationWarnings: validation.warnings
      };
    }

    // Get receipt number if not provided
    if (!paymentData.receipt_number) {
      paymentData.receipt_number = await getNextReceiptNumber(paymentData.tenant_id);
    }

    // Insert payment
    const { data: insertedPayment, error: insertError } = await supabase
      .from(TABLES.STUDENT_FEES)
      .insert([paymentData])
      .select();

    if (insertError) {
      throw new Error(`Payment insertion failed: ${insertError.message}`);
    }

    console.log('✅ FeeSync: Payment inserted successfully:', insertedPayment[0]);

    // Sync fees after payment
    const syncResult = await syncFeeAfterPayment(
      paymentData.student_id,
      paymentData.fee_component,
      paymentData.amount_paid,
      paymentData.tenant_id
    );

    return {
      success: true,
      payment: insertedPayment[0],
      syncResult,
      validationWarnings: validation.warnings,
      insertedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ FeeSync: Error inserting payment with sync:', error);
    return {
      success: false,
      error: error.message,
      insertedAt: new Date().toISOString()
    };
  }
};

export default {
  syncFeeAfterPayment,
  validateFeeConsistency,
  syncClassFees,
  getNextReceiptNumber,
  validatePaymentData,
  insertPaymentWithSync
};
