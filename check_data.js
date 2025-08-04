const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const checkData = async () => {
  try {
    // Check classes
    console.log('=== CLASSES ===');
    const { data: classes, error: classError } = await supabase
      .from('classes')
      .select('*')
      .order('class_name');
    
    if (classError) throw classError;
    
    console.log(`Found ${classes.length} classes:`);
    classes.forEach(cls => {
      console.log(`- ${cls.class_name} ${cls.section} (ID: ${cls.id})`);
    });
    
    // Check students
    console.log('\n=== STUDENTS ===');
    const { data: students, error: studentError } = await supabase
      .from('students')
      .select(`
        *,
        classes(class_name, section)
      `)
      .order('roll_no');
    
    if (studentError) throw studentError;
    
    console.log(`Found ${students.length} students:`);
    students.forEach(student => {
      console.log(`- ${student.name} (Roll: ${student.roll_no}) - Class: ${student.classes?.class_name} ${student.classes?.section} (Class ID: ${student.class_id})`);
    });
    
    // Check students by class
    console.log('\n=== STUDENTS BY CLASS ===');
    for (const cls of classes) {
      const { data: classStudents, error: classStudentError } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', cls.id);
      
      if (classStudentError) throw classStudentError;
      
      console.log(`${cls.class_name} ${cls.section} (${cls.id}): ${classStudents.length} students`);
      classStudents.forEach(student => {
        console.log(`  - ${student.name} (Roll: ${student.roll_no})`);
      });
    }
    
  } catch (error) {
    console.error('Error checking data:', error);
  }
};

checkData(); 