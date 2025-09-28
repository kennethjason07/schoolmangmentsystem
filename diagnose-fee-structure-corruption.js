/**
 * 🔍 DIAGNOSTIC SCRIPT: Fee Structure Corruption Analysis
 * 
 * This script investigates why applying concessions to one student (Ishwinder from Class 3A)
 * is causing base fees to become 0 for all students in the class.
 * 
 * The issue indicates that the fee_structure table is being modified incorrectly.
 */

import { supabase } from './src/utils/supabase.js';

console.log('🔍 Starting Fee Structure Corruption Analysis...');

/**
 * Check fee_structure table for corruption patterns
 */
async function diagnoseFeeStructureCorruption() {
  try {
    console.log('\n=== 🔍 ANALYZING FEE STRUCTURE TABLE ===');

    // Step 1: Find Class 3A
    console.log('📋 Finding Class 3A...');
    const { data: class3A, error: classError } = await supabase
      .from('classes')
      .select('*')
      .eq('class_name', '3')
      .eq('section', 'A')
      .single();

    if (classError) {
      console.error('❌ Error finding Class 3A:', classError);
      return;
    }

    if (!class3A) {
      console.error('❌ Class 3A not found');
      return;
    }

    console.log('✅ Found Class 3A:', class3A);

    // Step 2: Check ALL fee_structure records for Class 3A
    console.log('\n📊 Analyzing ALL fee_structure records for Class 3A...');
    const { data: allFees, error: feesError } = await supabase
      .from('fee_structure')
      .select('*')
      .eq('class_id', class3A.id)
      .order('fee_component, student_id');

    if (feesError) {
      console.error('❌ Error fetching fee structure:', feesError);
      return;
    }

    console.log(`📊 Found ${allFees?.length || 0} fee_structure records for Class 3A`);

    // Step 3: Group records by fee_component and student_id
    const feesByComponent = {};
    const classFees = [];
    const studentFees = [];

    allFees.forEach(fee => {
      if (!feesByComponent[fee.fee_component]) {
        feesByComponent[fee.fee_component] = {
          class: null,
          students: []
        };
      }

      if (fee.student_id === null) {
        feesByComponent[fee.fee_component].class = fee;
        classFees.push(fee);
      } else {
        feesByComponent[fee.fee_component].students.push(fee);
        studentFees.push(fee);
      }
    });

    console.log(`📊 Analysis Summary:`);
    console.log(`   Class-level fees: ${classFees.length}`);
    console.log(`   Student-specific fees: ${studentFees.length}`);

    // Step 4: Check for corruption patterns
    console.log('\n🔍 Checking for corruption patterns...');

    let corruptionFound = false;

    Object.keys(feesByComponent).forEach(component => {
      const componentData = feesByComponent[component];
      console.log(`\n📋 Component: ${component}`);

      if (componentData.class) {
        console.log(`   Class fee: ₹${componentData.class.amount} (base: ₹${componentData.class.base_amount || componentData.class.amount})`);
        
        // Check if class fee amount is 0
        if (componentData.class.amount === 0 || componentData.class.amount === '0') {
          console.log('   ❌ CORRUPTION DETECTED: Class fee amount is 0!');
          corruptionFound = true;
        }

        // Check if base_amount is different from amount for class fees
        const baseAmount = componentData.class.base_amount || componentData.class.amount;
        if (baseAmount !== componentData.class.amount) {
          console.log(`   ⚠️ WARNING: base_amount (${baseAmount}) differs from amount (${componentData.class.amount})`);
        }
      } else {
        console.log('   ❌ MISSING: No class-level fee found');
        corruptionFound = true;
      }

      if (componentData.students.length > 0) {
        console.log(`   Student-specific fees: ${componentData.students.length}`);
        componentData.students.forEach(studentFee => {
          console.log(`     Student ${studentFee.student_id}: ₹${studentFee.amount} (base: ₹${studentFee.base_amount || studentFee.amount})`);
        });
        
        // This should not exist in the clean approach
        console.log('   ❌ CORRUPTION DETECTED: Student-specific fee_structure entries found!');
        corruptionFound = true;
      }
    });

    // Step 5: Find Ishwinder's student record
    console.log('\n🔍 Looking for Ishwinder in Class 3A...');
    const { data: ishwinder, error: studentError } = await supabase
      .from('students')
      .select('*')
      .eq('class_id', class3A.id)
      .ilike('name', '%ishwinder%')
      .single();

    if (studentError) {
      console.log('⚠️ Could not find Ishwinder specifically:', studentError.message);
    } else {
      console.log('✅ Found Ishwinder:', ishwinder);

      // Check for concessions applied to Ishwinder
      const { data: ishwinderConcessions, error: concessionError } = await supabase
        .from('student_discounts')
        .select('*')
        .eq('student_id', ishwinder.id)
        .eq('is_active', true);

      if (concessionError) {
        console.log('❌ Error fetching Ishwinder\'s concessions:', concessionError);
      } else {
        console.log(`📊 Ishwinder's active concessions: ${ishwinderConcessions?.length || 0}`);
        ishwinderConcessions?.forEach((concession, index) => {
          console.log(`   ${index + 1}. ${concession.fee_component || 'ALL'}: ${concession.discount_type} ₹${concession.discount_value}`);
        });
      }
    }

    // Step 6: Check all students in Class 3A
    console.log('\n👥 Checking all students in Class 3A...');
    const { data: allStudents, error: allStudentsError } = await supabase
      .from('students')
      .select('id, name, admission_no')
      .eq('class_id', class3A.id)
      .order('name');

    if (allStudentsError) {
      console.log('❌ Error fetching students:', allStudentsError);
    } else {
      console.log(`📊 Total students in Class 3A: ${allStudents?.length || 0}`);
      allStudents?.forEach((student, index) => {
        console.log(`   ${index + 1}. ${student.name} (${student.admission_no})`);
      });
    }

    // Step 7: Final diagnosis
    console.log('\n=== 📋 DIAGNOSIS SUMMARY ===');
    if (corruptionFound) {
      console.log('❌ CORRUPTION CONFIRMED: The fee_structure table has been incorrectly modified');
      console.log('🔧 REQUIRED ACTION: Fix the fee_structure table immediately');
      
      console.log('\n🛠️ RECOMMENDED FIXES:');
      console.log('1. Delete ALL student-specific fee_structure entries (student_id IS NOT NULL)');
      console.log('2. Restore class-level fees to their original amounts');
      console.log('3. Ensure only student_discounts table is used for concessions');
    } else {
      console.log('✅ No corruption detected in fee_structure table');
    }

    return {
      corruptionFound,
      classFees: classFees.length,
      studentFees: studentFees.length,
      class3A,
      ishwinder
    };

  } catch (error) {
    console.error('💥 Unexpected error during diagnosis:', error);
  }
}

