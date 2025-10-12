import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';
import { useAuth } from '../utils/AuthContext';
import { useTenant } from '../contexts/TenantContext';

/**
 * Admin Notification Tester Component
 * Use this component to test if admin notification management creates proper push notifications
 */
const AdminNotificationTester = () => {
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState(null);

  const runGeneralTest = async () => {
    await runNotificationTest('General', '🔔 This is a test notification from admin - General type');
  };

  const runUrgentTest = async () => {
    await runNotificationTest('Urgent', '⚠️ This is a test URGENT notification from admin - Please check!');
  };

  const runEventTest = async () => {
    await runNotificationTest('Event', '📅 Test school event notification - Annual day celebration on Friday!');
  };

  const runNotificationTest = async (type, message) => {
    try {
      setTesting(true);
      setResults(null);

      console.log(`🧪 [ADMIN NOTIFICATION TEST] Starting ${type} notification test...`);

      // Step 1: Check admin permissions
      if (!user?.id || !tenantId) {
        throw new Error('User not authenticated or tenant not available');
      }

      // Step 2: Check available users to send notifications to
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, role_id, email, full_name, linked_student_id, linked_parent_of')
        .eq('tenant_id', tenantId);

      if (usersError) {
        throw new Error(`Users query failed: ${usersError.message}`);
      }

      // Step 3: Check push tokens availability
      const userIds = users?.map(u => u.id) || [];
      const { data: tokens, error: tokensError } = await supabase
        .from('push_tokens')
        .select('id, user_id, is_active')
        .in('user_id', userIds)
        .eq('is_active', true);

      if (tokensError) {
        throw new Error(`Push tokens query failed: ${tokensError.message}`);
      }

      // Step 4: Create test notification (similar to NotificationManagement screen)
      console.log('📝 [ADMIN NOTIFICATION TEST] Creating test notification...');
      
      const notificationData = {
        type: type,
        message: message,
        delivery_mode: 'InApp',
        delivery_status: 'Pending',
        sent_by: user.id,
        tenant_id: tenantId
      };

      const { data: notification, error: notificationError } = await supabase
        .from('notifications')
        .insert(notificationData)
        .select()
        .single();

      if (notificationError) {
        throw new Error(`Notification creation failed: ${notificationError.message}`);
      }

      // Step 5: Create recipients (for students and parents only as per system design)
      const students = users?.filter(u => u.linked_student_id || u.role_id === 2) || []; // Assuming role_id 2 is student
      const parents = users?.filter(u => u.linked_parent_of || u.role_id === 3) || []; // Assuming role_id 3 is parent

      const recipients = [
        ...students.map(user => ({
          notification_id: notification.id,
          recipient_id: user.id,
          recipient_type: 'Student',
          delivery_status: 'Pending',
          tenant_id: tenantId
        })),
        ...parents.map(user => ({
          notification_id: notification.id,
          recipient_id: user.id,
          recipient_type: 'Parent',
          delivery_status: 'Pending',
          tenant_id: tenantId
        }))
      ];

      if (recipients.length > 0) {
        const { error: recipientsError } = await supabase
          .from('notification_recipients')
          .insert(recipients);

        if (recipientsError) {
          throw new Error(`Recipients creation failed: ${recipientsError.message}`);
        }
      }

      // Step 6: Simulate push notification sending (same as NotificationManagement)
      const recipientUserIds = recipients.map(r => r.recipient_id);
      const activeTokens = tokens?.filter(t => recipientUserIds.includes(t.user_id)) || [];

      console.log('📱 [ADMIN NOTIFICATION TEST] Simulating push notifications...');

      // This would normally send actual push notifications, but for testing we'll just count
      const testResults = {
        notificationCreated: !!notification.id,
        notificationId: notification.id,
        totalUsers: users?.length || 0,
        studentUsers: students.length,
        parentUsers: parents.length,
        totalRecipients: recipients.length,
        activeTokens: activeTokens.length,
        tokenUsers: tokens?.length || 0,
        type: type,
        message: message
      };

      setResults(testResults);

      let alertMessage = `✅ Test notification created successfully!\n\n`;
      alertMessage += `📊 Statistics:\n`;
      alertMessage += `• Total users in system: ${testResults.totalUsers}\n`;
      alertMessage += `• Students: ${testResults.studentUsers}\n`;
      alertMessage += `• Parents: ${testResults.parentUsers}\n`;
      alertMessage += `• Recipients created: ${testResults.totalRecipients}\n`;
      alertMessage += `• Active push tokens: ${testResults.activeTokens}\n\n`;
      alertMessage += `📱 Push notifications would be sent to ${testResults.activeTokens} device(s)`;

      Alert.alert('Test Successful!', alertMessage, [{ text: 'OK' }]);

    } catch (error) {
      console.error(`❌ ${type} notification test failed:`, error);
      Alert.alert(
        `❌ ${type} Test Failed`,
        error.message,
        [{ text: 'OK' }]
      );
    } finally {
      setTesting(false);
    }
  };

  const checkSystemStatus = async () => {
    try {
      setTesting(true);
      console.log('🔍 [ADMIN NOTIFICATION TEST] Checking system status...');

      const statusChecks = {
        userAuthenticated: !!user?.id,
        tenantAvailable: !!tenantId,
        usersInSystem: 0,
        activeTokens: 0,
        adminPermissions: false
      };

      // Check users
      if (tenantId) {
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('id')
          .eq('tenant_id', tenantId);
        
        if (!usersError) {
          statusChecks.usersInSystem = users?.length || 0;
        }

        // Check tokens
        if (users && users.length > 0) {
          const { data: tokens, error: tokensError } = await supabase
            .from('push_tokens')
            .select('id')
            .in('user_id', users.map(u => u.id))
            .eq('is_active', true);
          
          if (!tokensError) {
            statusChecks.activeTokens = tokens?.length || 0;
          }
        }

        // Check admin permissions (try to query notifications table)
        const { error: permError } = await supabase
          .from('notifications')
          .select('id')
          .eq('tenant_id', tenantId)
          .limit(1);
        
        statusChecks.adminPermissions = !permError;
      }

      let statusMessage = `🔍 System Status Check:\n\n`;
      statusMessage += `${statusChecks.userAuthenticated ? '✅' : '❌'} User authenticated\n`;
      statusMessage += `${statusChecks.tenantAvailable ? '✅' : '❌'} Tenant context available\n`;
      statusMessage += `${statusChecks.usersInSystem > 0 ? '✅' : '❌'} Users in system (${statusChecks.usersInSystem})\n`;
      statusMessage += `${statusChecks.activeTokens > 0 ? '✅' : '⚠️'} Active push tokens (${statusChecks.activeTokens})\n`;
      statusMessage += `${statusChecks.adminPermissions ? '✅' : '❌'} Admin permissions\n\n`;

      if (statusChecks.userAuthenticated && statusChecks.tenantAvailable && 
          statusChecks.usersInSystem > 0 && statusChecks.adminPermissions) {
        statusMessage += `🎉 System ready for push notifications!`;
        if (statusChecks.activeTokens === 0) {
          statusMessage += `\n\n⚠️ Note: No active push tokens found. Users need to use the app on physical devices to receive push notifications.`;
        }
      } else {
        statusMessage += `❌ System not ready. Please check the failed items above.`;
      }

      Alert.alert('System Status', statusMessage, [{ text: 'OK' }]);

    } catch (error) {
      console.error('❌ System status check failed:', error);
      Alert.alert('Status Check Failed', error.message, [{ text: 'OK' }]);
    } finally {
      setTesting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="settings" size={24} color="#9C27B0" />
        <Text style={styles.title}>Admin Notification Tester</Text>
      </View>
      
      <Text style={styles.description}>
        Test the admin notification management system to verify it creates proper in-app notifications and sends push notifications to user devices.
      </Text>

      <TouchableOpacity style={[styles.testButton, styles.statusButton]} onPress={checkSystemStatus} disabled={testing}>
        {testing ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
        )}
        <Text style={styles.testButtonText}>Check System Status</Text>
      </TouchableOpacity>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={[styles.testButton, styles.generalButton]} onPress={runGeneralTest} disabled={testing}>
          <Ionicons name="notifications" size={16} color="#FFFFFF" />
          <Text style={styles.testButtonText}>Test General</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.testButton, styles.urgentButton]} onPress={runUrgentTest} disabled={testing}>
          <Ionicons name="warning" size={16} color="#FFFFFF" />
          <Text style={styles.testButtonText}>Test Urgent</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.testButton, styles.eventButton]} onPress={runEventTest} disabled={testing}>
          <Ionicons name="calendar" size={16} color="#FFFFFF" />
          <Text style={styles.testButtonText}>Test Event</Text>
        </TouchableOpacity>
      </View>

      {results && (
        <ScrollView style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>Test Results</Text>
          
          <View style={styles.resultSection}>
            <Text style={styles.sectionTitle}>📊 System Stats</Text>
            <Text style={styles.resultText}>Total Users: {results.totalUsers}</Text>
            <Text style={styles.resultText}>Students: {results.studentUsers}</Text>
            <Text style={styles.resultText}>Parents: {results.parentUsers}</Text>
            <Text style={styles.resultText}>Active Push Tokens: {results.activeTokens}</Text>
          </View>

          <View style={styles.resultSection}>
            <Text style={styles.sectionTitle}>📧 Notification Created</Text>
            <Text style={[styles.resultText, { color: results.notificationCreated ? '#4CAF50' : '#F44336' }]}>
              Status: {results.notificationCreated ? 'SUCCESS' : 'FAILED'}
            </Text>
            <Text style={styles.resultText}>ID: {results.notificationId}</Text>
            <Text style={styles.resultText}>Type: {results.type}</Text>
            <Text style={styles.resultText}>Recipients: {results.totalRecipients}</Text>
          </View>

          <View style={styles.resultSection}>
            <Text style={styles.sectionTitle}>🔍 Next Steps</Text>
            <Text style={styles.resultText}>1. Check Notification Management screen for new notification</Text>
            <Text style={styles.resultText}>2. Verify user devices receive push notifications</Text>
            <Text style={styles.resultText}>3. Test actual notification creation through admin interface</Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    margin: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 10,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 20,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 10,
  },
  statusButton: {
    backgroundColor: '#9C27B0',
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  generalButton: {
    flex: 1,
    backgroundColor: '#607D8B',
  },
  urgentButton: {
    flex: 1,
    backgroundColor: '#F44336',
  },
  eventButton: {
    flex: 1,
    backgroundColor: '#9C27B0',
  },
  testButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
    textAlign: 'center',
  },
  resultsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 15,
    maxHeight: 300,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  resultSection: {
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
    marginBottom: 8,
  },
  resultText: {
    fontSize: 13,
    color: '#333',
    lineHeight: 18,
    marginBottom: 4,
  },
});

export default AdminNotificationTester;