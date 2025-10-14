/**
 * Date utility functions to handle timezone-safe date formatting and parsing
 * This prevents the common issue where selecting a date shows the previous day
 * due to timezone conversions.
 */

/**
 * Format a Date object to YYYY-MM-DD string using local time
 * This avoids timezone conversion issues that occur with toISOString()
 * @param {Date} date - The date to format
 * @returns {string} - Date in YYYY-MM-DD format
 */
export const formatDateToYYYYMMDD = (date) => {
  if (!date || !(date instanceof Date)) {
    return '';
  }
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

/**
 * Parse a YYYY-MM-DD string to Date object safely
 * This ensures the date is created in local timezone
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {Date|null} - Date object or null if invalid
 */
export const parseYYYYMMDDToDate = (dateString) => {
  if (!dateString || typeof dateString !== 'string') {
    return null;
  }
  
  // Parse the date components manually to avoid timezone issues
  const parts = dateString.split('-');
  if (parts.length !== 3) {
    return null;
  }
  
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
  const day = parseInt(parts[2], 10);
  
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    return null;
  }
  
  // Create date in local timezone
  return new Date(year, month, day);
};

/**
 * Format date for display in DD/MM/YYYY format
 * @param {string|Date} date - Date string or Date object
 * @returns {string} - Formatted date string or empty string if invalid
 */
export const formatDateForDisplay = (date) => {
  let dateObj = date;
  
  if (typeof date === 'string') {
    dateObj = parseYYYYMMDDToDate(date);
  }
  
  if (!dateObj || !(dateObj instanceof Date)) {
    return '';
  }
  
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  
  return `${day}/${month}/${year}`;
};

/**
 * Calculate age from date of birth
 * @param {string|Date} dob - Date of birth (YYYY-MM-DD string or Date object)
 * @returns {number|string} - Age in years or 'N/A' if invalid
 */
export const calculateAge = (dob) => {
  let birthDate = dob;
  
  if (typeof dob === 'string') {
    birthDate = parseYYYYMMDDToDate(dob);
  }
  
  if (!birthDate || !(birthDate instanceof Date)) {
    return 'N/A';
  }
  
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  // Adjust age if birthday hasn't occurred this year
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age >= 0 ? age : 'N/A';
};

/**
 * Get date range for date pickers
 * @returns {Object} - Object with minimumDate and maximumDate
 */
export const getDatePickerRange = () => {
  const today = new Date();
  const minimumDate = new Date(today.getFullYear() - 25, 0, 1); // 25 years ago
  
  return {
    minimumDate,
    maximumDate: today
  };
};

/**
 * Validate if a date string is in valid YYYY-MM-DD format
 * @param {string} dateString - Date string to validate
 * @returns {boolean} - True if valid format
 */
export const isValidDateFormat = (dateString) => {
  if (!dateString || typeof dateString !== 'string') {
    return false;
  }
  
  // Check format with regex
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) {
    return false;
  }
  
  // Check if the date is actually valid
  const date = parseYYYYMMDDToDate(dateString);
  return date !== null && !isNaN(date.getTime());
};

export default {
  formatDateToYYYYMMDD,
  parseYYYYMMDDToDate,
  formatDateForDisplay,
  calculateAge,
  getDatePickerRange,
  isValidDateFormat
};