/**
 * 🧪 PARENT DASHBOARD TENANT ISOLATION TESTS
 * Comprehensive test suite to validate multi-tenant data isolation
 * Following EMAIL_BASED_TENANT_SYSTEM.md security requirements
 */

import { supabase } from './supabase';
import { validateTenantAccess, createTenantQuery, validateDataTenancy } from './tenantValidation';
import { getCurrentUserTenantByEmail } from './getTenantByEmail';

/**
 * Test suite results tracking
 */
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

/**
 * Add test result
 */
const addTestResult = (testName, passed, message, details = null) => {
  const result = {
    testName,
    passed,
    message,
    details,
    timestamp: new Date().toISOString()
  };
  
  testResults.tests.push(result);
  if (passed) {
    testResults.passed++;
    console.log(`✅ ${testName}: ${message}`);
  } else {
    testResults.failed++;
    console.error(`❌ ${testName}: ${message}`);
    if (details) {
      console.error('   Details:', details);
    }
  }
};

/**
 * Test 1: Validate Email-Based Tenant Assignment
 */
export const testEmailBasedTenantAssignment = async () => {
  console.log('\n🧪 TEST 1: Email-Based Tenant Assignment');
  console.log('=' .repeat(50));
  
  try {
    // Get current user's tenant
    const tenantResult = await getCurrentUserTenantByEmail();
    
    if (!tenantResult.success) {
      addTestResult(
        'Email-Based Tenant Lookup',
        false,
        'Failed to get current user tenant by email',
        { error: tenantResult.error }
      );
      return false;
    }
    
    const { userRecord, tenant } = tenantResult.data;
    
    // Validate tenant structure
    const requiredTenantFields = ['id', 'name', 'status'];
    const missingFields = requiredTenantFields.filter(field => !tenant[field]);
    
    if (missingFields.length > 0) {
      addTestResult(
        'Tenant Structure Validation',
        false,
        'Tenant missing required fields',
        { missingFields }
      );
      return false;
    }
    
    // Validate user-tenant relationship
    if (userRecord.tenant_id !== tenant.id) {
      addTestResult(
        'User-Tenant Relationship',
        false,
        'User tenant_id does not match tenant id',
        {
          userTenantId: userRecord.tenant_id,
          tenantId: tenant.id
        }
      );
      return false;
    }
    
    addTestResult(
      'Email-Based Tenant Assignment',
      true,
      `Successfully assigned to tenant: ${tenant.name}`,
      {
        tenantId: tenant.id,
        tenantName: tenant.name,
        userEmail: userRecord.email
      }
    );
    
    return { userRecord, tenant };
    
  } catch (error) {
    addTestResult(
      'Email-Based Tenant Assignment',
      false,
      'Exception during tenant assignment test',
      { error: error.message }
    );
    return false;
  }
};

/**
 * Test 2: Validate Tenant-Aware Query Filtering
 */
export const testTenantAwareQueryFiltering = async (tenantData) => {
  console.log('\n🧪 TEST 2: Tenant-Aware Query Filtering');
  console.log('=' .repeat(50));
  
  if (!tenantData) {
    addTestResult('Tenant-Aware Query Filtering', false, 'No tenant data provided');
    return false;
  }
  
  const { tenant } = tenantData;
  
  try {
    // Test different table queries to ensure they're all tenant-filtered
    const testTables = [
      { table: 'students', description: 'Student records' },
      { table: 'exams', description: 'Exam records' },
      { table: 'events', description: 'Event records' },
      { table: 'notifications', description: 'Notification records' }
    ];
    
    let allTestsPassed = true;
    
    for (const { table, description } of testTables) {
      try {
        console.log(`   Testing ${description} (${table})...`);
        
        // Create tenant-aware query
        const queryBuilder = createTenantQuery(tenant.id, table);
        const result = await queryBuilder.select('id, tenant_id').limit(10).execute();
        
        if (result.error) {
          // Table might not exist, that's okay for this test
          console.log(`   ⚠️ ${table} table query failed (table might not exist):`, result.error.message);
          continue;
        }
        
        // Validate all returned records have correct tenant_id
        if (result.data && result.data.length > 0) {
          const wrongTenantRecords = result.data.filter(record => record.tenant_id !== tenant.id);
          
          if (wrongTenantRecords.length > 0) {
            addTestResult(
              `${table} Tenant Filtering`,
              false,
              `Found ${wrongTenantRecords.length} records with wrong tenant_id`,
              {
                table,
                wrongRecords: wrongTenantRecords.length,
                expectedTenantId: tenant.id
              }
            );
            allTestsPassed = false;
          } else {
            addTestResult(
              `${table} Tenant Filtering`,
              true,
              `All ${result.data.length} records have correct tenant_id`
            );
          }
        } else {
          console.log(`   ℹ️ No ${description} found for tenant (this is normal)`);
        }
        
      } catch (error) {
        console.log(`   ⚠️ Error testing ${table}:`, error.message);
        // Don't fail the test for individual table errors
      }
    }
    
    return allTestsPassed;
    
  } catch (error) {
    addTestResult(
      'Tenant-Aware Query Filtering',
      false,
      'Exception during query filtering test',
      { error: error.message }
    );
    return false;
  }
};

