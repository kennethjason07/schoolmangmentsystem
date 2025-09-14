/**
 * 🚀 OPTIMIZED DATA LOADER FOR EXAMS & MARKS
 * Implements parallel queries, pagination, and caching for better performance
 */

import { supabase } from './supabase';
import { createTenantQuery, validateDataTenancy } from './tenantValidation';

/**
 * In-memory cache for frequently accessed data
 */
class DataCache {
  constructor(ttl = 5 * 60 * 1000) { // 5 minutes TTL
    this.cache = new Map();
    this.ttl = ttl;
  }

  set(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  clear() {
    this.cache.clear();
  }

  has(key) {
    return this.get(key) !== null;
  }
}

// Global cache instance
const dataCache = new DataCache();

/**
 * Optimized data loading options
 */
const DEFAULT_OPTIONS = {
  useCache: true,
  loadInBackground: false, // Load non-critical data after initial load
  batchSize: 50,
  priority: {
    exams: 1,      // Load first - needed for UI
    classes: 1,    // Load first - needed for UI
    subjects: 2,   // Load second
    students: 3,   // Load last - largest table
    marks: 3       // Load last - largest table
  }
};

/**
 * Load basic data first for immediate UI display
 */
export const loadCriticalData = async (tenantId, options = {}) => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  try {
    console.log('🚀 LoadCriticalData: Loading essential data for immediate UI...');
    
    // Create cache keys
    const examsCacheKey = `exams_${tenantId}`;
    const classesCacheKey = `classes_${tenantId}`;
    
    // Check cache first
    let examsData = null;
    let classesData = null;
    
    if (opts.useCache) {
      examsData = dataCache.get(examsCacheKey);
      classesData = dataCache.get(classesCacheKey);
      
      if (examsData && classesData) {
        console.log('✅ LoadCriticalData: Retrieved from cache');
        return {
          success: true,
          data: {
            exams: examsData,
            classes: classesData
          },
          fromCache: true
        };
      }
    }
    
    // Load critical data in parallel
    const [examsResult, classesResult] = await Promise.all([
      // Load exams with class information (with limit for performance)
      createTenantQuery(tenantId, 'exams')
        .select(`
          id, 
          name, 
          class_id, 
          academic_year, 
          start_date, 
          end_date, 
          remarks, 
          max_marks,
          tenant_id,
          created_at,
          classes!inner(
            id,
            class_name,
            section
          )
        `)
        .order('created_at', { ascending: false })
        .limit(20) // Limit to recent exams for fast initial load
        .execute(),

      // Load classes (smaller dataset)
      createTenantQuery(tenantId, 'classes')
        .select('id, class_name, section, academic_year, class_teacher_id, tenant_id, created_at')
        .order('class_name')
        .execute()
    ]);

    // Handle errors
    if (examsResult.error) {
      console.error('❌ LoadCriticalData: Exams load failed:', examsResult.error);
      throw new Error(`Failed to load exams: ${examsResult.error.message}`);
    }
    
    if (classesResult.error) {
      console.error('❌ LoadCriticalData: Classes load failed:', classesResult.error);
      throw new Error(`Failed to load classes: ${classesResult.error.message}`);
    }

    // Validate data tenancy
    if (examsResult.data?.length > 0) {
      const isValid = validateDataTenancy(examsResult.data, tenantId, 'ExamsMarks - Critical Exams');
      if (!isValid) {
        throw new Error('Exams data validation failed');
      }
    }
    
    if (classesResult.data?.length > 0) {
      const isValid = validateDataTenancy(classesResult.data, tenantId, 'ExamsMarks - Critical Classes');
      if (!isValid) {
        throw new Error('Classes data validation failed');
      }
    }

    const data = {
      exams: examsResult.data || [],
      classes: classesResult.data || []
    };

    // Cache the results
    if (opts.useCache) {
      dataCache.set(examsCacheKey, data.exams);
      dataCache.set(classesCacheKey, data.classes);
    }

    console.log('✅ LoadCriticalData: Success', {
      exams: data.exams.length,
      classes: data.classes.length
    });

    return {
      success: true,
      data,
      fromCache: false
    };

  } catch (error) {
    console.error('❌ LoadCriticalData: Failed:', error);
    return {
      success: false,
      error: error.message,
      data: null
    };
  }
};

/**
 * Load secondary data (subjects, students preview)
 */
