import { useState, useEffect, useRef } from 'react';
import { Text, View, Button, Platform, StyleSheet, ScrollView, Alert } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import Header from '../../components/Header';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function sendPushNotification(expoPushToken) {
  const message = {
    to: expoPushToken,
    sound: 'default',
    title: 'School Management System',
    body: 'Test notification from admin panel!',
    data: { 
      type: 'test',
      timestamp: Date.now(),
      source: 'admin_dashboard'
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
    Alert.alert('Success', 'Test notification sent successfully!');
    return result;
  } catch (error) {
    console.error('Error sending push notification:', error);
    Alert.alert('Error', `Failed to send notification: ${error.message}`);
    throw error;
  }
}

function handleRegistrationError(errorMessage) {
  console.error('Push notification registration error:', errorMessage);
  Alert.alert('Notification Error', errorMessage);
  throw new Error(errorMessage);
}

async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      handleRegistrationError('Permission not granted to get push token for push notification!');
      return;
    }
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    if (!projectId) {
      handleRegistrationError('Project ID not found. Please check your app configuration.');
    }
    try {
      const pushTokenString = (
        await Notifications.getExpoPushTokenAsync({
          projectId,
        })
      ).data;
      console.log('Push token retrieved:', pushTokenString);
      return pushTokenString;
    } catch (e) {
      handleRegistrationError(`Failed to get push token: ${e}`);
    }
  } else {
    handleRegistrationError('Must use physical device for push notifications');
  }
}

export default function TestPushNotifications({ navigation }) {
  const [expoPushToken, setExpoPushToken] = useState('');
  const [notification, setNotification] = useState(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    // Register for push notifications
    registerForPushNotificationsAsync()
      .then(token => {
        setExpoPushToken(token ?? '');
        setIsLoading(false);
      })
      .catch((error) => {
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
      Alert.alert('Notification Tapped', 'You tapped on the notification!');
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

  const handleSendNotification = async () => {
    if (!expoPushToken) {
      Alert.alert('Error', 'No push token available. Make sure you\'re using a physical device.');
      return;
    }

    setIsSending(true);
    try {
      await sendPushNotification(expoPushToken);
    } catch (error) {
      // Error already handled in sendPushNotification
    } finally {
      setIsSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header 
        title="Test Push Notifications" 
        onBackPress={() => navigation.goBack()}
      />
      
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Push Notification Testing</Text>
          <Text style={styles.description}>
            This screen allows you to test push notifications for your school management system. 
            Make sure you're using a physical device as push notifications don't work on simulators.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Token Status</Text>
          {isLoading ? (
            <View style={styles.statusCard}>
              <Text style={styles.statusText}>Setting up notifications...</Text>
            </View>
          ) : (
            <View style={[styles.statusCard, expoPushToken ? styles.successCard : styles.errorCard]}>
              <Text style={[styles.statusText, expoPushToken ? styles.successText : styles.errorText]}>
                {expoPushToken ? '✅ Push token received successfully!' : '❌ No push token available'}
              </Text>
              {expoPushToken && (
                <Text style={styles.tokenText}>
                  Token: {expoPushToken.substring(0, 50)}...
                </Text>
              )}
            </View>
          )}
        </View>

        {notification && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Last Received Notification</Text>
            <View style={styles.notificationCard}>
              <Text style={styles.notificationTitle}>
                Title: {notification.request.content.title}
              </Text>
              <Text style={styles.notificationBody}>
                Body: {notification.request.content.body}
              </Text>
              <Text style={styles.notificationData}>
                Data: {JSON.stringify(notification.request.content.data, null, 2)}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Test Notification</Text>
          <Text style={styles.description}>
            Send a test push notification to this device to verify everything is working correctly.
          </Text>
          
          <View style={styles.buttonContainer}>
            <Button
              title={isSending ? "Sending..." : "Send Test Notification"}
              onPress={handleSendNotification}
              disabled={!expoPushToken || isSending}
              color="#2196F3"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Important Notes</Text>
          <View style={styles.notesList}>
            <Text style={styles.noteItem}>• Push notifications only work on physical devices</Text>
            <Text style={styles.noteItem}>• Make sure your Expo project ID is configured correctly</Text>
            <Text style={styles.noteItem}>• Check device notification permissions if not receiving notifications</Text>
            <Text style={styles.noteItem}>• Test notifications may take a few seconds to arrive</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  statusCard: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  successCard: {
    backgroundColor: '#e8f5e8',
    borderColor: '#4CAF50',
  },
  errorCard: {
    backgroundColor: '#ffeaea',
    borderColor: '#F44336',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  successText: {
    color: '#2E7D32',
  },
  errorText: {
    color: '#C62828',
  },
  tokenText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  notificationCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  notificationBody: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  notificationData: {
    fontSize: 12,
    color: '#666',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 4,
  },
  buttonContainer: {
    marginTop: 16,
  },
  notesList: {
    marginTop: 8,
  },
  noteItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
    lineHeight: 20,
  },
});