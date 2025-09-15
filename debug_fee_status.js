// Debug script for fee status issue in StudentDashboard
// Run this in browser console or as standalone script

const debugFeeStatus = async (studentId, classId, tenantId) => {
  console.log('🐛 DEBUG: Fee Status Investigation');
  console.log('Student ID:', studentId);
  console.log('Class ID:', classId);
  console.log('Tenant ID:', tenantId);

  try {
    // 1. Check fee structure for the student's class
    console.log('\n1. 📋 Checking fee structure...');
    const { data: feeStructure, error: feeError } = await supabase
      .from('fee_structure')
      .select('*')
      .eq('class_id', classId)
      .eq('tenant_id', tenantId)
      .is('student_id', null); // Class-level fees

    console.log('Fee structure records:', feeStructure?.length || 0);
    if (feeStructure?.length > 0) {
      console.log('Sample fee structure:', feeStructure[0]);
      const totalFees = feeStructure.reduce((sum, fee) => sum + (Number(fee.amount) || 0), 0);
      console.log('Total fee amount:', totalFees);
    } else {
      console.log('❌ No fee structure found!');
    }

    // 2. Check student fee payments
    console.log('\n2. 💰 Checking student payments...');
    const { data: payments, error: paymentError } = await supabase
      .from('student_fees')
      .select('*')
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId);

    console.log('Payment records:', payments?.length || 0);
    if (payments?.length > 0) {
      console.log('Sample payment:', payments[0]);
      const totalPaid = payments.reduce((sum, payment) => sum + (Number(payment.amount_paid) || 0), 0);
      console.log('Total paid amount:', totalPaid);
    } else {
      console.log('❌ No payment records found!');
    }

    // 3. Check student discounts
    console.log('\n3. 🎁 Checking student discounts...');
    const { data: discounts, error: discountError } = await supabase
      .from('student_discounts')
      .select('*')
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    console.log('Active discounts:', discounts?.length || 0);
    if (discounts?.length > 0) {
      console.log('Sample discount:', discounts[0]);
    }

    // 4. Check student record
    console.log('\n4. 👤 Checking student record...');
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, name, class_id, academic_year, tenant_id')
      .eq('id', studentId)
      .eq('tenant_id', tenantId)
      .single();

    console.log('Student record:', student);

    // 5. Test fee calculation
    console.log('\n5. 🧮 Testing fee calculation...');
    try {
      const { calculateStudentFees } = await import('./src/utils/feeCalculation.js');
      const feeResult = await calculateStudentFees(studentId, classId, tenantId);
      console.log('Fee calculation result:', feeResult);
    } catch (calcError) {
      console.error('Fee calculation error:', calcError);
    }

  } catch (error) {
    console.error('Debug error:', error);
  }
};

// Usage: debugFeeStatus('student-uuid', 'class-uuid', 'tenant-uuid');
console.log('Debug function ready! Call debugFeeStatus(studentId, classId, tenantId)');