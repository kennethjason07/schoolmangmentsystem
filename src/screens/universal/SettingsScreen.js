import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../utils/AuthContext';
import { supabase } from '../../utils/supabase';
import { format } from 'date-fns';

const SettingsScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    notifications: true,
    darkMode: false,
    biometric: false,
    language: 'en'
  });
  const [appVersion, setAppVersion] = useState('1.0.0');
  const { signOut, user: authUser } = useAuth();

  // Load settings from Supabase
  const loadSettings = async () => {
    try {
      setLoading(true);
      
      if (!authUser) {
        console.log('No authenticated user found');
        return;
      }

      // Get user settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (settingsError && settingsError.code !== 'PGRST116') {
        throw settingsError;
      }

      if (settingsData) {
        setSettings({
          notifications: settingsData.notifications || true,
          darkMode: settingsData.dark_mode || false,
          biometric: settingsData.biometric || false,
          language: settingsData.language || 'en',
        });
      }

      // Get app version
      const { data: versionData, error: versionError } = await supabase
        .from('app_versions')
        .select('version')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (versionError && versionError.code !== 'PGRST116') {
        throw versionError;
      }
      if (versionData) {
        setAppVersion(versionData.version);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      Alert.alert('Error', 'Failed to load settings. Using default values.');
    } finally {
      setLoading(false);
    }
  };

  // Subscribe to real-time updates
  useEffect(() => {
    loadSettings();

    const subscription = supabase
      .channel('settings-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_settings'
      }, () => {
        loadSettings();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);


  const handleLogout = async () => {
    try {
      Alert.alert(
        'Logout',
        'Are you sure you want to logout?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Logout',
            style: 'destructive',
            onPress: async () => {
              try {
                await signOut();
              } catch (error) {
                console.error('Logout error:', error);
                Alert.alert('Error', 'Failed to logout. Please try again.');
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to logout. Please try again.');
    }
  };

  const renderSettingItem = (icon, title, subtitle, onPress, showSwitch = false, switchValue = false, onSwitchChange = null) => (
    <TouchableOpacity style={styles.settingItem} onPress={onPress} disabled={showSwitch}>
      <View style={styles.settingItemLeft}>
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={24} color="#1976d2" />
        </View>
        <View style={styles.settingTextContainer}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {showSwitch ? (
        <Switch
          value={switchValue}
          onValueChange={(value) => {
            onSwitchChange(value);
          }}
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={switchValue ? '#1976d2' : '#f4f3f4'}
        />
      ) : (
        <Ionicons name="chevron-forward" size={20} color="#666" />
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1976d2" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1976d2" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadSettings} />
        }
      >
        {/* Account Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          {renderSettingItem('person-outline', 'Profile', 'Manage your profile information', () => navigation.navigate('Profile'))}
          {renderSettingItem('lock-closed-outline', 'Change Password', 'Update your password', () => navigation.navigate('ChangePassword'))}
          {renderSettingItem('finger-print-outline', 'Biometric Login', 'Use fingerprint or face ID', null, true, settings.biometric, (value) => setSettings(prev => ({ ...prev, biometric: value })))}
        </View>

        {/* App Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Settings</Text>
          {renderSettingItem('notifications-outline', 'Notifications', 'Manage notification preferences', null, true, settings.notifications, (value) => setSettings(prev => ({ ...prev, notifications: value })))}
          {renderSettingItem('moon-outline', 'Dark Mode', 'Switch to dark theme', null, true, settings.darkMode, (value) => setSettings(prev => ({ ...prev, darkMode: value })))}
          {renderSettingItem('language-outline', 'Language', settings.language.toUpperCase(), () => navigation.navigate('LanguageSettings'))}
        </View>

        {/* Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          {renderSettingItem('help-circle-outline', 'Help Center', 'Get help and support', () => navigation.navigate('HelpCenter'))}
          {renderSettingItem('mail-outline', 'Feedback', 'Send feedback', () => navigation.navigate('Feedback'))}
          {renderSettingItem('bug-outline', 'Report a Bug', 'Report issues', () => navigation.navigate('ReportBug'))}
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          {renderSettingItem('information-circle-outline', 'About App', `Version ${appVersion}`, () => navigation.navigate('About'))}
          {renderSettingItem('shield-checkmark-outline', 'Privacy Policy', 'View privacy policy', () => navigation.navigate('PrivacyPolicy'))}
          {renderSettingItem('document-text-outline', 'Terms of Service', 'View terms of service', () => navigation.navigate('Terms'))}
        </View>

        {/* Logout */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <View style={styles.logoutIconContainer}>
              <Ionicons name="log-out-outline" size={24} color="#fff" />
            </View>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  headerRight: {
    width: 24,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976d2',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  settingItemLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#dc3545',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  logoutIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'white',
  },
});

export default SettingsScreen;