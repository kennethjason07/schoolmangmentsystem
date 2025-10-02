import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, ActivityIndicator, Platform } from 'react-native';

// Core imports (loaded immediately)
import { useAuth } from '../utils/AuthContext';
import MessageBadge from '../components/MessageBadge';
import UniversalNotificationBadge from '../components/UniversalNotificationBadge';
import ChatBadge from '../components/ChatBadge';
import InAppNotificationBanner from '../components/InAppNotificationBanner';
import { navigationRef } from '../services/NavigationService';

// Import lazy screens
import * as LazyScreens from './LazyScreens';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Admin Tab Navigator with lazy loading
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
        component={LazyScreens.withLazyLoading(LazyScreens.AdminDashboard, 'Admin Dashboard')}
        options={{ tabBarLabel: 'Dashboard' }}
      />
      <Tab.Screen 
        name="Classes" 
        component={LazyScreens.withLazyLoading(LazyScreens.ManageClasses, 'Classes')} 
      />
      <Tab.Screen 
        name="Students" 
        component={LazyScreens.withLazyLoading(LazyScreens.ManageStudents, 'Students')} 
      />
      <Tab.Screen
        name="Teachers"
        component={LazyScreens.withLazyLoading(LazyScreens.ManageTeachers, 'Teachers')}
        options={{ tabBarLabel: 'Teachers' }}
      />
      <Tab.Screen 
        name="Reports" 
        component={LazyScreens.withLazyLoading(LazyScreens.AnalyticsReports, 'Reports')} 
      />
    </Tab.Navigator>
  );
}

// Teacher Tab Navigator with lazy loading
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
        component={LazyScreens.withLazyLoading(LazyScreens.TeacherDashboard, 'Teacher Dashboard')}
        options={{ tabBarLabel: 'Dashboard' }}
      />
      <Tab.Screen 
        name="Attendance" 
        component={LazyScreens.withLazyLoading(LazyScreens.TakeAttendance, 'Attendance')} 
      />
      <Tab.Screen 
        name="Marks" 
        component={LazyScreens.withLazyLoading(LazyScreens.MarksEntry, 'Marks')} 
      />
      <Tab.Screen 
        name="Homework" 
        component={LazyScreens.withLazyLoading(LazyScreens.UploadHomework, 'Homework')} 
      />
      <Tab.Screen 
        name="Chat" 
        component={LazyScreens.withLazyLoading(LazyScreens.TeacherChat, 'Chat')} 
      />
    </Tab.Navigator>
  );
}

// Parent Tab Navigator with lazy loading
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
        component={LazyScreens.withLazyLoading(LazyScreens.ParentDashboard, 'Parent Dashboard')}
        options={{ tabBarLabel: 'Dashboard' }}
      />
      <Tab.Screen 
        name="Attendance" 
        component={LazyScreens.withLazyLoading(LazyScreens.AttendanceSummary, 'Attendance')} 
      />
      <Tab.Screen 
        name="Marks" 
        component={LazyScreens.withLazyLoading(LazyScreens.ViewReportCard, 'Report Card')} 
        options={{ tabBarLabel: 'Marks' }} 
      />
      <Tab.Screen 
        name="Fees" 
        component={LazyScreens.withLazyLoading(LazyScreens.FeePayment, 'Fee Payment')} 
      />
      <Tab.Screen 
        name="Chat" 
        component={LazyScreens.withLazyLoading(LazyScreens.ChatWithTeacher, 'Chat')} 
      />
    </Tab.Navigator>
  );
}

