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

  // Load available students for the current parent user - SECURE APPROACH
  const loadAvailableStudents = async () => {
    if (!user) return;

    try {
      setLoading(true);
      console.log('Loading available students for parent user (SECURE):', user.id);
      console.log('User email:', user.email);
      console.log('User linked_parent_of:', user.linked_parent_of);
      
      let allStudents = [];

      // APPROACH 1: Always check linked_parent_of first (this is the primary and ONLY reliable link)
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

      // APPROACH 2: SECURE - Only look for students that have the SAME parent_id as the primary student
      // This prevents showing children that don't actually belong to this parent
      if (allStudents.length > 0) {
        const primaryStudent = allStudents[0];
        
        if (primaryStudent.parent_id) {
          console.log('Step 2: Looking for siblings with same parent_id:', primaryStudent.parent_id);
          
          // Get other students with the same parent_id (siblings)
          const { data: siblingStudents, error: siblingError } = await supabase
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
            .eq('parent_id', primaryStudent.parent_id)
            .neq('id', primaryStudent.id); // Exclude the primary student
          
          if (!siblingError && siblingStudents && siblingStudents.length > 0) {
            console.log('✅ Found sibling students:', siblingStudents.length);
            
            // Add each sibling student
            for (const student of siblingStudents) {
              // Get student's profile photo from users table
              const { data: studentUserData, error: studentUserError } = await supabase
                .from(TABLES.USERS)
                .select('id, profile_url')
                .eq('linked_student_id', student.id)
                .maybeSingle();

              console.log('📸 Student user data for profile photo:', studentUserData);

              const mappedStudent = {
                ...student,
                relationshipType: 'Sibling',
                isPrimaryContact: false, // Only primary student is primary contact
                isEmergencyContact: true,
                fullClassName: student.classes
                  ? `${student.classes.class_name} ${student.classes.section}`
                  : 'N/A',
                profile_url: studentUserData?.profile_url || null
              };
              allStudents.push(mappedStudent);
              console.log('✅ Sibling added:', student.name);
            }
          } else if (siblingError) {
            console.log('❌ Error getting sibling students:', siblingError);
          } else {
            console.log('ℹ️ No sibling students found');
          }
        } else {
          console.log('ℹ️ Primary student has no parent_id, cannot find siblings');
        }
      }
      
      console.log('🔍 FINAL: Total students found:', allStudents.length, allStudents.map(s => ({ id: s.id, name: s.name })));

      // Remove the potentially problematic APPROACH 3 (classmate search)
      // This was likely adding students that don't belong to this parent

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
