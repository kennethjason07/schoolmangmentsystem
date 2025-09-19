// Simple test to verify fee calculation logic matches your requirements

console.log('🧪 Testing Fee Calculation Logic\n');

// Your example data
const testData = {
  students: [
    { id: 1, name: 'Student 1' },
    { id: 2, name: 'Student 2' },
    { id: 3, name: 'Student 3' },
    { id: 4, name: 'Student 4' },
    { id: 5, name: 'Student 5' }
  ],
  feeStructure: [
    { fee_type: 'Tuition Fee', amount: 3000 }
  ],
  payments: [
    { student_id: 1, amount_paid: 500, payment_date: '2024-01-15' }
  ]
};

console.log('📊 Test Data:');
console.log('- Students in class:', testData.students.length);
console.log('- Fee per student: ₹' + testData.feeStructure[0].amount);
console.log('- Payments made:', testData.payments.length);

// Calculate using your expected logic
const studentsCount = testData.students.length;
const feePerStudent = testData.feeStructure.reduce((sum, fee) => sum + parseFloat(fee.amount), 0);
const totalExpected = feePerStudent * studentsCount;
const totalCollected = testData.payments.reduce((sum, payment) => sum + parseFloat(payment.amount_paid), 0);
const totalOutstanding = Math.max(0, totalExpected - totalCollected);
const collectionRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;

console.log('\n💰 Calculations:');
console.log('Expected: ₹' + feePerStudent + ' × ' + studentsCount + ' = ₹' + totalExpected);
console.log('Collected: ₹' + totalCollected);
console.log('Outstanding: ₹' + totalExpected + ' - ₹' + totalCollected + ' = ₹' + totalOutstanding);
console.log('Collection Rate: ' + collectionRate + '%');

console.log('\n✅ Expected Results:');
console.log('Expected: ₹15,000');
console.log('Collected: ₹500');
console.log('Outstanding: ₹14,500');
console.log('Collection Rate: 3%');

console.log('\n🎯 Logic Verification:');
console.log('Expected matches: ' + (totalExpected === 15000 ? '✅' : '❌'));
console.log('Collected matches: ' + (totalCollected === 500 ? '✅' : '❌'));
console.log('Outstanding matches: ' + (totalOutstanding === 14500 ? '✅' : '❌'));

if (totalExpected === 15000 && totalCollected === 500 && totalOutstanding === 14500) {
  console.log('\n🎉 All calculations are correct!');
} else {
  console.log('\n❌ Some calculations are incorrect!');
}