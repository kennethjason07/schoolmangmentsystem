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
  const { user, loading: authLoading } = useAuth();
  const [isParent, setIsParent] = useState(false);
  const [parentStudents, setParentStudents] = useState([]);
  const [directParentMode, setDirectParentMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const checkParentStatus = async () => {
      // Wait for auth to complete loading first
      if (authLoading) {
        console.log('🚀 useParentAuth: Waiting for auth to complete...');
        return;
      }
      
      if (!user) {
        console.log('🚀 useParentAuth: No user found, clearing parent state');
        setIsParent(false);
        setParentStudents([]);
        setDirectParentMode(false);
        setLoading(false);
        setError(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        console.log('🚀 useParentAuth: Checking parent status for user:', user.email);
        
        // Add retry logic with exponential backoff for network issues
        const maxRetries = 3;
        const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 5000); // Max 5 seconds
        
        // Check if user is a parent with timeout
        const parentCheckPromise = isUserParent(user.id);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Parent check timeout')), 10000)
        );
        
        const parentCheck = await Promise.race([parentCheckPromise, timeoutPromise]);
        
        if (parentCheck.success && parentCheck.isParent) {
          console.log('🚀 useParentAuth: User confirmed as parent');
          setIsParent(true);
          setDirectParentMode(true);
          
          // Get the parent's students with timeout
          const studentsPromise = getParentStudents(user.id);
          const studentsTimeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Students fetch timeout')), 15000)
          );
          
          const studentsResult = await Promise.race([studentsPromise, studentsTimeoutPromise]);
          
          if (studentsResult.success) {
            console.log('🚀 useParentAuth: Successfully loaded', studentsResult.students.length, 'students');
            setParentStudents(studentsResult.students);
            setRetryCount(0); // Reset retry count on success
          } else {
            console.error('🚀 useParentAuth: Failed to load students:', studentsResult.error);
            setError(studentsResult.error);
            setParentStudents([]);
            
            // Retry if it's a network/timeout error and we haven't exceeded max retries
            if (retryCount < maxRetries && (
                studentsResult.error?.includes('timeout') ||
                studentsResult.error?.includes('network') ||
                studentsResult.error?.includes('connection')
              )) {
              console.log(`🚀 useParentAuth: Will retry in ${retryDelay}ms (attempt ${retryCount + 1}/${maxRetries})`);
              setTimeout(() => {
                setRetryCount(prev => prev + 1);
              }, retryDelay);
              return; // Don't set loading to false yet
            }
          }
        } else if (parentCheck.success && !parentCheck.isParent) {
          console.log('🚀 useParentAuth: User is not a parent');
          setIsParent(false);
          setDirectParentMode(false);
          setParentStudents([]);
          setRetryCount(0);
        } else {
          console.error('🚀 useParentAuth: Parent check failed:', parentCheck.error);
          setError(parentCheck.error);
          setIsParent(false);
          setDirectParentMode(false);
          setParentStudents([]);
        }
      } catch (err) {
        console.error('🚀 useParentAuth: Error checking parent status:', err);
        
        // Handle timeout and network errors with retry
        const isRetryableError = err.message?.includes('timeout') ||
                                err.message?.includes('network') ||
                                err.message?.includes('connection') ||
                                err.message?.includes('fetch');
        
        if (isRetryableError && retryCount < maxRetries) {
          const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 5000);
          console.log(`🚀 useParentAuth: Retrying due to ${err.message} in ${retryDelay}ms`);
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
          }, retryDelay);
          return; // Don't set loading to false or update state yet
        }
        
        setError(err.message);
        setIsParent(false);
        setDirectParentMode(false);
        setParentStudents([]);
        setRetryCount(0);
      } finally {
        // Only set loading to false if we're not going to retry
        if (retryCount >= 3) {
          setRetryCount(0);
        }
        setLoading(false);
      }
    };

    checkParentStatus();
  }, [user?.id, authLoading, retryCount]); // Include retryCount in dependencies

  // Manual retry function
  const retryParentCheck = () => {
    console.log('🚀 useParentAuth: Manual retry requested');
    setRetryCount(0);
    setError(null);
    setLoading(true);
  };

  return {
    isParent,
    parentStudents,
    directParentMode,
    loading: authLoading || loading, // Show loading if either auth or parent check is loading
    error,
    retryParentCheck // Expose retry function for manual retries
  };
};