// Student Tab Navigator with lazy loading
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
        component={LazyScreens.withLazyLoading(LazyScreens.StudentDashboard, 'Student Dashboard')}
        options={{ tabBarLabel: 'Dashboard' }}
      />
      <Tab.Screen 
        name="Assignments" 
        component={LazyScreens.withLazyLoading(LazyScreens.ViewAssignments, 'Assignments')} 
      />
      <Tab.Screen
        name="Attendance"
        component={LazyScreens.withLazyLoading(LazyScreens.StudentAttendanceMarks, 'Attendance')}
        initialParams={{ defaultTab: 'attendance' }}
      />
      <Tab.Screen 
        name="Marks" 
        component={LazyScreens.withLazyLoading(LazyScreens.StudentMarks, 'Marks')} 
      />
      <Tab.Screen 
        name="Chat" 
        component={LazyScreens.withLazyLoading(LazyScreens.StudentChatWithTeacher, 'Chat')} 
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, userType, loading } = useAuth();

  // Web-specific debugging
  if (Platform.OS === 'web') {
    console.log('🌐 Optimized AppNavigator - Current state:', {
      user: !!user,
      userType,
      loading,
      timestamp: new Date().toISOString()
    });
  }

  // Show loading screen while checking authentication
  if (loading) {
    console.log('🔄 Showing loading screen, loading state:', loading);
    return <LazyScreens.LoadingScreen />;
  }

  console.log('🚀 Optimized AppNavigator - Final navigation decision:', {
    authenticated: !!user,
    userType,
    willShowAuthStack: !user,
    willShowUserStack: !!user
  });

  return (
    <NavigationContainer ref={navigationRef}>
      <InAppNotificationBanner />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          // Auth Stack - when user is not authenticated
          <>
            <Stack.Screen name="Login" component={LazyScreens.LoginScreen} />
            <Stack.Screen name="Signup" component={LazyScreens.SignupScreen} />
            <Stack.Screen name="ForgotPassword" component={LazyScreens.ForgotPasswordScreen} />
          </>
        ) : (
          // Role-based Stacks - when user is authenticated (with lazy loading)
          <>
            {userType === 'admin' && (
              <>
                <Stack.Screen name="AdminTabs" component={AdminTabNavigator} />
                <Stack.Screen 
                  name="SchoolDetails" 
                  component={LazyScreens.withLazyLoading(LazyScreens.SchoolDetails, 'School Details')} 
                />
                <Stack.Screen 
                  name="SubjectsTimetable" 
                  component={LazyScreens.withLazyLoading(LazyScreens.SubjectsTimetable, 'Subjects & Timetable')} 
                />
                <Stack.Screen 
                  name="ExamsMarks" 
                  component={LazyScreens.withLazyLoading(LazyScreens.ExamsMarks, 'Exams & Marks')} 
                />
                <Stack.Screen 
                  name="AdminMarksEntry" 
                  component={LazyScreens.withLazyLoading(LazyScreens.AdminMarksEntry, 'Marks Entry')} 
                />
                <Stack.Screen 
                  name="AttendanceManagement" 
                  component={LazyScreens.withLazyLoading(LazyScreens.AttendanceManagement, 'Attendance Management')} 
                />
                <Stack.Screen 
                  name="FeeManagement" 
                  component={LazyScreens.withLazyLoading(LazyScreens.FeeManagement, 'Fee Management')} 
                />
                <Stack.Screen 
                  name="DiscountManagement" 
                  component={LazyScreens.withLazyLoading(LazyScreens.DiscountManagement, 'Discount Management')} 
                />
                <Stack.Screen 
                  name="NotificationManagement" 
                  component={LazyScreens.withLazyLoading(LazyScreens.NotificationManagement, 'Notification Management')} 
                />
                <Stack.Screen 
                  name="ExpenseManagement" 
                  component={LazyScreens.withLazyLoading(LazyScreens.ExpenseManagement, 'Expense Management')} 
                />
                <Stack.Screen 
                  name="StationaryManagement" 
                  component={LazyScreens.withLazyLoading(LazyScreens.StationaryManagement, 'Stationary Management')} 
                />
                <Stack.Screen 
                  name="StudentDetails" 
                  component={LazyScreens.withLazyLoading(LazyScreens.StudentDetails, 'Student Details')} 
                />
                <Stack.Screen 
                  name="StudentList" 
                  component={LazyScreens.withLazyLoading(LazyScreens.StudentList, 'Student List')} 
                />
                <Stack.Screen 
                  name="TeacherDetails" 
                  component={LazyScreens.withLazyLoading(LazyScreens.TeacherDetails, 'Teacher Details')} 
                />
                <Stack.Screen 
                  name="TeacherAccountManagement" 
                  component={LazyScreens.withLazyLoading(LazyScreens.TeacherAccountManagement, 'Teacher Account Management')} 
                />
                <Stack.Screen 
                  name="StudentAccountManagement" 
                  component={LazyScreens.withLazyLoading(LazyScreens.StudentAccountManagement, 'Student Account Management')} 
                />
                <Stack.Screen 
                  name="ParentAccountManagement" 
                  component={LazyScreens.withLazyLoading(LazyScreens.ParentAccountManagement, 'Parent Account Management')} 
                />
                <Stack.Screen 
                  name="LinkExistingParent" 
                  component={LazyScreens.withLazyLoading(LazyScreens.LinkExistingParent, 'Link Existing Parent')} 
                />
                <Stack.Screen 
                  name="LeaveManagement" 
                  component={LazyScreens.withLazyLoading(LazyScreens.LeaveManagement, 'Leave Management')} 
                />
                <Stack.Screen 
                  name="AdminNotifications" 
                  component={LazyScreens.withLazyLoading(LazyScreens.AdminNotifications, 'Admin Notifications')} 
                />
                <Stack.Screen 
                  name="HallTicketGeneration" 
                  component={LazyScreens.withLazyLoading(LazyScreens.HallTicketGeneration, 'Hall Ticket Generation')} 
                />
                <Stack.Screen 
                  name="AutoGrading" 
                  component={LazyScreens.withLazyLoading(LazyScreens.AutoGrading, 'Auto Grading')} 
                />
                <Stack.Screen 
                  name="FeeClassDetails" 
                  component={LazyScreens.withLazyLoading(LazyScreens.FeeClassDetails, 'Fee Class Details')} 
                />
                <Stack.Screen 
                  name="ClassStudentDetails" 
                  component={LazyScreens.withLazyLoading(LazyScreens.ClassStudentDetails, 'Class Student Details')} 
                />
                <Stack.Screen 
                  name="AssignTaskToTeacher" 
                  component={LazyScreens.withLazyLoading(LazyScreens.AssignTaskToTeacher, 'Assign Task to Teacher')} 
                />
                <Stack.Screen 
                  name="AttendanceReport" 
                  component={LazyScreens.withLazyLoading(LazyScreens.AttendanceReport, 'Attendance Report')} 
                />
                <Stack.Screen 
                  name="AttendanceRecordDetail" 
                  component={LazyScreens.withLazyLoading(LazyScreens.AttendanceRecordDetail, 'Attendance Record Detail')} 
                />
                <Stack.Screen 
                  name="AcademicPerformance" 
                  component={LazyScreens.withLazyLoading(LazyScreens.AcademicPerformance, 'Academic Performance')} 
                />
                <Stack.Screen 
                  name="FeeCollection" 
                  component={LazyScreens.withLazyLoading(LazyScreens.FeeCollection, 'Fee Collection')} 
                />
                <Stack.Screen 
                  name="ReportCardGeneration" 
                  component={LazyScreens.withLazyLoading(LazyScreens.ReportCardGeneration, 'Report Card Generation')} 
                />
              </>
            )}

            {userType === 'teacher' && (
              <>
                <Stack.Screen name="TeacherTabs" component={TeacherTabNavigator} />
                <Stack.Screen 
                  name="TeacherTimetable" 
                  component={LazyScreens.withLazyLoading(LazyScreens.TeacherTimetable, 'Teacher Timetable')} 
                />
                <Stack.Screen 
                  name="ViewStudentInfo" 
                  component={LazyScreens.withLazyLoading(LazyScreens.ViewStudentInfo, 'View Student Info')} 
                />
                <Stack.Screen 
                  name="TeacherSubjects" 
                  component={LazyScreens.withLazyLoading(LazyScreens.TeacherSubjects, 'Teacher Subjects')} 
                />
                <Stack.Screen 
                  name="MarksEntryStudentsScreen" 
                  component={LazyScreens.withLazyLoading(LazyScreens.MarksEntryStudentsScreen, 'Marks Entry Students')} 
                />
                <Stack.Screen 
                  name="StudentAttendanceScreen" 
                  component={LazyScreens.withLazyLoading(LazyScreens.StudentAttendanceScreen, 'Student Attendance')} 
                />
                <Stack.Screen 
                  name="StudentMarksScreen" 
                  component={LazyScreens.withLazyLoading(LazyScreens.StudentMarksScreen, 'Student Marks')} 
                />
                <Stack.Screen 
                  name="ViewSubmissions" 
                  component={LazyScreens.withLazyLoading(LazyScreens.ViewSubmissions, 'View Submissions')} 
                />
                <Stack.Screen 
                  name="DatabaseSetup" 
                  component={LazyScreens.withLazyLoading(LazyScreens.DatabaseSetup, 'Database Setup')} 
                />
                <Stack.Screen 
                  name="NotificationDebugScreen" 
                  component={LazyScreens.withLazyLoading(LazyScreens.NotificationDebugScreen, 'Notification Debug')} 
                />
                <Stack.Screen 
                  name="LeaveApplication" 
                  component={LazyScreens.withLazyLoading(LazyScreens.LeaveApplication, 'Leave Application')} 
                />
                <Stack.Screen 
                  name="TeacherNotifications" 
                  component={LazyScreens.withLazyLoading(LazyScreens.TeacherNotifications, 'Teacher Notifications')} 
                />
              </>
            )}

            {userType === 'parent' && (
              <>
                <Stack.Screen 
                  name="StudentSelection" 
                  component={LazyScreens.withLazyLoading(LazyScreens.StudentSelectionScreen, 'Student Selection')} 
                />
                <Stack.Screen name="ParentTabs" component={ParentTabNavigator} />
                <Stack.Screen 
                  name="ParentViewHomework" 
                  component={LazyScreens.withLazyLoading(LazyScreens.ParentViewHomework, 'Parent View Homework')} 
                />
                <Stack.Screen 
                  name="Notifications" 
                  component={LazyScreens.withLazyLoading(LazyScreens.Notifications, 'Notifications')} 
                />
              </>
            )}

            {userType === 'student' && (
              <>
                <Stack.Screen name="StudentTabs" component={StudentTabNavigator} />
                <Stack.Screen 
                  name="StudentNotifications" 
                  component={LazyScreens.withLazyLoading(LazyScreens.StudentNotifications, 'Student Notifications')} 
                />
                <Stack.Screen 
                  name="StudentFeePayment" 
                  component={LazyScreens.withLazyLoading(LazyScreens.StudentFeePayment, 'Student Fee Payment')} 
                />
                <Stack.Screen 
                  name="StudentQRPayment" 
                  component={LazyScreens.withLazyLoading(LazyScreens.StudentQRPayment, 'Student QR Payment')} 
                />
              </>
            )}

            {/* Universal screens available to all authenticated users */}
            <Stack.Screen 
              name="ProfileScreen" 
              component={LazyScreens.withLazyLoading(LazyScreens.ProfileScreen, 'Profile')} 
            />
            <Stack.Screen 
              name="SettingsScreen" 
              component={LazyScreens.withLazyLoading(LazyScreens.SettingsScreen, 'Settings')} 
            />
            <Stack.Screen 
              name="NotificationSettings" 
              component={LazyScreens.withLazyLoading(LazyScreens.NotificationSettings, 'Notification Settings')} 
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
