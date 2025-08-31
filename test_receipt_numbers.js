// Test script to debug receipt number issues
// Run this in your browser console or as a Node script

// Simulate the same query that FeePayment.js uses
const testReceiptNumbers = async () => {
  try {
    console.log('=== TESTING RECEIPT NUMBER FETCH ===');
    
    // This is the same query used in FeePayment.js
    const { data: studentPayments, error } = await supabase
      .from('student_fees')
      .select(`
        *,
        students(name, admission_no),
        fee_structure(*)
      `)
      .order('payment_date', { ascending: false });

    console.log('Raw database query result:');
    console.log('Error:', error);
    console.log('Data count:', studentPayments?.length || 0);
    
    if (studentPayments && studentPayments.length > 0) {
      studentPayments.forEach((payment, index) => {
        console.log(`\n--- Payment ${index + 1} ---`);
        console.log('ID:', payment.id);
        console.log('Receipt Number (raw):', payment.receipt_number);
        console.log('Receipt Number Type:', typeof payment.receipt_number);
        console.log('Fee Component:', payment.fee_component);
        console.log('Amount Paid:', payment.amount_paid);
        console.log('Payment Date:', payment.payment_date);
        console.log('All fields:', Object.keys(payment));
      });
      
      // Test the transformation logic
      console.log('\n=== TESTING TRANSFORMATION ===');
      const transformedPayments = studentPayments.map(payment => ({
        id: payment.id,
        feeName: payment.fee_component || 'Fee Payment',
        amount: Number(payment.amount_paid) || 0,
        receiptNumber: payment.receipt_number || null,
        paymentDate: payment.payment_date || new Date().toISOString().split('T')[0],
        paymentMethod: payment.payment_mode || 'Online',
        transactionId: payment.id ? `TXN${payment.id.slice(-8).toUpperCase()}` : `TXN${Date.now()}`,
      }));
      
      transformedPayments.forEach((payment, index) => {
        console.log(`\n--- Transformed Payment ${index + 1} ---`);
        console.log('ID:', payment.id);
        console.log('Receipt Number:', payment.receiptNumber);
        console.log('Receipt Number Type:', typeof payment.receiptNumber);
        console.log('Fee Name:', payment.feeName);
        console.log('Amount:', payment.amount);
      });
    } else {
      console.log('No student payments found');
    }
    
  } catch (error) {
    console.error('Error in test:', error);
  }
};

// Test the HTML generation with sample data
const testReceiptGeneration = (receiptNumber) => {
  console.log('\n=== TESTING HTML GENERATION ===');
  console.log('Input receipt number:', receiptNumber);
  console.log('Type:', typeof receiptNumber);
  console.log('Truthy check:', !!receiptNumber);
  
  const testHTML = `
    <div class="header">
      <div class="school-name">Test School</div>
      <div class="receipt-title">Fee Receipt</div>
      ${receiptNumber ? `<div class="receipt-number">Receipt No: ${receiptNumber}</div>` : '<!-- NO RECEIPT NUMBER -->'}
    </div>
  `;
  
  console.log('Generated HTML snippet:');
  console.log(testHTML);
};

// Test with different values
console.log('Testing HTML generation with different values:');
testReceiptGeneration(1000);
testReceiptGeneration(null);
testReceiptGeneration(undefined);
testReceiptGeneration('');

// Call the main test function
// testReceiptNumbers();
