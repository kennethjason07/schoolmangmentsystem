import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const TENANT_ID = 'b8f8b5f0-1234-4567-8901-123456789000';

async function setupClass3AScenario() {
  console.log('🏫 Setting up Class 3-A fee scenario...');
  console.log('='.repeat(60));
  
  try {
    // Step 1: Create Class 3-A
    console.log('\n📚 Step 1: Creating Class 3-A');
    const { data: classResult, error: classError } = await supabase
      .from('classes')
      .insert({
        class_name: 'Class 3',
        section: 'A',
        academic_year: '2024-25',
        tenant_id: TENANT_ID
      })
      .select()
      .single();
    
    if (classError) {
      console.log('❌ Error creating class:', classError.message);
      return;
    }
    
    const classId = classResult.id;
    console.log(`✅ Created Class 3-A with ID: ${classId}`);
    
    // Step 2: Create class-level fee structure (₹46,000 total)
    console.log('\n💰 Step 2: Creating class-level fee structure (₹46,000)');
    const feeStructure = [
      { fee_component: 'Tuition Fee', amount: 30000 },
      { fee_component: 'Bus Fee', amount: 8000 },
      { fee_component: 'Library Fee', amount: 3000 },
      { fee_component: 'Lab Fee', amount: 5000 }
    ].map(fee => ({
      ...fee,
      class_id: classId,
      student_id: null, // 🎯 CRITICAL: Class-level fees only
      academic_year: '2024-25',
      due_date: '2024-12-31',
      tenant_id: TENANT_ID
    }));
    
    const { data: feeResults, error: feeError } = await supabase
      .from('fee_structure')
      .insert(feeStructure)
      .select();
    
    if (feeError) {
      console.log('❌ Error creating fee structure:', feeError.message);
      return;
    }
    
    const totalClassFee = feeStructure.reduce((sum, fee) => sum + fee.amount, 0);
    console.log(`✅ Created class-level fee structure: ₹${totalClassFee}`);
    feeResults.forEach(fee => {
      console.log(`   📋 ${fee.fee_component}: ₹${fee.amount} (student_id: ${fee.student_id || 'null'})`);
    });
    
    // Step 3: Create students in Class 3-A
    console.log('\n👥 Step 3: Creating students in Class 3-A');
    const students = [
      { name: 'Justud', admission_no: 'STD001' },
      { name: 'Arjun', admission_no: 'STD002' },
      { name: 'Priya', admission_no: 'STD003' },
      { name: 'Rohit', admission_no: 'STD004' }
    ].map(student => ({
      ...student,
      class_id: classId,
      academic_year: '2024-25',
      roll_no: students.indexOf(student) + 1,
      tenant_id: TENANT_ID
    }));
    
    const { data: studentResults, error: studentError } = await supabase
      .from('students')
      .insert(students)
      .select();
    
    if (studentError) {
      console.log('❌ Error creating students:', studentError.message);
      return;
    }
    
    console.log(`✅ Created ${studentResults.length} students:`);
    studentResults.forEach(student => {
      console.log(`   👤 ${student.name} (ID: ${student.id}, Roll: ${student.roll_no})`);
    });
    
    // Step 4: Create discount for Justud only (₹15,000)
    const justudStudent = studentResults.find(s => s.name === 'Justud');
    if (justudStudent) {
      console.log('\n🎁 Step 4: Creating discount for Justud (₹15,000)');
      const { data: discountResult, error: discountError } = await supabase
        .from('student_discounts')
        .insert({
          student_id: justudStudent.id,
          class_id: classId,
          academic_year: '2024-25',
          discount_type: 'fixed_amount',
          discount_value: 15000,
          fee_component: null, // Apply to all components proportionally
          reason: 'Special concession for Justud',
          is_active: true,
          tenant_id: TENANT_ID
        })
        .select()
        .single();
      
      if (discountError) {
        console.log('❌ Error creating discount:', discountError.message);
      } else {
        console.log(`✅ Created ₹${discountResult.discount_value} discount for ${justudStudent.name}`);
      }
    }
    
    // Step 5: Verify the setup
    console.log('\n🔍 Step 5: Verification');
    
    // Check fee_structure table (should show ₹46,000 for class, no student-specific entries)
    const { data: feeVerify, error: feeVerifyError } = await supabase
      .from('fee_structure')
      .select('*')
      .eq('class_id', classId);
    
    if (!feeVerifyError && feeVerify) {
      const classTotal = feeVerify.reduce((sum, fee) => sum + fee.amount, 0);
      const studentSpecificCount = feeVerify.filter(fee => fee.student_id !== null).length;
      
      console.log('📊 Fee Structure Verification:');
      console.log(`   💰 Class total fee: ₹${classTotal} (should be ₹46,000)`);
      console.log(`   🔒 Student-specific entries: ${studentSpecificCount} (should be 0)`);
      console.log(`   ✅ All entries have student_id = null: ${feeVerify.every(fee => fee.student_id === null)}`);
    }
    
    // Check student_discounts table
    const { data: discountVerify, error: discountVerifyError } = await supabase
      .from('student_discounts')
      .select('*')
      .eq('class_id', classId);
    
    if (!discountVerifyError && discountVerify) {
      console.log('🎁 Student Discounts Verification:');
      console.log(`   📈 Total active discounts: ${discountVerify.length}`);
      discountVerify.forEach(discount => {
        const student = studentResults.find(s => s.id === discount.student_id);
        console.log(`   💳 ${student?.name}: ₹${discount.discount_value} discount`);
      });
    }
    
    console.log('\n🎯 EXPECTED BEHAVIOR:');
    console.log('📋 Fee Structure Table (class-level):');
    console.log('   - Tuition Fee: ₹30,000 (applies to ALL students)');
    console.log('   - Bus Fee: ₹8,000 (applies to ALL students)');
    console.log('   - Library Fee: ₹3,000 (applies to ALL students)');
    console.log('   - Lab Fee: ₹5,000 (applies to ALL students)');
    console.log('   📊 TOTAL: ₹46,000 for EVERYONE initially');
    
    console.log('\n🎁 Student Discounts (applied dynamically):');
    console.log('   - Justud: ₹15,000 discount → Final fee: ₹31,000');
    console.log('   - Arjun: No discount → Final fee: ₹46,000');
    console.log('   - Priya: No discount → Final fee: ₹46,000');
    console.log('   - Rohit: No discount → Final fee: ₹46,000');
    
    console.log('\n✅ Setup complete! Class 3-A scenario ready for testing.');
    console.log('\n📝 Test Data Created:');
    console.log(`   🏫 Class ID: ${classId}`);
    console.log(`   👤 Students: ${studentResults.map(s => `${s.name} (${s.id})`).join(', ')}`);
    
  } catch (error) {
    console.error('❌ Setup error:', error);
  }
}

// Run setup
setupClass3AScenario()
  .then(() => {
    console.log('\n🏁 Class 3-A scenario setup completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Setup failed:', error);
    process.exit(1);
  });
