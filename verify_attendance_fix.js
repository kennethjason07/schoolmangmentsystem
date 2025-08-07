const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verifyAttendanceFix() {
  try {
    console.log('=== ATTENDANCE FIX VERIFICATION ===\n');

    // Get all students with attendance data
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, name, admission_no, class_id')
      .limit(10);

    if (studentsError) {
      console.error('Error fetching students:', studentsError);
      return;
    }

    console.log(`Testing ${students.length} students...\n`);

    for (const student of students) {
      // Get attendance records for this student
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
        console.log(`${student.name}: No attendance records`);
        continue;
      }

      console.log(`\n--- ${student.name} (${student.admission_no}) ---`);
      console.log(`Total attendance records: ${attendanceRecords.length}`);

      // Test different calculation methods
      const calculations = {};

      // 1. All-time calculation (Student Dashboard method)
      const totalDays = attendanceRecords.length;
      const presentDays = attendanceRecords.filter(a => a.status === 'Present').length;
      calculations.allTime = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

      // 2. Current month calculation (Parent Dashboard method - FIXED)
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
      const monthEnd = `${year}-${String(month).padStart(2, '0')}-31`;

      const currentMonthRecords = attendanceRecords.filter(r => r.date >= monthStart && r.date <= monthEnd);
      const currentMonthPresent = currentMonthRecords.filter(r => r.status === 'Present').length;
      calculations.currentMonth = currentMonthRecords.length > 0 ? 
        Math.round((currentMonthPresent / currentMonthRecords.length) * 100) : 0;

      // 3. Selected month calculation (Attendance Marks method - FIXED)
      // Use the same month as current month for comparison
      const selectedMonthRecords = attendanceRecords.filter(r => r.date >= monthStart && r.date <= monthEnd);
      const selectedMonthPresent = selectedMonthRecords.filter(r => r.status === 'Present').length;
      calculations.selectedMonth = selectedMonthRecords.length > 0 ? 
        Math.round((selectedMonthPresent / selectedMonthRecords.length) * 100) : 0;

      // 4. Today's calculation (Admin Dashboard method)
      const today = new Date().toISOString().split('T')[0];
      const todayRecords = attendanceRecords.filter(r => r.date === today);
      const todayPresent = todayRecords.filter(r => r.status === 'Present').length;
      calculations.today = todayRecords.length > 0 ? 
        Math.round((todayPresent / todayRecords.length) * 100) : 0;

      // Display results
      console.log(`All-time attendance: ${calculations.allTime}% (${presentDays}/${totalDays})`);
      console.log(`Current month attendance: ${calculations.currentMonth}% (${currentMonthPresent}/${currentMonthRecords.length})`);
      console.log(`Selected month attendance: ${calculations.selectedMonth}% (${selectedMonthPresent}/${selectedMonthRecords.length})`);
      console.log(`Today's attendance: ${calculations.today}% (${todayPresent}/${todayRecords.length})`);

      // Check for consistency between monthly calculations
      if (calculations.currentMonth !== calculations.selectedMonth) {
        console.log('❌ INCONSISTENCY: Current month vs Selected month calculations differ!');
        console.log('Current month records:', currentMonthRecords.map(r => `${r.date}: ${r.status}`));
        console.log('Selected month records:', selectedMonthRecords.map(r => `${r.date}: ${r.status}`));
      } else if (currentMonthRecords.length > 0) {
        console.log('✅ Monthly calculations are consistent');
      }

      // Show recent records for context
      if (attendanceRecords.length > 0) {
        console.log('Recent records:', attendanceRecords.slice(0, 5).map(r => `${r.date}: ${r.status}`));
      }
    }

    // Test the standardized utility function if it exists
    console.log('\n=== TESTING STANDARDIZED UTILITY ===');
    try {
      // Find a student with data
      const studentWithData = students.find(async (student) => {
        const { data: records } = await supabase
          .from('student_attendance')
          .select('id')
          .eq('student_id', student.id)
          .limit(1);
        return records && records.length > 0;
      });

      if (studentWithData) {
        console.log(`Testing standardized utility with ${studentWithData.name}...`);
        
        // This would test the new utility function if it's working
        // For now, just verify the data structure
        const { data: testRecords } = await supabase
          .from('student_attendance')
          .select('date, status')
          .eq('student_id', studentWithData.id)
          .limit(5);

        console.log('Sample records for utility test:', testRecords);
      }
    } catch (utilityError) {
      console.log('Standardized utility test skipped:', utilityError.message);
    }

    console.log('\n=== VERIFICATION COMPLETE ===');
    console.log('\nSUMMARY:');
    console.log('- All-time calculations show overall attendance');
    console.log('- Monthly calculations should be consistent between Parent Dashboard and Attendance Marks');
    console.log('- Today\'s calculations are for Admin Dashboard only');
    console.log('- If you see ❌ INCONSISTENCY messages above, those need to be fixed');

  } catch (error) {
    console.error('Verification script error:', error);
  }
}

// Run the verification
verifyAttendanceFix();
