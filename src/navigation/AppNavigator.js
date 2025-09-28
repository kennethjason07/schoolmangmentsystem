import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, ActivityIndicator, Platform } from 'react-native';

// Import screens
import LoginScreen from '../screens/auth/LoginScreen';

// Warden imports
import { WardenTabNavigator } from './WardenNavigator';
import WardenDashboard from '../screens/warden/WardenDashboard';
import HostelApplications from '../screens/warden/HostelApplications';
import HostelManagement from '../screens/admin/HostelManagement';
import HostelDetailList from '../screens/admin/HostelDetailList';
import HostelDetailView from '../screens/admin/HostelDetailView';
import HostelRoomManagement from '../screens/admin/HostelRoomManagement';
import HostelBedManagement from '../screens/admin/HostelBedManagement';
import HostelMaintenanceManagement from '../screens/admin/HostelMaintenanceManagement';
import HostelStudentManagement from '../screens/admin/HostelStudentManagement';
import SignupScreen from '../screens/auth/SignupScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import LoadingScreen from '../screens/LoadingScreen';
import { useAuth } from '../utils/AuthContext';
import MessageBadge from '../components/MessageBadge';
import UniversalNotificationBadge from '../components/UniversalNotificationBadge';
import ChatBadge from '../components/ChatBadge';
import InAppNotificationBanner from '../components/InAppNotificationBanner';
import { navigationRef } from '../services/NavigationService';
// Admin Screens
import AdminDashboard from '../screens/admin/AdminDashboard';
import ManageClasses from '../screens/admin/ManageClasses';
import ManageStudents from '../screens/admin/ManageStudents';
import ManageTeachers from '../screens/admin/ManageTeachers';
import SubjectsTimetable from '../screens/admin/SubjectsTimetable';
import ExamsMarks from '../screens/admin/ExamsMarks';
import AdminMarksEntry from '../screens/admin/MarksEntry';
import AttendanceManagement from '../screens/admin/AttendanceManagement';
import FeeManagement from '../screens/admin/FeeManagement';
import DiscountManagement from '../screens/admin/DiscountManagement';
import AnalyticsReports from '../screens/admin/AnalyticsReports';
import NotificationManagement from '../screens/admin/NotificationManagement';
import ExpenseManagement from '../screens/admin/ExpenseManagement';
import StationaryManagement from '../screens/admin/StationaryManagement';
import StudentDetails from '../screens/admin/StudentDetails';
import StudentList from '../screens/admin/StudentList';
import TeacherDetails from '../screens/admin/TeacherDetails';
import TeacherAccountManagement from '../screens/admin/TeacherAccountManagement';
import StudentAccountManagement from '../screens/admin/StudentAccountManagement';
import ParentAccountManagement from '../screens/admin/ParentAccountManagement';
import LinkExistingParent from '../screens/admin/LinkExistingParent';
import LeaveManagement from '../screens/admin/LeaveManagement';
import AdminNotifications from '../screens/admin/AdminNotifications';
import HallTicketGeneration from '../screens/admin/HallTicketGeneration';
import AutoGrading from '../screens/admin/AutoGrading';
import PendingUPIPayments from '../screens/admin/PendingUPIPayments';
import PaymentVerificationScreen from '../screens/PaymentVerificationScreen';
import TestPaymentVerificationNavigation from '../screens/TestPaymentVerificationNavigation';


import FeeClassDetails from '../screens/admin/FeeClassDetails';
import ClassStudentDetails from '../screens/admin/ClassStudentDetails';
import AssignTaskToTeacher from '../screens/admin/AssignTaskToTeacher';
import SchoolDetails from '../screens/admin/SchoolDetails';

// Report Screens
import AttendanceReport from '../screens/admin/reports/AttendanceReport';
import AttendanceRecordDetail from '../screens/admin/reports/AttendanceRecordDetail';
import AcademicPerformance from '../screens/admin/reports/AcademicPerformance';
import FeeCollection from '../screens/admin/reports/FeeCollection';
import ReportCardGeneration from '../screens/admin/ReportCardGeneration';

