// Quick debug enhancement to add to ExamsMarks.js
// Add this right after the handleMarksChange function to debug the save issue

const debugMarksState = () => {
  console.log('🧪 MARKS DEBUG - Current state analysis:');
  console.log('📊 marksForm:', marksForm);
  console.log('📊 Object.keys(marksForm):', Object.keys(marksForm));
  console.log('📊 selectedExam:', selectedExam?.name, selectedExam?.id);
  console.log('📊 selectedClassForMarks:', selectedClassForMarks?.class_name, selectedClassForMarks?.id);
  console.log('📊 students count:', students.length);
  console.log('📊 subjects count:', subjects.length);
  console.log('📊 Platform.OS:', Platform.OS);
  
  // Check if any marks are actually entered
  let totalMarksEntered = 0;
  Object.values(marksForm).forEach(studentMarks => {
    Object.values(studentMarks || {}).forEach(mark => {
      if (mark && mark.trim() !== '') {
        totalMarksEntered++;
      }
    });
  });
  console.log('📊 Total marks entered:', totalMarksEntered);
  
  return {
    hasMarksData: Object.keys(marksForm).length > 0,
    totalMarksEntered,
    hasSelectedExam: !!selectedExam,
    hasSelectedClass: !!selectedClassForMarks,
    platform: Platform.OS
  };
};

// Enhanced handleBulkSaveMarks with immediate debugging
const handleBulkSaveMarksWithDebug = async () => {
  console.log('🚀 IMMEDIATE DEBUG - Save button clicked!');
  console.log('⏰ Timestamp:', new Date().toISOString());
  console.log('🌐 Platform:', Platform.OS);
  
  try {
    // Immediate state check
    const debugInfo = debugMarksState();
    console.log('📋 Debug info:', debugInfo);
    
    // Check if we have the enhanced version
    if (typeof window !== 'undefined') {
      console.log('🕷️ Running on web platform');
      console.log('🔍 window.alert available:', typeof window.alert !== 'undefined');
    }
    
    // Call original function
    console.log('📞 Calling original handleBulkSaveMarks...');
    await handleBulkSaveMarks();
    console.log('✅ Original function completed');
    
  } catch (error) {
    console.error('💥 Error in debug wrapper:', error);
    console.error('💥 Error stack:', error.stack);
  }
};

console.log('🔧 Debug enhancement loaded - Use debugMarksState() to check current state');

// Instructions for manual testing:
console.log(`
🧪 MANUAL TESTING INSTRUCTIONS:

1. Enter some marks in the form
2. Open browser console
3. Type: debugMarksState()
4. Check if marksForm has data
5. Click Save Changes button
6. Watch for debug messages

Expected console output when clicking save:
🚀 IMMEDIATE DEBUG - Save button clicked!
📊 MARKS DEBUG - Current state analysis:
💾 MARKS SAVE DEBUG - Starting save process...
`);

export { debugMarksState, handleBulkSaveMarksWithDebug };
