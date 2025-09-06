import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('🔍 Finding database triggers that cause discount_applied error...\n');

async function findTriggers() {
  try {
    console.log('📋 Step 1: Check if discount_applied column was successfully added...');
    
    // Check if column exists now
    const { data: testData, error: testError } = await supabase
      .from('fee_structure')
      .select('id, discount_applied')
      .limit(1);
    
    if (testError) {
      console.log('❌ Column still missing! Please make sure you ran:');
      console.log('ALTER TABLE public.fee_structure ADD COLUMN discount_applied numeric DEFAULT 0;');
      return;
    }
    
    console.log('✅ discount_applied column exists');
    
    console.log('\n📋 Step 2: Looking for database functions that might cause this...');
    
    // Since we can't directly query triggers via Supabase client, let's try a different approach
    // Let's check if there are any stored procedures or functions that might be involved
    
    // Try to get a list of all functions in the database
    const { data, error } = await supabase.rpc('get_schema_version');
    
    if (error && error.message.includes('Could not find the function')) {
      console.log('⚠️ Cannot directly query database functions via Supabase client');
      console.log('This is likely due to RLS policies or permissions');
    }
    
    console.log('\n📋 Step 3: Generate SQL commands to check for triggers...');
    console.log('Please run these SQL commands in your Supabase SQL Editor to find the problematic triggers:');
    console.log('');
    console.log('-- 1. Check for triggers on student_discounts table:');
    console.log('SELECT trigger_name, event_manipulation, action_statement, action_timing');
    console.log("FROM information_schema.triggers");
    console.log("WHERE event_object_table = 'student_discounts';");
    console.log('');
    console.log('-- 2. Check for functions that reference discount_applied:');
    console.log('SELECT routine_name, routine_type');
    console.log('FROM information_schema.routines');
    console.log("WHERE routine_schema = 'public'");
    console.log("AND routine_definition ILIKE '%discount_applied%';");
    console.log('');
    console.log('-- 3. Check for any RLS policies that might cause issues:');
    console.log('SELECT schemaname, tablename, policyname, cmd, qual');
    console.log('FROM pg_policies');
    console.log("WHERE tablename IN ('student_discounts', 'fee_structure');");
    console.log('');
    
    console.log('\n📋 Step 4: Try inserting a test discount to see the exact error...');
    
    // Get real student data for testing
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, name, class_id, tenant_id')
      .limit(1);
    
    if (studentsError || !students || students.length === 0) {
      console.log('⚠️ No students found for testing');
      return;
    }
    
    const testStudent = students[0];
    console.log('Using test student:', testStudent.name);
    
    // Try to insert a test discount
    const testDiscount = {
      student_id: testStudent.id,
      class_id: testStudent.class_id,
      academic_year: '2024-25',
      discount_type: 'fixed_amount',
      discount_value: 100,
      fee_component: 'Tuition Fee',
      description: 'Test discount for debugging',
      tenant_id: testStudent.tenant_id,
      is_active: true
    };
    
    console.log('Attempting test insertion...');
    
    const { data: insertData, error: insertError } = await supabase
      .from('student_discounts')
      .insert(testDiscount)
      .select()
      .single();
    
    if (insertError) {
      console.error('❌ INSERTION STILL FAILS:', insertError.message);
      console.log('Error code:', insertError.code);
      
      if (insertError.message.includes('discount_applied')) {
        console.log('\n🚨 CONFIRMED: There is a trigger or function that tries to access discount_applied');
        console.log('\n🔧 SOLUTION: You need to run these SQL commands to disable the problematic triggers:');
        console.log('');
        console.log('-- First, find all triggers on student_discounts:');
        console.log("SELECT 'DROP TRIGGER ' || trigger_name || ' ON ' || event_object_table || ';' as drop_command");
        console.log("FROM information_schema.triggers");
        console.log("WHERE event_object_table = 'student_discounts';");
        console.log('');
        console.log('-- Then run the DROP TRIGGER commands that are generated');
        console.log('-- OR temporarily disable them to test:');
        console.log("-- ALTER TABLE student_discounts DISABLE TRIGGER ALL;");
        console.log('-- (Re-enable later with: ALTER TABLE student_discounts ENABLE TRIGGER ALL;)');
      }
    } else {
      console.log('✅ SUCCESS! Test discount created:', insertData.id);
      
      // Clean up
      await supabase.from('student_discounts').delete().eq('id', insertData.id);
      console.log('🧹 Test data cleaned up');
      console.log('\n🎉 The issue appears to be fixed!');
    }
    
  } catch (error) {
    console.error('❌ Error during investigation:', error);
  }
}

// Run the investigation
findTriggers()
  .then(() => {
    console.log('\n✨ Investigation completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Investigation failed:', error);
    process.exit(1);
  });
