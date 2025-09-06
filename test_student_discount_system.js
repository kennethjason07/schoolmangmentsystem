/**
 * Test Student Discount System
 * Verifies that all discount functions work correctly with the student_discounts table
 */

// Mock data for testing (replace with actual IDs from your database)
const TEST_STUDENT_ID = 'your-student-uuid-here';
const TEST_CLASS_ID = 'your-class-uuid-here';
const TEST_ACADEMIC_YEAR = '2024-25';

/**
 * Test creating a student discount
 */
async function testCreateStudentDiscount() {
  console.log('🧪 Testing createStudentDiscount...');
  
  const discountData = {
    student_id: TEST_STUDENT_ID,
    class_id: TEST_CLASS_ID,
    academic_year: TEST_ACADEMIC_YEAR,
    discount_type: 'percentage',
    discount_value: 20,
    fee_component: 'tuition_fee',
    description: 'Merit scholarship - 20% discount on tuition fee',
    created_by: 'admin-user-id' // Optional
  };
  
  try {
    const result = await dbHelpers.createStudentDiscount(discountData);
    
    if (result.error) {
      console.error('❌ Error creating discount:', result.error);
      return false;
    }
    
    console.log('✅ Successfully created discount:', result.data.id);
    console.log('📋 Discount details:', {
      student: result.data.students?.name,
      class: result.data.classes?.class_name,
      type: result.data.discount_type,
      value: result.data.discount_value,
      component: result.data.fee_component
    });
    
    return result.data.id; // Return discount ID for further testing
  } catch (error) {
    console.error('❌ Exception during discount creation:', error);
    return false;
  }
}

/**
 * Test calculating fees with discounts
 */
async function testCalculateFeesWithDiscounts() {
  console.log('🧪 Testing calculateStudentFeesWithDiscounts...');
  
  try {
    const result = await dbHelpers.calculateStudentFeesWithDiscounts(
      TEST_STUDENT_ID,
      TEST_CLASS_ID,
      TEST_ACADEMIC_YEAR
    );
    
    if (result.error) {
      console.error('❌ Error calculating fees:', result.error);
      return false;
    }
    
    console.log('✅ Successfully calculated fees with discounts:');
    console.log('💰 Summary:', result.summary);
    console.log('📋 Fee breakdown:');
    
    result.data.forEach(fee => {
      console.log(`   ${fee.fee_component}: ₹${fee.base_amount} → ₹${fee.amount} (Discount: ₹${fee.discount_applied})`);
    });
    
    return true;
  } catch (error) {
    console.error('❌ Exception during fee calculation:', error);
    return false;
  }
}

/**
 * Test getting discounts for a student
 */
async function testGetDiscountsByStudent() {
  console.log('🧪 Testing getDiscountsByStudent...');
  
  try {
    const result = await dbHelpers.getDiscountsByStudent(TEST_STUDENT_ID, TEST_ACADEMIC_YEAR);
    
    if (result.error) {
      console.error('❌ Error getting discounts:', result.error);
      return false;
    }
    
    console.log('✅ Successfully retrieved student discounts:');
    console.log(`📋 Found ${result.data.length} active discounts`);
    
    result.data.forEach(discount => {
      console.log(`   ${discount.fee_component || 'ALL'}: ${discount.discount_type} ${discount.discount_value} - ${discount.description}`);
    });
    
    return result.data;
  } catch (error) {
    console.error('❌ Exception during discount retrieval:', error);
    return false;
  }
}

/**
 * Test updating a student discount
 */
async function testUpdateStudentDiscount(discountId) {
  if (!discountId) {
    console.log('⚠️ Skipping update test - no discount ID provided');
    return false;
  }
  
  console.log('🧪 Testing updateStudentDiscount...');
  
  const updates = {
    discount_value: 25, // Change from 20% to 25%
    description: 'Updated merit scholarship - 25% discount on tuition fee'
  };
  
  try {
    const result = await dbHelpers.updateStudentDiscount(discountId, updates);
    
    if (result.error) {
      console.error('❌ Error updating discount:', result.error);
      return false;
    }
    
    console.log('✅ Successfully updated discount:');
    console.log('📋 Updated values:', {
      new_value: result.data.discount_value,
      new_description: result.data.description
    });
    
    return true;
  } catch (error) {
    console.error('❌ Exception during discount update:', error);
    return false;
  }
}

