/**
 * Database cleanup utilities for fixing invalid dates
 */

import { supabase, TABLES } from './supabase';
import { isValidDate, hasInvalidDatePattern, formatDateForDB } from './dateValidation';

/**
 * Checks for invalid dates in the fee_structure table
 * @returns {Promise<Array>} Array of records with invalid dates
 */
export const findInvalidFeeDates = async () => {
  try {
    const { data, error } = await supabase
      .from(TABLES.FEE_STRUCTURE)
      .select('*');
    
    if (error) throw error;
    
    const invalidRecords = [];
    
    (data || []).forEach(record => {
      if (!record.due_date || 
          hasInvalidDatePattern(record.due_date) || 
          !isValidDate(record.due_date)) {
        invalidRecords.push({
          id: record.id,
          type: record.type,
          due_date: record.due_date,
          class_id: record.class_id,
          issue: !record.due_date ? 'missing_date' : 
                 hasInvalidDatePattern(record.due_date) ? 'invalid_pattern' : 
                 'invalid_date'
        });
      }
    });
    
    return invalidRecords;
  } catch (error) {
    console.error('Error finding invalid fee dates:', error);
    return [];
  }
};

/**
 * Checks for invalid dates in the student_fees table
 * @returns {Promise<Array>} Array of records with invalid dates
 */
export const findInvalidPaymentDates = async () => {
  try {
    const { data, error } = await supabase
      .from(TABLES.STUDENT_FEES)
      .select('*');
    
    if (error) throw error;
    
    const invalidRecords = [];
    
    (data || []).forEach(record => {
      if (record.payment_date && 
          (hasInvalidDatePattern(record.payment_date) || 
           !isValidDate(record.payment_date))) {
        invalidRecords.push({
          id: record.id,
          student_id: record.student_id,
          fee_id: record.fee_id,
          payment_date: record.payment_date,
          issue: hasInvalidDatePattern(record.payment_date) ? 'invalid_pattern' : 'invalid_date'
        });
      }
    });
    
    return invalidRecords;
  } catch (error) {
    console.error('Error finding invalid payment dates:', error);
    return [];
  }
};

/**
 * Attempts to fix invalid dates by setting them to a reasonable default
 * @param {Array} invalidRecords - Records with invalid dates
 * @param {string} table - Table name to update
 * @param {string} dateColumn - Column name containing the date
 * @returns {Promise<Object>} Result of the cleanup operation
 */
export const fixInvalidDates = async (invalidRecords, table, dateColumn) => {
  const results = {
    fixed: 0,
    failed: 0,
    errors: []
  };
  
  for (const record of invalidRecords) {
    try {
      // Set a reasonable default date (end of current academic year)
      const now = new Date();
      const academicYearEnd = new Date(now.getFullYear() + (now.getMonth() >= 6 ? 1 : 0), 5, 30); // June 30th
      const defaultDate = formatDateForDB(academicYearEnd);
      
      const { error } = await supabase
        .from(table)
        .update({ [dateColumn]: defaultDate })
        .eq('id', record.id);
      
      if (error) {
        results.failed++;
        results.errors.push(`Failed to fix record ${record.id}: ${error.message}`);
      } else {
        results.fixed++;
        console.log(`Fixed ${table} record ${record.id}: ${record[dateColumn]} -> ${defaultDate}`);
      }
    } catch (error) {
      results.failed++;
      results.errors.push(`Error fixing record ${record.id}: ${error.message}`);
    }
  }
  
  return results;
};

/**
 * Comprehensive database cleanup for date issues
 * @returns {Promise<Object>} Summary of cleanup results
 */
export const cleanupDatabaseDates = async () => {
  console.log('Starting database date cleanup...');
  
  const summary = {
    feeStructures: { found: 0, fixed: 0, failed: 0 },
    studentFees: { found: 0, fixed: 0, failed: 0 },
    errors: []
  };
  
  try {
    // Check fee structures
    const invalidFees = await findInvalidFeeDates();
    summary.feeStructures.found = invalidFees.length;
    
    if (invalidFees.length > 0) {
      console.log(`Found ${invalidFees.length} fee structures with invalid dates`);
      const feeResults = await fixInvalidDates(invalidFees, TABLES.FEE_STRUCTURE, 'due_date');
      summary.feeStructures.fixed = feeResults.fixed;
      summary.feeStructures.failed = feeResults.failed;
      summary.errors.push(...feeResults.errors);
    }
    
    // Check student fees
    const invalidPayments = await findInvalidPaymentDates();
    summary.studentFees.found = invalidPayments.length;
    
    if (invalidPayments.length > 0) {
      console.log(`Found ${invalidPayments.length} student fees with invalid dates`);
      const paymentResults = await fixInvalidDates(invalidPayments, TABLES.STUDENT_FEES, 'payment_date');
      summary.studentFees.fixed = paymentResults.fixed;
      summary.studentFees.failed = paymentResults.failed;
      summary.errors.push(...paymentResults.errors);
    }
    
    console.log('Database date cleanup completed');
    return summary;
    
  } catch (error) {
    console.error('Error during database cleanup:', error);
    summary.errors.push(`Cleanup failed: ${error.message}`);
    return summary;
  }
};

/**
 * Validates all dates in the database and reports issues
 * @returns {Promise<Object>} Validation report
 */
export const validateDatabaseDates = async () => {
  const report = {
    feeStructures: {
      total: 0,
      valid: 0,
      invalid: []
    },
    studentFees: {
      total: 0,
      valid: 0,
      invalid: []
    }
  };
  
  try {
    // Validate fee structure dates
    const invalidFees = await findInvalidFeeDates();
    const { data: allFees } = await supabase.from(TABLES.FEE_STRUCTURE).select('id');
    
    report.feeStructures.total = (allFees || []).length;
    report.feeStructures.invalid = invalidFees;
    report.feeStructures.valid = report.feeStructures.total - invalidFees.length;
    
    // Validate student fee dates
    const invalidPayments = await findInvalidPaymentDates();
    const { data: allPayments } = await supabase.from(TABLES.STUDENT_FEES).select('id');
    
    report.studentFees.total = (allPayments || []).length;
    report.studentFees.invalid = invalidPayments;
    report.studentFees.valid = report.studentFees.total - invalidPayments.length;
    
    return report;
    
  } catch (error) {
    console.error('Error validating database dates:', error);
    return report;
  }
};
