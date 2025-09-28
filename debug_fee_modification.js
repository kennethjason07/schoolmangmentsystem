/**
 * DEBUG SCRIPT: Find where fee_structure is being modified
 * This will help us identify exactly what code is changing the class-level fees
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const CLASS_3A_ID = '37b82e22-ff67-45f7-9df4-1e0201376fb9';

console.log('🔍 DEBUG: Starting fee modification detection...\n');

async function debugFeeModification() {
  try {
    console.log('📊 Step 1: Check current Class 3A fee structure...');
    
    const { data: currentFees, error: feeError } = await supabase
      .from('fee_structure')
      .select('*')
      .eq('class_id', CLASS_3A_ID)
      .is('student_id', null)
      .eq('academic_year', '2024-25')
      .order('fee_component');
      
    if (feeError) {
      console.error('❌ Error fetching current fees:', feeError);
      return;
    }
    
    console.log('Current Class 3A fees:');
    currentFees.forEach(fee => {
      console.log(`   ${fee.fee_component}: ₹${fee.amount} (discount_applied: ${fee.discount_applied || 0})`);
    });
    
    const tuitionFee = currentFees.find(f => f.fee_component.toLowerCase().includes('tution'));
    if (!tuitionFee) {
      console.error('❌ Tuition fee not found');
      return;
    }
    
    console.log(`\n📋 Using Tuition fee record: ${tuitionFee.id}`);
    console.log(`   Current amount: ₹${tuitionFee.amount}`);
    console.log(`   Current discount_applied: ${tuitionFee.discount_applied || 0}`);
    
    // Step 2: Get a test student
    console.log('\n👥 Step 2: Finding a test student...');
    
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, name, class_id')
      .eq('class_id', CLASS_3A_ID)
      .limit(1);
      
    if (studentsError || !students || students.length === 0) {
      console.error('❌ No test students found');
      return;
    }
    
    const testStudent = students[0];
    console.log(`Using test student: ${testStudent.name} (${testStudent.id})`);
    
    // Step 3: Create a test discount and monitor fee_structure changes
    console.log('\n🧪 Step 3: Creating test discount and monitoring fee_structure...');
    
    // Record current state
    const beforeState = {
      amount: tuitionFee.amount,
      base_amount: tuitionFee.base_amount,
      discount_applied: tuitionFee.discount_applied || 0
    };
    
    console.log('Before discount:', beforeState);
    
    // Create a small test discount
    const testDiscountAmount = 1000; // Small amount for testing
    
    console.log(`\n💸 Creating ₹${testDiscountAmount} discount for ${testStudent.name}...`);
    
    const { data: newDiscount, error: discountError } = await supabase
      .from('student_discounts')
      .insert({
        student_id: testStudent.id,
        class_id: CLASS_3A_ID,
        academic_year: '2024-25',
        discount_type: 'fixed_amount',
        discount_value: testDiscountAmount,
        fee_component: tuitionFee.fee_component,
        description: 'DEBUG TEST - Will be deleted',
        is_active: true,
        tenant_id: '11886b54-1756-4222-a2a6-656728c16a96' // Add tenant_id if required
      })
      .select()
      .single();
      
    if (discountError) {
      console.error('❌ Error creating test discount:', discountError);
      return;
    }
    
    console.log(`✅ Test discount created: ${newDiscount.id}`);
    
    // Immediately check if fee_structure was modified
    console.log('\n🔍 Step 4: Checking if fee_structure was modified...');
    
    const { data: afterFees, error: afterError } = await supabase
      .from('fee_structure')
      .select('*')
      .eq('id', tuitionFee.id)
      .single();
      
    if (afterError) {
      console.error('❌ Error fetching fees after discount:', afterError);
    } else {
      const afterState = {
        amount: afterFees.amount,
        base_amount: afterFees.base_amount,
        discount_applied: afterFees.discount_applied || 0
      };
      
      console.log('After discount:', afterState);
      
      // Compare states
      const wasModified = 
        beforeState.amount !== afterState.amount ||
        beforeState.base_amount !== afterState.base_amount ||
        beforeState.discount_applied !== afterState.discount_applied;
        
      if (wasModified) {
        console.log('🚨 FOUND THE PROBLEM! fee_structure was modified:');
        console.log('   Changes detected:');
        
        if (beforeState.amount !== afterState.amount) {
          console.log(`   - amount: ${beforeState.amount} → ${afterState.amount}`);
        }
        if (beforeState.base_amount !== afterState.base_amount) {
          console.log(`   - base_amount: ${beforeState.base_amount} → ${afterState.base_amount}`);
        }
        if (beforeState.discount_applied !== afterState.discount_applied) {
          console.log(`   - discount_applied: ${beforeState.discount_applied} → ${afterState.discount_applied}`);
        }
        
        console.log('\n💡 This confirms that creating a student_discount is somehow triggering');
        console.log('   code that modifies the class-level fee_structure record.');
        console.log('   Since we already disabled database triggers, this must be');
        console.log('   happening in your APPLICATION CODE.');
        
      } else {
        console.log('✅ Good news! fee_structure was NOT modified by the discount creation.');
        console.log('   The problem might be elsewhere in your workflow.');
      }
    }
    
    // Step 5: Clean up the test discount
    console.log('\n🧹 Step 5: Cleaning up test discount...');
    
    const { error: deleteError } = await supabase
      .from('student_discounts')
      .delete()
      .eq('id', newDiscount.id);
      
    if (deleteError) {
      console.warn('⚠️ Could not delete test discount:', deleteError);
    } else {
      console.log('✅ Test discount cleaned up');
    }
    
    // Step 6: Restore fee structure if it was modified
    if (afterFees && (afterFees.amount !== beforeState.amount || afterFees.discount_applied !== beforeState.discount_applied)) {
      console.log('\n🔧 Step 6: Restoring fee_structure to correct state...');
      
      const { error: restoreError } = await supabase
        .from('fee_structure')
        .update({
          amount: 25000,
          base_amount: 25000,
          discount_applied: 0
        })
        .eq('id', tuitionFee.id);
        
      if (restoreError) {
        console.error('❌ Error restoring fee_structure:', restoreError);
      } else {
        console.log('✅ fee_structure restored to correct values');
      }
    }
    
    console.log('\n🎯 SUMMARY:');
    console.log('   If fee_structure was modified by creating a student_discount,');
    console.log('   then the problem is in your APPLICATION CODE, not database triggers.');
    console.log('   Look for code that:');
    console.log('   1. Updates fee_structure when student_discounts are created');
    console.log('   2. Modifies the discount_applied column');
    console.log('   3. Changes the amount column based on discounts');
    console.log('\n   Search your codebase for:');
    console.log('   - UPDATE fee_structure');
    console.log('   - .update(\'fee_structure\'');  
    console.log('   - discount_applied');
    console.log('   - tenantDatabase.update');
    
  } catch (error) {
    console.error('💥 Debug script failed:', error);
  }
}

// Run the debug
debugFeeModification()
  .then(() => {
    console.log('\n✨ Debug completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Debug failed:', error);
    process.exit(1);
  });