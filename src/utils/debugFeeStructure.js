import { dbHelpers } from './supabase.js';

/**
 * Comprehensive debug script for fee structure integrity testing
 * This script verifies that:
 * 1. Class-level fees are never modified when applying discounts
 * 2. Student-specific fees are correctly created for concessions
 * 3. Fee lookup returns the correct fees for each student
 * 4. No duplicate charging (class fee + discounted fee) occurs
 */

export const debugFeeStructure = {
  /**
   * Test the complete fee structure integrity for a class
   */
  async runComprehensiveFeeTest(classId, academicYear = '2024-25', testStudentId = null) {
    console.log('\n🧪 STARTING COMPREHENSIVE FEE STRUCTURE TEST');
    console.log('='.repeat(60));
    console.log(`Class ID: ${classId}`);
    console.log(`Academic Year: ${academicYear}`);
    console.log(`Test Student: ${testStudentId || 'Will use first available student'}`);
    console.log('='.repeat(60));

    const report = {
      classId,
      academicYear,
      testResults: [],
      snapshots: {},
      issues: [],
      summary: {}
    };

    try {
      // Step 1: Initial integrity check
      console.log('\n📊 STEP 1: Initial Fee Structure Analysis');
      const initialIntegrity = await dbHelpers.verifyFeeStructureIntegrity(classId, academicYear);
      if (initialIntegrity.error) {
        console.error('❌ Failed initial integrity check:', initialIntegrity.error);
        return { report, error: initialIntegrity.error };
      }

      report.snapshots.initial = initialIntegrity.data;
      console.log('✅ Initial integrity check completed');

      // Step 2: Get a test student
      let studentToTest = testStudentId;
      if (!studentToTest) {
        console.log('\n👥 STEP 2: Finding test student...');
        const studentsResult = await dbHelpers.getStudentsByClass(classId);
        if (studentsResult.error || !studentsResult.data || studentsResult.data.length === 0) {
          console.error('❌ No students found in class:', classId);
          report.issues.push('No students available for testing');
          return { report, error: new Error('No students found for testing') };
        }
        
        studentToTest = studentsResult.data[0].id;
        console.log(`✅ Selected test student: ${studentsResult.data[0].name} (ID: ${studentToTest})`);
      }

      report.testStudentId = studentToTest;

      // Step 3: Snapshot class fees BEFORE any discount application
      console.log('\n📸 STEP 3: Taking snapshot of class fees BEFORE discount...');
      const classFeesBefore = await this.snapshotClassFees(classId, academicYear);
      if (classFeesBefore.error) {
        console.error('❌ Failed to snapshot class fees:', classFeesBefore.error);
        return { report, error: classFeesBefore.error };
      }

      report.snapshots.classFeesBeforeDiscount = classFeesBefore.data;
      console.log('✅ Class fees snapshot taken:', classFeesBefore.data.length, 'entries');

      // Step 4: Test student's applicable fees BEFORE discount
      console.log('\n🔍 STEP 4: Testing student applicable fees BEFORE discount...');
      const feesBefore = await dbHelpers.getStudentApplicableFees(studentToTest, classId, academicYear);
      if (feesBefore.error) {
        console.error('❌ Failed to get student fees before:', feesBefore.error);
        return { report, error: feesBefore.error };
      }

      report.snapshots.studentFeesBeforeDiscount = feesBefore.data;
      console.log('✅ Student applicable fees before discount:');
      feesBefore.data.forEach(fee => {
        console.log(`   ${fee.fee_component}: ${fee.amount} (${fee.fee_type})`);
      });

      // Step 5: Apply a test discount
      console.log('\n💸 STEP 5: Applying test discount to student...');
      const testDiscount = {
        student_id: studentToTest,
        class_id: classId,
        academic_year: academicYear,
        discount_type: 'fixed_amount',
        discount_value: 500, // Test discount amount
        fee_component: null, // Apply to first component (usually tuition fee)
        reason: 'DEBUG_TEST_DISCOUNT',
        is_active: true
      };

      console.log('📝 Test discount data:', testDiscount);
      
      const discountResult = await dbHelpers.createStudentDiscount(testDiscount);
      if (discountResult.error) {
        console.error('❌ Failed to create test discount:', discountResult.error);
        return { report, error: discountResult.error };
      }

      report.testDiscountId = discountResult.data.id;
      console.log('✅ Test discount created with ID:', discountResult.data.id);

      // Step 6: Snapshot class fees AFTER discount application
      console.log('\n📸 STEP 6: Taking snapshot of class fees AFTER discount...');
      const classFeesAfter = await this.snapshotClassFees(classId, academicYear);
      if (classFeesAfter.error) {
        console.error('❌ Failed to snapshot class fees after:', classFeesAfter.error);
        return { report, error: classFeesAfter.error };
      }

      report.snapshots.classFeesAfterDiscount = classFeesAfter.data;

      // Step 7: Compare class fees before and after (CRITICAL TEST)
      console.log('\n🔍 STEP 7: CRITICAL TEST - Comparing class fees before/after discount...');
      const classFeesComparison = this.compareClassFees(
        report.snapshots.classFeesBeforeDiscount,
        report.snapshots.classFeesAfterDiscount
      );

      report.testResults.push({
        test: 'Class Fees Integrity',
        passed: classFeesComparison.identical,
        details: classFeesComparison
      });

      if (classFeesComparison.identical) {
        console.log('✅ PASSED: Class fees remain unchanged after discount application');
      } else {
        console.log('❌ FAILED: Class fees were modified during discount application!');
        console.log('   Changes detected:');
        classFeesComparison.changes.forEach(change => {
          console.log(`   - ${change}`);
        });
        report.issues.push('Class fees were modified during discount application');
      }

      // Step 8: Test student's applicable fees AFTER discount
      console.log('\n🔍 STEP 8: Testing student applicable fees AFTER discount...');
      const feesAfter = await dbHelpers.getStudentApplicableFees(studentToTest, classId, academicYear);
      if (feesAfter.error) {
        console.error('❌ Failed to get student fees after:', feesAfter.error);
        return { report, error: feesAfter.error };
      }

      report.snapshots.studentFeesAfterDiscount = feesAfter.data;
      console.log('✅ Student applicable fees after discount:');
      feesAfter.data.forEach(fee => {
        console.log(`   ${fee.fee_component}: ${fee.amount} (${fee.fee_type}) - ${fee.applicable_reason}`);
      });

      // Step 9: Verify no double charging
      console.log('\n🔍 STEP 9: Testing for double charging...');
      const doubleChargingTest = this.checkForDoubleCharging(
        report.snapshots.studentFeesBeforeDiscount,
        report.snapshots.studentFeesAfterDiscount
      );

      report.testResults.push({
        test: 'No Double Charging',
        passed: !doubleChargingTest.hasDoubleCharging,
        details: doubleChargingTest
      });

      if (!doubleChargingTest.hasDoubleCharging) {
        console.log('✅ PASSED: No double charging detected');
      } else {
        console.log('❌ FAILED: Double charging detected!');
        console.log('   Issues:');
        doubleChargingTest.issues.forEach(issue => {
          console.log(`   - ${issue}`);
        });
        report.issues.push('Double charging detected');
      }

      // Step 10: Test fee calculations
      console.log('\n🔍 STEP 10: Verifying fee calculations...');
      const calculationTest = this.verifyFeeCalculations(
        report.snapshots.classFeesBeforeDiscount,
        report.snapshots.studentFeesAfterDiscount,
        testDiscount.discount_value
      );

      report.testResults.push({
        test: 'Fee Calculations',
        passed: calculationTest.correct,
        details: calculationTest
      });

      if (calculationTest.correct) {
        console.log('✅ PASSED: Fee calculations are correct');
      } else {
        console.log('❌ FAILED: Fee calculation errors detected!');
        calculationTest.errors.forEach(error => {
          console.log(`   - ${error}`);
        });
        report.issues.push('Fee calculation errors detected');
      }

      // Step 11: Final integrity check
      console.log('\n📊 STEP 11: Final integrity check...');
      const finalIntegrity = await dbHelpers.verifyFeeStructureIntegrity(classId, academicYear);
      if (finalIntegrity.error) {
        console.error('❌ Final integrity check failed:', finalIntegrity.error);
        return { report, error: finalIntegrity.error };
      }

      report.snapshots.final = finalIntegrity.data;

      // Step 12: Cleanup (remove test discount)
      console.log('\n🧹 STEP 12: Cleaning up test discount...');
      const cleanupResult = await dbHelpers.deleteStudentDiscount(report.testDiscountId, true);
      if (cleanupResult.error) {
        console.warn('⚠️ Failed to cleanup test discount:', cleanupResult.error);
        report.issues.push('Failed to cleanup test discount');
      } else {
        console.log('✅ Test discount cleaned up successfully');
      }

      // Generate summary
      report.summary = this.generateTestSummary(report);

      console.log('\n📋 TEST SUMMARY');
      console.log('='.repeat(40));
      console.log(`Total Tests: ${report.testResults.length}`);
      console.log(`Passed: ${report.summary.passedTests}`);
      console.log(`Failed: ${report.summary.failedTests}`);
      console.log(`Issues Found: ${report.issues.length}`);
      
      if (report.summary.overallPass) {
        console.log('🎉 OVERALL RESULT: ✅ ALL TESTS PASSED');
      } else {
        console.log('🚨 OVERALL RESULT: ❌ SOME TESTS FAILED');
        console.log('\nIssues found:');
        report.issues.forEach(issue => console.log(`   - ${issue}`));
      }

      console.log('\n🧪 COMPREHENSIVE FEE STRUCTURE TEST COMPLETED');
      console.log('='.repeat(60));

      return { report, error: null };

    } catch (error) {
      console.error('❌ Test execution failed:', error);
      return { report, error };
    }
  },

  /**
   * Take a snapshot of all class-level fees
   */
  async snapshotClassFees(classId, academicYear) {
    try {
      const { data: fees, error } = await dbHelpers.read(
        'fee_structure',
        { 
          class_id: classId, 
          academic_year: academicYear,
          student_id: null 
        }
      );

      if (error) {
        return { data: null, error };
      }

      // Create a clean snapshot with only relevant fields
      const snapshot = (fees || []).map(fee => ({
        id: fee.id,
        fee_component: fee.fee_component,
        amount: fee.amount,
        student_id: fee.student_id, // Should always be null for class fees
        class_id: fee.class_id,
        academic_year: fee.academic_year
      }));

      return { data: snapshot, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  /**
   * Compare two class fee snapshots to detect unauthorized changes
   */
  compareClassFees(beforeSnapshot, afterSnapshot) {
    const changes = [];
    const beforeMap = new Map();
    const afterMap = new Map();

    // Index the before snapshot
    beforeSnapshot.forEach(fee => {
      beforeMap.set(fee.id, fee);
    });

    // Index the after snapshot
    afterSnapshot.forEach(fee => {
      afterMap.set(fee.id, fee);
    });

    // Check for modified fees
    beforeSnapshot.forEach(beforeFee => {
      const afterFee = afterMap.get(beforeFee.id);
      if (!afterFee) {
        changes.push(`Fee deleted: ${beforeFee.fee_component} (ID: ${beforeFee.id})`);
        return;
      }

      if (beforeFee.amount !== afterFee.amount) {
        changes.push(`Amount changed for ${beforeFee.fee_component}: ${beforeFee.amount} → ${afterFee.amount} (ID: ${beforeFee.id})`);
      }

      if (beforeFee.student_id !== afterFee.student_id) {
        changes.push(`Student ID changed for ${beforeFee.fee_component}: ${beforeFee.student_id} → ${afterFee.student_id} (ID: ${beforeFee.id})`);
      }
    });

    // Check for new fees (shouldn't happen for class fees)
    afterSnapshot.forEach(afterFee => {
      if (!beforeMap.has(afterFee.id)) {
        changes.push(`New fee added: ${afterFee.fee_component} (ID: ${afterFee.id})`);
      }
    });

    return {
      identical: changes.length === 0,
      changes,
      beforeCount: beforeSnapshot.length,
      afterCount: afterSnapshot.length
    };
  },

  /**
   * Check for double charging issues
   */
  checkForDoubleCharging(feesBefore, feesAfter) {
    const issues = [];
    const componentsBefore = new Map();
    const componentsAfter = new Map();

    // Index fees by component
    feesBefore.forEach(fee => {
      if (!componentsBefore.has(fee.fee_component)) {
        componentsBefore.set(fee.fee_component, []);
      }
      componentsBefore.get(fee.fee_component).push(fee);
    });

    feesAfter.forEach(fee => {
      if (!componentsAfter.has(fee.fee_component)) {
        componentsAfter.set(fee.fee_component, []);
      }
      componentsAfter.get(fee.fee_component).push(fee);
    });

    // Check for multiple fees per component (potential double charging)
    componentsAfter.forEach((fees, component) => {
      if (fees.length > 1) {
        issues.push(`Multiple fees found for component ${component}: ${fees.length} entries`);
        fees.forEach(fee => {
          issues.push(`  - ${fee.fee_type}: ${fee.amount}`);
        });
      }
    });

    return {
      hasDoubleCharging: issues.length > 0,
      issues,
      componentAnalysis: {
        beforeComponents: Array.from(componentsBefore.keys()),
        afterComponents: Array.from(componentsAfter.keys())
      }
    };
  },

  /**
   * Verify fee calculations are correct
   */
  verifyFeeCalculations(classFees, studentFees, discountAmount) {
    const errors = [];
    const calculations = [];

    // For each student fee, verify it's correctly calculated from the class fee
    studentFees.forEach(studentFee => {
      if (studentFee.fee_type === 'student_specific') {
        // Find the corresponding class fee
        const classFee = classFees.find(cf => cf.fee_component === studentFee.fee_component);
        
        if (!classFee) {
          errors.push(`No class fee found for student fee component: ${studentFee.fee_component}`);
          return;
        }

        // Check if discount was applied correctly
        const expectedDiscountedAmount = Math.max(0, classFee.amount - discountAmount);
        
        const calculation = {
          component: studentFee.fee_component,
          classAmount: classFee.amount,
          studentAmount: studentFee.amount,
          expectedAmount: expectedDiscountedAmount,
          baseAmount: studentFee.base_amount,
          correct: true
        };

        // Verify the calculation
        if (studentFee.amount !== expectedDiscountedAmount) {
          calculation.correct = false;
          errors.push(
            `Incorrect calculation for ${studentFee.fee_component}: ` +
            `Expected ${expectedDiscountedAmount}, got ${studentFee.amount}`
          );
        }

        // Verify base_amount is preserved
        if (studentFee.base_amount && studentFee.base_amount !== classFee.amount) {
          calculation.correct = false;
          errors.push(
            `Incorrect base_amount for ${studentFee.fee_component}: ` +
            `Expected ${classFee.amount}, got ${studentFee.base_amount}`
          );
        }

        calculations.push(calculation);
      }
    });

    return {
      correct: errors.length === 0,
      errors,
      calculations
    };
  },

  /**
   * Generate test summary
   */
  generateTestSummary(report) {
    const totalTests = report.testResults.length;
    const passedTests = report.testResults.filter(test => test.passed).length;
    const failedTests = totalTests - passedTests;

    return {
      totalTests,
      passedTests,
      failedTests,
      overallPass: failedTests === 0 && report.issues.length === 0,
      issueCount: report.issues.length
    };
  },

  /**
   * Quick integrity check for a class
   */
  async quickIntegrityCheck(classId, academicYear = '2024-25') {
    console.log(`\n🔍 Quick integrity check for class ${classId}, year ${academicYear}`);
    
    const result = await dbHelpers.verifyFeeStructureIntegrity(classId, academicYear);
    if (result.error) {
      console.error('❌ Integrity check failed:', result.error);
      return result;
    }

    const report = result.data;
    console.log('📊 Results:');
    console.log(`   Components: ${report.summary.totalComponents}`);
    console.log(`   Class fees: ${report.summary.classFeesFound}`);
    console.log(`   Student fees: ${report.summary.studentFeesFound}`);
    console.log(`   Issues: ${report.summary.integrityIssues}`);

    if (report.issues.length > 0) {
      console.log('❌ Issues found:');
      report.issues.forEach(issue => console.log(`   - ${issue}`));
    } else {
      console.log('✅ No integrity issues found');
    }

    return result;
  },

  /**
   * Test fee lookup for a specific student
   */
  async testStudentFeeLookup(studentId, classId, academicYear = '2024-25') {
    console.log(`\n👤 Testing fee lookup for student ${studentId}`);
    
    const result = await dbHelpers.getStudentApplicableFees(studentId, classId, academicYear);
    if (result.error) {
      console.error('❌ Fee lookup failed:', result.error);
      return result;
    }

    console.log('📋 Applicable fees:');
    let totalAmount = 0;
    result.data.forEach(fee => {
      console.log(`   ${fee.fee_component}: ₹${fee.amount} (${fee.fee_type})`);
      console.log(`     Reason: ${fee.applicable_reason}`);
      totalAmount += fee.amount;
    });
    
    console.log(`💰 Total: ₹${totalAmount}`);

    return result;
  },

  /**
   * Compare fees for multiple students to detect inconsistencies
   */
  async compareStudentFees(studentIds, classId, academicYear = '2024-25') {
    console.log(`\n👥 Comparing fees for ${studentIds.length} students in class ${classId}`);
    
    const studentFees = {};
    const errors = [];

    // Get fees for each student
    for (const studentId of studentIds) {
      const result = await dbHelpers.getStudentApplicableFees(studentId, classId, academicYear);
      if (result.error) {
        errors.push(`Failed to get fees for student ${studentId}: ${result.error.message}`);
        continue;
      }
      
      studentFees[studentId] = result.data;
    }

    if (errors.length > 0) {
      console.log('❌ Errors occurred:');
      errors.forEach(error => console.log(`   - ${error}`));
    }

    // Analyze fee components across students
    const componentAnalysis = {};
    Object.keys(studentFees).forEach(studentId => {
      studentFees[studentId].forEach(fee => {
        if (!componentAnalysis[fee.fee_component]) {
          componentAnalysis[fee.fee_component] = {
            amounts: [],
            types: [],
            students: []
          };
        }
        
        componentAnalysis[fee.fee_component].amounts.push(fee.amount);
        componentAnalysis[fee.fee_component].types.push(fee.fee_type);
        componentAnalysis[fee.fee_component].students.push(studentId);
      });
    });

    // Report findings
    console.log('📊 Component Analysis:');
    Object.keys(componentAnalysis).forEach(component => {
      const analysis = componentAnalysis[component];
      const uniqueAmounts = [...new Set(analysis.amounts)];
      const uniqueTypes = [...new Set(analysis.types)];
      
      console.log(`   ${component}:`);
      console.log(`     Students: ${analysis.students.length}`);
      console.log(`     Unique amounts: ${uniqueAmounts.join(', ')}`);
      console.log(`     Fee types: ${uniqueTypes.join(', ')}`);
      
      if (uniqueAmounts.length > 1) {
        console.log(`     ⚠️ Variable pricing detected for ${component}`);
      }
    });

    return {
      data: { studentFees, componentAnalysis },
      errors: errors.length > 0 ? errors : null
    };
  }
};

export default debugFeeStructure;
