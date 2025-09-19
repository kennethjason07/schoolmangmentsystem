const { createClient } = require('@supabase/supabase-js');

// Import the exact same configuration and helpers used in the app
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Define TABLES constant exactly as in the app
const TABLES = {
  STUDENT_DISCOUNTS: 'student_discounts',
  STUDENTS: 'students',
  CLASSES: 'classes'
};

// Replicate the exact deleteStudentDiscount function from supabase.js
async function deleteStudentDiscount(discountId, hardDelete = false) {
  try {
    console.log('🗑️ [dbHelpers.deleteStudentDiscount] Called with:', { discountId, hardDelete });
    
    // Step 1: Get the discount details first so we can clean up related fee entries
    const { data: discountData, error: fetchError } = await supabase
      .from(TABLES.STUDENT_DISCOUNTS)
      .select('*')
      .eq('id', discountId)
      .single();

    if (fetchError) {
      console.error('❌ Error fetching discount for deletion:', fetchError);
      return { error: fetchError };
    }

    console.log('📄 Found discount to delete:', discountData);

    if (hardDelete) {
      // Step 2A: Hard delete - Remove the discount record completely
      const { error } = await supabase
        .from(TABLES.STUDENT_DISCOUNTS)
        .delete()
        .eq('id', discountId);
      
      if (error) {
        console.error('❌ Hard delete failed:', error);
        return { error };
      }
      
      console.log('✅ Hard deleted discount successfully');
      return { error: null };
    } else {
      // Step 2B: Soft delete by setting is_active to false
      const { data, error } = await supabase
        .from(TABLES.STUDENT_DISCOUNTS)
        .update({ is_active: false })
        .eq('id', discountId)
        .select()
        .single();
      
      if (error) {
        console.error('❌ Soft delete failed:', error);
        return { data: null, error };
      }
      
      console.log('✅ Soft deleted discount successfully:', data);
      return { data, error: null };
    }
  } catch (error) {
    console.error('💥 Exception in deleteStudentDiscount:', error);
    return { error };
  }
}

// Replicate the exact getDiscountsByStudent function (used to refresh data)
async function getDiscountsByStudent(studentId, academicYear = '2024-25') {
  try {
    console.log('🔍 [dbHelpers.getDiscountsByStudent] Called with:', { studentId, academicYear });
    
    const { data, error } = await supabase
      .from(TABLES.STUDENT_DISCOUNTS)
      .select(`
        *,
        students(id, name, admission_no, roll_no),
        classes(class_name, section)
      `)
      .eq('student_id', studentId)
      .eq('academic_year', academicYear)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching student discounts:', error);
      return { data: null, error };
    }

    console.log('📊 Found discounts for student:', data?.length || 0);
    return { data, error: null };
  } catch (error) {
    console.error('💥 Exception in getDiscountsByStudent:', error);
    return { data: null, error };
  }
}

