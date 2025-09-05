# Universal Notification System Guide

## Overview
The Universal Notification System provides a single, unified solution for managing notification counts across all user types (admin, teacher, parent, student) in the school management system.

## Key Features
- ✅ **Unified Counts**: Combines messages and formal notifications into a single count
- ✅ **Role-Based**: Works for all user types with proper filtering
- ✅ **Real-Time Updates**: Instant updates via Supabase subscriptions
- ✅ **Intelligent Caching**: Performance optimized with 30-second cache
- ✅ **Auto-Refresh**: Updates on app focus and screen changes
- ✅ **Easy Integration**: Simple drop-in replacement for existing systems

## Components

### 1. UniversalNotificationService
**Location**: `src/services/UniversalNotificationService.js`

Core service that handles all notification logic:
- Fetches counts from both `messages` and `notification_recipients` tables
- Applies user-type specific filtering
- Manages caching and real-time subscriptions
- Provides broadcast methods for immediate updates

### 2. UniversalNotificationBadge
**Location**: `src/components/UniversalNotificationBadge.js`

React component that displays the notification count badge:
- Automatically detects user type from AuthContext
- Shows red badge with count (or "99+" for high counts)
- Hides when count is 0 (unless `showZero=true`)
- Real-time updates with smooth transitions

### 3. useUniversalNotificationCount
**Location**: `src/hooks/useUniversalNotificationCount.js`

Custom React hook for accessing notification counts:
- Returns total count, message count, and notification count separately
- Provides loading state and manual refresh function
- Configurable auto-refresh and real-time options

## Usage Examples

### 1. Basic Badge Usage (Recommended)
```jsx
import UniversalNotificationBadge from '../components/UniversalNotificationBadge';

// In your component (Header, Tab Navigator, etc.)
<TouchableOpacity style={styles.notificationButton}>
  <Ionicons name="notifications" size={24} color="#333" />
  <UniversalNotificationBadge />
</TouchableOpacity>
```

### 2. Custom Hook Usage
```jsx
import useUniversalNotificationCount from '../hooks/useUniversalNotificationCount';

function MyComponent() {
  const { 
    totalCount, 
    messageCount, 
    notificationCount, 
    loading, 
    refresh,
    notificationScreen 
  } = useUniversalNotificationCount({
    onCountChange: (counts) => {
      console.log('Counts updated:', counts);
    }
  });

  return (
    <View>
      <Text>Total: {totalCount}</Text>
      <Text>Messages: {messageCount}</Text>
      <Text>Notifications: {notificationCount}</Text>
      <Button title="Refresh" onPress={refresh} />
      <Button 
        title="View Notifications" 
        onPress={() => navigation.navigate(notificationScreen)} 
      />
    </View>
  );
}
```

### 3. Service Usage (Advanced)
```jsx
import universalNotificationService from '../services/UniversalNotificationService';

// Get counts programmatically
const counts = await universalNotificationService.getUnreadCounts(userId, userType);

// Set up manual subscription
const unsubscribe = universalNotificationService.subscribeToUpdates(
  userId, 
  userType, 
  (reason) => {
    console.log('Update received:', reason);
  }
);

// Broadcast when notification is read (for immediate updates)
await universalNotificationService.broadcastNotificationRead(userId, notificationId);
```

## Integration in Existing Screens

### Dashboard Headers
The system is already integrated in `Header.js`. For custom headers:

```jsx
// Replace old notification badge with:
import UniversalNotificationBadge from '../components/UniversalNotificationBadge';

<Header 
  title="Dashboard" 
  showNotifications={true}
  // No need to pass unreadCount anymore
/>
```

### Tab Navigators
Already updated in `AppNavigator.js` for all Chat tabs:

```jsx
// Chat tab icon with badge
if (route.name === 'Chat') {
  return (
    <View style={{ position: 'relative' }}>
      <Ionicons name="chatbubbles" size={size} color={color} />
      <UniversalNotificationBadge />
    </View>
  );
}
```

### Custom Badge Styling
```jsx
<UniversalNotificationBadge 
  style={{
    backgroundColor: '#ff4444',
    borderRadius: 12,
  }}
  textStyle={{
    fontSize: 10,
    fontWeight: '600',
  }}
  showZero={false}
/>
```

