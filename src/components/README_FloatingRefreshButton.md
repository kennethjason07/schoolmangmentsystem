# FloatingRefreshButton Component

A reusable floating refresh button component specifically designed for web version of admin screens.

## Features

- **Web-only**: Only renders on web platform (Platform.OS === 'web')
- **Floating positioning**: Fixed position at bottom-right corner
- **Refresh animation**: Spinning sync icon when refreshing
- **Customizable**: Configurable position, size, and color
- **Smooth animations**: CSS transitions and hover effects
- **Accessibility**: Disabled state when refreshing

## Usage

```jsx
import FloatingRefreshButton from '../components/FloatingRefreshButton';

const MyAdminScreen = () => {
  const [refreshing, setRefreshing] = useState(false);
  
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Your refresh logic here
      await loadData();
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View>
      {/* Your screen content */}
      
      <FloatingRefreshButton
        onPress={handleRefresh}
        refreshing={refreshing}
      />
    </View>
  );
};
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onPress` | function | - | **Required.** Function called when button is pressed |
| `refreshing` | boolean | `false` | Whether the refresh is in progress (shows spinning animation) |
| `bottom` | number | `30` | Distance from bottom edge in pixels |
| `right` | number | `30` | Distance from right edge in pixels |
| `backgroundColor` | string | `'#2196F3'` | Background color of the button |
| `size` | number | `56` | Width and height of the button in pixels |

## Implementation Notes

- Uses CSS keyframes for smooth spinning animation
- Automatically adds global CSS styles only once per session
- Button is disabled during refresh to prevent multiple calls
- Includes hover and active states for better UX
- High z-index (1000) to appear above other content

## Current Usage

- ✅ AdminDashboard.js - Main admin dashboard screen

## Future Implementation

This component should be added to all admin screens in the web version:
- FeeManagement.js
- ClassStudentDetails.js
- ManageTeachers.js
- ManageStudents.js
- AttendanceManagement.js
- ExamsMarks.js
- And other admin screens...

## Browser Support

- Works in all modern browsers that support CSS animations
- Gracefully degrades in older browsers (no animation but still functional)