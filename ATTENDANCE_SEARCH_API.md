# Attendance Search API Documentation

## Overview

This document describes the new attendance search functions that allow you to fetch attendance data based on student name, father's name, and class. These functions are part of the `dbHelpers` object in `src/utils/supabase.js`.

## Functions Available

### 1. `getAttendanceByStudentDetails(searchCriteria, options)`

Fetches attendance records based on multiple search criteria.

#### Parameters

**searchCriteria** (Object):
- `studentName` (string|null): Partial or full student name
- `fatherName` (string|null): Partial or full father's name
- `className` (string|null): Class name (e.g., "10", "XII")
- `section` (string|null): Section (e.g., "A", "B")
- `startDate` (string|null): Start date in YYYY-MM-DD format
- `endDate` (string|null): End date in YYYY-MM-DD format
- `limit` (number): Maximum records to return (default: 100)

**options** (Object):
- `includeStudentDetails` (boolean): Include student info (default: true)
- `includeClassDetails` (boolean): Include class info (default: true)
- `includeParentDetails` (boolean): Include parent info (default: true)
- `orderBy` (string): Sort field - 'date', 'student_id' (default: 'date')
- `orderDirection` (string): 'asc' or 'desc' (default: 'desc')

#### Returns

```javascript
{
  data: [
    {
      id: "attendance-record-id",
      student_id: "student-id",
      class_id: "class-id",
      date: "2024-08-19",
      status: "Present", // or "Absent"
      marked_by: "teacher-id",
      created_at: "2024-08-19T10:00:00Z",
      students: {
        id: "student-id",
        name: "John Doe",
        admission_no: "ADM001",
        roll_no: 15,
        dob: "2010-05-15",
        gender: "Male",
        academic_year: "2024-25"
      },
      classes: {
        id: "class-id",
        class_name: "10",
        section: "A",
        academic_year: "2024-25"
      },
      father_name: "Ram Doe" // Only if includeParentDetails is true and fatherName filter is used
    }
    // ... more records
  ],
  error: null,
  totalCount: 25,
  searchCriteria: { ... } // Echo of search criteria
}
```

#### Example Usage

```javascript
import { dbHelpers } from '../src/utils/supabase';

// Search by student name only
const result1 = await dbHelpers.getAttendanceByStudentDetails({
  studentName: 'John',
  fatherName: null,
  className: null,
  section: null,
  startDate: null,
  endDate: null
});

// Search by father's name and class
const result2 = await dbHelpers.getAttendanceByStudentDetails({
  studentName: null,
  fatherName: 'Ram',
  className: '10',
  section: 'A',
  startDate: '2024-08-01',
  endDate: '2024-08-31'
}, {
  includeParentDetails: true // Required for father name filtering
});

if (result1.error) {
  console.error('Error:', result1.error);
} else {
  console.log(`Found ${result1.totalCount} records`);
  result1.data.forEach(record => {
    console.log(`${record.students.name}: ${record.status} on ${record.date}`);
  });
}
```

### 2. `searchStudentsByNameAndFather(searchCriteria)`

Searches for students based on name, father's name, and class criteria.

#### Parameters

**searchCriteria** (Object):
- `studentName` (string|null): Partial or full student name
- `fatherName` (string|null): Partial or full father's name
- `className` (string|null): Class name
- `section` (string|null): Section
- `limit` (number): Maximum records to return (default: 50)

#### Returns

```javascript
{
  data: [
    {
      id: "student-id",
      name: "John Doe",
      admission_no: "ADM001",
      roll_no: 15,
      dob: "2010-05-15",
      gender: "Male",
      academic_year: "2024-25",
      class_id: "class-id",
      parent_id: "parent-user-id",
      classes: {
        id: "class-id",
        class_name: "10",
        section: "A",
        academic_year: "2024-25"
      },
      father_name: "Ram Doe" // Only if fatherName filter is used
    }
    // ... more students
  ],
  error: null,
  totalCount: 5,
  searchCriteria: { ... }
}
```

#### Example Usage

```javascript
// Find students named John whose father is Ram
const result = await dbHelpers.searchStudentsByNameAndFather({
  studentName: 'John',
  fatherName: 'Ram',
  className: null,
  section: null
});

if (result.error) {
  console.error('Error:', result.error);
} else {
  console.log(`Found ${result.totalCount} students`);
  result.data.forEach(student => {
    console.log(`${student.name} (${student.admission_no}) - Class: ${student.classes.class_name}${student.classes.section}`);
  });
}
```

### 3. `getDetailedAttendanceReport(studentIds, options)`

Generates a comprehensive attendance report for specific students.

#### Parameters

**studentIds** (Array): Array of student IDs

**options** (Object):
- `startDate` (string|null): Start date in YYYY-MM-DD format
- `endDate` (string|null): End date in YYYY-MM-DD format
- `includeStats` (boolean): Include attendance statistics (default: true)
- `groupByMonth` (boolean): Group data by month (default: false)

#### Returns

