# Leave Management System Integration Guide

This guide explains how to integrate the leave management system into your school management application.

## Overview

The leave management system allows:
- **Teachers** to apply for leave from their dashboard
- **Admins** to approve/reject leave applications and add leaves on behalf of teachers
- **Leave balance tracking** with automatic updates when leaves are approved
- **Replacement teacher assignment** during leave periods

## Database Setup

### 1. Run the Database Migration

Execute the SQL script to create the necessary tables:

```bash
# Execute the leave_management_schema.sql file in your PostgreSQL database
psql -d your_database_name -f leave_management_schema.sql
```

### 2. Initialize Leave Balances

After creating the tables, initialize leave balances for existing teachers:

```sql
-- Insert default leave balance for all teachers for current academic year
INSERT INTO public.teacher_leave_balance (teacher_id, academic_year)
SELECT id, EXTRACT(year FROM CURRENT_DATE)::text
FROM public.teachers
ON CONFLICT (teacher_id, academic_year) DO NOTHING;
```

## Frontend Integration

### 1. Admin Navigation

Add the Leave Management option to your admin navigation. In your admin dashboard or navigation file:

```javascript
// Example: Add to AdminDashboard.js navigation options
const adminMenuItems = [
  // ... existing items
  {
    title: 'Leave Management',
    icon: 'calendar',
    screen: 'LeaveManagement',
    description: 'Manage teacher leave applications'
  },
  // ... other items
];
```

### 2. Teacher Navigation

Add the Leave Application option to your teacher dashboard:

```javascript
// Example: Add to TeacherDashboard.js navigation options
const teacherMenuItems = [
  // ... existing items
  {
    title: 'Leave Application',
    icon: 'calendar-outline',
    screen: 'LeaveApplication',
    description: 'Apply for leave and view status'
  },
  // ... other items
];
```

### 3. Navigation Setup

Update your navigation files to include the new screens:

```javascript
// In AppNavigator.js or your main navigation file

// Import the screens
import LeaveManagement from '../screens/admin/LeaveManagement';
import LeaveApplication from '../screens/teacher/LeaveApplication';

// Add to your stack navigator
<Stack.Screen 
  name="LeaveManagement" 
  component={LeaveManagement}
  options={{ headerShown: false }}
/>
<Stack.Screen 
  name="LeaveApplication" 
  component={LeaveApplication}
  options={{ headerShown: false }}
/>
```

## Features Included

### Admin Features
- ✅ View all leave applications with filtering by status
- ✅ Approve/reject leave applications with remarks
- ✅ Add leave on behalf of teachers who don't have login
- ✅ Assign replacement teachers
- ✅ Leave balance overview
- ✅ Bulk operations support

### Teacher Features
- ✅ View leave balance for current academic year
- ✅ Apply for different types of leave
- ✅ View application history and status
- ✅ Leave balance validation before application
- ✅ Date range selection with automatic day calculation

### System Features
- ✅ Automatic leave balance updates on approval
- ✅ Database triggers for data integrity
- ✅ Audit trail with applied/reviewed timestamps
- ✅ Support for multiple leave types
- ✅ Replacement teacher tracking
- ✅ Academic year-based organization

## API Service Usage

The system includes a comprehensive API service. Here are some examples:

### Submit Leave Application
```javascript
import leaveService from '../services/leaveService';

const submitLeave = async (leaveData) => {
  const response = await leaveService.submitLeaveApplication(leaveData);
  if (response.success) {
    console.log('Leave submitted:', response.data);
  } else {
    console.error('Error:', response.message);
  }
};
```

### Get Leave Applications
```javascript
// Get all leaves for a teacher
const teacherLeaves = await leaveService.getLeaveApplications({
  teacher_id: 'teacher-uuid',
  status: 'Pending' // optional filter
});

// Get leaves for admin review
const pendingLeaves = await leaveService.getLeaveApplications({
  status: 'Pending'
});
```

### Update Leave Status
```javascript
const approveLeave = async (applicationId, remarks) => {
  const response = await leaveService.updateLeaveStatus(applicationId, {
    status: 'Approved',
    admin_remarks: remarks,
    replacement_teacher_id: 'replacement-teacher-uuid' // optional
  });
};
```

## Leave Types Supported

The system supports the following leave types:
- **Sick Leave** - Tracked against balance
- **Casual Leave** - Tracked against balance  
- **Earned Leave** - Tracked against balance
- **Maternity Leave** - Not tracked against balance
- **Paternity Leave** - Not tracked against balance
- **Emergency Leave** - Not tracked against balance
- **Personal Leave** - Not tracked against balance
- **Medical Leave** - Not tracked against balance
- **Other** - Not tracked against balance

## Default Leave Balances

The system sets default annual leave balances:
- **Sick Leave**: 12 days
- **Casual Leave**: 12 days
- **Earned Leave**: 20 days

These can be customized per teacher by updating the `teacher_leave_balance` table.

## Security & Permissions

- Teachers can only view and manage their own leave applications
- Admins can view and manage all leave applications
- Leave cancellation is only allowed for pending applications by the applicant
- All database operations include proper authentication checks

## Customization Options

### 1. Leave Types
Modify the `leaveTypes` array in the UI components to add/remove leave types.

### 2. Leave Balances
Update default balances by modifying the table schema or adding a configuration system.

### 3. Approval Workflow
The system supports a simple approve/reject workflow. For complex workflows, extend the status field and add additional approval levels.

### 4. Notifications
Integrate with your existing notification system to send alerts when:
- Leave applications are submitted
- Applications are approved/rejected
- Upcoming leaves need attention

## Dashboard Integration

You can add leave management widgets to your dashboards:

### Admin Dashboard
```javascript
// Add to admin stats
const leaveStats = await leaveService.getLeaveStatistics();
// Display pending applications count, upcoming leaves, etc.
```

### Teacher Dashboard
```javascript
// Show leave balance and recent applications
const balance = await leaveService.getTeacherLeaveBalance(teacherId);
const myLeaves = await leaveService.getLeaveApplications({ 
  teacher_id: teacherId, 
  limit: 5 
});
```

## Testing

After integration, test the following scenarios:

1. **Teacher Application Flow**
   - Teacher applies for leave
   - Leave balance is checked
   - Application appears in admin panel

2. **Admin Approval Flow**
   - Admin reviews application
   - Approves with replacement teacher
   - Leave balance is updated automatically

3. **Admin Add Leave Flow**
   - Admin adds leave for teacher without login
   - Leave is auto-approved
   - Replacement assignment works

4. **Edge Cases**
   - Apply for more days than available balance
   - Cancel pending applications
   - Conflicting date ranges

## Support

For issues or questions:
1. Check the database constraints and triggers
2. Verify foreign key relationships
3. Ensure proper user authentication
4. Review the leaveService.js for API methods

The system is designed to be robust and handle edge cases gracefully with proper error messages and validation.
