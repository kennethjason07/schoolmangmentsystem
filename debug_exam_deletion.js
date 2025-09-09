// DEBUG: Exam Deletion Troubleshooting Helper
// Add this to your ExamsMarks.js file to debug the deletion issue

// Enhanced handleDeleteExam with detailed logging
const handleDeleteExamDebug = (exam) => {
  console.log('🔍 [DEBUG] Delete button clicked for exam:', {
    id: exam.id,
    name: exam.name,
    tenant_id: exam.tenant_id,
    class_id: exam.class_id
  });

  Alert.alert(
    'Delete Exam',
    `Delete "${exam.name}"?`,
    [
      { 
        text: 'Cancel',
        onPress: () => console.log('🔍 [DEBUG] User cancelled deletion')
      },
      {
        text: 'Delete',
        onPress: async () => {
          console.log('🔍 [DEBUG] User confirmed deletion, starting process...');
          
          try {
            console.log('🔍 [DEBUG] Current tenantId:', tenantId);
            console.log('🔍 [DEBUG] Current user:', user?.id);
            
            // 🛡️ Validate tenant access first
            console.log('🔍 [DEBUG] Validating tenant access...');
            const validation = await validateTenantAccess(tenantId, user?.id, 'ExamsMarks - handleDeleteExam');
            if (!validation.isValid) {
              console.error('🔍 [DEBUG] Tenant validation failed:', validation.error);
              Alert.alert('Access Denied', validation.error);
              return;
            }
            console.log('🔍 [DEBUG] Tenant validation passed');

            // Delete marks first with tenant validation
            console.log('🔍 [DEBUG] Deleting marks for exam ID:', exam.id);
            const marksDeleteResult = await supabase
              .from('marks')
              .delete()
              .eq('exam_id', exam.id)
              .eq('tenant_id', tenantId);

            console.log('🔍 [DEBUG] Marks deletion result:', marksDeleteResult);

            if (marksDeleteResult.error) {
              console.error('🔍 [DEBUG] Error deleting marks:', marksDeleteResult.error);
              throw marksDeleteResult.error;
            }

            // Delete exam with tenant validation
            console.log('🔍 [DEBUG] Deleting exam with ID:', exam.id, 'and tenant_id:', tenantId);
            const examDeleteResult = await supabase
              .from('exams')
              .delete()
              .eq('id', exam.id)
              .eq('tenant_id', tenantId);

            console.log('🔍 [DEBUG] Exam deletion result:', examDeleteResult);

            if (examDeleteResult.error) {
              console.error('🔍 [DEBUG] Error deleting exam:', examDeleteResult.error);
              throw examDeleteResult.error;
            }

            console.log('🔍 [DEBUG] Exam deleted successfully, showing success alert');
            Alert.alert('Success', 'Exam deleted');
            
            console.log('🔍 [DEBUG] Reloading data...');
            await loadAllData();
            console.log('🔍 [DEBUG] Data reloaded successfully');

          } catch (error) {
            console.error('🔍 [DEBUG] Error in deletion process:', error);
            console.error('🔍 [DEBUG] Error details:', {
              message: error.message,
              code: error.code,
              details: error.details,
              hint: error.hint
            });
            Alert.alert('Error', `Failed to delete exam: ${error.message}`);
          }
        }
      }
    ]
  );
};

// Enhanced logging for loadAllData to see if data is actually reloading
const loadAllDataDebug = async () => {
  console.log('🔍 [DEBUG] loadAllData called');
  
  try {
    // 🛡️ Ensure tenant context is available before proceeding
    if (!tenantId) {
      console.log('🔍 [DEBUG] No tenantId available, exiting loadAllData');
      setLoading(false);
      return;
    }
    
    console.log('🔍 [DEBUG] Loading data with tenantId:', tenantId);
    setLoading(true);
    
    // Load exams with logging
    console.log('🔍 [DEBUG] Fetching exams...');
    const { data: examsData, error: examsError } = await createTenantQuery(tenantId, 'exams')
      .select(`
        id, 
        name, 
        class_id, 
        academic_year, 
        start_date, 
        end_date, 
        remarks, 
        max_marks,
        tenant_id,
        created_at,
        classes!inner(
          id,
          class_name,
          section
        )
      `)
      .execute();

    if (examsError) {
      console.error('🔍 [DEBUG] Error fetching exams:', examsError);
      throw examsError;
    }

    console.log('🔍 [DEBUG] Exams fetched:', {
      count: examsData?.length || 0,
      exams: examsData?.map(e => ({ id: e.id, name: e.name })) || []
    });

    // Load other data...
    // (You can add similar logging for classes, subjects, etc.)

    // Set the data
    console.log('🔍 [DEBUG] Setting exams data in state');
    setExams(examsData || []);
    
  } catch (error) {
    console.error('🔍 [DEBUG] Error in loadAllData:', error);
    Alert.alert('Error', 'Failed to load data');
  } finally {
    console.log('🔍 [DEBUG] loadAllData completed');
    setLoading(false);
  }
};

// Check if the exam is actually in the state after deletion
const checkExamInState = (examId) => {
  const examExists = exams.find(e => e.id === examId);
  console.log('🔍 [DEBUG] Checking if exam still exists in state:', {
    examId,
    exists: !!examExists,
    currentExamsCount: exams.length,
    allExamIds: exams.map(e => e.id)
  });
  return examExists;
};

// Export these functions or add them directly to your component
export {
  handleDeleteExamDebug,
  loadAllDataDebug,
  checkExamInState
};
