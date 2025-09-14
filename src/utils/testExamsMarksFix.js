/**
 * 🧪 TEST SCRIPT FOR EXAMS MARKS FIXES
 * Validates the tenant context and data loading fixes
 */

import { runTenantDataDiagnostics, quickTenantCheck } from './tenantDataDiagnostic';
import { loadCriticalData } from './optimizedDataLoader';
import { TenantLoadingFallback } from '../components/TenantErrorBoundary';

/**
 * Test the ExamsMarks fixes
 */
export const testExamsMarksFixes = async () => {
  console.log('🧪 Starting ExamsMarks fixes validation...');
  console.log('=' .repeat(60));

  const results = {
    tests: [],
    summary: { passed: 0, failed: 0, total: 0 }
  };

  const addTest = (name, success, message, data = null) => {
    results.tests.push({ name, success, message, data, timestamp: new Date().toISOString() });
    results.summary.total++;
    if (success) {
      results.summary.passed++;
      console.log(`✅ ${name}: ${message}`);
    } else {
      results.summary.failed++;
      console.error(`❌ ${name}: ${message}`);
    }
    if (data) {
      console.log(`📊 Data:`, data);
    }
  };

  try {
    // Test 1: Quick tenant check
    console.log('\n🔍 Test 1: Quick Tenant Check');
    try {
      const quickResult = await quickTenantCheck();
      
      if (quickResult.success) {
        addTest(
          'Quick Tenant Check',
          true,
          'Tenant context is working',
          {
            tenantId: quickResult.tenantId,
            tenantName: quickResult.tenantName,
            hasData: quickResult.hasData
          }
        );
      } else {
        addTest(
          'Quick Tenant Check',
          false,
          `Failed: ${quickResult.error} (step: ${quickResult.step})`
        );
      }
    } catch (error) {
      addTest('Quick Tenant Check', false, `Exception: ${error.message}`);
    }

    // Test 2: Comprehensive diagnostic
    console.log('\n🩺 Test 2: Comprehensive Diagnostic');
    try {
      const diagnosticResult = await runTenantDataDiagnostics();
      
      const successRate = Math.round((diagnosticResult.summary.passed / diagnosticResult.summary.totalTests) * 100);
      
      addTest(
        'Comprehensive Diagnostic',
        diagnosticResult.success,
        `Completed with ${successRate}% success rate`,
        {
          totalTests: diagnosticResult.summary.totalTests,
          passed: diagnosticResult.summary.passed,
          failed: diagnosticResult.summary.failed,
          warnings: diagnosticResult.summary.warnings
        }
      );

      // Check specific critical tests
      const criticalTests = diagnosticResult.results.filter(r => 
        r.test.includes('Authentication') ||
        r.test.includes('Tenant Context') ||
        r.test.includes('EXAMS Data Loading')
      );

      criticalTests.forEach(test => {
        addTest(
          `Critical: ${test.test}`,
          test.success,
          test.message
        );
      });

    } catch (error) {
      addTest('Comprehensive Diagnostic', false, `Exception: ${error.message}`);
    }

    // Test 3: Direct data loading test
    console.log('\n📊 Test 3: Direct Data Loading Test');
    try {
      const quickCheck = await quickTenantCheck();
      
      if (quickCheck.success && quickCheck.tenantId) {
        console.log(`🔄 Testing data loading with tenant ID: ${quickCheck.tenantId}`);
        
        const dataResult = await loadCriticalData(quickCheck.tenantId);
        
        if (dataResult.success) {
          addTest(
            'Critical Data Loading',
            true,
            'Successfully loaded critical data',
            {
              examsCount: dataResult.data.exams?.length || 0,
              classesCount: dataResult.data.classes?.length || 0,
              fromCache: dataResult.fromCache
            }
          );

          // Specific check for exams data
          if (dataResult.data.exams && dataResult.data.exams.length > 0) {
            addTest(
              'Exams Data Available',
              true,
              `Found ${dataResult.data.exams.length} exam records`,
              {
                sampleExam: dataResult.data.exams[0]
              }
            );
          } else {
            addTest(
              'Exams Data Available',
              false,
              'No exam records found in database - this might be expected if no exams have been created yet'
            );
          }

        } else {
          addTest(
            'Critical Data Loading',
            false,
            `Failed to load data: ${dataResult.error}`
          );
        }
      } else {
        addTest(
          'Critical Data Loading',
          false,
          'Cannot test data loading - tenant context not available'
        );
      }

    } catch (error) {
      addTest('Critical Data Loading', false, `Exception: ${error.message}`);
    }

    // Test 4: Error boundary components test
    console.log('\n🛡️ Test 4: Error Boundary Components Test');
    try {
      // Test the TenantLoadingFallback component
      if (TenantLoadingFallback) {
        addTest(
          'Error Boundary Components',
          true,
          'TenantLoadingFallback component is available'
        );
      } else {
        addTest(
          'Error Boundary Components',
          false,
          'TenantLoadingFallback component not found'
        );
      }
      
    } catch (error) {
      addTest('Error Boundary Components', false, `Import error: ${error.message}`);
    }

    // Test 5: Diagnostic tool integration test
    console.log('\n🔧 Test 5: Diagnostic Tool Integration Test');
    try {
      // Test that the diagnostic functions are properly available
      const diagnosticFunctions = {
        runTenantDataDiagnostics: typeof runTenantDataDiagnostics,
        quickTenantCheck: typeof quickTenantCheck
      };

      let functionsAvailable = 0;
      for (const [funcName, funcType] of Object.entries(diagnosticFunctions)) {
        if (funcType === 'function') {
          functionsAvailable++;
        } else {
          console.warn(`Function ${funcName} not available or not a function: ${funcType}`);
        }
      }

      addTest(
        'Diagnostic Tool Integration',
        functionsAvailable === Object.keys(diagnosticFunctions).length,
        `${functionsAvailable}/${Object.keys(diagnosticFunctions).length} diagnostic functions available`
      );

    } catch (error) {
      addTest('Diagnostic Tool Integration', false, `Exception: ${error.message}`);
    }

  } catch (error) {
    console.error('🚨 Test execution failed:', error);
    addTest('Test Execution', false, `Unexpected error: ${error.message}`);
  }

  // Print summary
  console.log('\n' + '=' .repeat(60));
  console.log('🧪 EXAMS MARKS FIXES VALIDATION SUMMARY');
  console.log('=' .repeat(60));
  console.log(`📊 Total Tests: ${results.summary.total}`);
  console.log(`✅ Passed: ${results.summary.passed}`);
  console.log(`❌ Failed: ${results.summary.failed}`);
  console.log(`🎯 Success Rate: ${Math.round((results.summary.passed / results.summary.total) * 100)}%`);
  console.log('=' .repeat(60));

  // Show failed tests
  const failedTests = results.tests.filter(t => !t.success);
  if (failedTests.length > 0) {
    console.log('🚨 FAILED TESTS:');
    failedTests.forEach((test, index) => {
      console.log(`${index + 1}. ${test.name}: ${test.message}`);
    });
    console.log('=' .repeat(60));
  }

  // Recommendations
  console.log('🎯 RECOMMENDATIONS:');
  if (results.summary.failed === 0) {
    console.log('🎉 All tests passed! The ExamsMarks fixes appear to be working correctly.');
    console.log('💡 Next steps:');
    console.log('   1. Test the ExamsMarks screen in the app');
    console.log('   2. Verify that exams data loads properly');
    console.log('   3. Check that error fallback UI appears when expected');
  } else {
    console.log('⚠️ Some tests failed. Please review the errors above and:');
    console.log('   1. Check that you are logged in with a valid account');
    console.log('   2. Verify tenant context is properly initialized');
    console.log('   3. Ensure database connection is working');
    console.log('   4. Check that the tenant has exam data in the database');
  }

  console.log('=' .repeat(60));

  return results;
};

/**
 * Simple test runner that can be called from console or component
 */
export const runExamsMarksFixTest = () => {
  console.log('🚀 Starting ExamsMarks fixes test...');
  
  testExamsMarksFixes()
    .then(results => {
      console.log('✅ Test completed successfully');
      return results;
    })
    .catch(error => {
      console.error('❌ Test failed:', error);
      return { error: error.message };
    });
};

// Auto-run test if this file is imported (commented out by default)
// setTimeout(() => {
//   console.log('🔄 Auto-running ExamsMarks fixes test...');
//   runExamsMarksFixTest();
// }, 2000);

export default {
  testExamsMarksFixes,
  runExamsMarksFixTest
};
