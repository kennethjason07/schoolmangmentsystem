/**
 * Student Data Consistency Testing Script
 * 
 * This script helps verify that student data is consistent across all screens
 * after implementing the standardized calculation system.
 * 
 * Usage:
 * 1. Run this in the browser console on any screen
 * 2. Or integrate into your testing framework
 * 3. Check console output for consistency results
 */

// Test configuration
const TEST_CONFIG = {
  // Set this to a real student ID from your database
  TEST_STUDENT_ID: null, // Will be set automatically if null
  
  // Screens to test (add paths as needed)
  SCREENS: [
    '/admin/manage-students',
    '/student/dashboard', 
    '/admin/dashboard',
    '/admin/manage-classes',
    '/student/profile'
  ],
  
  // Expected data tolerances
  TOLERANCE: {
    attendance: 1, // 1% tolerance for rounding differences
    academic: 0.5,  // 0.5% tolerance
    fees: 0.01      // 1 cent tolerance for fees
  }
};

/**
 * Main consistency test runner
 */
class StudentConsistencyTester {
  constructor() {
    this.results = {};
    this.studentId = TEST_CONFIG.TEST_STUDENT_ID;
  }

  /**
   * Run the full consistency test
   */
  async runConsistencyTest() {
    console.log('🧪 Starting Student Data Consistency Test...');
    
    try {
      // Step 1: Get a test student ID if not provided
      if (!this.studentId) {
        this.studentId = await this.getTestStudentId();
        if (!this.studentId) {
          throw new Error('No test student found');
        }
      }
      
      console.log(`📋 Testing student: ${this.studentId}`);
      
      // Step 2: Get data from different calculation methods
      await this.gatherTestData();
      
      // Step 3: Compare results
      this.compareResults();
      
      // Step 4: Display results
      this.displayResults();
      
    } catch (error) {
      console.error('❌ Test failed:', error);
    }
  }

  /**
   * Get a test student ID from the database
   */
  async getTestStudentId() {
    const { supabase } = await import('./src/config/supabaseClient.js');
    
    const { data: students, error } = await supabase
      .from('students')
      .select('id, name')
      .limit(1);
      
    if (error) {
      console.error('Error fetching test student:', error);
      return null;
    }
    
    if (students && students.length > 0) {
      console.log(`📝 Using test student: ${students[0].name} (${students[0].id})`);
      return students[0].id;
    }
    
    return null;
  }

  /**
   * Gather test data from different sources
   */
  async gatherTestData() {
    const { supabase } = await import('./src/config/supabaseClient.js');
    const { 
      AttendanceCalculator, 
      AcademicCalculator, 
      FeeCalculator,
      ScreenCalculators 
    } = await import('./src/utils/studentCalculations.js');

    console.log('📊 Gathering data from different calculation methods...');
    
    // Get tenant ID (assuming you have it available)
    const tenantId = localStorage.getItem('tenantId') || 'default-tenant';
    
    try {
      // Test individual calculators
      console.log('🔄 Testing AttendanceCalculator...');
      this.results.attendance = {
        current_month: await AttendanceCalculator.calculateAttendancePercentage(
          this.studentId, 
          tenantId, 
          { period: 'current_month' }
        ),
        last_3_months: await AttendanceCalculator.calculateAttendancePercentage(
          this.studentId, 
          tenantId, 
          { period: 'last_3_months' }
        )
      };

      console.log('📚 Testing AcademicCalculator...');
      this.results.academic = {
        percentage: await AcademicCalculator.calculateAcademicPerformance(
          this.studentId,
          tenantId,
          { returnType: 'percentage' }
        ),
        both: await AcademicCalculator.calculateAcademicPerformance(
          this.studentId,
          tenantId,
          { returnType: 'both' }
        )
      };

      console.log('💰 Testing FeeCalculator...');
      this.results.fees = {
        view_based: await FeeCalculator.calculateFeeStatus(this.studentId, tenantId, { useView: true }),
        table_based: await FeeCalculator.calculateFeeStatus(this.studentId, tenantId, { useView: false })
      };

      console.log('🎯 Testing ScreenCalculators...');
      // Test screen-specific calculations
      const mockStudent = { id: this.studentId };
      
      this.results.screens = {
        manageStudents: await ScreenCalculators.getManageStudentsData([mockStudent], tenantId),
        studentDashboard: await ScreenCalculators.getStudentDashboardData(this.studentId, tenantId),
        // adminDashboard: await ScreenCalculators.getAdminDashboardData([mockStudent], tenantId)
      };

    } catch (error) {
      console.error('❌ Error gathering test data:', error);
      throw error;
    }
  }

