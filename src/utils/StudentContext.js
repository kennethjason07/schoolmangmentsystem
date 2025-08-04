import React, { createContext, useContext, useState } from 'react';

const DUMMY_STUDENTS = [
  { id: '1', name: 'Amit Sharma', roll: '101', class: '5' },
  { id: '2', name: 'Priya Singh', roll: '102', class: '5' },
  { id: '3', name: 'Rahul Verma', roll: '103', class: '5' },
  { id: '4', name: 'Sneha Gupta', roll: '104', class: '5' },
  { id: '5', name: 'Rajesh Kumar', roll: '105', class: '5' },
  { id: '6', name: 'Anjali Patel', roll: '106', class: '5' },
  { id: '7', name: 'Vikas Singh', roll: '107', class: '5' },
  { id: '8', name: 'Meena Kumari', roll: '108', class: '5' },
  { id: '9', name: 'Suresh Yadav', roll: '109', class: '5' },
  { id: '10', name: 'Pooja Sharma', roll: '110', class: '5' },
  { id: '11', name: 'Anjali Patel', roll: '111', class: '6' },
  { id: '12', name: 'Rohit Sinha', roll: '112', class: '6' },
  { id: '13', name: 'Sunil Kumar', roll: '113', class: '7' },
  { id: '14', name: 'Kavita Joshi', roll: '114', class: '7' },
];

const StudentContext = createContext();

export const StudentProvider = ({ children }) => {
  const [students, setStudents] = useState(DUMMY_STUDENTS);

  const addStudent = (student) => {
    setStudents(prev => [
      { ...student, id: (Date.now()).toString() },
      ...prev,
    ]);
  };

  const editStudent = (id, updated) => {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, ...updated } : s));
  };

  const deleteStudent = (id) => {
    setStudents(prev => prev.filter(s => s.id !== id));
  };

  return (
    <StudentContext.Provider value={{ students, addStudent, editStudent, deleteStudent }}>
      {children}
    </StudentContext.Provider>
  );
};

export const useStudents = () => useContext(StudentContext); 