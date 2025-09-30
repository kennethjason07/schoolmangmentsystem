import { useState, useCallback, useRef } from 'react';

/**
 * Custom hook for intelligent caching of attendance data
 * Provides expiration-based caching with smart invalidation
 */
export const useAttendanceCache = () => {
  const [cache, setCache] = useState(new Map());
  const cacheRef = useRef(new Map()); // Ref for immediate access

  // Default cache duration: 5 minutes
  const DEFAULT_CACHE_DURATION = 5 * 60 * 1000;

  /**
   * Generate cache key for attendance data
   */
  const generateCacheKey = useCallback((type, classId, date, additionalParams = {}) => {
    const params = Object.keys(additionalParams).length > 0 
      ? `_${Object.entries(additionalParams).map(([k, v]) => `${k}:${v}`).join('_')}` 
      : '';
    return `${type}_${classId || 'all'}_${date || 'nodate'}${params}`;
  }, []);

  /**
   * Get cached data if available and not expired
   */
  const getCachedData = useCallback((key, maxAge = DEFAULT_CACHE_DURATION) => {
    const cached = cacheRef.current.get(key);
    
    if (!cached) {
      return null;
    }

    const isExpired = Date.now() - cached.timestamp > maxAge;
    
    if (isExpired) {
      // Remove expired data
      cacheRef.current.delete(key);
      setCache(new Map(cacheRef.current));
      return null;
    }

    console.log(`📦 Cache HIT for key: ${key}`);
    return cached.data;
  }, []);

  /**
   * Set data in cache with timestamp
   */
  const setCachedData = useCallback((key, data) => {
    const cacheEntry = {
      data,
      timestamp: Date.now(),
      key
    };

    cacheRef.current.set(key, cacheEntry);
    setCache(new Map(cacheRef.current));
    
    console.log(`💾 Cache SET for key: ${key}, size: ${cacheRef.current.size}`);
  }, []);

  /**
   * Invalidate specific cache entry
   */
  const invalidateCache = useCallback((key) => {
    if (cacheRef.current.has(key)) {
      cacheRef.current.delete(key);
      setCache(new Map(cacheRef.current));
      console.log(`🗑️ Cache INVALIDATED for key: ${key}`);
    }
  }, []);

  /**
   * Invalidate cache entries matching a pattern
   */
  const invalidateCachePattern = useCallback((pattern) => {
    const regex = new RegExp(pattern);
    let deletedCount = 0;

    for (const [key] of cacheRef.current) {
      if (regex.test(key)) {
        cacheRef.current.delete(key);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      setCache(new Map(cacheRef.current));
      console.log(`🗑️ Cache PATTERN INVALIDATED: ${pattern}, deleted ${deletedCount} entries`);
    }
  }, []);

  /**
   * Clear all cache
   */
  const clearCache = useCallback(() => {
    const size = cacheRef.current.size;
    cacheRef.current.clear();
    setCache(new Map());
    console.log(`🧹 Cache CLEARED: removed ${size} entries`);
  }, []);

  /**
   * Get cache statistics
   */
  const getCacheStats = useCallback(() => {
    const now = Date.now();
    const entries = Array.from(cacheRef.current.values());
    const expired = entries.filter(entry => now - entry.timestamp > DEFAULT_CACHE_DURATION);
    
    return {
      total: cacheRef.current.size,
      expired: expired.length,
      active: cacheRef.current.size - expired.length,
      totalMemory: entries.reduce((acc, entry) => acc + JSON.stringify(entry.data).length, 0)
    };
  }, []);

  /**
   * Clean up expired entries
   */
  const cleanupExpired = useCallback(() => {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of cacheRef.current) {
      if (now - entry.timestamp > DEFAULT_CACHE_DURATION) {
        cacheRef.current.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      setCache(new Map(cacheRef.current));
      console.log(`🧹 Cache CLEANUP: removed ${cleanedCount} expired entries`);
    }

    return cleanedCount;
  }, []);

  /**
   * Specialized methods for attendance data
   */
  const getStudentAttendance = useCallback((classId, date) => {
    const key = generateCacheKey('student_attendance', classId, date);
    return getCachedData(key);
  }, [generateCacheKey, getCachedData]);

  const setStudentAttendance = useCallback((classId, date, data) => {
    const key = generateCacheKey('student_attendance', classId, date);
    setCachedData(key, data);
  }, [generateCacheKey, setCachedData]);

  const getTeacherAttendance = useCallback((date) => {
    const key = generateCacheKey('teacher_attendance', null, date);
    return getCachedData(key);
  }, [generateCacheKey, getCachedData]);

  const setTeacherAttendance = useCallback((date, data) => {
    const key = generateCacheKey('teacher_attendance', null, date);
    setCachedData(key, data);
  }, [generateCacheKey, setCachedData]);

  const getStudentsForClass = useCallback((classId) => {
    const key = generateCacheKey('students_by_class', classId, null);
    return getCachedData(key, 10 * 60 * 1000); // 10 minutes for student list
  }, [generateCacheKey, getCachedData]);

  const setStudentsForClass = useCallback((classId, data) => {
    const key = generateCacheKey('students_by_class', classId, null);
    setCachedData(key, data);
  }, [generateCacheKey, setCachedData]);

  const invalidateStudentAttendance = useCallback((classId, date) => {
    const key = generateCacheKey('student_attendance', classId, date);
    invalidateCache(key);
  }, [generateCacheKey, invalidateCache]);

  const invalidateTeacherAttendance = useCallback((date) => {
    const key = generateCacheKey('teacher_attendance', null, date);
    invalidateCache(key);
  }, [generateCacheKey, invalidateCache]);

  const invalidateStudentsForClass = useCallback((classId) => {
    const key = generateCacheKey('students_by_class', classId, null);
    invalidateCache(key);
  }, [generateCacheKey, invalidateCache]);

  return {
    // Generic cache methods
    getCachedData,
    setCachedData,
    invalidateCache,
    invalidateCachePattern,
    clearCache,
    getCacheStats,
    cleanupExpired,
    generateCacheKey,

    // Specialized attendance methods
    getStudentAttendance,
    setStudentAttendance,
    getTeacherAttendance,
    setTeacherAttendance,
    getStudentsForClass,
    setStudentsForClass,
    invalidateStudentAttendance,
    invalidateTeacherAttendance,
    invalidateStudentsForClass,

    // Cache state for debugging
    cache: cache,
    cacheSize: cache.size
  };
};

export default useAttendanceCache;