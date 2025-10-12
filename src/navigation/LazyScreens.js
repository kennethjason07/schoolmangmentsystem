// Lazy-loaded screens for better performance
import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';

// Loading fallback component
const LoadingFallback = ({ screenName }) => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#2196F3" />
    <Text style={styles.loadingText}>Loading {screenName}...</Text>
  </View>
);

// Core screens (loaded immediately)
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import LoadingScreen from '../screens/LoadingScreen';

// Lazy-loaded Admin screens
export const AdminDashboard = React.lazy(() => import('../screens/admin/AdminDashboard'));
export const ManageClasses = React.lazy(() => import('../screens/admin/ManageClasses'));
export const ManageStudents = React.lazy(() => import('../screens/admin/ManageStudents'));
export const ManageTeachers = React.lazy(() => import('../screens/admin/ManageTeachers'));
export const SubjectsTimetable = React.lazy(() => import('../screens/admin/SubjectsTimetable'));
export const ExamsMarks = React.lazy(() => import('../screens/admin/ExamsMarks'));
export const AdminMarksEntry = React.lazy(() => import('../screens/admin/MarksEntry'));
export const AttendanceManagement = React.lazy(() => import('../screens/admin/AttendanceManagement'));
export const FeeManagement = React.lazy(() => import('../screens/admin/FeeManagement'));
export const DiscountManagement = React.lazy(() => import('../screens/admin/DiscountManagement'));
export const AnalyticsReports = React.lazy(() => import('../screens/admin/AnalyticsReports'));
export const NotificationManagement = React.lazy(() => import('../screens/admin/NotificationManagement'));
export const ExpenseManagement = React.lazy(() => import('../screens/admin/ExpenseManagement'));
export const StationaryManagement = React.lazy(() => import('../screens/admin/StationaryManagement'));
export const StudentDetails = React.lazy(() => import('../screens/admin/StudentDetails'));
export const StudentList = React.lazy(() => import('../screens/admin/StudentList'));
export const TeacherDetails = React.lazy(() => import('../screens/admin/TeacherDetails'));
export const TeacherAccountManagement = React.lazy(() => import('../screens/admin/TeacherAccountManagement'));
export const StudentAccountManagement = React.lazy(() => import('../screens/admin/StudentAccountManagement'));
export const ParentAccountManagement = React.lazy(() => import('../screens/admin/ParentAccountManagement'));
export const LinkExistingParent = React.lazy(() => import('../screens/admin/LinkExistingParent'));
export const LeaveManagement = React.lazy(() => import('../screens/admin/LeaveManagement'));
export const AdminNotifications = React.lazy(() => import('../screens/admin/AdminNotifications'));
export const HallTicketGeneration = React.lazy(() => import('../screens/admin/HallTicketGeneration'));
export const AutoGrading = React.lazy(() => import('../screens/admin/AutoGrading'));
export const FeeClassDetails = React.lazy(() => import('../screens/admin/FeeClassDetails'));
export const ClassStudentDetails = React.lazy(() => import('../screens/admin/ClassStudentDetails'));
export const AssignTaskToTeacher = React.lazy(() => import('../screens/admin/AssignTaskToTeacher'));
export const SchoolDetails = React.lazy(() => import('../screens/admin/SchoolDetails'));

// Lazy-loaded Report screens
export const AttendanceReport = React.lazy(() => import('../screens/admin/reports/AttendanceReport'));
export const AttendanceRecordDetail = React.lazy(() => import('../screens/admin/reports/AttendanceRecordDetail'));
export const AcademicPerformance = React.lazy(() => import('../screens/admin/reports/AcademicPerformance'));
export const FeeCollection = React.lazy(() => import('../screens/admin/reports/FeeCollection'));

