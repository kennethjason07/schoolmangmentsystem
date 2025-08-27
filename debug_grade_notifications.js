/**
 * Grade Notification Troubleshooting Script
 * 
 * This script helps diagnose why grade entry notifications are not being sent to parents.
 * Run this script to check each part of the notification system.
 */

import { supabase, TABLES } from './src/utils/supabase.js';
import { enhancedNotificationService } from './src/services/enhancedNotificationService.js';
import { triggerGradeEntryNotification } from './src/utils/gradeNotificationTrigger.js';

class GradeNotificationDebugger {
  constructor() {
    this.issues = [];
    this.recommendations = [];
  }

  async runFullDiagnostic() {
    console.log('🔍 GRADE NOTIFICATION DIAGNOSTIC STARTING...\n');
    
    // Step 1: Check database setup
    await this.checkDatabaseSetup();
    
    // Step 2: Check if notification enum types exist
    await this.checkNotificationEnumTypes();
    
    // Step 3: Check if database functions exist
    await this.checkDatabaseFunctions();
    
    // Step 4: Check parent-student relationships
    await this.checkParentStudentRelationships();
    
    // Step 5: Check recent marks entries
    await this.checkRecentMarksEntries();
    
    // Step 6: Check existing notifications
    await this.checkExistingNotifications();
    
    // Step 7: Test notification creation manually
    await this.testNotificationCreation();
    
    // Print summary
    this.printDiagnosticSummary();
  }

  async checkDatabaseSetup() {
    console.log('📊 STEP 1: Checking Database Setup...');
    
    try {
      // Check if notification tables exist
      const { data: notificationsTable, error: notError } = await supabase
        .from(TABLES.NOTIFICATIONS)
        .select('id')
        .limit(1);
        
      const { data: recipientsTable, error: recError } = await supabase
        .from(TABLES.NOTIFICATION_RECIPIENTS)
        .select('id')
        .limit(1);

      if (notError) {
        this.issues.push('❌ Notifications table not accessible: ' + notError.message);
        this.recommendations.push('Run the database setup SQL files');
      } else {
        console.log('✅ Notifications table accessible');
      }

      if (recError) {
        this.issues.push('❌ Notification recipients table not accessible: ' + recError.message);
        this.recommendations.push('Run the database setup SQL files');
      } else {
        console.log('✅ Notification recipients table accessible');
      }

      // Check basic table structure
      const { data: tableColumns } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_name', 'notifications')
        .eq('table_schema', 'public');

      if (tableColumns) {
        const requiredColumns = ['id', 'type', 'message', 'delivery_mode', 'sent_by', 'created_at'];
        const existingColumns = tableColumns.map(col => col.column_name);
        
        requiredColumns.forEach(col => {
          if (!existingColumns.includes(col)) {
            this.issues.push(`❌ Missing required column in notifications table: ${col}`);
          }
        });
        
        console.log('✅ Table structure checked');
      }

    } catch (error) {
      this.issues.push('❌ Database connection error: ' + error.message);
      console.error('❌ Database setup check failed:', error);
    }
    
    console.log('');
  }

  async checkNotificationEnumTypes() {
    console.log('🏷️ STEP 2: Checking Notification Enum Types...');
    
    try {
      const { data, error } = await supabase
        .from('pg_enum')
        .select('enumlabel')
        .eq('enumtypid', 
          supabase.from('pg_type')
            .select('oid')
            .eq('typname', 'notification_type_enum')
        );

      if (error) {
        this.issues.push('❌ Notification enum types not found: ' + error.message);
        this.recommendations.push('Run: create_notification_enum_types.sql in Supabase SQL editor');
        console.log('❌ Notification enum types not accessible');
      } else {
        const enumValues = data?.map(d => d.enumlabel) || [];
        console.log('✅ Found enum values:', enumValues);
        
        if (!enumValues.includes('GRADE_ENTERED')) {
          this.issues.push('❌ Missing GRADE_ENTERED enum value');
          this.recommendations.push('Add GRADE_ENTERED to notification_type_enum');
        }
        
        if (!enumValues.includes('HOMEWORK_UPLOADED')) {
          this.issues.push('❌ Missing HOMEWORK_UPLOADED enum value');
          this.recommendations.push('Add HOMEWORK_UPLOADED to notification_type_enum');
        }
      }

    } catch (error) {
      this.issues.push('❌ Error checking enum types: ' + error.message);
      console.error('❌ Enum check failed:', error);
    }
    
    console.log('');
  }

