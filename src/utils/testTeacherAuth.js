/**
 * Teacher Authentication Test Utilities
 * 
 * This module provides testing and debugging utilities for the teacher authentication system.
 * It includes comprehensive test functions to validate direct teacher authentication functionality.
 */

import {
  isUserTeacher,
  getTeacherProfile,
  getTeacherAssignments,
  getTeacherStudents,
  getTeacherSchedule,
  getTeacherAttendance,
  getTeacherExams,
  verifyTeacherStudentAccess,
  verifyTeacherClassAccess
} from './teacherAuthHelper';

/**
 * Comprehensive test suite for teacher authentication system
 * @param {string} userId - Optional user ID to test (defaults to current user)
 * @returns {Object} Test results
 */
export const testTeacherAuth = async (userId = null) => {
  console.log('🧪 [TEACHER AUTH TEST] Starting comprehensive teacher authentication test...');
  
  // Get current user if no userId provided
  if (!userId) {
    try {
      const { getCurrentUser } = await import('./AuthContext');
      const currentUser = await getCurrentUser();
      if (!currentUser?.id) {
        throw new Error('No authenticated user found');
      }
      userId = currentUser.id;
    } catch (error) {
      console.error('❌ [TEACHER AUTH TEST] Failed to get current user:', error);
      return {
        success: false,
        error: 'No user ID provided and failed to get current user',
        results: {}
      };
    }
  }

  const testResults = {
    userId,
    startTime: new Date().toISOString(),
    tests: {},
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      warnings: 0
    }
  };

  // Helper function to run a test and record results
  const runTest = async (testName, testFunction) => {
    testResults.summary.total++;
    console.log(`🔍 [TEACHER AUTH TEST] Running ${testName}...`);
    
    try {
      const startTime = performance.now();
      const result = await testFunction();
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      
      const testResult = {
        name: testName,
        success: result.success !== false,
        duration: `${duration}ms`,
        data: result,
        timestamp: new Date().toISOString()
      };

      if (testResult.success) {
        testResults.summary.passed++;
        console.log(`✅ [TEACHER AUTH TEST] ${testName} passed (${duration}ms)`);
      } else {
        testResults.summary.failed++;
        console.error(`❌ [TEACHER AUTH TEST] ${testName} failed:`, result.error || 'Unknown error');
      }

      testResults.tests[testName] = testResult;
      return testResult;
      
    } catch (error) {
      testResults.summary.failed++;
      const testResult = {
        name: testName,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
      
      console.error(`💥 [TEACHER AUTH TEST] ${testName} threw exception:`, error);
      testResults.tests[testName] = testResult;
      return testResult;
    }
  };

  // Test 1: Check if user is a teacher
  await runTest('isUserTeacher', async () => {
    return await isUserTeacher(userId);
  });

  // Test 2: Get teacher profile
  await runTest('getTeacherProfile', async () => {
    return await getTeacherProfile(userId);
  });

  // Test 3: Get teacher assignments
  await runTest('getTeacherAssignments', async () => {
    return await getTeacherAssignments(userId);
  });

  // Test 4: Get teacher students
  await runTest('getTeacherStudents', async () => {
    return await getTeacherStudents(userId);
  });

  // Test 5: Get teacher schedule
  await runTest('getTeacherSchedule', async () => {
    return await getTeacherSchedule(userId);
  });

  // Test 6: Get teacher schedule for today
  await runTest('getTeacherScheduleToday', async () => {
    const today = new Date().getDay();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayName = dayNames[today];
    return await getTeacherSchedule(userId, todayName);
  });

  // Test 7: Get teacher attendance data
  await runTest('getTeacherAttendance', async () => {
    return await getTeacherAttendance(userId);
  });

  // Test 8: Get teacher exams
  await runTest('getTeacherExams', async () => {
    return await getTeacherExams(userId);
  });

  // Test 9: Access validation tests (only if teacher has students/classes)
  const studentsResult = testResults.tests.getTeacherStudents;
  const assignmentsResult = testResults.tests.getTeacherAssignments;

  if (studentsResult?.success && studentsResult.data?.success && studentsResult.data.students?.length > 0) {
    const firstStudent = studentsResult.data.students[0];
    
    await runTest('verifyTeacherStudentAccess_Valid', async () => {
      return await verifyTeacherStudentAccess(userId, firstStudent.id);
    });

    await runTest('verifyTeacherStudentAccess_Invalid', async () => {
      // Test with fake student ID
      return await verifyTeacherStudentAccess(userId, 'fake-student-id-12345');
    });
  }

  if (assignmentsResult?.success && assignmentsResult.data?.success && assignmentsResult.data.classes?.length > 0) {
    const firstClass = assignmentsResult.data.classes[0];
    
    await runTest('verifyTeacherClassAccess_Valid', async () => {
      return await verifyTeacherClassAccess(userId, firstClass.id);
    });

    await runTest('verifyTeacherClassAccess_Invalid', async () => {
      // Test with fake class ID
      return await verifyTeacherClassAccess(userId, 'fake-class-id-12345');
    });
  }

  // Generate summary
  testResults.endTime = new Date().toISOString();
  testResults.success = testResults.summary.failed === 0;

  // Log comprehensive results
  console.log('📊 [TEACHER AUTH TEST] Test Summary:');
  console.log(`   Total Tests: ${testResults.summary.total}`);
  console.log(`   Passed: ${testResults.summary.passed}`);
  console.log(`   Failed: ${testResults.summary.failed}`);
  console.log(`   Success Rate: ${((testResults.summary.passed / testResults.summary.total) * 100).toFixed(1)}%`);

  if (testResults.summary.failed > 0) {
    console.log('❌ [TEACHER AUTH TEST] Failed Tests:');
    Object.values(testResults.tests)
      .filter(test => !test.success)
      .forEach(test => {
        console.log(`   - ${test.name}: ${test.error || 'Unknown error'}`);
      });
  }

  return testResults;
};

