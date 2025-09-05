import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../utils/AuthContext';
import { supabase } from '../utils/supabase';
import UniversalNotificationBadge from './UniversalNotificationBadge';
import DebugBadge from './DebugBadge';
import universalNotificationService from '../services/UniversalNotificationService';

const Header = ({ title, showBack = false, showProfile = true, showNotifications = false, onProfilePress, onNotificationsPress, unreadCount = 0, rightComponent }) => {
  const navigation = useNavigation();
  const { user: authUser, userType } = useAuth();
  const [userProfileUrl, setUserProfileUrl] = useState(null);

  // Get the appropriate notification screen based on user type
  const getNotificationScreen = () => {
    if (userType) {
      return universalNotificationService.getNotificationScreen(userType);
    }
    return 'ParentNotifications'; // fallback
  };

  // Function to load user profile image
  const loadUserProfile = async () => {
    if (!authUser) return;
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('profile_url')
        .eq('id', authUser.id)
        .single();
      
      if (!error && data?.profile_url) {
        setUserProfileUrl(data.profile_url);
      } else {
        setUserProfileUrl(null);
      }
    } catch (error) {
      console.log('Error loading profile:', error);
      setUserProfileUrl(null);
    }
  };

  // Load profile image when component mounts
  useEffect(() => {
    loadUserProfile();

    // Subscribe to profile updates
    const subscription = supabase
      .channel('header-profile-updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'users',
        filter: `id=eq.${authUser?.id}`
      }, (payload) => {
        if (payload.new?.profile_url) {
          setUserProfileUrl(payload.new.profile_url);
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [authUser]);

  // Reload profile image when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadUserProfile();
    }, [authUser])
  );

  return (
    <View style={styles.header}>
      <View style={styles.leftSection}>
        {showBack && navigation.canGoBack() && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
        )}
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.rightSection}>
        {/* Custom right component takes priority */}
        {rightComponent ? (
          rightComponent()
        ) : (
          <>
            {showNotifications && (
              <TouchableOpacity 
                onPress={onNotificationsPress || (() => navigation.navigate(getNotificationScreen()))}
                style={styles.notificationButton}
              >
                <Ionicons 
                  name="notifications" 
                  size={24} 
                  color="#333"
                />
                <UniversalNotificationBadge />
              </TouchableOpacity>
            )}
            {showProfile && authUser && userType && (
              <TouchableOpacity 
                onPress={onProfilePress || (() => {
                  try {
                    navigation.navigate('Profile');
                  } catch (error) {
                    console.warn('Profile navigation failed:', error);
                    // Fallback to settings if Profile isn't available
                    try {
                      navigation.navigate('Settings');
                    } catch (settingsError) {
                      console.warn('Settings navigation also failed:', settingsError);
                    }
                  }
                })} 
                style={styles.profileButton}
              >
                {userProfileUrl ? (
                  <Image 
                    source={{ uri: userProfileUrl }} 
                    style={styles.profileImage}
                    onError={() => setUserProfileUrl(null)}
                  />
                ) : (
                  <Ionicons name="person-circle" size={32} color="#2196F3" />
                )}
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    paddingTop: Platform.OS === 'android' ? 48 : 24,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 12,
    flexShrink: 1,
  },
  profileButton: {
    padding: 4,
    marginRight: 12,
    flexShrink: 0,
  },
  profileImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  notificationButton: {
    position: 'relative',
    marginRight: 12,
    padding: 4,
  },
});

export default Header; 