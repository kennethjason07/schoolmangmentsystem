# 📱 Development Build Setup for Push Notifications

## 🚨 Important Notice

With Expo SDK 53+, **push notifications no longer work in Expo Go**. You need to create a development build to test push notifications on physical devices.

## 🎯 Quick Solutions

### Option 1: Create Development Build (Recommended)
### Option 2: Test on Web First
### Option 3: Use EAS Build for Testing

---

## 🔧 Option 1: Create Development Build (Recommended)

### Prerequisites
- Install EAS CLI: `npm install -g eas-cli`
- Create Expo account: `npx expo register` or `npx expo login`

### Step 1: Initialize EAS
```bash
cd "C:\Users\Mohd Arshad\OneDrive\Desktop\school managment system\schoolmangmentsystem"
eas build:configure
```

### Step 2: Create Development Build Configuration

Create `eas.json` in your project root:

```json
{
  "cli": {
    "version": ">= 3.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "resourceClass": "m-medium"
      },
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:assembleDebug"
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "resourceClass": "m-medium"
      }
    },
    "production": {
      "ios": {
        "resourceClass": "m-medium"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

### Step 3: Install Development Client
```bash
npx expo install expo-dev-client
```

### Step 4: Update App.json for Development Build

Add this to your `app.json`:

```json
{
  "expo": {
    "plugins": [
      "expo-dev-client",
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#2196F3",
          "defaultChannel": "default"
        }
      ]
    ]
  }
}
```

### Step 5: Build for Android (Faster for Testing)
```bash
# Build APK for Android device
eas build --platform android --profile development

# Or build locally (faster)
npx expo run:android
```

### Step 6: Install and Test
1. Download the APK from EAS Build dashboard
2. Install on your Android device
3. Run `npx expo start --dev-client`
4. Test push notifications!

---

## 🌐 Option 2: Test on Web First (Immediate Testing)

Web notifications work in Expo Go and browsers. Start here for quick testing:

### Step 1: Enable Web Notifications

Update your `PushNotificationService.js`:

```javascript
// Add this at the top of PushNotificationService.js
import { Platform } from 'react-native';

// Modify the initialize method
async initialize(userId, userType) {
  try {
    this.currentUserId = userId;
    this.currentUserType = userType;

    // For web, use browser notifications
    if (Platform.OS === 'web') {
      return await this.initializeWebNotifications();
    }

    // For mobile, check if it's a development build
    if (!Device.isDevice && Platform.OS !== 'web') {
      console.warn('Push notifications only work on physical devices or development builds');
      return false;
    }

    // ... rest of existing code
  } catch (error) {
    console.error('❌ Push notification initialization failed:', error);
    return false;
  }
}

// Add web notification support
async initializeWebNotifications() {
  if ('Notification' in window) {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('✅ Web notifications enabled');
      return true;
    }
  }
  return false;
}

// Add web notification sending
async sendWebNotification(title, body, data = {}) {
  if (Platform.OS === 'web' && 'Notification' in window && Notification.permission === 'granted') {
    const notification = new Notification(title, {
      body,
      icon: '/favicon.png',
      tag: data.type || 'default'
    });

    notification.onclick = () => {
      window.focus();
      this.handleNotificationResponse({ notification: { request: { content: { data } } } });
      notification.close();
    };

    return true;
  }
  return false;
}
```

### Step 2: Test Web Notifications
```bash
# Start web development server
npx expo start --web

# Open in browser and test notifications
```

---

## ☁️ Option 3: Use EAS Build for Quick Testing

### Build in the Cloud (No Local Setup Required)

```bash
# Login to Expo
npx expo login

# Initialize EAS
eas build:configure

# Build Android APK (free tier)
eas build --platform android --profile development