// Lazy-loaded Teacher screens
export const TeacherDashboard = React.lazy(() => import('../screens/teacher/TeacherDashboard'));
export const TeacherTimetable = React.lazy(() => import('../screens/teacher/TeacherTimetable'));
export const TakeAttendance = React.lazy(() => import('../screens/teacher/TakeAttendance'));
export const MarksEntry = React.lazy(() => import('../screens/teacher/MarksEntry'));
export const UploadHomework = React.lazy(() => import('../screens/teacher/UploadHomework'));
export const ViewStudentInfo = React.lazy(() => import('../screens/teacher/ViewStudentInfo'));
export const TeacherSubjects = React.lazy(() => import('../screens/teacher/TeacherSubjects'));
export const TeacherChat = React.lazy(() => import('../screens/teacher/TeacherChat'));
export const MarksEntryStudentsScreen = React.lazy(() => import('../screens/teacher/MarksEntryStudentsScreen'));
export const StudentAttendanceScreen = React.lazy(() => import('../screens/teacher/StudentAttendanceScreen'));
export const StudentMarksScreen = React.lazy(() => import('../screens/teacher/StudentMarksScreen'));
export const ViewSubmissions = React.lazy(() => import('../screens/teacher/ViewSubmissions'));
export const DatabaseSetup = React.lazy(() => import('../screens/teacher/DatabaseSetup'));
export const NotificationDebugScreen = React.lazy(() => import('../screens/teacher/NotificationDebugScreen'));
export const LeaveApplication = React.lazy(() => import('../screens/teacher/LeaveApplication'));
export const TeacherNotifications = React.lazy(() => import('../screens/teacher/TeacherNotifications'));

// Lazy-loaded Parent screens
export const ParentDashboard = React.lazy(() => import('../screens/parent/ParentDashboard'));
export const ViewReportCard = React.lazy(() => import('../screens/parent/ViewReportCard'));
export const AttendanceSummary = React.lazy(() => import('../screens/parent/AttendanceSummary'));
export const FeePayment = React.lazy(() => import('../screens/parent/FeePayment'));
export const Notifications = React.lazy(() => import('../screens/parent/Notifications'));
export const ChatWithTeacher = React.lazy(() => import('../screens/parent/ChatWithTeacher'));
export const StudentSelectionScreen = React.lazy(() => import('../screens/parent/StudentSelectionScreen'));
export const ParentViewHomework = React.lazy(() => import('../screens/parent/ParentViewHomework'));

// Lazy-loaded Student screens
export const StudentDashboard = React.lazy(() => import('../screens/student/StudentDashboard'));
export const ViewAssignments = React.lazy(() => import('../screens/student/ViewAssignments'));
export const StudentAttendanceMarks = React.lazy(() => import('../screens/student/StudentAttendanceMarks'));
export const StudentMarks = React.lazy(() => import('../screens/student/StudentMarks'));
export const StudentNotifications = React.lazy(() => import('../screens/student/StudentNotifications'));
export const StudentChatWithTeacher = React.lazy(() => import('../screens/student/StudentChatWithTeacher'));
export const StudentFeePayment = React.lazy(() => import('../screens/student/FeePayment'));
export const StudentQRPayment = React.lazy(() => import('../screens/student/StudentQRPayment'));

// Lazy-loaded Universal screens
export const ProfileScreen = React.lazy(() => import('../screens/universal/ProfileScreen'));
export const SettingsScreen = React.lazy(() => import('../screens/universal/SettingsScreen'));
export const NotificationSettings = React.lazy(() => import('../screens/universal/NotificationSettings'));

// Export auth screens directly (no lazy loading needed)
export { 
  LoginScreen, 
  SignupScreen, 
  ForgotPasswordScreen, 
  LoadingScreen 
};

// HOC to wrap lazy components with suspense and error boundary
export const withLazyLoading = (LazyComponent, screenName) => {
  return React.forwardRef((props, ref) => (
    <React.Suspense fallback={<LoadingFallback screenName={screenName} />}>
      <LazyComponent {...props} ref={ref} />
    </React.Suspense>
  ));
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
});
