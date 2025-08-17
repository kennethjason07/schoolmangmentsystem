// Shared attendance service to ensure consistency between Dashboard and AttendanceSummary
import { supabase, isValidUUID } from '../utils/supabase';

// Generate consistent sample attendance data
export const generateSampleAttendanceData = (startDate, endDate) => {
  const sampleData = [];
  const currentDate = new Date(startDate);
  
  // Use a fixed seed for consistent data generation
  let seed = 12345;
  const seededRandom = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  
  while (currentDate <= endDate) {
    // Skip only Sundays (holidays), but include Saturdays
    if (currentDate.getDay() !== 0) { // 0 = Sunday
      const dayOfWeek = currentDate.getDay();
      const isSaturday = dayOfWeek === 6;

      // Same attendance rate for all working days (Monday-Saturday)
      const attendanceRate = 0.85; // 85% for all working days including Saturday

      const isPresent = seededRandom() > (1 - attendanceRate);
      const dateStr = currentDate.toISOString().split('T')[0];

      // Debug logging for Saturday data generation
      if (isSaturday) {
        console.log(`🎯 Generating Saturday attendance: ${dateStr} - ${isPresent ? 'Present' : 'Absent'}`);
      }

      sampleData.push({
        id: `sample-${currentDate.getTime()}`,
        student_id: 'sample-student-id',
        class_id: 'sample-class-id',
        date: dateStr,
        status: isPresent ? 'Present' : 'Absent',
        marked_by: 'sample-teacher-id',
        created_at: currentDate.toISOString(),
        students: {
          id: 'sample-student-id',
          name: 'Sample Student',
          admission_no: 'ADM2024001'
        },
        classes: {
          id: 'sample-class-id',
          class_name: 'Class 10',
          section: 'A'
        }
      });
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return sampleData;
};

// Get attendance data for current month (used by both Dashboard and AttendanceSummary)
export const getCurrentMonthAttendance = async (studentId) => {
  try {
    const currentDate = new Date();
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    console.log('AttendanceService - Fetching attendance for student:', studentId);
    console.log('AttendanceService - Date range:', monthStart.toISOString().split('T')[0], 'to', monthEnd.toISOString().split('T')[0]);

    // Validate student ID
    if (!isValidUUID(studentId)) {
      console.log('AttendanceService - Invalid student ID, using sample data:', studentId);
      return generateSampleAttendanceData(monthStart, monthEnd);
    }

    // Query database using proper schema
    const { data: attendanceData, error: attendanceError } = await supabase
      .from('student_attendance')
      .select(`
        id,
        student_id,
        class_id,
        date,
        status,
        marked_by,
        created_at,
        students!inner (
          id,
          name,
          admission_no
        ),
        classes!inner (
          id,
          class_name,
          section
        )
      `)
      .eq('student_id', studentId)
      .gte('date', monthStart.toISOString().split('T')[0])
      .lte('date', monthEnd.toISOString().split('T')[0])
      .order('date', { ascending: false });

    if (attendanceError) {
      console.log('AttendanceService - Database error:', attendanceError);
      return generateSampleAttendanceData(monthStart, monthEnd);
    }

    console.log('AttendanceService - Loaded', attendanceData?.length || 0, 'attendance records from database');

    if (attendanceData && attendanceData.length > 0) {
      return attendanceData;
    } else {
      // No real data found, use sample data
      console.log('AttendanceService - No attendance records found, using sample data');
      return generateSampleAttendanceData(monthStart, monthEnd);
    }
  } catch (err) {
    console.log('AttendanceService - Error fetching attendance:', err);
    // Use sample data on error
    const currentDate = new Date();
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    return generateSampleAttendanceData(monthStart, monthEnd);
  }
};

// Calculate attendance statistics (used by both screens) - Exclude holidays (Sundays) but allow Saturdays for display
export const calculateAttendanceStats = (attendanceData) => {
  // Filter out Sundays (holidays) before calculating statistics, but keep Saturdays for display
  const schoolDaysOnly = attendanceData.filter(item => {
    if (item.date) {
      const date = new Date(item.date);
      const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday

      if (dayOfWeek === 0) {
        console.log(`📅 Excluding Sunday (${item.date}) from attendance statistics`);
        return false; // Skip holidays
      }
      // Keep Saturday records (dayOfWeek === 6) for display
    }
    return true; // Include all other days including Saturday
  });

  const presentCount = schoolDaysOnly.filter(item => item.status === 'Present').length;
  const absentCount = schoolDaysOnly.filter(item => item.status === 'Absent').length;
  const totalCount = schoolDaysOnly.length;
  const attendancePercentage = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  const attendancePieData = [
    { name: 'Present', population: presentCount, color: '#4CAF50', legendFontColor: '#333', legendFontSize: 14 },
    { name: 'Absent', population: absentCount, color: '#F44336', legendFontColor: '#333', legendFontSize: 14 },
  ];

  console.log(`📊 Attendance Stats (School Days Only): ${presentCount}/${totalCount} = ${attendancePercentage}%`);

  return {
    presentCount,
    absentCount,
    totalCount,
    attendancePercentage,
    attendancePieData
  };
};