  async checkDatabaseFunctions() {
    console.log('⚙️ STEP 3: Checking Database Functions...');
    
    const functionsToCheck = [
      'get_class_parent_ids',
      'get_class_student_ids', 
      'create_bulk_notification',
      'notify_grade_entry'
    ];

    for (const functionName of functionsToCheck) {
      try {
        // Check if function exists
        const { data, error } = await supabase
          .from('information_schema.routines')
          .select('routine_name')
          .eq('routine_name', functionName)
          .eq('routine_schema', 'public');

        if (!data || data.length === 0) {
          this.issues.push(`❌ Database function missing: ${functionName}`);
          this.recommendations.push('Run: notification_helper_functions.sql in Supabase SQL editor');
          console.log(`❌ Function ${functionName} not found`);
        } else {
          console.log(`✅ Function ${functionName} exists`);
        }

      } catch (error) {
        console.log(`❌ Error checking function ${functionName}:`, error.message);
      }
    }
    
    console.log('');
  }

  async checkParentStudentRelationships() {
    console.log('👨‍👩‍👧‍👦 STEP 4: Checking Parent-Student Relationships...');
    
    try {
      // Get sample students
      const { data: students, error: studentsError } = await supabase
        .from(TABLES.STUDENTS)
        .select('id, name, class_id, parent_id')
        .limit(5);

      if (studentsError) {
        this.issues.push('❌ Cannot access students table: ' + studentsError.message);
        console.log('❌ Students table not accessible');
      } else {
        console.log(`✅ Found ${students.length} sample students`);
        
        if (students.length === 0) {
          this.issues.push('❌ No students found in database');
          this.recommendations.push('Add student data to test notifications');
        }

        // Check parent relationships for each student
        for (const student of students.slice(0, 3)) {
          console.log(`\n   Checking relationships for student: ${student.name} (${student.id})`);
          
          // Method 1: Check parent_id field
          if (student.parent_id) {
            const { data: parent } = await supabase
              .from(TABLES.PARENTS)
              .select('id, name, email')
              .eq('id', student.parent_id)
              .single();
              
            if (parent) {
              console.log(`   ✅ Parent via parent_id: ${parent.name} (${parent.email})`);
              
              // Check if parent has user account
              if (parent.email) {
                const { data: parentUser } = await supabase
                  .from(TABLES.USERS)
                  .select('id, full_name, role_id')
                  .eq('email', parent.email)
                  .eq('role_id', 3) // Assuming 3 is parent role
                  .single();
                  
                if (parentUser) {
                  console.log(`   ✅ Parent has user account: ${parentUser.full_name}`);
                } else {
                  console.log(`   ❌ Parent has no user account for email: ${parent.email}`);
                  this.issues.push(`❌ Parent ${parent.name} has no user account`);
                  this.recommendations.push('Create user accounts for parents or link existing ones');
                }
              }
            } else {
              console.log(`   ❌ Parent not found for parent_id: ${student.parent_id}`);
            }
          } else {
            console.log(`   ❌ Student has no parent_id`);
          }

          // Method 2: Check parents table with student_id
          const { data: directParents } = await supabase
            .from(TABLES.PARENTS)
            .select('id, name, email')
            .eq('student_id', student.id);

          if (directParents && directParents.length > 0) {
            console.log(`   ✅ Found ${directParents.length} parents via student_id relationship`);
            directParents.forEach(p => console.log(`      - ${p.name} (${p.email})`));
          } else {
            console.log(`   ❌ No parents found via student_id relationship`);
          }

          // Method 3: Check users.linked_parent_of
          const { data: linkedParent } = await supabase
            .from(TABLES.USERS)
            .select('id, full_name, email')
            .eq('linked_parent_of', student.id)
            .eq('role_id', 3);

          if (linkedParent && linkedParent.length > 0) {
            console.log(`   ✅ Found ${linkedParent.length} parents via linked_parent_of`);
            linkedParent.forEach(p => console.log(`      - ${p.full_name} (${p.email})`));
          } else {
            console.log(`   ❌ No parents found via linked_parent_of`);
          }

          // Summary for this student
          const hasAnyParent = student.parent_id || 
                              (directParents && directParents.length > 0) || 
                              (linkedParent && linkedParent.length > 0);
          
          if (!hasAnyParent) {
            this.issues.push(`❌ Student ${student.name} has no parent relationships`);
            this.recommendations.push('Fix parent-student relationships in database');
          }
        }
      }

    } catch (error) {
      this.issues.push('❌ Error checking parent-student relationships: ' + error.message);
      console.error('❌ Parent-student relationship check failed:', error);
    }
    
    console.log('');
  }

