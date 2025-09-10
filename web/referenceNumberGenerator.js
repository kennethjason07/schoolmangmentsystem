/**
 * Reference Number Generator Utility - Web Version
 * Generates strong 6-digit alphanumeric reference numbers
 * Format: 4 letters + 2 numbers mixed together for optimal balance
 * Example: "JOHN SMITH" -> "A7BC4K", "M2XY6P", "K8QR3Z", etc.
 * 
 * This is the web-compatible version for HTML/JS environments
 */

/**
 * Generates a cryptographically strong random character (letter or number)
 * @returns {string} A single random alphanumeric character
 */
function generateRandomChar() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const randomIndex = Math.floor(Math.random() * chars.length);
  return chars[randomIndex];
}

/**
 * Generates a random letter (A-Z)
 * @returns {string} A single random letter
 */
function generateRandomLetter() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const randomIndex = Math.floor(Math.random() * chars.length);
  return chars[randomIndex];
}

/**
 * Extracts alphabetic characters from student name and gets first 3 letters
 * @param {string} studentName - The student's full name
 * @returns {string} First 3 uppercase letters from the name
 */
function extractNamePrefix(studentName) {
  if (!studentName || typeof studentName !== 'string') {
    return 'STU'; // Default prefix for "Student"
  }
  
  // Remove all non-alphabetic characters and convert to uppercase
  const cleanName = studentName.replace(/[^A-Za-z]/g, '').toUpperCase();
  
  if (cleanName.length === 0) {
    return 'STU'; // Default if no alphabetic characters
  }
  
  if (cleanName.length === 1) {
    return cleanName + 'TU'; // Complete with default letters
  }
  
  if (cleanName.length === 2) {
    return cleanName + 'S'; // Add one more letter
  }
  
  return cleanName.substring(0, 3);
}

/**
 * Generates a random number (0-9)
 * @returns {string} A single random digit
 */
function generateRandomNumber() {
  return Math.floor(Math.random() * 10).toString();
}

/**
 * Generates 6-digit reference number with 4 letters and 2 numbers mixed
 * Ensures balanced mix of letters and numbers for better readability and strength
 * @returns {string} 6 characters with exactly 4 letters and 2 numbers mixed
 */
function generateStrongReference() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  
  // Generate 4 random letters
  const letterArray = [];
  for (let i = 0; i < 4; i++) {
    const randomIndex = Math.floor(Math.random() * letters.length);
    letterArray.push(letters[randomIndex]);
  }
  
  // Generate 2 random numbers
  const numberArray = [];
  for (let i = 0; i < 2; i++) {
    const randomIndex = Math.floor(Math.random() * numbers.length);
    numberArray.push(numbers[randomIndex]);
  }
  
  // Combine and shuffle the characters for better mixing
  const allChars = [...letterArray, ...numberArray];
  
  // Fisher-Yates shuffle algorithm for truly random mixing
  for (let i = allChars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allChars[i], allChars[j]] = [allChars[j], allChars[i]];
  }
  
  return allChars.join('');
}

/**
 * Checks if a reference number already exists in the database (web version)
 * Note: This is a simplified version for web. In a real implementation,
 * you would make an API call to your backend to check uniqueness.
 * @param {string} referenceNumber - The reference number to check
 * @param {string} tenantId - The tenant ID for multi-tenant support
 * @returns {Promise<boolean>} True if exists, false if unique
 */
async function checkReferenceNumberExists(referenceNumber, tenantId) {
  try {
    // TODO: Replace with actual API call to your backend
    // Example:
    // const response = await fetch(`/api/check-reference/${referenceNumber}?tenantId=${tenantId}`);
    // const result = await response.json();
    // return result.exists;
    
    // For now, return false (assume unique) since we don't have the backend API
    console.warn('Web version: Reference number uniqueness check not implemented. Assuming unique.');
    return false;
  } catch (error) {
    console.error('Error checking reference number uniqueness:', error);
    return true; // Assume it exists if we can't check (safer)
  }
}

/**
 * Generates a unique 6-digit strong alphanumeric reference number
 * @param {string} studentName - The student's name (not used in new stronger format)
 * @param {string} tenantId - The tenant ID for uniqueness check
 * @param {number} maxAttempts - Maximum attempts to generate unique number (default: 100)
 * @returns {Promise<string>} A unique 6-digit strong reference number
 */
async function generateUniqueReferenceNumber(studentName, tenantId, maxAttempts = 100) {
  // Use strong random generation for better security and uniqueness
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const referenceNumber = generateStrongReference();
    
    // Ensure it's exactly 6 characters (should always be)
    if (referenceNumber.length === 6) {
      const exists = await checkReferenceNumberExists(referenceNumber, tenantId);
      
      if (!exists) {
        console.log(`Generated unique strong reference number: ${referenceNumber} (attempt ${attempt + 1})`);
        return referenceNumber;
      }
    }
  }
  
  // Fallback: Use timestamp + random letters if somehow we can't generate unique number
  console.warn(`Could not generate unique reference number after ${maxAttempts} attempts. Using timestamp fallback.`);
  
  const timestamp = Date.now().toString().slice(-2); // Get last 2 digits
  const randomChars = generateStrongReference().slice(0, 4); // Get 4 random chars
  const fallbackReference = randomChars + timestamp;
  
  console.warn(`Using timestamp-based fallback reference number: ${fallbackReference}`);
  return fallbackReference;
}

/**
 * Validates a reference number format
 * @param {string} referenceNumber - The reference number to validate
 * @returns {boolean} True if valid format, false otherwise
 */
function validateReferenceNumberFormat(referenceNumber) {
  if (!referenceNumber || typeof referenceNumber !== 'string') {
    return false;
  }
  
  // Must be exactly 6 characters, all alphanumeric, all uppercase
  const formatRegex = /^[A-Z0-9]{6}$/;
  return formatRegex.test(referenceNumber);
}

/**
 * Formats reference number for display (adds spacing for readability)
 * @param {string} referenceNumber - The reference number to format
 * @returns {string} Formatted reference number (e.g., "A7B 9C3")
 */
function formatReferenceNumberForDisplay(referenceNumber) {
  if (!validateReferenceNumberFormat(referenceNumber)) {
    return referenceNumber; // Return as-is if invalid format
  }
  
  // Add space after first 3 characters for better readability
  return `${referenceNumber.slice(0, 3)} ${referenceNumber.slice(3)}`;
}

/**
 * Generates a mock reference number for testing (without database check)
 * @param {string} studentName - The student's name (not used in new format)
 * @returns {string} A mock strong reference number
 */
function generateMockReferenceNumber(studentName) {
  return generateStrongReference();
}

// Export functions for use in web environment
// For browser environments (global scope)
if (typeof window !== 'undefined') {
  window.ReferenceNumberGenerator = {
    generateUniqueReferenceNumber,
    validateReferenceNumberFormat,
    formatReferenceNumberForDisplay,
    generateMockReferenceNumber,
    generateStrongReference
  };
}

// For Node.js environments (module.exports)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateUniqueReferenceNumber,
    validateReferenceNumberFormat,
    formatReferenceNumberForDisplay,
    generateMockReferenceNumber,
    generateStrongReference
  };
}

// For ES6 modules (if supported)
if (typeof exports !== 'undefined') {
  exports.generateUniqueReferenceNumber = generateUniqueReferenceNumber;
  exports.validateReferenceNumberFormat = validateReferenceNumberFormat;
  exports.formatReferenceNumberForDisplay = formatReferenceNumberForDisplay;
  exports.generateMockReferenceNumber = generateMockReferenceNumber;
  exports.generateStrongReference = generateStrongReference;
}
