

const { createClient } = require('@supabase/supabase-js');
const { faker } = require('@faker-js/faker');

// Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- Data Generation ---

const ACADEMIC_YEAR = '2024-2025';

// Generate classes
const classes = [
  { class_name: 'Class 1', section: 'A' },
  { class_name: 'Class 1', section: 'B' },
  { class_name: 'Class 2', section: 'A' },
  { class_name: 'Class 2', section: 'B' },
  { class_name: 'Class 3', section: 'A' },
  { class_name: 'Class 3', section: 'B' },
  { class_name: 'Class 4', section: 'A' },
  { class_name: 'Class 4', section: 'B' },
  { class_name: 'Class 5', section: 'A' },
  { class_name: 'Class 5', section: 'B' },
  { class_name: 'Class 6', section: 'A' },
  { class_name: 'Class 7', section: 'A' },
  { class_name: 'Class 8', section: 'A' },
  { class_name: 'Class 9', section: 'A' },
  { class_name: 'Class 10', section: 'A' },
];

// Generate teachers
const teachers = Array.from({ length: 10 }, () => ({
  name: faker.person.fullName(),
  qualification: faker.person.jobTitle(),
  age: faker.number.int({ min: 25, max: 60 }),
  salary_type: 'monthly',
  salary_amount: faker.number.int({ min: 30000, max: 60000 }),
  address: faker.location.streetAddress(),
}));

// Generate subjects
const subjects = [
  { name: 'English' },
  { name: 'Math' },
  { name: 'Science' },
  { name: 'Social Studies' },
  { name: 'Hindi' },
];

// Generate students
const students = (classIds) => Array.from({ length: 50 }, (_, i) => ({
  admission_no: `S${faker.string.uuid()}`,
  name: faker.person.fullName(),
  roll_no: i + 1,
  dob: faker.date.past(10, '2014-01-01'),
  gender: i % 2 === 0 ? 'Male' : 'Female',
  academic_year: ACADEMIC_YEAR,
  class_id: classIds[faker.number.int({ min: 0, max: classIds.length - 1 })],
}));

// Generate student attendance
const student_attendance = (studentIds, classIds) => {
  const attendanceRecords = [];
  const today = new Date();
  for (const studentId of studentIds) {
    // Generate attendance for the last 5 days for each student
    for (let i = 0; i < 5; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      attendanceRecords.push({
        student_id: studentId,
        class_id: classIds[faker.number.int({ min: 0, max: classIds.length - 1 })],
        date: date.toISOString().split('T')[0],
        status: Math.random() > 0.1 ? 'Present' : 'Absent',
      });
    }
  }
  return attendanceRecords;
};

// Generate student fees
const student_fees = (studentIds) => Array.from({ length: 100 }, () => ({
  student_id: studentIds[faker.number.int({ min: 0, max: studentIds.length - 1 })],
  academic_year: ACADEMIC_YEAR,
  fee_component: 'Tuition Fee',
  amount_paid: faker.number.int({ min: 5000, max: 15000 }),
  payment_date: faker.date.recent(60),
  payment_mode: 'Online',
}));

// --- Seeding Script ---

const seedDatabase = async () => {
  try {
    // Clear existing data in correct order to avoid foreign key constraints
    console.log('Clearing existing data...');
    await supabase.from('student_attendance').delete();
    await supabase.from('student_fees').delete();
    await supabase.from('students').delete();
    await supabase.from('subjects').delete();
    await supabase.from('teachers').delete();
    await supabase.from('classes').delete();
    console.log('Existing data cleared.');

    // 1. Insert Classes
    const { data: existingClasses, error: fetchClassesError } = await supabase
      .from('classes')
      .select('class_name, section, academic_year');
    if (fetchClassesError) throw fetchClassesError;

    const existingClassSet = new Set(existingClasses.map(c => `${c.class_name}-${c.section}-${c.academic_year}`));

    const classesToInsert = classes.filter(c => {
      const classKey = `${c.class_name}-${c.section}-${ACADEMIC_YEAR}`;
      return !existingClassSet.has(classKey);
    }).map(c => ({ ...c, academic_year: ACADEMIC_YEAR }));

    if (classesToInsert.length > 0) {
      const { data: classResult, error: classError } = await supabase
        .from('classes')
        .insert(classesToInsert)
        .select();
      if (classError) throw classError;
      console.log(`Inserted ${classResult.length} new classes`);
    } else {
      console.log('No new classes to insert, all already exist.');
    }
    const { data: allClasses, error: allClassesError } = await supabase.from('classes').select('id');
    if (allClassesError) throw allClassesError;
    const classIds = allClasses.map(c => c.id);

    // 2. Insert Teachers
    const { data: teacherResult, error: teacherError } = await supabase
      .from('teachers')
      .insert(teachers)
      .select();
    if (teacherError) throw teacherError;
    console.log('Inserted teachers');

    // 3. Insert Subjects
    const allSubjectsToInsert = [];
    for (const classId of classIds) {
      const { data: existingSubjects, error: fetchSubjectsError } = await supabase
        .from('subjects')
        .select('name, class_id, academic_year')
        .eq('class_id', classId);
      if (fetchSubjectsError) throw fetchSubjectsError;

      const existingSubjectSet = new Set(existingSubjects.map(s => `${s.name}-${s.class_id}-${s.academic_year}`));

      const subjectsToInsertForClass = subjects.filter(s => {
        const subjectKey = `${s.name}-${classId}-${ACADEMIC_YEAR}`;
        return !existingSubjectSet.has(subjectKey);
      }).map(s => ({ ...s, class_id: classId, academic_year: ACADEMIC_YEAR }));
      
      allSubjectsToInsert.push(...subjectsToInsertForClass);
    }

    if (allSubjectsToInsert.length > 0) {
      const { data: subjectResult, error: subjectError } = await supabase
        .from('subjects')
        .insert(allSubjectsToInsert)
        .select();
      if (subjectError) throw subjectError;
      console.log(`Inserted ${subjectResult.length} new subjects`);
    } else {
      console.log('No new subjects to insert, all already exist for all classes.');
    }

    // 4. Insert Students
    const studentData = students(classIds);
    const { data: studentResult, error: studentError } = await supabase
      .from('students')
      .insert(studentData)
      .select();
    if (studentError) throw studentError;
    const studentIds = studentResult.map(s => s.id);
    console.log('Inserted students');

    // 5. Insert Student Attendance
    const attendanceData = student_attendance(studentIds, classIds);
    const { error: attendanceError } = await supabase
      .from('student_attendance')
      .insert(attendanceData);
    if (attendanceError) throw attendanceError;
    console.log('Inserted student attendance');

    // 6. Insert Student Fees
    const feeData = student_fees(studentIds);
    const { error: feeError } = await supabase.from('student_fees').insert(feeData);
    if (feeError) throw feeError;
    console.log('Inserted student fees');

    console.log('\nDatabase seeding completed successfully!');

  } catch (error) {
    console.error('\nError seeding database:', error.message);
  }
};

seedDatabase();
