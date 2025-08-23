import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, TABLES, dbHelpers } from '../utils/supabase';
import { useAuth } from '../utils/AuthContext';

const SelectedStudentContext = createContext({});

export const useSelectedStudent = () => {
  const context = useContext(SelectedStudentContext);
  if (!context) {
    throw new Error('useSelectedStudent must be used within a SelectedStudentProvider');
  }
  return context;
};

export const SelectedStudentProvider = ({ children }) => {
  const { user } = useAuth();
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [availableStudents, setAvailableStudents] = useState([]);
  const [hasMultipleStudents, setHasMultipleStudents] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load available students for the current parent user - FIXED APPROACH
  const loadAvailableStudents = async () => {
    if (!user) return;

    try {
      setLoading(true);
      console.log('Loading available students for parent user (FIXED APPROACH):', user.id);
      console.log('User email:', user.email);
      console.log('User linked_parent_of:', user.linked_parent_of);
      
      let allStudents = [];

      // APPROACH 1: Always check linked_parent_of first (this is the primary link)
      if (user.linked_parent_of) {
        console.log('Step 1: Getting student via linked_parent_of:', user.linked_parent_of);
        const { data: studentData, error: studentError } = await supabase
          .from(TABLES.STUDENTS)
          .select(`
            id,
            name,
            admission_no,
            roll_no,
            academic_year,
            gender,
            dob,
            class_id,
            parent_id,
            classes(
              id,
              class_name,
              section
            )
          `)
          .eq('id', user.linked_parent_of)
          .single();

        if (!studentError && studentData) {
          console.log('✅ Found primary student via linked_parent_of:', studentData.name);

          // Get student's profile photo from users table
          const { data: studentUserData, error: studentUserError } = await supabase
            .from(TABLES.USERS)
            .select('id, profile_url')
            .eq('linked_student_id', studentData.id)
            .maybeSingle();

          console.log('📸 Student user data for profile photo:', studentUserData);

          const student = {
            ...studentData,
            relationshipType: 'Primary',
            isPrimaryContact: true,
            isEmergencyContact: true,
            fullClassName: studentData.classes
              ? `${studentData.classes.class_name} ${studentData.classes.section}`
              : 'N/A',
            profile_url: studentUserData?.profile_url || null // Add profile photo
          };
          allStudents.push(student);
        } else {
          console.log('❌ Error getting primary student:', studentError);
        }
      }

      // APPROACH 2: Look for other students directly linked to this parent via parent records
      console.log('Step 2: Looking for students directly linked via parent records');
      console.log('🔍 DEBUG: User email for parent search:', user.email);
      
      // First get parent records for this email
      const { data: parentRecords, error: parentError } = await supabase
        .from('parents')
        .select('id, name, email, phone, student_id, relation')
        .eq('email', user.email);
      
      console.log('🔍 DEBUG: Parent records query result:', { parentRecords, parentError });
      
      if (!parentError && parentRecords && parentRecords.length > 0) {
        console.log('✅ Found parent records:', parentRecords.length);
        console.log('📋 Parent records:', parentRecords);
        
        // Get student IDs from parent records
        const studentIdsFromParents = parentRecords.map(p => p.student_id);
        console.log('🔍 Student IDs from parent records:', studentIdsFromParents);
        
        // Now fetch the students directly using their IDs
        const { data: studentsFromParents, error: studentsError } = await supabase
          .from(TABLES.STUDENTS)
          .select(`
            id,
            name,
            admission_no,
            roll_no,
            academic_year,
            gender,
            dob,
            class_id,
            parent_id,
            classes(
              id,
              class_name,
              section
            )
          `)
          .in('id', studentIdsFromParents);
        
        if (!studentsError && studentsFromParents && studentsFromParents.length > 0) {
          console.log('✅ Found students from parent records:', studentsFromParents.length);
          console.log('📋 Students data:', studentsFromParents);
          
          // Add each student that isn't already in our list
          for (const [index, student] of studentsFromParents.entries()) {
            const alreadyExists = allStudents.some(s => s.id === student.id);
            console.log(`🔍 Processing student ${index + 1}: ${student.name} - Already in list: ${alreadyExists}`);

            if (!alreadyExists) {
              // Find the corresponding parent record to get the relation
              const parentRecord = parentRecords.find(p => p.student_id === student.id);
              console.log('✅ Adding student from parent records:', student.name);

              // Get student's profile photo from users table
              const { data: studentUserData, error: studentUserError } = await supabase
                .from(TABLES.USERS)
                .select('id, profile_url')
                .eq('linked_student_id', student.id)
                .maybeSingle();

              console.log('📸 Student user data for profile photo:', studentUserData);

              const mappedStudent = {
                ...student,
                relationshipType: parentRecord?.relation || 'Guardian',
                isPrimaryContact: student.id === user.linked_parent_of, // Primary if matches linked_parent_of
                isEmergencyContact: true,
                fullClassName: student.classes
                  ? `${student.classes.class_name} ${student.classes.section}`
                  : 'N/A',
                profile_url: studentUserData?.profile_url || null // Add profile photo
              };
              allStudents.push(mappedStudent);
              console.log('✅ Student added. Total students now:', allStudents.length);
            } else {
              console.log('⏭️ Skipping student (already in list):', student.name);
            }
          }
        } else if (studentsError) {
          console.log('❌ Error getting students from parent records:', studentsError);
        } else {
          console.log('❌ No students found from parent records');
        }
      } else if (parentError) {
        console.log('❌ Error getting parent records:', parentError);
      } else {
        console.log('❌ No parent records found for email:', user.email);
      }
      
      console.log('🔍 DEBUG: All students after Step 2:', allStudents.length, allStudents.map(s => ({ id: s.id, name: s.name })));

      // APPROACH 3: If still only 1 student, look for students with similar names to the primary student
      if (allStudents.length === 1) {
        console.log('Step 3: Still only 1 student, looking for students with similar characteristics');
        const primaryStudent = allStudents[0];
        
        // Look for students in the same class or with similar admission numbers
        if (primaryStudent.class_id) {
          const { data: classmateStudents, error: classmateError } = await supabase
            .from(TABLES.STUDENTS)
            .select(`
              id,
              name,
              admission_no,
              roll_no,
              academic_year,
              gender,
              dob,
              class_id,
              parent_id,
              classes(
                id,
                class_name,
                section
              )
            `)
            .eq('class_id', primaryStudent.class_id)
            .neq('id', primaryStudent.id) // Exclude the primary student
            .limit(5); // Limit to avoid too many results
          
          if (!classmateError && classmateStudents && classmateStudents.length > 0) {
            console.log('Found classmates. Checking if any should belong to this parent...');
            // For now, let's not automatically add classmates, but log them for debugging
            console.log('Classmates:', classmateStudents.map(s => `${s.name} (${s.admission_no})`));
          }
        }
      }

      // Set the available students
      if (allStudents.length > 0) {
        console.log('Total students found for parent:', allStudents.length);
        setAvailableStudents(allStudents);
        setHasMultipleStudents(allStudents.length > 1);
        
        // Auto-select first student if no student selected
        if (!selectedStudent) {
          setSelectedStudent(allStudents[0]);
        }
        // If current selected student is not in the list, select the first one
        else if (!allStudents.some(s => s.id === selectedStudent.id)) {
          setSelectedStudent(allStudents[0]);
        }
      } else {
        // If no students found, set empty arrays
        console.log('No students found for this parent');
        setAvailableStudents([]);
        setHasMultipleStudents(false);
        setSelectedStudent(null);
      }

    } catch (error) {
      console.error('Error loading available students:', error);
      setAvailableStudents([]);
      setHasMultipleStudents(false);
      setSelectedStudent(null);
    } finally {
      setLoading(false);
    }
  };

  // Load students when user changes
  useEffect(() => {
    if (user) {
      loadAvailableStudents();
    }
  }, [user]);

  // Function to manually refresh students
  const refreshStudents = () => {
    if (user) {
      loadAvailableStudents();
    }
  };

  // Function to switch between available students
  const switchStudent = (student) => {
    if (student && availableStudents.some(s => s.id === student.id)) {
      setSelectedStudent(student);
      console.log('Switched to student:', student.name || student.full_name);
    }
  };

  // Helper functions for student data formatting
  const getStudentClass = (student) => {
    try {
      if (!student) return 'N/A';
      
      // Try to get class from different possible sources
      if (student.full_class_name) {
        return student.full_class_name;
      }
      
      if (student.class_name && student.section) {
        return `${student.class_name} ${student.section}`;
      }
      
      if (student.class_name) {
        return student.class_name;
      }
      
      if (student.classes?.class_name && student.classes?.section) {
        return `${student.classes.class_name} ${student.classes.section}`;
      }
      
      if (student.classes?.class_name) {
        return student.classes.class_name;
      }
      
      return 'N/A';
    } catch (error) {
      console.warn('Error in getStudentClass:', error);
      return 'N/A';
    }
  };

  const getStudentDisplayName = (student) => {
    try {
      if (!student) return 'Unknown Student';
      
      // Try different name fields
      if (student.full_name) return student.full_name;
      if (student.name) return student.name;
      if (student.first_name && student.last_name) {
        return `${student.first_name} ${student.last_name}`;
      }
      
      return 'Unknown Student';
    } catch (error) {
      console.warn('Error in getStudentDisplayName:', error);
      return 'Unknown Student';
    }
  };

  const getStudentAdmissionNo = (student) => {
    try {
      if (!student) return 'N/A';
      
      // Try different admission number fields
      if (student.admission_number) return student.admission_number;
      if (student.admission_no) return student.admission_no;
      if (student.roll_number) return student.roll_number;
      if (student.roll_no) return student.roll_no;
      
      return 'N/A';
    } catch (error) {
      console.warn('Error in getStudentAdmissionNo:', error);
      return 'N/A';
    }
  };

  const value = {
    selectedStudent,
    availableStudents,
    hasMultipleStudents,
    loading,
    refreshStudents,
    switchStudent,
    getStudentClass,
    getStudentDisplayName,
    getStudentAdmissionNo
  };

  // Debug logging
  console.log('SelectedStudentContext - Functions available:', {
    hasGetStudentClass: typeof getStudentClass === 'function',
    hasGetStudentDisplayName: typeof getStudentDisplayName === 'function',
    hasGetStudentAdmissionNo: typeof getStudentAdmissionNo === 'function',
    hasSwitchStudent: typeof switchStudent === 'function',
    selectedStudent: selectedStudent?.name || 'None',
    availableStudentsCount: availableStudents.length
  });

  return (
    <SelectedStudentContext.Provider value={value}>
      {children}
    </SelectedStudentContext.Provider>
  );
};
