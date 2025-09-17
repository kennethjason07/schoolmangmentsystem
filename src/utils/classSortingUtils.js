/**
 * Class Sorting Utilities
 * =======================
 * 
 * Utility functions for sorting classes in natural order (1st, 2nd, 3rd, etc.)
 * instead of alphabetical order.
 */

/**
 * Extract numeric value from class name for sorting
 * @param {string} className - Class name like "1st", "2nd", "10th", etc.
 * @returns {number} - Numeric value for sorting
 */
const extractClassNumber = (className) => {
  if (!className) return 0;
  
  // Extract numeric part from class name
  const match = className.match(/(\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }
  
  // Handle special cases
  const lowerClass = className.toLowerCase();
  if (lowerClass.includes('nursery') || lowerClass.includes('pre')) return -2;
  if (lowerClass.includes('kg') || lowerClass.includes('kindergarten')) return -1;
  if (lowerClass.includes('lkg')) return -1;
  if (lowerClass.includes('ukg')) return 0;
  
  // Default fallback
  return 999;
};

/**
 * Sort classes in natural order (1st, 2nd, 3rd, etc.)
 * @param {Array} classes - Array of class objects with class_name or className property
 * @returns {Array} - Sorted array of classes
 */
export const sortClassesNaturally = (classes) => {
  if (!Array.isArray(classes)) return [];
  
  return [...classes].sort((a, b) => {
    const classNameA = a.class_name || a.className || '';
    const classNameB = b.class_name || b.className || '';
    
    const numA = extractClassNumber(classNameA);
    const numB = extractClassNumber(classNameB);
    
    // Sort by class number first
    if (numA !== numB) {
      return numA - numB;
    }
    
    // If same class number, sort by section
    const sectionA = a.section || '';
    const sectionB = b.section || '';
    
    return sectionA.localeCompare(sectionB);
  });
};

/**
 * Sort fee structures by class order
 * @param {Array} feeStructures - Array of fee structure objects
 * @returns {Array} - Sorted array of fee structures
 */
export const sortFeeStructuresByClass = (feeStructures) => {
  if (!Array.isArray(feeStructures)) return [];
  
  return [...feeStructures].sort((a, b) => {
    const classNameA = a.name || '';
    const classNameB = b.name || '';
    
    const numA = extractClassNumber(classNameA);
    const numB = extractClassNumber(classNameB);
    
    return numA - numB;
  });
};

/**
 * Sort class payment statistics by class order
 * @param {Array} classStats - Array of class statistics objects
 * @returns {Array} - Sorted array of class statistics
 */
export const sortClassStatsByClass = (classStats) => {
  if (!Array.isArray(classStats)) return [];
  
  return [...classStats].sort((a, b) => {
    const classNameA = a.className || '';
    const classNameB = b.className || '';
    
    const numA = extractClassNumber(classNameA);
    const numB = extractClassNumber(classNameB);
    
    return numA - numB;
  });
};

/**
 * Sort class payment statistics by outstanding amount (keeping original behavior)
 * @param {Array} classStats - Array of class statistics objects
 * @returns {Array} - Sorted array of class statistics by outstanding amount
 */
export const sortClassStatsByOutstanding = (classStats) => {
  if (!Array.isArray(classStats)) return [];
  
  return [...classStats].sort((a, b) => b.outstanding - a.outstanding);
};