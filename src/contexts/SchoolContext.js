import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from '../utils/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

console.log('📦 SchoolContext.js file loaded!');

const SchoolContext = createContext({});

export const useSchool = () => {
  const context = useContext(SchoolContext);
  if (!context) {
    throw new Error('useSchool must be used within a SchoolProvider');
  }
  return context;
};

export const SchoolProvider = ({ children }) => {
  console.log('🚀 SchoolProvider mounting...');
  
  const { user } = useAuth();
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [userSchools, setUserSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  console.log('👤 Current user in SchoolProvider:', user?.id, user?.email);

  // Load user's schools and selected school
  const loadUserSchools = async () => {
    console.log('🏫 loadUserSchools called with user:', user?.id, user?.email);
    
    if (!user?.id) {
      console.log('❌ No user ID provided to loadUserSchools');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('🔍 Fetching schools for user ID:', user.id);

      // Fetch user's schools from school_users junction table
      const { data: schoolsData, error: schoolsError } = await supabase
        .from('school_users')
        .select(`
          school_id,
          role_in_school,
          is_primary_school,
          school_details:school_id (
            id,
            name,
            type,
            school_code,
            address,
            phone,
            email,
            is_active
          )
        `)
        .eq('user_id', user.id)
        .eq('school_details.is_active', true);

      console.log('🏫 School query result:', { schoolsData, schoolsError });

      if (schoolsError) throw schoolsError;

      console.log('🔍 Raw schoolsData from query:', schoolsData);

      const schools = schoolsData?.map(item => ({
        ...item.school_details,
        role_in_school: item.role_in_school,
        is_primary_school: item.is_primary_school
      })) || [];

      console.log('🏫 Processed schools array:', schools);
      setUserSchools(schools);

      // Try to load previously selected school from storage
      const savedSchoolId = await AsyncStorage.getItem(`selectedSchool_${user.id}`);
      console.log('💾 Saved school ID from storage:', savedSchoolId);
      
      let schoolToSelect = null;
      
      if (savedSchoolId) {
        // Check if saved school is still available to user
        schoolToSelect = schools.find(school => school.id === savedSchoolId);
        console.log('🎯 Found saved school:', schoolToSelect?.name);
      }
      
      if (!schoolToSelect) {
        // Fall back to primary school or first available school
        schoolToSelect = schools.find(school => school.is_primary_school) || schools[0];
        console.log('🎯 Selected fallback school:', schoolToSelect?.name, 'is_primary:', schoolToSelect?.is_primary_school);
      }

      if (schoolToSelect) {
        console.log('✅ Setting selected school:', schoolToSelect.name, schoolToSelect.id);
        setSelectedSchool(schoolToSelect);
        await AsyncStorage.setItem(`selectedSchool_${user.id}`, schoolToSelect.id);
      } else {
        console.log('❌ No school to select!');
      }

    } catch (error) {
      console.error('Error loading user schools:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Switch to a different school
  const switchSchool = async (schoolId) => {
    try {
      const school = userSchools.find(s => s.id === schoolId);
      if (!school) {
        throw new Error('School not found or access denied');
      }

      setSelectedSchool(school);
      await AsyncStorage.setItem(`selectedSchool_${user.id}`, schoolId);

      // Optionally update primary school in database
      await supabase.rpc('switch_user_school', {
        user_uuid: user.id,
        new_school_id: schoolId
      });

    } catch (error) {
      console.error('Error switching school:', error);
      setError(error.message);
      throw error;
    }
  };

  // Get filtered query with school_id
  const getSchoolFilteredQuery = (tableName) => {
    const query = supabase.from(tableName);
    if (selectedSchool?.id) {
      return query.eq('school_id', selectedSchool.id);
    }
    return query;
  };

  // Add school_id to insert operations
  const addSchoolIdToData = (data) => {
    if (!selectedSchool?.id) {
      throw new Error('No school selected');
    }
    
    if (Array.isArray(data)) {
      return data.map(item => ({ ...item, school_id: selectedSchool.id }));
    }
    
    return { ...data, school_id: selectedSchool.id };
  };

  // Check if user has specific role in current school
  const hasRole = (role) => {
    if (!selectedSchool) return false;
    return selectedSchool.role_in_school === role;
  };

  // Check if user has any of the specified roles
  const hasAnyRole = (roles) => {
    if (!selectedSchool) return false;
    return roles.includes(selectedSchool.role_in_school);
  };

  // Load schools when user changes
  useEffect(() => {
    console.log('🔄 SchoolProvider useEffect triggered with user:', {
      id: user?.id,
      email: user?.email,
      role_id: user?.role_id,
      school_id: user?.school_id
    });
    
    if (user?.id) {
      console.log('📞 Calling loadUserSchools...');
      loadUserSchools();
    } else {
      console.log('🚫 No user ID, clearing school state');
      setSelectedSchool(null);
      setUserSchools([]);
      setLoading(false);
    }
  }, [user?.id]);

  const value = {
    selectedSchool,
    userSchools,
    loading,
    error,
    switchSchool,
    loadUserSchools,
    getSchoolFilteredQuery,
    addSchoolIdToData,
    hasRole,
    hasAnyRole,
    // Helper getters
    isAdmin: hasRole('Admin'),
    isTeacher: hasRole('Teacher'),
    isStudent: hasRole('Student'),
    isParent: hasRole('Parent'),
    canManageSchool: hasAnyRole(['Admin']),
    canManageClasses: hasAnyRole(['Admin', 'Teacher']),
    canViewReports: hasAnyRole(['Admin', 'Teacher'])
  };

  return (
    <SchoolContext.Provider value={value}>
      {children}
    </SchoolContext.Provider>
  );
};

export default SchoolContext;
