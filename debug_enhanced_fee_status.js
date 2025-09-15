/**
 * Enhanced Fee Status Debugging Script
 * Run this to diagnose fee calculation issues specifically for Justus
 */

import { supabase, TABLES } from './src/utils/supabase.js';
import { calculateStudentFees } from './src/utils/feeCalculation.js';

const debugJustusSpecific = async () => {
  console.log('🔍 DEBUGGING JUSTUS FEE ISSUE - COMPREHENSIVE ANALYSIS');
  console.log('=' .repeat(60));
  
  try {
    // Step 1: Find Justus in the database
    console.log('\n📋 Step 1: Finding Justus in students table...');
    const { data: justusStudents, error: studentError } = await supabase
      .from(TABLES.STUDENTS)
      .select(`
        id,
        name,
        class_id,
        academic_year,
        tenant_id,
        classes(class_name, section)
      `)
      .ilike('name', '%justus%');
      
    if (studentError) {
      console.error('❌ Error finding Justus:', studentError);
      return;
    }
    
    if (!justusStudents || justusStudents.length === 0) {
      console.log('❌ No student named Justus found!');
      return;
    }
    
    console.log(`✅ Found ${justusStudents.length} student(s) with name containing 'Justus':`);
    justusStudents.forEach((student, idx) => {
      console.log(`  ${idx + 1}. ${student.name} (ID: ${student.id})`);
      console.log(`     Class: ${student.classes?.class_name} ${student.classes?.section}`);
      console.log(`     Tenant: ${student.tenant_id}`);
      console.log(`     Academic Year: ${student.academic_year}`);
    });
    
    // Work with the first Justus found
    const justus = justusStudents[0];
    const studentId = justus.id;
    const classId = justus.class_id;
    const tenantId = justus.tenant_id;
    
    console.log(`\n🎯 Working with: ${justus.name} (${studentId})`);
    
    // Step 2: Check fee structure for Justus's class
    console.log('\n📊 Step 2: Checking fee structure for Justus\'s class...');
    const { data: feeStructures, error: feeError } = await supabase
      .from(TABLES.FEE_STRUCTURE)
      .select('*')
      .eq('class_id', classId)
      .eq('tenant_id', tenantId)
      .is('student_id', null);
      
    if (feeError) {
      console.error('❌ Error fetching fee structure:', feeError);
    } else {
      console.log(`✅ Found ${feeStructures?.length || 0} fee structure records:`);
      (feeStructures || []).forEach((fee, idx) => {
        console.log(`  ${idx + 1}. ${fee.fee_component}: ₹${fee.amount} (Base: ₹${fee.base_amount || fee.amount}, Discount: ₹${fee.discount_applied || 0})`);
        console.log(`     Due: ${fee.due_date}, Year: ${fee.academic_year}`);
      });
    }
    
    // Step 3: Check payments for Justus
    console.log('\n💰 Step 3: Checking payments for Justus...');
    const { data: payments, error: paymentError } = await supabase
      .from(TABLES.STUDENT_FEES)
      .select('*')
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .order('payment_date', { ascending: false });
      
    if (paymentError) {
      console.error('❌ Error fetching payments:', paymentError);
    } else {
      console.log(`✅ Found ${payments?.length || 0} payment records:`);
      let totalPaidRaw = 0;
      (payments || []).forEach((payment, idx) => {
        totalPaidRaw += Number(payment.amount_paid) || 0;
        console.log(`  ${idx + 1}. ${payment.fee_component}: ₹${payment.amount_paid}`);
        console.log(`     Date: ${payment.payment_date}, Year: ${payment.academic_year || 'N/A'}`);
        console.log(`     Total: ₹${payment.total_amount || 'N/A'}, Remaining: ₹${payment.remaining_amount || 'N/A'}, Status: ${payment.status || 'N/A'}`);
      });
      console.log(`💵 Total Raw Payments: ₹${totalPaidRaw}`);
    }
    
    // Step 4: Check student discounts
    console.log('\n🎁 Step 4: Checking student discounts for Justus...');
    const { data: discounts, error: discountError } = await supabase
      .from(TABLES.STUDENT_DISCOUNTS)
      .select('*')
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .eq('is_active', true);
      
    if (discountError) {
      console.error('❌ Error fetching discounts:', discountError);
    } else {
      console.log(`✅ Found ${discounts?.length || 0} active discount records:`);
      (discounts || []).forEach((discount, idx) => {
        console.log(`  ${idx + 1}. ${discount.fee_component || 'ALL'}: ${discount.discount_type} - ${discount.discount_value}`);
        console.log(`     Year: ${discount.academic_year || 'N/A'}, Reason: ${discount.description || discount.reason || 'N/A'}`);
      });
    }
    
    // Step 5: Run enhanced fee calculation
    console.log('\n🧮 Step 5: Running enhanced fee calculation...');
    const feeResult = await calculateStudentFees(studentId, classId, tenantId);
    
    console.log('🎯 ENHANCED FEE CALCULATION RESULT:');
    console.log('  Total Amount (after all discounts):', feeResult.totalAmount);
    console.log('  Total Paid:', feeResult.totalPaid);
    console.log('  Total Outstanding:', feeResult.totalOutstanding);
    console.log('  Total Base Fee:', feeResult.totalBaseFee);
    console.log('  Total Discounts:', feeResult.totalDiscounts);
    console.log('  Academic Year:', feeResult.academicYear);
    console.log('  Fee Components Processed:', feeResult.details?.length || 0);
    console.log('  Orphaned Payments:', feeResult.orphanedPayments?.length || 0);
    
    if (feeResult.error) {
      console.error('❌ Fee calculation error:', feeResult.error);
    }
    
    // Step 6: Detailed breakdown
    console.log('\n📋 Step 6: Detailed component breakdown...');
    if (feeResult.details && feeResult.details.length > 0) {
      feeResult.details.forEach((detail, idx) => {
        console.log(`  ${idx + 1}. ${detail.feeComponent}:`);
        console.log(`     Base Amount: ₹${detail.baseFeeAmount}`);
        console.log(`     Structure Discount: ₹${detail.structureDiscountAmount || 0}`);
        console.log(`     Individual Discount: ₹${detail.individualDiscountAmount || 0}`);
        console.log(`     Final Amount: ₹${detail.finalAmount}`);
        console.log(`     Paid Amount: ₹${detail.paidAmount}`);
        console.log(`     Outstanding: ₹${detail.outstandingAmount}`);
        console.log(`     Status: ${detail.status}`);
        console.log(`     Payments: ${detail.payments?.length || 0}`);
        if (detail.payments && detail.payments.length > 0) {
          detail.payments.forEach((payment, pIdx) => {
            console.log(`       Payment ${pIdx + 1}: ₹${payment.amount} on ${payment.paymentDate}`);
          });
        }
      });
    }
    
    // Step 7: Identify potential issues
    console.log('\n🔍 Step 7: Issue Analysis...');
    const issues = [];
    
    if (feeResult.totalDue === 0 && (feeStructures?.length || 0) > 0) {
      issues.push('Fee structures exist but totalDue is 0 - possible calculation issue');
    }
    
    if ((payments?.length || 0) > 0 && feeResult.totalPaid === 0) {
      issues.push('Payments exist but totalPaid is 0 - possible payment matching issue');
    }
    
    if (feeResult.orphanedPayments && feeResult.orphanedPayments.length > 0) {
      issues.push(`${feeResult.orphanedPayments.length} orphaned payments found - component name mismatch?`);
      console.log('    Orphaned payments:');
      feeResult.orphanedPayments.forEach((payment, idx) => {
        console.log(`      ${idx + 1}. ${payment.fee_component}: ₹${payment.amount_paid} (${payment.academic_year || 'No year'})`);
      });
    }
    
    const yearMismatch = [];
    if (feeStructures && payments) {
      const structureYears = [...new Set(feeStructures.map(f => f.academic_year))];
      const paymentYears = [...new Set(payments.map(p => p.academic_year).filter(Boolean))];
      if (structureYears.length > 0 && paymentYears.length > 0) {
        const commonYears = structureYears.filter(year => paymentYears.includes(year));
        if (commonYears.length === 0) {
          issues.push(`Academic year mismatch - Fee structures: [${structureYears.join(', ')}], Payments: [${paymentYears.join(', ')}]`);
        }
      }
    }
    
    if (issues.length > 0) {
      console.log('🚨 POTENTIAL ISSUES FOUND:');
      issues.forEach((issue, idx) => {
        console.log(`  ${idx + 1}. ${issue}`);
      });
    } else {
      console.log('✅ No obvious issues found in fee calculation');
    }
    
    // Step 8: Recommendations
    console.log('\n💡 Step 8: Recommendations...');
    
    if (feeResult.totalOutstanding > 0) {
      console.log(`📌 Student should see: Outstanding ₹${feeResult.totalOutstanding.toLocaleString()}`);
    } else if (feeResult.totalDue === 0) {
      console.log('📌 Student should see: \"No fees\"');
    } else {
      console.log('📌 Student should see: \"All paid\"');
    }
    
    console.log('\n🎯 DEBUG COMPLETE');
    console.log('=' .repeat(60));
    
  } catch (error) {
    console.error('💥 Debug script error:', error);
  }
};

// Make the function available globally for easy testing
if (typeof global !== 'undefined') {
  global.debugJustusSpecific = debugJustusSpecific;
}

console.log('🐛 Enhanced fee debugging script loaded!');
console.log('Run debugJustusSpecific() to start the diagnosis.');

export { debugJustusSpecific };