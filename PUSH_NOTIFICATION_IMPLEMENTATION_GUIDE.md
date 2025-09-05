# 📱 Push Notification Implementation Guide - WhatsApp Style

## 🎯 Overview

This guide implements a comprehensive push notification system for your school management app, similar to WhatsApp's notification experience. The system includes:

- ✅ **Push Notifications** - Background & foreground notifications
- ✅ **In-App Banners** - WhatsApp-style notification banners  
- ✅ **Real-time Updates** - Instant badge count updates
- ✅ **User Settings** - Comprehensive notification preferences
- ✅ **Smart Routing** - Automatic navigation to relevant screens
- ✅ **Multi-platform** - iOS, Android, and Web support

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npx expo install expo-notifications expo-device expo-constants
npm install @react-native-async-storage/async-storage
npm install @react-native-community/datetimepicker
npm install react-native-safe-area-context
```

### 2. Database Setup

Run the SQL schema in your Supabase database:

```bash
# Execute the SQL file in Supabase SQL Editor
cat push_notification_schema.sql
```

### 3. App Configuration

Update your `app.json` with the notification configuration from `app_notification_config.json`.

### 4. Initialize Push Notifications

Add to your main App component or AuthContext:

```javascript
import pushNotificationService from './src/services/PushNotificationService';
import { navigationService } from './src/services/NavigationService';

// In your AuthContext or App.js, after successful login:
useEffect(() => {
  if (user && userType) {
    // Initialize push notifications
    pushNotificationService.initialize(user.id, userType);
    
    // Set user type in navigation service
    navigationService.setCurrentUserType(userType);
  }
}, [user, userType]);

// On logout:
const signOut = async () => {
  if (user) {
    await pushNotificationService.deactivateTokens(user.id);
    pushNotificationService.cleanup();
  }
  // ... rest of logout logic
};
```

## 📋 Implementation Steps

### Step 1: Core Services ✅

- ✅ `PushNotificationService.js` - Main push notification service
- ✅ `NavigationService.js` - Navigation handling for notifications  
- ✅ `UniversalNotificationService.js` - Badge count service (already implemented)

### Step 2: UI Components ✅

- ✅ `InAppNotificationBanner.js` - WhatsApp-style notification banners
- ✅ `NotificationSettings.js` - User notification preferences screen
- ✅ `UniversalNotificationBadge.js` - Universal notification badges (already implemented)

### Step 3: Database Integration ✅

- ✅ Database schema for push tokens, settings, and logs
- ✅ Row Level Security (RLS) policies
- ✅ Automatic settings creation for new users

### Step 4: Navigation Integration ✅

- ✅ Updated `AppNavigator.js` with notification components
- ✅ Global navigation reference setup
- ✅ In-app banner integration

## 🔧 Configuration

### Expo Project ID Setup

In `PushNotificationService.js`, replace the project ID:

```javascript
const tokenData = await Notifications.getExpoPushTokenAsync({
  projectId: 'your-actual-expo-project-id', // Replace this
});
```

### App.json Configuration

Copy the configuration from `app_notification_config.json` to your `app.json` and update:

1. Replace all placeholder values with actual IDs
2. Add your Supabase URL and keys
3. Configure proper bundle identifiers
4. Add custom notification sounds (optional)

## 📱 Usage Examples

### Sending Chat Message Notifications

```javascript
import pushNotificationService from './src/services/PushNotificationService';

// When sending a chat message
const sendMessage = async (receiverId, message) => {
  // Save message to database first
  const { error } = await supabase
    .from('messages')
    .insert({
      sender_id: user.id,
      receiver_id: receiverId,
      message: message,
      is_read: false
    });

  if (!error) {
    // Send push notification
    await pushNotificationService.sendChatMessageNotification({
      receiverId,
      receiverType: 'parent', // or 'teacher', 'student', 'admin'
      senderId: user.id,
      senderName: user.full_name,
      senderType: user.userType,
      message,
      messageType: 'text'
    });
  }
};
```

### Sending Formal Notifications

```javascript
// When creating formal notifications (exam alerts, attendance, etc.)
const sendExamNotification = async (studentIds, examDetails) => {
  // Create notification in database first
  const { error } = await supabase
    .from('notifications')
    .insert({
      title: 'Upcoming Exam',
      message: `Exam: ${examDetails.subject} on ${examDetails.date}`,
      type: 'exam_alert'
    });

  if (!error) {
    // Send push notifications to all students
    await pushNotificationService.sendFormalNotification({
      recipientIds: studentIds,
      recipientType: 'student',
      title: 'Upcoming Exam',
      message: `Exam: ${examDetails.subject} on ${examDetails.date}`,
      type: 'exam_alert',
      priority: 'high',
      isUrgent: false
    });
  }
};
```

### Accessing Notification Settings

```javascript
// Navigate to notification settings from any screen
navigation.navigate('NotificationSettings');

