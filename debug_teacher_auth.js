/**
 * Emergency Teacher Authentication Debug Script
 * 
 * Run this in the browser console to debug teacher authentication issues
 */

console.log('🚀 Starting Emergency Teacher Authentication Debug...');

// Function to debug teacher authentication
window.emergencyTeacherDebug = async () => {
  console.log('='.repeat(60));
  console.log('🔍 EMERGENCY TEACHER AUTHENTICATION DEBUG');
  console.log('='.repeat(60));

  // Step 1: Check if user is authenticated
  try {
    // Try to get user from different possible sources
    let user = null;
    
    // Method 1: Try AuthContext
    try {
      if (window.AuthContext && window.AuthContext.user) {
        user = window.AuthContext.user;
        console.log('✅ User found via AuthContext');
      }
    } catch (e) {
      console.log('⚠️ AuthContext not available');
    }
    
    // Method 2: Try Supabase session
    if (!user) {
      try {
        const supabase = window.supabase || (await import('./src/utils/supabase.js')).supabase;
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          user = session.user;
          console.log('✅ User found via Supabase session');
        }
      } catch (e) {
        console.log('⚠️ Supabase session check failed:', e.message);
      }
    }
    
    if (!user) {
      console.error('❌ No authenticated user found');
      return { success: false, error: 'No authenticated user' };
    }
    
    console.log('👤 Authenticated User:', {
      id: user.id,
      email: user.email,
      role_id: user.role_id
    });

    // Step 2: Test teacher authentication directly
    console.log('\n🔍 Testing Teacher Authentication...');
    
    try {
      // Import teacher auth helper
      const { isUserTeacher } = await import('./src/utils/teacherAuthHelper.js');
      
      const teacherResult = await isUserTeacher(user.id);
      console.log('📊 Teacher Check Result:', teacherResult);
      
      if (teacherResult.success && teacherResult.isTeacher) {
        console.log('✅ USER IS A TEACHER!');
        console.log('📚 Classes:', teacherResult.classCount);
        console.log('📝 Assignments:', teacherResult.assignedClassesCount);
        
        // Test profile loading
        console.log('\n🔍 Testing Teacher Profile Loading...');
        const { getTeacherProfile } = await import('./src/utils/teacherAuthHelper.js');
        const profileResult = await getTeacherProfile(user.id);
        console.log('👨‍🏫 Profile Result:', profileResult);
        
        // Test assignments loading
        console.log('\n🔍 Testing Teacher Assignments Loading...');
        const { getTeacherAssignments } = await import('./src/utils/teacherAuthHelper.js');
        const assignmentsResult = await getTeacherAssignments(user.id);
        console.log('📋 Assignments Result:', {
          success: assignmentsResult.success,
          totalClasses: assignmentsResult.totalClasses,
          totalSubjects: assignmentsResult.totalSubjects,
          error: assignmentsResult.error
        });
        
        return {
          success: true,
          isTeacher: true,
          user,
          teacherResult,
          profileResult,
          assignmentsResult
        };
        
      } else if (teacherResult.success && !teacherResult.isTeacher) {
        console.log('⚠️ User is NOT a teacher');
        return {
          success: true,
          isTeacher: false,
          user,
          teacherResult
        };
      } else {
        console.error('❌ Teacher check failed:', teacherResult.error);
        return {
          success: false,
          error: teacherResult.error,
          user,
          teacherResult
        };
      }
      
    } catch (importError) {
      console.error('❌ Failed to import teacher auth helper:', importError);
      return {
        success: false,
        error: 'Failed to load teacher authentication module: ' + importError.message,
        user
      };
    }
    
  } catch (error) {
    console.error('❌ Emergency debug failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Function to check dashboard state
window.checkDashboardState = () => {
  console.log('📊 Current Dashboard State:');
  
  if (typeof window.debugTeacherDashboard === 'function') {
    return window.debugTeacherDashboard();
  } else {
    console.log('⚠️ Dashboard debug function not available - make sure you\'re on the Teacher Dashboard');
    return { error: 'Dashboard debug function not available' };
  }
};

// Function to force teacher authentication mode
window.forceTeacherMode = () => {
  console.log('🔄 Attempting to force teacher authentication mode...');
  
  if (typeof window.forceTeacherAuth === 'function') {
    window.forceTeacherAuth();
    console.log('✅ Teacher mode forced. Try refreshing the dashboard.');
  } else {
    console.log('⚠️ Force teacher auth function not available - make sure you\'re on the Teacher Dashboard');
  }
};

// Auto-run the debug
console.log('🎯 Available Debug Functions:');
console.log('• window.emergencyTeacherDebug() - Full teacher authentication debug');
console.log('• window.checkDashboardState() - Check current dashboard state');
console.log('• window.forceTeacherMode() - Force teacher authentication mode');
console.log('\n🚀 Running automatic debug...\n');

// Run the debug automatically
window.emergencyTeacherDebug().then(result => {
  console.log('\n' + '='.repeat(60));
  console.log('🏁 EMERGENCY DEBUG COMPLETE');
  console.log('='.repeat(60));
  console.log('📊 Final Result:', result);
  
  if (result.success && result.isTeacher) {
    console.log('\n✅ SOLUTION: You are a teacher! The system should use direct teacher authentication.');
    console.log('💡 Try running: window.forceTeacherMode()');
  } else if (result.success && !result.isTeacher) {
    console.log('\n⚠️ INFO: You are not a teacher. The tenant system should work normally.');
    console.log('🔍 Check your tenant configuration.');
  } else {
    console.log('\n❌ ERROR: Teacher authentication failed.');
    console.log('🛠️ Check the error details above and contact support.');
  }
}).catch(error => {
  console.error('❌ Emergency debug crashed:', error);
});