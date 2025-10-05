/**
 * Feature-Based Access Control Constants
 * 
 * This file maps all admin screens and features to their corresponding
 * permission keys in the tenant.features JSONB column.
 */

// Core feature keys that map to tenant.features in database
export const FEATURES = {
  // Special feature that grants access to all other features
  FEATURES_ALL: 'features-all',
  
  // Main navigation features
  STATIONARY_MANAGEMENT: 'stationary_management',
  FEE_MANAGEMENT: 'fee_management',
  STUDENT_MANAGEMENT: 'student_management', 
  TEACHER_MANAGEMENT: 'teacher_management',
  CLASS_MANAGEMENT: 'class_management',
  ANALYTICS_REPORTS: 'analytics_reports',
  
  // Quick action features
  SCHOOL_DETAILS: 'school_details',
  TEACHER_ACCOUNTS: 'teacher_accounts',
  STUDENT_ACCOUNTS: 'student_accounts',
  PARENT_ACCOUNTS: 'parent_accounts',
  LEAVE_MANAGEMENT: 'leave_management',
  SUBJECTS_TIMETABLE: 'subjects_timetable',
  ATTENDANCE_MANAGEMENT: 'attendance_management',
  EXPENSE_MANAGEMENT: 'expense_management',
  EXAMS_MARKS: 'exams_marks',
  REPORT_CARDS: 'report_cards',
  NOTIFICATION_MANAGEMENT: 'notification_management',
  STUDY_CERTIFICATE: 'study_certificate',
  HALL_TICKET_GENERATION: 'hall_ticket_generation',
  AUTO_GRADING: 'auto_grading',
  
  // Additional screen features
  DISCOUNT_MANAGEMENT: 'discount_management',
  MARKS_ENTRY: 'marks_entry',
  PENDING_UPI_PAYMENTS: 'pending_upi_payments',
  TASKS_MANAGEMENT: 'tasks_management',
  
  // Legacy features (for backward compatibility)
  FEES: 'fees',
  EXAMS: 'exams',
  MESSAGING: 'messaging',
  ATTENDANCE: 'attendance'
};

// Screen to feature mapping - maps React Navigation screen names to feature keys
export const SCREEN_FEATURE_MAP = {
  // Main Admin Screens
  'StationaryManagement': FEATURES.STATIONARY_MANAGEMENT,
  'FeeManagement': FEATURES.FEE_MANAGEMENT,
  'ManageStudents': FEATURES.STUDENT_MANAGEMENT,
  'ManageTeachers': FEATURES.TEACHER_MANAGEMENT,
  'ManageClasses': FEATURES.CLASS_MANAGEMENT,
  'AnalyticsReports': FEATURES.ANALYTICS_REPORTS,
  
  // Quick Action Screens
  'SchoolDetails': FEATURES.SCHOOL_DETAILS,
  'TeacherAccountManagement': FEATURES.TEACHER_ACCOUNTS,
  'StudentAccountManagement': FEATURES.STUDENT_ACCOUNTS,
  'ParentAccountManagement': FEATURES.PARENT_ACCOUNTS,
  'LeaveManagement': FEATURES.LEAVE_MANAGEMENT,
  'SubjectsTimetable': FEATURES.SUBJECTS_TIMETABLE,
  'AttendanceManagement': FEATURES.ATTENDANCE_MANAGEMENT,
  'ExpenseManagement': FEATURES.EXPENSE_MANAGEMENT,
  'ExamsMarks': FEATURES.EXAMS_MARKS,
  'ReportCardGeneration': FEATURES.REPORT_CARDS,
  'NotificationManagement': FEATURES.NOTIFICATION_MANAGEMENT,
  'HallTicketGeneration': FEATURES.HALL_TICKET_GENERATION,
  'AutoGrading': FEATURES.AUTO_GRADING,
  
  // Additional Screens
  'DiscountManagement': FEATURES.DISCOUNT_MANAGEMENT,
  'MarksEntry': FEATURES.MARKS_ENTRY,
  'AdminMarksEntry': FEATURES.MARKS_ENTRY,
  'PendingUPIPayments': FEATURES.PENDING_UPI_PAYMENTS,
  'AssignTaskToTeacher': FEATURES.TASKS_MANAGEMENT,
  'TasksManagement': FEATURES.TASKS_MANAGEMENT,
  
  // Stack screens with specific features
  'StudentDetails': FEATURES.STUDENT_MANAGEMENT,
  'StudentList': FEATURES.STUDENT_MANAGEMENT,
  'TeacherDetails': FEATURES.TEACHER_MANAGEMENT,
  'LinkExistingParent': FEATURES.PARENT_ACCOUNTS,
  'AdminNotifications': FEATURES.NOTIFICATION_MANAGEMENT,
  'FeeClassDetails': FEATURES.FEE_MANAGEMENT,
  'ClassStudentDetails': FEATURES.CLASS_MANAGEMENT,
  'FeeTestingPanel': FEATURES.FEE_MANAGEMENT,
  'MarksManagement': FEATURES.MARKS_ENTRY,
  'TenantManagement': FEATURES.SCHOOL_DETAILS, // Admin-only feature
  
  // Tab navigation features  
  'Classes': FEATURES.CLASS_MANAGEMENT,
  'Students': FEATURES.STUDENT_MANAGEMENT,
  'Teachers': FEATURES.TEACHER_MANAGEMENT,
  'Reports': FEATURES.ANALYTICS_REPORTS
};

