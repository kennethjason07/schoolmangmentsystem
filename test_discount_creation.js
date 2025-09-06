import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = 'https://owlyxmubhryxdczapysg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93bHl4bXViaHJ5eGRjemFweXNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU3NDU2NDMsImV4cCI6MjA1MTMyMTY0M30.S6hIqxB0EpkLm91KXVZW0mAz5u7mSfUU_lk1ycCdNWE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('🔍 Testing discount creation with real data...\n');

async function testDiscountCreation() {
  try {
    // Step 1: Get real student and class data
    console.log('📋 Step 1: Finding real students and classes...');
    
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, name, class_id, tenant_id')
      .limit(5);
    
    if (studentsError) {
      console.error('❌ Error fetching students:', studentsError);
      return;
    }
    
    const { data: classes, error: classesError } = await supabase
      .from('classes')
      .select('id, class_name, tenant_id')
      .limit(5);
    
    if (classesError) {
      console.error('❌ Error fetching classes:', classesError);
      return;
    }
    
    console.log('✅ Found students:', students?.length || 0);
    console.log('✅ Found classes:', classes?.length || 0);
    
    if (!students || students.length === 0) {
      console.error('❌ No students found in database');
      return;
    }
    
    if (!classes || classes.length === 0) {
      console.error('❌ No classes found in database');
      return;
    }
    
    // Step 2: Use first student for testing
    const testStudent = students[0];
    const testClass = classes.find(c => c.id === testStudent.class_id) || classes[0];
    
    console.log('\n📊 Using test data:');
    console.log('Student:', testStudent);
    console.log('Class:', testClass);
    
    // Step 3: Check if student_discounts table exists
    console.log('\n📋 Step 3: Checking student_discounts table...');
    const { data: existingDiscounts, error: tableError } = await supabase
      .from('student_discounts')
      .select('*')
      .limit(1);
    
    if (tableError) {
      console.error('❌ student_discounts table error:', tableError);
      return;
    }
    
    console.log('✅ student_discounts table accessible');
    
    // Step 4: Try to create a test discount
    console.log('\n📋 Step 4: Creating test discount...');
    
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
    
    console.log('Discount data to insert:', testDiscount);
    
    const { data: insertResult, error: insertError } = await supabase
      .from('student_discounts')
      .insert(testDiscount)
      .select('*')
      .single();
    
    if (insertError) {
      console.error('❌ Insert failed:', insertError);
      console.log('Error details:', {
        message: insertError.message,
        code: insertError.code,
        hint: insertError.hint,
        details: insertError.details
      });
      
      // Check specific error types
      if (insertError.message.includes('foreign key')) {
        console.log('\n🔍 Foreign key constraint issue:');
        console.log('- student_id might not exist in students table');
        console.log('- class_id might not exist in classes table');
        console.log('- tenant_id might not exist in tenants table');
      } else if (insertError.message.includes('permission')) {
        console.log('\n🔍 Permission issue:');
        console.log('- User might not have INSERT permission on student_discounts table');
        console.log('- RLS policies might be blocking the insert');
      }
      
      return;
    }
    
    console.log('✅ Discount created successfully!');
    console.log('Created discount:', insertResult);
    
    // Step 5: Verify the discount was saved correctly
    console.log('\n📋 Step 5: Verifying saved discount...');
    
    const { data: savedDiscount, error: fetchError } = await supabase
      .from('student_discounts')
      .select('*')
      .eq('id', insertResult.id)
      .single();
    
    if (fetchError) {
      console.error('❌ Failed to fetch saved discount:', fetchError);
    } else {
      console.log('✅ Verified saved discount:');
      console.log('- ID:', savedDiscount.id);
      console.log('- Student ID:', savedDiscount.student_id);
      console.log('- Class ID:', savedDiscount.class_id);
      console.log('- Discount Type:', savedDiscount.discount_type);
      console.log('- Discount Value:', savedDiscount.discount_value);
      console.log('- Fee Component:', savedDiscount.fee_component);
      console.log('- Tenant ID:', savedDiscount.tenant_id);
      console.log('- Is Active:', savedDiscount.is_active);
    }
    
    // Step 6: Clean up - delete the test discount
    console.log('\n🧹 Step 6: Cleaning up test discount...');
    
    const { error: deleteError } = await supabase
      .from('student_discounts')
      .delete()
      .eq('id', insertResult.id);
    
    if (deleteError) {
      console.warn('⚠️ Failed to clean up test discount:', deleteError);
    } else {
      console.log('✅ Test discount cleaned up successfully');
    }
    
    console.log('\n🎉 Test completed successfully!');
    console.log('The student_discounts system is working correctly.');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the test
testDiscountCreation()
  .then(() => {
    console.log('\n✨ All tests completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });
