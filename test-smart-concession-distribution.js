/**
 * 🧪 SMART CONCESSION DISTRIBUTION TEST SUITE
 * 
 * This test suite validates the Smart Concession Distribution system with various scenarios:
 * - Basic distribution (₹2000 concession with Term 1: ₹3000, Term 2: ₹7000)
 * - Excess distribution (₹8000 concession with same fee structure)
 * - Edge cases and error handling
 */

import { supabase } from './src/utils/supabase';
import { 
  applySmartConcessionDistribution, 
  previewConcessionDistribution,
  getStudentFeeStructureSorted,
  calculateConcessionDistribution
} from './src/utils/smartConcessionDistribution';

// Test configuration
const TEST_CONFIG = {
  // Replace these with actual IDs from your database
  TEST_STUDENT_ID: 'test-student-id',
  TEST_CLASS_ID: 'test-class-id',
  TEST_ACADEMIC_YEAR: '2024-25',
  
  // Test scenarios
  SCENARIO_1: {
    name: 'Basic Concession Distribution',
    concessionAmount: 2000,
    expectedComponents: 1, // Should only affect Term 2
    description: 'Merit scholarship - basic test'
  },
  
  SCENARIO_2: {
    name: 'Excess Concession Distribution', 
    concessionAmount: 8000,
    expectedComponents: 2, // Should affect both Term 2 (₹7000) and Term 1 (₹1000)
    description: 'Full scholarship - excess test'
  },
  
  SCENARIO_3: {
    name: 'Exact Match Concession',
    concessionAmount: 7000,
    expectedComponents: 1, // Should exactly match Term 2
    description: 'Term 2 fee waiver'
  },
  
  SCENARIO_4: {
    name: 'Small Concession',
    concessionAmount: 500,
    expectedComponents: 1, // Should partially affect Term 2
    description: 'Partial assistance'
  }
};

/**
 * Validate database setup before running tests
 */
const validateDatabaseSetup = async () => {
  console.log('🔍 Validating database setup...');
  
  try {
    // Check if test student exists
    const { data: student } = await supabase
      .from('students')
      .select('id, name, class_id')
      .eq('id', TEST_CONFIG.TEST_STUDENT_ID)
      .single();
    
    if (!student) {
      console.error('❌ Test student not found. Please update TEST_STUDENT_ID in test configuration.');
      return false;
    }
    
    console.log('✅ Test student found:', student.name);
    
    // Check fee structure for test class
    const { data: feeStructure } = await supabase
      .from('fee_structure')
      .select('*')
      .eq('class_id', TEST_CONFIG.TEST_CLASS_ID)
      .is('student_id', null); // Only class-level fees
    
    if (!feeStructure || feeStructure.length === 0) {
      console.error('❌ No fee structure found for test class. Please update TEST_CLASS_ID.');
      return false;
    }
    
    console.log('✅ Fee structure found:');
    feeStructure.forEach((fee, index) => {
      console.log(`   ${index + 1}. ${fee.fee_component}: ₹${fee.amount}`);
    });
    
    return true;
    
  } catch (error) {
    console.error('❌ Database validation failed:', error);
    return false;
  }
};

/**
 * Test the preview functionality
 */
const testPreviewFunctionality = async (scenario) => {
  console.log(`\n🔮 Testing Preview: ${scenario.name}`);
  
  try {
    const previewResult = await previewConcessionDistribution(
      TEST_CONFIG.TEST_STUDENT_ID,
      TEST_CONFIG.TEST_CLASS_ID,
      scenario.concessionAmount,
      TEST_CONFIG.TEST_ACADEMIC_YEAR
    );
    
    if (!previewResult.success) {
      console.error('❌ Preview failed:', previewResult.error);
      return false;
    }
    
    const preview = previewResult.data;
    console.log('📊 Preview Results:');
    console.log(`   Total Requested: ₹${preview.totalConcessionRequested}`);
    console.log(`   Total Applied: ₹${preview.totalConcessionApplied}`);
    console.log(`   Remaining: ₹${preview.remainingConcession}`);
    console.log(`   Components Affected: ${preview.componentsAffected}`);
    
    console.log('📋 Distribution Details:');
    preview.distribution.forEach((dist, index) => {
      console.log(`   ${index + 1}. ${dist.feeComponent}: ₹${dist.concessionAmount} (₹${dist.originalAmount} → ₹${dist.finalAmount})`);
    });
    
    // Validate expected results
    if (preview.componentsAffected !== scenario.expectedComponents) {
      console.error(`❌ Expected ${scenario.expectedComponents} components, got ${preview.componentsAffected}`);
      return false;
    }
    
    console.log('✅ Preview test passed');
    return true;
    
  } catch (error) {
    console.error('❌ Preview test failed:', error);
    return false;
  }
};

