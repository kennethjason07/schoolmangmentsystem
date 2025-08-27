/**
 * Integration Status Checker
 * 
 * This script checks if the notification triggers have been integrated
 * with your existing mark entry and homework upload components.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

class IntegrationChecker {
  constructor() {
    this.findings = [];
    this.recommendations = [];
  }

  checkIntegration() {
    console.log('🔍 CHECKING INTEGRATION STATUS...\n');
    
    // Check if notification files exist
    this.checkNotificationFiles();
    
    // Check if mark entry components import notification triggers
    this.checkMarkEntryIntegration();
    
    // Check if homework components import notification triggers
    this.checkHomeworkIntegration();
    
    // Print summary
    this.printIntegrationSummary();
  }

  checkNotificationFiles() {
    console.log('📁 STEP 1: Checking if notification files exist...');
    
    const requiredFiles = [
      'create_notification_enum_types.sql',
      'notification_helper_functions.sql',
      'src/services/enhancedNotificationService.js',
      'src/utils/gradeNotificationTrigger.js',
      'src/utils/homeworkNotificationTrigger.js',
      'src/api/notificationEndpoints.js',
      'src/utils/notificationManager.js'
    ];

    requiredFiles.forEach(file => {
      if (existsSync(file)) {
        console.log(`✅ ${file} exists`);
      } else {
        console.log(`❌ ${file} missing`);
        this.findings.push(`Missing file: ${file}`);
        this.recommendations.push('Re-run the notification system implementation');
      }
    });
    
    console.log('');
  }

  checkMarkEntryIntegration() {
    console.log('🎯 STEP 2: Checking mark entry component integration...');
    
    // Look for mark entry related components
    const possibleMarkFiles = [
      'src/screens/teacher/MarksEntry.js',
      'src/screens/teacher/EnterMarks.js', 
      'src/screens/teacher/GradeEntry.js',
      'src/screens/admin/MarksManagement.js',
      'src/components/MarksEntry.js',
      'src/components/GradeEntry.js'
    ];

    let foundMarkComponent = false;
    let hasIntegration = false;

    possibleMarkFiles.forEach(file => {
      if (existsSync(file)) {
        foundMarkComponent = true;
        console.log(`📄 Found mark entry component: ${file}`);
        
        try {
          const content = readFileSync(file, 'utf8');
          
          // Check for notification trigger imports
          const hasGradeImport = content.includes('triggerGradeEntryNotification') || 
                                content.includes('gradeNotificationTrigger');
          
          const hasServiceImport = content.includes('enhancedNotificationService') ||
                                 content.includes('notificationService');

          if (hasGradeImport || hasServiceImport) {
            console.log(`✅ ${file} has notification integration`);
            hasIntegration = true;
          } else {
            console.log(`❌ ${file} missing notification integration`);
            this.findings.push(`Mark entry component ${file} not integrated with notifications`);
            this.recommendations.push(`Add notification trigger to ${file}`);
          }
          
        } catch (error) {
          console.log(`❌ Error reading ${file}:`, error.message);
        }
      }
    });

    if (!foundMarkComponent) {
      console.log('❌ No mark entry components found');
      this.findings.push('No mark entry components found');
      this.recommendations.push('Identify your mark entry component and integrate notification triggers');
    }

    if (foundMarkComponent && !hasIntegration) {
      this.findings.push('Mark entry components exist but lack notification integration');
      this.recommendations.push('Add notification triggers to your mark entry workflow');
    }
    
    console.log('');
  }

  checkHomeworkIntegration() {
    console.log('📚 STEP 3: Checking homework component integration...');
    
    // Look for homework related components
    const possibleHomeworkFiles = [
      'src/screens/teacher/HomeworkUpload.js',
      'src/screens/teacher/AssignHomework.js',
      'src/screens/teacher/CreateHomework.js', 
      'src/screens/admin/HomeworkManagement.js',
      'src/components/HomeworkUpload.js',
      'src/components/HomeworkForm.js'
    ];

    let foundHomeworkComponent = false;
    let hasIntegration = false;

    possibleHomeworkFiles.forEach(file => {
      if (existsSync(file)) {
        foundHomeworkComponent = true;
        console.log(`📄 Found homework component: ${file}`);
        
        try {
          const content = readFileSync(file, 'utf8');
          
          // Check for notification trigger imports
          const hasHomeworkImport = content.includes('triggerHomeworkNotification') || 
                                   content.includes('homeworkNotificationTrigger') ||
                                   content.includes('onHomeworkCreated');
          
          const hasServiceImport = content.includes('enhancedNotificationService') ||
                                 content.includes('notificationService');

          if (hasHomeworkImport || hasServiceImport) {
            console.log(`✅ ${file} has notification integration`);
            hasIntegration = true;
          } else {
            console.log(`❌ ${file} missing notification integration`);
            this.findings.push(`Homework component ${file} not integrated with notifications`);
            this.recommendations.push(`Add notification trigger to ${file}`);
          }
          
        } catch (error) {
          console.log(`❌ Error reading ${file}:`, error.message);
        }
      }
    });

    if (!foundHomeworkComponent) {
      console.log('❌ No homework components found');
      this.findings.push('No homework components found');
      this.recommendations.push('Identify your homework upload component and integrate notification triggers');
    }

    if (foundHomeworkComponent && !hasIntegration) {
      this.findings.push('Homework components exist but lack notification integration');
      this.recommendations.push('Add notification triggers to your homework upload workflow');
    }
    
    console.log('');
  }

  printIntegrationSummary() {
    console.log('📋 INTEGRATION STATUS SUMMARY');
    console.log('=============================');
    
    if (this.findings.length === 0) {
      console.log('🎉 Great! It looks like you have the notification files and integration in place!');
      console.log('\n💡 If notifications still aren\'t working, the issue might be:');
      console.log('1. Database setup (run the SQL files)');
      console.log('2. Parent-student relationships in database');
      console.log('3. The notification trigger isn\'t being called at the right time');
      console.log('\nRun the diagnostic script: node debug_grade_notifications.js');
    } else {
      console.log(`❌ Found ${this.findings.length} integration issues:`);
      this.findings.forEach((finding, index) => {
        console.log(`   ${index + 1}. ${finding}`);
      });
      
      console.log(`\n🔧 Recommendations:`);
      [...new Set(this.recommendations)].forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`);
      });
    }
    
    console.log('\n📖 INTEGRATION EXAMPLE:');
    console.log('========================');
    console.log('In your mark entry component, add this after saving marks:');
    console.log('');
    console.log('```javascript');
    console.log('import { triggerGradeEntryNotification } from "../utils/gradeNotificationTrigger";');
    console.log('');
    console.log('const handleSaveMarks = async (marksData) => {');
    console.log('  // Save marks to database');
    console.log('  await saveMarksToDatabase(marksData);');
    console.log('  ');
    console.log('  // Trigger notification to parents');
    console.log('  const result = await triggerGradeEntryNotification({');
    console.log('    classId: selectedClass.id,');
    console.log('    subjectId: selectedSubject.id,');
    console.log('    examId: selectedExam.id,');
    console.log('    teacherId: currentUser.teacherId,');
    console.log('    studentMarks: marksData,');
    console.log('    enteredBy: currentUser.id');
    console.log('  });');
    console.log('  ');
    console.log('  if (result.success) {');
    console.log('    Alert.alert("Success", `Marks saved and ${result.recipientCount} parents notified!`);');
    console.log('  }');
    console.log('};');
    console.log('```');
    
    console.log('\n🔍 Next Steps:');
    console.log('1. Fix the integration issues listed above');
    console.log('2. Run the diagnostic: node debug_grade_notifications.js');
    console.log('3. Test by entering marks and checking parent notifications');
  }
}

// Run the check
const checker = new IntegrationChecker();
checker.checkIntegration();
