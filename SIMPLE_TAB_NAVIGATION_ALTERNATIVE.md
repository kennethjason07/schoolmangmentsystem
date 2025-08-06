# Simple Alternative Solution (No AsyncStorage Required)

If you prefer not to use AsyncStorage, here's a simpler alternative solution:

## Option 1: Direct Tab Navigation with Reset

### Update StudentDashboard.js:
```javascript
// Handle navigation for stat cards
const handleCardNavigation = (cardKey) => {
  try {
    switch (cardKey) {
      case 'assignments':
        navigation.navigate('Assignments');
        break;
      case 'attendance':
        // Navigate and immediately set tab
        navigation.navigate('Marks');
        // Use a small delay to ensure screen is loaded
        setTimeout(() => {
          navigation.setParams({ initialTab: 'attendance' });
        }, 100);
        break;
      case 'marks':
        // Navigate and immediately set tab
        navigation.navigate('Marks');
        // Use a small delay to ensure screen is loaded
        setTimeout(() => {
          navigation.setParams({ initialTab: 'marks' });
        }, 100);
        break;
      case 'notifications':
        navigation.navigate('Notifications');
        break;
      default:
        Alert.alert('Coming Soon', `${cardKey} feature is under development.`);
    }
  } catch (error) {
    console.error('Navigation error:', error);
    Alert.alert('Error', 'Unable to navigate. Please try again.');
  }
};
```

### Update StudentAttendanceMarks.js:
```javascript
// Remove AsyncStorage import
// Keep only the route params handling

useEffect(() => {
  if (route?.params?.initialTab) {
    console.log('Setting tab to:', route.params.initialTab);
    setActiveTab(route.params.initialTab);
  }
}, [route?.params?.initialTab]);
```

## Option 2: Global State with Context

### Create a TabContext.js:
```javascript
import React, { createContext, useContext, useState } from 'react';

const TabContext = createContext();

export const TabProvider = ({ children }) => {
  const [marksTab, setMarksTab] = useState('attendance');
  
  return (
    <TabContext.Provider value={{ marksTab, setMarksTab }}>
      {children}
    </TabContext.Provider>
  );
};

export const useTabContext = () => {
  const context = useContext(TabContext);
  if (!context) {
    throw new Error('useTabContext must be used within TabProvider');
  }
  return context;
};
```

### Update StudentDashboard.js:
```javascript
import { useTabContext } from '../../utils/TabContext';

const { setMarksTab } = useTabContext();

const handleCardNavigation = (cardKey) => {
  switch (cardKey) {
    case 'attendance':
      setMarksTab('attendance');
      navigation.navigate('Marks');
      break;
    case 'marks':
      setMarksTab('marks');
      navigation.navigate('Marks');
      break;
    // ... other cases
  }
};
```

### Update StudentAttendanceMarks.js:
```javascript
import { useTabContext } from '../../utils/TabContext';

const { marksTab, setMarksTab } = useTabContext();
const [activeTab, setActiveTab] = useState(marksTab);

useFocusEffect(
  React.useCallback(() => {
    setActiveTab(marksTab);
  }, [marksTab])
);
```

## Option 3: Simple Route Reset

### Update StudentDashboard.js:
```javascript
const handleCardNavigation = (cardKey) => {
  switch (cardKey) {
    case 'attendance':
      navigation.navigate('Marks', { 
        initialTab: 'attendance',
        timestamp: Date.now() // Force re-render
      });
      break;
    case 'marks':
      navigation.navigate('Marks', { 
        initialTab: 'marks',
        timestamp: Date.now() // Force re-render
      });
      break;
    // ... other cases
  }
};
```

### Update StudentAttendanceMarks.js:
```javascript
useEffect(() => {
  const tab = route?.params?.initialTab || 'attendance';
  console.log('Setting tab to:', tab);
  setActiveTab(tab);
}, [route?.params?.initialTab, route?.params?.timestamp]);
```

## Recommendation

I recommend sticking with the AsyncStorage solution I implemented because:
1. ✅ Most reliable across different navigation scenarios
2. ✅ No timing issues
3. ✅ Clean separation of concerns
4. ✅ Fallback to route params if AsyncStorage fails
5. ✅ Auto-cleanup prevents state pollution

The AsyncStorage package is now installed and should work correctly. Try the marks card navigation now!
