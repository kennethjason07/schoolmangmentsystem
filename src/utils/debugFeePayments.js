import { supabase, TABLES, getUserTenantId } from './supabase';
import { calculateStudentFees } from './feeCalculation';

/**
 * Debug utility to analyze fee payment matching issues
 * This helps identify why outstanding amounts might be incorrect
 */
export const debugFeePaymentMatching = async (studentId, options = {}) => {
  try {
    console.log('\n🐛 DEBUG: Fee Payment Matching Analysis');
    console.log('=' .repeat(60));
    console.log(`Student ID: ${studentId}`);
    
    const tenantId = options.tenantId || await getUserTenantId();
    if (!tenantId) {
      throw new Error('Tenant ID required');
    }
    
    // Get student info
    const { data: student, error: studentError } = await supabase
      .from(TABLES.STUDENTS)
      .select(`
        id, name, admission_no, class_id, academic_year,
        classes(class_name, section)
      `)
      .eq('id', studentId)
      .eq('tenant_id', tenantId)
      .single();
    
    if (studentError || !student) {
      throw new Error(`Student not found: ${studentError?.message}`);
    }
    
    console.log(`Student: ${student.name} (${student.admission_no})`);
    console.log(`Class: ${student.classes?.class_name} ${student.classes?.section}`);
    console.log(`Academic Year: ${student.academic_year}`);
    
    // Get fee structure for this student's class
    const { data: feeStructures, error: feeError } = await supabase
      .from(TABLES.FEE_STRUCTURE)
      .select('*')
      .eq('class_id', student.class_id)
      .is('student_id', null) // Only class-level fees
      .eq('tenant_id', tenantId);
    
    if (feeError) {
      throw new Error(`Fee structure error: ${feeError.message}`);
    }
    
    console.log(`\n📊 Fee Structure (${feeStructures?.length || 0} components):`);
    (feeStructures || []).forEach((fee, index) => {
      console.log(`  ${index + 1}. ${fee.fee_component}: ₹${fee.amount} (due: ${fee.due_date})`);
    });
    
    // Get all payments for this student
    const { data: payments, error: paymentError } = await supabase
      .from(TABLES.STUDENT_FEES)
      .select('*')
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .order('payment_date', { ascending: false });
    
    if (paymentError) {
      throw new Error(`Payment error: ${paymentError.message}`);
    }
    
    console.log(`\n💳 Student Payments (${payments?.length || 0} records):`);
    (payments || []).forEach((payment, index) => {
      console.log(`  ${index + 1}. ${payment.fee_component}: ₹${payment.amount_paid} (${payment.payment_date}, year: ${payment.academic_year || 'not specified'})`);
    });
    
    // Analyze component matching
    console.log(`\n🔍 Component Matching Analysis:`);
    const feeComponents = (feeStructures || []).map(f => f.fee_component);
    const paymentComponents = [...new Set((payments || []).map(p => p.fee_component))];
    
    console.log(`Fee Components: [${feeComponents.join(', ')}]`);
    console.log(`Payment Components: [${paymentComponents.join(', ')}]`);
    
    // Check for mismatches
    const unmatchedPayments = paymentComponents.filter(pc => 
      !feeComponents.some(fc => 
        fc.toLowerCase() === pc.toLowerCase() || 
        fc.toLowerCase().replace(/\s+/g, '') === pc.toLowerCase().replace(/\s+/g, '')
      )
    );
    
    if (unmatchedPayments.length > 0) {
      console.log(`❗ Potential Mismatched Payment Components:`);
      unmatchedPayments.forEach(pc => {
        const matchingPayments = payments.filter(p => p.fee_component === pc);
        const totalAmount = matchingPayments.reduce((sum, p) => sum + Number(p.amount_paid), 0);
        console.log(`  - "${pc}" (₹${totalAmount} total)`);
      });
    }
    
    // Check academic year issues
    console.log(`\n📅 Academic Year Analysis:`);
    const paymentYears = [...new Set((payments || []).map(p => p.academic_year).filter(Boolean))];
    const feeYears = [...new Set((feeStructures || []).map(f => f.academic_year).filter(Boolean))];
    
    console.log(`Fee Structure Years: [${feeYears.join(', ')}]`);
    console.log(`Payment Years: [${paymentYears.join(', ')}]`);
    
    const paymentsWithoutYear = payments?.filter(p => !p.academic_year) || [];
    if (paymentsWithoutYear.length > 0) {
      console.log(`⚠️  ${paymentsWithoutYear.length} payments have no academic year specified`);
    }
    
    // Run the actual fee calculation
    console.log(`\n🧮 Running Fee Calculation:`);
    const feeCalculation = await calculateStudentFees(studentId, student.class_id, tenantId);
    
    console.log(`\n📋 Calculation Results:`);
    console.log(`  Total Due: ₹${feeCalculation.totalAmount}`);
    console.log(`  Total Paid: ₹${feeCalculation.totalPaid}`);
    console.log(`  Outstanding: ₹${feeCalculation.totalOutstanding}`);
    console.log(`  Components Processed: ${feeCalculation.details?.length || 0}`);
    
    if (feeCalculation.orphanedPayments && feeCalculation.orphanedPayments.length > 0) {
      console.log(`\n🏷️  Orphaned Payments (${feeCalculation.orphanedPayments.length}):`);
      feeCalculation.orphanedPayments.forEach(payment => {
        console.log(`  - ${payment.fee_component}: ₹${payment.amount_paid} (${payment.payment_date})`);
      });
    }
    
    // Component-wise breakdown
    console.log(`\n📊 Component-wise Breakdown:`);
    (feeCalculation.details || []).forEach(detail => {
      console.log(`  ${detail.feeComponent}:`);
      console.log(`    Base Fee: ₹${detail.baseFeeAmount}`);
      console.log(`    Discount: ₹${detail.discountAmount}`);
      console.log(`    Final Amount: ₹${detail.finalAmount}`);
      console.log(`    Paid Amount: ₹${detail.paidAmount}`);
      console.log(`    Outstanding: ₹${detail.outstandingAmount}`);
      console.log(`    Payments Matched: ${detail.payments?.length || 0}`);
    });
    
    // Summary and recommendations
    console.log(`\n🎯 Summary & Recommendations:`);
    if (feeCalculation.totalOutstanding > 0) {
      console.log(`  ❗ Outstanding Amount: ₹${feeCalculation.totalOutstanding}`);
      
      if (unmatchedPayments.length > 0) {
        console.log(`  💡 Check payment component name matching`);
      }
      
      if (paymentsWithoutYear.length > 0) {
        console.log(`  💡 Consider updating payments without academic year`);
      }
      
      if (feeCalculation.orphanedPayments && feeCalculation.orphanedPayments.length > 0) {
        console.log(`  💡 Review orphaned payments - they may not be matched correctly`);
      }
    } else {
      console.log(`  ✅ All fees appear to be paid`);
    }
    
    console.log(`\n🐛 DEBUG COMPLETE`);
    console.log('=' .repeat(60));
    
    return {
      success: true,
      data: {
        student,
        feeStructures,
        payments,
        feeCalculation,
        analysis: {
          unmatchedPayments,
          paymentsWithoutYear: paymentsWithoutYear.length,
          orphanedPayments: feeCalculation.orphanedPayments?.length || 0
        }
      }
    };
    
  } catch (error) {
    console.error('❌ Debug error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Quick debug for multiple students to identify patterns
 */
export const debugMultipleStudentFees = async (studentIds, options = {}) => {
  console.log(`\n🐛 DEBUG: Multiple Students Fee Analysis`);
  console.log(`Analyzing ${studentIds.length} students...`);
  
  const results = [];
  
  for (const studentId of studentIds) {
    console.log(`\n--- Student ${studentId} ---`);
    const result = await debugFeePaymentMatching(studentId, options);
    results.push({
      studentId,
      ...result
    });
  }
  
  // Summary analysis
  console.log(`\n📊 MULTI-STUDENT SUMMARY:`);
  const totalOutstanding = results
    .filter(r => r.success)
    .reduce((sum, r) => sum + (r.data.feeCalculation.totalOutstanding || 0), 0);
  
  const studentsWithIssues = results
    .filter(r => r.success && (
      r.data.analysis.unmatchedPayments.length > 0 ||
      r.data.analysis.paymentsWithoutYear > 0 ||
      r.data.analysis.orphanedPayments > 0
    )).length;
  
  console.log(`Total Outstanding Across All Students: ₹${totalOutstanding}`);
  console.log(`Students with Potential Issues: ${studentsWithIssues}/${results.length}`);
  
  return results;
};

export default { debugFeePaymentMatching, debugMultipleStudentFees };