  async checkRecentMarksEntries() {
    console.log('📝 STEP 5: Checking Recent Marks Entries...');
    
    try {
      const { data: recentMarks, error } = await supabase
        .from(TABLES.MARKS)
        .select(`
          id, 
          student_id,
          exam_id,
          subject_id,
          marks_obtained,
          created_at,
          students(id, name, class_id),
          exams(id, name, class_id),
          subjects(id, name)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        this.issues.push('❌ Cannot access marks table: ' + error.message);
        console.log('❌ Marks table not accessible');
      } else {
        console.log(`✅ Found ${recentMarks.length} recent marks entries`);
        
        if (recentMarks.length === 0) {
          this.issues.push('❌ No marks entries found');
          this.recommendations.push('Enter some marks to test notifications');
        } else {
          recentMarks.forEach((mark, index) => {
            console.log(`   ${index + 1}. Student: ${mark.students?.name || 'Unknown'}`);
            console.log(`      Subject: ${mark.subjects?.name || 'Unknown'}`);
            console.log(`      Exam: ${mark.exams?.name || 'Unknown'}`);
            console.log(`      Marks: ${mark.marks_obtained}`);
            console.log(`      Date: ${mark.created_at}`);
            console.log(`      Class ID: ${mark.students?.class_id || mark.exams?.class_id || 'Unknown'}`);
            console.log('');
          });

          // Check if we can identify classes, subjects, exams for notification
          const latestMark = recentMarks[0];
          if (latestMark) {
            console.log('   📊 Latest mark entry analysis:');
            const classId = latestMark.students?.class_id || latestMark.exams?.class_id;
            const subjectId = latestMark.subject_id;
            const examId = latestMark.exam_id;

            if (!classId) {
              this.issues.push('❌ Cannot determine class ID from latest mark entry');
              this.recommendations.push('Ensure students have class_id or exams have class_id');
            } else {
              console.log(`   ✅ Class ID identified: ${classId}`);
            }

            if (!subjectId) {
              this.issues.push('❌ No subject ID in latest mark entry');
            } else {
              console.log(`   ✅ Subject ID: ${subjectId}`);
            }

            if (!examId) {
              this.issues.push('❌ No exam ID in latest mark entry');
            } else {
              console.log(`   ✅ Exam ID: ${examId}`);
            }
          }
        }
      }

    } catch (error) {
      this.issues.push('❌ Error checking recent marks: ' + error.message);
      console.error('❌ Recent marks check failed:', error);
    }
    
    console.log('');
  }

  async checkExistingNotifications() {
    console.log('🔔 STEP 6: Checking Existing Notifications...');
    
    try {
      // Check all notifications
      const { data: allNotifications, error: allError } = await supabase
        .from(TABLES.NOTIFICATIONS)
        .select('id, type, message, delivery_status, created_at, sent_by')
        .order('created_at', { ascending: false })
        .limit(10);

      if (allError) {
        this.issues.push('❌ Cannot access notifications: ' + allError.message);
        console.log('❌ Notifications table not accessible');
      } else {
        console.log(`✅ Found ${allNotifications.length} total notifications`);
        
        if (allNotifications.length === 0) {
          this.issues.push('❌ No notifications exist in database');
          this.recommendations.push('The notification system may not be integrated with mark entry');
        } else {
          // Check for grade notifications specifically
          const gradeNotifications = allNotifications.filter(n => 
            n.type === 'GRADE_ENTERED' || n.message.toLowerCase().includes('mark'));
          
          console.log(`   📊 Grade-related notifications: ${gradeNotifications.length}`);
          
          if (gradeNotifications.length === 0) {
            this.issues.push('❌ No grade-related notifications found');
            this.recommendations.push('Grade entry notifications are not being triggered');
          } else {
            console.log('   Recent grade notifications:');
            gradeNotifications.slice(0, 3).forEach((notif, index) => {
              console.log(`   ${index + 1}. ${notif.type} - ${notif.message.substring(0, 60)}...`);
              console.log(`      Status: ${notif.delivery_status}, Created: ${notif.created_at}`);
            });
          }

          // Check notification recipients
          const { data: recipients, error: recError } = await supabase
            .from(TABLES.NOTIFICATION_RECIPIENTS)
            .select('id, notification_id, recipient_id, recipient_type, delivery_status, is_read')
            .limit(10);

          if (recError) {
            this.issues.push('❌ Cannot access notification recipients: ' + recError.message);
          } else {
            console.log(`   👥 Found ${recipients.length} notification recipients`);
            
            const parentRecipients = recipients.filter(r => r.recipient_type === 'Parent');
            console.log(`   👨‍👩‍👧‍👦 Parent recipients: ${parentRecipients.length}`);
            
            if (parentRecipients.length === 0) {
              this.issues.push('❌ No parent recipients found in notifications');
              this.recommendations.push('Parent-student relationships may not be working');
            }
          }
        }
      }

    } catch (error) {
      this.issues.push('❌ Error checking existing notifications: ' + error.message);
      console.error('❌ Existing notifications check failed:', error);
    }
    
    console.log('');
  }

  async testNotificationCreation() {
    console.log('🧪 STEP 7: Testing Notification Creation...');
    
    try {
      // Get a sample class, subject, exam, and teacher for testing
      const { data: sampleClass } = await supabase
        .from(TABLES.CLASSES)
        .select('id, class_name')
        .limit(1)
        .single();

      const { data: sampleSubject } = await supabase
        .from(TABLES.SUBJECTS)
        .select('id, name')
        .limit(1)
        .single();

      const { data: sampleExam } = await supabase
        .from(TABLES.EXAMS)
        .select('id, name')
        .limit(1)
        .single();

      const { data: sampleTeacher } = await supabase
        .from(TABLES.TEACHERS)
        .select('id, name')
        .limit(1)
        .single();

      if (!sampleClass || !sampleSubject || !sampleExam || !sampleTeacher) {
        this.issues.push('❌ Missing sample data for testing');
        this.recommendations.push('Ensure you have at least one class, subject, exam, and teacher in database');
        console.log('❌ Insufficient sample data for testing');
        return;
      }

      console.log('   📊 Using sample data:');
      console.log(`   Class: ${sampleClass.class_name} (${sampleClass.id})`);
      console.log(`   Subject: ${sampleSubject.name} (${sampleSubject.id})`);
      console.log(`   Exam: ${sampleExam.name} (${sampleExam.id})`);
      console.log(`   Teacher: ${sampleTeacher.name} (${sampleTeacher.id})`);
      
      console.log('\n   🧪 Testing grade notification creation...');
      
      // Test the notification service directly
      const testResult = await enhancedNotificationService.notifyGradeEntry({
        classId: sampleClass.id,
        subjectId: sampleSubject.id,
        examId: sampleExam.id,
        teacherId: sampleTeacher.id
      });

      console.log('   📊 Test result:', testResult);

      if (testResult.success) {
        console.log(`   ✅ Notification created successfully! ID: ${testResult.notificationId}`);
        console.log(`   👥 Recipients: ${testResult.recipientCount}`);
        
        if (testResult.recipientCount === 0) {
          this.issues.push('❌ Notification created but no recipients found');
          this.recommendations.push('Check parent-student relationships for this class');
        }
      } else {
        this.issues.push('❌ Test notification creation failed: ' + testResult.error);
        this.recommendations.push('Check database functions and notification service');
        console.log(`   ❌ Test failed: ${testResult.error}`);
      }

    } catch (error) {
      this.issues.push('❌ Error in test notification creation: ' + error.message);
      console.error('❌ Test notification creation failed:', error);
    }
    
    console.log('');
  }

  printDiagnosticSummary() {
    console.log('📋 DIAGNOSTIC SUMMARY');
    console.log('=====================');
    
    if (this.issues.length === 0) {
      console.log('🎉 No issues found! The notification system should be working.');
      console.log('\n💡 If you\'re still not receiving notifications, check:');
      console.log('1. Are you integrating the notification triggers in your mark entry code?');
      console.log('2. Are you checking notifications in the parent dashboard?');
      console.log('3. Are you logged in as the correct parent user?');
    } else {
      console.log(`❌ Found ${this.issues.length} issues:`);
      this.issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });
      
      console.log(`\n🔧 Recommendations:`);
      [...new Set(this.recommendations)].forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`);
      });
    }
    
    console.log('\n📞 Next Steps:');
    console.log('1. Fix the issues listed above');
    console.log('2. Ensure your mark entry component calls the notification trigger');
    console.log('3. Check parent dashboard for notifications');
    console.log('4. Run this diagnostic again to verify fixes');
    
    console.log('\n🔍 For more help, check the integration examples in:');
    console.log('   - NOTIFICATION_SYSTEM_IMPLEMENTATION.md');
    console.log('   - test_notification_system.js');
  }
}

// Export for use in other files or run directly
export { GradeNotificationDebugger };

// If running directly, execute the diagnostic
if (typeof require !== 'undefined' && require.main === module) {
  const notificationDebugger = new GradeNotificationDebugger();
  notificationDebugger.runFullDiagnostic().catch(console.error);
}

// Also export a simple function to run from console
export const diagnoseGradeNotifications = async () => {
  const notificationDebugger = new GradeNotificationDebugger();
  await notificationDebugger.runFullDiagnostic();
};
