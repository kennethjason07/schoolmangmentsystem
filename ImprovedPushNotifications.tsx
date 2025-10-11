import { useState, useEffect, useRef } from 'react';
import { Text, View, Button, Platform, Alert } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

// Set notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface PushMessage {
  to: string;
  sound: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

async function sendPushNotification(expoPushToken: string): Promise<void> {
  if (!expoPushToken) {
    Alert.alert('Error', 'No push token available');
    return;
  }

  const message: PushMessage = {
    to: expoPushToken,
    sound: 'default',
    title: 'School Management System',
    body: 'You have a new notification!',
    data: { 
      type: 'general',
      timestamp: Date.now(),
      schoolId: 'xyz_school'
    },
  };

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('Push notification sent successfully:', result);
    Alert.alert('Success', 'Notification sent!');
  } catch (error) {
    console.error('Error sending push notification:', error);
    Alert.alert('Error', 'Failed to send notification');
  }
}

function handleRegistrationError(errorMessage: string): never {
  console.error('Push notification registration error:', errorMessage);
  Alert.alert('Notification Error', errorMessage);
  throw new Error(errorMessage);
}

async function registerForPushNotificationsAsync(): Promise<string | undefined> {
  // Android notification channel setup
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  // Check if running on physical device
  if (!Device.isDevice) {
    handleRegistrationError('Must use physical device for push notifications');
  }

  // Request permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (finalStatus !== 'granted') {
    handleRegistrationError('Permission not granted to get push token for push notification!');
  }

  // Get project ID (using the modern approach)
  const projectId = 
    Constants?.expoConfig?.extra?.eas?.projectId ?? 
    Constants?.easConfig?.projectId;
    
  if (!projectId) {
    handleRegistrationError('Project ID not found. Make sure your app.json/app.config.js is properly configured.');
  }

  try {
    // Get push token using project ID
    const pushTokenString = (
      await Notifications.getExpoPushTokenAsync({
        projectId,
      })
    ).data;
    
    console.log('Expo push token:', pushTokenString);
    return pushTokenString;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    handleRegistrationError(`Failed to get push token: ${errorMessage}`);
  }
}

export default function App() {
  const [expoPushToken, setExpoPushToken] = useState<string>('');
  const [notification, setNotification] = useState<Notifications.Notification | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    // Register for push notifications
    registerForPushNotificationsAsync()
      .then(token => {
        setExpoPushToken(token ?? '');
        setIsLoading(false);
      })
      .catch((error: any) => {
        console.error('Registration failed:', error);
        setExpoPushToken('');
        setIsLoading(false);
      });

    // Set up notification listeners
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
      setNotification(notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
      // Handle notification tap/interaction here
    });

    // Cleanup function
    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  return (
    <View style={{ 
      flex: 1, 
      alignItems: 'center', 
      justifyContent: 'space-around',
      padding: 20 
    }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 20 }}>
        School Management System
      </Text>
      
      {isLoading ? (
        <Text>Setting up notifications...</Text>
      ) : (
        <>
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontWeight: 'bold', marginBottom: 10 }}>Push Token Status:</Text>
            <Text style={{ fontSize: 12, textAlign: 'center' }}>
              {expoPushToken ? 'Token received successfully!' : 'No token available'}
            </Text>
          </View>

          {notification && (
            <View style={{ 
              alignItems: 'center', 
              justifyContent: 'center',
              padding: 15,
              backgroundColor: '#f0f0f0',
              borderRadius: 8,
              marginBottom: 20
            }}>
              <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>Last Notification:</Text>
              <Text>Title: {notification.request.content.title}</Text>
              <Text>Body: {notification.request.content.body}</Text>
              <Text>Data: {JSON.stringify(notification.request.content.data)}</Text>
            </View>
          )}

          <Button
            title="Send Test Notification"
            onPress={async () => {
              await sendPushNotification(expoPushToken);
            }}
            disabled={!expoPushToken}
          />
        </>
      )}
    </View>
  );
}