export const loadSecondaryData = async (tenantId, options = {}) => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  try {
    console.log('🚀 LoadSecondaryData: Loading subjects...');
    
    // Cache keys
    const subjectsCacheKey = `subjects_${tenantId}`;
    
    // Check cache first
    if (opts.useCache && dataCache.has(subjectsCacheKey)) {
      const subjectsData = dataCache.get(subjectsCacheKey);
      console.log('✅ LoadSecondaryData: Retrieved subjects from cache');
      return {
        success: true,
        data: { subjects: subjectsData },
        fromCache: true
      };
    }
    
    // Load subjects (moderate dataset)
    const { data: subjectsData, error: subjectsError } = await createTenantQuery(tenantId, 'subjects')
      .select('id, name, class_id, academic_year, is_optional, tenant_id, created_at')
      .order('name')
      .execute();

    if (subjectsError) {
      console.error('❌ LoadSecondaryData: Subjects load failed:', subjectsError);
      throw new Error(`Failed to load subjects: ${subjectsError.message}`);
    }

    // Validate data tenancy
    if (subjectsData?.length > 0) {
      const isValid = validateDataTenancy(subjectsData, tenantId, 'ExamsMarks - Secondary Subjects');
      if (!isValid) {
        throw new Error('Subjects data validation failed');
      }
    }

    const data = { subjects: subjectsData || [] };

    // Cache the results
    if (opts.useCache) {
      dataCache.set(subjectsCacheKey, data.subjects);
    }

    console.log('✅ LoadSecondaryData: Success', {
      subjects: data.subjects.length
    });

    return {
      success: true,
      data,
      fromCache: false
    };

  } catch (error) {
    console.error('❌ LoadSecondaryData: Failed:', error);
    return {
      success: false,
      error: error.message,
      data: null
    };
  }
};

/**
 * Load heavy data with pagination (students, marks)
 */
