const { supabase, TABLES } = require('./src/utils/supabase');

async function debugTeacherRelationships() {
  console.log('🔍 === DEBUGGING TEACHER RELATIONSHIPS ===\n');

  try {
    // 1. Check what tables exist
    console.log('1. CHECKING AVAILABLE TABLES:');
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .order('table_name');
    
    if (tablesError) {
      console.log('   Error getting tables:', tablesError);
    } else {
      console.log('   Available tables:', tables.map(t => t.table_name).join(', '));
    }

    // 2. Check students and their class assignments
    console.log('\n2. CHECKING STUDENTS AND CLASSES:');
    const { data: students, error: studentsError } = await supabase
      .from(TABLES.STUDENTS)
      .select(`
        id,
        name,
        class_id,
        classes(id, class_name, section, class_teacher_id)
      `)
      .limit(5);
    
    if (studentsError) {
      console.log('   Error:', studentsError);
    } else {
      console.log('   Students found:', students.length);
      students.forEach(student => {
        console.log(`   - ${student.name} | Class ID: ${student.class_id} | Class: ${student.classes?.class_name || 'N/A'} ${student.classes?.section || ''}`);
      });
    }

    // 3. Check teachers
    console.log('\n3. CHECKING TEACHERS:');
    const { data: teachers, error: teachersError } = await supabase
      .from(TABLES.TEACHERS)
      .select('id, name, is_class_teacher, assigned_class_id')
      .limit(10);
    
    if (teachersError) {
      console.log('   Error:', teachersError);
    } else {
      console.log('   Teachers found:', teachers.length);
      teachers.forEach(teacher => {
        console.log(`   - ${teacher.name} | Class Teacher: ${teacher.is_class_teacher} | Assigned Class: ${teacher.assigned_class_id || 'N/A'}`);
      });
    }

    // 4. Check users linked to teachers
    console.log('\n4. CHECKING TEACHER USER ACCOUNTS:');
    const { data: teacherUsers, error: teacherUsersError } = await supabase
      .from(TABLES.USERS)
      .select('id, email, full_name, linked_teacher_id')
      .not('linked_teacher_id', 'is', null);
    
    if (teacherUsersError) {
      console.log('   Error:', teacherUsersError);
    } else {
      console.log('   Teacher user accounts found:', teacherUsers.length);
      teacherUsers.forEach(user => {
        console.log(`   - ${user.full_name || user.email} | Teacher ID: ${user.linked_teacher_id}`);
      });
    }

    // 5. Check subjects
    console.log('\n5. CHECKING SUBJECTS:');
    const { data: subjects, error: subjectsError } = await supabase
      .from(TABLES.SUBJECTS)
      .select('id, name, class_id')
      .limit(10);
    
    if (subjectsError) {
      console.log('   Error:', subjectsError);
    } else {
      console.log('   Subjects found:', subjects.length);
      subjects.forEach(subject => {
        console.log(`   - ${subject.name} | Class ID: ${subject.class_id}`);
      });
    }

    // 6. Check teacher_subjects relationships
    console.log('\n6. CHECKING TEACHER-SUBJECT RELATIONSHIPS:');
    const { data: teacherSubjects, error: tsError } = await supabase
      .from(TABLES.TEACHER_SUBJECTS)
      .select(`
        teacher_id,
        subject_id,
        teachers(name),
        subjects(name, class_id)
      `)
      .limit(10);
    
    if (tsError) {
      console.log('   Error:', tsError);
    } else {
      console.log('   Teacher-Subject relationships found:', teacherSubjects.length);
      teacherSubjects.forEach(ts => {
        console.log(`   - Teacher: ${ts.teachers?.name || ts.teacher_id} | Subject: ${ts.subjects?.name || ts.subject_id} | Class: ${ts.subjects?.class_id}`);
      });
    }

    // 7. Check for class_subjects table (might not exist)
    console.log('\n7. CHECKING FOR CLASS_SUBJECTS TABLE:');
    try {
      const { data: classSubjects, error: csError } = await supabase
        .from('class_subjects')
        .select('*')
        .limit(5);
      
      if (csError) {
        console.log('   class_subjects table does not exist or error:', csError.code);
      } else {
        console.log('   class_subjects found:', classSubjects.length);
      }
    } catch (err) {
      console.log('   class_subjects table does not exist');
    }

    // 8. Check parent user accounts
    console.log('\n8. CHECKING PARENT USER ACCOUNTS:');
    const { data: parentUsers, error: parentError } = await supabase
      .from(TABLES.USERS)
      .select(`
        id, 
        email, 
        full_name, 
        linked_parent_of,
        students!users_linked_parent_of_fkey(
          id,
          name,
          class_id,
          classes(class_name, section)
        )
      `)
      .not('linked_parent_of', 'is', null)
      .limit(5);
    
    if (parentError) {
      console.log('   Error:', parentError);
    } else {
      console.log('   Parent accounts found:', parentUsers.length);
      parentUsers.forEach(parent => {
        const student = parent.students;
        console.log(`   - Parent: ${parent.full_name || parent.email} | Child: ${student?.name || 'N/A'} | Class: ${student?.classes?.class_name || 'N/A'}`);
      });
    }

    console.log('\n🔍 === DEBUG COMPLETE ===');

  } catch (error) {
    console.error('💥 Debug script error:', error);
  }
}

// Run the debug
debugTeacherRelationships();
