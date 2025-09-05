import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import Header from '../../components/Header';
import { useAuth } from '../../utils/AuthContext';
import pushNotificationService from '../../services/PushNotificationService';

/**
 * NotificationSettings - Comprehensive settings screen for push notifications
 * Allows users to configure all notification preferences similar to WhatsApp
 */
const NotificationSettings = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const [settings, setSettings] = useState({
    // Chat message settings
    chat_messages: true,
    chat_sound: true,
    chat_vibration: true,

    // Formal notification settings
    formal_notifications: true,
    formal_sound: true,
    formal_vibration: true,

    // Urgent notification settings
    urgent_notifications: true,
    urgent_sound: true,
    urgent_vibration: true,

    // Specific notification types
    exam_notifications: true,
    attendance_notifications: true,
    fee_notifications: true,
    assignment_notifications: true,
    announcement_notifications: true,

    // Time-based settings
    quiet_hours_enabled: false,
    quiet_hours_start: new Date(0, 0, 0, 22, 0), // 10:00 PM
    quiet_hours_end: new Date(0, 0, 0, 7, 0),   // 7:00 AM

    // Weekend settings
    weekend_notifications: true,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  /**
   * Load user's notification settings
   */
  const loadSettings = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('user_notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found error is okay
        console.error('Error loading notification settings:', error);
        return;
      }

      if (data) {
        setSettings(prevSettings => ({
          ...prevSettings,
          ...data,
          quiet_hours_start: data.quiet_hours_start 
            ? parseTimeString(data.quiet_hours_start)
            : prevSettings.quiet_hours_start,
          quiet_hours_end: data.quiet_hours_end 
            ? parseTimeString(data.quiet_hours_end)
            : prevSettings.quiet_hours_end,
        }));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      Alert.alert('Error', 'Failed to load notification settings');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Parse time string to Date object
   * @param {string} timeString - Time string in HH:MM:SS format
   * @returns {Date} - Date object
   */
  const parseTimeString = (timeString) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    return new Date(0, 0, 0, hours, minutes);
  };

  /**
   * Format Date object to time string
   * @param {Date} date - Date object
   * @returns {string} - Time string in HH:MM:SS format
   */
  const formatTimeString = (date) => {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:00`;
  };

  /**
   * Save notification settings
   */
  const saveSettings = async () => {
    try {
      setSaving(true);

      const settingsToSave = {
        ...settings,
        quiet_hours_start: formatTimeString(settings.quiet_hours_start),
        quiet_hours_end: formatTimeString(settings.quiet_hours_end),
      };

      const success = await pushNotificationService.updateNotificationSettings(
        user.id, 
        settingsToSave
      );

      if (success) {
        Alert.alert('Success', 'Notification settings saved successfully');
      } else {
        Alert.alert('Error', 'Failed to save notification settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save notification settings');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Update a setting value
   * @param {string} key - Setting key
   * @param {*} value - New value
   */
  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  /**
   * Request notification permissions
   */
  const requestPermissions = async () => {
    try {
      const granted = await pushNotificationService.initialize(user.id, user.userType);
      if (granted) {
        Alert.alert('Success', 'Push notification permissions granted');
      } else {
        Alert.alert(
          'Permissions Required', 
          'Please enable push notifications in your device settings to receive notifications.'
        );
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
      Alert.alert('Error', 'Failed to request notification permissions');
    }
  };

  /**
   * Show permission info alert
   */
  const showPermissionInfo = () => {
    Alert.alert(
      'Notification Permissions',
      'Push notifications allow you to receive important messages and updates even when the app is closed. You can control what types of notifications you receive below.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Grant Permission', onPress: requestPermissions },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Notification Settings" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Notification Settings" showBack={true} />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Permission Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Permissions</Text>
          <TouchableOpacity style={styles.permissionItem} onPress={showPermissionInfo}>
            <View style={styles.permissionIconContainer}>
              <Ionicons name="notifications" size={24} color="#2196F3" />
            </View>
            <View style={styles.permissionContent}>
              <Text style={styles.permissionTitle}>Push Notifications</Text>
              <Text style={styles.permissionSubtitle}>
                Allow this app to send you notifications
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Chat Messages Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Chat Messages</Text>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Message Notifications</Text>
            <Switch
              value={settings.chat_messages}
              onValueChange={(value) => updateSetting('chat_messages', value)}
              trackColor={{ false: '#767577', true: '#2196F3' }}
              thumbColor={settings.chat_messages ? '#fff' : '#f4f3f4'}
            />
          </View>

          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Sound</Text>
            <Switch
              value={settings.chat_sound && settings.chat_messages}
              onValueChange={(value) => updateSetting('chat_sound', value)}
              disabled={!settings.chat_messages}
              trackColor={{ false: '#767577', true: '#2196F3' }}
              thumbColor={settings.chat_sound ? '#fff' : '#f4f3f4'}
            />
          </View>

          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Vibration</Text>
            <Switch
              value={settings.chat_vibration && settings.chat_messages}
              onValueChange={(value) => updateSetting('chat_vibration', value)}
              disabled={!settings.chat_messages}
              trackColor={{ false: '#767577', true: '#2196F3' }}
              thumbColor={settings.chat_vibration ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* School Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>School Notifications</Text>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>General Notifications</Text>
            <Switch
              value={settings.formal_notifications}
              onValueChange={(value) => updateSetting('formal_notifications', value)}
              trackColor={{ false: '#767577', true: '#2196F3' }}
              thumbColor={settings.formal_notifications ? '#fff' : '#f4f3f4'}
            />
          </View>

          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Exam Notifications</Text>
            <Switch
              value={settings.exam_notifications}
              onValueChange={(value) => updateSetting('exam_notifications', value)}
              trackColor={{ false: '#767577', true: '#2196F3' }}
              thumbColor={settings.exam_notifications ? '#fff' : '#f4f3f4'}
            />
          </View>

          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Attendance Notifications</Text>
            <Switch
              value={settings.attendance_notifications}
              onValueChange={(value) => updateSetting('attendance_notifications', value)}
              trackColor={{ false: '#767577', true: '#2196F3' }}
              thumbColor={settings.attendance_notifications ? '#fff' : '#f4f3f4'}
            />
          </View>

          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Fee Notifications</Text>
            <Switch
              value={settings.fee_notifications}
              onValueChange={(value) => updateSetting('fee_notifications', value)}
              trackColor={{ false: '#767577', true: '#2196F3' }}
              thumbColor={settings.fee_notifications ? '#fff' : '#f4f3f4'}
            />
          </View>

          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Assignment Notifications</Text>
            <Switch
              value={settings.assignment_notifications}
              onValueChange={(value) => updateSetting('assignment_notifications', value)}
              trackColor={{ false: '#767577', true: '#2196F3' }}
              thumbColor={settings.assignment_notifications ? '#fff' : '#f4f3f4'}
            />
          </View>

          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Announcement Notifications</Text>
            <Switch
              value={settings.announcement_notifications}
              onValueChange={(value) => updateSetting('announcement_notifications', value)}
              trackColor={{ false: '#767577', true: '#2196F3' }}
              thumbColor={settings.announcement_notifications ? '#fff' : '#f4f3f4'}
            />
          </View>

          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Sound</Text>
            <Switch
              value={settings.formal_sound && settings.formal_notifications}
              onValueChange={(value) => updateSetting('formal_sound', value)}
              disabled={!settings.formal_notifications}
              trackColor={{ false: '#767577', true: '#2196F3' }}
              thumbColor={settings.formal_sound ? '#fff' : '#f4f3f4'}
            />
          </View>

          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Vibration</Text>
            <Switch
              value={settings.formal_vibration && settings.formal_notifications}
              onValueChange={(value) => updateSetting('formal_vibration', value)}
              disabled={!settings.formal_notifications}
              trackColor={{ false: '#767577', true: '#2196F3' }}
              thumbColor={settings.formal_vibration ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Urgent Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Urgent Notifications</Text>
          <Text style={styles.sectionSubtitle}>
            Emergency alerts and urgent school communications
          </Text>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Urgent Notifications</Text>
            <Switch
              value={settings.urgent_notifications}
              onValueChange={(value) => updateSetting('urgent_notifications', value)}
              trackColor={{ false: '#767577', true: '#F44336' }}
              thumbColor={settings.urgent_notifications ? '#fff' : '#f4f3f4'}
            />
          </View>

          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Sound</Text>
            <Switch
              value={settings.urgent_sound && settings.urgent_notifications}
              onValueChange={(value) => updateSetting('urgent_sound', value)}
              disabled={!settings.urgent_notifications}
              trackColor={{ false: '#767577', true: '#F44336' }}
              thumbColor={settings.urgent_sound ? '#fff' : '#f4f3f4'}
            />
          </View>

          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Vibration</Text>
            <Switch
              value={settings.urgent_vibration && settings.urgent_notifications}
              onValueChange={(value) => updateSetting('urgent_vibration', value)}
              disabled={!settings.urgent_notifications}
              trackColor={{ false: '#767577', true: '#F44336' }}
              thumbColor={settings.urgent_vibration ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Quiet Hours Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quiet Hours</Text>
          <Text style={styles.sectionSubtitle}>
            Disable notifications during specified hours (urgent notifications will still come through)
          </Text>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Enable Quiet Hours</Text>
            <Switch
              value={settings.quiet_hours_enabled}
              onValueChange={(value) => updateSetting('quiet_hours_enabled', value)}
              trackColor={{ false: '#767577', true: '#2196F3' }}
              thumbColor={settings.quiet_hours_enabled ? '#fff' : '#f4f3f4'}
            />
          </View>

          {settings.quiet_hours_enabled && (
            <>
              <TouchableOpacity
                style={styles.timePickerItem}
                onPress={() => setShowStartTimePicker(true)}
              >
                <Text style={styles.settingLabel}>Start Time</Text>
                <Text style={styles.timeText}>
                  {settings.quiet_hours_start.toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: true 
                  })}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.timePickerItem}
                onPress={() => setShowEndTimePicker(true)}
              >
                <Text style={styles.settingLabel}>End Time</Text>
                <Text style={styles.timeText}>
                  {settings.quiet_hours_end.toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: true 
                  })}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Weekend Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Weekend Settings</Text>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Weekend Notifications</Text>
            <Switch
              value={settings.weekend_notifications}
              onValueChange={(value) => updateSetting('weekend_notifications', value)}
              trackColor={{ false: '#767577', true: '#2196F3' }}
              thumbColor={settings.weekend_notifications ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Save Button */}
        <View style={styles.saveButtonContainer}>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={saveSettings}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>Save Settings</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Time Pickers */}
      {showStartTimePicker && (
        <DateTimePicker
          value={settings.quiet_hours_start}
          mode="time"
          is24Hour={false}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedTime) => {
            setShowStartTimePicker(Platform.OS === 'ios');
            if (selectedTime) {
              updateSetting('quiet_hours_start', selectedTime);
            }
          }}
        />
      )}

      {showEndTimePicker && (
        <DateTimePicker
          value={settings.quiet_hours_end}
          mode="time"
          is24Hour={false}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedTime) => {
            setShowEndTimePicker(Platform.OS === 'ios');
            if (selectedTime) {
              updateSetting('quiet_hours_end', selectedTime);
            }
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 16,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
    marginHorizontal: 16,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    marginHorizontal: 16,
    lineHeight: 20,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  permissionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  permissionContent: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  permissionSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
  },
  timePickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  timeText: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '600',
  },
  saveButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  saveButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default NotificationSettings;
