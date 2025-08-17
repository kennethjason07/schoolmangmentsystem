/**
 * Utility functions for handling timestamps and timezone conversion
 */

/**
 * Format a timestamp to local time string
 * @param {string|Date} timestamp - The timestamp to format
 * @param {Object} options - Formatting options
 * @returns {string} Formatted time string in local timezone
 */
export const formatToLocalTime = (timestamp, options = {}) => {
  if (!timestamp) return '';
  
  try {
    let date;
    
    // Normalize timestamp to ensure it's treated as UTC
    if (timestamp.endsWith('Z')) {
      // Already UTC format
      date = new Date(timestamp);
    } else {
      // Treat as UTC by appending 'Z'
      const utcTimestamp = timestamp + 'Z';
      date = new Date(utcTimestamp);
    }
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return '';
    }

    // Convert to IST using native JavaScript timezone support
    const istOptions = {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    };
    
    const result = date.toLocaleString('en-IN', istOptions);
    
    return result;
    
  } catch (error) {
    return '';
  }
};

/**
 * Format a timestamp to local date and time string
 * @param {string|Date} timestamp - The timestamp to format
 * @param {Object} options - Formatting options
 * @returns {string} Formatted date and time string in local timezone
 */
export const formatToLocalDateTime = (timestamp, options = {}) => {
  if (!timestamp) return '';
  
  try {
    const date = new Date(timestamp);
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return '';
    }

    const defaultOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true, // Use 12-hour format with AM/PM
      timeZone: 'Asia/Kolkata' // Explicitly set to IST timezone for Mumbai
    };

    const formatOptions = { ...defaultOptions, ...options };
    
    return date.toLocaleString([], formatOptions);
  } catch (error) {
    return '';
  }
};

/**
 * Get the current local timezone
 * @returns {string} The current timezone identifier
 */
export const getCurrentTimezone = () => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

/**
 * Debug function to log timestamp information
 * @param {string|Date} timestamp - The timestamp to debug
 * @param {string} label - Label for the debug output
 */
export const debugTimestamp = (timestamp, label = 'Timestamp') => {
  // Debug function disabled in production
  return;
};

/**
 * Check if a timestamp is today
 * @param {string|Date} timestamp - The timestamp to check
 * @returns {boolean} True if the timestamp is today
 */
export const isToday = (timestamp) => {
  if (!timestamp) return false;
  
  try {
    const date = new Date(timestamp);
    const today = new Date();
    
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  } catch (error) {
    return false;
  }
};

/**
 * Get relative time string (e.g., "2 hours ago", "Yesterday")
 * @param {string|Date} timestamp - The timestamp to format
 * @returns {string} Relative time string
 */
export const getRelativeTime = (timestamp) => {
  if (!timestamp) return '';
  
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return formatToLocalDateTime(timestamp, { year: 'numeric', month: 'short', day: 'numeric' });
    }
  } catch (error) {
    return '';
  }
};