async function testUIDeleteScenario() {
  console.log('🧪 TESTING UI DELETE SCENARIO');
  console.log('=' .repeat(50));
  
  try {
    // Step 1: Get a real student with existing discounts
    console.log('\n📋 Step 1: Finding student with existing discounts...');
    
    const { data: discounts, error: discountsError } = await supabase
      .from(TABLES.STUDENT_DISCOUNTS)
      .select('*, students(name), classes(class_name)')
      .eq('is_active', true)
      .limit(1);
      
    if (discountsError) {
      console.error('❌ Cannot fetch discounts:', discountsError);
      return;
    }
    
    if (!discounts || discounts.length === 0) {
      console.log('ℹ️ No active discounts found to test with.');
      console.log('💡 Creating a test discount first...');
      
      // Create a test discount to delete
      const { data: students, error: studentsError } = await supabase
        .from(TABLES.STUDENTS)
        .select('id, class_id, tenant_id')
        .limit(1);
        
      if (studentsError || !students || students.length === 0) {
        console.error('❌ Cannot find students to create test discount');
        return;
      }
      
      const student = students[0];
      const testDiscount = {
        student_id: student.id,
        class_id: student.class_id,
        tenant_id: student.tenant_id,
        academic_year: '2024-25',
        discount_type: 'fixed_amount',
        discount_value: 50,
        description: 'UI DELETE TEST: Test discount for delete functionality',
        is_active: true
      };
      
      const { data: createdDiscount, error: createError } = await supabase
        .from(TABLES.STUDENT_DISCOUNTS)
        .insert(testDiscount)
        .select()
        .single();
        
      if (createError) {
        console.error('❌ Cannot create test discount:', createError);
        return;
      }
      
      console.log('✅ Created test discount:', createdDiscount.id);
      discounts.push(createdDiscount);
    }
    
    const targetDiscount = discounts[0];
    console.log('🎯 Target discount for deletion:', {
      id: targetDiscount.id,
      student_id: targetDiscount.student_id,
      discount_value: targetDiscount.discount_value,
      description: targetDiscount.description,
      student_name: targetDiscount.students?.name || 'Unknown',
      class_name: targetDiscount.classes?.class_name || 'Unknown'
    });
    
    // Step 2: Test the exact UI delete flow
    console.log('\n📋 Step 2: Simulating UI delete flow...');
    console.log('🗑️ User clicked delete button, showing confirmation...');
    console.log('✅ User confirmed deletion, proceeding with delete...');
    
    // This is exactly what the UI calls
    const deleteResult = await deleteStudentDiscount(targetDiscount.id, false);
    
    console.log('\n📊 Delete Result Analysis:');
    console.log('- Has error:', !!deleteResult.error);
    console.log('- Has data:', !!deleteResult.data);
    
    if (deleteResult.error) {
      console.error('❌ DELETE FAILED IN UI SIMULATION:', deleteResult.error);
      console.error('Error analysis:', {
        message: deleteResult.error.message,
        code: deleteResult.error.code,
        hint: deleteResult.error.hint,
        details: deleteResult.error.details
      });
      
      // This is what would be shown to the user
      let errorMessage = deleteResult.error.message;
      if (deleteResult.error.message.includes('permission')) {
        errorMessage = 'You do not have permission to delete this concession. Please contact your administrator.';
      } else if (deleteResult.error.message.includes('foreign key')) {
        errorMessage = 'This concession cannot be deleted because it is linked to existing fee records. Please contact support.';
      } else if (deleteResult.error.message.includes('not found')) {
        errorMessage = 'The concession was not found. It may have been deleted already.';
      }
      
      console.log('📱 User would see this error message:', errorMessage);
      return;
    }
    
    console.log('✅ DELETE SUCCEEDED IN UI SIMULATION');
    console.log('📱 User would see: "Fee concession deleted successfully. The changes will be reflected in fee calculations."');
    
    // Step 3: Test the refresh functionality (loadStudentDiscounts)
    console.log('\n📋 Step 3: Simulating UI refresh after delete...');
    console.log('🔄 Calling getDiscountsByStudent to refresh data...');
    
    const refreshResult = await getDiscountsByStudent(targetDiscount.student_id, '2024-25');
    
    if (refreshResult.error) {
      console.error('❌ Refresh failed:', refreshResult.error);
    } else {
      console.log('✅ Refresh successful');
      console.log('📊 Remaining active discounts:', refreshResult.data?.length || 0);
      
      // Check if our deleted discount is still in the list
      const deletedDiscountStillVisible = refreshResult.data?.find(d => d.id === targetDiscount.id);
      
      if (deletedDiscountStillVisible) {
        console.error('❌ PROBLEM: Deleted discount is still visible in UI!');
        console.error('This could be why the user thinks delete is not working.');
        console.error('Deleted discount data:', deletedDiscountStillVisible);
      } else {
        console.log('✅ Deleted discount is no longer visible in UI - this is correct!');
      }
    }
    
    // Step 4: Verify the delete actually worked at database level
    console.log('\n📋 Step 4: Verifying delete worked at database level...');
    
    const { data: verifyData, error: verifyError } = await supabase
      .from(TABLES.STUDENT_DISCOUNTS)
      .select('id, is_active')
      .eq('id', targetDiscount.id)
      .single();
      
    if (verifyError) {
      if (verifyError.code === 'PGRST116') { // No rows found
        console.log('✅ Record was hard deleted - completely removed from database');
      } else {
        console.error('❌ Error verifying delete:', verifyError);
      }
    } else {
      if (verifyData.is_active === false) {
        console.log('✅ Record was soft deleted - marked as inactive');
      } else {
        console.error('❌ PROBLEM: Record is still active! Delete did not work.');
      }
    }
    
  } catch (error) {
    console.error('💥 Test failed with exception:', error);
  }
}

// Run the test
async function main() {
  await testUIDeleteScenario();
  
  console.log('\n🎯 TEST CONCLUSION:');
  console.log('If you see "DELETE SUCCEEDED IN UI SIMULATION" above,');
  console.log('then the delete functionality is working correctly.');
  console.log('');
  console.log('If the user is still seeing the deleted concessions in the UI,');
  console.log('the problem might be:');
  console.log('1. The UI is not refreshing properly after delete');
  console.log('2. The getDiscountsByStudent function has caching issues');
  console.log('3. The UI state is not being updated correctly');
  console.log('4. There might be a race condition in the refresh timing');
}

main().catch(console.error);
