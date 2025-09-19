const { createClient } = require('@supabase/supabase-js');

// Direct Supabase connection for testing
const supabaseUrl = process.env.SUPABASE_URL || 'https://rjbhzrrjmhvnlkjzmvya.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqYmh6cnJqbWh2bmxranptdnlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg1ODU1NjcsImV4cCI6MjA1NDE2MTU2N30.AhHxrGFCJfvJk6-Xnw6VVOeY2kHPwJ6RMz7U_F9CHTU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnoseOutstandingIssue() {
  console.log('🔍 Diagnosing Outstanding vs Total Due calculation issue...');
  
  try {
    // Get a tenant to work with
    const { data: tenants, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name')
      .limit(1);
    
    if (tenantError || !tenants?.length) {
      console.error('❌ No tenant found:', tenantError);
      return;
    }
    
    const tenantId = tenants[0].id;
    console.log(`📍 Using tenant: ${tenants[0].name}`);
    
    // Get all classes for this tenant
    const { data: classes, error: classError } = await supabase
      .from('classes')
      .select('id, class_name, section')
      .eq('tenant_id', tenantId)
      .limit(5);
    
    if (classError || !classes?.length) {
      console.error('❌ No classes found:', classError);
      return;
    }
    
    console.log(`📚 Found ${classes.length} classes to analyze`);
    
    let totalSystemDue = 0;
    let totalSystemCollected = 0;
    let totalSystemOutstanding = 0;
    
    // Analyze each class
    for (const classData of classes) {
      console.log(`\n🔎 Analyzing class: ${classData.class_name}${classData.section ? '-' + classData.section : ''}`);
      
      // Get students in this class
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .eq('class_id', classData.id);
      
      if (studentsError) {
        console.error('❌ Error fetching students:', studentsError);
        continue;
      }
      
      if (!students?.length) {
        console.log('   ⚠️ No students found in this class');
        continue;
      }
      
      console.log(`   👥 Students: ${students.length}`);
      
      // Get fee structures for this class
      const { data: classLevelFees, error: classFeesError } = await supabase
        .from('fee_structure')
        .select('id, fee_component, amount, base_amount, discount_applied')
        .eq('tenant_id', tenantId)
        .eq('class_id', classData.id)
        .is('student_id', null); // Class-level fees only
      
      if (classFeesError) {
        console.error('❌ Error fetching class fees:', classFeesError);
        continue;
      }
      
      // Get student-specific fees
      const { data: studentSpecificFees, error: studentFeesError } = await supabase
        .from('fee_structure')
        .select('id, student_id, fee_component, amount, base_amount, discount_applied')
        .eq('tenant_id', tenantId)
        .eq('class_id', classData.id)
        .not('student_id', 'is', null); // Student-specific fees only
      
      if (studentFeesError) {
        console.error('❌ Error fetching student fees:', studentFeesError);
        continue;
      }
      
      // Get student discounts
      const { data: discounts, error: discountsError } = await supabase
        .from('student_discounts')
        .select('student_id, fee_component, discount_type, discount_value')
        .eq('tenant_id', tenantId)
        .eq('class_id', classData.id)
        .eq('is_active', true);
      
      if (discountsError) {
        console.error('❌ Error fetching discounts:', discountsError);
        continue;
      }
      
      // Get payments for all students in this class
      const studentIds = students.map(s => s.id);
      const { data: payments, error: paymentsError } = await supabase
        .from('student_fees')
        .select('student_id, fee_component, amount_paid')
        .eq('tenant_id', tenantId)
        .in('student_id', studentIds);
      
      if (paymentsError) {
        console.error('❌ Error fetching payments:', paymentsError);
        continue;
      }
      
      console.log(`   💰 Class fees: ${classLevelFees?.length || 0}`);
      console.log(`   👤 Student fees: ${studentSpecificFees?.length || 0}`);
      console.log(`   🎁 Discounts: ${discounts?.length || 0}`);
      console.log(`   💳 Payments: ${payments?.length || 0}`);
      
      // Create lookup maps
      const discountsByStudent = new Map();
      discounts?.forEach(discount => {
        if (!discountsByStudent.has(discount.student_id)) {
          discountsByStudent.set(discount.student_id, []);
        }
        discountsByStudent.get(discount.student_id).push(discount);
      });
      
      const paymentsByStudent = new Map();
      payments?.forEach(payment => {
        if (!paymentsByStudent.has(payment.student_id)) {
          paymentsByStudent.set(payment.student_id, []);
        }
        paymentsByStudent.get(payment.student_id).push(payment);
      });
      
      const studentSpecificFeesByStudent = new Map();
      studentSpecificFees?.forEach(fee => {
        if (!studentSpecificFeesByStudent.has(fee.student_id)) {
          studentSpecificFeesByStudent.set(fee.student_id, []);
        }
        studentSpecificFeesByStudent.get(fee.student_id).push(fee);
      });
      
      let classExpectedFees = 0;
      let classPaidAmount = 0;
      
      // Calculate for each student
      students.forEach(student => {
        let studentExpectedFees = 0;
        let studentPaidAmount = 0;
        
        // Calculate expected fees for this student
        
        // 1. Process class-level fees with discounts
        classLevelFees?.forEach(fee => {
          let feeAmount = parseFloat(fee.amount || fee.base_amount || 0);
          
          // Apply student discount if applicable
          const studentDiscounts = discountsByStudent.get(student.id) || [];
          const applicableDiscount = studentDiscounts.find(d => 
            !d.fee_component || d.fee_component === fee.fee_component
          );
          
          if (applicableDiscount) {
            if (applicableDiscount.discount_type === 'percentage') {
              const discountAmount = (feeAmount * parseFloat(applicableDiscount.discount_value)) / 100;
              feeAmount = Math.max(0, feeAmount - discountAmount);
            } else if (applicableDiscount.discount_type === 'fixed_amount') {
              feeAmount = Math.max(0, feeAmount - parseFloat(applicableDiscount.discount_value));
            }
          }
          
          studentExpectedFees += feeAmount;
        });
        
        // 2. Process student-specific fees (these override class fees)
        const specificFees = studentSpecificFeesByStudent.get(student.id) || [];
        specificFees.forEach(fee => {
          let feeAmount = parseFloat(fee.amount || fee.base_amount || 0);
          studentExpectedFees += feeAmount;
        });
        
        // Calculate how much this student has paid
        const studentPayments = paymentsByStudent.get(student.id) || [];
        studentPaidAmount = studentPayments.reduce((sum, payment) => 
          sum + parseFloat(payment.amount_paid || 0), 0
        );
        
        classExpectedFees += studentExpectedFees;
        classPaidAmount += studentPaidAmount;
        
        if (studentExpectedFees > 0 || studentPaidAmount > 0) {
          console.log(`     👤 ${student.name}: Expected=₹${studentExpectedFees}, Paid=₹${studentPaidAmount}`);
        }
      });
      
      const classOutstanding = Math.max(0, classExpectedFees - classPaidAmount);
      const collectionRate = classExpectedFees > 0 ? 
        Math.round((classPaidAmount / classExpectedFees) * 10000) / 100 : 0;
      
      console.log(`   📊 Class Summary:`);
      console.log(`      💵 Total Due: ₹${classExpectedFees}`);
      console.log(`      💰 Total Collected: ₹${classPaidAmount}`);
      console.log(`      📈 Outstanding: ₹${classOutstanding}`);
      console.log(`      📊 Collection Rate: ${collectionRate}%`);
      
      // Check for logical inconsistencies
      if (classOutstanding > classExpectedFees) {
        console.log(`      ❌ ERROR: Outstanding (₹${classOutstanding}) > Total Due (₹${classExpectedFees})`);
      }
      
      if (classPaidAmount > classExpectedFees) {
        console.log(`      ⚠️ WARNING: Collected (₹${classPaidAmount}) > Expected (₹${classExpectedFees}) - Overpayment`);
      }
      
      totalSystemDue += classExpectedFees;
      totalSystemCollected += classPaidAmount;
      totalSystemOutstanding += classOutstanding;
    }
    
    console.log(`\n🎯 SYSTEM TOTALS:`);
    console.log(`💵 Total Due: ₹${totalSystemDue}`);
    console.log(`💰 Total Collected: ₹${totalSystemCollected}`);
    console.log(`📈 Total Outstanding: ₹${totalSystemOutstanding}`);
    
    const calculatedOutstanding = Math.max(0, totalSystemDue - totalSystemCollected);
    console.log(`🧮 Calculated Outstanding (Due - Collected): ₹${calculatedOutstanding}`);
    
    if (totalSystemOutstanding !== calculatedOutstanding) {
      console.log(`\n❌ CALCULATION ERROR DETECTED:`);
      console.log(`   Reported Outstanding: ₹${totalSystemOutstanding}`);
      console.log(`   Correct Outstanding: ₹${calculatedOutstanding}`);
      console.log(`   Difference: ₹${totalSystemOutstanding - calculatedOutstanding}`);
      console.log(`\n🔧 This indicates a bug in the fee calculation logic!`);
    } else {
      console.log(`\n✅ CALCULATION IS CORRECT`);
    }
    
  } catch (error) {
    console.error('❌ Diagnosis failed:', error);
  }
}

if (require.main === module) {
  diagnoseOutstandingIssue().then(() => {
    console.log('\n🏁 Diagnosis completed');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}