/**
 * Generate SQL to fix corrupted fee_structure table
 */
async function generateFixSQL(class3AId) {
  console.log('\n=== 🛠️ GENERATING FIX SQL ===');

  // Check what the original class fees should be
  console.log('📋 Checking for backup or reference fee amounts...');
  
  const fixSQL = `
-- FIX FOR FEE STRUCTURE CORRUPTION
-- Run this SQL in your Supabase dashboard to fix the issue

-- Step 1: Delete ALL student-specific fee_structure entries
DELETE FROM fee_structure 
WHERE student_id IS NOT NULL 
  AND class_id = '${class3AId}';

-- Step 2: Restore class-level fees to proper amounts (UPDATE THESE AMOUNTS BASED ON YOUR ORIGINAL FEE STRUCTURE)
-- You need to check what the original amounts were before the corruption

-- Example: If Term 1 fees were ₹3000 and Term 2 fees were ₹7000
-- UPDATE fee_structure 
-- SET amount = 3000, base_amount = 3000, discount_applied = 0
-- WHERE class_id = '${class3AId}' 
--   AND student_id IS NULL 
--   AND fee_component = 'Term 1 Fees';

-- UPDATE fee_structure 
-- SET amount = 7000, base_amount = 7000, discount_applied = 0
-- WHERE class_id = '${class3AId}' 
--   AND student_id IS NULL 
--   AND fee_component = 'Term 2 Fees';

-- Step 3: Verify the fix
SELECT 
  id, 
  fee_component, 
  amount, 
  base_amount, 
  discount_applied, 
  student_id
FROM fee_structure 
WHERE class_id = '${class3AId}'
ORDER BY fee_component, student_id;

-- Step 4: Check student_discounts table (this should contain the concessions)
SELECT 
  s.name as student_name,
  sd.fee_component,
  sd.discount_type,
  sd.discount_value,
  sd.is_active
FROM student_discounts sd
JOIN students s ON s.id = sd.student_id
WHERE sd.class_id = '${class3AId}' AND sd.is_active = true
ORDER BY s.name, sd.fee_component;
`;

  console.log('📋 Generated Fix SQL:');
  console.log(fixSQL);
  return fixSQL;
}

// Run the diagnosis
diagnoseFeeStructureCorruption().then(async (result) => {
  if (result?.corruptionFound && result?.class3A?.id) {
    await generateFixSQL(result.class3A.id);
  }
  
  console.log('\n🏁 Diagnosis complete. Check the output above for details.');
});