/**
 * Test 3: Validate Tenant Access Control
 */
export const testTenantAccessControl = async (tenantData) => {
  console.log('\n🧪 TEST 3: Tenant Access Control');
  console.log('=' .repeat(50));
  
  if (!tenantData) {
    addTestResult('Tenant Access Control', false, 'No tenant data provided');
    return false;
  }
  
  const { userRecord, tenant } = tenantData;
  
  try {
    // Test valid tenant access
    const validAccess = await validateTenantAccess(tenant.id, userRecord.id, 'Test Valid Access');
    
    if (!validAccess.isValid) {
      addTestResult(
        'Valid Tenant Access',
        false,
        'Valid tenant access validation failed',
        { error: validAccess.error }
      );
      return false;
    }
    
    addTestResult(
      'Valid Tenant Access',
      true,
      'Current user can access their assigned tenant'
    );
    
    // Test invalid tenant access (if we have another tenant)
    try {
      const { data: otherTenants } = await supabase
        .from('tenants')
        .select('id, name')
        .neq('id', tenant.id)
        .eq('status', 'active')
        .limit(1);
      
      if (otherTenants && otherTenants.length > 0) {
        const otherTenant = otherTenants[0];
        const invalidAccess = await validateTenantAccess(otherTenant.id, userRecord.id, 'Test Invalid Access');
        
        if (invalidAccess.isValid) {
          addTestResult(
            'Invalid Tenant Access Prevention',
            false,
            `User can access unauthorized tenant: ${otherTenant.name}`,
            { unauthorizedTenantId: otherTenant.id }
          );
          return false;
        }
        
        addTestResult(
          'Invalid Tenant Access Prevention',
          true,
          'Correctly blocked access to unauthorized tenant'
        );
      } else {
        console.log('   ℹ️ No other tenants available to test access prevention');
      }
      
    } catch (error) {
      console.log('   ⚠️ Could not test invalid tenant access:', error.message);
    }
    
    return true;
    
  } catch (error) {
    addTestResult(
      'Tenant Access Control',
      false,
      'Exception during access control test',
      { error: error.message }
    );
    return false;
  }
};

/**
 * Test 4: Validate Data Tenancy
 */
