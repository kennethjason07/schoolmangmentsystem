const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testFeeCalculation() {
  console.log('🧪 Testing Fee Calculation Logic...\n');
  
  try {
    // Get current user to determine tenant
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.log('⚠️ No authenticated user found - please log in first');
      return;
    }
    
    console.log('👤 Current user:', user.email);
    
    // Get user's tenant ID
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('tenant_id, email')
      .eq('email', user.email)
      .maybeSingle();
    
    if (userError || !userRecord || !userRecord.tenant_id) {
      console.log('❌ Could not find user tenant ID');
      return;
    }
    
    const tenantId = userRecord.tenant_id;
    console.log('🏢 Tenant ID:', tenantId);
    
    // Test specific class: "1-abc-b" or similar
    console.log('\n📚 Looking for class containing "abc" or "1"...');
    
    const { data: classes, error: classError } = await supabase
      .from('classes')
      .select('*')
      .eq('tenant_id', tenantId)
      .ilike('class_name', '%1%')
      .limit(5);
    
    if (classError) {
      console.error('❌ Error loading classes:', classError);
      return;
    }
    
    console.log(`📋 Found ${classes?.length || 0} classes:`);
    if (classes) {
      classes.forEach((cls, index) => {
        console.log(`  ${index + 1}. ${cls.class_name} ${cls.section} (ID: ${cls.id})`);
      });
    }
    
    // Use first class for testing
    const testClass = classes?.[0];
    if (!testClass) {
      console.log('❌ No test class found');
      return;
    }
    
    console.log(`\n🎯 Testing with class: ${testClass.class_name} ${testClass.section}`);
    
    // Get students in this class
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, name, full_name, class_id')
      .eq('class_id', testClass.id)
      .eq('tenant_id', tenantId);
    
    if (studentsError) {
      console.error('❌ Error loading students:', studentsError);
      return;
    }
    
    console.log(`👥 Students in class: ${students?.length || 0}`);
    if (students) {
      students.slice(0, 3).forEach((student, index) => {
        console.log(`  ${index + 1}. ${student.name || student.full_name} (ID: ${student.id})`);
      });
    }
    
    // Get fee structure for this class
    const { data: feeStructure, error: feeError } = await supabase
      .from('fee_structure')
      .select('*')
      .eq('class_id', testClass.id)
      .eq('tenant_id', tenantId);
    
    if (feeError) {
      console.error('❌ Error loading fee structure:', feeError);
      return;
    }
    
    console.log(`💰 Fee structure entries: ${feeStructure?.length || 0}`);
    let feePerStudent = 0;
    if (feeStructure) {
      feeStructure.forEach((fee, index) => {
        const amount = parseFloat(fee.amount) || parseFloat(fee.fee_amount) || 0;
        feePerStudent += amount;
        console.log(`  ${index + 1}. ${fee.fee_type || 'Fee'}: ₹${amount}`);
      });
    }
    
    console.log(`📊 Total fee per student: ₹${feePerStudent}`);
    
    // Calculate expected total
    const studentsCount = students?.length || 0;
    const totalExpected = feePerStudent * studentsCount;
    console.log(`📈 Total expected (${feePerStudent} × ${studentsCount}): ₹${totalExpected}`);
    
    // Get payment records
    const { data: payments, error: paymentsError } = await supabase
      .from('student_fees')
      .select('*')
      .eq('tenant_id', tenantId);
    
    if (paymentsError) {
      console.error('❌ Error loading payments:', paymentsError);
      return;
    }
    
    console.log(`💳 Total payment records: ${payments?.length || 0}`);
    
    // Calculate total collected
    let totalCollected = 0;
    if (payments) {
      payments.forEach(payment => {
        const amount = parseFloat(payment.amount_paid) || 0;
        totalCollected += amount;
      });
    }
    
    console.log(`💰 Total collected: ₹${totalCollected}`);
    
    // Calculate outstanding
    const totalOutstanding = Math.max(0, totalExpected - totalCollected);
    console.log(`🔴 Total outstanding: ₹${totalOutstanding}`);
    
    // Calculate collection rate
    const collectionRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;
    console.log(`📊 Collection rate: ${collectionRate}%`);
    
    console.log('\n✅ Fee calculation test completed!');
    console.log('\n🔧 If these numbers look correct, the enhanced fee calculation should work properly.');
    
  } catch (error) {
    console.error('💥 Test error:', error);
  }
}

testFeeCalculation().then(() => {
  console.log('\n📋 Test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Script error:', error);
  process.exit(1);
});