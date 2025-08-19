// Example usage of attendance search functions
// Import the database helpers
import { dbHelpers } from '../src/utils/supabase';

// Example 1: Search attendance by student name only
async function searchByStudentName() {
  try {
    const searchCriteria = {
      studentName: 'John', // Partial name search
      fatherName: null,
      className: null,
      section: null,
      startDate: null,
      endDate: null
    };

    const result = await dbHelpers.getAttendanceByStudentDetails(searchCriteria);
    
    if (result.error) {
      console.error('Error:', result.error);
      return;
    }

    console.log(`Found ${result.totalCount} attendance records for students named "John"`);
    result.data.forEach(record => {
      console.log(`- ${record.students.name} (${record.classes.class_name} ${record.classes.section}): ${record.status} on ${record.date}`);
    });
  } catch (error) {
    console.error('Error searching attendance:', error);
  }
}

// Example 2: Search attendance by father's name
async function searchByFatherName() {
  try {
    const searchCriteria = {
      studentName: null,
      fatherName: 'Ram', // Father's name
      className: null,
      section: null,
      startDate: null,
      endDate: null
    };

    const result = await dbHelpers.getAttendanceByStudentDetails(searchCriteria, {
      includeParentDetails: true // Must be true to filter by father's name
    });
    
    if (result.error) {
      console.error('Error:', result.error);
      return;
    }

    console.log(`Found ${result.totalCount} attendance records for students whose father is named "Ram"`);
    result.data.forEach(record => {
      console.log(`- ${record.students.name} (Father: ${record.father_name}): ${record.status} on ${record.date}`);
    });
  } catch (error) {
    console.error('Error searching attendance:', error);
  }
}

// Example 3: Search attendance by class and section
async function searchByClass() {
  try {
    const searchCriteria = {
      studentName: null,
      fatherName: null,
      className: '10', // Class 10
      section: 'A',    // Section A
      startDate: '2024-01-01',
      endDate: '2024-12-31'
    };

    const result = await dbHelpers.getAttendanceByStudentDetails(searchCriteria);
    
    if (result.error) {
      console.error('Error:', result.error);
      return;
    }

    console.log(`Found ${result.totalCount} attendance records for Class 10-A in 2024`);
    
    // Group by student
    const studentGroups = {};
    result.data.forEach(record => {
      const studentName = record.students.name;
      if (!studentGroups[studentName]) {
        studentGroups[studentName] = [];
      }
      studentGroups[studentName].push(record);
    });

    // Show stats for each student
    Object.keys(studentGroups).forEach(studentName => {
      const records = studentGroups[studentName];
      const presentCount = records.filter(r => r.status === 'Present').length;
      const totalCount = records.length;
      const percentage = Math.round((presentCount / totalCount) * 100);
      
      console.log(`- ${studentName}: ${presentCount}/${totalCount} present (${percentage}%)`);
    });
  } catch (error) {
    console.error('Error searching attendance:', error);
  }
}

// Example 4: Search students by name and father's name
async function searchStudents() {
  try {
    const searchCriteria = {
      studentName: 'John',
      fatherName: 'Ram',
      className: null,
      section: null
    };

    const result = await dbHelpers.searchStudentsByNameAndFather(searchCriteria);
    
    if (result.error) {
      console.error('Error:', result.error);
      return;
    }

    console.log(`Found ${result.totalCount} students named "John" with father "Ram"`);
    result.data.forEach(student => {
      console.log(`- ${student.name} (${student.admission_no}) - Class: ${student.classes.class_name} ${student.classes.section}, Father: ${student.father_name}`);
    });

    return result.data; // Return for use in next example
  } catch (error) {
    console.error('Error searching students:', error);
    return [];
  }
}

