import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('🔍 Investigating the discount_applied column error...\n');

async function checkDatabaseState() {
  try {
    console.log('📋 Step 1: Check if fee_structure table has discount_applied column...');
    
    // Check table schema
    const { data: schemaData, error: schemaError } = await supabase
      .rpc('exec_sql', { 
        query: `
          SELECT column_name, data_type, is_nullable 
          FROM information_schema.columns 
          WHERE table_name = 'fee_structure' 
          AND table_schema = 'public'
          ORDER BY ordinal_position;
        `
      });
    
    if (schemaError) {
      console.log('⚠️ Could not check schema via RPC, trying direct column access test...');
      
      // Try to query a column to see if it exists
      const { data: testData, error: testError } = await supabase
        .from('fee_structure')
        .select('id, discount_applied')
        .limit(1);
      
      if (testError) {
        console.error('❌ Error accessing discount_applied column:', testError);
        console.log('This confirms the column does NOT exist in the database');
      } else {
        console.log('✅ discount_applied column exists and is accessible');
        console.log('Sample data:', testData);
      }
    } else {
      console.log('✅ Schema check results:');
      schemaData.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type} (${col.is_nullable ? 'nullable' : 'not null'})`);
      });
    }
    
    console.log('\n📋 Step 2: Check for triggers on student_discounts table...');
    
    // Try to check for triggers using a different approach
    const { data: triggerData, error: triggerError } = await supabase
      .rpc('exec_sql', { 
        query: `
          SELECT 
            trigger_name, 
            event_manipulation, 
            action_statement,
            action_timing
          FROM information_schema.triggers 
          WHERE event_object_table = 'student_discounts';
        `
      });
    
    if (triggerError) {
      console.log('⚠️ Could not check triggers via RPC:', triggerError.message);
    } else if (triggerData && triggerData.length > 0) {
      console.log('🚨 FOUND TRIGGERS on student_discounts table:');
      triggerData.forEach(trigger => {
        console.log(`   - ${trigger.trigger_name}: ${trigger.event_manipulation} ${trigger.action_timing}`);
        console.log(`     Action: ${trigger.action_statement}`);
      });
    } else {
      console.log('✅ No triggers found on student_discounts table');
    }
    
    console.log('\n📋 Step 3: Check for views or functions that might reference discount_applied...');
    
    // Check for functions that might reference discount_applied
    const { data: functionData, error: functionError } = await supabase
      .rpc('exec_sql', { 
        query: `
          SELECT 
            routine_name,
            routine_type,
            routine_definition
          FROM information_schema.routines 
          WHERE routine_schema = 'public'
          AND routine_definition ILIKE '%discount_applied%'
          LIMIT 10;
        `
      });
    
    if (functionError) {
      console.log('⚠️ Could not check functions:', functionError.message);
    } else if (functionData && functionData.length > 0) {
      console.log('🚨 FOUND FUNCTIONS/PROCEDURES referencing discount_applied:');
      functionData.forEach(func => {
        console.log(`   - ${func.routine_name} (${func.routine_type})`);
      });
    } else {
      console.log('✅ No functions found referencing discount_applied');
    }
    
    console.log('\n📋 Step 4: Test direct insertion to student_discounts...');
    
    // Try to insert a test record directly
    const testDiscount = {
      student_id: 'test-student-123',
      class_id: 'test-class-123', 
      academic_year: '2024-25',
      discount_type: 'fixed_amount',
      discount_value: 100,
      description: 'Test discount for debugging',
      tenant_id: 'b8f8b5f0-1234-4567-8901-123456789000',
      is_active: true
    };
    
    console.log('Attempting to insert test discount...');
    
    const { data: insertData, error: insertError } = await supabase
      .from('student_discounts')
      .insert(testDiscount)
      .select()
      .single();
    
    if (insertError) {
      console.error('❌ INSERTION FAILED:', insertError);
      console.log('Error details:', {
        message: insertError.message,
        code: insertError.code,
        hint: insertError.hint,
        details: insertError.details
      });
      
      // Check if it's the discount_applied error
      if (insertError.message.includes('discount_applied')) {
        console.log('\n🎯 FOUND THE ISSUE: The error mentions discount_applied column');
        console.log('This suggests there is a trigger, function, or RLS policy that tries to access this column');
      }
    } else {
      console.log('✅ Insertion successful! Test record created:', insertData);
      
      // Clean up the test record
      const { error: deleteError } = await supabase
        .from('student_discounts')
        .delete()
        .eq('id', insertData.id);
      
      if (deleteError) {
        console.warn('⚠️ Could not clean up test record:', deleteError);
      } else {
        console.log('🧹 Test record cleaned up');
      }
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the investigation
checkDatabaseState()
  .then(() => {
    console.log('\n✨ Investigation completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Investigation failed:', error);
    process.exit(1);
  });
