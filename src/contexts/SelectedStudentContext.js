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

  // Load available students for the current parent user
  const loadAvailableStudents = async () => {
    if (!user) return;

    try {
      setLoading(true);
      console.log('Loading available students for parent user:', user.id);

      // Method 1: Check if user has linked_parent_of (new structure)
      if (user.linked_parent_of) {
        console.log('Using linked_parent_of method');
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
            classes(
              id,
              class_name,
              section
            )
          `)
          .eq('id', user.linked_parent_of)
          .single();

        if (studentError) {
          console.error('Error loading linked student:', studentError);
          throw studentError;
        }

        if (studentData) {
          const student = {
            ...studentData,
            relationshipType: 'Primary',
            isPrimaryContact: true,
            isEmergencyContact: true,
            fullClassName: studentData.classes 
              ? `${studentData.classes.class_name} ${studentData.classes.section}`
              : 'N/A'
          };
          
          setAvailableStudents([student]);
          setHasMultipleStudents(false);
          setSelectedStudent(student);
          return;
        }
      }

      // Method 2: Check students table for students with this user as parent_id
      console.log('Using students.parent_id method');
      const { data: studentsData, error: studentsError } = await supabase
        .from(TABLES.STUDENTS)
        .select(`
          id,
          name,
          admission_no,
          roll_no,
          academic_year,
          gender,
          dob,
          classes(
            id,
            class_name,
            section
          )
        `)
        .eq('parent_id', user.id);

      if (studentsError) {
        console.error('Error loading students data:', studentsError);
        throw studentsError;
      }

      if (studentsData && studentsData.length > 0) {
        console.log('Found students via parent_id method:', studentsData.length);
        
        // Map students with relationship info
        const students = studentsData.map(student => ({
          ...student,
          relationshipType: 'Guardian', // Default since we don't have relation info
          isPrimaryContact: true,
          isEmergencyContact: true,
          fullClassName: student.classes 
            ? `${student.classes.class_name} ${student.classes.section}`
            : 'N/A'
        }));

        setAvailableStudents(students);
        setHasMultipleStudents(students.length > 1);
        
        // Auto-select first student if no student selected
        if (!selectedStudent && students.length > 0) {
          setSelectedStudent(students[0]);
        }
        return;
      }

      // Method 3: Check parents table for this user's email
      console.log('Using parents table method');
      const { data: parentData, error: parentError } = await supabase
        .from('parents')
        .select('id, name, email, phone, student_id')
        .eq('email', user.email)
        .limit(1);

      if (parentError) {
        console.error('Error getting parent data:', parentError);
        throw parentError;
      }

      if (parentData && parentData.length > 0) {
        const parentRecord = parentData[0];
        console.log('Found parent record:', parentRecord);

        if (parentRecord.student_id) {
          // Get student details
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
              classes(
                id,
                class_name,
                section
              )
            `)
            .eq('id', parentRecord.student_id)
            .single();

          if (studentError) {
            console.error('Error loading student from parent record:', studentError);
            throw studentError;
          }

          if (studentData) {
            const student = {
              ...studentData,
              relationshipType: parentRecord.relation || 'Guardian',
              isPrimaryContact: true,
              isEmergencyContact: true,
              fullClassName: studentData.classes 
                ? `${studentData.classes.class_name} ${studentData.classes.section}`
                : 'N/A'
            };
            
            setAvailableStudents([student]);
            setHasMultipleStudents(false);
            setSelectedStudent(student);
            return;
          }
        }
      }

      // If no students found, set empty arrays
      console.log('No students found for this parent');
      setAvailableStudents([]);
      setHasMultipleStudents(false);
      setSelectedStudent(null);

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
