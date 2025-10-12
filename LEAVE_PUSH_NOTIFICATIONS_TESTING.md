# Leave Request Push Notifications - Testing Guide

## 🎆 Overview

I've implemented push notifications throughout the system using the **same working approach** as your Test Push Notifications screen. Now users will receive actual push notifications on their devices for:

1. **Leave Requests** - Admin gets notified when teachers submit leave requests
2. **Leave Status Updates** - Teachers get notified when admin approves/rejects their requests  
3. **Admin Notifications** - All users get push notifications when admin creates notifications through Notification Management screen

## 📱 What's Been Implemented

### **For Admin Users** (when teachers submit leave requests):
- **Title**: "New Leave Request"  
- **Message**: "[Teacher Name] has submitted a [Leave Type] request ([Start Date] to [End Date])"
- **Priority**: High
- **Color**: Orange (#FF9800)

### **For Teachers** (when admins approve/reject their requests):
- **Title**: "Leave Request Approved" / "Leave Request Rejected"
- **Message**: "Your [Leave Type] request has been approved/rejected"
- **Priority**: High (Rejected = Urgent)
- **Color**: Green (Approved) / Red (Rejected)

### **For All Users** (when admin creates notifications through Notification Management):
- **Title**: Based on notification type (e.g., "⚠️ Urgent Notice", "📅 School Event")
- **Message**: Admin's custom message (truncated to 100 chars)
- **Priority**: High (Urgent = Max Priority)
- **Color**: Based on notification type
- **Recipients**: Students and Parents (as selected by admin)

## 🧪 Testing Components Created

### 1. **LeaveNotificationTester** (for Admin screens)
```javascript
import LeaveNotificationTester from '../../components/LeaveNotificationTester';

// Add to your AdminNotifications.js or AdminDashboard.js:
<LeaveNotificationTester />
```

### 2. **TeacherLeaveNotificationTester** (for Teacher screens)
```javascript
import TeacherLeaveNotificationTester from '../../components/TeacherLeaveNotificationTester';

// Add to your Teacher screen (LeaveApplication.js, TeacherDashboard.js, etc.):
<TeacherLeaveNotificationTester />
```

### 3. **AdminNotificationTester** (for testing admin notification management)
```javascript
import AdminNotificationTester from '../../components/AdminNotificationTester';

// Add to your AdminNotifications.js or NotificationManagement.js screen:
<AdminNotificationTester />
```

## 🚀 How to Test

### **Method 1: Use Test Components (Recommended)**

#### **Admin Testing:**
1. Add `<LeaveNotificationTester />` to your admin screen
2. Press "Run Leave Notification Test"
3. Check your admin devices for push notifications

#### **Teacher Testing:**
1. Add `<TeacherLeaveNotificationTester />` to your teacher screen
2. Press "Test Approved Notification" or "Test Rejected Notification"
3. Check your teacher device for push notifications

#### **Admin Notification Management Testing:**
1. Add `<AdminNotificationTester />` to your admin notification screen
2. Press "Check System Status" to verify system readiness
3. Press "Test General", "Test Urgent", or "Test Event" to create test notifications
4. Check student/parent devices for push notifications

### **Method 2: Real-world Testing**

#### **Test Admin Notifications:**
1. Login as a teacher
2. Go to Leave Application screen
3. Submit a leave request
4. **Admin devices should receive push notification**

#### **Test Teacher Notifications:**
1. Login as admin
2. Go to Leave Management screen
3. Approve or reject a pending leave request
4. **Teacher device should receive push notification**

#### **Test Admin Notification Management:**
1. Login as admin
2. Go to Notification Management screen  
3. Create a new notification (select Students/Parents as recipients)
4. **Student/Parent devices should receive push notifications**
5. Try "Resend" feature on existing notifications
6. **Devices should receive push notifications again**

## 🔧 Technical Implementation

The notifications now use the **same exact approach** as your working Test Push Notifications:

1. **Database**: Creates notification and notification_recipients records
2. **Real-time**: Broadcasts updates via UniversalNotificationService  
3. **Push Notifications**: Uses Expo Push API directly (same as test screen)

### **Key Changes Made:**
- ✅ Replaced `PushNotificationService` with direct Expo Push API calls
- ✅ Uses same token fetching logic as working test notifications
- ✅ Same notification formatting and error handling
- ✅ Proper tenant validation and filtering

## 📋 Requirements

### **For Push Notifications to Work:**

✅ **Users must have:**
- Active push tokens in `push_tokens` table
- Physical devices (not Expo Go for SDK 53+)
- Notifications enabled in device settings

✅ **Test the system first:**
- Use "Test Push Notifications" screen to verify basic functionality
- If test notifications work, leave notifications should also work

## 🐛 Troubleshooting

### **If Push Notifications Don't Work:**

1. **Check Test Push Notifications first**
   - Go to Admin → Test Push Notifications
   - Send test notification to verify system works

2. **Check push tokens**
   - Query `push_tokens` table for active tokens
   - Ensure users have `is_active = true` tokens

3. **Check console logs**
   - Look for `[LEAVE REQUEST]` logs for admin notifications
   - Look for `[LEAVE STATUS]` logs for teacher notifications
   - Check Expo Push API response logs

4. **Verify database records**
   - Check `notifications` table for new records
   - Check `notification_recipients` table for proper recipients

## 🎉 Expected Results

### **When Testing:**
- ✅ Console logs showing successful API calls
- ✅ Push notifications appearing on devices
- ✅ In-app notifications in notification screens
- ✅ Real-time badge updates

### **Success Indicators:**
- Console shows: "Push notifications sent successfully to X device(s)"
- Device receives actual push notification
- In-app notification appears in user's notification list
- Notification badge updates in real-time

## 📞 Support

If notifications still don't work after testing:

1. Check that test push notifications work first
2. Verify user has active push tokens
3. Ensure device allows notifications for the app
4. Check console logs for detailed error messages

The implementation now matches your working test push notification system exactly, so it should work reliably!