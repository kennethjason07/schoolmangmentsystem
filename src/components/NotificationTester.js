import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import developmentPushService from '../services/DevelopmentPushService';

/**
 * NotificationTester - Component for testing push notifications in development
 * Works in Expo Go, simulators, and web browsers
 */
const NotificationTester = () => {
  const [isVisible, setIsVisible] = useState(__DEV__);
  const [serviceInfo, setServiceInfo] = useState(null);

  React.useEffect(() => {
    // Get service mode information
    const info = developmentPushService.getMode();
    setServiceInfo(info);
  }, []);

  const testChatNotification = async () => {
    console.log('🧪 Testing chat notification...');
    
    try {
      const result = await developmentPushService.sendChatMessageNotification({
        receiverId: 'test-receiver-123',
        receiverType: 'student',
        senderId: 'test-sender-456',
        senderName: 'John Teacher',
        senderType: 'teacher',
        message: 'Hello! This is a test chat message. How are you doing with your studies?',
        messageType: 'text'
      });
      
      console.log('✅ Chat notification sent:', result);
    } catch (error) {
      console.error('❌ Chat notification failed:', error);
      Alert.alert('Error', 'Failed to send chat notification: ' + error.message);
    }
  };

  const testFormalNotification = async () => {
    console.log('🧪 Testing formal notification...');
    
    try {
      const result = await developmentPushService.sendFormalNotification({
        recipientIds: ['test-user-789'],
        recipientType: 'student',
        title: 'Math Exam Reminder',
        message: 'Don\'t forget about your math exam tomorrow at 10:00 AM in Room 205. Please bring your calculator and ID card.',
        type: 'exam_alert',
        priority: 'high',
        isUrgent: false
      });
      
      console.log('✅ Formal notification sent:', result);
    } catch (error) {
      console.error('❌ Formal notification failed:', error);
      Alert.alert('Error', 'Failed to send formal notification: ' + error.message);
    }
  };

  const testUrgentNotification = async () => {
    console.log('🧪 Testing urgent notification...');
    
    try {
      const result = await developmentPushService.sendFormalNotification({
        recipientIds: ['test-user-urgent'],
        recipientType: 'student',
        title: '🚨 School Closure Alert',
        message: 'Due to unexpected weather conditions, the school will be closed today. All classes and activities are cancelled.',
        type: 'emergency',
        priority: 'max',
        isUrgent: true
      });
      
      console.log('✅ Urgent notification sent:', result);
    } catch (error) {
      console.error('❌ Urgent notification failed:', error);
      Alert.alert('Error', 'Failed to send urgent notification: ' + error.message);
    }
  };

  const testImageMessage = async () => {
    console.log('🧪 Testing image message notification...');
    
    try {
      const result = await developmentPushService.sendChatMessageNotification({
        receiverId: 'test-receiver-img',
        receiverType: 'parent',
        senderId: 'test-teacher-img',
        senderName: 'Ms. Sarah',
        senderType: 'teacher',
        message: 'Assignment photo from today\'s class activity',
        messageType: 'image'
      });
      
      console.log('✅ Image message notification sent:', result);
    } catch (error) {
      console.error('❌ Image message notification failed:', error);
      Alert.alert('Error', 'Failed to send image message notification: ' + error.message);
    }
  };

  const testInAppBanner = () => {
    console.log('🧪 Testing in-app banner directly...');
    
    // Test in-app banner directly
    global.showNotificationBanner?.({
      title: 'Direct Banner Test',
      body: 'This banner was triggered directly to test the in-app notification system.',
      data: {
        type: 'test',
        source: 'direct_test'
      },
      duration: 5000
    });
  };

  const showServiceInfo = () => {
    const info = developmentPushService.getMode();
    const mockNotifications = developmentPushService.getMockNotifications();
    
    Alert.alert(
      'Notification Service Info',
      `Mode: ${info.mode}\n` +
      `Platform: ${info.platform}\n` +
      `Is Device: ${info.isDevice}\n` +
      `Initialized: ${info.isInitialized}\n` +
      `Web Support: ${info.hasWebNotifications}\n` +
      `Web Permission: ${info.webPermission}\n` +
      `Mock Notifications: ${mockNotifications.length}`,
      [
        { text: 'Clear Mock Notifications', onPress: () => developmentPushService.clearMockNotifications() },
        { text: 'OK' }
      ]
    );
  };

  const getModeColor = (mode) => {
    switch (mode) {
      case 'production': return '#4CAF50';
      case 'web': return '#2196F3';
      case 'mock': return '#FF9800';
      case 'simulator': return '#9C27B0';
      default: return '#666';
    }
  };

  const getModeIcon = (mode) => {
    switch (mode) {
      case 'production': return 'phone-portrait';
      case 'web': return 'globe';
      case 'mock': return 'build';
      case 'simulator': return 'desktop';
      default: return 'help-circle';
    }
  };

  if (!isVisible) {
    return (
      <TouchableOpacity
        style={styles.showButton}
        onPress={() => setIsVisible(true)}
      >
        <Ionicons name="notifications" size={20} color="#fff" />
        <Text style={styles.showButtonText}>Test Notifications</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="flask" size={24} color="#2196F3" />
          <Text style={styles.title}>Notification Tester</Text>
        </View>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => setIsVisible(false)}
        >
          <Ionicons name="close" size={24} color="#666" />
        </TouchableOpacity>
      </View>

      {serviceInfo && (
        <View style={[styles.modeIndicator, { borderLeftColor: getModeColor(serviceInfo.mode) }]}>
          <Ionicons 
            name={getModeIcon(serviceInfo.mode)} 
            size={16} 
            color={getModeColor(serviceInfo.mode)} 
          />
          <Text style={[styles.modeText, { color: getModeColor(serviceInfo.mode) }]}>
            {serviceInfo.mode.toUpperCase()} MODE
          </Text>
          <TouchableOpacity onPress={showServiceInfo}>
            <Ionicons name="information-circle" size={16} color="#666" />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Chat Notifications</Text>
          
          <TouchableOpacity style={styles.testButton} onPress={testChatNotification}>
            <Ionicons name="chatbubble" size={20} color="#2196F3" />
            <Text style={styles.buttonText}>Test Chat Message</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.testButton} onPress={testImageMessage}>
            <Ionicons name="image" size={20} color="#4CAF50" />
            <Text style={styles.buttonText}>Test Image Message</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>School Notifications</Text>
          
          <TouchableOpacity style={styles.testButton} onPress={testFormalNotification}>
            <Ionicons name="school" size={20} color="#FF9800" />
            <Text style={styles.buttonText}>Test Exam Reminder</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.testButton} onPress={testUrgentNotification}>
            <Ionicons name="warning" size={20} color="#F44336" />
            <Text style={styles.buttonText}>Test Urgent Alert</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>UI Components</Text>
          
          <TouchableOpacity style={styles.testButton} onPress={testInAppBanner}>
            <Ionicons name="notifications" size={20} color="#9C27B0" />
            <Text style={styles.buttonText}>Test In-App Banner</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.testButton} onPress={showServiceInfo}>
            <Ionicons name="information-circle" size={20} color="#607D8B" />
            <Text style={styles.buttonText}>Service Info</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.instructions}>
          <Text style={styles.instructionsTitle}>💡 How to Test</Text>
          <Text style={styles.instructionsText}>
            • <Text style={styles.bold}>Expo Go</Text>: Shows alerts + in-app banners
            {'\n'}• <Text style={styles.bold}>Web Browser</Text>: Shows browser notifications
            {'\n'}• <Text style={styles.bold}>Development Build</Text>: Full push notifications
            {'\n'}• <Text style={styles.bold}>Physical Device</Text>: Real push notifications
          </Text>
        </View>

        <View style={styles.instructions}>
          <Text style={styles.instructionsTitle}>🎯 Next Steps</Text>
          <Text style={styles.instructionsText}>
            1. Test on web: <Text style={styles.code}>npx expo start --web</Text>
            {'\n'}2. Create dev build: <Text style={styles.code}>eas build --platform android --profile development</Text>
            {'\n'}3. Test on physical device with development build
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    maxHeight: 500,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  modeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderLeftWidth: 3,
  },
  modeText: {
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 6,
    flex: 1,
  },
  scrollView: {
    maxHeight: 350,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
  },
  buttonText: {
    fontSize: 14,
    marginLeft: 12,
    color: '#333',
    fontWeight: '500',
  },
  instructions: {
    padding: 16,
    backgroundColor: '#f8f9fa',
    margin: 16,
    borderRadius: 8,
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  instructionsText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#666',
  },
  bold: {
    fontWeight: 'bold',
    color: '#333',
  },
  code: {
    fontFamily: 'monospace',
    backgroundColor: '#e8e8e8',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    fontSize: 11,
  },
  showButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    zIndex: 1000,
  },
  showButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default NotificationTester;
