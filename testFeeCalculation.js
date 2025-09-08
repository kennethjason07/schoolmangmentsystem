/**
 * Test script to debug fee calculation issues
 * 
 * Usage: 
 * 1. Replace STUDENT_ID with an actual student ID from your database
 * 2. Run: node testFeeCalculation.js
 */

import { debugFeePaymentMatching } from './src/utils/debugFeePayments.js';

// 🎯 REPLACE THIS WITH AN ACTUAL STUDENT ID FROM YOUR DATABASE
const TEST_STUDENT_ID = 'your-student-id-here'; // Example: 'f8b56c21-14c5-4919-97a2-2969ba18f9f1'

async function runFeeDebugTest() {
  console.log('🧪 Testing Fee Calculation Debug');
  console.log('================================');
  
  if (TEST_STUDENT_ID === 'your-student-id-here') {
    console.log('❗ Please update TEST_STUDENT_ID with an actual student ID from your database');
    console.log('   You can find student IDs by checking your Expo logs when the app runs');
    process.exit(1);
  }
  
  try {
    const result = await debugFeePaymentMatching(TEST_STUDENT_ID);
    
    if (result.success) {
      console.log('\n✅ Debug completed successfully!');
      console.log('\n📊 Key Findings:');
      console.log(`- Outstanding Amount: ₹${result.data.feeCalculation.totalOutstanding}`);
      console.log(`- Total Payments: ${result.data.payments.length}`);
      console.log(`- Unmatched Payments: ${result.data.analysis.unmatchedPayments.length}`);
      console.log(`- Payments Without Year: ${result.data.analysis.paymentsWithoutYear}`);
      console.log(`- Orphaned Payments: ${result.data.analysis.orphanedPayments}`);
      
      if (result.data.feeCalculation.totalOutstanding > 0) {
        console.log('\n❗ Outstanding fees detected. Check the detailed logs above for matching issues.');
      }
    } else {
      console.log('❌ Debug failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
runFeeDebugTest().then(() => {
  console.log('\n🧪 Test completed');
}).catch(error => {
  console.error('❌ Test error:', error);
});
