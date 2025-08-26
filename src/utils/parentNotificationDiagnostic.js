import { supabase, TABLES } from './supabase';

/**
 * Diagnostic tool to check parent-student relationships and fix notification issues
 */

export const diagnoseParentStudentRelationships = async () => {
  console.log('🔍 [DIAGNOSTIC] Starting parent-student relationship analysis...');
  
  try {
    // 1. Check all students
    const { data: allStudents, error: studentsError } = await supabase
      .from(TABLES.STUDENTS)
      .select('id, name, admission_no, parent_id, class_id');

    if (studentsError) {
      console.error('❌ Error fetching students:', studentsError);
      return { success: false, error: studentsError };
    }

    console.log(`📊 Found ${allStudents?.length || 0} students`);

    // 2. Check all parents
    const { data: allParents, error: parentsError } = await supabase
      .from(TABLES.PARENTS)
      .select('id, name, email, student_id, relation');

    if (parentsError) {
      console.error('❌ Error fetching parents:', parentsError);
      return { success: false, error: parentsError };
    }

    console.log(`📊 Found ${allParents?.length || 0} parent records`);

    // 3. Check all users with parent role
    const { data: parentUsers, error: usersError } = await supabase
      .from(TABLES.USERS)
      .select('id, email, full_name, role_id, linked_parent_of, linked_student_id')
      .eq('role_id', 3); // Assuming role_id 3 is parent

    if (usersError) {
      console.error('❌ Error fetching parent users:', usersError);
      return { success: false, error: usersError };
    }

    console.log(`📊 Found ${parentUsers?.length || 0} parent user accounts`);

    // 4. Check parent_student_relationships table
    let parentStudentRelationships = [];
    try {
      const { data: relationships, error: relationshipError } = await supabase
        .from('parent_student_relationships')
        .select('*');

      if (!relationshipError) {
        parentStudentRelationships = relationships || [];
        console.log(`📊 Found ${parentStudentRelationships.length} parent-student relationships`);
      } else {
        console.log('ℹ️ parent_student_relationships table not found (this is optional)');
      }
    } catch (error) {
      console.log('ℹ️ parent_student_relationships table not available');
    }

    // 5. Analyze relationships
    const analysis = {
      totalStudents: allStudents?.length || 0,
      totalParentRecords: allParents?.length || 0,
      totalParentUsers: parentUsers?.length || 0,
      totalRelationships: parentStudentRelationships.length,
      studentsWithParents: 0,
      studentsWithoutParents: 0,
      parentUsersWithLinkedStudents: 0,
      parentUsersWithoutLinkedStudents: 0,
      issues: [],
      recommendations: []
    };

    // Analyze students
    if (allStudents) {
      for (const student of allStudents) {
        // Check if student has a parent_id
        if (student.parent_id) {
          analysis.studentsWithParents++;
        } else {
          analysis.studentsWithoutParents++;
          analysis.issues.push(`Student ${student.name} (${student.admission_no}) has no parent_id`);
        }

        // Check if there's a parent user linked to this student
        const linkedParentUser = parentUsers?.find(user => user.linked_parent_of === student.id);
        if (!linkedParentUser) {
          analysis.issues.push(`Student ${student.name} (${student.admission_no}) has no linked parent user`);
        }

        // Check if there's a parent record for this student
        const parentRecord = allParents?.find(parent => parent.student_id === student.id);
        if (!parentRecord) {
          analysis.issues.push(`Student ${student.name} (${student.admission_no}) has no parent record`);
        }
      }
    }

    // Analyze parent users
    if (parentUsers) {
      for (const parentUser of parentUsers) {
        if (parentUser.linked_parent_of) {
          analysis.parentUsersWithLinkedStudents++;
        } else {
          analysis.parentUsersWithoutLinkedStudents++;
          analysis.issues.push(`Parent user ${parentUser.full_name} (${parentUser.email}) has no linked student`);
        }
      }
    }

    // Generate recommendations
    if (analysis.studentsWithoutParents > 0) {
      analysis.recommendations.push(`Create parent records for ${analysis.studentsWithoutParents} students without parents`);
    }
    
    if (analysis.parentUsersWithoutLinkedStudents > 0) {
      analysis.recommendations.push(`Link ${analysis.parentUsersWithoutLinkedStudents} parent users to their students`);
    }

    console.log('📊 [DIAGNOSTIC] Analysis complete:', analysis);
    return { success: true, analysis, students: allStudents, parents: allParents, parentUsers };

  } catch (error) {
    console.error('❌ [DIAGNOSTIC] Error in analysis:', error);
    return { success: false, error };
  }
};