/**
 * Quick teacher authentication test
 * @param {string} userId - Optional user ID to test
 * @returns {Object} Quick test results
 */
export const quickTeacherAuthTest = async (userId = null) => {
  console.log('⚡ [TEACHER AUTH TEST] Running quick teacher authentication test...');

  // Get current user if no userId provided
  if (!userId) {
    try {
      const { getCurrentUser } = await import('./AuthContext');
      const currentUser = await getCurrentUser();
      if (!currentUser?.id) {
        throw new Error('No authenticated user found');
      }
      userId = currentUser.id;
    } catch (error) {
      console.error('❌ [TEACHER AUTH TEST] Failed to get current user:', error);
      return {
        success: false,
        error: 'No user ID provided and failed to get current user'
      };
    }
  }

  try {
    // Quick test: Check if user is a teacher and get basic info
    const teacherCheck = await isUserTeacher(userId);
    
    if (!teacherCheck.success) {
      return {
        success: false,
        isTeacher: false,
        error: teacherCheck.error,
        userId
      };
    }

    if (!teacherCheck.isTeacher) {
      return {
        success: true,
        isTeacher: false,
        message: 'User is not a teacher',
        userId
      };
    }

    // Get basic teacher data
    const [profileResult, assignmentsResult] = await Promise.all([
      getTeacherProfile(userId),
      getTeacherAssignments(userId)
    ]);

    const result = {
      success: true,
      isTeacher: true,
      userId,
      teacherInfo: {
        hasProfile: teacherCheck.teacherProfile ? true : false,
        profileName: teacherCheck.teacherProfile?.name,
        classCount: teacherCheck.classCount,
        assignmentCount: teacherCheck.assignedClassesCount
      },
      profileResult: {
        success: profileResult.success,
        error: profileResult.error
      },
      assignmentsResult: {
        success: assignmentsResult.success,
        totalClasses: assignmentsResult.totalClasses || 0,
        totalSubjects: assignmentsResult.totalSubjects || 0,
        error: assignmentsResult.error
      },
      timestamp: new Date().toISOString()
    };

    console.log('✅ [TEACHER AUTH TEST] Quick test completed:', {
      isTeacher: result.isTeacher,
      classes: result.assignmentsResult.totalClasses,
      subjects: result.assignmentsResult.totalSubjects
    });

    return result;

  } catch (error) {
    console.error('💥 [TEACHER AUTH TEST] Quick test failed:', error);
    return {
      success: false,
      error: error.message,
      userId
    };
  }
};

