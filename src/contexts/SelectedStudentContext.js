import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, TABLES } from '../utils/supabase';
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
  const { user, userType } = useAuth();
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [availableStudents, setAvailableStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMultipleStudents, setHasMultipleStudents] = useState(false);

  // Load available students for parent - supports both junction table and simple structure
  const loadAvailableStudents = async () => {
    if (!user || userType !== 'parent') {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // First try the junction table approach (many-to-many)
      await loadStudentsFromJunctionTable();
      
    } catch (error) {
      console.error('Error loading available students:', error);
      // Fallback to simple structure if junction table fails
      await loadStudentsFromSimpleStructure();
    } finally {
      setLoading(false);
    }
  };
  
  // Method to load students from junction table (many-to-many structure)
  const loadStudentsFromJunctionTable = async () => {
    try {
      // First, find the parent record linked to this user
      const { data: parentData, error: parentError } = await supabase
        .from('parents')
        .select('id, name, email, phone')
        .or(`email.eq.${user.email},phone.eq.${user.phone || ''}`)
        .limit(1);

      if (parentError || !parentData || parentData.length === 0) {
        console.log('No parent record found for user:', user.email);
        throw new Error('No parent record found');
      }

      const parentRecord = parentData[0];
      console.log('Found parent record:', parentRecord);

      // Get students linked to this parent through the junction table
      const { data: relationships, error: relationError } = await supabase
        .from('parent_student_relationships')
        .select(`
          id,
          relationship_type,
          is_primary_contact,
          is_emergency_contact,
          student_id
        `)
        .eq('parent_id', parentRecord.id);

      if (relationError) {
        console.error('Error getting parent-student relationships:', relationError);
        throw relationError;
      }

      if (!relationships || relationships.length === 0) {
        console.log('No student relationships found for parent');
        setAvailableStudents([]);
        setHasMultipleStudents(false);
        return;
      }

      // Get student details for each relationship
      const studentIds = relationships.map(rel => rel.student_id);
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
        .in('id', studentIds);

      if (studentsError) {
        console.error('Error loading students data:', studentsError);
        throw studentsError;
      }

      // Combine student data with relationship information
      const students = studentsData.map(student => {
        const relationship = relationships.find(rel => rel.student_id === student.id);
        return {
          ...student,
          relationshipType: relationship.relationship_type,
          isPrimaryContact: relationship.is_primary_contact,
          isEmergencyContact: relationship.is_emergency_contact,
          relationshipId: relationship.id,
          fullClassName: student.classes 
            ? `${student.classes.class_name} ${student.classes.section}`
            : 'N/A'
        };
      });

      console.log('Loaded students from junction table:', students);
      setAvailableStudents(students);
      setHasMultipleStudents(students.length > 1);

      // Auto-select first student or primary contact if no student selected
      if (!selectedStudent && students.length > 0) {
        const primaryContact = students.find(s => s.isPrimaryContact) || students[0];
        setSelectedStudent(primaryContact);
      }

    } catch (error) {
      console.error('Junction table method failed:', error);
      throw error; // Re-throw to trigger fallback
    }
  };
  
  // Fallback method for simple database structure
  const loadStudentsFromSimpleStructure = async () => {
    try {
      console.log('Falling back to simple structure');
      
      // Check if user has linked_parent_of field (simple structure)
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('linked_parent_of')
        .eq('id', user.id)
        .single();

      if (userError || !userData?.linked_parent_of) {
        console.log('No linked student found in users table');
        setAvailableStudents([]);
        setHasMultipleStudents(false);
        return;
      }

      // Get the linked student with class information
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
        .eq('id', userData.linked_parent_of)
        .single();

      if (studentError) {
        console.error('Error loading linked student:', studentError);
        setAvailableStudents([]);
        setHasMultipleStudents(false);
        return;
      }

      const student = {
        ...studentData,
        relationshipType: 'Parent',
        isPrimaryContact: true,
        isEmergencyContact: true,
        relationshipId: null,
        fullClassName: studentData.classes 
          ? `${studentData.classes.class_name} ${studentData.classes.section}`
          : 'N/A'
      };

      console.log('Loaded student from simple structure:', student);
      setAvailableStudents([student]);
      setHasMultipleStudents(false);
      setSelectedStudent(student);

    } catch (error) {
      console.error('Error in simple structure fallback:', error);
      setAvailableStudents([]);
      setHasMultipleStudents(false);
    }
  };

  // Load students when user changes
  useEffect(() => {
    if (user && userType === 'parent') {
      loadAvailableStudents();
    } else {
      setSelectedStudent(null);
      setAvailableStudents([]);
      setHasMultipleStudents(false);
      setLoading(false);
    }
  }, [user, userType]);

  // Function to switch selected student
  const switchStudent = (student) => {
    setSelectedStudent(student);
  };

  // Function to refresh student data
  const refreshStudents = async () => {
    await loadAvailableStudents();
  };

  const value = {
    selectedStudent,
    availableStudents,
    hasMultipleStudents,
    loading,
    switchStudent,
    refreshStudents,
    // Helper functions
    getStudentDisplayName: (student) => student ? student.name : 'No Student',
    getStudentClass: (student) => student ? student.fullClassName : 'N/A',
    getStudentAdmissionNo: (student) => student ? student.admission_no : 'N/A',
  };

  return (
    <SelectedStudentContext.Provider value={value}>
      {children}
    </SelectedStudentContext.Provider>
  );
};
