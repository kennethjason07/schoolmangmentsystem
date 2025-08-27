const { supabase } = require('./src/utils/supabase');

/**
 * ATTENDANCE DEBUGGING SCRIPT
 * 
 * This script helps debug why attendance marked by admin is not showing in parent dashboard.
 * 
 * Usage: node debug_parent_attendance.js
 */

async function debugAttendance() {
  console.log('🔍 DEBUGGING PARENT ATTENDANCE ISSUE');
  console.log('=====================================\n');

  try {
    // Step 1: Check all attendance tables that might exist
    console.log('📊 STEP 1: Checking available attendance tables...');
    
    const tableNames = ['student_attendance', 'attendance', 'student_attendances', 'attendance_records'];
    const validTables = [];
    
    for (const tableName of tableNames) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
        
        if (!error) {
          validTables.push(tableName);
          console.log(`✅ Table "${tableName}" exists and is accessible`);
        }
      } catch (err) {
        console.log(`❌ Table "${tableName}" does not exist or is not accessible`);
      }
    }
    
    console.log(`\n📋 Valid attendance tables found: ${validTables.join(', ')}\n`);

    // Step 2: Show recent attendance records from each valid table
    console.log('📊 STEP 2: Recent attendance records from each table...');
    
    for (const tableName of validTables) {
      try {
        const { data: recentRecords, error } = await supabase
          .from(tableName)
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);
          
        if (!error && recentRecords) {
          console.log(`\n🔍 Recent records from "${tableName}" (${recentRecords.length} records):`);
          recentRecords.forEach((record, index) => {
            console.log(`   ${index + 1}. Student: ${record.student_id}, Class: ${record.class_id}, Date: ${record.date}, Status: ${record.status}, Marked by: ${record.marked_by}, Created: ${record.created_at}`);
          });
        }
      } catch (err) {
        console.log(`❌ Error reading from "${tableName}":`, err.message);
      }
    }

    // Step 3: Check for today's attendance records
    console.log('\n📊 STEP 3: Checking today\'s attendance records...');
    const today = new Date().toISOString().split('T')[0];
    console.log(`Today's date: ${today}`);
    
    for (const tableName of validTables) {
      try {
        const { data: todayRecords, error } = await supabase
          .from(tableName)
          .select('*')
          .eq('date', today)
          .order('created_at', { ascending: false });
          
        if (!error && todayRecords) {
          console.log(`\n📅 Today's records from "${tableName}" (${todayRecords.length} records):`);
          todayRecords.forEach((record, index) => {
            console.log(`   ${index + 1}. Student: ${record.student_id}, Class: ${record.class_id}, Status: ${record.status}, Created: ${record.created_at}`);
          });
        }
      } catch (err) {
        console.log(`❌ Error reading today's records from "${tableName}":`, err.message);
      }
    }

    // Step 4: Check current month's attendance records
    console.log('\n📊 STEP 4: Checking current month\'s attendance records...');
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const monthStr = String(month).padStart(2, '0');
    const currentMonthStart = `${year}-${monthStr}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonthStr = String(nextMonth).padStart(2, '0');
    const currentMonthEnd = `${nextYear}-${nextMonthStr}-01`;
    
    console.log(`Current month range: ${currentMonthStart} to ${currentMonthEnd}`);
    
    for (const tableName of validTables) {
      try {
        const { data: monthRecords, error } = await supabase
          .from(tableName)
          .select('*')
          .gte('date', currentMonthStart)
          .lt('date', currentMonthEnd)
          .order('date', { ascending: false });
          
        if (!error && monthRecords) {
          console.log(`\n📅 Current month records from "${tableName}" (${monthRecords.length} records):`);
          
          // Group by student
          const studentGroups = {};
          monthRecords.forEach(record => {
            if (!studentGroups[record.student_id]) {
              studentGroups[record.student_id] = [];
            }
            studentGroups[record.student_id].push(record);
          });
          
          Object.keys(studentGroups).forEach(studentId => {
            const records = studentGroups[studentId];
            const presentCount = records.filter(r => r.status === 'Present').length;
            const absentCount = records.filter(r => r.status === 'Absent').length;
            console.log(`   Student ${studentId}: ${records.length} records (${presentCount} Present, ${absentCount} Absent)`);
            
            // Show first few records
            records.slice(0, 3).forEach(record => {
              console.log(`     - ${record.date}: ${record.status} (marked by: ${record.marked_by || 'Unknown'})`);
            });
          });
        }
      } catch (err) {
        console.log(`❌ Error reading current month records from "${tableName}":`, err.message);
      }
    }

    // Step 5: Check students table for parent-student relationships
    console.log('\n📊 STEP 5: Checking student-parent relationships...');
    
    try {
      const { data: studentsWithParents, error } = await supabase
        .from('students')
        .select('id, name, parent_id, admission_no')
        .not('parent_id', 'is', null)
        .limit(10);
        
      if (!error && studentsWithParents) {
        console.log(`\n👨‍👩‍👧‍👦 Students with parent_id mapping (${studentsWithParents.length} students):`);
        studentsWithParents.forEach((student, index) => {
          console.log(`   ${index + 1}. Student ${student.id} (${student.name}) -> Parent ${student.parent_id}`);
        });
      }
    } catch (err) {
      console.log(`❌ Error reading student-parent relationships:`, err.message);
    }

    // Step 6: Check users table for parent user mapping
    console.log('\n📊 STEP 6: Checking user-parent relationships...');
    
    try {
      const { data: parentUsers, error } = await supabase
        .from('users')
        .select('id, email, role, linked_student_id, linked_parent_of')
        .eq('role', 'parent')
        .limit(10);
        
      if (!error && parentUsers) {
        console.log(`\n👤 Parent users (${parentUsers.length} users):`);
        parentUsers.forEach((user, index) => {
          console.log(`   ${index + 1}. User ${user.id} (${user.email}) -> Student: ${user.linked_student_id || user.linked_parent_of || 'None'}`);
        });
      }
    } catch (err) {
      console.log(`❌ Error reading parent users:`, err.message);
    }

    // Step 7: Test the parent dashboard filtering logic
    console.log('\n📊 STEP 7: Testing parent dashboard filtering logic...');
    
    // Simulate the parent dashboard filtering for current month
    const testStudentId = '1'; // You can change this to test with a specific student
    
    for (const tableName of validTables) {
      try {
        const { data: allAttendanceData, error } = await supabase
          .from(tableName)
          .select('id, student_id, class_id, date, status, marked_by, created_at')
          .eq('student_id', testStudentId)
          .order('date', { ascending: false });
          
        if (!error && allAttendanceData) {
          console.log(`\n🎯 Testing filtering for Student ${testStudentId} from "${tableName}" (${allAttendanceData.length} total records):`);
          
          // Apply the same filtering logic as ParentDashboard
          const currentMonthRecords = allAttendanceData.filter(record => {
            if (!record.date || typeof record.date !== 'string') {
              console.log(`   ⚠️ Invalid date format: ${record.date}`);
              return false;
            }
            
            try {
              let recordYear, recordMonth;
              
              if (record.date.includes('T')) {
                const recordDate = new Date(record.date);
                recordYear = recordDate.getFullYear();
                recordMonth = recordDate.getMonth() + 1;
              } else if (record.date.includes('-')) {
                const parts = record.date.split('-');
                if (parts.length === 3) {
                  if (parts[0].length === 4) {
                    // YYYY-MM-DD format
                    recordYear = parseInt(parts[0], 10);
                    recordMonth = parseInt(parts[1], 10);
                  } else if (parts[2].length === 4) {
                    // DD-MM-YYYY format
                    recordYear = parseInt(parts[2], 10);
                    recordMonth = parseInt(parts[1], 10);
                  }
                }
              }
              
              if (isNaN(recordYear) || isNaN(recordMonth)) {
                console.log(`   ⚠️ Failed to parse date: ${record.date}`);
                return false;
              }
              
              const isCurrentMonth = recordYear === year && recordMonth === month;
              console.log(`   ${isCurrentMonth ? '✅' : '❌'} ${record.date} (${recordYear}-${recordMonth}) - ${record.status} ${isCurrentMonth ? '(INCLUDED)' : '(EXCLUDED)'}`);
              
              return isCurrentMonth;
            } catch (err) {
              console.log(`   ⚠️ Error processing date ${record.date}:`, err.message);
              return false;
            }
          });
          
          console.log(`   📊 Filtered result: ${currentMonthRecords.length} records for current month (${year}-${monthStr})`);
          
          const presentCount = currentMonthRecords.filter(r => r.status === 'Present').length;
          const absentCount = currentMonthRecords.filter(r => r.status === 'Absent').length;
          const percentage = currentMonthRecords.length > 0 ? Math.round((presentCount / currentMonthRecords.length) * 100) : 0;
          
          console.log(`   📊 Statistics: ${presentCount} Present, ${absentCount} Absent, ${percentage}% attendance`);
        }
      } catch (err) {
        console.log(`❌ Error testing filtering for "${tableName}":`, err.message);
      }
    }

  } catch (error) {
    console.error('❌ Debug script error:', error);
  }
  
  console.log('\n🔍 DEBUGGING COMPLETE');
  console.log('=====================================');
  console.log('\nNext steps:');
  console.log('1. Check if attendance records exist in the expected table');
  console.log('2. Verify the date format matches what parent dashboard expects');
  console.log('3. Confirm student-parent relationship mapping is correct');
  console.log('4. Test with the exact student ID that should see attendance');
  console.log('5. Check console logs in parent dashboard for detailed debugging');
}

// Run the debug function
debugAttendance().catch(console.error);