// Or integrate in Settings screen
import NotificationSettings from './src/screens/universal/NotificationSettings';
```

## 🎨 Customization

### Custom Notification Sounds

1. Add sound files to `assets/sounds/` directory:
   - `message_tone.wav` - Chat messages
   - `notification_tone.wav` - School notifications
   - `urgent_tone.wav` - Urgent alerts

2. Update `app.json` to include the sound files

### Custom Notification Icons

1. Create icons in `assets/` directory:
   - `notification-icon.png` (96x96px, monochrome)
   - `icon.png` (1024x1024px, app icon)

2. Update `app.json` paths

### Styling In-App Banners

Modify `InAppNotificationBanner.js` styles:

```javascript
const styles = StyleSheet.create({
  banner: {
    borderRadius: 12, // Customize border radius
    // Add your custom styles
  },
  // ... other style customizations
});
```

## 🔧 Testing

### Test Scenarios

1. **Send Test Notification**:
   ```javascript
   // In development, test with a simple notification
   await pushNotificationService.sendNotificationToUser({
     userId: 'test-user-id',
     userType: 'student',
     title: 'Test Notification',
     body: 'This is a test message',
     data: { type: 'test' }
   });
   ```

2. **Test In-App Banners**:
   ```javascript
   // Trigger in-app banner manually
   global.showNotificationBanner({
     title: 'Test Banner',
     body: 'This is a test in-app notification',
     data: { type: 'test' }
   });
   ```

3. **Test Navigation**:
   ```javascript
   // Test notification tap navigation
   global.navigationService.handleNotificationTap({
     type: 'chat_message',
     senderId: 'test-sender',
     senderName: 'Test User',
     senderType: 'teacher'
   });
   ```

### Development Testing

```javascript
// Enable debug logging
const debugEnabled = __DEV__;

// In PushNotificationService.js, add logging
if (debugEnabled) {
  console.log('🔔 Push notification sent:', result);
}
```

## 🚨 Troubleshooting

### Common Issues

1. **Notifications Not Received**:
   - Check device permissions
   - Verify Expo project ID is correct
   - Ensure push tokens are being stored in database

2. **In-App Banners Not Showing**:
   - Verify `InAppNotificationBanner` is added to navigation
   - Check `global.showNotificationBanner` is being called

3. **Navigation Not Working**:
   - Ensure navigation screens are properly registered
   - Check navigation reference is set up correctly

### Debug Commands

```bash
# Check Expo push token
npx expo push:android:show --id your-expo-push-token

# Test notification sending
curl -H "Content-Type: application/json" \
     -d '{"to":"your-expo-push-token","title":"Test","body":"Hello!"}' \
     https://exp.host/--/api/v2/push/send
```

## 🔒 Security Considerations

1. **Push Token Management**:
   - Tokens are automatically deactivated on logout
   - Old tokens are cleaned up after 90 days

2. **Notification Content**:
   - Message content is truncated for privacy
   - Sensitive information is not included in push payloads

3. **User Permissions**:
   - Users can disable specific notification types
   - Quiet hours are respected (except for urgent notifications)

## 🚀 Production Deployment

### Pre-deployment Checklist

- [ ] Replace all placeholder IDs with actual values
- [ ] Set up proper Expo project and EAS build
- [ ] Configure push notification credentials
- [ ] Test on physical devices (iOS and Android)
- [ ] Set up proper error logging and monitoring
- [ ] Configure notification analytics (optional)

### EAS Build Configuration

```json
// eas.json
{
  "cli": {
    "version": ">= 3.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "ios": {
        "config": "production"
      },
      "android": {
        "config": "production"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

## 📊 Analytics & Monitoring

### Track Notification Performance

```javascript
// In PushNotificationService.js
const trackNotificationMetrics = async (userId, notificationType, action) => {
  await supabase
    .from('notification_interactions')
    .insert({
      user_id: userId,
      interaction_type: action,
      interaction_data: { notificationType }
    });
};

// Usage
await trackNotificationMetrics(userId, 'chat_message', 'received');
await trackNotificationMetrics(userId, 'chat_message', 'opened');
```

## 🎉 Features Summary

### ✅ Implemented Features

- **Push Notifications** - Full Expo push notification implementation
- **In-App Banners** - WhatsApp-style notification banners
- **Notification Settings** - Comprehensive user preference management
- **Smart Navigation** - Automatic routing based on notification type
- **Real-time Badges** - Live notification count updates
- **Multi-platform Support** - iOS, Android, and Web
- **Database Integration** - Complete schema with RLS policies
- **Permission Management** - User-friendly permission requests
- **Sound & Vibration** - Custom sounds for different notification types
- **Quiet Hours** - Do not disturb functionality
- **Notification Logs** - Complete delivery tracking and analytics

### 🔮 Future Enhancements

- **Push Notification Analytics Dashboard**
- **A/B Testing for Notification Content**
- **Rich Media Notifications** (images, actions)
- **Notification Scheduling** (delayed send)
- **Geolocation-based Notifications**
- **Push Notification Templates**

---

## 💡 Tips for WhatsApp-like Experience

1. **Instant Delivery**: Notifications are sent immediately when messages are created
2. **Smart Suppression**: In-app banners don't show when user is in the relevant chat
3. **Rich Content**: Different icons and colors for different notification types
4. **User Control**: Comprehensive settings for all notification preferences
5. **Reliable Delivery**: Multiple fallback mechanisms ensure notifications are delivered
6. **Privacy Focused**: Message content is truncated and sensitive data is protected

Your push notification system is now ready for a WhatsApp-like notification experience! 🎉