/**
 * Test the actual concession application
 */
const testConcessionApplication = async (scenario) => {
  console.log(`\n🎯 Testing Application: ${scenario.name}`);
  
  try {
    // First clean up any existing test discounts
    await cleanupTestDiscounts();
    
    const applicationResult = await applySmartConcessionDistribution(
      TEST_CONFIG.TEST_STUDENT_ID,
      TEST_CONFIG.TEST_CLASS_ID,
      scenario.concessionAmount,
      {
        description: scenario.description,
        academicYear: TEST_CONFIG.TEST_ACADEMIC_YEAR
      }
    );
    
    if (!applicationResult.success) {
      console.error('❌ Application failed:', applicationResult.error);
      return false;
    }
    
    const result = applicationResult.data;
    console.log('🎉 Application Results:');
    console.log(`   Records Created: ${result.summary.recordsCreated}`);
    console.log(`   Total Applied: ₹${result.summary.totalApplied}`);
    console.log(`   Components Affected: ${result.summary.componentsAffected}`);
    
    // Validate database records were created
    const { data: createdDiscounts } = await supabase
      .from('student_discounts')
      .select('*')
      .eq('student_id', TEST_CONFIG.TEST_STUDENT_ID)
      .eq('is_active', true);
    
    console.log(`📝 Database Validation: ${createdDiscounts?.length || 0} records found`);
    
    if (createdDiscounts) {
      createdDiscounts.forEach((discount, index) => {
        console.log(`   ${index + 1}. ${discount.fee_component}: ₹${discount.discount_value}`);
      });
    }
    
    // Validate expected results
    if (result.summary.recordsCreated !== scenario.expectedComponents) {
      console.error(`❌ Expected ${scenario.expectedComponents} records, got ${result.summary.recordsCreated}`);
      return false;
    }
    
    console.log('✅ Application test passed');
    return true;
    
  } catch (error) {
    console.error('❌ Application test failed:', error);
    return false;
  }
};

/**
 * Clean up test discounts
 */
const cleanupTestDiscounts = async () => {
  console.log('🧹 Cleaning up test discounts...');
  
  try {
    const { error } = await supabase
      .from('student_discounts')
      .delete()
      .eq('student_id', TEST_CONFIG.TEST_STUDENT_ID);
    
    if (error) {
      console.warn('⚠️ Cleanup warning:', error);
    } else {
      console.log('✅ Cleanup completed');
    }
  } catch (error) {
    console.warn('⚠️ Cleanup error:', error);
  }
};

/**
 * Test edge cases and error handling
 */