// Teacher Screens
import TeacherDashboard from '../screens/teacher/TeacherDashboard';
import TeacherTimetable from '../screens/teacher/TeacherTimetable';
import TakeAttendance from '../screens/teacher/TakeAttendance';
import MarksEntry from '../screens/teacher/MarksEntry';
import UploadHomework from '../screens/teacher/UploadHomework';
import ViewStudentInfo from '../screens/teacher/ViewStudentInfo';
import TeacherSubjects from '../screens/teacher/TeacherSubjects';
import TeacherChat from '../screens/teacher/TeacherChat';
import MarksEntryStudentsScreen from '../screens/teacher/MarksEntryStudentsScreen';
import StudentAttendanceScreen from '../screens/teacher/StudentAttendanceScreen';
import StudentMarksScreen from '../screens/teacher/StudentMarksScreen';
import ViewSubmissions from '../screens/teacher/ViewSubmissions';
import LeaveApplication from '../screens/teacher/LeaveApplication';
import TeacherNotifications from '../screens/teacher/TeacherNotifications';

// Parent Screens
import ParentDashboard from '../screens/parent/ParentDashboard';
import ViewReportCard from '../screens/parent/ViewReportCard';
import AttendanceSummary from '../screens/parent/AttendanceSummary';
import FeePayment from '../screens/parent/FeePayment';
import Notifications from '../screens/parent/Notifications';
import ChatWithTeacher from '../screens/parent/ChatWithTeacher';
import StudentSelectionScreen from '../screens/parent/StudentSelectionScreen';
import ParentViewHomework from '../screens/parent/ParentViewHomework';
import ParentQRPayment from '../screens/parent/ParentQRPayment';


// Student Screens
import StudentDashboard from '../screens/student/StudentDashboard';
import ViewAssignments from '../screens/student/ViewAssignments';
import StudentAttendanceMarks from '../screens/student/StudentAttendanceMarks';
import StudentMarks from '../screens/student/StudentMarks';
import StudentNotifications from '../screens/student/StudentNotifications';
import TestNotifications from '../screens/student/TestNotifications';
import ScrollingDiagnostic from '../screens/student/ScrollingDiagnostic';
import StudentChatWithTeacher from '../screens/student/StudentChatWithTeacher';
import StudentFeePayment from '../screens/student/FeePayment';
import StudentQRPayment from '../screens/student/StudentQRPayment';

// Universal Screens
import ProfileScreen from '../screens/universal/ProfileScreen';
import SettingsScreen from '../screens/universal/SettingsScreen';
import NotificationSettings from '../screens/universal/NotificationSettings';
import EduCartoonAI from '../screens/universal/EduCartoonAI';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Admin Tab Navigator
function AdminTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'AdminDashboard') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Classes') {
            iconName = focused ? 'school' : 'school-outline';
          } else if (route.name === 'Students') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Teachers') {
            iconName = focused ? 'person' : 'person-outline';
          } else if (route.name === 'Reports') {
            iconName = focused ? 'bar-chart' : 'bar-chart-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#2196F3',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen
        name="AdminDashboard"
        component={AdminDashboard}
        options={{ tabBarLabel: 'Dashboard' }}
      />
      <Tab.Screen name="Classes" component={ManageClasses} />
      <Tab.Screen name="Students" component={ManageStudents} />
      <Tab.Screen
        name="Teachers"
        component={ManageTeachers}
        options={{ tabBarLabel: 'Teachers' }}
      />
      <Tab.Screen name="Reports" component={AnalyticsReports} />
    </Tab.Navigator>
  );
}

// Teacher Tab Navigator
function TeacherTabNavigator() {
  const [isKeyboardVisible, setKeyboardVisible] = React.useState(false);

  React.useEffect(() => {
    const { Keyboard } = require('react-native');
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'TeacherDashboard') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Attendance') {
            iconName = focused ? 'checkmark-circle' : 'checkmark-circle-outline';
          } else if (route.name === 'Marks') {
            iconName = focused ? 'document-text' : 'document-text-outline';
          } else if (route.name === 'Homework') {
            iconName = focused ? 'library' : 'library-outline';
          } else if (route.name === 'Chat') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          }
          
          const icon = <Ionicons name={iconName} size={size} color={color} />;
          
          // Add badge for Chat tab  
          if (route.name === 'Chat') {
            return (
              <View style={{ position: 'relative' }}>
                {icon}
                <ChatBadge />
              </View>
            );
          }
          
          return icon;
        },
        tabBarActiveTintColor: '#4CAF50',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
        tabBarStyle: isKeyboardVisible ? { display: 'none' } : {},
      })}
    >
      <Tab.Screen
        name="TeacherDashboard"
        component={TeacherDashboard}
        options={{ tabBarLabel: 'Dashboard' }}
      />
      <Tab.Screen name="Attendance" component={TakeAttendance} />
      <Tab.Screen name="Marks" component={MarksEntry} />
      <Tab.Screen name="Homework" component={UploadHomework} />
      <Tab.Screen name="Chat" component={TeacherChat} />
    </Tab.Navigator>
  );
}

