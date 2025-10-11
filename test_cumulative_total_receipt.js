/**
 * Test Script for Cumulative Total Paid Till Date in Receipts
 * 
 * This script verifies that receipts correctly display the cumulative 
 * total amount paid up until the date of each payment, not just the current payment amount.
 */

const { generateUnifiedReceiptHTML } = require('./src/utils/unifiedReceiptTemplate');

// Mock payment history data for testing
const mockPaymentHistory = [
  {
    id: 1,
    student_id: 'student-123',
    payment_date: '2024-01-15',
    amount_paid: 5000,
    fee_component: 'Tuition Fee - Q1',
    payment_mode: 'UPI'
  },
  {
    id: 2,
    student_id: 'student-123',
    payment_date: '2024-04-15',
    amount_paid: 3000,
    fee_component: 'Transport Fee - Q1',
    payment_mode: 'Cash'
  },
  {
    id: 3,
    student_id: 'student-123',
    payment_date: '2024-07-15',
    amount_paid: 5000,
    fee_component: 'Tuition Fee - Q2',
    payment_mode: 'UPI'
  },
  {
    id: 4,
    student_id: 'student-123',
    payment_date: '2024-10-15',
    amount_paid: 2500,
    fee_component: 'Library Fee',
    payment_mode: 'Online Banking'
  }
];

// Mock school details
const mockSchoolDetails = {
  name: "GLOBAL'S SANMARG PUBLIC SCHOOL",
  address: "Near Fateh Darwaza, Pansal Taleem, Bidar-585401",
  phone: "+91 9341111576",
  email: "global295000@gmail.com",
  academic_year: "2024/25",
  logo_url: null
};

// Function to calculate cumulative total up to a specific date
const calculateCumulativeTotalUpToDate = (paymentHistory, targetDate) => {
  const targetDateObj = new Date(targetDate);
  
  return paymentHistory
    .filter(payment => new Date(payment.payment_date) <= targetDateObj)
    .reduce((total, payment) => total + payment.amount_paid, 0);
};

// Test function to generate receipts for each payment
const testReceiptsWithCumulativeTotal = async () => {
  console.log('🧪 Starting Receipt Cumulative Total Test');
  console.log('=' .repeat(50));
  
  try {
    for (let i = 0; i < mockPaymentHistory.length; i++) {
      const payment = mockPaymentHistory[i];
      
      // Calculate cumulative total up to this payment's date
      const cumulativeTotalTillDate = calculateCumulativeTotalUpToDate(
        mockPaymentHistory, 
        payment.payment_date
      );
      
      console.log(`\n📋 Receipt ${i + 1} - ${payment.fee_component}`);
      console.log(`   Payment Date: ${payment.payment_date}`);
      console.log(`   Payment Amount: ₹${payment.amount_paid.toLocaleString()}`);
      console.log(`   Expected Cumulative Total: ₹${cumulativeTotalTillDate.toLocaleString()}`);
      
      // Prepare receipt data
      const receiptData = {
        student_name: 'John Doe',
        student_admission_no: 'ADM2024001',
        class_name: '10th A',
        fee_component: payment.fee_component,
        payment_date_formatted: payment.payment_date.split('-').reverse().join('/'),
        receipt_no: `RCP${1000 + payment.id}`,
        payment_mode: payment.payment_mode,
        amount_paid: payment.amount_paid,
        father_name: 'Robert Doe',
        total_paid_till_date: cumulativeTotalTillDate, // This should show cumulative total
        amount_remaining: Math.max(0, 15500 - cumulativeTotalTillDate), // Assuming total fees are 15500
        uid: 'ADM2024001'
      };
      
      // Generate receipt HTML
      try {
        const receiptHTML = await generateUnifiedReceiptHTML(receiptData, mockSchoolDetails);
        
        // Check if the receipt contains the correct cumulative total
        const totalPaidRegex = /Total fees paid:\s*Rs\.\s*([\d,]+)/i;
        const match = receiptHTML.match(totalPaidRegex);
        
        if (match) {
          const displayedTotal = parseInt(match[1].replace(/,/g, ''));
          const expectedTotal = cumulativeTotalTillDate;
          
          if (displayedTotal === expectedTotal) {
            console.log(`   ✅ PASS: Receipt shows correct cumulative total: ₹${displayedTotal.toLocaleString()}`);
          } else {
            console.log(`   ❌ FAIL: Receipt shows ₹${displayedTotal.toLocaleString()}, expected ₹${expectedTotal.toLocaleString()}`);
          }
        } else {
          console.log(`   ❌ FAIL: Could not find 'Total fees paid' in receipt HTML`);
        }
        
        // Save receipt for manual inspection
        const fs = require('fs');
        fs.writeFileSync(
          `./test_receipt_${i + 1}_${payment.payment_date}.html`, 
          receiptHTML, 
          'utf8'
        );
        console.log(`   📄 Receipt saved as: test_receipt_${i + 1}_${payment.payment_date}.html`);
        
      } catch (receiptError) {
        console.log(`   ❌ ERROR: Failed to generate receipt HTML: ${receiptError.message}`);
      }
    }
    
    console.log('\n🎯 Test Summary:');
    console.log('- Payment 1 (Jan 15): Should show ₹5,000 total paid');
    console.log('- Payment 2 (Apr 15): Should show ₹8,000 total paid (5000 + 3000)');
    console.log('- Payment 3 (Jul 15): Should show ₹13,000 total paid (5000 + 3000 + 5000)');
    console.log('- Payment 4 (Oct 15): Should show ₹15,500 total paid (5000 + 3000 + 5000 + 2500)');
    
    console.log('\n✅ Test completed! Check the generated HTML files to verify the receipts display correctly.');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
};

// Additional test for edge cases
const testEdgeCases = () => {
  console.log('\n🧪 Testing Edge Cases');
  console.log('=' .repeat(30));
  
  // Test 1: Single payment
  const singlePaymentTotal = calculateCumulativeTotalUpToDate(
    [mockPaymentHistory[0]], 
    '2024-01-15'
  );
  console.log(`Single payment cumulative total: ₹${singlePaymentTotal.toLocaleString()} (Expected: ₹5,000)`);
  
  // Test 2: Date before any payments
  const beforePaymentsTotal = calculateCumulativeTotalUpToDate(
    mockPaymentHistory, 
    '2023-12-01'
  );
  console.log(`Before any payments: ₹${beforePaymentsTotal.toLocaleString()} (Expected: ₹0)`);
  
  // Test 3: Date after all payments
  const afterAllPaymentsTotal = calculateCumulativeTotalUpToDate(
    mockPaymentHistory, 
    '2024-12-31'
  );
  console.log(`After all payments: ₹${afterAllPaymentsTotal.toLocaleString()} (Expected: ₹15,500)`);
  
  // Test 4: Date in the middle
  const middleDateTotal = calculateCumulativeTotalUpToDate(
    mockPaymentHistory, 
    '2024-05-01'
  );
  console.log(`Middle date (May 1): ₹${middleDateTotal.toLocaleString()} (Expected: ₹8,000)`);
};

// Run the tests
console.log('🚀 Starting Cumulative Receipt Total Tests\n');

// Run edge case tests first
testEdgeCases();

// Run main receipt generation tests
testReceiptsWithCumulativeTotal().catch(console.error);