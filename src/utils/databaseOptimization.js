/**
 * 🗄️ DATABASE OPTIMIZATION UTILITY
 * Provides SQL commands and utilities for optimizing ExamsMarks performance
 */

/**
 * SQL commands for creating performance indexes
 * Run these in your Supabase SQL Editor for better query performance
 */
export const PERFORMANCE_INDEXES_SQL = `
-- ====================================
-- PERFORMANCE INDEXES FOR EXAMS & MARKS
-- ====================================

-- 🎯 Primary tenant_id indexes (most important for multi-tenant performance)
CREATE INDEX IF NOT EXISTS idx_exams_tenant_id ON exams (tenant_id);
CREATE INDEX IF NOT EXISTS idx_marks_tenant_id ON marks (tenant_id);
CREATE INDEX IF NOT EXISTS idx_classes_tenant_id ON classes (tenant_id);
CREATE INDEX IF NOT EXISTS idx_subjects_tenant_id ON subjects (tenant_id);
CREATE INDEX IF NOT EXISTS idx_students_tenant_id ON students (tenant_id);

-- 🎯 Composite indexes for common query patterns
-- Exams ordered by date for tenant
CREATE INDEX IF NOT EXISTS idx_exams_tenant_date ON exams (tenant_id, created_at DESC);
-- Exams by class and tenant
CREATE INDEX IF NOT EXISTS idx_exams_tenant_class ON exams (tenant_id, class_id);

-- Marks by exam for tenant (for loading specific exam marks)
CREATE INDEX IF NOT EXISTS idx_marks_tenant_exam ON marks (tenant_id, exam_id);
-- Marks by student for tenant (for student reports)
CREATE INDEX IF NOT EXISTS idx_marks_tenant_student ON marks (tenant_id, student_id);
-- Recent marks for performance (last 3 months optimization)
CREATE INDEX IF NOT EXISTS idx_marks_tenant_recent ON marks (tenant_id, created_at DESC) WHERE created_at >= NOW() - INTERVAL '3 months';

-- Students by class for tenant (for class-based queries)
CREATE INDEX IF NOT EXISTS idx_students_tenant_class ON students (tenant_id, class_id);
-- Students ordered by name for tenant (for alphabetical lists)
CREATE INDEX IF NOT EXISTS idx_students_tenant_name ON students (tenant_id, name);

-- Subjects by class for tenant (for subject selection)
CREATE INDEX IF NOT EXISTS idx_subjects_tenant_class ON subjects (tenant_id, class_id);

-- Classes ordered by name for tenant (for class lists)
CREATE INDEX IF NOT EXISTS idx_classes_tenant_name ON classes (tenant_id, class_name);

-- 🎯 Specialized indexes for specific queries
-- Foreign key relationships for efficient joins
CREATE INDEX IF NOT EXISTS idx_marks_student_id ON marks (student_id);
CREATE INDEX IF NOT EXISTS idx_marks_exam_id ON marks (exam_id);
CREATE INDEX IF NOT EXISTS idx_marks_subject_id ON marks (subject_id);
CREATE INDEX IF NOT EXISTS idx_students_class_id ON students (class_id);
CREATE INDEX IF NOT EXISTS idx_subjects_class_id ON subjects (class_id);

-- Performance monitoring (optional)
-- Uncomment the following lines if you want to track index usage
-- SELECT 
--   schemaname, 
--   tablename, 
--   indexname, 
--   idx_scan, 
--   idx_tup_read, 
--   idx_tup_fetch
-- FROM pg_stat_user_indexes 
-- WHERE schemaname = 'public' 
-- AND tablename IN ('exams', 'marks', 'students', 'classes', 'subjects')
-- ORDER BY idx_scan DESC;
`;

/**
 * SQL commands for analyzing query performance
 */
export const PERFORMANCE_ANALYSIS_SQL = `
-- ====================================
-- QUERY PERFORMANCE ANALYSIS
-- ====================================

-- Check current index usage
SELECT 
  schemaname, 
  tablename, 
  indexname, 
  idx_scan as times_used,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('exams', 'marks', 'students', 'classes', 'subjects')
ORDER BY times_used DESC;

-- Check table sizes to understand data volume
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
  pg_stat_get_tuples_returned(c.oid) as tuples_returned,
  pg_stat_get_tuples_fetched(c.oid) as tuples_fetched
FROM pg_tables p
JOIN pg_class c ON c.relname = p.tablename
WHERE schemaname = 'public' 
AND tablename IN ('exams', 'marks', 'students', 'classes', 'subjects');

-- Find slow queries (if pg_stat_statements is enabled)
-- SELECT 
--   query,
--   calls,
--   total_time,
--   mean_time,
--   rows
-- FROM pg_stat_statements
-- WHERE query ILIKE '%exams%' OR query ILIKE '%marks%' OR query ILIKE '%students%'
-- ORDER BY mean_time DESC
-- LIMIT 10;
`;