/**
 * Fix common parent-student relationship issues
 */
export const fixParentStudentRelationships = async () => {
  console.log('🔧 [FIX] Starting parent-student relationship fixes...');
  
  const diagnostic = await diagnoseParentStudentRelationships();
  if (!diagnostic.success) {
    return diagnostic;
  }

  const { students, parents, parentUsers } = diagnostic;
  const fixes = [];

  try {
    // Fix 1: Link parent users to students based on email matching
    for (const student of students || []) {
      // Find parent record for this student
      const parentRecord = parents?.find(p => p.student_id === student.id);
      
      if (parentRecord) {
        // Find parent user with matching email
        const parentUser = parentUsers?.find(u => u.email === parentRecord.email);
        
        if (parentUser && !parentUser.linked_parent_of) {
          // Link this parent user to the student
          const { error: linkError } = await supabase
            .from(TABLES.USERS)
            .update({ linked_parent_of: student.id })
            .eq('id', parentUser.id);
          
          if (!linkError) {
            fixes.push(`✅ Linked parent user ${parentUser.full_name} to student ${student.name}`);
          } else {
            fixes.push(`❌ Failed to link parent user ${parentUser.full_name} to student ${student.name}: ${linkError.message}`);
          }
        }
      }
    }

    // Fix 2: Ensure students have parent_id set
    for (const student of students || []) {
      if (!student.parent_id) {
        // Find parent record for this student
        const parentRecord = parents?.find(p => p.student_id === student.id);
        
        if (parentRecord) {
          const { error: updateError } = await supabase
            .from(TABLES.STUDENTS)
            .update({ parent_id: parentRecord.id })
            .eq('id', student.id);
          
          if (!updateError) {
            fixes.push(`✅ Set parent_id for student ${student.name}`);
          } else {
            fixes.push(`❌ Failed to set parent_id for student ${student.name}: ${updateError.message}`);
          }
        }
      }
    }

    console.log('🔧 [FIX] Fixes applied:', fixes);
    return { success: true, fixes };

  } catch (error) {
    console.error('❌ [FIX] Error applying fixes:', error);
    return { success: false, error };
  }
};

/**
 * Test notification sending for a specific student
 */
export const testNotificationForStudent = async (studentId) => {
  console.log(`🧪 [TEST] Testing notification for student ${studentId}`);
  
  try {
    // Import the notification service function
    const { sendAbsenceNotificationToParent } = await import('../services/notificationService');
    
    // Test sending notification
    const result = await sendAbsenceNotificationToParent(
      studentId,
      new Date().toISOString().split('T')[0], // Today's date
      null // No specific teacher
    );
    
    console.log('🧪 [TEST] Notification test result:', result);
    return result;
    
  } catch (error) {
    console.error('🧪 [TEST] Error testing notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get a summary of notification readiness for all students
 */
export const getNotificationReadinessSummary = async () => {
  console.log('📋 [SUMMARY] Checking notification readiness for all students...');
  
  const diagnostic = await diagnoseParentStudentRelationships();
  if (!diagnostic.success) {
    return diagnostic;
  }

  const { students, parents, parentUsers } = diagnostic;
  const summary = {
    ready: [],
    notReady: [],
    total: students?.length || 0
  };

  for (const student of students || []) {
    // Check if student has complete notification setup
    const parentRecord = parents?.find(p => p.student_id === student.id);
    const parentUser = parentRecord ? parentUsers?.find(u => u.email === parentRecord.email) : null;
    const isLinked = parentUser && parentUser.linked_parent_of === student.id;

    if (parentRecord && parentUser && isLinked) {
      summary.ready.push({
        studentId: student.id,
        studentName: student.name,
        parentEmail: parentUser.email,
        parentName: parentUser.full_name
      });
    } else {
      const issues = [];
      if (!parentRecord) issues.push('No parent record');
      if (!parentUser) issues.push('No parent user account');
      if (parentUser && !isLinked) issues.push('Parent user not linked');
      
      summary.notReady.push({
        studentId: student.id,
        studentName: student.name,
        issues: issues
      });
    }
  }

  console.log(`📋 [SUMMARY] ${summary.ready.length}/${summary.total} students ready for notifications`);
  console.log(`📋 [SUMMARY] ${summary.notReady.length} students not ready:`, summary.notReady);
  
  return { success: true, summary };
};