// Parent Tab Navigator
function ParentTabNavigator() {
  const [isKeyboardVisible, setKeyboardVisible] = React.useState(false);

  React.useEffect(() => {
    const { Keyboard } = require('react-native');
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'ParentDashboard') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Attendance') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Marks') {
            iconName = focused ? 'document-text' : 'document-text-outline';
          } else if (route.name === 'Fees') {
            iconName = focused ? 'card' : 'card-outline';
          } else if (route.name === 'Chat') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          }
          
          const icon = <Ionicons name={iconName} size={size} color={color} />;
          
          // Add badge for Chat tab
          if (route.name === 'Chat') {
            return (
              <View style={{ position: 'relative' }}>
                {icon}
                <ChatBadge />
              </View>
            );
          }
          
          return icon;
        },
        tabBarActiveTintColor: '#FF9800',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
        tabBarStyle: isKeyboardVisible ? { display: 'none' } : {},
      })}
    >
      <Tab.Screen
        name="ParentDashboard"
        component={ParentDashboard}
        options={{ tabBarLabel: 'Dashboard' }}
      />
      <Tab.Screen name="Attendance" component={AttendanceSummary} />
      <Tab.Screen name="Marks" component={ViewReportCard} options={{ tabBarLabel: 'Marks' }} />
      <Tab.Screen name="Fees" component={FeePayment} />
      <Tab.Screen name="Chat" component={ChatWithTeacher} />
    </Tab.Navigator>
  );
}

