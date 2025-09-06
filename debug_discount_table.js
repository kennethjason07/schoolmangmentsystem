import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://owlyxmubhryxdczapysg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93bHl4bXViaHJ5eGRjemFweXNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU3NDU2NDMsImV4cCI6MjA1MTMyMTY0M30.S6hIqxB0EpkLm91KXVZW0mAz5u7mSfUU_lk1ycCdNWE';
const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 Testing student_discounts table access...');

async function testStudentDiscountsTable() {
  try {
    // Test 1: Check if table exists and we can query it
    console.log('\n📋 Test 1: Basic table access...');
    const { data: basicData, error: basicError } = await supabase
      .from('student_discounts')
      .select('*')
      .limit(1);
    
    if (basicError) {
      console.error('❌ Basic table access failed:', basicError);
      console.log('Error details:', {
        message: basicError.message,
        code: basicError.code,
        hint: basicError.hint
      });
      return;
    }
    
    console.log('✅ Basic table access successful');
    console.log('Data:', basicData);
    
    // Test 2: Check table schema
    console.log('\n📋 Test 2: Checking table schema...');
    const { data: schemaData, error: schemaError } = await supabase
      .from('student_discounts')
      .select('*')
      .limit(0); // Get no data, just to check schema
    
    if (schemaError) {
      console.error('❌ Schema check failed:', schemaError);
      return;
    }
    
    console.log('✅ Schema check successful');
    
    // Test 3: Try to insert a test record (then delete it)
    console.log('\n📋 Test 3: Testing insert capability...');
    
    const testData = {
      student_id: 'test-student-id',
      class_id: 'test-class-id',
      academic_year: '2024-25',
      discount_type: 'fixed_amount',
      discount_value: 100,
      description: 'Test discount - will be deleted',
      tenant_id: 'b8f8b5f0-1234-4567-8901-123456789000',
      is_active: true
    };
    
    const { data: insertData, error: insertError } = await supabase
      .from('student_discounts')
      .insert(testData)
      .select()
      .single();
    
    if (insertError) {
      console.error('❌ Insert test failed:', insertError);
      console.log('Error details:', {
        message: insertError.message,
        code: insertError.code,
        hint: insertError.hint,
        details: insertError.details
      });
      
      // Check if it's a foreign key constraint issue
      if (insertError.message.includes('foreign key')) {
        console.log('🔍 Foreign key constraint detected. This might be the issue!');
        console.log('The student_id or class_id might not exist in the referenced tables.');
      }
      
      return;
    }
    
    console.log('✅ Insert test successful');
    console.log('Inserted data:', insertData);
    
    // Clean up: Delete the test record
    console.log('\n🧹 Cleaning up test record...');
    const { error: deleteError } = await supabase
      .from('student_discounts')
      .delete()
      .eq('id', insertData.id);
    
    if (deleteError) {
      console.warn('⚠️ Failed to clean up test record:', deleteError);
    } else {
      console.log('✅ Test record cleaned up successfully');
    }
    
    console.log('\n🎉 All tests passed! student_discounts table is working correctly.');
    
  } catch (error) {
    console.error('❌ Unexpected error during testing:', error);
  }
}

// Run the test
testStudentDiscountsTable()
  .then(() => {
    console.log('\n✨ Testing completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Test execution failed:', error);
    process.exit(1);
  });