/**
 * Optimization recommendations based on query patterns
 */
export const OPTIMIZATION_RECOMMENDATIONS = {
  // Critical indexes for multi-tenant performance
  critical: [
    {
      table: 'exams',
      index: 'idx_exams_tenant_id',
      reason: 'Essential for tenant isolation and filtering',
      sql: 'CREATE INDEX IF NOT EXISTS idx_exams_tenant_id ON exams (tenant_id);'
    },
    {
      table: 'marks',
      index: 'idx_marks_tenant_id',
      reason: 'Essential for tenant isolation - marks is typically the largest table',
      sql: 'CREATE INDEX IF NOT EXISTS idx_marks_tenant_id ON marks (tenant_id);'
    },
    {
      table: 'students',
      index: 'idx_students_tenant_id',
      reason: 'Essential for student queries and tenant isolation',
      sql: 'CREATE INDEX IF NOT EXISTS idx_students_tenant_id ON students (tenant_id);'
    }
  ],
  
  // High-impact indexes for common queries
  high_impact: [
    {
      table: 'marks',
      index: 'idx_marks_tenant_exam',
      reason: 'Optimizes loading marks for specific exams',
      sql: 'CREATE INDEX IF NOT EXISTS idx_marks_tenant_exam ON marks (tenant_id, exam_id);'
    },
    {
      table: 'marks',
      index: 'idx_marks_tenant_recent',
      reason: 'Optimizes loading recent marks (last 3 months)',
      sql: 'CREATE INDEX IF NOT EXISTS idx_marks_tenant_recent ON marks (tenant_id, created_at DESC) WHERE created_at >= NOW() - INTERVAL \'3 months\';'
    },
    {
      table: 'students',
      index: 'idx_students_tenant_class',
      reason: 'Optimizes loading students by class',
      sql: 'CREATE INDEX IF NOT EXISTS idx_students_tenant_class ON students (tenant_id, class_id);'
    }
  ],
  
  // Medium-impact indexes for better overall performance
  medium_impact: [
    {
      table: 'exams',
      index: 'idx_exams_tenant_date',
      reason: 'Optimizes loading recent exams first',
      sql: 'CREATE INDEX IF NOT EXISTS idx_exams_tenant_date ON exams (tenant_id, created_at DESC);'
    },
    {
      table: 'subjects',
      index: 'idx_subjects_tenant_class',
      reason: 'Optimizes subject loading by class',
      sql: 'CREATE INDEX IF NOT EXISTS idx_subjects_tenant_class ON subjects (tenant_id, class_id);'
    }
  ]
};

/**
 * Check if required indexes exist in the database
 */
export const checkIndexExists = async (supabase, indexName) => {
  try {
    const { data, error } = await supabase.rpc('check_index_exists', {
      index_name: indexName
    });
    
    if (error) {
      console.warn(`Could not check index ${indexName}:`, error.message);
      return false;
    }
    
    return data || false;
  } catch (error) {
    console.warn(`Error checking index ${indexName}:`, error);
    return false;
  }
};

/**
 * Generate performance report for ExamsMarks tables
 */
export const generatePerformanceReport = async (supabase) => {
  try {
    console.log('📊 Generating database performance report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      tables: {},
      recommendations: [],
      indexStatus: {}
    };
    
    // Check table sizes
    const tables = ['exams', 'marks', 'students', 'classes', 'subjects'];
    
    for (const table of tables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
          
        if (!error) {
          report.tables[table] = {
            recordCount: count,
            size: count > 1000 ? 'large' : count > 100 ? 'medium' : 'small'
          };
        }
      } catch (error) {
        console.warn(`Could not get count for table ${table}:`, error);
        report.tables[table] = { recordCount: 'unknown', size: 'unknown' };
      }
    }
    
    // Generate recommendations based on table sizes
    const marksCount = report.tables.marks?.recordCount || 0;
    const studentsCount = report.tables.students?.recordCount || 0;
    const examsCount = report.tables.exams?.recordCount || 0;
    
    if (marksCount > 1000) {
      report.recommendations.push({
        priority: 'HIGH',
        message: `Marks table has ${marksCount} records. Consider implementing the recent marks index for better performance.`,
        action: 'Run: CREATE INDEX IF NOT EXISTS idx_marks_tenant_recent ON marks (tenant_id, created_at DESC) WHERE created_at >= NOW() - INTERVAL \'3 months\';'
      });
    }
    
    if (studentsCount > 500) {
      report.recommendations.push({
        priority: 'MEDIUM',
        message: `Students table has ${studentsCount} records. Consider implementing pagination or limiting initial load.`,
        action: 'Modify loadHeavyData to use smaller limits or implement lazy loading.'
      });
    }
    
    if (examsCount > 50) {
      report.recommendations.push({
        priority: 'MEDIUM',
        message: `Exams table has ${examsCount} records. The current limit of 20 recent exams should be sufficient.`,
        action: 'Current optimization is appropriate.'
      });
    }
    
    // Add general recommendations
    report.recommendations.push({
      priority: 'CRITICAL',
      message: 'Ensure all tenant_id columns are indexed for multi-tenant performance.',
      action: 'Run the PERFORMANCE_INDEXES_SQL script in Supabase SQL Editor.'
    });
    
    console.log('✅ Performance report generated:', report);
    return report;
    
  } catch (error) {
    console.error('❌ Failed to generate performance report:', error);
    return {
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * SQL function to create for checking index existence
 * Run this in Supabase SQL Editor first
 */
export const CHECK_INDEX_FUNCTION_SQL = `
-- Create function to check if index exists
CREATE OR REPLACE FUNCTION check_index_exists(index_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM pg_indexes 
    WHERE indexname = index_name
  );
END;
$$ LANGUAGE plpgsql;
`;

/**
 * Performance monitoring queries
 */
export const MONITORING_QUERIES = {
  // Check slow queries
  slowQueries: `
    SELECT 
      query,
      calls,
      total_time,
      mean_time,
      rows
    FROM pg_stat_statements
    WHERE query ILIKE '%tenant_id%' 
    ORDER BY mean_time DESC
    LIMIT 10;
  `,
  
  // Check index usage
  indexUsage: `
    SELECT 
      schemaname, 
      tablename, 
      indexname, 
      idx_scan,
      idx_tup_read,
      idx_tup_fetch
    FROM pg_stat_user_indexes 
    WHERE schemaname = 'public' 
    AND tablename IN ('exams', 'marks', 'students', 'classes', 'subjects')
    ORDER BY idx_scan DESC;
  `,
  
  // Check table statistics
  tableStats: `
    SELECT 
      schemaname,
      tablename,
      n_tup_ins as inserts,
      n_tup_upd as updates,
      n_tup_del as deletes,
      n_live_tup as live_tuples,
      n_dead_tup as dead_tuples
    FROM pg_stat_user_tables
    WHERE schemaname = 'public' 
    AND tablename IN ('exams', 'marks', 'students', 'classes', 'subjects');
  `
};

/**
 * Utility to log query performance
 */
export const logQueryPerformance = (queryName, startTime, recordCount = null) => {
  const duration = Date.now() - startTime;
  const performance = duration < 100 ? '🟢 FAST' : duration < 500 ? '🟡 MEDIUM' : '🔴 SLOW';
  
  console.log(`⏱️ ${queryName}: ${duration}ms ${performance}${recordCount ? ` (${recordCount} records)` : ''}`);
  
  // Log slow queries for investigation
  if (duration > 1000) {
    console.warn(`🐌 SLOW QUERY DETECTED: ${queryName} took ${duration}ms. Consider optimization.`);
  }
  
  return { duration, performance: duration < 500 };
};

/**
 * Database maintenance recommendations
 */
export const MAINTENANCE_RECOMMENDATIONS = {
  daily: [
    'Monitor query performance logs',
    'Check for any queries taking > 1 second'
  ],
  
  weekly: [
    'Run ANALYZE on tables with high update frequency',
    'Check index usage statistics',
    'Review slow query logs'
  ],
  
  monthly: [
    'Review table sizes and growth patterns',
    'Consider archiving old marks data',
    'Evaluate need for additional indexes',
    'Run VACUUM ANALYZE on all tables'
  ]
};

export default {
  PERFORMANCE_INDEXES_SQL,
  PERFORMANCE_ANALYSIS_SQL,
  OPTIMIZATION_RECOMMENDATIONS,
  generatePerformanceReport,
  logQueryPerformance,
  MONITORING_QUERIES,
  MAINTENANCE_RECOMMENDATIONS
};