// Example 5: Generate detailed attendance report for specific students
async function generateAttendanceReport(studentIds) {
  try {
    if (!studentIds || studentIds.length === 0) {
      console.log('No student IDs provided');
      return;
    }

    const result = await dbHelpers.getDetailedAttendanceReport(studentIds, {
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      includeStats: true
    });
    
    if (result.error) {
      console.error('Error:', result.error);
      return;
    }

    console.log('=== DETAILED ATTENDANCE REPORT ===');
    console.log(`Total Students: ${result.summary.total_students}`);
    console.log(`Total Records: ${result.summary.total_records}`);
    console.log(`Date Range: ${result.summary.date_range.startDate} to ${result.summary.date_range.endDate}`);
    
    console.log('\n=== STUDENT STATISTICS ===');
    result.statistics.forEach(stat => {
      console.log(`${stat.student_name} (${stat.admission_no}):`);
      console.log(`  - Total Days: ${stat.total_days}`);
      console.log(`  - Present: ${stat.present_days}`);
      console.log(`  - Absent: ${stat.absent_days}`);
      console.log(`  - Attendance %: ${stat.attendance_percentage}%`);
      console.log('');
    });
  } catch (error) {
    console.error('Error generating report:', error);
  }
}

// Example 6: Combined search - Find students, then get their attendance
async function combinedSearchExample() {
  try {
    console.log('=== COMBINED SEARCH EXAMPLE ===');
    
    // Step 1: Find students by criteria
    console.log('Step 1: Searching for students...');
    const students = await searchStudents();
    
    if (students.length === 0) {
      console.log('No students found');
      return;
    }

    // Step 2: Get attendance for those students
    console.log('\nStep 2: Getting attendance for found students...');
    const studentIds = students.map(student => student.id);
    await generateAttendanceReport(studentIds);
    
  } catch (error) {
    console.error('Error in combined search:', error);
  }
}

// Example 7: Advanced search with multiple criteria
async function advancedSearch() {
  try {
    console.log('=== ADVANCED SEARCH EXAMPLE ===');
    
    const searchCriteria = {
      studentName: 'A', // Students whose name contains 'A'
      fatherName: null,
      className: '1',   // Class 1, 10, 11, 12, etc.
      section: null,
      startDate: '2024-08-01', // August 2024
      endDate: '2024-08-31'
    };

    console.log('Searching with criteria:', searchCriteria);
    
    const result = await dbHelpers.getAttendanceByStudentDetails(searchCriteria, {
      includeStudentDetails: true,
      includeClassDetails: true,
      includeParentDetails: false, // Skip parent details for faster query
      orderBy: 'date',
      orderDirection: 'desc'
    });
    
    if (result.error) {
      console.error('Error:', result.error);
      return;
    }

    console.log(`Found ${result.totalCount} attendance records`);
    
    // Group by date
    const dateGroups = {};
    result.data.forEach(record => {
      const date = record.date;
      if (!dateGroups[date]) {
        dateGroups[date] = [];
      }
      dateGroups[date].push(record);
    });

    // Show daily stats
    Object.keys(dateGroups).sort().forEach(date => {
      const dayRecords = dateGroups[date];
      const presentCount = dayRecords.filter(r => r.status === 'Present').length;
      const totalCount = dayRecords.length;
      
      console.log(`${date}: ${presentCount}/${totalCount} present`);
      dayRecords.forEach(record => {
        console.log(`  - ${record.students.name} (${record.classes.class_name}${record.classes.section}): ${record.status}`);
      });
    });
  } catch (error) {
    console.error('Error in advanced search:', error);
  }
}

// Export all example functions
export {
  searchByStudentName,
  searchByFatherName,
  searchByClass,
  searchStudents,
  generateAttendanceReport,
  combinedSearchExample,
  advancedSearch
};

// If running this file directly (for testing), run all examples
if (typeof require !== 'undefined' && require.main === module) {
  (async () => {
    console.log('Running attendance search examples...\n');
    
    await searchByStudentName();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await searchByFatherName();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await searchByClass();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await combinedSearchExample();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await advancedSearch();
    
    console.log('\nAll examples completed!');
  })();
}
