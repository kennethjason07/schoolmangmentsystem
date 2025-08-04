/**
 * Date validation utilities for the school management system
 */

/**
 * Validates if a date is valid and within reasonable bounds
 * @param {string|Date} date - The date to validate
 * @returns {boolean} - True if the date is valid
 */
export const isValidDate = (date) => {
  if (!date) return false;
  
  const d = new Date(date);
  
  // Check if date is valid
  if (!(d instanceof Date) || isNaN(d) || d.toString() === 'Invalid Date') {
    return false;
  }
  
  // Additional validation to prevent impossible dates like 2025-08-32
  const year = d.getFullYear();
  const month = d.getMonth(); // 0-based
  const day = d.getDate();
  
  // Create a new date with the same values and check if it matches
  const testDate = new Date(year, month, day);
  return testDate.getFullYear() === year && 
         testDate.getMonth() === month && 
         testDate.getDate() === day;
};

/**
 * Validates if a date is within a reasonable range for school operations
 * @param {string|Date} date - The date to validate
 * @returns {boolean} - True if the date is within reasonable bounds
 */
export const isReasonableDate = (date) => {
  if (!isValidDate(date)) return false;
  
  const d = new Date(date);
  const now = new Date();
  const minDate = new Date(now.getFullYear() - 1, 0, 1); // 1 year ago
  const maxDate = new Date(now.getFullYear() + 5, 11, 31); // 5 years from now
  
  return d >= minDate && d <= maxDate;
};

/**
 * Formats a date to YYYY-MM-DD format for database storage
 * @param {string|Date} date - The date to format
 * @returns {string|null} - Formatted date string or null if invalid
 */
export const formatDateForDB = (date) => {
  if (!isValidDate(date)) return null;
  
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

/**
 * Safely parses a date string and returns a valid Date object or null
 * @param {string} dateString - The date string to parse
 * @returns {Date|null} - Valid Date object or null if invalid
 */
export const safeParseDate = (dateString) => {
  if (!dateString) return null;
  
  const date = new Date(dateString);
  return isValidDate(date) ? date : null;
};

/**
 * Validates and cleans a date value for form inputs
 * @param {string|Date} date - The date to clean
 * @returns {string} - Clean date string or empty string if invalid
 */
export const cleanDateForForm = (date) => {
  const validDate = safeParseDate(date);
  return validDate ? validDate.toISOString() : '';
};

/**
 * Checks if a date string matches common invalid patterns
 * @param {string} dateString - The date string to check
 * @returns {boolean} - True if the date string appears to be invalid
 */
export const hasInvalidDatePattern = (dateString) => {
  if (!dateString) return true;
  
  // Check for impossible dates like 2025-08-32, 2025-13-01, etc.
  const patterns = [
    /\d{4}-\d{2}-(3[2-9]|[4-9]\d)/,  // Days > 31
    /\d{4}-(1[3-9]|[2-9]\d)-\d{2}/,  // Months > 12
    /\d{4}-00-\d{2}/,                // Month 00
    /\d{4}-\d{2}-00/,                // Day 00
  ];
  
  return patterns.some(pattern => pattern.test(dateString));
};
