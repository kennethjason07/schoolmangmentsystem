/**
 * Academic Year Utility Functions
 * 
 * These functions handle dynamic academic year generation based on current date
 * and provide consistent academic year formatting throughout the application.
 */

/**
 * Get the current academic year based on the current date
 * Academic year typically runs from April to March in most Indian schools
 * 
 * @param {Date} currentDate - Optional date to calculate from (defaults to current date)
 * @returns {string} - Academic year in format "YYYY-YY" (e.g., "2024-25")
 */
export const getCurrentAcademicYear = (currentDate = new Date()) => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1; // getMonth() returns 0-11
  
  // If current month is April (4) or later, academic year is current-next
  // If current month is January-March, academic year is previous-current
  if (month >= 4) {
    // April onwards: 2024-25 (if current year is 2024)
    return `${year}-${String(year + 1).slice(-2)}`;
  } else {
    // January-March: 2023-24 (if current year is 2024)
    return `${year - 1}-${String(year).slice(-2)}`;
  }
};

/**
 * Get the next academic year
 * 
 * @param {string} currentAcademicYear - Current academic year (e.g., "2024-25")
 * @returns {string} - Next academic year (e.g., "2025-26")
 */
export const getNextAcademicYear = (currentAcademicYear) => {
  if (!currentAcademicYear) {
    const current = getCurrentAcademicYear();
    return getNextAcademicYear(current);
  }
  
  // Parse the current academic year
  const [startYear] = currentAcademicYear.split('-');
  const nextStartYear = parseInt(startYear) + 1;
  
  return `${nextStartYear}-${String(nextStartYear + 1).slice(-2)}`;
};

/**
 * Get the previous academic year
 * 
 * @param {string} currentAcademicYear - Current academic year (e.g., "2024-25")
 * @returns {string} - Previous academic year (e.g., "2023-24")
 */
export const getPreviousAcademicYear = (currentAcademicYear) => {
  if (!currentAcademicYear) {
    const current = getCurrentAcademicYear();
    return getPreviousAcademicYear(current);
  }
  
  // Parse the current academic year
  const [startYear] = currentAcademicYear.split('-');
  const prevStartYear = parseInt(startYear) - 1;
  
  return `${prevStartYear}-${String(prevStartYear + 1).slice(-2)}`;
};

/**
 * Generate a list of academic years for dropdowns/selectors
 * 
 * @param {number} yearsBack - How many years back from current (default: 5)
 * @param {number} yearsAhead - How many years ahead from current (default: 2)
 * @returns {string[]} - Array of academic years
 */
export const generateAcademicYearList = (yearsBack = 5, yearsAhead = 2) => {
  const currentAcademicYear = getCurrentAcademicYear();
  const [currentStartYear] = currentAcademicYear.split('-');
  const baseYear = parseInt(currentStartYear);
  
  const years = [];
  
  // Generate years from (current - yearsBack) to (current + yearsAhead)
  for (let i = baseYear - yearsBack; i <= baseYear + yearsAhead; i++) {
    years.push(`${i}-${String(i + 1).slice(-2)}`);
  }
  
  return years;
};

/**
 * Check if a given academic year is the current academic year
 * 
 * @param {string} academicYear - Academic year to check (e.g., "2024-25")
 * @returns {boolean} - True if it's the current academic year
 */
export const isCurrentAcademicYear = (academicYear) => {
  return academicYear === getCurrentAcademicYear();
};

/**
 * Convert academic year to full format
 * 
 * @param {string} shortYear - Academic year in short format (e.g., "2024-25")
 * @returns {string} - Academic year in full format (e.g., "2024-2025")
 */
export const academicYearToFull = (shortYear) => {
  if (!shortYear || !shortYear.includes('-')) {
    return shortYear;
  }
  
  const [startYear, endYearShort] = shortYear.split('-');
  const startYearInt = parseInt(startYear);
  const endYear = startYearInt + 1;
  
  return `${startYear}-${endYear}`;
};

/**
 * Get academic year display name
 * 
 * @param {string} academicYear - Academic year (e.g., "2024-25")
 * @returns {string} - Display name (e.g., "Academic Year 2024-25")
 */
export const getAcademicYearDisplayName = (academicYear) => {
  if (!academicYear) {
    return 'Academic Year';
  }
  
  return `Academic Year ${academicYear}`;
};

/**
 * Validate academic year format
 * 
 * @param {string} academicYear - Academic year to validate
 * @returns {boolean} - True if format is valid (YYYY-YY)
 */
export const isValidAcademicYear = (academicYear) => {
  if (!academicYear) return false;
  
  // Check format: YYYY-YY
  const pattern = /^\d{4}-\d{2}$/;
  if (!pattern.test(academicYear)) return false;
  
  // Check that the years are consecutive
  const [startYear, endYearShort] = academicYear.split('-');
  const startYearInt = parseInt(startYear);
  const expectedEndYear = (startYearInt + 1) % 100;
  const actualEndYear = parseInt(endYearShort);
  
  return expectedEndYear === actualEndYear;
};

/**
 * Get the default academic year for receipt generation
 * This tries multiple sources in order of preference:
 * 1. School's configured academic year
 * 2. Current academic year
 * 3. Fallback to current year
 * 
 * @param {Object} schoolDetails - School details object
 * @returns {string} - Academic year to use
 */
export const getReceiptAcademicYear = (schoolDetails) => {
  // Try school's configured academic year first
  if (schoolDetails?.academic_year && isValidAcademicYear(schoolDetails.academic_year)) {
    return schoolDetails.academic_year;
  }
  
  // Fall back to current academic year
  try {
    return getCurrentAcademicYear();
  } catch (error) {
    console.warn('Error getting current academic year:', error);
    // Final fallback to current calendar year
    const currentYear = new Date().getFullYear();
    return `${currentYear}-${String(currentYear + 1).slice(-2)}`;
  }
};

export default {
  getCurrentAcademicYear,
  getNextAcademicYear,
  getPreviousAcademicYear,
  generateAcademicYearList,
  isCurrentAcademicYear,
  academicYearToFull,
  getAcademicYearDisplayName,
  isValidAcademicYear,
  getReceiptAcademicYear
};