## User Type Mapping

The system automatically handles navigation based on user type:

| User Type | Screen Navigation | Badge Shows |
|-----------|-------------------|-------------|
| `admin` | `AdminNotifications` | Messages + Notifications |
| `teacher` | `TeacherNotifications` | Messages + Notifications |
| `parent` | `ParentNotifications` | Messages + Notifications |
| `student` | `StudentNotifications` | Messages + Notifications (filtered by class) |

## Filtering Logic

### All User Types
- Filters out leave-related notifications (sick, vacation, absent, etc.)
- Only shows unread notifications and messages

### Student-Specific
- Additional filtering based on student's class
- Only shows notifications relevant to their grade/class
- Uses pattern matching to identify class-specific notifications

## Performance Features

### Caching
- 30-second intelligent cache per user
- Cache automatically cleared on real-time updates
- Manual cache clearing methods available

### Real-Time Updates
- Supabase postgres_changes subscriptions
- Broadcast channels for immediate updates
- Automatic cleanup on component unmount

### Polling Fallback
- App state change detection
- Screen focus refresh
- Configurable auto-refresh intervals

## Migration from Old System

### Replace MessageBadge
```jsx
// Old way:
import MessageBadge from '../components/MessageBadge';
<MessageBadge userType="teacher" />

// New way:
import UniversalNotificationBadge from '../components/UniversalNotificationBadge';
<UniversalNotificationBadge />
```

### Replace useUnreadNotificationCount
```jsx
// Old way:
import { useUnreadNotificationCount } from '../hooks/useUnreadNotificationCount';
const { unreadCount } = useUnreadNotificationCount('Teacher');

// New way:
import useUniversalNotificationCount from '../hooks/useUniversalNotificationCount';
const { totalCount } = useUniversalNotificationCount();
```

### Replace useUnreadMessageCount
```jsx
// Old way:
import { useUnreadMessageCount } from '../hooks/useUnreadMessageCount';
const { unreadCount } = useUnreadMessageCount();

// New way:
import useUniversalNotificationCount from '../hooks/useUniversalNotificationCount';
const { messageCount } = useUniversalNotificationCount();
```

## Broadcasting Updates

When implementing mark-as-read functionality in notification screens:

```jsx
// In your notification screen's markAsRead function:
import universalNotificationService from '../services/UniversalNotificationService';

const markAsRead = async (notificationId) => {
  // Update database first
  await supabase
    .from('notification_recipients')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', notificationId);
  
  // Broadcast for immediate updates across app
  await universalNotificationService.broadcastNotificationRead(user.id, notificationId);
};
```

## Troubleshooting

### Badge Not Showing
1. Ensure user is authenticated (`useAuth` returns valid user)
2. Check user has proper user type set
3. Verify notification/message records exist in database
4. Check console for any error messages

### Counts Not Updating
1. Verify real-time subscriptions are working (check console logs)
2. Clear cache manually: `universalNotificationService.clearCache(userId, userType)`
3. Check broadcast events are being sent from notification screens
4. Ensure proper tenant_id filtering in database

### Performance Issues
1. Reduce cache timeout if needed (default 30 seconds)
2. Disable real-time updates: `useUniversalNotificationCount({ realTime: false })`
3. Disable auto-refresh: `useUniversalNotificationCount({ autoRefresh: false })`

## Testing

The system includes comprehensive logging in development mode. Enable by setting `__DEV__ = true`.

### Test Scenarios
1. **Login as different user types** - Verify appropriate counts and navigation
2. **Mark notifications as read** - Verify immediate badge updates
3. **Send new messages** - Verify real-time count increases
4. **App state changes** - Verify refresh on app focus
5. **Screen navigation** - Verify counts update when navigating between screens

## Future Enhancements

- Push notification integration
- Sound/vibration alerts
- Custom notification categories
- Read/unread status syncing
- Offline support with cache persistence

---

The Universal Notification System provides a robust, scalable solution for managing notification counts across your entire school management application. It's designed to be drop-in compatible with existing code while providing significant improvements in performance, reliability, and user experience.
