import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, TABLES, dbHelpers } from '../utils/supabase';
import { useAuth } from '../utils/AuthContext';
import { getParentStudents, isUserParent } from '../utils/parentAuthHelper';

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

  // Load available students for the current parent user - ENHANCED APPROACH
  const loadAvailableStudents = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('🚀 [SelectedStudentContext] Loading students for parent user:', user.email);
      
      // Step 1: Check if user is a parent using the enhanced parent authentication
      console.log('🚀 [SelectedStudentContext] Step 1: Checking if user is a parent...');
      const parentCheck = await isUserParent(user.id);
      
      if (!parentCheck.success || !parentCheck.isParent) {
        console.log('🚀 [SelectedStudentContext] User is not a parent or check failed:', parentCheck.error);
        setAvailableStudents([]);
        setHasMultipleStudents(false);
        setSelectedStudent(null);
        return;
      }
      
      console.log('🚀 [SelectedStudentContext] ✅ User confirmed as parent with', parentCheck.studentCount, 'students');
      
      // Step 2: Get parent's students using the enhanced parent authentication
      console.log('🚀 [SelectedStudentContext] Step 2: Fetching parent students...');
      const studentsResult = await getParentStudents(user.id);
      
      if (!studentsResult.success) {
        console.error('🚀 [SelectedStudentContext] Failed to get parent students:', studentsResult.error);
        setAvailableStudents([]);
        setHasMultipleStudents(false);
        setSelectedStudent(null);
        return;
      }
      
      const parentStudents = studentsResult.students || [];
      console.log('🚀 [SelectedStudentContext] ✅ Successfully loaded', parentStudents.length, 'students');
      
      // Step 3: Format students for the context (ensure they have all required fields)
      const formattedStudents = parentStudents.map((student, index) => ({
        id: student.id,
        name: student.name,
        admission_no: student.admission_no,
        roll_no: student.roll_no || student.admission_no, // Fallback to admission_no if roll_no not available
        academic_year: student.academic_year,
        gender: student.gender,
        dob: student.dob,
        class_id: student.class_id,
        profile_url: student.profile_url,
        
        // Class information
        class_name: student.class_name,
        section: student.section,
        fullClassName: student.full_class_name || student.class_name || 'N/A',
        
        // Parent relationship info
        relationshipType: index === 0 ? 'Primary' : 'Sibling',
        isPrimaryContact: index === 0, // First student is primary contact
        isEmergencyContact: true,
        
        // Additional fields for compatibility
        classes: {
          id: student.class_id,
          class_name: student.class_name,
          section: student.section
        }
      }));
      
      console.log('🚀 [SelectedStudentContext] Formatted students:', formattedStudents.map(s => ({ 
        id: s.id, 
        name: s.name, 
        class: s.fullClassName 
      })));
      
      // Step 4: Set the available students
      if (formattedStudents.length > 0) {
        setAvailableStudents(formattedStudents);
        setHasMultipleStudents(formattedStudents.length > 1);
        
        // Auto-select first student if no student selected
        if (!selectedStudent) {
          setSelectedStudent(formattedStudents[0]);
          console.log('🚀 [SelectedStudentContext] Auto-selected first student:', formattedStudents[0].name);
        }
        // If current selected student is not in the list, select the first one
        else if (!formattedStudents.some(s => s.id === selectedStudent.id)) {
          setSelectedStudent(formattedStudents[0]);
          console.log('🚀 [SelectedStudentContext] Selected student not in list, switching to:', formattedStudents[0].name);
        }
      } else {
        console.log('🚀 [SelectedStudentContext] No students found for this parent');
        setAvailableStudents([]);
        setHasMultipleStudents(false);
        setSelectedStudent(null);
      }

    } catch (error) {
      console.error('🚀 [SelectedStudentContext] Error loading available students:', error);
      setAvailableStudents([]);
      setHasMultipleStudents(false);
      setSelectedStudent(null);
    } finally {
      setLoading(false);
      console.log('🚀 [SelectedStudentContext] Loading complete');
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
