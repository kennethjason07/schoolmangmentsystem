const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const addTestStudents = async () => {
  try {
    // First, get a class ID
    const { data: classes, error: classError } = await supabase
      .from('classes')
      .select('id, class_name, section')
      .limit(1);
    
    if (classError) throw classError;
    
    if (!classes || classes.length === 0) {
      console.log('No classes found. Please create a class first.');
      return;
    }
    
    const classId = classes[0].id;
    console.log(`Using class: ${classes[0].class_name} ${classes[0].section} (ID: ${classId})`);
    
    // Add test students
    const testStudents = [
      {
        admission_no: 'S001',
        name: 'John Doe',
        roll_no: 1,
        dob: '2010-05-15',
        gender: 'Male',
        academic_year: '2024-25',
        class_id: classId,
        address: '123 Main St',
        blood_group: 'O+',
        mother_tongue: 'English'
      },
      {
        admission_no: 'S002',
        name: 'Jane Smith',
        roll_no: 2,
        dob: '2010-08-20',
        gender: 'Female',
        academic_year: '2024-25',
        class_id: classId,
        address: '456 Oak Ave',
        blood_group: 'A+',
        mother_tongue: 'English'
      },
      {
        admission_no: 'S003',
        name: 'Mike Johnson',
        roll_no: 3,
        dob: '2010-03-10',
        gender: 'Male',
        academic_year: '2024-25',
        class_id: classId,
        address: '789 Pine Rd',
        blood_group: 'B+',
        mother_tongue: 'English'
      },
      {
        admission_no: 'S004',
        name: 'Sarah Wilson',
        roll_no: 4,
        dob: '2010-11-25',
        gender: 'Female',
        academic_year: '2024-25',
        class_id: classId,
        address: '321 Elm St',
        blood_group: 'AB+',
        mother_tongue: 'English'
      },
      {
        admission_no: 'S005',
        name: 'David Brown',
        roll_no: 5,
        dob: '2010-07-05',
        gender: 'Male',
        academic_year: '2024-25',
        class_id: classId,
        address: '654 Maple Dr',
        blood_group: 'O-',
        mother_tongue: 'English'
      }
    ];
    
    const { data: students, error: studentError } = await supabase
      .from('students')
      .insert(testStudents)
      .select();
    
    if (studentError) throw studentError;
    
    console.log(`Successfully added ${students.length} test students:`);
    students.forEach(student => {
      console.log(`- ${student.name} (Roll No: ${student.roll_no})`);
    });
    
  } catch (error) {
    console.error('Error adding test students:', error);
  }
};

addTestStudents(); 