  /**
   * Compare results for consistency
   */
  compareResults() {
    console.log('🔍 Comparing results for consistency...');
    
    const issues = [];
    
    // Check attendance consistency
    const attendanceCurrent = this.results.attendance.current_month;
    const attendance3Month = this.results.attendance.last_3_months;
    
    console.log(`📊 Attendance - Current Month: ${attendanceCurrent?.percentage || 'N/A'}%, Last 3 Months: ${attendance3Month?.percentage || 'N/A'}%`);
    
    // Check academic consistency
    const academicPercentage = this.results.academic.percentage;
    const academicBoth = this.results.academic.both;
    
    if (academicPercentage && academicBoth) {
      const diff = Math.abs(academicPercentage.percentage - academicBoth.percentage);
      if (diff > TEST_CONFIG.TOLERANCE.academic) {
        issues.push(`Academic percentage mismatch: ${academicPercentage.percentage} vs ${academicBoth.percentage}`);
      }
    }
    
    console.log(`📚 Academic Performance: ${academicPercentage?.percentage || 'N/A'}% (${academicBoth?.averageMarks || 'N/A'} marks)`);
    
    // Check fee consistency
    const feeView = this.results.fees.view_based;
    const feeTable = this.results.fees.table_based;
    
    if (feeView && feeTable) {
      const outstandingDiff = Math.abs((feeView.outstandingAmount || 0) - (feeTable.outstandingAmount || 0));
      if (outstandingDiff > TEST_CONFIG.TOLERANCE.fees) {
        issues.push(`Fee outstanding amount mismatch: ${feeView.outstandingAmount} vs ${feeTable.outstandingAmount}`);
      }
    }
    
    console.log(`💰 Fees - View: ${feeView?.outstandingAmount || 'N/A'}, Table: ${feeTable?.outstandingAmount || 'N/A'}`);
    
    // Check screen-specific consistency
    const manageStudentsData = this.results.screens.manageStudents?.[0];
    const dashboardData = this.results.screens.studentDashboard;
    
    if (manageStudentsData && dashboardData) {
      // Academic performance should use same calculation method
      if (manageStudentsData.academicPercentage && dashboardData.academicPerformance) {
        const diff = Math.abs(manageStudentsData.academicPercentage - dashboardData.academicPerformance.percentage);
        if (diff > TEST_CONFIG.TOLERANCE.academic) {
          issues.push(`Screen academic mismatch: ManageStudents ${manageStudentsData.academicPercentage}% vs Dashboard ${dashboardData.academicPerformance.percentage}%`);
        }
      }
      
      // Fee status should be consistent
      if (manageStudentsData.feesStatus && dashboardData.feeStatus) {
        const fee1 = manageStudentsData.feesStatus.outstandingAmount || 0;
        const fee2 = dashboardData.feeStatus.outstandingAmount || 0;
        const diff = Math.abs(fee1 - fee2);
        if (diff > TEST_CONFIG.TOLERANCE.fees) {
          issues.push(`Screen fee mismatch: ManageStudents ${fee1} vs Dashboard ${fee2}`);
        }
      }
    }
    
    this.issues = issues;
  }

  /**
   * Display test results
   */
  displayResults() {
    console.log('\n🎯 CONSISTENCY TEST RESULTS');
    console.log('================================');
    
    if (this.issues.length === 0) {
      console.log('✅ All consistency tests PASSED!');
      console.log('📊 Student data is consistent across all screens');
    } else {
      console.log('❌ Consistency issues found:');
      this.issues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue}`);
      });
    }
    
    console.log('\n📋 DETAILED RESULTS:');
    console.log('Attendance:', this.results.attendance);
    console.log('Academic:', this.results.academic);
    console.log('Fees:', this.results.fees);
    console.log('Screen Data:', this.results.screens);
    
    // Provide recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    if (this.issues.length > 0) {
      console.log('1. Check the studentCalculations.js utility functions');
      console.log('2. Verify database queries are using proper tenant filtering');
      console.log('3. Ensure all screens are using the standardized calculators');
    } else {
      console.log('1. Consider running this test periodically to catch regressions');
      console.log('2. Add this test to your automated test suite');
      console.log('3. Document any intentional differences (like attendance periods)');
    }
  }
}

/**
 * Quick manual test functions for browser console
 */
window.testStudentConsistency = {
  // Run full consistency test
  runFullTest: async (studentId = null) => {
    const tester = new StudentConsistencyTester();
    if (studentId) tester.studentId = studentId;
    await tester.runConsistencyTest();
  },

  // Test specific calculations only
  testCalculations: async (studentId, tenantId) => {
    const { AttendanceCalculator, AcademicCalculator, FeeCalculator } = await import('./src/utils/studentCalculations.js');
    
    console.log('🧪 Quick Calculation Test');
    console.log('Student ID:', studentId);
    console.log('Tenant ID:', tenantId);
    
    try {
      const attendance = await AttendanceCalculator.calculateAttendancePercentage(studentId, tenantId, { period: 'current_month' });
      const academic = await AcademicCalculator.calculateAcademicPerformance(studentId, tenantId, { returnType: 'percentage' });
      const fees = await FeeCalculator.calculateFeeStatus(studentId, tenantId);
      
      console.log('📊 Results:');
      console.log('Attendance:', attendance);
      console.log('Academic:', academic);
      console.log('Fees:', fees);
      
    } catch (error) {
      console.error('❌ Test error:', error);
    }
  },

  // Get random student for testing
  getTestStudent: async () => {
    const { supabase } = await import('./src/config/supabaseClient.js');
    const { data, error } = await supabase
      .from('students')
      .select('id, name, class_id')
      .limit(5);
    
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    console.log('📋 Available test students:');
    data.forEach((student, index) => {
      console.log(`${index + 1}. ${student.name} (${student.id}) - Class: ${student.class_id}`);
    });
    
    return data;
  }
};

// Auto-run instructions
console.log(`
🧪 Student Consistency Test Script Loaded!

Usage in Browser Console:
1. testStudentConsistency.runFullTest() - Run full automated test
2. testStudentConsistency.runFullTest('student-id-here') - Test specific student
3. testStudentConsistency.getTestStudent() - Get list of students to test
4. testStudentConsistency.testCalculations('student-id', 'tenant-id') - Quick calc test

Example:
> await testStudentConsistency.runFullTest();
`);

export { StudentConsistencyTester, TEST_CONFIG };