```javascript
{
  data: [
    // Array of attendance records
  ],
  statistics: [
    {
      student_id: "student-id",
      student_name: "John Doe",
      admission_no: "ADM001",
      roll_no: 15,
      total_days: 45,
      present_days: 42,
      absent_days: 3,
      attendance_percentage: 93,
      records: [
        // Individual attendance records for this student
      ]
    }
    // ... more student stats
  ],
  error: null,
  summary: {
    total_students: 5,
    date_range: {
      startDate: "2024-01-01",
      endDate: "2024-12-31"
    },
    total_records: 225
  }
}
```

#### Example Usage

```javascript
// First find students
const students = await dbHelpers.searchStudentsByNameAndFather({
  studentName: 'John',
  fatherName: null,
  className: '10',
  section: null
});

if (students.data && students.data.length > 0) {
  // Get attendance report for found students
  const studentIds = students.data.map(s => s.id);
  const report = await dbHelpers.getDetailedAttendanceReport(studentIds, {
    startDate: '2024-08-01',
    endDate: '2024-08-31',
    includeStats: true
  });

  if (report.error) {
    console.error('Error:', report.error);
  } else {
    console.log('=== ATTENDANCE REPORT ===');
    console.log(`Total Students: ${report.summary.total_students}`);
    console.log(`Total Records: ${report.summary.total_records}`);
    
    report.statistics.forEach(stat => {
      console.log(`${stat.student_name}: ${stat.attendance_percentage}% (${stat.present_days}/${stat.total_days})`);
    });
  }
}
```

## Search Strategies

### 1. Flexible Search

You can use any combination of criteria:

```javascript
// Search by student name only
{ studentName: 'John', fatherName: null, className: null, section: null }

// Search by father name only
{ studentName: null, fatherName: 'Ram', className: null, section: null }

// Search by class and section only
{ studentName: null, fatherName: null, className: '10', section: 'A' }

// Combined search
{ studentName: 'John', fatherName: 'Ram', className: '10', section: 'A' }
```

### 2. Partial Matching

All text searches use partial matching (ILIKE):

```javascript
// These will match students named "John", "Johnny", "Johnson", etc.
{ studentName: 'John' }

// These will match fathers named "Ram", "Raman", "Ramesh", etc.
{ fatherName: 'Ram' }

// These will match classes "10", "10th", etc.
{ className: '10' }
```

### 3. Date Range Filtering

For attendance searches, you can specify date ranges:

```javascript
{
  studentName: 'John',
  startDate: '2024-08-01',  // August 1, 2024
  endDate: '2024-08-31'     // August 31, 2024
}
```

## Performance Considerations

### 1. Use Specific Criteria

More specific search criteria will return results faster:

```javascript
// Faster - specific criteria
{ studentName: 'John', className: '10', section: 'A' }

// Slower - very broad criteria
{ studentName: 'J' }
```

### 2. Limit Results

Use the limit parameter to control result size:

```javascript
const result = await dbHelpers.getAttendanceByStudentDetails({
  studentName: 'John'
}, {
  limit: 50 // Only return first 50 results
});
```

### 3. Skip Unnecessary Data

Disable includes you don't need:

```javascript
const result = await dbHelpers.getAttendanceByStudentDetails({
  studentName: 'John',
  className: '10'
}, {
  includeParentDetails: false // Skip parent data for faster query
});
```

## Error Handling

All functions return an error object if something goes wrong:

```javascript
const result = await dbHelpers.getAttendanceByStudentDetails(criteria);

if (result.error) {
  console.error('Database error:', result.error.message);
  // Handle error appropriately
  return;
}

// Process successful result
console.log(`Found ${result.totalCount} records`);
```

## Common Use Cases

### 1. Find Attendance by Student Name

```javascript
const result = await dbHelpers.getAttendanceByStudentDetails({
  studentName: 'John Doe'
});
```

### 2. Find Students by Father's Name

```javascript
const students = await dbHelpers.searchStudentsByNameAndFather({
  fatherName: 'Ram Kumar'
});
```

### 3. Class-wise Attendance Report

```javascript
const attendance = await dbHelpers.getAttendanceByStudentDetails({
  className: '10',
  section: 'A',
  startDate: '2024-08-01',
  endDate: '2024-08-31'
});
```

### 4. Monthly Report for Specific Students

```javascript
// First find the students
const students = await dbHelpers.searchStudentsByNameAndFather({
  studentName: 'John'
});

// Then generate report
if (students.data.length > 0) {
  const studentIds = students.data.map(s => s.id);
  const report = await dbHelpers.getDetailedAttendanceReport(studentIds, {
    startDate: '2024-08-01',
    endDate: '2024-08-31',
    includeStats: true
  });
}
```

## Database Requirements

These functions require the following database tables and relationships:

### Tables Used
- `student_attendance` - Main attendance records
- `students` - Student information
- `classes` - Class and section information  
- `parents` - Parent information (for father's name filtering)

### Required Relationships
- `student_attendance.student_id` → `students.id`
- `student_attendance.class_id` → `classes.id`
- `students.class_id` → `classes.id`
- `parents.student_id` → `students.id`
- `parents.relation = 'Father'` for father name filtering

Make sure these tables exist and have proper foreign key relationships for the functions to work correctly.
