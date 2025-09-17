/**
 * 🔍 STUDENT DATA DIAGNOSTIC SCRIPT
 * 
 * Run this to check what data exists for a specific student in your database.
 * This will help identify why attendance and academic data might be showing as 0%.
 * 
 * Usage: node diagnose_student_data.js
 */

import { supabase, TABLES } from './src/utils/supabase.js';

// Replace this with the actual student ID from your screenshot (Justus)
const STUDENT_ID = 'student-id-here'; // You'll need to replace this
const TENANT_ID = 'your-tenant-id-here'; // You'll need to replace this

async function diagnoseStudentData() {
  console.log('🔍 DIAGNOSING STUDENT DATA');
  console.log('=' * 50);
  console.log('Student ID:', STUDENT_ID);
  console.log('Tenant ID:', TENANT_ID);
  console.log('\n');

  try {
    // Check if student exists
    console.log('1️⃣ CHECKING STUDENT RECORD...');
    const { data: student, error: studentError } = await supabase
      .from(TABLES.STUDENTS)
      .select('*')
      .eq('id', STUDENT_ID)
      .eq('tenant_id', TENANT_ID)
      .single();

    if (studentError || !student) {
      console.log('❌ Student not found:', studentError?.message);
      return;
    }
    
    console.log('✅ Student found:', student.name);
    console.log('   Class ID:', student.class_id);
    console.log('   Admission No:', student.admission_no);
    console.log('\n');

    // Check attendance records
    console.log('2️⃣ CHECKING ATTENDANCE RECORDS...');
    const { data: attendanceRecords, error: attendanceError } = await supabase
      .from(TABLES.STUDENT_ATTENDANCE)
      .select('*')
      .eq('student_id', STUDENT_ID)
      .eq('tenant_id', TENANT_ID)
      .order('date', { ascending: false })
      .limit(10);

    if (attendanceError) {
      console.log('❌ Error fetching attendance:', attendanceError.message);
    } else {
      console.log(`✅ Found ${attendanceRecords?.length || 0} attendance records`);
      if (attendanceRecords && attendanceRecords.length > 0) {
        console.log('   Sample records:');
        attendanceRecords.slice(0, 5).forEach(record => {
          console.log(`   - ${record.date}: ${record.status}`);
        });
        
        const presentCount = attendanceRecords.filter(r => r.status === 'Present').length;
        const totalCount = attendanceRecords.length;
        const percentage = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;
        console.log(`   📊 Attendance: ${presentCount}/${totalCount} = ${percentage}%`);
      } else {
        console.log('⚠️ NO ATTENDANCE RECORDS FOUND - This explains 0% attendance');
      }
    }
    console.log('\n');

    // Check marks records
    console.log('3️⃣ CHECKING MARKS RECORDS...');
    const { data: marksRecords, error: marksError } = await supabase
      .from(TABLES.MARKS)
      .select(`
        *,
        subjects(name),
        exams(name)
      `)
      .eq('student_id', STUDENT_ID)
      .eq('tenant_id', TENANT_ID)
      .order('created_at', { ascending: false })
      .limit(10);

    if (marksError) {
      console.log('❌ Error fetching marks:', marksError.message);
    } else {
      console.log(`✅ Found ${marksRecords?.length || 0} marks records`);
      if (marksRecords && marksRecords.length > 0) {
        console.log('   Sample records:');
        marksRecords.slice(0, 5).forEach(record => {
          const percentage = record.max_marks > 0 ? 
            Math.round((record.marks_obtained / record.max_marks) * 100) : 0;
          console.log(`   - ${record.subjects?.name}: ${record.marks_obtained}/${record.max_marks} (${percentage}%)`);
        });
        
        // Calculate average
        const validMarks = marksRecords.filter(m => m.max_marks > 0);
        if (validMarks.length > 0) {
          const totalPercentage = validMarks.reduce((sum, mark) => {
            return sum + ((mark.marks_obtained / mark.max_marks) * 100);
          }, 0);
          const averagePercentage = Math.round(totalPercentage / validMarks.length);
          console.log(`   📊 Academic Average: ${averagePercentage}%`);
        }
      } else {
        console.log('⚠️ NO MARKS RECORDS FOUND - This explains "No marks available"');
      }
    }
    console.log('\n');

    // Check fees records
    console.log('4️⃣ CHECKING FEES RECORDS...');
    const { data: feesRecords, error: feesError } = await supabase
      .from(TABLES.STUDENT_FEES)
      .select('*')
      .eq('student_id', STUDENT_ID)
      .eq('tenant_id', TENANT_ID);

    if (feesError) {
      console.log('❌ Error fetching fees:', feesError.message);
    } else {
      console.log(`✅ Found ${feesRecords?.length || 0} fees records`);
      if (feesRecords && feesRecords.length > 0) {
        let totalDue = 0;
        let totalPaid = 0;
        
        feesRecords.forEach(fee => {
          totalDue += Number(fee.fee_amount) || 0;
          totalPaid += Number(fee.amount_paid) || 0;
        });
        
        const outstanding = Math.max(0, totalDue - totalPaid);
        console.log(`   📊 Fees: Due=₹${totalDue}, Paid=₹${totalPaid}, Outstanding=₹${outstanding}`);
        console.log(`   Status: ${outstanding > 0 ? 'PENDING' : 'PAID'}`);
      } else {
        console.log('⚠️ NO FEES RECORDS FOUND');
      }
    }
    console.log('\n');

    // Summary and recommendations
    console.log('💡 DIAGNOSIS SUMMARY:');
    console.log('=' * 30);
    
    const hasAttendance = attendanceRecords && attendanceRecords.length > 0;
    const hasMarks = marksRecords && marksRecords.length > 0;
    const hasFees = feesRecords && feesRecords.length > 0;
    
    if (!hasAttendance) {
      console.log('🔴 ISSUE: No attendance records for this student');
      console.log('   Solution: Add attendance records to student_attendance table');
    }
    
    if (!hasMarks) {
      console.log('🔴 ISSUE: No marks records for this student');  
      console.log('   Solution: Add marks records to marks table');
    }
    
    if (!hasFees) {
      console.log('🟡 NOTE: No fees records (this may be intentional)');
    }
    
    if (hasAttendance && hasMarks) {
      console.log('✅ All data present - the calculations should work correctly');
    }

    console.log('\n');
    console.log('📝 NEXT STEPS:');
    console.log('1. If this is test data, add sample attendance/marks records');
    console.log('2. If this is production, ensure teachers are marking attendance and entering marks');
    console.log('3. Check if the student was recently enrolled and data is still being added');

  } catch (error) {
    console.error('❌ DIAGNOSTIC ERROR:', error);
  }
}

// You need to update these values before running
console.log('⚠️  UPDATE REQUIRED:');
console.log('Please edit this file and set:');
console.log('- STUDENT_ID: The actual ID of the student "Justus" from your database');
console.log('- TENANT_ID: Your tenant ID from the database');
console.log('\nTo find these values:');
console.log('1. Check your students table in Supabase dashboard');
console.log('2. Find the student "Justus" and copy their ID');
console.log('3. Also copy the tenant_id from that record');
console.log('\nThen run: node diagnose_student_data.js');

// Uncomment the line below after updating the IDs above
// diagnoseStudentData();
