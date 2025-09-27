import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { View } from 'react-native';

// Import Warden screens
import WardenDashboard from '../screens/warden/WardenDashboard';
import HostelApplications from '../screens/warden/HostelApplications';

// Import Universal Screens that wardens can access
import ProfileScreen from '../screens/universal/ProfileScreen';
import SettingsScreen from '../screens/universal/SettingsScreen';
import NotificationSettings from '../screens/universal/NotificationSettings';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Warden Tab Navigator
function WardenTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          let iconFamily = 'Ionicons';
          
          if (route.name === 'WardenDashboard') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Applications') {
            iconName = focused ? 'assignment' : 'assignment-outline';
            iconFamily = 'MaterialIcons';
          } else if (route.name === 'Allocations') {
            iconName = focused ? 'bed' : 'bed';
            iconFamily = 'FontAwesome5';
          } else if (route.name === 'Hostels') {
            iconName = focused ? 'hotel' : 'hotel-outline';
            iconFamily = 'MaterialIcons';
          } else if (route.name === 'Reports') {
            iconName = focused ? 'bar-chart' : 'bar-chart-outline';
          }

          if (iconFamily === 'MaterialIcons') {
            return <MaterialIcons name={iconName} size={size} color={color} />;
          } else if (iconFamily === 'FontAwesome5') {
            return <FontAwesome5 name={iconName} size={size} color={color} />;
          } else {
            return <Ionicons name={iconName} size={size} color={color} />;
          }
        },
        tabBarActiveTintColor: '#4CAF50',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen
        name="WardenDashboard"
        component={WardenDashboard}
        options={{ tabBarLabel: 'Dashboard' }}
      />
      <Tab.Screen
        name="Applications"
        component={HostelApplications}
        options={{ tabBarLabel: 'Applications' }}
      />
      <Tab.Screen
        name="Allocations"
        component={WardenDashboard} // Placeholder - will create dedicated screen later
        options={{ tabBarLabel: 'Allocations' }}
      />
      <Tab.Screen
        name="Hostels"
        component={WardenDashboard} // Placeholder - will create dedicated screen later
        options={{ tabBarLabel: 'Hostels' }}
      />
      <Tab.Screen
        name="Reports"
        component={WardenDashboard} // Placeholder - will create dedicated screen later
        options={{ tabBarLabel: 'Reports' }}
      />
    </Tab.Navigator>
  );
}

// Stack navigator for warden screens
function WardenNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* Main warden tab navigator */}
      <Stack.Screen name="WardenTabs" component={WardenTabNavigator} />
      
      {/* Additional warden screens */}
      <Stack.Screen name="HostelApplications" component={HostelApplications} />
      
      {/* Universal screens that wardens can access */}
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="NotificationSettings" component={NotificationSettings} />
      
      {/* Placeholder screens for future development */}
      <Stack.Screen 
        name="BedAllocations" 
        component={WardenDashboard} 
        options={{ 
          title: 'Bed Allocations',
          headerShown: true,
          headerBackTitle: 'Back'
        }}
      />
      <Stack.Screen 
        name="ManageHostels" 
        component={WardenDashboard} 
        options={{ 
          title: 'Manage Hostels',
          headerShown: true,
          headerBackTitle: 'Back'
        }}
      />
      <Stack.Screen 
        name="HostelDetails" 
        component={WardenDashboard} 
        options={{ 
          title: 'Hostel Details',
          headerShown: true,
          headerBackTitle: 'Back'
        }}
      />
      <Stack.Screen 
        name="BedAllocation" 
        component={WardenDashboard} 
        options={{ 
          title: 'Allocate Bed',
          headerShown: true,
          headerBackTitle: 'Back'
        }}
      />
      <Stack.Screen 
        name="ApplicationDetails" 
        component={WardenDashboard} 
        options={{ 
          title: 'Application Details',
          headerShown: true,
          headerBackTitle: 'Back'
        }}
      />
      <Stack.Screen 
        name="Waitlist" 
        component={WardenDashboard} 
        options={{ 
          title: 'Waitlist',
          headerShown: true,
          headerBackTitle: 'Back'
        }}
      />
      <Stack.Screen 
        name="Maintenance" 
        component={WardenDashboard} 
        options={{ 
          title: 'Maintenance',
          headerShown: true,
          headerBackTitle: 'Back'
        }}
      />
      <Stack.Screen 
        name="HostelReports" 
        component={WardenDashboard} 
        options={{ 
          title: 'Hostel Reports',
          headerShown: true,
          headerBackTitle: 'Back'
        }}
      />
    </Stack.Navigator>
  );
}

export default WardenNavigator;
export { WardenTabNavigator };