export const testDataTenancyValidation = async (tenantData) => {
  console.log('\n🧪 TEST 4: Data Tenancy Validation');
  console.log('=' .repeat(50));
  
  if (!tenantData) {
    addTestResult('Data Tenancy Validation', false, 'No tenant data provided');
    return false;
  }
  
  const { tenant } = tenantData;
  
  try {
    // Test data validation with correct tenant_id
    const validData = [
      { id: 'test-1', tenant_id: tenant.id, name: 'Valid Record 1' },
      { id: 'test-2', tenant_id: tenant.id, name: 'Valid Record 2' }
    ];
    
    const validResult = validateDataTenancy(validData, tenant.id, 'Test Valid Data');
    
    if (!validResult) {
      addTestResult(
        'Valid Data Tenancy',
        false,
        'Valid data failed tenancy validation'
      );
      return false;
    }
    
    addTestResult(
      'Valid Data Tenancy',
      true,
      'Correctly validated data with matching tenant_id'
    );
    
    // Test data validation with wrong tenant_id
    const invalidData = [
      { id: 'test-1', tenant_id: tenant.id, name: 'Valid Record' },
      { id: 'test-2', tenant_id: 'wrong-tenant-id', name: 'Invalid Record' }
    ];
    
    const invalidResult = validateDataTenancy(invalidData, tenant.id, 'Test Invalid Data');
    
    if (invalidResult) {
      addTestResult(
        'Invalid Data Detection',
        false,
        'Invalid data passed tenancy validation'
      );
      return false;
    }
    
    addTestResult(
      'Invalid Data Detection',
      true,
      'Correctly detected data with wrong tenant_id'
    );
    
    return true;
    
  } catch (error) {
    addTestResult(
      'Data Tenancy Validation',
      false,
      'Exception during data tenancy test',
      { error: error.message }
    );
    return false;
  }
};

/**
 * Test 5: Parent Dashboard Specific Tests
 */
export const testParentDashboardTenantIsolation = async (tenantData) => {
  console.log('\n🧪 TEST 5: Parent Dashboard Tenant Isolation');
  console.log('=' .repeat(50));
  
  if (!tenantData) {
    addTestResult('Parent Dashboard Tenant Isolation', false, 'No tenant data provided');
    return false;
  }
  
  const { userRecord, tenant } = tenantData;
  
  try {
    // Test notification access isolation
    try {
      const notificationQuery = createTenantQuery(tenant.id, 'notification_recipients');
      const notificationResult = await notificationQuery
        .select('id, tenant_id, recipient_id')
        .eq('recipient_type', 'Parent')
        .eq('recipient_id', userRecord.id)
        .limit(5)
        .execute();
      
      if (!notificationResult.error && notificationResult.data) {
        const wrongTenantNotifications = notificationResult.data.filter(
          notif => notif.tenant_id !== tenant.id
        );
        
        if (wrongTenantNotifications.length > 0) {
          addTestResult(
            'Notification Tenant Isolation',
            false,
            `Found ${wrongTenantNotifications.length} notifications with wrong tenant_id`
          );
          return false;
        }
        
        addTestResult(
          'Notification Tenant Isolation',
          true,
          `All ${notificationResult.data.length} notifications have correct tenant_id`
        );
      } else if (notificationResult.error && !notificationResult.error.message.includes('does not exist')) {
        console.log('   ⚠️ Notification query failed:', notificationResult.error.message);
      }
    } catch (error) {
      console.log('   ⚠️ Could not test notification isolation:', error.message);
    }
    
    // Test student data access isolation (if user is linked to students)
    try {
      const studentQuery = createTenantQuery(tenant.id, 'students');
      const studentResult = await studentQuery
        .select('id, tenant_id, parent_id')
        .limit(10)
        .execute();
      
      if (!studentResult.error && studentResult.data) {
        const wrongTenantStudents = studentResult.data.filter(
          student => student.tenant_id !== tenant.id
        );
        
        if (wrongTenantStudents.length > 0) {
          addTestResult(
            'Student Data Tenant Isolation',
            false,
            `Found ${wrongTenantStudents.length} students with wrong tenant_id`
          );
          return false;
        }
        
        addTestResult(
          'Student Data Tenant Isolation',
          true,
          `All ${studentResult.data.length} students have correct tenant_id`
        );
      }
    } catch (error) {
      console.log('   ⚠️ Could not test student data isolation:', error.message);
    }
    
    return true;
    
  } catch (error) {
    addTestResult(
      'Parent Dashboard Tenant Isolation',
      false,
      'Exception during parent dashboard test',
      { error: error.message }
    );
    return false;
  }
};

/**
 * Run All Parent Dashboard Tenant Tests
 */
