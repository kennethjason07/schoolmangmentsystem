/**
 * Debug script for Today's Classes issue in Teacher Dashboard
 * 
 * This script helps identify why the "Today's Classes" stat card
 * might not be updating properly.
 */

import { supabase, TABLES } from './src/utils/supabase.js';

async function debugTodaysClasses() {
  console.log('🔍 Starting debug for Today\'s Classes issue...');
  console.log('📅 Current date:', new Date().toISOString());
  
  // Get current day
  const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayName = dayNames[today];
  
  console.log('🗓️ Today is:', todayName, '(day', today, ')');
  
  try {
    // 1. Check if timetable_entries table exists and has data
    console.log('\n🔍 Step 1: Checking timetable_entries table...');
    const { data: allTimetableData, error: allTimetableError } = await supabase
      .from(TABLES.TIMETABLE)
      .select('*')
      .limit(10);
      
    if (allTimetableError) {
      console.error('❌ Error accessing timetable_entries table:', allTimetableError);
      return;
    }
    
    console.log('📋 Total timetable entries found:', allTimetableData?.length || 0);
    
    if (allTimetableData && allTimetableData.length > 0) {
      console.log('📊 Sample timetable entries:');
      allTimetableData.slice(0, 5).forEach((entry, index) => {
        console.log(`   ${index + 1}. Day: ${entry.day_of_week}, Time: ${entry.start_time}-${entry.end_time}, Teacher ID: ${entry.teacher_id}, Academic Year: ${entry.academic_year}`);
      });
      
      // Check which days have entries
      const uniqueDays = [...new Set(allTimetableData.map(entry => entry.day_of_week))];
      console.log('📅 Days with timetable entries:', uniqueDays);
      
      // Check which academic years exist
      const uniqueAcademicYears = [...new Set(allTimetableData.map(entry => entry.academic_year))];
      console.log('📚 Academic years in timetable:', uniqueAcademicYears);
    } else {
      console.log('⚠️  No timetable entries found at all!');
      return;
    }
    
    // 2. Check entries for today specifically
    console.log('\n🔍 Step 2: Checking entries for today (' + todayName + ')...');
    const { data: todayData, error: todayError } = await supabase
      .from(TABLES.TIMETABLE)
      .select('*')
      .eq('day_of_week', todayName);
      
    if (todayError) {
      console.error('❌ Error getting today\'s entries:', todayError);
    } else {
      console.log('📋 Entries found for', todayName + ':', todayData?.length || 0);
      if (todayData && todayData.length > 0) {
        todayData.forEach((entry, index) => {
          console.log(`   ${index + 1}. ${entry.start_time}-${entry.end_time}, Teacher: ${entry.teacher_id}, Subject: ${entry.subject_id}, Class: ${entry.class_id}`);
        });
      }
    }
    
    // 3. Check current year and possible academic year formats
    console.log('\n🔍 Step 3: Checking academic year formats...');
    const currentYear = new Date().getFullYear();
    const possibleAcademicYears = [
      `${currentYear}-${(currentYear + 1).toString().slice(-2)}`, // 2025-26
      `${currentYear}-${currentYear + 1}`, // 2025-2026
      `${currentYear.toString().slice(-2)}-${(currentYear + 1).toString().slice(-2)}`, // 25-26
      currentYear.toString() // 2025
    ];
    
    console.log('📅 Possible academic year formats:', possibleAcademicYears);
    
    for (const academicYear of possibleAcademicYears) {
      const { data: yearData, error: yearError } = await supabase
        .from(TABLES.TIMETABLE)
        .select('*')
        .eq('academic_year', academicYear)
        .eq('day_of_week', todayName);
        
      if (!yearError && yearData) {
        console.log(`✅ Academic year ${academicYear}: ${yearData.length} entries for ${todayName}`);
      } else {
        console.log(`❌ Academic year ${academicYear}: ${yearError?.message || 'No entries'}`);
      }
    }
    
    // 4. Get all teachers to test with a specific teacher
    console.log('\n🔍 Step 4: Checking teachers...');
    const { data: teachersData, error: teachersError } = await supabase
      .from(TABLES.TEACHERS)
      .select('id, name, full_name')
      .limit(5);
      
    if (teachersError) {
      console.error('❌ Error getting teachers:', teachersError);
    } else if (teachersData && teachersData.length > 0) {
      console.log('👥 Available teachers:');
      teachersData.forEach((teacher, index) => {
        console.log(`   ${index + 1}. ID: ${teacher.id}, Name: ${teacher.name || teacher.full_name}`);
      });
      
      // Test with first teacher
      const testTeacher = teachersData[0];
      console.log('\n🔍 Step 5: Testing with teacher:', testTeacher.name || testTeacher.full_name);
      
      const { data: teacherTimetable, error: teacherTimetableError } = await supabase
        .from(TABLES.TIMETABLE)
        .select(`
          *,
          subjects(name),
          classes(class_name, section)
        `)
        .eq('teacher_id', testTeacher.id)
        .eq('day_of_week', todayName);
        
      if (teacherTimetableError) {
        console.error('❌ Error getting teacher timetable:', teacherTimetableError);
      } else {
        console.log('📋 Teacher timetable for', todayName + ':', teacherTimetable?.length || 0);
        if (teacherTimetable && teacherTimetable.length > 0) {
          teacherTimetable.forEach((entry, index) => {
            console.log(`   ${index + 1}. ${entry.start_time}-${entry.end_time}, Subject: ${entry.subjects?.name || 'N/A'}, Class: ${entry.classes?.class_name} ${entry.classes?.section}`);
          });
        }
      }
    }
    
    // 6. Check if the issue is with RLS policies
    console.log('\n🔍 Step 6: Checking RLS and current user...');
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      console.log('👤 Current user ID:', user.id);
      
      // Try to get the teacher record for this user
      const { data: currentTeacher, error: currentTeacherError } = await supabase
        .from(TABLES.TEACHERS)
        .select('id, name, full_name')
        .eq('user_id', user.id)
        .single();
        
      if (currentTeacherError) {
        console.error('❌ Error getting current teacher:', currentTeacherError);
      } else if (currentTeacher) {
        console.log('👨‍🏫 Current teacher:', currentTeacher.name || currentTeacher.full_name, '(ID:', currentTeacher.id + ')');
        
        // Test timetable for current teacher
        const { data: currentTeacherTimetable, error: currentTeacherTimetableError } = await supabase
          .from(TABLES.TIMETABLE)
          .select(`
            *,
            subjects(name),
            classes(class_name, section)
          `)
          .eq('teacher_id', currentTeacher.id)
          .eq('day_of_week', todayName);
          
        if (currentTeacherTimetableError) {
          console.error('❌ Error getting current teacher timetable:', currentTeacherTimetableError);
        } else {
          console.log('📋 Current teacher timetable for', todayName + ':', currentTeacherTimetable?.length || 0);
          
          if (currentTeacherTimetable && currentTeacherTimetable.length > 0) {
            console.log('✅ SUCCESS: Found classes for current teacher today!');
            currentTeacherTimetable.forEach((entry, index) => {
              console.log(`   ${index + 1}. ${entry.start_time}-${entry.end_time}, Subject: ${entry.subjects?.name || 'N/A'}, Class: ${entry.classes?.class_name} ${entry.classes?.section}`);
            });
          } else {
            console.log('⚠️  Current teacher has no classes scheduled for', todayName);
            
            // Check if teacher has any classes at all
            const { data: anyClasses, error: anyClassesError } = await supabase
              .from(TABLES.TIMETABLE)
              .select('day_of_week, start_time, end_time')
              .eq('teacher_id', currentTeacher.id)
              .limit(10);
              
            if (!anyClassesError && anyClasses && anyClasses.length > 0) {
              console.log('📅 Teacher has classes on other days:');
              anyClasses.forEach((entry, index) => {
                console.log(`   ${index + 1}. ${entry.day_of_week} ${entry.start_time}-${entry.end_time}`);
              });
            } else {
              console.log('⚠️  Teacher has no timetable entries at all!');
            }
          }
        }
      } else {
        console.log('⚠️  No teacher record found for current user');
      }
    } else {
      console.log('⚠️  No authenticated user');
    }
    
  } catch (error) {
    console.error('💥 Debug script error:', error);
  }
  
  console.log('\n✅ Debug completed!');
}

// Export for use in other scripts
export { debugTodaysClasses };

// Run immediately if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  debugTodaysClasses().then(() => {
    console.log('Debug script finished');
    process.exit(0);
  }).catch(error => {
    console.error('Debug script failed:', error);
    process.exit(1);
  });
}