# Track build progress
eas build:list
```

The build will take 10-15 minutes. You'll get an APK download link.

---

## 🛠️ Modified Push Notification Service (Development Friendly)

Create a development-friendly version of the push notification service:

```javascript
// src/services/DevelopmentPushService.js
import { Platform, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import pushNotificationService from './PushNotificationService';

class DevelopmentPushService {
  constructor() {
    this.isDevEnvironment = __DEV__;
    this.mockNotifications = [];
  }

  async initialize(userId, userType) {
    if (Platform.OS === 'web') {
      return this.initializeWebNotifications();
    }

    if (!Device.isDevice) {
      console.log('📱 Running in simulator - using mock notifications');
      return this.initializeMockNotifications();
    }

    // Try real push notifications on device
    try {
      return await pushNotificationService.initialize(userId, userType);
    } catch (error) {
      console.warn('Push notifications failed, falling back to mock notifications');
      return this.initializeMockNotifications();
    }
  }

  async initializeWebNotifications() {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }

  async initializeMockNotifications() {
    // Setup in-app notification simulation
    console.log('🔔 Mock notification system initialized');
    return true;
  }

  async sendChatMessageNotification(params) {
    const { receiverId, senderName, message } = params;
    
    if (Platform.OS === 'web') {
      return this.sendWebNotification(
        `New message from ${senderName}`,
        message,
        { type: 'chat_message', ...params }
      );
    }

    if (!Device.isDevice) {
      return this.sendMockNotification(
        `New message from ${senderName}`,
        message,
        params
      );
    }

    // Try real push notification
    return pushNotificationService.sendChatMessageNotification(params);
  }

  async sendMockNotification(title, body, data) {
    console.log('📱 Mock Notification:', { title, body, data });
    
    // Show in-app banner
    setTimeout(() => {
      global.showNotificationBanner?.({ title, body, data });
    }, 1000);

    // Show alert in development
    if (this.isDevEnvironment) {
      Alert.alert(title, body, [
        { text: 'Dismiss' },
        { text: 'Open', onPress: () => this.handleNotificationTap(data) }
      ]);
    }

    return true;
  }

  async sendWebNotification(title, body, data) {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: '/favicon.png',
        tag: data.type || 'default'
      });

      notification.onclick = () => {
        window.focus();
        this.handleNotificationTap(data);
        notification.close();
      };

      return true;
    }

    // Fallback to mock notification
    return this.sendMockNotification(title, body, data);
  }

  handleNotificationTap(data) {
    if (global.navigationService) {
      global.navigationService.handleNotificationTap(data);
    }
  }
}

export const developmentPushService = new DevelopmentPushService();
export default developmentPushService;
```

### Use Development Service

In your app, replace the import:

```javascript
// Instead of:
// import pushNotificationService from './src/services/PushNotificationService';

// Use:
import developmentPushService from './src/services/DevelopmentPushService';

// Then use developmentPushService instead of pushNotificationService
```

---

## 🧪 Testing Without Physical Devices

### In-App Notification Testing

Add this test component to your app:

```javascript
// src/components/NotificationTester.js
import React from 'react';
import { View, Button, Alert } from 'react-native';
import developmentPushService from '../services/DevelopmentPushService';

const NotificationTester = () => {
  const testChatNotification = () => {
    developmentPushService.sendChatMessageNotification({
      receiverId: 'test-receiver',
      receiverType: 'student',
      senderId: 'test-sender',
      senderName: 'John Teacher',
      senderType: 'teacher',
      message: 'Hello! This is a test message.',
      messageType: 'text'
    });
  };

  const testFormalNotification = () => {
    developmentPushService.sendFormalNotification({
      recipientIds: ['test-user'],
      recipientType: 'student',
      title: 'Exam Reminder',
      message: 'Math exam tomorrow at 10 AM',
      type: 'exam_alert',
      isUrgent: false
    });
  };

  if (!__DEV__) return null;

  return (
    <View style={{ padding: 20 }}>
      <Button title="Test Chat Notification" onPress={testChatNotification} />
      <Button title="Test Formal Notification" onPress={testFormalNotification} />
    </View>
  );
};

export default NotificationTester;
```

---

## 🎯 Recommended Development Workflow

### Phase 1: Immediate Testing (Today)
1. ✅ Use web notifications for immediate testing
2. ✅ Test in-app banners in Expo Go
3. ✅ Test notification settings UI
4. ✅ Test badge count updates

### Phase 2: Device Testing (This Week)
1. 🔄 Create development build with EAS
2. 🔄 Test real push notifications on Android device
3. 🔄 Test iOS if needed

### Phase 3: Production (When Ready)
1. 🔄 Create production builds
2. 🔄 Test on app stores' internal testing
3. 🔄 Deploy to users

---

## 🚀 Quick Commands

```bash
# Start web testing immediately
npx expo start --web

# Create development build (Android - fastest)
eas build --platform android --profile development

# Create development build locally (if you have Android Studio)
npx expo run:android

# Start development server for development build
npx expo start --dev-client
```

---

## ❓ FAQ

**Q: Can I test push notifications without a development build?**
A: Yes! Use web notifications for immediate testing, then create a development build for mobile testing.

**Q: How long does a development build take?**
A: Cloud builds: 10-15 minutes. Local builds: 2-5 minutes (requires Android Studio/Xcode).

**Q: Do I need a paid Expo account?**
A: No, development builds are free. You get limited cloud build minutes per month.

**Q: Can I test on iOS simulator?**
A: iOS simulator doesn't support push notifications. You need a physical iOS device or development build.

---

## 🎉 Next Steps

1. **Start with web testing** for immediate results
2. **Create development build** for complete mobile testing  
3. **Test the full notification flow** with real devices
4. **Deploy to production** when ready

Your push notification system will work perfectly once you have a development build! The web testing will let you verify the logic and UI immediately. <citations>
<document>
<document_type>WEB_PAGE</document_type>
<document_id>https://docs.expo.dev/develop/development-builds/introduction/</document_id>
</document>
</citations>
