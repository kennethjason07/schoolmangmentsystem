/**
 * Parent Authentication Hook
 * 
 * This hook provides parent authentication state and functions for parent screens
 * that work independently of tenant filtering. Parents access their children's data
 * through direct parent-student relationships stored in the database.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../utils/AuthContext';
import { getParentStudents, isUserParent } from '../utils/parentAuthHelper';

/**
 * Custom hook for parent authentication
 * @returns {Object} Parent authentication state and functions
 */
export const useParentAuth = () => {
  const { user } = useAuth();
  const [isParent, setIsParent] = useState(false);
  const [parentStudents, setParentStudents] = useState([]);
  const [directParentMode, setDirectParentMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkParentStatus = async () => {
      if (!user) {
        setIsParent(false);
        setParentStudents([]);
        setDirectParentMode(false);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        // Check if user is a parent
        const parentCheck = await isUserParent(user.id);
        
        if (parentCheck.success && parentCheck.isParent) {
          setIsParent(true);
          setDirectParentMode(true);
          
          // Get the parent's students
          const studentsResult = await getParentStudents(user.id);
          
          if (studentsResult.success) {
            setParentStudents(studentsResult.students);
          } else {
            setError(studentsResult.error);
            setParentStudents([]);
          }
        } else {
          setIsParent(false);
          setDirectParentMode(false);
          setParentStudents([]);
        }
      } catch (err) {
        console.error('Error checking parent status:', err);
        setError(err.message);
        setIsParent(false);
        setDirectParentMode(false);
        setParentStudents([]);
      } finally {
        setLoading(false);
      }
    };

    checkParentStatus();
  }, [user?.id]);

  return {
    isParent,
    parentStudents,
    directParentMode,
    loading,
    error
  };
};