export const loadHeavyData = async (tenantId, options = {}) => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  try {
    console.log('🚀 LoadHeavyData: Loading students and marks...');
    
    // Cache keys
    const studentsCacheKey = `students_${tenantId}`;
    const marksCacheKey = `marks_recent_${tenantId}`;
    
    // Check cache first
    let studentsData = null;
    let marksData = null;
    
    if (opts.useCache) {
      studentsData = dataCache.get(studentsCacheKey);
      marksData = dataCache.get(marksCacheKey);
      
      if (studentsData && marksData) {
        console.log('✅ LoadHeavyData: Retrieved from cache');
        return {
          success: true,
          data: {
            students: studentsData,
            marks: marksData
          },
          fromCache: true
        };
      }
    }
    
    // Load heavy data with optimizations
    const [studentsResult, marksResult] = await Promise.all([
      // Load students with pagination/limit
      createTenantQuery(tenantId, 'students')
        .select('id, admission_no, name, roll_no, class_id, academic_year, tenant_id, created_at')
        .order('name')
        .limit(500) // Limit initial load
        .execute(),

      // Load only recent marks (last 3 months) for performance
      createTenantQuery(tenantId, 'marks')
        .select('id, student_id, exam_id, subject_id, marks_obtained, grade, max_marks, remarks, tenant_id, created_at')
        .gte('created_at', new Date(Date.now() - 3 * 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 3 months
        .order('created_at', { ascending: false })
        .limit(1000) // Limit marks for performance
        .execute()
    ]);

    // Handle errors
    if (studentsResult.error) {
      console.error('❌ LoadHeavyData: Students load failed:', studentsResult.error);
      throw new Error(`Failed to load students: ${studentsResult.error.message}`);
    }
    
    if (marksResult.error) {
      console.error('❌ LoadHeavyData: Marks load failed:', marksResult.error);
      throw new Error(`Failed to load marks: ${marksResult.error.message}`);
    }

    // Validate data tenancy
    if (studentsResult.data?.length > 0) {
      const isValid = validateDataTenancy(studentsResult.data, tenantId, 'ExamsMarks - Heavy Students');
      if (!isValid) {
        throw new Error('Students data validation failed');
      }
    }
    
    if (marksResult.data?.length > 0) {
      const isValid = validateDataTenancy(marksResult.data, tenantId, 'ExamsMarks - Heavy Marks');
      if (!isValid) {
        throw new Error('Marks data validation failed');
      }
    }

    const data = {
      students: studentsResult.data || [],
      marks: marksResult.data || []
    };

    // Cache the results
    if (opts.useCache) {
      dataCache.set(studentsCacheKey, data.students);
      dataCache.set(marksCacheKey, data.marks);
    }

    console.log('✅ LoadHeavyData: Success', {
      students: data.students.length,
      marks: data.marks.length
    });

    return {
      success: true,
      data,
      fromCache: false
    };

  } catch (error) {
    console.error('❌ LoadHeavyData: Failed:', error);
    return {
      success: false,
      error: error.message,
      data: null
    };
  }
};

/**
 * Progressive data loading - loads data in stages for better UX
 */
export const loadExamsMarksDataProgressive = async (tenantId, callbacks = {}) => {
  const { onCriticalDataLoaded, onSecondaryDataLoaded, onHeavyDataLoaded, onComplete, onError } = callbacks;
  
  console.log('🚀 Starting progressive data loading for ExamsMarks...');
  
  try {
    // Stage 1: Load critical data first (for immediate UI display)
    console.log('📊 Stage 1: Loading critical data...');
    const criticalResult = await loadCriticalData(tenantId);
    
    if (!criticalResult.success) {
      throw new Error(`Critical data load failed: ${criticalResult.error}`);
    }
    
    // Notify UI with critical data
    if (onCriticalDataLoaded) {
      onCriticalDataLoaded(criticalResult.data);
    }
    
    // Stage 2: Load secondary data
    console.log('📊 Stage 2: Loading secondary data...');
    const secondaryResult = await loadSecondaryData(tenantId);
    
    if (!secondaryResult.success) {
      console.warn('⚠️ Secondary data load failed, continuing...', secondaryResult.error);
    }
    
    // Notify UI with secondary data
    if (onSecondaryDataLoaded && secondaryResult.success) {
      onSecondaryDataLoaded(secondaryResult.data);
    }
    
    // Stage 3: Load heavy data in background
    console.log('📊 Stage 3: Loading heavy data...');
    const heavyResult = await loadHeavyData(tenantId);
    
    if (!heavyResult.success) {
      console.warn('⚠️ Heavy data load failed, continuing...', heavyResult.error);
    }
    
    // Notify UI with heavy data
    if (onHeavyDataLoaded && heavyResult.success) {
      onHeavyDataLoaded(heavyResult.data);
    }
    
    // Combine all data
    const allData = {
      ...criticalResult.data,
      ...(secondaryResult.success ? secondaryResult.data : { subjects: [] }),
      ...(heavyResult.success ? heavyResult.data : { students: [], marks: [] })
    };
    
    console.log('✅ Progressive loading complete:', {
      exams: allData.exams?.length || 0,
      classes: allData.classes?.length || 0,
      subjects: allData.subjects?.length || 0,
      students: allData.students?.length || 0,
      marks: allData.marks?.length || 0
    });
    
    if (onComplete) {
      onComplete(allData);
    }
    
    return {
      success: true,
      data: allData
    };
    
  } catch (error) {
    console.error('❌ Progressive loading failed:', error);
    
    if (onError) {
      onError(error.message);
    }
    
    return {
      success: false,
      error: error.message,
      data: null
    };
  }
};

/**
 * Load additional students with pagination
 */
export const loadMoreStudents = async (tenantId, offset = 0, limit = 100) => {
  try {
    console.log('🔄 Loading more students...', { offset, limit });
    
    const { data, error } = await createTenantQuery(tenantId, 'students')
      .select('id, admission_no, name, roll_no, class_id, academic_year, tenant_id, created_at')
      .order('name')
      .range(offset, offset + limit - 1)
      .execute();
      
    if (error) {
      throw new Error(`Failed to load more students: ${error.message}`);
    }
    
    // Validate data tenancy
    if (data?.length > 0) {
      const isValid = validateDataTenancy(data, tenantId, 'ExamsMarks - More Students');
      if (!isValid) {
        throw new Error('Additional students data validation failed');
      }
    }
    
    return {
      success: true,
      data: data || [],
      hasMore: data && data.length === limit
    };
    
  } catch (error) {
    console.error('❌ LoadMoreStudents failed:', error);
    return {
      success: false,
      error: error.message,
      data: [],
      hasMore: false
    };
  }
};

/**
 * Load marks for specific exam
 */
export const loadExamMarks = async (tenantId, examId) => {
  try {
    console.log('📊 Loading marks for exam:', examId);
    
    const { data, error } = await createTenantQuery(tenantId, 'marks')
      .select(`
        id, 
        student_id, 
        exam_id, 
        subject_id, 
        marks_obtained, 
        grade, 
        max_marks, 
        remarks, 
        tenant_id, 
        created_at,
        students!inner(id, name, roll_no),
        subjects!inner(id, name)
      `)
      .eq('exam_id', examId)
      .execute();
      
    if (error) {
      throw new Error(`Failed to load exam marks: ${error.message}`);
    }
    
    // Validate data tenancy
    if (data?.length > 0) {
      const isValid = validateDataTenancy(data, tenantId, 'ExamsMarks - Exam Marks');
      if (!isValid) {
        throw new Error('Exam marks data validation failed');
      }
    }
    
    return {
      success: true,
      data: data || []
    };
    
  } catch (error) {
    console.error('❌ LoadExamMarks failed:', error);
    return {
      success: false,
      error: error.message,
      data: []
    };
  }
};

/**
 * Clear all cached data
 */
export const clearDataCache = () => {
  console.log('🧹 Clearing ExamsMarks data cache...');
  dataCache.clear();
};

/**
 * Performance logging utility
 */
export const logQueryPerformance = (operation, startTime, recordCount = 0) => {
  const duration = Date.now() - startTime;
  const recordsPerSecond = recordCount > 0 ? Math.round(recordCount / (duration / 1000)) : 0;
  
  console.log(`⚡ Performance: ${operation} completed in ${duration}ms`);
  if (recordCount > 0) {
    console.log(`📊 Performance: Processed ${recordCount} records (${recordsPerSecond} records/sec)`);
  }
};

/**
 * Export cache instance for external management
 */
export { dataCache };