// Quick action to feature mapping (for AdminDashboard quick actions)
export const QUICK_ACTION_FEATURE_MAP = {
  'School Details': FEATURES.SCHOOL_DETAILS,
  'Manage Teachers': FEATURES.TEACHER_MANAGEMENT,
  'Teacher Accounts': FEATURES.TEACHER_ACCOUNTS,
  'Student Accounts': FEATURES.STUDENT_ACCOUNTS,
  'Parent Accounts': FEATURES.PARENT_ACCOUNTS,
  'Leave Management': FEATURES.LEAVE_MANAGEMENT,
  'Subjects Timetable': FEATURES.SUBJECTS_TIMETABLE,
  'Attendance': FEATURES.ATTENDANCE_MANAGEMENT,
  'Fee Management': FEATURES.FEE_MANAGEMENT,
  'Stationary Management': FEATURES.STATIONARY_MANAGEMENT,
  'Expense Management': FEATURES.EXPENSE_MANAGEMENT,
  'Exams & Marks': FEATURES.EXAMS_MARKS,
  'Report Cards': FEATURES.REPORT_CARDS,
  'Notifications': FEATURES.NOTIFICATION_MANAGEMENT,
  'Study Certificate': FEATURES.STUDY_CERTIFICATE,
  'Hall Tickets': FEATURES.HALL_TICKET_GENERATION,
  'Auto Grading': FEATURES.AUTO_GRADING
};

// Default feature permissions (all disabled by default for security)
export const DEFAULT_FEATURES = {
  [FEATURES.FEATURES_ALL]: false, // Special feature that grants access to all others
  [FEATURES.STATIONARY_MANAGEMENT]: false,
  [FEATURES.FEE_MANAGEMENT]: false,
  [FEATURES.STUDENT_MANAGEMENT]: false,
  [FEATURES.TEACHER_MANAGEMENT]: false,
  [FEATURES.CLASS_MANAGEMENT]: false,
  [FEATURES.ANALYTICS_REPORTS]: false,
  [FEATURES.SCHOOL_DETAILS]: false,
  [FEATURES.TEACHER_ACCOUNTS]: false,
  [FEATURES.STUDENT_ACCOUNTS]: false,
  [FEATURES.PARENT_ACCOUNTS]: false,
  [FEATURES.LEAVE_MANAGEMENT]: false,
  [FEATURES.SUBJECTS_TIMETABLE]: false,
  [FEATURES.ATTENDANCE_MANAGEMENT]: false,
  [FEATURES.EXPENSE_MANAGEMENT]: false,
  [FEATURES.EXAMS_MARKS]: false,
  [FEATURES.REPORT_CARDS]: false,
  [FEATURES.NOTIFICATION_MANAGEMENT]: false,
  [FEATURES.STUDY_CERTIFICATE]: false,
  [FEATURES.HALL_TICKET_GENERATION]: false,
  [FEATURES.AUTO_GRADING]: false,
  [FEATURES.DISCOUNT_MANAGEMENT]: false,
  [FEATURES.MARKS_ENTRY]: false,
  [FEATURES.PENDING_UPI_PAYMENTS]: false,
  [FEATURES.TASKS_MANAGEMENT]: false,
  [FEATURES.FEES]: false,
  [FEATURES.EXAMS]: false,
  [FEATURES.MESSAGING]: false,
  [FEATURES.ATTENDANCE]: false
};

// Helper function to get feature key for a screen
export const getFeatureForScreen = (screenName) => {
  return SCREEN_FEATURE_MAP[screenName] || null;
};

// Helper function to get feature key for a quick action
export const getFeatureForQuickAction = (actionTitle) => {
  return QUICK_ACTION_FEATURE_MAP[actionTitle] || null;
};

// Helper function to check if a feature exists
export const isValidFeature = (featureKey) => {
  return Object.values(FEATURES).includes(featureKey);
};

// Helper function to check if a feature is the special "all features" feature
export const isFeaturesAll = (featureKey) => {
  return featureKey === FEATURES.FEATURES_ALL;
};

// Helper function to get all regular features (excluding features-all)
export const getAllRegularFeatures = () => {
  return Object.values(FEATURES).filter(feature => feature !== FEATURES.FEATURES_ALL);
};

export default {
  FEATURES,
  SCREEN_FEATURE_MAP,
  QUICK_ACTION_FEATURE_MAP,
  DEFAULT_FEATURES,
  getFeatureForScreen,
  getFeatureForQuickAction,
  isValidFeature,
  isFeaturesAll,
  getAllRegularFeatures
};
