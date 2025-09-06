import { debugFeeStructure } from './debugFeeStructure.js';
import { dbHelpers } from './supabase.js';

/**
 * Test runner for fee system verification
 * Execute this script to run comprehensive tests on your fee structure
 */

export const testFeeSystem = {
  /**
   * Run all fee system tests with detailed reporting
   */
  async runAllTests(classId, academicYear = '2024-25') {
    console.log('\n🚀 STARTING COMPLETE FEE SYSTEM VERIFICATION');
    console.log('═'.repeat(60));
    console.log(`Target Class: ${classId}`);
    console.log(`Academic Year: ${academicYear}`);
    console.log('═'.repeat(60));

    const testResults = {
      classId,
      academicYear,
      timestamp: new Date().toISOString(),
      tests: {},
      overallStatus: 'RUNNING',
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        errors: []
      }
    };

    try {
      // Test 1: Basic integrity check
      console.log('\n📋 TEST 1: Basic Fee Structure Integrity Check');
      console.log('-'.repeat(50));
      
      const integrityResult = await debugFeeStructure.quickIntegrityCheck(classId, academicYear);
      testResults.tests.basicIntegrity = {
        name: 'Basic Integrity Check',
        status: integrityResult.error ? 'FAILED' : 'PASSED',
        result: integrityResult,
        timestamp: new Date().toISOString()
      };

      if (integrityResult.error) {
        testResults.summary.errors.push(`Basic integrity check failed: ${integrityResult.error.message}`);
        console.log('❌ Basic integrity check failed, stopping further tests');
        testResults.overallStatus = 'FAILED';
        return testResults;
      }

      // Test 2: Comprehensive fee test
      console.log('\n🧪 TEST 2: Comprehensive Fee Structure Test');
      console.log('-'.repeat(50));

      const comprehensiveResult = await debugFeeStructure.runComprehensiveFeeTest(classId, academicYear);
      testResults.tests.comprehensive = {
        name: 'Comprehensive Fee Test',
        status: comprehensiveResult.error ? 'FAILED' : (comprehensiveResult.report.summary.overallPass ? 'PASSED' : 'FAILED'),
        result: comprehensiveResult,
        timestamp: new Date().toISOString()
      };

      if (comprehensiveResult.error) {
        testResults.summary.errors.push(`Comprehensive test failed: ${comprehensiveResult.error.message}`);
      } else if (!comprehensiveResult.report.summary.overallPass) {
        testResults.summary.errors.push(`Comprehensive test found ${comprehensiveResult.report.issues.length} issues`);
      }

      // Test 3: Multi-student comparison
      console.log('\n👥 TEST 3: Multi-Student Fee Comparison');
      console.log('-'.repeat(50));

      const studentsResult = await dbHelpers.getStudentsByClass(classId);
      if (studentsResult.data && studentsResult.data.length > 1) {
        const studentIds = studentsResult.data.slice(0, 5).map(s => s.id); // Test first 5 students
        
        const comparisonResult = await debugFeeStructure.compareStudentFees(studentIds, classId, academicYear);
        testResults.tests.multiStudent = {
          name: 'Multi-Student Comparison',
          status: comparisonResult.errors ? 'FAILED' : 'PASSED',
          result: comparisonResult,
          timestamp: new Date().toISOString()
        };

        if (comparisonResult.errors) {
          testResults.summary.errors.push(`Multi-student comparison found errors: ${comparisonResult.errors.length} issues`);
        }
      } else {
        testResults.tests.multiStudent = {
          name: 'Multi-Student Comparison',
          status: 'SKIPPED',
          result: { reason: 'Insufficient students in class for comparison' },
          timestamp: new Date().toISOString()
        };
      }

      // Test 4: Individual student fee lookups
      console.log('\n🔍 TEST 4: Individual Student Fee Lookups');
      console.log('-'.repeat(50));

      if (studentsResult.data && studentsResult.data.length > 0) {
        const sampleStudents = studentsResult.data.slice(0, 3); // Test first 3 students
        const lookupResults = [];

        for (const student of sampleStudents) {
          console.log(`\n  Testing student: ${student.name} (ID: ${student.id})`);
          const lookupResult = await debugFeeStructure.testStudentFeeLookup(student.id, classId, academicYear);
          
          lookupResults.push({
            studentId: student.id,
            studentName: student.name,
            status: lookupResult.error ? 'FAILED' : 'PASSED',
            result: lookupResult
          });
        }

        const failedLookups = lookupResults.filter(r => r.status === 'FAILED');
        testResults.tests.individualLookups = {
          name: 'Individual Student Fee Lookups',
          status: failedLookups.length > 0 ? 'FAILED' : 'PASSED',
          result: {
            tested: lookupResults.length,
            passed: lookupResults.length - failedLookups.length,
            failed: failedLookups.length,
            details: lookupResults
          },
          timestamp: new Date().toISOString()
        };

        if (failedLookups.length > 0) {
          testResults.summary.errors.push(`${failedLookups.length} individual fee lookups failed`);
        }
      } else {
        testResults.tests.individualLookups = {
          name: 'Individual Student Fee Lookups',
          status: 'SKIPPED',
          result: { reason: 'No students found in class' },
          timestamp: new Date().toISOString()
        };
      }

      // Calculate overall results
      const completedTests = Object.values(testResults.tests).filter(t => t.status !== 'SKIPPED');
      const passedTests = completedTests.filter(t => t.status === 'PASSED');
      const failedTests = completedTests.filter(t => t.status === 'FAILED');

      testResults.summary = {
        total: completedTests.length,
        passed: passedTests.length,
        failed: failedTests.length,
        skipped: Object.values(testResults.tests).filter(t => t.status === 'SKIPPED').length,
        errors: testResults.summary.errors
      };

      testResults.overallStatus = failedTests.length > 0 ? 'FAILED' : 'PASSED';

      // Generate final report
      this.generateFinalReport(testResults);

      return testResults;

    } catch (error) {
      console.error('❌ Test execution failed:', error);
      testResults.overallStatus = 'ERROR';
      testResults.summary.errors.push(`Test execution error: ${error.message}`);
      return testResults;
    }
  },

  /**
   * Generate and display the final test report
   */
  generateFinalReport(testResults) {
    console.log('\n📊 FINAL TEST REPORT');
    console.log('═'.repeat(60));
    console.log(`Class ID: ${testResults.classId}`);
    console.log(`Academic Year: ${testResults.academicYear}`);
    console.log(`Test Execution Time: ${testResults.timestamp}`);
    console.log(`Overall Status: ${testResults.overallStatus}`);
    console.log('═'.repeat(60));

    // Test summary
    console.log('\n📈 TEST SUMMARY:');
    console.log(`   Total Tests: ${testResults.summary.total}`);
    console.log(`   Passed: ${testResults.summary.passed} ✅`);
    console.log(`   Failed: ${testResults.summary.failed} ❌`);
    console.log(`   Skipped: ${testResults.summary.skipped} ⏭️`);

    // Individual test results
    console.log('\n🔍 INDIVIDUAL TEST RESULTS:');
    Object.entries(testResults.tests).forEach(([key, test]) => {
      const statusIcon = test.status === 'PASSED' ? '✅' : test.status === 'FAILED' ? '❌' : '⏭️';
      console.log(`   ${statusIcon} ${test.name}: ${test.status}`);
    });

    // Error summary
    if (testResults.summary.errors.length > 0) {
      console.log('\n❌ ERRORS FOUND:');
      testResults.summary.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    if (testResults.overallStatus === 'PASSED') {
      console.log('   🎉 All tests passed! Your fee structure is working correctly.');
      console.log('   ✅ Class fees are properly protected from modifications');
      console.log('   ✅ Student-specific fees are correctly created for concessions');
      console.log('   ✅ No double charging detected');
      console.log('   ✅ Fee calculations are accurate');
    } else {
      console.log('   ⚠️  Issues detected in your fee structure. Please review:');
      
      if (testResults.summary.errors.some(e => e.includes('Class fees were modified'))) {
        console.log('   🚨 CRITICAL: Class fees are being modified - this should never happen!');
        console.log('   📝 Action: Check your discount application logic');
      }
      
      if (testResults.summary.errors.some(e => e.includes('Double charging'))) {
        console.log('   🚨 CRITICAL: Double charging detected - students may be charged both class and discounted fees!');
        console.log('   📝 Action: Fix the fee lookup logic to prioritize student-specific fees');
      }
      
      if (testResults.summary.errors.some(e => e.includes('calculation'))) {
        console.log('   ⚠️  Fee calculations are incorrect');
        console.log('   📝 Action: Review discount application mathematics');
      }
      
      console.log('   📋 Next Steps:');
      console.log('     1. Review the detailed test results above');
      console.log('     2. Fix the identified issues');
      console.log('     3. Re-run the tests to verify fixes');
      console.log('     4. Check your fee application and lookup logic');
    }

    console.log('\n🚀 TESTING COMPLETED');
    console.log('═'.repeat(60));
  },

  /**
   * Quick diagnostic for specific issues
   */
  async quickDiagnostic(classId, academicYear = '2024-25') {
    console.log('\n🔧 QUICK DIAGNOSTIC MODE');
    console.log('═'.repeat(40));

    try {
      // Check 1: Do class fees exist?
      console.log('1. Checking class fees existence...');
      const classFees = await debugFeeStructure.snapshotClassFees(classId, academicYear);
      if (classFees.error) {
        console.log('❌ Cannot access class fees:', classFees.error.message);
        return;
      }
      
      if (!classFees.data || classFees.data.length === 0) {
        console.log('❌ No class fees found - you need to create class fees first');
        return;
      }

      console.log(`✅ Found ${classFees.data.length} class fee components`);
      classFees.data.forEach(fee => {
        console.log(`   - ${fee.fee_component}: ₹${fee.amount}`);
      });

      // Check 2: Do students exist?
      console.log('\n2. Checking students in class...');
      const students = await dbHelpers.getStudentsByClass(classId);
      if (students.error) {
        console.log('❌ Cannot access students:', students.error.message);
        return;
      }
      
      if (!students.data || students.data.length === 0) {
        console.log('❌ No students found in class');
        return;
      }

      console.log(`✅ Found ${students.data.length} students in class`);

      // Check 3: Test fee lookup for one student
      console.log('\n3. Testing fee lookup for first student...');
      const firstStudent = students.data[0];
      const feeLookup = await dbHelpers.getStudentApplicableFees(firstStudent.id, classId, academicYear);
      
      if (feeLookup.error) {
        console.log('❌ Fee lookup failed:', feeLookup.error.message);
        return;
      }

      console.log(`✅ Fee lookup successful for ${firstStudent.name}:`);
      let total = 0;
      feeLookup.data.forEach(fee => {
        console.log(`   - ${fee.fee_component}: ₹${fee.amount} (${fee.fee_type})`);
        total += fee.amount;
      });
      console.log(`   Total: ₹${total}`);

      console.log('\n✅ Quick diagnostic completed - basic functionality is working');
      console.log('💡 Run full test suite for comprehensive verification');

    } catch (error) {
      console.error('❌ Diagnostic failed:', error);
    }
  },

  /**
   * Test specific student discount scenario
   */
  async testDiscountScenario(studentId, classId, academicYear = '2024-25', discountAmount = 500) {
    console.log(`\n🎯 TESTING DISCOUNT SCENARIO`);
    console.log(`Student: ${studentId}`);
    console.log(`Discount: ₹${discountAmount}`);
    console.log('-'.repeat(40));

    try {
      // Step 1: Get student fees BEFORE discount
      console.log('1. Getting fees before discount...');
      const feesBefore = await dbHelpers.getStudentApplicableFees(studentId, classId, academicYear);
      if (feesBefore.error) {
        console.log('❌ Failed:', feesBefore.error.message);
        return;
      }

      console.log('✅ Fees before discount:');
      let totalBefore = 0;
      feesBefore.data.forEach(fee => {
        console.log(`   ${fee.fee_component}: ₹${fee.amount} (${fee.fee_type})`);
        totalBefore += fee.amount;
      });
      console.log(`   Total: ₹${totalBefore}`);

      // Step 2: Apply discount
      console.log('\n2. Applying test discount...');
      const discountData = {
        student_id: studentId,
        class_id: classId,
        academic_year: academicYear,
        discount_type: 'fixed_amount',
        discount_value: discountAmount,
        reason: 'TEST_SCENARIO_DISCOUNT'
      };

      const discountResult = await dbHelpers.createStudentDiscount(discountData);
      if (discountResult.error) {
        console.log('❌ Failed to apply discount:', discountResult.error.message);
        return;
      }
      console.log('✅ Discount applied successfully');

      // Step 3: Get student fees AFTER discount
      console.log('\n3. Getting fees after discount...');
      const feesAfter = await dbHelpers.getStudentApplicableFees(studentId, classId, academicYear);
      if (feesAfter.error) {
        console.log('❌ Failed:', feesAfter.error.message);
        return;
      }

      console.log('✅ Fees after discount:');
      let totalAfter = 0;
      feesAfter.data.forEach(fee => {
        console.log(`   ${fee.fee_component}: ₹${fee.amount} (${fee.fee_type})`);
        totalAfter += fee.amount;
      });
      console.log(`   Total: ₹${totalAfter}`);

      // Step 4: Analysis
      console.log('\n4. Analysis:');
      const actualDiscount = totalBefore - totalAfter;
      console.log(`   Expected discount: ₹${discountAmount}`);
      console.log(`   Actual discount: ₹${actualDiscount}`);
      
      if (Math.abs(actualDiscount - discountAmount) < 0.01) {
        console.log('✅ Discount applied correctly');
      } else {
        console.log('❌ Discount calculation error');
      }

      // Step 5: Cleanup
      console.log('\n5. Cleaning up...');
      const cleanup = await dbHelpers.deleteStudentDiscount(discountResult.data.id, true);
      if (cleanup.error) {
        console.log('⚠️ Cleanup failed - you may need to manually remove the test discount');
      } else {
        console.log('✅ Cleanup completed');
      }

      console.log('\n🎯 DISCOUNT SCENARIO TEST COMPLETED');

    } catch (error) {
      console.error('❌ Scenario test failed:', error);
    }
  }
};

export default testFeeSystem;

// Export a convenience function for easy testing
export const runQuickTest = async (classId, academicYear = '2024-25') => {
  return await testFeeSystem.runAllTests(classId, academicYear);
};

export const runDiagnostic = async (classId, academicYear = '2024-25') => {
  return await testFeeSystem.quickDiagnostic(classId, academicYear);
};
