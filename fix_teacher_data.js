const { supabase, TABLES } = require('./src/utils/supabase');

async function fixTeacherData() {
  console.log('🔧 === FIXING TEACHER DATA ISSUES ===\n');

  try {
    // 1. First, let's check what data we need to create
    console.log('1. CHECKING EXISTING DATA:');
    
    // Check classes
    const { data: classes, error: classesError } = await supabase
      .from(TABLES.CLASSES)
      .select('*')
      .limit(5);
    
    console.log('   Classes found:', classes?.length || 0);
    if (classes?.length > 0) {
      classes.forEach(cls => {
        console.log(`   - ${cls.class_name} ${cls.section} (ID: ${cls.id})`);
      });
    }

    // Check teachers in detail
    const { data: teachers, error: teachersError } = await supabase
      .from(TABLES.TEACHERS)
      .select('*')
      .limit(5);
    
    console.log('   Teachers found:', teachers?.length || 0);
    if (teachers?.length > 0) {
      teachers.forEach(teacher => {
        console.log(`   - ${teacher.name} (ID: ${teacher.id}) | Class Teacher: ${teacher.is_class_teacher} | Assigned: ${teacher.assigned_class_id}`);
      });
    }

    // Check subjects
    const { data: subjects, error: subjectsError } = await supabase
      .from(TABLES.SUBJECTS)
      .select('*')
      .limit(5);
    
    console.log('   Subjects found:', subjects?.length || 0);
    if (subjects?.length > 0) {
      subjects.forEach(subject => {
        console.log(`   - ${subject.name} (Class: ${subject.class_id})`);
      });
    }

    // 2. If no classes exist, we need to create some basic data
    let classId = null;
    if (!classes || classes.length === 0) {
      console.log('\n2. CREATING SAMPLE CLASS:');
      const { data: newClass, error: createClassError } = await supabase
        .from(TABLES.CLASSES)
        .insert({
          class_name: '10th',
          section: 'A',
          academic_year: '2024-25'
        })
        .select()
        .single();

      if (createClassError) {
        console.log('   Error creating class:', createClassError);
        return;
      } else {
        classId = newClass.id;
        console.log('   ✅ Created class:', newClass.class_name, newClass.section, `(ID: ${classId})`);
      }
    } else {
      classId = classes[0].id;
      console.log('\n2. USING EXISTING CLASS:', classes[0].class_name, classes[0].section);
    }

    // 3. Create/update teachers if needed
    if (!teachers || teachers.length === 0) {
      console.log('\n3. CREATING SAMPLE TEACHERS:');
      
      // Create a class teacher
      const { data: classTeacher, error: ctError } = await supabase
        .from(TABLES.TEACHERS)
        .insert({
          name: 'Mr. John Smith',
          qualification: 'M.Ed',
          age: 35,
          salary_type: 'monthly',
          salary_amount: 50000,
          is_class_teacher: true,
          assigned_class_id: classId
        })
        .select()
        .single();

      if (ctError) {
        console.log('   Error creating class teacher:', ctError);
      } else {
        console.log('   ✅ Created class teacher:', classTeacher.name);
      }

      // Create a subject teacher
      const { data: subjectTeacher, error: stError } = await supabase
        .from(TABLES.TEACHERS)
        .insert({
          name: 'Ms. Mary Johnson',
          qualification: 'M.Sc Mathematics',
          age: 30,
          salary_type: 'monthly',
          salary_amount: 45000,
          is_class_teacher: false
        })
        .select()
        .single();

      if (stError) {
        console.log('   Error creating subject teacher:', stError);
      } else {
        console.log('   ✅ Created subject teacher:', subjectTeacher.name);
      }
    } else {
      console.log('\n3. UPDATING EXISTING TEACHER ASSIGNMENTS:');
      
      // Update first teacher to be a class teacher for our class
      const teacherToUpdate = teachers[0];
      const { error: updateError } = await supabase
        .from(TABLES.TEACHERS)
        .update({
          is_class_teacher: true,
          assigned_class_id: classId
        })
        .eq('id', teacherToUpdate.id);

      if (updateError) {
        console.log('   Error updating teacher:', updateError);
      } else {
        console.log('   ✅ Updated teacher to class teacher:', teacherToUpdate.name);
      }
    }

    // 4. Create subjects for the class if none exist
    if (!subjects || subjects.length === 0) {
      console.log('\n4. CREATING SAMPLE SUBJECTS:');
      
      const subjectsToCreate = [
        { name: 'Mathematics', class_id: classId, academic_year: '2024-25' },
        { name: 'English', class_id: classId, academic_year: '2024-25' },
        { name: 'Science', class_id: classId, academic_year: '2024-25' }
      ];

      for (const subject of subjectsToCreate) {
        const { data: newSubject, error: subjectError } = await supabase
          .from(TABLES.SUBJECTS)
          .insert(subject)
          .select()
          .single();

        if (subjectError) {
          console.log('   Error creating subject:', subject.name, subjectError);
        } else {
          console.log('   ✅ Created subject:', newSubject.name);
        }
      }
    }

    // 5. Create a sample student
    console.log('\n5. CREATING SAMPLE STUDENT:');
    
    const { data: student, error: studentError } = await supabase
      .from(TABLES.STUDENTS)
      .insert({
        admission_no: 'STD001',
        name: 'Alice Johnson',
        dob: '2008-05-15',
        gender: 'Female',
        academic_year: '2024-25',
        roll_no: 1,
        class_id: classId
      })
      .select()
      .single();

    if (studentError) {
      console.log('   Error creating student:', studentError);
    } else {
      console.log('   ✅ Created student:', student.name);
      
      // 6. Link a parent to this student
      console.log('\n6. LINKING PARENT TO STUDENT:');
      
      // Get a parent user
      const { data: parentUsers } = await supabase
        .from(TABLES.USERS)
        .select('*')
        .not('linked_parent_of', 'is', null)
        .limit(1);

      if (parentUsers && parentUsers.length > 0) {
        const parent = parentUsers[0];
        const { error: linkError } = await supabase
          .from(TABLES.USERS)
          .update({ linked_parent_of: student.id })
          .eq('id', parent.id);

        if (linkError) {
          console.log('   Error linking parent:', linkError);
        } else {
          console.log('   ✅ Linked parent to student:', parent.full_name, '->', student.name);
        }
      } else {
        console.log('   No parent users found to link');
      }
    }

    // 7. Create user accounts for teachers if they don't exist
    console.log('\n7. CREATING TEACHER USER ACCOUNTS:');
    
    const { data: allTeachers } = await supabase
      .from(TABLES.TEACHERS)
      .select('*');

    for (const teacher of allTeachers || []) {
      // Check if teacher already has a user account
      const { data: existingUser } = await supabase
        .from(TABLES.USERS)
        .select('id')
        .eq('linked_teacher_id', teacher.id)
        .single();

      if (!existingUser) {
        // Create user account for teacher
        const email = teacher.name.toLowerCase().replace(/[^a-z]/g, '') + '@school.edu';
        const { data: teacherUser, error: userError } = await supabase
          .from(TABLES.USERS)
          .insert({
            email: email,
            full_name: teacher.name,
            role_id: 2, // Assuming 2 is teacher role
            linked_teacher_id: teacher.id,
            password: 'password123' // Default password
          })
          .select()
          .single();

        if (userError) {
          console.log('   Error creating user for teacher:', teacher.name, userError);
        } else {
          console.log('   ✅ Created user account for:', teacher.name, `(${email})`);
        }
      }
    }

    console.log('\n🔧 === DATA FIXING COMPLETE ===');

  } catch (error) {
    console.error('💥 Fix script error:', error);
  }
}

// Run the fix
fixTeacherData();
