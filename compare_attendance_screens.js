const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Simulate different screen calculations
async function compareAttendanceCalculations() {
  try {
    console.log('=== ATTENDANCE CALCULATION COMPARISON ===\n');

    // Get a student with attendance data
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, name, admission_no')
      .limit(10);

    if (studentsError) {
      console.error('Error fetching students:', studentsError);
      return;
    }

    // Find a student with attendance data
    let studentWithData = null;
    for (const student of students) {
      const { data: attendanceCheck } = await supabase
        .from('student_attendance')
        .select('id')
        .eq('student_id', student.id)
        .limit(1);

      if (attendanceCheck && attendanceCheck.length > 0) {
        studentWithData = student;
        break;
      }
    }

    if (!studentWithData) {
      console.log('No students with attendance data found');
      return;
    }

    console.log(`Comparing calculations for: ${studentWithData.name} (${studentWithData.admission_no})\n`);

    // 1. DASHBOARD CALCULATION (Admin Dashboard)
    console.log('--- 1. DASHBOARD CALCULATION ---');
    const today = new Date().toISOString().split('T')[0];
    
    // Get total students count (for dashboard context)
    const { data: allStudents } = await supabase
      .from('students')
      .select('id', { count: 'exact' });
    const totalStudents = allStudents?.length || 0;

    // Get today's attendance
    const { data: todayAttendance } = await supabase
      .from('student_attendance')
      .select('id, status')
      .eq('date', today);

    const presentToday = todayAttendance?.filter(att => att.status === 'Present').length || 0;
    const dashboardPercentage = totalStudents > 0 ? Math.round((presentToday / totalStudents) * 100) : 0;

    console.log(`Today's date: ${today}`);
    console.log(`Total students in system: ${totalStudents}`);
    console.log(`Students marked present today: ${presentToday}`);
    console.log(`Dashboard attendance percentage: ${dashboardPercentage}%`);

    // 2. STUDENT DASHBOARD CALCULATION
    console.log('\n--- 2. STUDENT DASHBOARD CALCULATION ---');
    const { data: studentAttendance } = await supabase
      .from('student_attendance')
      .select('*')
      .eq('student_id', studentWithData.id);

    const totalDays = studentAttendance?.length || 0;
    const presentDays = studentAttendance?.filter(a => a.status === 'Present').length || 0;
    const studentDashboardPercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

    console.log(`Total attendance records: ${totalDays}`);
    console.log(`Days marked present: ${presentDays}`);
    console.log(`Student dashboard percentage: ${studentDashboardPercentage}%`);

    // 3. PARENT DASHBOARD CALCULATION (Current Month) - FIXED VERSION
    console.log('\n--- 3. PARENT DASHBOARD CALCULATION (FIXED) ---');
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // getMonth() returns 0-11, so add 1
    const parentMonthStartStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const parentMonthEndStr = `${year}-${String(month).padStart(2, '0')}-31`;

    const { data: monthlyAttendance } = await supabase
      .from('student_attendance')
      .select('*')
      .eq('student_id', studentWithData.id)
      .gte('date', parentMonthStartStr)
      .lte('date', parentMonthEndStr);

    const monthlyTotal = monthlyAttendance?.length || 0;
    const monthlyPresent = monthlyAttendance?.filter(item => item.status === 'Present').length || 0;
    const parentDashboardPercentage = monthlyTotal > 0 ? Math.round((monthlyPresent / monthlyTotal) * 100) : 0;

    console.log(`Current month: ${parentMonthStartStr} to ${parentMonthEndStr}`);
    console.log(`Monthly attendance records: ${monthlyTotal}`);
    console.log(`Records:`, monthlyAttendance?.map(r => `${r.date}: ${r.status}`) || []);
    console.log(`Monthly days present: ${monthlyPresent}`);
    console.log(`Parent dashboard percentage (FIXED): ${parentDashboardPercentage}%`);

    // 4. ATTENDANCE MARKS SCREEN CALCULATION (Selected Month)
    console.log('\n--- 4. ATTENDANCE MARKS SCREEN CALCULATION ---');
    // Simulate selected month (current month)
    const selectedMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [attendanceYear, attendanceMonth] = selectedMonth.split('-').map(Number);

    // Get attendance data for the month (FIXED: use proper date range)
    const attendanceMonthStart = `${attendanceYear}-${String(attendanceMonth).padStart(2, '0')}-01`;
    const attendanceMonthEnd = `${attendanceYear}-${String(attendanceMonth).padStart(2, '0')}-31`;

    const { data: monthAttendanceData } = await supabase
      .from('student_attendance')
      .select('date, status')
      .eq('student_id', studentWithData.id)
      .gte('date', attendanceMonthStart)
      .lte('date', attendanceMonthEnd);

    // FIXED: Count actual records, not days in month
    const stats = { present: 0, absent: 0, late: 0, excused: 0 };
    monthAttendanceData?.forEach(record => {
      const normalizedStatus = record.status?.toLowerCase() || 'absent';
      if (stats[normalizedStatus] !== undefined) {
        stats[normalizedStatus]++;
      }
    });

    const attendanceMarksTotal = Object.values(stats).reduce((a, b) => a + b, 0);
    const attendedDays = stats.present + stats.late + stats.excused;
    const attendanceMarksPercentage = attendanceMarksTotal > 0 ? Math.round((attendedDays / attendanceMarksTotal) * 100) : 0;

    console.log(`Selected month: ${selectedMonth}`);
    console.log(`Date range: ${attendanceMonthStart} to ${attendanceMonthEnd}`);
    console.log(`Attendance records found: ${monthAttendanceData?.length || 0}`);
    console.log(`Records in range:`, monthAttendanceData?.map(r => `${r.date}: ${r.status}`) || []);
    console.log(`Status breakdown:`, stats);
    console.log(`Total records: ${attendanceMarksTotal}`);
    console.log(`Attended days: ${attendedDays}`);
    console.log(`Attendance marks percentage (FIXED): ${attendanceMarksPercentage}%`);

    // 5. SUMMARY AND ANALYSIS
    console.log('\n--- 5. SUMMARY AND ANALYSIS ---');
    console.log(`Dashboard (Today): ${dashboardPercentage}%`);
    console.log(`Student Dashboard (All-time): ${studentDashboardPercentage}%`);
    console.log(`Parent Dashboard (Current Month): ${parentDashboardPercentage}%`);
    console.log(`Attendance Marks (Selected Month): ${attendanceMarksPercentage}%`);

    // Check for discrepancies
    const percentages = [
      { name: 'Student Dashboard', value: studentDashboardPercentage },
      { name: 'Parent Dashboard', value: parentDashboardPercentage },
      { name: 'Attendance Marks', value: attendanceMarksPercentage }
    ];

    const monthlyPercentages = percentages.filter(p => p.name !== 'Student Dashboard');
    const hasDiscrepancy = monthlyPercentages.some(p => 
      Math.abs(p.value - monthlyPercentages[0].value) > 1
    );

    if (hasDiscrepancy) {
      console.log('\n⚠️  DISCREPANCY DETECTED between monthly calculations!');
      console.log('This could be due to:');
      console.log('- Different date range calculations');
      console.log('- Different status handling logic');
      console.log('- Different counting methods');
    } else {
      console.log('\n✅ Monthly calculations are consistent');
    }

    // Show raw data for debugging
    console.log('\n--- RAW DATA SAMPLE ---');
    if (monthAttendanceData && monthAttendanceData.length > 0) {
      console.log('Sample attendance records:');
      monthAttendanceData.slice(0, 5).forEach(record => {
        console.log(`  ${record.date}: ${record.status}`);
      });
    }

    console.log('\n=== COMPARISON COMPLETE ===');

  } catch (error) {
    console.error('Comparison script error:', error);
  }
}

// Run the comparison
compareAttendanceCalculations();