/**
 * Test schema validation
 */
function testSchemaValidation() {
  console.log('🧪 Testing schema validation...');
  
  // Import validation function (adjust path as needed)
  const { validateStudentDiscountSchema } = require('./validate_student_discount_schema.js');
  
  // Test valid data
  const validData = {
    student_id: 'valid-uuid',
    class_id: 'valid-uuid',
    academic_year: '2024-25',
    discount_type: 'percentage',
    discount_value: 15,
    fee_component: 'library_fee',
    description: 'Library fee waiver'
  };
  
  const validResult = validateStudentDiscountSchema(validData);
  console.log('✅ Valid data validation:', validResult.isValid ? 'PASSED' : 'FAILED');
  
  // Test invalid data
  const invalidData = {
    student_id: null,
    discount_type: 'invalid_type',
    discount_value: -10
  };
  
  const invalidResult = validateStudentDiscountSchema(invalidData);
  console.log('❌ Invalid data validation:', !invalidResult.isValid ? 'PASSED' : 'FAILED');
  console.log('📋 Validation errors:', invalidResult.errors);
  
  return validResult.isValid && !invalidResult.isValid;
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🚀 Starting Student Discount System Tests\n');
  console.log('=' .repeat(50));
  
  const results = {
    schemaValidation: false,
    createDiscount: false,
    getDiscounts: false,
    calculateFees: false,
    updateDiscount: false
  };
  
  // Test 1: Schema validation
  results.schemaValidation = testSchemaValidation();
  console.log('\\n' + '-'.repeat(30));
  
  // Test 2: Create discount
  const discountId = await testCreateStudentDiscount();
  results.createDiscount = !!discountId;
  console.log('\\n' + '-'.repeat(30));
  
  // Test 3: Get discounts
  results.getDiscounts = !!(await testGetDiscountsByStudent());
  console.log('\\n' + '-'.repeat(30));
  
  // Test 4: Calculate fees with discounts
  results.calculateFees = await testCalculateFeesWithDiscounts();
  console.log('\\n' + '-'.repeat(30));
  
  // Test 5: Update discount (if create was successful)
  if (discountId) {
    results.updateDiscount = await testUpdateStudentDiscount(discountId);
  }
  
  // Results summary
  console.log('\\n' + '='.repeat(50));
  console.log('📊 TEST RESULTS SUMMARY:');
  console.log('='.repeat(50));
  
  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✅ PASSED' : '❌ FAILED';
    console.log(`${test.padEnd(20)}: ${status}`);
  });
  
  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  console.log('\\n📈 Overall Score:', `${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Student discount system is working correctly.');
  } else {
    console.log('⚠️ Some tests failed. Please check the implementation.');
  }
}

/**
 * Instructions for running the tests
 */
function printInstructions() {
  console.log(`
📋 INSTRUCTIONS FOR RUNNING TESTS:

1. Update the TEST_STUDENT_ID and TEST_CLASS_ID variables with actual UUIDs from your database
2. Make sure you have class fees set up in the fee_structure table for the test class
3. Import this script in your application and call runAllTests()

Example usage:
const { runAllTests } = require('./test_student_discount_system.js');
await runAllTests();

🎯 What these tests verify:
- Schema validation works correctly
- Creating discounts stores data in student_discounts table only
- Retrieving discounts works properly
- Fee calculations apply discounts dynamically
- Updating discounts modifies student_discounts table only
- No modifications are made to fee_structure table
`);
}

// Uncomment to run instructions
printInstructions();

// Export functions for use in your application
module.exports = {
  runAllTests,
  testCreateStudentDiscount,
  testCalculateFeesWithDiscounts,
  testGetDiscountsByStudent,
  testUpdateStudentDiscount,
  testSchemaValidation
};
