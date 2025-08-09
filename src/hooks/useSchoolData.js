import { useEffect } from 'react';
import { useSchool } from '../contexts/SchoolContext';
import supabaseService from '../services/supabaseService';

// Hook to sync school context with supabase service
export const useSchoolData = () => {
  const { selectedSchool, loading } = useSchool();

  useEffect(() => {
    console.log('🔧 useSchoolData - selectedSchool changed:', selectedSchool?.id, selectedSchool?.name);
    // Update the service with the current school context
    if (selectedSchool?.id) {
      console.log('🔧 Setting supabaseService school context to:', selectedSchool.id);
      supabaseService.setSchoolContext(selectedSchool.id);
    } else {
      console.log('🔧 No school selected, supabaseService context not set');
    }
  }, [selectedSchool?.id]);

  return {
    schoolService: supabaseService,
    selectedSchool,
    loading,
    schoolId: selectedSchool?.id
  };
};

export default useSchoolData;
