const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Standardized attendance utilities (same as in supabase.js)
const normalizeAttendanceStatus = (status) => {
  if (!status) return 'absent';
  const normalizedStatus = status.toLowerCase().trim();
  
  switch (normalizedStatus) {
    case 'present':
    case 'p':
      return 'present';
    case 'absent':
    case 'a':
      return 'absent';
    case 'late':
    case 'l':
      return 'late';
    case 'excused':
    case 'e':
      return 'excused';
    default:
      console.warn(`Unknown attendance status: ${status}, defaulting to absent`);
      return 'absent';
  }
};

const isAttendedStatus = (status) => {
  const normalizedStatus = normalizeAttendanceStatus(status);
  return ['present', 'late', 'excused'].includes(normalizedStatus);
};

async function debugAttendanceDiscrepancies() {
  try {
    console.log('=== ATTENDANCE DISCREPANCY DEBUG ===\n');

    // Get all students
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, name, admission_no')
      .limit(5); // Limit to first 5 students for debugging

    if (studentsError) {
      console.error('Error fetching students:', studentsError);
      return;
    }

    console.log(`Analyzing attendance for ${students.length} students...\n`);

    for (const student of students) {
      console.log(`--- Student: ${student.name} (${student.admission_no}) ---`);

      // Get all attendance records for this student
      const { data: attendanceRecords, error: attendanceError } = await supabase
        .from('student_attendance')
        .select('date, status')
        .eq('student_id', student.id)
        .order('date', { ascending: false });

      if (attendanceError) {
        console.error(`Error fetching attendance for ${student.name}:`, attendanceError);
        continue;
      }

      if (!attendanceRecords || attendanceRecords.length === 0) {
        console.log('No attendance records found\n');
        continue;
      }

      // Analyze the data
      const totalRecords = attendanceRecords.length;
      const statusCounts = {};
      const normalizedStatusCounts = {};
      let attendedCount = 0;
      let presentOnlyCount = 0;

      attendanceRecords.forEach(record => {
        // Original status counts
        const originalStatus = record.status || 'null';
        statusCounts[originalStatus] = (statusCounts[originalStatus] || 0) + 1;

        // Normalized status counts
        const normalizedStatus = normalizeAttendanceStatus(record.status);
        normalizedStatusCounts[normalizedStatus] = (normalizedStatusCounts[normalizedStatus] || 0) + 1;

        // Count attended and present-only
        if (isAttendedStatus(record.status)) {
          attendedCount++;
        }
        if (normalizeAttendanceStatus(record.status) === 'present') {
          presentOnlyCount++;
        }
      });

      // Calculate percentages
      const attendedPercentage = totalRecords > 0 ? Math.round((attendedCount / totalRecords) * 100) : 0;
      const presentOnlyPercentage = totalRecords > 0 ? Math.round((presentOnlyCount / totalRecords) * 100) : 0;

      // Display results
      console.log(`Total Records: ${totalRecords}`);
      console.log(`Original Status Distribution:`, statusCounts);
      console.log(`Normalized Status Distribution:`, normalizedStatusCounts);
      console.log(`Attended Days: ${attendedCount} (${attendedPercentage}%)`);
      console.log(`Present Only Days: ${presentOnlyCount} (${presentOnlyPercentage}%)`);

      // Check for inconsistencies
      const uniqueStatuses = Object.keys(statusCounts);
      const hasInconsistentCasing = uniqueStatuses.some(status => 
        uniqueStatuses.includes(status.toLowerCase()) && status !== status.toLowerCase()
      );

      if (hasInconsistentCasing) {
        console.log('⚠️  WARNING: Inconsistent status casing detected!');
      }

      const unknownStatuses = uniqueStatuses.filter(status => 
        !['Present', 'Absent', 'Late', 'Excused', 'present', 'absent', 'late', 'excused', 'null'].includes(status)
      );

      if (unknownStatuses.length > 0) {
        console.log('⚠️  WARNING: Unknown status values found:', unknownStatuses);
      }

      console.log(''); // Empty line for readability
    }

    // Check today's attendance for dashboard comparison
    console.log('--- TODAY\'S ATTENDANCE (Dashboard Comparison) ---');
    const today = new Date().toISOString().split('T')[0];
    
    const { data: todayAttendance, error: todayError } = await supabase
      .from('student_attendance')
      .select('id, status, student_id')
      .eq('date', today);

    if (todayError) {
      console.error('Error fetching today\'s attendance:', todayError);
    } else if (todayAttendance && todayAttendance.length > 0) {
      const todayStats = {};
      let todayAttended = 0;
      let todayPresentOnly = 0;

      todayAttendance.forEach(record => {
        const status = record.status || 'null';
        todayStats[status] = (todayStats[status] || 0) + 1;

        if (isAttendedStatus(record.status)) {
          todayAttended++;
        }
        if (normalizeAttendanceStatus(record.status) === 'present') {
          todayPresentOnly++;
        }
      });

      const todayTotal = todayAttendance.length;
      const todayAttendedPercentage = todayTotal > 0 ? Math.round((todayAttended / todayTotal) * 100) : 0;
      const todayPresentOnlyPercentage = todayTotal > 0 ? Math.round((todayPresentOnly / todayTotal) * 100) : 0;

      console.log(`Today's Date: ${today}`);
      console.log(`Total Students Marked: ${todayTotal}`);
      console.log(`Status Distribution:`, todayStats);
      console.log(`Attended Today: ${todayAttended} (${todayAttendedPercentage}%)`);
      console.log(`Present Only Today: ${todayPresentOnly} (${todayPresentOnlyPercentage}%)`);
      console.log(`Dashboard should show: ${todayPresentOnlyPercentage}% (if using present-only method)`);
      console.log(`Or: ${todayAttendedPercentage}% (if using attended method)`);
    } else {
      console.log('No attendance records found for today');
    }

    console.log('\n=== DEBUG COMPLETE ===');

  } catch (error) {
    console.error('Debug script error:', error);
  }
}

// Run the debug function
debugAttendanceDiscrepancies();
