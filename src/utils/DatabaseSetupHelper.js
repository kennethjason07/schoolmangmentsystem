import { supabase, TABLES } from './supabase';

export const DatabaseSetupHelper = {
  // Create parent accounts for existing students
  createParentAccounts: async () => {
    try {
      console.log('🔧 Creating parent accounts for existing students...');
      
      // Get all students without parent accounts
      const { data: students, error: studentsError } = await supabase
        .from(TABLES.STUDENTS)
        .select('*');

      if (studentsError) throw studentsError;
      
      console.log('👥 Found students:', students.length);

      for (let student of students) {
        // Check if student already has a parent_id set
        if (student.parent_id) {
          console.log(`✅ Student ${student.name} already has parent_id: ${student.parent_id}`);
          continue;
        }

        // Check if parent user already exists for this student
        const { data: existingParent } = await supabase
          .from(TABLES.USERS)
          .select('*')
          .eq('linked_parent_of', student.id)
          .single();

        if (existingParent) {
          console.log(`✅ Parent user already exists for ${student.name}, updating student.parent_id`);
          
          // Update student's parent_id to link to the existing parent user
          const { error: updateError } = await supabase
            .from(TABLES.STUDENTS)
            .update({ parent_id: existingParent.id })
            .eq('id', student.id);

          if (updateError) {
            console.error(`❌ Failed to update parent_id for ${student.name}:`, updateError);
          } else {
            console.log(`✅ Updated parent_id for ${student.name}`);
          }
          continue;
        }

        // Create parent user account
        const parentEmail = `parent.${student.name.toLowerCase().replace(/\s+/g, '')}@example.com`;
        const parentUserData = {
          email: parentEmail,
          full_name: `Parent of ${student.name}`,
          phone: `+1555${Math.floor(1000000 + Math.random() * 9000000)}`, // Random phone
          role_id: 3, // Parent role
          linked_parent_of: student.id, // Link to student
          password: 'parent123' // Default password
        };

        const { data: parentUser, error: parentUserError } = await supabase
          .from(TABLES.USERS)
          .insert(parentUserData)
          .select()
          .single();

        if (parentUserError) {
          console.error(`❌ Failed to create parent user for ${student.name}:`, parentUserError);
          continue;
        }

        console.log(`✅ Created parent user for ${student.name}: ${parentEmail}`);

        // Update student's parent_id to link to the new parent user
        const { error: updateError } = await supabase
          .from(TABLES.STUDENTS)
          .update({ parent_id: parentUser.id })
          .eq('id', student.id);

        if (updateError) {
          console.error(`❌ Failed to update parent_id for ${student.name}:`, updateError);
        } else {
          console.log(`✅ Linked student ${student.name} to parent user ${parentEmail}`);
        }
      }

      console.log('✅ Parent account creation completed!');
      return { success: true };
    } catch (error) {
      console.error('❌ Error creating parent accounts:', error);
      return { success: false, error: error.message };
    }
  },

  // Setup Bheem Rao Patil as class teacher of Class 3 A
  setupBheemRaoPatilAsClassTeacher: async () => {
    try {
      console.log('🔧 Setting up Bheem Rao Patil as Class Teacher...');
      
      // Find Bheem Rao Patil teacher record
      const { data: teacher, error: teacherError } = await supabase
        .from(TABLES.TEACHERS)
        .select('*')
        .ilike('name', '%Bheem%Rao%Patil%')
        .single();

      if (teacherError || !teacher) {
        console.log('❌ Bheem Rao Patil teacher not found:', teacherError);
        return { success: false, error: 'Bheem Rao Patil teacher not found' };
      }

      console.log('✅ Found teacher:', teacher.name, 'ID:', teacher.id);

      // Find or create Class 3 A
      let { data: targetClass, error: classError } = await supabase
        .from(TABLES.CLASSES)
        .select('*')
        .eq('class_name', '3')
        .eq('section', 'A')
        .single();

      if (classError && classError.code === 'PGRST116') {
        // Class doesn't exist, create it
        const { data: newClass, error: createError } = await supabase
          .from(TABLES.CLASSES)
          .insert({
            class_name: '3',
            section: 'A',
            academic_year: '2024-25',
            class_teacher_id: teacher.id,
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (createError) throw createError;
        targetClass = newClass;
        console.log('✅ Created Class 3 A with class teacher assignment');
      } else if (classError) {
        throw classError;
      } else {
        // Class exists, update class teacher
        const { data: updatedClass, error: updateError } = await supabase
          .from(TABLES.CLASSES)
          .update({ class_teacher_id: teacher.id })
          .eq('id', targetClass.id)
          .select()
          .single();

        if (updateError) throw updateError;
        targetClass = updatedClass;
        console.log('✅ Updated Class 3 A class teacher assignment');
      }

      // Create some students for Class 3 A if none exist
      const { data: existingStudents } = await supabase
        .from(TABLES.STUDENTS)
        .select('*')
        .eq('class_id', targetClass.id);

      if (!existingStudents || existingStudents.length === 0) {
        console.log('🔧 Creating sample students for Class 3 A...');
        
        const sampleStudents = [
          { name: 'Aarav Kumar', roll_no: '3A01', gender: 'Male' },
          { name: 'Ananya Sharma', roll_no: '3A02', gender: 'Female' },
          { name: 'Arjun Singh', roll_no: '3A03', gender: 'Male' },
          { name: 'Diya Patel', roll_no: '3A04', gender: 'Female' },
          { name: 'Ishaan Gupta', roll_no: '3A05', gender: 'Male' }
        ];

        for (let studentData of sampleStudents) {
          const { data: newStudent, error: studentError } = await supabase
            .from(TABLES.STUDENTS)
            .insert({
              ...studentData,
              class_id: targetClass.id,
              admission_no: `ADM2024${studentData.roll_no}`,
              academic_year: '2024-25',
              dob: '2014-01-01', // Sample DOB for class 3 students
              address: 'Sample Address, City',
              created_at: new Date().toISOString()
            })
            .select()
            .single();

          if (studentError) {
            console.error(`❌ Failed to create student ${studentData.name}:`, studentError);
          } else {
            console.log(`✅ Created student: ${studentData.name} (${studentData.roll_no})`);
          }
        }
      } else {
        console.log(`✅ Class 3 A already has ${existingStudents.length} students`);
      }

      return { success: true, teacher, class: targetClass };
    } catch (error) {
      console.error('❌ Error setting up Bheem Rao Patil:', error);
      return { success: false, error: error.message };
    }
  },

  // Assign subjects to teacher
  assignSubjectsToTeacher: async (teacherId, classId, subjectNames = ['Mathematics', 'Science', 'English']) => {
    try {
      console.log('🔧 Assigning subjects to teacher...', { teacherId, classId, subjectNames });
      
      // First, get or create subjects for the class
      const assignments = [];
      
      for (let subjectName of subjectNames) {
        // Check if subject exists
        let { data: subject, error: subjectError } = await supabase
          .from(TABLES.SUBJECTS)
          .select('*')
          .eq('name', subjectName)
          .eq('class_id', classId)
          .single();

        if (subjectError && subjectError.code === 'PGRST116') {
          // Subject doesn't exist, create it
          const { data: newSubject, error: createError } = await supabase
            .from(TABLES.SUBJECTS)
            .insert({
              name: subjectName,
              class_id: classId,
              created_at: new Date().toISOString()
            })
            .select()
            .single();

          if (createError) throw createError;
          subject = newSubject;
          console.log(`✅ Created subject: ${subjectName}`);
        }

        // Now assign teacher to subject
        const { data: assignment, error: assignError } = await supabase
          .from(TABLES.TEACHER_SUBJECTS)
          .upsert({
            teacher_id: teacherId,
            subject_id: subject.id,
            created_at: new Date().toISOString()
          }, {
            onConflict: 'teacher_id,subject_id'
          })
          .select()
          .single();

        if (assignError) throw assignError;
        assignments.push(assignment);
        console.log(`✅ Assigned ${subjectName} to teacher`);
      }

      console.log('✅ Subject assignment completed!', assignments.length, 'subjects assigned');
      return { success: true, assignments };
    } catch (error) {
      console.error('❌ Error assigning subjects:', error);
      return { success: false, error: error.message };
    }
  },

  // Create sample timetable entries
  createSampleTimetable: async (teacherId, classId) => {
    try {
      console.log('🔧 Creating sample timetable entries...');
      
      // Get teacher's subjects
      const { data: teacherSubjects, error: subjectsError } = await supabase
        .from(TABLES.TEACHER_SUBJECTS)
        .select('*, subjects(*)')
        .eq('teacher_id', teacherId);

      if (subjectsError) throw subjectsError;

      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      const timeSlots = [
        { period: 1, start: '09:00', end: '09:45' },
        { period: 2, start: '09:45', end: '10:30' },
        { period: 3, start: '10:45', end: '11:30' },
        { period: 4, start: '11:30', end: '12:15' }
      ];

      const timetableEntries = [];

      // Create some sample entries
      for (let i = 0; i < Math.min(teacherSubjects.length, 8); i++) {
        const subject = teacherSubjects[i % teacherSubjects.length];
        const day = days[Math.floor(i / 2)];
        const timeSlot = timeSlots[i % timeSlots.length];

        const entry = {
          teacher_id: teacherId,
          subject_id: subject.subject_id,
          class_id: classId,
          day_of_week: day,
          start_time: timeSlot.start,
          end_time: timeSlot.end,
          period_number: timeSlot.period,
          academic_year: '2024-25'
        };

        timetableEntries.push(entry);
      }

      const { data: insertedEntries, error: insertError } = await supabase
        .from(TABLES.TIMETABLE)
        .insert(timetableEntries)
        .select();

      if (insertError) throw insertError;

      console.log('✅ Created', insertedEntries.length, 'timetable entries');
      return { success: true, entries: insertedEntries };
    } catch (error) {
      console.error('❌ Error creating timetable:', error);
      return { success: false, error: error.message };
    }
  }
};

// Function to run all setup steps
export const setupTeacherData = async (userId) => {
  try {
    console.log('🚀 Starting teacher data setup for user:', userId);
    
    // Get teacher info
    const { data: user, error: userError } = await supabase
      .from(TABLES.USERS)
      .select('*, teachers(*)')
      .eq('id', userId)
      .single();

    if (userError) throw userError;
    
    const teacherId = user.linked_teacher_id;
    if (!teacherId) {
      throw new Error('No teacher linked to this user');
    }

    // Get teacher's class (if class teacher)
    const { data: teacherClass, error: classError } = await supabase
      .from(TABLES.CLASSES)
      .select('*')
      .eq('class_teacher_id', teacherId)
      .single();

    if (classError && classError.code !== 'PGRST116') {
      throw classError;
    }

    const classId = teacherClass?.id;
    if (!classId) {
      console.log('⚠️ Teacher is not assigned as class teacher to any class');
      return { success: false, error: 'Teacher not assigned to any class' };
    }

    // Step 1: Create parent accounts
    await DatabaseSetupHelper.createParentAccounts();
    
    // Step 2: Assign subjects to teacher
    await DatabaseSetupHelper.assignSubjectsToTeacher(teacherId, classId);
    
    // Step 3: Create sample timetable
    await DatabaseSetupHelper.createSampleTimetable(teacherId, classId);
    
    console.log('🎉 Teacher data setup completed successfully!');
    return { success: true };
  } catch (error) {
    console.error('❌ Teacher data setup failed:', error);
    return { success: false, error: error.message };
  }
};