/**
 * Test teacher authentication performance
 * @param {string} userId - Optional user ID to test
 * @param {number} iterations - Number of test iterations
 * @returns {Object} Performance test results
 */
export const benchmarkTeacherAuth = async (userId = null, iterations = 5) => {
  console.log(`🏁 [TEACHER AUTH BENCHMARK] Starting performance benchmark (${iterations} iterations)...`);

  // Get current user if no userId provided
  if (!userId) {
    try {
      const { getCurrentUser } = await import('./AuthContext');
      const currentUser = await getCurrentUser();
      if (!currentUser?.id) {
        throw new Error('No authenticated user found');
      }
      userId = currentUser.id;
    } catch (error) {
      console.error('❌ [TEACHER AUTH BENCHMARK] Failed to get current user:', error);
      return {
        success: false,
        error: 'No user ID provided and failed to get current user'
      };
    }
  }

  const benchmarks = {
    userId,
    iterations,
    results: {},
    summary: {}
  };

  const functions = [
    { name: 'isUserTeacher', fn: isUserTeacher },
    { name: 'getTeacherProfile', fn: getTeacherProfile },
    { name: 'getTeacherAssignments', fn: getTeacherAssignments },
    { name: 'getTeacherStudents', fn: getTeacherStudents },
    { name: 'getTeacherSchedule', fn: getTeacherSchedule }
  ];

  for (const { name, fn } of functions) {
    console.log(`📊 [TEACHER AUTH BENCHMARK] Benchmarking ${name}...`);
    
    const times = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < iterations; i++) {
      try {
        const startTime = performance.now();
        const result = await fn(userId);
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        times.push(duration);
        
        if (result.success !== false) {
          successCount++;
        } else {
          errorCount++;
        }
        
      } catch (error) {
        errorCount++;
        console.warn(`⚠️ [TEACHER AUTH BENCHMARK] ${name} iteration ${i + 1} failed:`, error.message);
      }
    }

    if (times.length > 0) {
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);

      benchmarks.results[name] = {
        iterations: times.length,
        averageTime: Math.round(avgTime * 100) / 100,
        minTime: Math.round(minTime * 100) / 100,
        maxTime: Math.round(maxTime * 100) / 100,
        successCount,
        errorCount,
        successRate: (successCount / iterations * 100).toFixed(1) + '%'
      };

      console.log(`✅ [TEACHER AUTH BENCHMARK] ${name}: avg ${avgTime.toFixed(1)}ms, min ${minTime.toFixed(1)}ms, max ${maxTime.toFixed(1)}ms`);
    } else {
      benchmarks.results[name] = {
        error: 'All iterations failed',
        successCount: 0,
        errorCount: iterations
      };
    }
  }

  // Generate summary
  const allTimes = Object.values(benchmarks.results)
    .filter(result => !result.error)
    .map(result => result.averageTime);

  if (allTimes.length > 0) {
    benchmarks.summary = {
      overallAverage: Math.round((allTimes.reduce((a, b) => a + b, 0) / allTimes.length) * 100) / 100,
      fastestFunction: Object.entries(benchmarks.results)
        .filter(([_, result]) => !result.error)
        .sort(([_, a], [__, b]) => a.averageTime - b.averageTime)[0]?.[0],
      slowestFunction: Object.entries(benchmarks.results)
        .filter(([_, result]) => !result.error)
        .sort(([_, a], [__, b]) => b.averageTime - a.averageTime)[0]?.[0]
    };
  }

  console.log('🏆 [TEACHER AUTH BENCHMARK] Benchmark completed:', benchmarks.summary);
  
  return benchmarks;
};

