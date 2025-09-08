// QUICK FIX: Enhanced Exam Deletion Function
// Replace the existing handleDeleteExam function in ExamsMarks.js with this version

const handleDeleteExam = (exam) => {
  console.log('🗑️ handleDeleteExam called with exam:', exam);
  
  // Immediate UI feedback
  Alert.alert(
    'Delete Exam',
    `Are you sure you want to delete "${exam.name}"?\n\nThis will also delete all marks associated with this exam.`,
    [
      { 
        text: 'Cancel',
        style: 'cancel',
        onPress: () => console.log('User cancelled exam deletion')
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          // Show loading immediately
          setLoading(true);
          
          try {
            console.log('🔄 Starting exam deletion process...');
            
            // 🛡️ Validate tenant access first
            const validation = await validateTenantAccess(tenantId, user?.id, 'ExamsMarks - handleDeleteExam');
            if (!validation.isValid) {
              console.error('❌ Tenant validation failed:', validation.error);
              Alert.alert('Access Denied', validation.error);
              return;
            }
            
            console.log('✅ Tenant validation passed, proceeding with deletion');

            // Step 1: Delete associated marks first
            console.log('🔄 Deleting marks for exam ID:', exam.id);
            const { error: marksError } = await supabase
              .from('marks')
              .delete()
              .eq('exam_id', exam.id)
              .eq('tenant_id', tenantId);

            if (marksError) {
              console.error('❌ Error deleting marks:', marksError);
              throw new Error(`Failed to delete marks: ${marksError.message}`);
            }
            console.log('✅ Marks deleted successfully');

            // Step 2: Delete the exam
            console.log('🔄 Deleting exam with ID:', exam.id);
            const { error: examError } = await supabase
              .from('exams')
              .delete()
              .eq('id', exam.id)
              .eq('tenant_id', tenantId);

            if (examError) {
              console.error('❌ Error deleting exam:', examError);
              throw new Error(`Failed to delete exam: ${examError.message}`);
            }
            console.log('✅ Exam deleted successfully');

            // Step 3: Update local state immediately for instant UI feedback
            console.log('🔄 Updating local state...');
            setExams(prevExams => {
              const updatedExams = prevExams.filter(e => e.id !== exam.id);
              console.log('✅ Local state updated. Remaining exams:', updatedExams.length);
              return updatedExams;
            });

            // Also update marks state to remove deleted marks
            setMarks(prevMarks => {
              const updatedMarks = prevMarks.filter(m => m.exam_id !== exam.id);
              console.log('✅ Marks state updated. Remaining marks:', updatedMarks.length);
              return updatedMarks;
            });

            // Step 4: Show success message
            Alert.alert('Success', `Exam "${exam.name}" has been deleted successfully.`);

            // Step 5: Refresh data from server to ensure consistency
            console.log('🔄 Refreshing data from server...');
            await loadAllData();
            console.log('✅ Data refresh completed');

          } catch (error) {
            console.error('❌ Error in deletion process:', error);
            Alert.alert(
              'Deletion Failed', 
              `Could not delete the exam: ${error.message}\n\nPlease try again or contact support if the problem persists.`
            );
          } finally {
            setLoading(false);
          }
        }
      }
    ]
  );
};

// Alternative simple deletion approach (if the above doesn't work)
const handleDeleteExamSimple = async (exam) => {
  try {
    console.log('🗑️ Simple delete for exam:', exam.id);
    
    // Direct database deletion without complex validation
    const { error } = await supabase
      .from('exams')
      .delete()
      .eq('id', exam.id);

    if (error) throw error;

    // Immediate state update
    setExams(prev => prev.filter(e => e.id !== exam.id));
    
    Alert.alert('Success', 'Exam deleted');
    
  } catch (error) {
    console.error('Delete error:', error);
    Alert.alert('Error', error.message);
  }
};

// Enhanced loadAllData with better error handling
const loadAllDataEnhanced = async () => {
  try {
    console.log('🔄 Loading all data...');
    
    if (!tenantId) {
      console.log('⏳ No tenant ID available');
      setLoading(false);
      return;
    }
    
    setLoading(true);
    
    // Load exams with better error handling
    const examsQuery = createTenantQuery(tenantId, 'exams')
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
      `);

    const { data: examsData, error: examsError } = await examsQuery;

    if (examsError) {
      console.error('❌ Error loading exams:', examsError);
      throw examsError;
    }

    console.log('✅ Loaded exams:', examsData?.length || 0);
    setExams(examsData || []);

    // Load other data similarly...
    // (Add similar enhanced loading for classes, subjects, marks, students)

  } catch (error) {
    console.error('❌ Error in loadAllData:', error);
    Alert.alert('Loading Error', `Failed to load data: ${error.message}`);
  } finally {
    setLoading(false);
  }
};

// Usage Instructions:
// 1. Replace the existing handleDeleteExam function with the enhanced version above
// 2. If that doesn't work, try the handleDeleteExamSimple version
// 3. Check the browser/device console for detailed logs
// 4. Make sure the delete button is calling the right function

export {
  handleDeleteExam,
  handleDeleteExamSimple,
  loadAllDataEnhanced
};
