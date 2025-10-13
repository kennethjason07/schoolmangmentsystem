/**
 * 🚀 Leave Management Real-time Optimization Utilities
 * 
 * Performance optimizations for real-time leave application updates:
 * - Debounced processing to prevent excessive re-renders
 * - Minimal payload processing with teacher caching
 * - Memory-efficient state updates
 * - Error recovery and cleanup
 */

import { debounce } from 'lodash';

/**
 * Create optimized real-time update processor with debouncing
 * @param {Function} updateFunction - Function to call with processed payload
 * @param {number} debounceMs - Debounce delay in milliseconds
 * @returns {Function} Debounced processor function
 */
export const createDebouncedProcessor = (updateFunction, debounceMs = 100) => {
  return debounce((payload) => {
    try {
      updateFunction(payload);
    } catch (error) {
      console.error('🚨 Real-time update processing error:', error);
    }
  }, debounceMs, {
    leading: false,
    trailing: true,
    maxWait: debounceMs * 5 // Prevent indefinite delays
  });
};

/**
 * Optimized leave application state update with minimal processing
 * @param {Array} prevApplications - Previous leave applications array
 * @param {Object} payload - Real-time event payload
 * @param {Map} teacherCache - Cached teacher data as Map
 * @returns {Array} Updated applications array
 */
export const processRealtimeUpdateOptimized = (prevApplications, payload, teacherCache) => {
  try {
    const { eventType, new: newRow, old: oldRow } = payload;
    
    // Ensure we have a valid array to work with
    if (!Array.isArray(prevApplications)) {
      console.warn('⚠️ Previous applications is not an array, initializing empty array');
      return [];
    }
    
    // Fast clone for performance
    const applications = [...prevApplications];
    
    switch (eventType) {
      case 'INSERT':
        if (newRow) {
          const optimizedApp = createOptimizedLeaveApplication(newRow, teacherCache);
          // Insert at beginning for latest-first order
          return [optimizedApp, ...applications];
        }
        break;
        
      case 'UPDATE':
        if (newRow) {
          const index = applications.findIndex(app => app.id === newRow.id);
          if (index >= 0) {
            // Merge existing data with new data for efficiency
            applications[index] = {
              ...applications[index],
              ...newRow,
              // Re-enrich only if necessary
              teacher: getTeacherFromCache(newRow.teacher_id, teacherCache) || applications[index].teacher,
              replacement_teacher: newRow.replacement_teacher_id 
                ? getTeacherFromCache(newRow.replacement_teacher_id, teacherCache) 
                : null
            };
          } else {
            // New record, add it
            const optimizedApp = createOptimizedLeaveApplication(newRow, teacherCache);
            applications.unshift(optimizedApp);
          }
          return applications;
        }
        break;
        
      case 'DELETE':
        if (oldRow) {
          return applications.filter(app => app.id !== oldRow.id);
        }
        break;
        
      default:
        console.warn(`⚠️ Unknown real-time event type: ${eventType}`);
        return applications;
    }
    
    return applications;
    
  } catch (error) {
    console.error('🚨 Error processing real-time update:', error);
    // Return previous state on error to prevent crashes
    return prevApplications;
  }
};

/**
 * Create optimized leave application object with minimal teacher enrichment
 * @param {Object} leaveData - Raw leave application data
 * @param {Map} teacherCache - Cached teacher data
 * @returns {Object} Optimized leave application object
 */
const createOptimizedLeaveApplication = (leaveData, teacherCache) => {
  // Calculate total days only if not provided
  let totalDays = leaveData.total_days;
  if (!totalDays && leaveData.start_date && leaveData.end_date) {
    const start = new Date(leaveData.start_date);
    const end = new Date(leaveData.end_date);
    totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  }
  
  return {
    ...leaveData,
    total_days: totalDays,
    teacher: getTeacherFromCache(leaveData.teacher_id, teacherCache),
    replacement_teacher: leaveData.replacement_teacher_id 
      ? getTeacherFromCache(leaveData.replacement_teacher_id, teacherCache) 
      : null
  };
};

/**
 * Fast teacher lookup from cache
 * @param {string} teacherId - Teacher ID to lookup
 * @param {Map} teacherCache - Teacher cache Map
 * @returns {Object|null} Teacher object or null
 */
const getTeacherFromCache = (teacherId, teacherCache) => {
  if (!teacherId || !teacherCache) return null;
  
  const teacher = teacherCache.get(teacherId);
  return teacher ? { id: teacher.id, name: teacher.name } : null;
};

/**
 * Create teacher cache Map for fast lookups
 * @param {Array} teachers - Array of teacher objects
 * @returns {Map} Map with teacherId as key and teacher object as value
 */
export const createTeacherCache = (teachers) => {
  if (!Array.isArray(teachers)) {
    console.warn('⚠️ Teachers is not an array, returning empty Map');
    return new Map();
  }
  
  return new Map(teachers.map(teacher => [teacher.id, teacher]));
};

/**
 * Optimized subscription configuration to prevent excessive re-subscriptions
 * @param {string} tenantId - Tenant ID for filtering
 * @param {Function} onUpdate - Update callback function
 * @returns {Object} Subscription configuration
 */
export const createOptimizedSubscriptionConfig = (tenantId, onUpdate) => {
  return {
    channel: `admin-leave-applications-${tenantId}`,
    event: {
      event: '*',
      schema: 'public',
      table: 'leave_applications',
      filter: `tenant_id=eq.${tenantId}`
    },
    callback: onUpdate
  };
};

/**
 * Cleanup utility for memory management
 * @param {Function} debouncedFunction - Debounced function to cancel
 */
export const cleanupRealtimeProcessor = (debouncedFunction) => {
  try {
    if (debouncedFunction && typeof debouncedFunction.cancel === 'function') {
      debouncedFunction.cancel();
    }
  } catch (error) {
    console.warn('⚠️ Error cleaning up real-time processor:', error);
  }
};

/**
 * Performance monitoring utility
 * @param {string} operation - Operation name
 * @param {Function} fn - Function to monitor
 * @returns {Promise} Function result
 */
export const withPerformanceMonitoring = async (operation, fn) => {
  const startTime = performance.now();
  
  try {
    const result = await fn();
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);
    
    if (duration > 100) {
      console.warn(`⚠️ Slow operation '${operation}': ${duration}ms`);
    } else {
      console.log(`✅ ${operation}: ${duration}ms`);
    }
    
    return result;
  } catch (error) {
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);
    console.error(`🚨 Failed operation '${operation}' after ${duration}ms:`, error);
    throw error;
  }
};

export default {
  createDebouncedProcessor,
  processRealtimeUpdateOptimized,
  createTeacherCache,
  createOptimizedSubscriptionConfig,
  cleanupRealtimeProcessor,
  withPerformanceMonitoring
};