const { createClient } = require('@supabase/supabase-js');

// Configure Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://mmpjgbvxhzqaoyuxobzm.supabase.co';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tcGpnYnZ4aHpxYW95dXhvYnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU2MjYyNTMsImV4cCI6MjA1MTIwMjI1M30.GVsOaV4F3FeUdU_RMUE0UOVUhUU3x0Q_rJwvpMF9M5s';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugDiscountDeletion() {
  try {
    console.log('🔍 Starting discount deletion debug...');
    
    // 1. Check the fee_structure table columns
    console.log('📋 Checking fee_structure table structure...');
    const { data: feeStructureSample, error: feeStructureError } = await supabase
      .from('fee_structure')
      .select('*')
      .limit(1);
    
    if (feeStructureError) {
      console.error('❌ Error accessing fee_structure:', feeStructureError);
    } else {
      console.log('✅ fee_structure table accessible');
      if (feeStructureSample && feeStructureSample.length > 0) {
        console.log('📊 Sample fee_structure record columns:', Object.keys(feeStructureSample[0]));
      }
    }
    
    // 2. Check student_discounts table
    console.log('📋 Checking student_discounts table structure...');
    const { data: discountsSample, error: discountsError } = await supabase
      .from('student_discounts')
      .select('*')
      .limit(1);
    
    if (discountsError) {
      console.error('❌ Error accessing student_discounts:', discountsError);
    } else {
      console.log('✅ student_discounts table accessible');
      if (discountsSample && discountsSample.length > 0) {
        console.log('📊 Sample student_discounts record columns:', Object.keys(discountsSample[0]));
      }
    }
    
    // 3. Try to directly select with discount_applied column
    console.log('🎯 Testing direct access to discount_applied column...');
    const { data: discountAppliedTest, error: discountAppliedError } = await supabase
      .from('fee_structure')
      .select('id, fee_component, amount, discount_applied')
      .limit(1);
      
    if (discountAppliedError) {
      console.error('❌ Error accessing discount_applied column:', discountAppliedError);
      console.log('💡 This confirms the column does not exist in the actual database table');
    } else {
      console.log('✅ discount_applied column exists and is accessible');
      console.log('📊 Sample data:', discountAppliedTest);
    }
    
    // 4. Check if there are any active student discounts
    console.log('🎫 Checking for active student discounts...');
    const { data: activeDiscounts, error: activeDiscountsError } = await supabase
      .from('student_discounts')
      .select('id, student_id, discount_value, is_active')
      .eq('is_active', true)
      .limit(5);
      
    if (activeDiscountsError) {
      console.error('❌ Error checking active discounts:', activeDiscountsError);
    } else {
      console.log('✅ Found active discounts:', activeDiscounts?.length || 0);
      if (activeDiscounts && activeDiscounts.length > 0) {
        console.log('📊 Sample discount:', activeDiscounts[0]);
      }
    }
    
  } catch (error) {
    console.error('💥 Unexpected error in debug:', error);
  }
}

debugDiscountDeletion();
