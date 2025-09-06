import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('🧪 Testing discount creation after fixing discount_applied column...\n');

async function testDiscountCreation() {
  try {
    console.log('📋 Step 1: Verify discount_applied column exists...');
    
    // Test if the column now exists
    const { data: testData, error: testError } = await supabase
      .from('fee_structure')
      .select('id, discount_applied')
      .limit(1);
    
    if (testError) {
      console.error('❌ discount_applied column still missing:', testError.message);
      console.log('Please run the fix_missing_discount_applied_column.sql script first');
      return;
    }
    
    console.log('✅ discount_applied column exists and is accessible');
    
    console.log('\n📋 Step 2: Find real student and class data for testing...');
    
    // Get real student and class data
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, name, class_id, tenant_id')
      .limit(1);
    
    if (studentsError || !students || students.length === 0) {
      console.error('❌ No students found:', studentsError?.message);
      return;
    }
    
    const testStudent = students[0];
    console.log('✅ Using test student:', testStudent.name, `(ID: ${testStudent.id})`);
    
    console.log('\n📋 Step 3: Test discount creation...');
    
    // Create test discount
    const testDiscount = {
      student_id: testStudent.id,
      class_id: testStudent.class_id,
      academic_year: '2024-25',
      discount_type: 'fixed_amount',
      discount_value: 500,
      fee_component: 'Tuition Fee',
      description: 'Test discount - will be deleted',
      tenant_id: testStudent.tenant_id,
      is_active: true
    };
    
    console.log('Attempting to insert discount...');
    
    const { data: insertData, error: insertError } = await supabase
      .from('student_discounts')
      .insert(testDiscount)
      .select()
      .single();
    
    if (insertError) {
      console.error('❌ DISCOUNT CREATION STILL FAILED:', insertError);
      console.log('Error details:', {
        message: insertError.message,
        code: insertError.code,
        hint: insertError.hint,
        details: insertError.details
      });
      
      // Check what type of error this is
      if (insertError.message.includes('discount_applied')) {
        console.log('\n🚨 Still getting discount_applied error - there might be triggers or functions involved');
      } else if (insertError.message.includes('foreign key')) {
        console.log('\n⚠️ Foreign key constraint error - student or class might not exist');
      } else {
        console.log('\n❓ Different error type - investigate further');
      }
      
      return;
    }
    
    console.log('✅ SUCCESS! Discount created successfully:', insertData);
    
    console.log('\n📋 Step 4: Verify the discount was saved...');
    
    const { data: savedDiscount, error: fetchError } = await supabase
      .from('student_discounts')
      .select('*')
      .eq('id', insertData.id)
      .single();
    
    if (fetchError) {
      console.error('❌ Could not fetch saved discount:', fetchError);
    } else {
      console.log('✅ Verified saved discount:');
      console.log('   ID:', savedDiscount.id);
      console.log('   Student ID:', savedDiscount.student_id);
      console.log('   Class ID:', savedDiscount.class_id);
      console.log('   Discount Value:', savedDiscount.discount_value);
      console.log('   Fee Component:', savedDiscount.fee_component);
      console.log('   Is Active:', savedDiscount.is_active);
    }
    
    console.log('\n📋 Step 5: Clean up test data...');
    
    const { error: deleteError } = await supabase
      .from('student_discounts')
      .delete()
      .eq('id', insertData.id);
    
    if (deleteError) {
      console.warn('⚠️ Could not clean up test record:', deleteError);
    } else {
      console.log('✅ Test discount cleaned up successfully');
    }
    
    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('The discount creation system is now working correctly.');
    
  } catch (error) {
    console.error('❌ Unexpected error during testing:', error);
  }
}

// Run the test
testDiscountCreation()
  .then(() => {
    console.log('\n✨ Testing completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });
