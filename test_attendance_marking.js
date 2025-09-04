const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

console.log('=== TESTING ATTENDANCE MARKING BEHAVIOR ===\n');

async function testAttendanceMarking() {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  try {
    // Check for existing attendance records for a specific class and date
    const testDate = '2025-01-04'; // Today's date
    console.log(`🔍 Checking existing attendance records for date: ${testDate}`);
    
    // Get a test class ID
    const { data: classes, error: classError } = await supabase
      .from('classes')
      .select('id, class_name, section')
      .limit(5);

    if (classError) {
      console.log('❌ Error fetching classes:', classError.message);
      return;
    }

    if (!classes || classes.length === 0) {
      console.log('⚠️ No classes found');
      return;
    }

    console.log('📚 Available classes:');
    classes.forEach((cls, index) => {
      console.log(`   ${index + 1}. ${cls.class_name} ${cls.section} (ID: ${cls.id})`);
    });

    const testClass = classes[0];
    console.log(`\n🎯 Using test class: ${testClass.class_name} ${testClass.section} (ID: ${testClass.id})`);

    // Get students for this class
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, name, admission_no, class_id')
      .eq('class_id', testClass.id);

    if (studentsError) {
      console.log('❌ Error fetching students:', studentsError.message);
      return;
    }

    if (!students || students.length === 0) {
      console.log('⚠️ No students found for this class');
      return;
    }

    console.log(`\n👥 Found ${students.length} students in this class:`);
    students.forEach((student, index) => {
      console.log(`   ${index + 1}. ${student.name} (ID: ${student.id}, Admission: ${student.admission_no})`);
    });

    // Check existing attendance for this date
    const { data: existingAttendance, error: attendanceError } = await supabase
      .from('student_attendance')
      .select('*')
      .eq('class_id', testClass.id)
      .eq('date', testDate);

    if (attendanceError) {
      console.log('❌ Error fetching existing attendance:', attendanceError.message);
    } else {
      console.log(`\n📊 Existing attendance records for ${testDate}:`);
      if (existingAttendance && existingAttendance.length > 0) {
        console.log(`   Found ${existingAttendance.length} existing records:`);
        existingAttendance.forEach(record => {
          const student = students.find(s => s.id === record.student_id);
          console.log(`     - ${student?.name || 'Unknown'}: ${record.status}`);
        });
      } else {
        console.log('   No existing attendance records found');
      }
    }

    // Simulate marking just ONE student as Present (like Justus)
    if (students.length > 0) {
      const testStudent = students[0]; // Take first student as "Justus"
      console.log(`\n🎯 SIMULATION: Marking ONLY "${testStudent.name}" as Present`);
      console.log(`   Student ID: ${testStudent.id}`);
      console.log(`   All other ${students.length - 1} students should remain UNMARKED`);

      // This simulates what the React Native app should be doing
      const attendanceRecord = {
        student_id: testStudent.id,
        class_id: testClass.id,
        date: testDate,
        status: 'Present',
        marked_by: 'b8f8b5f0-1234-4567-8901-123456789001' // Test teacher ID
      };

      console.log('\n📝 Attempting to insert attendance record:', attendanceRecord);

      // Try to insert/upsert the single record
      const { data: insertResult, error: insertError } = await supabase
        .from('student_attendance')
        .upsert([attendanceRecord], {
          onConflict: 'student_id,date',
          ignoreDuplicates: false
        })
        .select();

      if (insertError) {
        console.log('❌ Error inserting attendance:', insertError.message);
        console.log('   Error code:', insertError.code);
        console.log('   Details:', JSON.stringify(insertError.details || {}, null, 2));
        
        // Check if this might be a RLS issue
        if (insertError.message.includes('row-level security') || insertError.code === '42501') {
          console.log('\n🔒 This appears to be a Row-Level Security (RLS) issue');
          console.log('   The user might not be authenticated or lack permissions');
        }
      } else {
        console.log('✅ Successfully inserted attendance record');
        console.log('   Records created:', insertResult?.length || 0);
        if (insertResult && insertResult.length > 0) {
          insertResult.forEach(record => {
            console.log(`     - Student ${record.student_id}: ${record.status}`);
          });
        }
      }

      // Now check what attendance records exist after the insert
      console.log(`\n🔍 Checking attendance records after insert for date ${testDate}:`);
      const { data: afterInsertAttendance, error: afterError } = await supabase
        .from('student_attendance')
        .select(`
          *,
          students(name, admission_no)
        `)
        .eq('class_id', testClass.id)
        .eq('date', testDate);

      if (afterError) {
        console.log('❌ Error fetching attendance after insert:', afterError.message);
      } else if (afterInsertAttendance && afterInsertAttendance.length > 0) {
        console.log(`   Found ${afterInsertAttendance.length} attendance records:`);
        afterInsertAttendance.forEach(record => {
          const studentName = record.students?.name || 'Unknown';
          console.log(`     - ${studentName}: ${record.status}`);
        });

        // Check if any students were marked as "Absent" by default
        const absentRecords = afterInsertAttendance.filter(r => r.status === 'Absent');
        const presentRecords = afterInsertAttendance.filter(r => r.status === 'Present');

        console.log(`\n📈 SUMMARY:`);
        console.log(`   Total students in class: ${students.length}`);
        console.log(`   Present records: ${presentRecords.length}`);
        console.log(`   Absent records: ${absentRecords.length}`);
        console.log(`   Not marked: ${students.length - afterInsertAttendance.length}`);

        if (absentRecords.length > 0 && presentRecords.length === 1) {
          console.log('\n🚨 ISSUE DETECTED!');
          console.log('   Other students were automatically marked as Absent');
          console.log('   This suggests a database trigger or constraint is adding default records');
          console.log('\n   Absent students added automatically:');
          absentRecords.forEach(record => {
            const studentName = record.students?.name || 'Unknown';
            console.log(`     - ${studentName}`);
          });
        } else if (afterInsertAttendance.length === 1 && presentRecords.length === 1) {
          console.log('\n✅ BEHAVIOR IS CORRECT!');
          console.log('   Only the explicitly marked student was saved');
          console.log('   No automatic "Absent" records were created');
        }
      } else {
        console.log('   No attendance records found after insert');
      }
    }

    console.log('\n=== DIAGNOSIS ===');
    console.log('If other students were automatically marked as "Absent":');
    console.log('1. Check for database triggers on student_attendance table');
    console.log('2. Check for application logic that might be bulk-inserting records');
    console.log('3. Check if there are database constraints that enforce attendance for all students');
    console.log('4. Verify the React Native code is only sending explicitly marked students');

  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

testAttendanceMarking();