const testEdgeCases = async () => {
  console.log('\n🧪 Testing Edge Cases...');
  
  const edgeTests = [
    {
      name: 'Zero Concession Amount',
      test: async () => {
        const result = await previewConcessionDistribution(
          TEST_CONFIG.TEST_STUDENT_ID,
          TEST_CONFIG.TEST_CLASS_ID,
          0
        );
        return !result.success; // Should fail
      }
    },
    {
      name: 'Negative Concession Amount',
      test: async () => {
        const result = await previewConcessionDistribution(
          TEST_CONFIG.TEST_STUDENT_ID,
          TEST_CONFIG.TEST_CLASS_ID,
          -500
        );
        return !result.success; // Should fail
      }
    },
    {
      name: 'Invalid Student ID',
      test: async () => {
        const result = await previewConcessionDistribution(
          'invalid-student-id',
          TEST_CONFIG.TEST_CLASS_ID,
          1000
        );
        return !result.success; // Should fail
      }
    },
    {
      name: 'Invalid Class ID',
      test: async () => {
        const result = await previewConcessionDistribution(
          TEST_CONFIG.TEST_STUDENT_ID,
          'invalid-class-id',
          1000
        );
        return !result.success; // Should fail
      }
    }
  ];
  
  let passedTests = 0;
  
  for (const edgeTest of edgeTests) {
    try {
      console.log(`   Testing: ${edgeTest.name}`);
      const passed = await edgeTest.test();
      if (passed) {
        console.log('   ✅ Passed');
        passedTests++;
      } else {
        console.log('   ❌ Failed');
      }
    } catch (error) {
      console.log('   ✅ Passed (error caught as expected)');
      passedTests++;
    }
  }
  
  console.log(`🏁 Edge Cases: ${passedTests}/${edgeTests.length} passed`);
  return passedTests === edgeTests.length;
};

/**
 * Main test runner
 */
const runAllTests = async () => {
  console.log('🚀 Starting Smart Concession Distribution Tests...\n');
  
  // Step 1: Validate database setup
  const isValidSetup = await validateDatabaseSetup();
  if (!isValidSetup) {
    console.error('❌ Database setup validation failed. Please fix configuration and try again.');
    return;
  }
  
  let totalTests = 0;
  let passedTests = 0;
  
  // Step 2: Test all scenarios
  for (const [key, scenario] of Object.entries(TEST_CONFIG)) {
    if (key.startsWith('SCENARIO_')) {
      totalTests += 2; // Preview + Application
      
      // Test preview
      const previewPassed = await testPreviewFunctionality(scenario);
      if (previewPassed) passedTests++;
      
      // Test application
      const applicationPassed = await testConcessionApplication(scenario);
      if (applicationPassed) passedTests++;
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Step 3: Test edge cases
  const edgeTestsPassed = await testEdgeCases();
  totalTests += 4; // Number of edge test cases
  if (edgeTestsPassed) passedTests += 4;
  
  // Step 4: Final cleanup
  await cleanupTestDiscounts();
  
  // Test summary
  console.log('\n' + '='.repeat(50));
  console.log('🏁 TEST SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${totalTests - passedTests}`);
  console.log(`Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 ALL TESTS PASSED! Smart Concession Distribution is working correctly.');
  } else {
    console.log('\n⚠️ Some tests failed. Please review the errors above.');
  }
};

/**
 * Quick manual test function for specific scenarios
 */
const quickTest = async (concessionAmount = 2000) => {
  console.log(`🧪 Quick Test: ₹${concessionAmount} concession`);
  
  const result = await previewConcessionDistribution(
    TEST_CONFIG.TEST_STUDENT_ID,
    TEST_CONFIG.TEST_CLASS_ID,
    concessionAmount
  );
  
  if (result.success) {
    console.log('📊 Preview:');
    result.data.distribution.forEach((dist, index) => {
      console.log(`   ${index + 1}. ${dist.feeComponent}: ₹${dist.concessionAmount}`);
    });
  } else {
    console.error('❌ Quick test failed:', result.error);
  }
};

// Export functions for use in Node.js or browser console
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runAllTests,
    quickTest,
    testPreviewFunctionality,
    testConcessionApplication,
    cleanupTestDiscounts
  };
}

// Auto-run if this file is executed directly
if (typeof window === 'undefined' && require.main === module) {
  runAllTests().catch(console.error);
}

console.log(`
📝 SMART CONCESSION DISTRIBUTION TEST SUITE

To run tests:
1. Update TEST_CONFIG with actual student and class IDs
2. Run: node test-smart-concession-distribution.js
3. Or use in browser console: runAllTests()

Quick tests:
- quickTest(2000)  // Test ₹2000 concession
- quickTest(8000)  // Test ₹8000 concession
- quickTest(7000)  // Test ₹7000 concession

Individual functions:
- testPreviewFunctionality()
- testConcessionApplication()
- cleanupTestDiscounts()
`);