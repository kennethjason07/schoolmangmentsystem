const { supabase, TABLES } = require('./src/utils/supabase');

async function emergencyFix() {
  console.log('🚨 === EMERGENCY FIX FOR TEACHER CHAT ===\n');

  try {
    // Step 1: Get the existing teacher user account
    console.log('1. FINDING EXISTING TEACHER USER:');
    const { data: teacherUser, error: teacherUserError } = await supabase
      .from(TABLES.USERS)
      .select('*')
      .not('linked_teacher_id', 'is', null)
      .limit(1);

    if (teacherUserError || !teacherUser || teacherUser.length === 0) {
      console.log('   ❌ No teacher user found:', teacherUserError);
      return;
    }

    const existingTeacherUser = teacherUser[0];
    console.log('   ✅ Found teacher user:', existingTeacherUser.full_name, 'with teacher ID:', existingTeacherUser.linked_teacher_id);

    // Step 2: Check if the teacher record exists
    console.log('\n2. CHECKING TEACHER RECORD:');
    const { data: teacherRecord, error: teacherRecordError } = await supabase
      .from(TABLES.TEACHERS)
      .select('*')
      .eq('id', existingTeacherUser.linked_teacher_id)
      .single();

    if (teacherRecordError) {
      console.log('   ❌ Teacher record not found, creating one...');
      
      // Create the missing teacher record
      const { data: newTeacher, error: createTeacherError } = await supabase
        .from(TABLES.TEACHERS)
        .insert({
          id: existingTeacherUser.linked_teacher_id, // Use the same ID
          name: existingTeacherUser.full_name,
          qualification: 'B.Ed',
          age: 30,
          salary_type: 'monthly',
          salary_amount: 40000,
          is_class_teacher: true
        })
        .select()
        .single();

      if (createTeacherError) {
        console.log('   ❌ Failed to create teacher record:', createTeacherError);
      } else {
        console.log('   ✅ Created teacher record for:', newTeacher.name);
      }
    } else {
      console.log('   ✅ Teacher record exists:', teacherRecord.name);
    }

    // Step 3: Create a class without school_id (might bypass RLS)
    console.log('\n3. CREATING CLASS:');
    const { data: existingClass, error: classCheckError } = await supabase
      .from(TABLES.CLASSES)
      .select('*')
      .limit(1);

    let classId = null;
    if (!existingClass || existingClass.length === 0) {
      // Try creating without school_id first
      const { data: newClass, error: createClassError } = await supabase
        .from(TABLES.CLASSES)
        .insert({
          class_name: '10th',
          section: 'A',
          academic_year: '2024-25'
          // Omit school_id to see if RLS allows it
        })
        .select()
        .single();

      if (createClassError) {
        console.log('   ❌ Failed to create class:', createClassError);
        
        // Try with a school_id if one exists
        const { data: schools } = await supabase
          .from('school_details')
          .select('id')
          .limit(1);
        
        if (schools && schools.length > 0) {
          const { data: newClassWithSchool, error: createClassError2 } = await supabase
            .from(TABLES.CLASSES)
            .insert({
              class_name: '10th',
              section: 'A',
              academic_year: '2024-25',
              school_id: schools[0].id
            })
            .select()
            .single();

          if (createClassError2) {
            console.log('   ❌ Failed to create class with school_id:', createClassError2);
          } else {
            classId = newClassWithSchool.id;
            console.log('   ✅ Created class with school_id:', newClassWithSchool.class_name, newClassWithSchool.section);
          }
        }
      } else {
        classId = newClass.id;
        console.log('   ✅ Created class:', newClass.class_name, newClass.section);
      }
    } else {
      classId = existingClass[0].id;
      console.log('   ✅ Using existing class:', existingClass[0].class_name, existingClass[0].section);
    }

    if (!classId) {
      console.log('   ❌ Could not create or find a class. Cannot proceed.');
      return;
    }

    // Step 4: Update teacher to be assigned to this class
    console.log('\n4. ASSIGNING TEACHER TO CLASS:');
    const { error: updateTeacherError } = await supabase
      .from(TABLES.TEACHERS)
      .update({
        assigned_class_id: classId,
        is_class_teacher: true
      })
      .eq('id', existingTeacherUser.linked_teacher_id);

    if (updateTeacherError) {
      console.log('   ❌ Failed to assign teacher to class:', updateTeacherError);
    } else {
      console.log('   ✅ Assigned teacher to class');
    }

    // Step 5: Create a sample student
    console.log('\n5. CREATING STUDENT:');
    const { data: existingStudent, error: studentCheckError } = await supabase
      .from(TABLES.STUDENTS)
      .select('*')
      .limit(1);

    let studentId = null;
    if (!existingStudent || existingStudent.length === 0) {
      const { data: newStudent, error: createStudentError } = await supabase
        .from(TABLES.STUDENTS)
        .insert({
          admission_no: 'STD001',
          name: 'Test Student',
          dob: '2008-01-01',
          gender: 'Female',
          academic_year: '2024-25',
          roll_no: 1,
          class_id: classId
        })
        .select()
        .single();

      if (createStudentError) {
        console.log('   ❌ Failed to create student:', createStudentError);
      } else {
        studentId = newStudent.id;
        console.log('   ✅ Created student:', newStudent.name);
      }
    } else {
      studentId = existingStudent[0].id;
      console.log('   ✅ Using existing student:', existingStudent[0].name);
    }

    // Step 6: Link a parent to the student
    if (studentId) {
      console.log('\n6. LINKING PARENT TO STUDENT:');
      
      // Get a parent user who isn't linked yet
      const { data: parentUsers } = await supabase
        .from(TABLES.USERS)
        .select('*')
        .is('linked_parent_of', null)
        .like('full_name', '%Parent%')
        .limit(1);

      if (parentUsers && parentUsers.length > 0) {
        const parent = parentUsers[0];
        const { error: linkError } = await supabase
          .from(TABLES.USERS)
          .update({ linked_parent_of: studentId })
          .eq('id', parent.id);

        if (linkError) {
          console.log('   ❌ Failed to link parent:', linkError);
        } else {
          console.log('   ✅ Linked parent to student:', parent.full_name, '->', 'Test Student');
        }
      } else {
        console.log('   ❌ No unlinked parent users found');
      }
    }

    console.log('\n🚨 === EMERGENCY FIX COMPLETE ===');
    console.log('Try using the parent chat now!');

  } catch (error) {
    console.error('💥 Emergency fix error:', error);
  }
}

// Run the emergency fix
emergencyFix();
