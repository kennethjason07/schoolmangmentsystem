const { createClient } = require('@supabase/supabase-js');

// Mock environment variables for testing
const supabaseUrl = process.env.REACT_NATIVE_SUPABASE_URL || 'your-supabase-url';
const supabaseAnonKey = process.env.REACT_NATIVE_SUPABASE_ANON_KEY || 'your-anon-key';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Test class deletion functionality
async function testClassDeletion() {
  console.log('🧪 Starting class deletion test...');
  
  try {
    // Step 1: Check if we can connect to the database
    const { data: classes, error: classError } = await supabase
      .from('classes')
      .select('*')
      .limit(1);
      
    if (classError) {
      console.error('❌ Database connection failed:', classError.message);
      return;
    }
    
    console.log('✅ Database connection successful');
    console.log('📊 Found', classes?.length || 0, 'class(es) for testing');
    
    if (!classes || classes.length === 0) {
      console.log('⚠️ No classes found to test deletion with');
      return;
    }
    
    const testClass = classes[0];
    console.log('🎯 Using test class:', testClass.class_name, 'ID:', testClass.id);
    console.log('🏢 Tenant ID:', testClass.tenant_id);
    
    // Step 2: Check related data
    console.log('\n📋 Checking related data...');
    
    // Check subjects
    const { data: subjects } = await supabase
      .from('subjects')
      .select('id, name')
      .eq('class_id', testClass.id);
    console.log('📚 Subjects found:', subjects?.length || 0);
    
    // Check students
    const { data: students } = await supabase
      .from('students')
      .select('id, name')
      .eq('class_id', testClass.id);
    console.log('👥 Students found:', students?.length || 0);
    
    // Check timetable entries
    const { data: timetableEntries } = await supabase
      .from('timetable_entries')
      .select('id')
      .eq('class_id', testClass.id);
    console.log('📅 Timetable entries found:', timetableEntries?.length || 0);
    
    // Check assignments
    const { data: assignments } = await supabase
      .from('assignments')
      .select('id')
      .eq('class_id', testClass.id);
    console.log('📝 Assignments found:', assignments?.length || 0);
    
    // Check homeworks
    const { data: homeworks } = await supabase
      .from('homeworks')
      .select('id')
      .eq('class_id', testClass.id);
    console.log('🏠 Homeworks found:', homeworks?.length || 0);
    
    // Check exams
    const { data: exams } = await supabase
      .from('exams')
      .select('id')
      .eq('class_id', testClass.id);
    console.log('📊 Exams found:', exams?.length || 0);
    
    // Check fee structures
    const { data: feeStructures } = await supabase
      .from('fee_structure')
      .select('id')
      .eq('class_id', testClass.id);
    console.log('💰 Fee structures found:', feeStructures?.length || 0);
    
    // Step 3: Test deletion permissions
    console.log('\n🔒 Testing deletion permissions...');
    
    // Try a dry run delete on the class
    const { data: deleteTest, error: deleteError } = await supabase
      .from('classes')
      .delete()
      .eq('id', 'non-existent-id')  // Safe test with non-existent ID
      .select();
    
    if (deleteError) {
      console.error('❌ Delete permission test failed:', deleteError.message);
      console.error('🔧 Error code:', deleteError.code);
      console.error('🔧 Error details:', deleteError.details);
      
      // Check if it's a RLS policy issue
      if (deleteError.message.includes('row-level security') || 
          deleteError.message.includes('policy') ||
          deleteError.code === 'PGRST116') {
        console.log('🚨 ISSUE IDENTIFIED: Row Level Security (RLS) policy is blocking delete operations');
        console.log('💡 SOLUTION: Check your RLS policies on the classes table and related tables');
      }
      
      // Check if it's a foreign key constraint
      if (deleteError.code === '23503') {
        console.log('🚨 ISSUE IDENTIFIED: Foreign key constraint violation');
        console.log('💡 SOLUTION: Delete related records first before deleting the class');
      }
      
    } else {
      console.log('✅ Delete permissions appear to be working');
    }
    
    // Step 4: Test each deletion step individually
    console.log('\n🔍 Testing individual deletion steps...');
    
    if (subjects && subjects.length > 0) {
      console.log('Testing teacher_subjects deletion...');
      const { error: teacherSubjectsError } = await supabase
        .from('teacher_subjects')
        .delete()
        .in('subject_id', ['non-existent-id']);  // Safe test
        
      if (teacherSubjectsError) {
        console.error('❌ teacher_subjects deletion failed:', teacherSubjectsError.message);
      } else {
        console.log('✅ teacher_subjects deletion permissions OK');
      }
    }
    
    console.log('\n📊 Test Summary:');
    console.log('- Database connection: ✅');
    console.log('- Related data found:', {
      subjects: subjects?.length || 0,
      students: students?.length || 0,
      timetableEntries: timetableEntries?.length || 0,
      assignments: assignments?.length || 0,
      homeworks: homeworks?.length || 0,
      exams: exams?.length || 0,
      feeStructures: feeStructures?.length || 0
    });
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('🔧 Stack trace:', error.stack);
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testClassDeletion().then(() => {
    console.log('\n🏁 Test completed');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = { testClassDeletion };