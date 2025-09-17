import { supabase } from './supabase';

/**
 * Receipt Counter Utility
 * Uses student_fees table to manage receipt numbers starting from 1000
 * Supports payments from students, parents, and admin
 */

/**
 * Get the next available receipt number from student_fees table
 * Checks the highest existing receipt_number and increments by 1
 * Starts from 1000 if no receipts exist
 */
export const getNextReceiptNumber = async () => {
  try {
    console.log('📧 Getting next receipt number from student_fees table...');
    
    // Get the maximum receipt number from student_fees table
    const { data: maxReceiptData, error: maxError } = await supabase
      .from('student_fees')
      .select('receipt_number')
      .order('receipt_number', { ascending: false })
      .limit(1)
      .single();

    let nextReceiptNumber;
    
    if (maxError) {
      if (maxError.code === 'PGRST116') {
        // No records exist, start from 1000
        console.log('📧 No existing receipts found, starting from 1000');
        nextReceiptNumber = 1000;
      } else {
        throw maxError;
      }
    } else {
      // Increment the highest existing receipt number
      nextReceiptNumber = (maxReceiptData.receipt_number || 999) + 1;
      console.log('📧 Found max receipt number:', maxReceiptData.receipt_number, '→ Next:', nextReceiptNumber);
    }
    
    // Ensure we never go below 1000
    if (nextReceiptNumber < 1000) {
      nextReceiptNumber = 1000;
    }
    
    console.log('📧 Generated receipt number:', nextReceiptNumber);
    return nextReceiptNumber;
    
  } catch (error) {
    console.error('❌ Failed to get next receipt number:', error);
    // Fallback to timestamp-based number starting from 1000
    const fallback = 1000 + Math.floor(Date.now() / 1000) % 9000;
    console.log('📧 Using fallback receipt number:', fallback);
    return fallback;
  }
};

/**
 * Format receipt number with RCP prefix
 * @param {number} receiptNumber - The receipt number to format
 * @returns {string} - Formatted receipt number (e.g., "RCP1001")
 */
export const formatReceiptNumber = (receiptNumber) => {
  return `RCP${String(receiptNumber).padStart(4, '0')}`;
};
