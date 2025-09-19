const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugFeeConcessionDelete() {
  console.log('🔍 Starting fee concession delete debug...\n');
  
  try {
    // Step 1: Check if student_discounts table exists and is accessible
    console.log('📋 Step 1: Checking student_discounts table access...');
    const { data: tableCheck, error: tableError } = await supabase
      .from('student_discounts')
      .select('id, student_id, discount_value, is_active, created_at')
      .limit(5);
    
    if (tableError) {
      console.error('❌ Cannot access student_discounts table:', tableError);
      return;
    }
    
    console.log('✅ student_discounts table is accessible');
    console.log('📊 Found records:', tableCheck?.length || 0);
    
    if (tableCheck && tableCheck.length > 0) {
      console.log('📝 Sample record structure:', Object.keys(tableCheck[0]));
      console.log('📝 First record:', tableCheck[0]);
    }
    
    // Step 2: Get real student and class IDs for testing
    console.log('\n📋 Step 2: Finding real student and class IDs...');
    
    // Get real student ID
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, class_id, tenant_id')
      .limit(1);
    
    if (studentsError) {
      console.error('❌ Cannot fetch students:', studentsError);
      console.error('💡 Cannot create test record without valid student_id');
    } else if (students && students.length > 0) {
      const student = students[0];
      console.log('✅ Found student:', student.id, 'in class:', student.class_id);
      
      // Try to create a test discount with real IDs
      console.log('\n📋 Step 3: Creating test discount with real IDs...');
      const testDiscount = {
        student_id: student.id,
        class_id: student.class_id,
        tenant_id: student.tenant_id, // Important for RLS
        academic_year: '2024-25',
        discount_type: 'fixed_amount',
        discount_value: 100,
        description: 'DEBUG: Test discount for delete functionality',
        is_active: true
      };
      
      const { data: createdDiscount, error: createError } = await supabase
        .from('student_discounts')
        .insert(testDiscount)
        .select()
        .single();
      
      if (createError) {
        console.error('❌ Cannot create test discount:', createError);
        
        if (createError.message.includes('permission') || createError.code === '42501') {
          console.error('🚫 Permission denied! RLS is blocking the operation.');
          console.error('💡 User needs proper authentication and tenant_id context.');
        }
      } else {
        console.log('✅ Created test discount:', createdDiscount.id);
        
        // Step 4: Test soft delete
        console.log('\n📋 Step 4: Testing soft delete (is_active = false)...');
        const { data: softDeleted, error: softDeleteError } = await supabase
          .from('student_discounts')
          .update({ is_active: false })
          .eq('id', createdDiscount.id)
          .select()
          .single();
        
        if (softDeleteError) {
          console.error('❌ Soft delete failed:', softDeleteError);
          if (softDeleteError.message.includes('permission')) {
            console.error('🚫 CRITICAL: Cannot update student_discounts due to permissions!');
            console.error('💡 This explains why fee concession delete is not working!');
          }
        } else {
          console.log('✅ Soft delete successful:', softDeleted);
        }
        
        // Step 5: Test hard delete
        console.log('\n📋 Step 5: Testing hard delete...');
        const { data: hardDeleted, error: hardDeleteError } = await supabase
          .from('student_discounts')
          .delete()
          .eq('id', createdDiscount.id)
          .select();
        
        if (hardDeleteError) {
          console.error('❌ Hard delete failed:', hardDeleteError);
          if (hardDeleteError.message.includes('permission')) {
            console.error('🚫 Permission denied for DELETE operation!');
          }
        } else {
          console.log('✅ Hard delete successful:', hardDeleted);
        }
      }
    } else {
      console.log('❌ No students found to test with');
    }
    
    
    // Step 6: Test with existing real data
    console.log('\n📋 Step 6: Testing with existing real discount data...');
    const { data: realDiscounts, error: realDiscountsError } = await supabase
      .from('student_discounts')
      .select('id, student_id, discount_value, is_active')
      .eq('is_active', true)
      .limit(1);
    
    if (realDiscountsError) {
      console.error('❌ Cannot fetch real discounts:', realDiscountsError);
    } else if (realDiscounts && realDiscounts.length > 0) {
      console.log('✅ Found real discount to test with:', realDiscounts[0]);
      
      // Test soft delete on real data
      const realDiscountId = realDiscounts[0].id;
      console.log('🧪 Testing soft delete on real discount:', realDiscountId);
      
      const { data: realSoftDelete, error: realSoftDeleteError } = await supabase
        .from('student_discounts')
        .update({ is_active: false })
        .eq('id', realDiscountId)
        .select()
        .single();
      
      if (realSoftDeleteError) {
        console.error('❌ Real soft delete failed:', realSoftDeleteError);
        
        // Analyze the error
        if (realSoftDeleteError.message.includes('permission')) {
          console.error('🚫 PERMISSION ISSUE: User cannot update student_discounts table');
          console.error('💡 This is likely due to Row Level Security (RLS) policies');
          console.error('💡 The user needs to have proper tenant_id matching the discount record');
          console.error('💡 🎯 ROOT CAUSE: This explains why fee concession delete is failing!');
        }
        
      } else {
        console.log('✅ Real soft delete successful');
        
        // Restore the record
        console.log('🔄 Restoring the record...');
        const { data: restored, error: restoreError } = await supabase
          .from('student_discounts')
          .update({ is_active: true })
          .eq('id', realDiscountId)
          .select()
          .single();
          
        if (restoreError) {
          console.error('❌ Failed to restore record:', restoreError);
        } else {
          console.log('✅ Record restored successfully');
        }
      }
    } else {
      console.log('ℹ️ No real discount records found to test with');
    }
    
  } catch (error) {
    console.error('💥 Unexpected error during debug:', error);
  }
}

// Step 7: Check RLS policies
async function checkRLSPolicies() {
  console.log('\n📋 Step 7: Checking RLS policies for student_discounts...');
  
  try {
    // This might not work with anon key, but let's try
    const { data: policies, error: policiesError } = await supabase
      .rpc('get_policies', { table_name: 'student_discounts' });
    
    if (policiesError) {
      console.log('ℹ️ Cannot check RLS policies directly (expected with anon key)');
      console.log('💡 RLS policies control who can insert/update/delete records');
      console.log('💡 Check your Supabase dashboard -> Authentication -> Policies');
    } else {
      console.log('📜 RLS Policies:', policies);
    }
  } catch (error) {
    console.log('ℹ️ RLS policy check not available:', error.message);
  }
}

// Run the debug
async function main() {
  await debugFeeConcessionDelete();
  await checkRLSPolicies();
  
  console.log('\n🎯 SUMMARY:');
  console.log('If you see permission errors, the most likely causes are:');
  console.log('1. Row Level Security (RLS) policies preventing access');
  console.log('2. User not having proper tenant_id context');
  console.log('3. Missing authentication or wrong user role');
  console.log('\n💡 SOLUTION:');
  console.log('1. Ensure user is properly logged in');
  console.log('2. Check tenant context is properly set');
  console.log('3. Verify RLS policies in Supabase dashboard');
  console.log('4. Make sure the delete function includes tenant_id filtering');
}

main().catch(console.error);