// Student Tab Navigator
function StudentTabNavigator() {
  const [isKeyboardVisible, setKeyboardVisible] = React.useState(false);

  React.useEffect(() => {
    const { Keyboard } = require('react-native');
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'StudentDashboard') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Assignments') {
            iconName = focused ? 'library' : 'library-outline';
          } else if (route.name === 'Attendance') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Marks') {
            iconName = focused ? 'document-text' : 'document-text-outline';
          } else if (route.name === 'Chat') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          }
          
          const icon = <Ionicons name={iconName} size={size} color={color} />;
          
          // Add badge for Chat tab
          if (route.name === 'Chat') {
            return (
              <View style={{ position: 'relative' }}>
                {icon}
                <ChatBadge />
              </View>
            );
          }
          
          return icon;
        },
        tabBarActiveTintColor: '#9C27B0',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
        tabBarStyle: isKeyboardVisible ? { display: 'none' } : {},
      })}
    >
      <Tab.Screen
        name="StudentDashboard"
        component={StudentDashboard}
        options={{ tabBarLabel: 'Dashboard' }}
      />
      <Tab.Screen name="Assignments" component={ViewAssignments} />
      <Tab.Screen
        name="Attendance"
        component={StudentAttendanceMarks}
        initialParams={{ defaultTab: 'attendance' }}
      />
      <Tab.Screen name="Marks" component={StudentMarks} />
      <Tab.Screen name="Chat" component={StudentChatWithTeacher} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, userType, loading } = useAuth();

  // Web-specific debugging
  if (Platform.OS === 'web') {
    console.log('🌐 AppNavigator - Current state:', {
      user: !!user,
      userType,
      loading,
      timestamp: new Date().toISOString()
    });
  }

  // Show loading screen while checking authentication
  if (loading) {
    console.log('🔄 Showing loading screen, loading state:', loading);
    return <LoadingScreen />;
  }

  console.log('🎯 AppNavigator - Final navigation decision:', {
    authenticated: !!user,
    userType,
    willShowAuthStack: !user,
    willShowUserStack: !!user
  });

  // Additional debugging for user and userType
  if (user) {
    console.log('👤 Authenticated user details:', {
      id: user.id,
      email: user.email,
      role_id: user.role_id,
      userType: userType
    });
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <InAppNotificationBanner />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          // Auth Stack - when user is not authenticated
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </>
        ) : (
          // Role-based Stacks - when user is authenticated
          <>
            {userType === 'admin' && (
              <>
                <Stack.Screen name="AdminTabs" component={AdminTabNavigator} />
                <Stack.Screen name="SchoolDetails" component={SchoolDetails} />
                <Stack.Screen name="SubjectsTimetable" component={SubjectsTimetable} />
                <Stack.Screen name="AttendanceManagement" component={AttendanceManagement} />
                <Stack.Screen name="FeeManagement" component={FeeManagement} />
                <Stack.Screen name="DiscountManagement" component={DiscountManagement} />
                <Stack.Screen name="FeeClassDetails" component={FeeClassDetails} />
                <Stack.Screen name="ClassStudentDetails" component={ClassStudentDetails} />
                <Stack.Screen name="ExamsMarks" component={ExamsMarks} />
                <Stack.Screen name="MarksEntry" component={AdminMarksEntry} />
                <Stack.Screen name="NotificationManagement" component={NotificationManagement} />
                <Stack.Screen name="ExpenseManagement" component={ExpenseManagement} />
                <Stack.Screen name="StationaryManagement" component={StationaryManagement} />
                <Stack.Screen name="TeacherDetails" component={TeacherDetails} />
                <Stack.Screen name="TeacherAccountManagement" component={TeacherAccountManagement} />
                <Stack.Screen name="StudentAccountManagement" component={StudentAccountManagement} />
                <Stack.Screen name="ParentAccountManagement" component={ParentAccountManagement} />
                <Stack.Screen name="LinkExistingParent" component={LinkExistingParent} />
                <Stack.Screen name="LeaveManagement" component={LeaveManagement} />
                <Stack.Screen name="AdminNotifications" component={AdminNotifications} />
                <Stack.Screen name="HallTicketGeneration" component={HallTicketGeneration} />
                <Stack.Screen name="AutoGrading" component={AutoGrading} />
                <Stack.Screen name="PendingUPIPayments" component={PendingUPIPayments} />
                <Stack.Screen 
                  name="PaymentVerification" 
                  component={PaymentVerificationScreen}
                  options={{ 
                    title: 'Verify Payment',
                    headerShown: false
                  }}
                />
                <Stack.Screen 
                  name="TestPaymentVerificationNavigation" 
                  component={TestPaymentVerificationNavigation}
                  options={{ 
                    title: 'Test Payment Verification',
                    headerShown: false
                  }}
                />


                <Stack.Screen name="AssignTaskToTeacher" component={AssignTaskToTeacher} />
                <Stack.Screen name="AttendanceReport" component={AttendanceReport} />
                <Stack.Screen name="AttendanceRecordDetail" component={AttendanceRecordDetail} />
                <Stack.Screen name="AcademicPerformance" component={AcademicPerformance} />
                <Stack.Screen name="FeeCollection" component={FeeCollection} />
                <Stack.Screen name="ReportCardGeneration" component={ReportCardGeneration} />
                <Stack.Screen 
                  name="Profile" 
                  component={ProfileScreen} 
                  initialParams={{ fromAdmin: true }}
                />
                <Stack.Screen name="Settings" component={SettingsScreen} />
                <Stack.Screen name="NotificationSettings" component={NotificationSettings} />
                <Stack.Screen name="EduCartoonAI" component={EduCartoonAI} />
                <Stack.Screen name="StudentDetails" component={StudentDetails} />
                <Stack.Screen name="StudentList" component={StudentList} />
                
                {/* Hostel Management Screens for Admin */}
                <Stack.Screen name="HostelManagement" component={HostelManagement} />
                <Stack.Screen name="HostelDetailList" component={HostelDetailList} />
                <Stack.Screen name="HostelDetailView" component={HostelDetailView} />
                <Stack.Screen name="HostelRoomManagement" component={HostelRoomManagement} />
                <Stack.Screen name="HostelBedManagement" component={HostelBedManagement} />
                <Stack.Screen name="HostelMaintenanceManagement" component={HostelMaintenanceManagement} />
                <Stack.Screen name="HostelStudentManagement" component={HostelStudentManagement} />
                <Stack.Screen name="HostelApplications" component={HostelApplications} />
              </>
            )}
            {userType === 'teacher' && (
              <>
                <Stack.Screen name="TeacherTabs" component={TeacherTabNavigator} />
                <Stack.Screen name="TeacherTimetable" component={TeacherTimetable} />
                <Stack.Screen name="TeacherSubjects" component={TeacherSubjects} />
                <Stack.Screen name="ViewStudentInfo" component={ViewStudentInfo} />
                <Stack.Screen name="MarksEntryStudentsScreen" component={MarksEntryStudentsScreen} />
                <Stack.Screen name="StudentAttendanceScreen" component={StudentAttendanceScreen} />
                <Stack.Screen name="StudentMarksScreen" component={StudentMarksScreen} />
                <Stack.Screen name="ViewSubmissions" component={ViewSubmissions} />
                <Stack.Screen name="LeaveApplication" component={LeaveApplication} />
                <Stack.Screen name="TeacherNotifications" component={TeacherNotifications} />
                <Stack.Screen name="Profile" component={ProfileScreen} />
                <Stack.Screen name="Settings" component={SettingsScreen} />
                <Stack.Screen name="NotificationSettings" component={NotificationSettings} />
                <Stack.Screen name="EduCartoonAI" component={EduCartoonAI} />
              </>
            )}
            {userType === 'parent' && (
              <>
                <Stack.Screen name="StudentSelection" component={StudentSelectionScreen} />
                <Stack.Screen name="ParentTabs" component={ParentTabNavigator} />
                <Stack.Screen name="ParentQRPayment" component={ParentQRPayment} />
                <Stack.Screen name="ParentNotifications" component={Notifications} />
                <Stack.Screen name="ParentViewHomework" component={ParentViewHomework} />
                <Stack.Screen name="Profile" component={ProfileScreen} />
                <Stack.Screen name="Settings" component={SettingsScreen} />
                <Stack.Screen name="NotificationSettings" component={NotificationSettings} />
                <Stack.Screen name="EduCartoonAI" component={EduCartoonAI} />
              </>
            )}
            {userType === 'student' && (
              <>
                <Stack.Screen name="StudentTabs" component={StudentTabNavigator} />
                <Stack.Screen name="StudentNotifications" component={StudentNotifications} />
                <Stack.Screen name="TestNotifications" component={TestNotifications} />
                <Stack.Screen name="ScrollingDiagnostic" component={ScrollingDiagnostic} />
                <Stack.Screen name="StudentFeePayment" component={StudentFeePayment} />
                <Stack.Screen name="StudentQRPayment" component={StudentQRPayment} />
                <Stack.Screen name="Profile" component={ProfileScreen} />
                <Stack.Screen name="Settings" component={SettingsScreen} />
                <Stack.Screen name="NotificationSettings" component={NotificationSettings} />
                <Stack.Screen name="EduCartoonAI" component={EduCartoonAI} />
                <Stack.Screen name="StudentDetails" component={StudentDetails} />
              </>
            )}
            {userType === 'warden' && (
              <>
                <Stack.Screen name="WardenTabs" component={WardenTabNavigator} />
                <Stack.Screen name="HostelApplications" component={HostelApplications} />
                <Stack.Screen name="Profile" component={ProfileScreen} />
                <Stack.Screen name="Settings" component={SettingsScreen} />
                <Stack.Screen name="NotificationSettings" component={NotificationSettings} />
                <Stack.Screen name="EduCartoonAI" component={EduCartoonAI} />
                
                {/* Placeholder screens for future hostel features */}
                <Stack.Screen 
                  name="BedAllocations" 
                  component={WardenDashboard} 
                  options={{ title: 'Bed Allocations', headerShown: true }}
                />
                <Stack.Screen 
                  name="ManageHostels" 
                  component={WardenDashboard} 
                  options={{ title: 'Manage Hostels', headerShown: true }}
                />
                <Stack.Screen 
                  name="HostelDetails" 
                  component={WardenDashboard} 
                  options={{ title: 'Hostel Details', headerShown: true }}
                />
                <Stack.Screen 
                  name="ApplicationDetails" 
                  component={WardenDashboard} 
                  options={{ title: 'Application Details', headerShown: true }}
                />
                <Stack.Screen 
                  name="BedAllocation" 
                  component={WardenDashboard} 
                  options={{ title: 'Allocate Bed', headerShown: true }}
                />
                <Stack.Screen 
                  name="Waitlist" 
                  component={WardenDashboard} 
                  options={{ title: 'Waitlist', headerShown: true }}
                />
                <Stack.Screen 
                  name="Maintenance" 
                  component={WardenDashboard} 
                  options={{ title: 'Maintenance', headerShown: true }}
                />
                <Stack.Screen 
                  name="HostelReports" 
                  component={WardenDashboard} 
                  options={{ title: 'Reports', headerShown: true }}
                />
              </>
            )}
            
            {/* Fallback for when userType is not properly set */}
            {!userType && (
              <>
                <Stack.Screen name="Profile" component={ProfileScreen} />
              </>
            )}
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
} 