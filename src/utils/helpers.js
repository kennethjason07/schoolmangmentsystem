/**
 * Helper functions for the school management system
 */

/**
 * Format a number as currency
 * @param {number} amount - The amount to format
 * @param {string} currency - The currency symbol (default: '$')
 * @returns {string} - Formatted currency string
 */
export const formatCurrency = (amount, currency = '$') => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return `${currency}0.00`;
  }
  
  return `${currency}${Number(amount).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}`;
};

/**
 * Format a date string to a readable format
 * @param {string|Date} date - The date to format
 * @returns {string} - Formatted date string
 */
export const formatDate = (date) => {
  if (!date) return '';
  
  try {
    const dateObj = new Date(date);
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    return '';
  }
};

/**
 * Capitalize the first letter of a string
 * @param {string} str - The string to capitalize
 * @returns {string} - Capitalized string
 */
export const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * Generate a random ID
 * @returns {string} - Random ID string
 */
export const generateId = () => {
  return Math.random().toString(36).substr(2, 9);
};

/**
 * Validate email format
 * @param {string} email - The email to validate
 * @returns {boolean} - Whether the email is valid
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Calculate percentage
 * @param {number} value - The value
 * @param {number} total - The total
 * @returns {number} - Percentage
 */
export const calculatePercentage = (value, total) => {
  if (!total || total === 0) return 0;
  return Math.round((value / total) * 100);
};

/**
 * Get student fees with fee structure details using proper joins
 * @param {string} academicYear - The academic year to filter by
 * @returns {Promise} - Promise resolving to student fees data
 */
export const getStudentFeesWithStructure = async (supabase, academicYear = '2024-25') => {
  try {
    // Get all fee structures for the academic year
    const { data: feeStructures, error: feeError } = await supabase
      .from('fee_structure')
      .select('*')
      .eq('academic_year', academicYear);

    if (feeError) throw feeError;

    // Get all students with their classes
    const { data: students, error: studentError } = await supabase
      .from('students')
      .select(`
        id,
        full_name,
        admission_no,
        class_id,
        classes(class_name, section)
      `);

    if (studentError) throw studentError;

    // Get all student fee payments - NO RELATIONSHIP QUERY
    const { data: payments, error: paymentError } = await supabase
      .from('student_fees')
      .select('*');

    if (paymentError) throw paymentError;

    // Combine the data to show all student-fee combinations
    const result = [];
    
    students.forEach(student => {
      // Find fee structures for this student's class
      const classFees = feeStructures.filter(fee => fee.class_id === student.class_id);
      
      classFees.forEach(fee => {
        // Find payment for this student-fee combination
        const payment = payments.find(p => 
          p.student_id === student.id && p.fee_id === fee.id
        );

        result.push({
          student_name: student.full_name,
          admission_no: student.admission_no,
          class_name: student.classes ? `${student.classes.class_name} ${student.classes.section || ''}`.trim() : 'Unknown',
          academic_year: fee.academic_year,
          fee_component: fee.type,
          defined_amount: fee.amount,
          amount_paid: payment ? payment.amount : 0,
          payment_date: payment ? payment.payment_date : null,
          payment_status: payment ? 
            (payment.amount >= fee.amount ? 'paid' : 'partial') : 
            'unpaid'
        });
      });
    });

    return { data: result, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

/**
 * Get unpaid fees for students
 * @param {string} academicYear - The academic year to filter by
 * @returns {Promise} - Promise resolving to unpaid fees data
 */
export const getUnpaidFees = async (supabase, academicYear = '2024-25') => {
  try {
    const { data: allFees, error } = await getStudentFeesWithStructure(supabase, academicYear);
    
    if (error) throw error;
    
    // Filter for unpaid and partial fees
    const unpaidFees = allFees.filter(fee => 
      fee.payment_status === 'unpaid' || fee.payment_status === 'partial'
    );
    
    return { data: unpaidFees, error: null };
  } catch (error) {
    return { data: null, error };
  }
};
