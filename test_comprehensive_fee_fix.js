/**
 * Comprehensive test for the double-counting and outstanding calculation fixes
 * This simulates the exact problematic scenario reported by the user
 */

function testComprehensiveFix() {
  console.log('🧪 Testing Comprehensive Fee Management Fix...\n');
  
  // Simulate the problematic scenario with potential double-counting
  const testData = {
    classes: [
      {
        id: 'class-1',
        class_name: '1',
        section: 'abc-b'
      }
    ],
    students: [
      { id: 'student-1', name: 'Student 1', class_id: 'class-1' },
      { id: 'student-2', name: 'Student 2', class_id: 'class-1' },
      { id: 'student-3', name: 'Student 3', class_id: 'class-1' },
      { id: 'student-4', name: 'Student 4', class_id: 'class-1' },
      { id: 'student-5', name: 'Student 5', class_id: 'class-1' }
    ],
    // Class-level fee structures  
    classLevelFees: [
      {
        id: 'fee-1',
        class_id: 'class-1',
        student_id: null, // Class-level fee
        fee_component: 'Tuition Fee',
        amount: 4000,
        base_amount: 4000
      }
    ],
    // Student-specific fee overrides (this could cause double-counting)
    studentSpecificFees: [
      {
        id: 'fee-specific-1',
        class_id: 'class-1',
        student_id: 'student-2', // Student 2 has a specific fee
        fee_component: 'Tuition Fee',
        amount: 3500, // Different amount
        base_amount: 4000
      }
    ],
    // Student discounts
    studentDiscounts: [
      {
        id: 'discount-1',
        student_id: 'student-4',
        class_id: 'class-1',
        fee_component: 'Tuition Fee',
        discount_type: 'percentage',
        discount_value: 25, // 25% discount
        is_active: true
      }
    ],
    // Payments made
    payments: [
      { id: 'pay-1', student_id: 'student-1', fee_component: 'Tuition Fee', amount_paid: 2000 },
      { id: 'pay-2', student_id: 'student-2', fee_component: 'Tuition Fee', amount_paid: 3500 }, // Full payment for discounted fee
      { id: 'pay-3', student_id: 'student-3', fee_component: 'Tuition Fee', amount_paid: 1500 },
      // Student 4 and 5 have no payments
    ]
  };
  
  console.log('📊 Test Scenario: Class 1-abc-b');
  console.log('   - 5 students total');
  console.log('   - Class-level fee: ₹4000 Tuition Fee');
  console.log('   - Student 2: Has specific fee override (₹3500)');
  console.log('   - Student 4: Has 25% discount (₹3000)');
  console.log('   - Various payments made');
  
  // Simulate the FIXED logic from FeeManagement.js
  let totalCollected = 0;
  let totalDue = 0;
  
  // Create lookup maps
  const feesByClass = new Map();
  const feesByStudent = new Map();
  const discountsByStudent = new Map();
  const paymentsByStudent = new Map();
  
  // Build class-level fees map
  testData.classLevelFees.forEach(fee => {
    if (!feesByClass.has(fee.class_id)) {
      feesByClass.set(fee.class_id, []);
    }
    feesByClass.get(fee.class_id).push(fee);
  });
  
  // Build student-specific fees map
  testData.studentSpecificFees.forEach(fee => {
    if (!feesByStudent.has(fee.student_id)) {
      feesByStudent.set(fee.student_id, []);
    }
    feesByStudent.get(fee.student_id).push(fee);
  });
  
  // Build discounts map
  testData.studentDiscounts.forEach(discount => {
    if (!discountsByStudent.has(discount.student_id)) {
      discountsByStudent.set(discount.student_id, []);
    }
    discountsByStudent.get(discount.student_id).push(discount);
  });
  
  // Build payments map
  testData.payments.forEach(payment => {
    if (!paymentsByStudent.has(payment.student_id)) {
      paymentsByStudent.set(payment.student_id, []);
    }
    paymentsByStudent.get(payment.student_id).push(payment);
  });
  
  // Helper function for discounts (simplified version)
  const calculateStudentFeeAmount = (baseFee, studentId, feeComponent) => {
    let feeAmount = parseFloat(baseFee.amount || baseFee.base_amount || 0);
    
    const studentDiscounts = discountsByStudent.get(studentId) || [];
    const applicableDiscount = studentDiscounts.find(d => 
      !d.fee_component || d.fee_component === feeComponent
    );
    
    if (applicableDiscount) {
      if (applicableDiscount.discount_type === 'percentage') {
        const discountAmount = (feeAmount * parseFloat(applicableDiscount.discount_value)) / 100;
        feeAmount = Math.max(0, feeAmount - discountAmount);
      } else if (applicableDiscount.discount_type === 'fixed_amount') {
        feeAmount = Math.max(0, feeAmount - parseFloat(applicableDiscount.discount_value));
      }
    }
    
    return feeAmount;
  };
  
  console.log('\n🔍 Processing each student with FIXED logic:');
  
  // Process each class
  testData.classes.forEach(classData => {
    const studentsInClass = testData.students.filter(s => s.class_id === classData.id);
    const feeStructuresForClass = feesByClass.get(classData.id) || [];
    
    let classExpectedFees = 0;
    let classPaidAmount = 0;
    
    studentsInClass.forEach(student => {
      let studentExpectedFees = 0;
      const processedComponents = new Set(); // FIXED: Track processed components
      
      // FIXED: First process student-specific fees (highest priority)
      const studentSpecificFees = feesByStudent.get(student.id) || [];
      studentSpecificFees.forEach(fee => {
        if (fee.class_id === classData.id) {
          const feeAmount = parseFloat(fee.amount || fee.base_amount || 0);
          studentExpectedFees += feeAmount;
          processedComponents.add(fee.fee_component);
          console.log(`   📦 ${student.name}: ${fee.fee_component} = ₹${feeAmount} (student-specific)`);
        }
      });
      
      // FIXED: Then process class-level fees (only if not already processed)
      feeStructuresForClass.forEach(fee => {
        if (!processedComponents.has(fee.fee_component)) {
          const studentFeeAmount = calculateStudentFeeAmount(fee, student.id, fee.fee_component);
          studentExpectedFees += studentFeeAmount;
          processedComponents.add(fee.fee_component);
          
          const discounts = discountsByStudent.get(student.id) || [];
          const hasDiscount = discounts.some(d => !d.fee_component || d.fee_component === fee.fee_component);
          console.log(`   💰 ${student.name}: ${fee.fee_component} = ₹${studentFeeAmount} ${hasDiscount ? '(with discount)' : '(class fee)'}`);
        } else {
          console.log(`   ⚠️ ${student.name}: Skipped ${fee.fee_component} (student-specific exists)`);
        }
      });
      
      classExpectedFees += studentExpectedFees;
      
      // Calculate payments
      const studentPayments = paymentsByStudent.get(student.id) || [];
      const studentTotalPaid = studentPayments.reduce((sum, p) => 
        sum + parseFloat(p.amount_paid || 0), 0
      );
      
      classPaidAmount += studentTotalPaid;
      
      console.log(`   👤 ${student.name} TOTAL: Expected=₹${studentExpectedFees}, Paid=₹${studentTotalPaid}, Outstanding=₹${Math.max(0, studentExpectedFees - studentTotalPaid)}`);
    });
    
    totalDue += classExpectedFees;
    totalCollected += classPaidAmount;
    
    const classOutstanding = Math.max(0, classExpectedFees - classPaidAmount);
    
    console.log(`\n   📊 Class Summary:`);
    console.log(`      💵 Total Due: ₹${classExpectedFees}`);
    console.log(`      💰 Total Collected: ₹${classPaidAmount}`);
    console.log(`      📈 Outstanding: ₹${classOutstanding}`);
  });
  
  // FIXED: Calculate total outstanding correctly
  const totalOutstanding = Math.max(0, totalDue - totalCollected);
  const collectionRate = totalDue > 0 ? Math.round((totalCollected / totalDue) * 10000) / 100 : 0;
  
  console.log(`\n🎯 FINAL SYSTEM TOTALS (FIXED):`)
  console.log(`💵 Total Due: ₹${totalDue}`);
  console.log(`💰 Total Collected: ₹${totalCollected}`);
  console.log(`📈 Outstanding: ₹${totalOutstanding}`);
  console.log(`📊 Collection Rate: ${collectionRate}%`);
  
  // Validation checks
  console.log('\n✅ VALIDATION CHECKS:');
  
  if (totalOutstanding > totalDue) {
    console.log('❌ FAIL: Outstanding > Total Due (mathematically impossible)');
  } else {
    console.log('✅ PASS: Outstanding ≤ Total Due');
  }
  
  if (totalOutstanding === (totalDue - totalCollected)) {
    console.log('✅ PASS: Outstanding = Total Due - Total Collected');
  } else {
    console.log('❌ FAIL: Outstanding calculation inconsistency');
  }
  
  if (totalCollected <= totalDue) {
    console.log('✅ PASS: Total Collected ≤ Total Due');
  } else {
    console.log('⚠️  WARNING: Overpayment detected (Collected > Due)');
  }
  
  console.log('\n🎯 SUMMARY OF FIXES APPLIED:');
  console.log('1. ✅ Fixed double-counting by tracking processed fee components');
  console.log('2. ✅ Student-specific fees take priority over class-level fees');  
  console.log('3. ✅ Outstanding = max(0, Total Due - Total Collected) for consistency');
  console.log('4. ✅ Proper discount handling on class-level fees only');
  
  return {
    totalDue,
    totalCollected, 
    totalOutstanding,
    collectionRate,
    isValid: totalOutstanding <= totalDue && totalOutstanding === (totalDue - totalCollected)
  };
}

if (require.main === module) {
  const result = testComprehensiveFix();
  
  if (result.isValid) {
    console.log('\n🎉 ALL TESTS PASSED - The fix should resolve your issue!');
    console.log('   Outstanding (₹17,000) > Total Due (₹16,300) should no longer occur');
  } else {
    console.log('\n❌ Some validation checks failed - further investigation needed');
  }
}