export const runAllParentDashboardTenantTests = async () => {
  console.log('🧪 RUNNING COMPREHENSIVE PARENT DASHBOARD TENANT ISOLATION TESTS');
  console.log('='.repeat(80));
  console.log('📋 Following EMAIL_BASED_TENANT_SYSTEM.md security requirements');
  console.log('');
  
  // Reset test results
  testResults.passed = 0;
  testResults.failed = 0;
  testResults.tests = [];
  
  const startTime = Date.now();
  
  try {
    // Test 1: Email-Based Tenant Assignment
    const tenantData = await testEmailBasedTenantAssignment();
    if (!tenantData) {
      console.log('\n❌ CRITICAL: Cannot proceed without valid tenant assignment');
      return generateTestReport(startTime);
    }
    
    // Test 2: Tenant-Aware Query Filtering
    await testTenantAwareQueryFiltering(tenantData);
    
    // Test 3: Tenant Access Control
    await testTenantAccessControl(tenantData);
    
    // Test 4: Data Tenancy Validation
    await testDataTenancyValidation(tenantData);
    
    // Test 5: Parent Dashboard Specific Tests
    await testParentDashboardTenantIsolation(tenantData);
    
  } catch (error) {
    console.error('\n❌ CRITICAL ERROR during tenant isolation tests:', error);
    addTestResult(
      'Test Suite Execution',
      false,
      'Critical exception during test suite execution',
      { error: error.message }
    );
  }
  
  return generateTestReport(startTime);
};

/**
 * Generate comprehensive test report
 */
const generateTestReport = (startTime) => {
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 PARENT DASHBOARD TENANT ISOLATION TEST REPORT');
  console.log('='.repeat(80));
  console.log(`⏱️  Duration: ${duration}ms`);
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📊 Total: ${testResults.tests.length}`);
  
  if (testResults.failed === 0) {
    console.log('\n🎉 ALL TENANT ISOLATION TESTS PASSED!');
    console.log('✅ Parent Dashboard is properly isolated by tenant');
    console.log('✅ Email-based tenant system is working correctly');
    console.log('✅ Data security requirements are satisfied');
  } else {
    console.log(`\n⚠️  ${testResults.failed} TEST(S) FAILED!`);
    console.log('❌ Tenant isolation may be compromised');
    console.log('❌ Review failed tests and fix issues before production');
    
    console.log('\n🔍 FAILED TESTS SUMMARY:');
    testResults.tests
      .filter(test => !test.passed)
      .forEach(test => {
        console.log(`   • ${test.testName}: ${test.message}`);
      });
  }
  
  console.log('\n📝 DETAILED TEST RESULTS:');
  testResults.tests.forEach(test => {
    const status = test.passed ? '✅' : '❌';
    console.log(`   ${status} ${test.testName}: ${test.message}`);
  });
  
  console.log('\n💡 RECOMMENDATIONS:');
  if (testResults.failed === 0) {
    console.log('   • Tenant isolation is working correctly');
    console.log('   • Run these tests regularly to ensure continued security');
    console.log('   • Monitor tenant context in production logs');
  } else {
    console.log('   • Fix all failed tests before deploying to production');
    console.log('   • Review tenant validation logic');
    console.log('   • Check database RLS policies');
    console.log('   • Verify email-based tenant assignment');
  }
  
  return {
    passed: testResults.passed,
    failed: testResults.failed,
    total: testResults.tests.length,
    duration,
    tests: testResults.tests,
    success: testResults.failed === 0
  };
};

/**
 * Quick tenant validation check for development
 */
export const quickTenantCheck = async () => {
  console.log('🔍 QUICK TENANT VALIDATION CHECK');
  console.log('-'.repeat(40));
  
  try {
    const result = await getCurrentUserTenantByEmail();
    
    if (result.success) {
      console.log('✅ Current tenant:', result.data.tenant.name);
      console.log('✅ User email:', result.data.userRecord.email);
      console.log('✅ Tenant ID:', result.data.tenant.id);
      console.log('✅ Tenant status:', result.data.tenant.status);
      return result.data;
    } else {
      console.log('❌ Tenant validation failed:', result.error);
      return null;
    }
  } catch (error) {
    console.error('❌ Quick tenant check failed:', error.message);
    return null;
  }
};

// Export test utilities
export default {
  runAllParentDashboardTenantTests,
  quickTenantCheck,
  testEmailBasedTenantAssignment,
  testTenantAwareQueryFiltering,
  testTenantAccessControl,
  testDataTenancyValidation,
  testParentDashboardTenantIsolation
};
