/**
 * 🩺 TENANT & DATA LOADING DIAGNOSTIC TOOL
 * Comprehensive diagnostic utility to troubleshoot tenant context and data fetching issues
 */

import { supabase } from './supabase';
import { validateTenantAccess, createTenantQuery } from './tenantValidation';
import { getCurrentUserTenantByEmail } from './getTenantByEmail';
import { loadCriticalData } from './optimizedDataLoader';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Diagnostic results collector
 */
class DiagnosticResults {
  constructor() {
    this.results = [];
    this.errors = [];
    this.warnings = [];
    this.summary = {
      totalTests: 0,
      passed: 0,
      failed: 0,
      warnings: 0
    };
  }

  addTest(testName, success, message, data = null) {
    const result = {
      test: testName,
      success,
      message,
      data,
      timestamp: new Date().toISOString()
    };

    this.results.push(result);
    this.summary.totalTests++;

    if (success) {
      this.summary.passed++;
      console.log(`✅ ${testName}: ${message}`);
    } else {
      this.summary.failed++;
      this.errors.push(result);
      console.error(`❌ ${testName}: ${message}`);
    }

    if (data) {
      console.log(`📊 ${testName} Data:`, data);
    }
  }

  addWarning(testName, message, data = null) {
    const warning = {
      test: testName,
      message,
      data,
      timestamp: new Date().toISOString()
    };

    this.warnings.push(warning);
    this.summary.warnings++;
    console.warn(`⚠️ ${testName}: ${message}`);

    if (data) {
      console.warn(`📊 ${testName} Data:`, data);
    }
  }