/**
 * Monitor teacher authentication performance in real-time
 * @param {string} userId - Optional user ID to monitor
 * @param {number} duration - Duration to monitor in milliseconds
 * @param {number} interval - Interval between tests in milliseconds
 * @returns {Object} Monitoring results
 */
export const monitorTeacherAuthPerformance = async (userId = null, duration = 30000, interval = 2000) => {
  console.log(`📈 [TEACHER AUTH MONITOR] Starting performance monitoring (${duration/1000}s duration, ${interval/1000}s interval)...`);

  // Get current user if no userId provided
  if (!userId) {
    try {
      const { getCurrentUser } = await import('./AuthContext');
      const currentUser = await getCurrentUser();
      if (!currentUser?.id) {
        throw new Error('No authenticated user found');
      }
      userId = currentUser.id;
    } catch (error) {
      console.error('❌ [TEACHER AUTH MONITOR] Failed to get current user:', error);
      return {
        success: false,
        error: 'No user ID provided and failed to get current user'
      };
    }
  }

  const monitoring = {
    userId,
    startTime: new Date().toISOString(),
    duration,
    interval,
    samples: [],
    summary: {}
  };

  const startTime = Date.now();
  let sampleCount = 0;

  return new Promise((resolve) => {
    const monitorInterval = setInterval(async () => {
      const currentTime = Date.now();
      
      if (currentTime - startTime >= duration) {
        clearInterval(monitorInterval);
        
        // Calculate summary
        if (monitoring.samples.length > 0) {
          const times = monitoring.samples.map(s => s.responseTime);
          const successes = monitoring.samples.filter(s => s.success).length;
          
          monitoring.summary = {
            totalSamples: monitoring.samples.length,
            successRate: ((successes / monitoring.samples.length) * 100).toFixed(1) + '%',
            averageResponseTime: Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 100) / 100,
            minResponseTime: Math.min(...times),
            maxResponseTime: Math.max(...times),
            endTime: new Date().toISOString()
          };
        }

        console.log('📊 [TEACHER AUTH MONITOR] Monitoring completed:', monitoring.summary);
        resolve(monitoring);
        return;
      }

      // Run quick test
      sampleCount++;
      console.log(`📊 [TEACHER AUTH MONITOR] Sample ${sampleCount}...`);
      
      try {
        const testStart = performance.now();
        const result = await quickTeacherAuthTest(userId);
        const testEnd = performance.now();
        
        monitoring.samples.push({
          timestamp: new Date().toISOString(),
          sampleNumber: sampleCount,
          success: result.success,
          responseTime: Math.round((testEnd - testStart) * 100) / 100,
          isTeacher: result.isTeacher,
          error: result.error
        });
        
      } catch (error) {
        monitoring.samples.push({
          timestamp: new Date().toISOString(),
          sampleNumber: sampleCount,
          success: false,
          error: error.message
        });
      }
    }, interval);
  });
};

// Export test functions for browser console usage
if (typeof window !== 'undefined') {
  window.testTeacherAuth = testTeacherAuth;
  window.quickTeacherAuthTest = quickTeacherAuthTest;
  window.benchmarkTeacherAuth = benchmarkTeacherAuth;
  window.monitorTeacherAuthPerformance = monitorTeacherAuthPerformance;
  
  console.log('🧪 [TEACHER AUTH TEST] Test utilities loaded. Available functions:');
  console.log('   • window.testTeacherAuth() - Comprehensive test suite');
  console.log('   • window.quickTeacherAuthTest() - Quick validation test');
  console.log('   • window.benchmarkTeacherAuth() - Performance benchmark');
  console.log('   • window.monitorTeacherAuthPerformance() - Real-time monitoring');
}