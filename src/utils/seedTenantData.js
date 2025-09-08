// Utility to seed test data for fee management testing
import { supabase } from './supabase';

export const seedBasicTenantData = async (tenantId) => {
  console.log('🌱 SEEDING: Starting basic tenant data seeding for:', tenantId);
  
  try {
    const currentYear = new Date().getFullYear();
    const academicYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
    
    // Step 1: Create basic classes
    console.log('🌱 Step 1: Creating classes...');
    const classesData = [
      { class_name: '1st Grade', section: 'A', academic_year: academicYear, tenant_id: tenantId },
      { class_name: '1st Grade', section: 'B', academic_year: academicYear, tenant_id: tenantId },
      { class_name: '2nd Grade', section: 'A', academic_year: academicYear, tenant_id: tenantId },
      { class_name: '3rd Grade', section: 'A', academic_year: academicYear, tenant_id: tenantId }
    ];
    
    const { data: createdClasses, error: classError } = await supabase
      .from('classes')
      .insert(classesData)
      .select();
    
    if (classError) {
      console.error('❌ Error creating classes:', classError);
      return { success: false, error: classError.message };
    }
    
    console.log('✅ Created classes:', createdClasses.length);
    
    // Step 2: Create students for each class
    console.log('🌱 Step 2: Creating students...');
    const studentsData = [];
    
    createdClasses.forEach((cls, classIndex) => {
      for (let i = 1; i <= 3; i++) { // 3 students per class
        studentsData.push({
          admission_no: `${cls.class_name.replace(' ', '').toUpperCase()}${cls.section}${i.toString().padStart(3, '0')}`,
          name: `Student ${cls.class_name} ${cls.section}-${i}`,
          dob: new Date(2015 - classIndex, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0],
          gender: i % 2 === 0 ? 'Female' : 'Male',
          class_id: cls.id,
          academic_year: academicYear,
          tenant_id: tenantId,
          roll_no: i
        });
      }
    });
    
    const { data: createdStudents, error: studentError } = await supabase
      .from('students')
      .insert(studentsData)
      .select();
    
    if (studentError) {
      console.error('❌ Error creating students:', studentError);
      return { success: false, error: studentError.message };
    }
    
    console.log('✅ Created students:', createdStudents.length);
    
    // Step 3: Create fee structures for each class
    console.log('🌱 Step 3: Creating fee structures...');
    const feeStructuresData = [];
    
    createdClasses.forEach(cls => {
      // Common fees for all classes
      const baseFees = [
        { fee_component: 'Tuition Fee', amount: 5000, base_amount: 5000 },
        { fee_component: 'Development Fee', amount: 1500, base_amount: 1500 },
        { fee_component: 'Lab Fee', amount: 800, base_amount: 800 },
        { fee_component: 'Library Fee', amount: 500, base_amount: 500 }
      ];
      
      baseFees.forEach(fee => {
        feeStructuresData.push({
          class_id: cls.id,
          student_id: null, // Class-level fee
          fee_component: fee.fee_component,
          amount: fee.amount,
          base_amount: fee.base_amount,
          academic_year: academicYear,
          due_date: new Date(currentYear, 3, 15).toISOString().split('T')[0], // April 15th
          tenant_id: tenantId,
          discount_applied: 0
        });
      });
    });
    
    const { data: createdFeeStructures, error: feeError } = await supabase
      .from('fee_structure')
      .insert(feeStructuresData)
      .select();
    
    if (feeError) {
      console.error('❌ Error creating fee structures:', feeError);
      return { success: false, error: feeError.message };
    }
    
    console.log('✅ Created fee structures:', createdFeeStructures.length);
    
    // Step 4: Create some sample payments
    console.log('🌱 Step 4: Creating sample payments...');
    const paymentsData = [];
    
    // Add payments for about 60% of students
    const studentsWithPayments = createdStudents.slice(0, Math.ceil(createdStudents.length * 0.6));
    
    studentsWithPayments.forEach(student => {
      // Pay partial tuition fee
      paymentsData.push({
        student_id: student.id,
        fee_component: 'Tuition Fee',
        amount_paid: 3000, // Partial payment
        payment_date: new Date(currentYear, 3, Math.floor(Math.random() * 20) + 1).toISOString().split('T')[0],
        payment_mode: Math.random() > 0.5 ? 'Online' : 'Cash',
        academic_year: academicYear,
        tenant_id: tenantId
      });
      
      // Some students also pay development fee
      if (Math.random() > 0.4) {
        paymentsData.push({
          student_id: student.id,
          fee_component: 'Development Fee',
          amount_paid: 1500, // Full payment
          payment_date: new Date(currentYear, 3, Math.floor(Math.random() * 25) + 1).toISOString().split('T')[0],
          payment_mode: Math.random() > 0.5 ? 'UPI' : 'Card',
          academic_year: academicYear,
          tenant_id: tenantId
        });
      }
    });
    
    const { data: createdPayments, error: paymentError } = await supabase
      .from('student_fees')
      .insert(paymentsData)
      .select();
    
    if (paymentError) {
      console.error('❌ Error creating payments:', paymentError);
      return { success: false, error: paymentError.message };
    }
    
    console.log('✅ Created payments:', createdPayments.length);
    
    // Step 5: Create some sample discounts
    console.log('🌱 Step 5: Creating sample discounts...');
    const discountsData = [];
    
    // Add discounts for some students
    const studentsWithDiscounts = createdStudents.slice(0, Math.ceil(createdStudents.length * 0.2));
    
    studentsWithDiscounts.forEach(student => {
      discountsData.push({
        student_id: student.id,
        class_id: student.class_id,
        academic_year: academicYear,
        discount_type: 'percentage',
        discount_value: Math.random() > 0.5 ? 10 : 15, // 10% or 15% discount
        fee_component: 'Tuition Fee',
        description: 'Merit-based discount',
        is_active: true,
        tenant_id: tenantId
      });
    });
    
    if (discountsData.length > 0) {
      const { data: createdDiscounts, error: discountError } = await supabase
        .from('student_discounts')
        .insert(discountsData)
        .select();
      
      if (discountError) {
        console.error('❌ Error creating discounts:', discountError);
        return { success: false, error: discountError.message };
      }
      
      console.log('✅ Created discounts:', createdDiscounts.length);
    }
    
    const summary = {
      classes: createdClasses.length,
      students: createdStudents.length,
      feeStructures: createdFeeStructures.length,
      payments: createdPayments.length,
      discounts: discountsData.length,
      academicYear
    };
    
    console.log('🎉 SEEDING COMPLETE! Data created:', summary);
    
    return {
      success: true,
      data: summary
    };
    
  } catch (error) {
    console.error('❌ SEEDING ERROR:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export const checkTenantDataExists = async (tenantId) => {
  console.log('🔍 CHECKING: Tenant data availability for:', tenantId);
  
  try {
    const [classesResult, studentsResult, feeStructuresResult, paymentsResult] = await Promise.all([
      supabase.from('classes').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('students').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('fee_structure').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('student_fees').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)
    ]);
    
    const availability = {
      classes: classesResult.count || 0,
      students: studentsResult.count || 0,
      feeStructures: feeStructuresResult.count || 0,
      payments: paymentsResult.count || 0
    };
    
    const isEmpty = Object.values(availability).every(count => count === 0);
    
    console.log('📊 Tenant data availability:', availability);
    
    return {
      success: true,
      data: availability,
      isEmpty
    };
    
  } catch (error) {
    console.error('❌ Error checking tenant data:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