  getReport() {
    return {
      summary: this.summary,
      results: this.results,
      errors: this.errors,
      warnings: this.warnings,
      success: this.summary.failed === 0,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Test authentication and user session
 */
const testAuthentication = async (diagnostics) => {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      diagnostics.addTest(
        'Authentication Check',
        false,
        'No authenticated user found',
        { error: authError?.message }
      );
      return null;
    }

    diagnostics.addTest(
      'Authentication Check',
      true,
      'User is authenticated',
      {
        userId: user.id,
        email: user.email,
        provider: user.app_metadata?.provider,
        lastSignIn: user.last_sign_in_at
      }
    );

    return user;

  } catch (error) {
    diagnostics.addTest(
      'Authentication Check',
      false,
      `Authentication test failed: ${error.message}`
    );
    return null;
  }
};

/**
 * Test user record in database
 */
const testUserRecord = async (diagnostics, user) => {
  if (!user) return null;

  try {
    const { data: userRecord, error } = await supabase
      .from('users')
      .select('id, email, full_name, tenant_id, role, status, created_at')
      .eq('id', user.id)
      .single();

    if (error || !userRecord) {
      diagnostics.addTest(
        'User Record Check',
        false,
        'User record not found in database',
        { error: error?.message }
      );
      return null;
    }

    diagnostics.addTest(
      'User Record Check',
      true,
      'User record found in database',
      {
        tenantId: userRecord.tenant_id,
        role: userRecord.role,
        status: userRecord.status,
        email: userRecord.email
      }
    );

    return userRecord;

  } catch (error) {
    diagnostics.addTest(
      'User Record Check',
      false,
      `User record test failed: ${error.message}`
    );
    return null;
  }
};

/**
 * Test tenant context loading
 */
const testTenantContext = async (diagnostics) => {
  try {
    console.log('🔍 Testing getCurrentUserTenantByEmail...');
    const result = await getCurrentUserTenantByEmail();

    if (!result.success) {
      diagnostics.addTest(
        'Tenant Context Loading',
        false,
        'Tenant context loading failed',
        {
          error: result.error,
          code: result.code,
          isAuthError: result.isAuthError
        }
      );
      return null;
    }

    diagnostics.addTest(
      'Tenant Context Loading',
      true,
      'Tenant context loaded successfully',
      {
        tenantId: result.data.tenant.id,
        tenantName: result.data.tenant.name,
        tenantStatus: result.data.tenant.status,
        userEmail: result.data.userRecord.email
      }
    );

    return result.data;

  } catch (error) {
    diagnostics.addTest(
      'Tenant Context Loading',
      false,
      `Tenant context test failed: ${error.message}`
    );
    return null;
  }
};

/**
 * Test tenant validation
 */
const testTenantValidation = async (diagnostics, user, tenantData) => {
  if (!user || !tenantData) return false;

  try {
    const validation = await validateTenantAccess(
      user.id,
      tenantData.tenant.id,
      'DiagnosticTest'
    );

    if (!validation.isValid) {
      diagnostics.addTest(
        'Tenant Validation',
        false,
        'Tenant validation failed',
        {
          error: validation.error,
          tenantId: tenantData.tenant.id,
          userId: user.id
        }
      );
      return false;
    }

    diagnostics.addTest(
      'Tenant Validation',
      true,
      'Tenant validation passed',
      {
        tenantId: tenantData.tenant.id,
        validatedUserId: user.id
      }
    );

    return true;

  } catch (error) {
    diagnostics.addTest(
      'Tenant Validation',
      false,
      `Tenant validation test failed: ${error.message}`
    );
    return false;
  }
};

/**
 * Test tenant query builder
 */
const testTenantQuery = async (diagnostics, tenantId) => {
  if (!tenantId) return false;

  try {
    // Test basic tenant query creation
    const query = createTenantQuery(tenantId, 'classes');
    
    if (!query) {
      diagnostics.addTest(
        'Tenant Query Builder',
        false,
        'Failed to create tenant query'
      );
      return false;
    }

    diagnostics.addTest(
      'Tenant Query Builder',
      true,
      'Tenant query builder working',
      { tenantId }
    );

    return true;

  } catch (error) {
    diagnostics.addTest(
      'Tenant Query Builder',
      false,
      `Tenant query builder test failed: ${error.message}`
    );
    return false;
  }
};

/**
 * Test data loading for each table
 */
const testDataLoading = async (diagnostics, tenantId) => {
  if (!tenantId) return {};

  const tables = [
    { name: 'classes', fields: 'id, class_name, section, tenant_id' },
    { name: 'exams', fields: 'id, name, class_id, tenant_id, created_at' },
    { name: 'subjects', fields: 'id, name, class_id, tenant_id' },
    { name: 'students', fields: 'id, name, roll_no, class_id, tenant_id' },
    { name: 'marks', fields: 'id, student_id, exam_id, tenant_id' }
  ];

  const results = {};

  for (const table of tables) {
    try {
      console.log(`🔍 Testing data loading for ${table.name}...`);
      
      const { data, error } = await createTenantQuery(tenantId, table.name)
        .select(table.fields)
        .limit(5) // Small sample for testing
        .execute();

      if (error) {
        diagnostics.addTest(
          `${table.name.toUpperCase()} Data Loading`,
          false,
          `Failed to load ${table.name} data`,
          { error: error.message }
        );
        results[table.name] = { success: false, error: error.message, count: 0 };
      } else {
        const count = data ? data.length : 0;
        diagnostics.addTest(
          `${table.name.toUpperCase()} Data Loading`,
          true,
          `Successfully loaded ${count} ${table.name} records`,
          { count, sampleData: data ? data.slice(0, 2) : [] }
        );
        results[table.name] = { success: true, count, data };
      }

    } catch (error) {
      diagnostics.addTest(
        `${table.name.toUpperCase()} Data Loading`,
        false,
        `${table.name} data loading test failed: ${error.message}`
      );
      results[table.name] = { success: false, error: error.message, count: 0 };
    }
  }

  return results;
};

/**
 * Test cached storage
 */
const testCachedStorage = async (diagnostics) => {
  try {
    const cachedTenantId = await AsyncStorage.getItem('currentTenantId');
    
    if (cachedTenantId) {
      diagnostics.addTest(
        'Cached Tenant Storage',
        true,
        'Cached tenant ID found',
        { cachedTenantId }
      );
    } else {
      diagnostics.addWarning(
        'Cached Tenant Storage',
        'No cached tenant ID found - this is normal on first login'
      );
    }

  } catch (error) {
    diagnostics.addTest(
      'Cached Tenant Storage',
      false,
      `Storage test failed: ${error.message}`
    );
  }
};

/**
 * Test optimized data loader
 */
const testOptimizedDataLoader = async (diagnostics, tenantId) => {
  if (!tenantId) return false;

  try {
    console.log('🔍 Testing optimized data loader...');
    
    const result = await loadCriticalData(tenantId);

    if (!result.success) {
      diagnostics.addTest(
        'Optimized Data Loader',
        false,
        'Critical data loading failed',
        { error: result.error }
      );
      return false;
    }

    diagnostics.addTest(
      'Optimized Data Loader',
      true,
      'Critical data loaded successfully',
      {
        examsCount: result.data.exams?.length || 0,
        classesCount: result.data.classes?.length || 0,
        fromCache: result.fromCache
      }
    );

    return true;

  } catch (error) {
    diagnostics.addTest(
      'Optimized Data Loader',
      false,
      `Optimized data loader test failed: ${error.message}`
    );
    return false;
  }
};

/**
 * Main diagnostic runner
 */
export const runTenantDataDiagnostics = async () => {
  console.log('🩺 Starting comprehensive tenant and data loading diagnostics...');
  console.log('🕐 Diagnostic started at:', new Date().toISOString());
  
  const diagnostics = new DiagnosticResults();

  try {
    // Test 1: Authentication
    const user = await testAuthentication(diagnostics);

    // Test 2: User record in database
    const userRecord = await testUserRecord(diagnostics, user);

    // Test 3: Cached storage
    await testCachedStorage(diagnostics);

    // Test 4: Tenant context loading
    const tenantData = await testTenantContext(diagnostics);

    // Test 5: Tenant validation
    const tenantValid = await testTenantValidation(diagnostics, user, tenantData);

    // Test 6: Tenant query builder
    const tenantId = tenantData?.tenant?.id;
    const queryBuilderWorking = await testTenantQuery(diagnostics, tenantId);

    // Test 7: Data loading for each table
    const dataResults = await testDataLoading(diagnostics, tenantId);

    // Test 8: Optimized data loader
    await testOptimizedDataLoader(diagnostics, tenantId);

    // Generate final report
    const report = diagnostics.getReport();
    
    console.log('🩺 DIAGNOSTIC REPORT SUMMARY');
    console.log('=' .repeat(50));
    console.log(`Total Tests: ${report.summary.totalTests}`);
    console.log(`✅ Passed: ${report.summary.passed}`);
    console.log(`❌ Failed: ${report.summary.failed}`);
    console.log(`⚠️ Warnings: ${report.summary.warnings}`);
    console.log(`🎯 Success Rate: ${Math.round((report.summary.passed / report.summary.totalTests) * 100)}%`);
    console.log('=' .repeat(50));

    if (report.errors.length > 0) {
      console.log('🚨 ERRORS FOUND:');
      report.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.test}: ${error.message}`);
      });
      console.log('=' .repeat(50));
    }

    if (report.warnings.length > 0) {
      console.log('⚠️ WARNINGS:');
      report.warnings.forEach((warning, index) => {
        console.log(`${index + 1}. ${warning.test}: ${warning.message}`);
      });
      console.log('=' .repeat(50));
    }

    // Specific recommendations
    console.log('🎯 RECOMMENDATIONS:');
    
    if (!user) {
      console.log('1. User is not authenticated - please log in first');
    } else if (!tenantData) {
      console.log('1. Tenant context is not loading - check TenantProvider setup');
    } else if (!tenantValid) {
      console.log('1. Tenant validation is failing - check user permissions');
    } else if (dataResults.exams && !dataResults.exams.success) {
      console.log('1. Exams data is not loading - check database permissions and table structure');
    } else if (dataResults.exams && dataResults.exams.count === 0) {
      console.log('1. No exams found in database - add some exam data to test with');
    } else {
      console.log('1. All systems appear to be working correctly!');
    }

    console.log('🕐 Diagnostic completed at:', new Date().toISOString());
    
    return report;

  } catch (error) {
    console.error('🚨 Diagnostic runner failed:', error);
    diagnostics.addTest(
      'Diagnostic Runner',
      false,
      `Unexpected error: ${error.message}`
    );
    
    return diagnostics.getReport();
  }
};

/**
 * Quick tenant context check (for use in components)
 */
export const quickTenantCheck = async () => {
  try {
    console.log('🔍 Quick tenant context check...');
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'Not authenticated', step: 'auth' };
    }

    // Check tenant context
    const tenantResult = await getCurrentUserTenantByEmail();
    if (!tenantResult.success) {
      return { 
        success: false, 
        error: tenantResult.error, 
        step: 'tenant_context',
        code: tenantResult.code 
      };
    }

    // Test a simple query
    try {
      const { data } = await createTenantQuery(tenantResult.data.tenant.id, 'classes')
        .select('id')
        .limit(1)
        .execute();
        
      return { 
        success: true, 
        tenantId: tenantResult.data.tenant.id,
        tenantName: tenantResult.data.tenant.name,
        hasData: data && data.length > 0
      };
      
    } catch (queryError) {
      return { 
        success: false, 
        error: `Query test failed: ${queryError.message}`, 
        step: 'query_test',
        tenantId: tenantResult.data.tenant.id 
      };
    }

  } catch (error) {
    return { 
      success: false, 
      error: `Quick check failed: ${error.message}`, 
      step: 'unknown' 
    };
  }
};

/**
 * Monitor tenant context changes (for debugging)
 */
export const createTenantMonitor = (onStateChange) => {
  let previousState = null;
  
  const checkTenantState = async () => {
    try {
      const currentCheck = await quickTenantCheck();
      const currentState = {
        timestamp: new Date().toISOString(),
        ...currentCheck
      };

      // Only log if state changed
      if (JSON.stringify(currentState) !== JSON.stringify(previousState)) {
        console.log('📊 Tenant State Change:', currentState);
        
        if (onStateChange) {
          onStateChange(currentState, previousState);
        }
        
        previousState = currentState;
      }

    } catch (error) {
      console.error('❌ Tenant monitor error:', error);
    }
  };

  // Initial check
  checkTenantState();

  // Set up periodic monitoring
  const interval = setInterval(checkTenantState, 5000); // Check every 5 seconds

  // Return cleanup function
  return () => {
    clearInterval(interval);
    console.log('🔍 Tenant monitor stopped');
  };
};

export default {
  runTenantDataDiagnostics,
  quickTenantCheck,
  createTenantMonitor
};
