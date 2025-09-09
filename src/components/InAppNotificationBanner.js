import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Dimensions,
  Platform,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

const { width: screenWidth } = Dimensions.get('window');

/**
 * InAppNotificationBanner - WhatsApp-style notification banner
 * Shows at the top of the screen when user receives notifications while app is active
 */
const InAppNotificationBanner = () => {
  const [notifications, setNotifications] = useState([]);
  const [currentNotification, setCurrentNotification] = useState(null);
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef(null);
  
  const navigation = useNavigation();
  
  // Safe area insets with fallback
  let insets;
  try {
    insets = useSafeAreaInsets();
  } catch (error) {
    console.warn('SafeAreaProvider not found, using fallback values:', error);
    insets = {
      top: Platform.OS === 'ios' ? 47 : StatusBar.currentHeight || 24,
      bottom: Platform.OS === 'ios' ? 34 : 0,
      left: 0,
      right: 0,
    };
  }

  useEffect(() => {
    // Set up global notification handler
    global.showNotificationBanner = (notification) => {
      addNotification(notification);
    };

    return () => {
      // Cleanup
      global.showNotificationBanner = null;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const addNotification = (notification) => {
    setNotifications(prev => [...prev, { ...notification, id: Date.now() + Math.random() }]);
  };

  // Process notification queue
  useEffect(() => {
    if (notifications.length > 0 && !currentNotification) {
      const nextNotification = notifications[0];
      setCurrentNotification(nextNotification);
      setNotifications(prev => prev.slice(1));
      showBanner(nextNotification);
    }
  }, [notifications, currentNotification]);

  const showBanner = (notification) => {
    // Slide down animation
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto hide after duration
    timeoutRef.current = setTimeout(() => {
      hideBanner();
    }, notification.duration || 4000);
  };

  const hideBanner = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Slide up animation
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentNotification(null);
      // Reset animation values for next notification
      slideAnim.setValue(-100);
      opacityAnim.setValue(0);
    });
  };

  const handleBannerPress = () => {
    if (!currentNotification?.data) return;
    
    hideBanner();
    
    // Navigate based on notification type
    const { data } = currentNotification;
    
    if (data.type === 'chat_message') {
      // Navigate to chat with sender
      if (data.senderType === 'teacher') {
        navigation.navigate('Chat', {
          senderId: data.senderId,
          senderName: data.senderName,
          senderType: data.senderType,
        });
      } else if (data.senderType === 'parent') {
        navigation.navigate('ChatWithTeacher', {
          senderId: data.senderId,
          senderName: data.senderName,
          senderType: data.senderType,
        });
      } else if (data.senderType === 'student') {
        navigation.navigate('StudentChatWithTeacher', {
          senderId: data.senderId,
          senderName: data.senderName,
          senderType: data.senderType,
        });
      }
    } else if (data.type === 'formal_notification') {
      // Navigate to appropriate notifications screen
      const notificationScreens = {
        'admin': 'AdminNotifications',
        'teacher': 'TeacherNotifications',
        'parent': 'ParentNotifications',
        'student': 'StudentNotifications'
      };
      
      const screenName = notificationScreens[data.userType?.toLowerCase()];
      if (screenName) {
        navigation.navigate(screenName);
      }
    }
  };

  const handleClosePress = () => {
    hideBanner();
  };

  if (!currentNotification) {
    return null;
  }

  const getNotificationIcon = () => {
    if (currentNotification.data?.type === 'chat_message') {
      return 'chatbubble';
    } else if (currentNotification.data?.type === 'formal_notification') {
      if (currentNotification.data?.isUrgent) {
        return 'warning';
      }
      return 'notifications';
    }
    return 'information-circle';
  };

  const getNotificationColor = () => {
    if (currentNotification.data?.type === 'chat_message') {
      return '#2196F3';
    } else if (currentNotification.data?.type === 'formal_notification') {
      if (currentNotification.data?.isUrgent) {
        return '#F44336';
      }
      return '#FF9800';
    }
    return '#4CAF50';
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: insets.top,
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
          pointerEvents: currentNotification ? 'auto' : 'none',
        },
      ]}
    >
      <TouchableOpacity
        style={[styles.banner, { backgroundColor: getNotificationColor() }]}
        onPress={handleBannerPress}
        activeOpacity={0.9}
      >
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons 
              name={getNotificationIcon()} 
              size={24} 
              color="#fff" 
            />
          </View>
          
          <View style={styles.textContainer}>
            <Text style={styles.title} numberOfLines={1}>
              {currentNotification.title}
            </Text>
            <Text style={styles.body} numberOfLines={2}>
              {currentNotification.body}
            </Text>
          </View>
          
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={handleClosePress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        
        {/* Progress bar */}
        <Animated.View style={styles.progressBar}>
          <Animated.View 
            style={[
              styles.progress,
              {
                width: slideAnim.interpolate({
                  inputRange: [-100, 0],
                  outputRange: ['0%', '100%'],
                  extrapolate: 'clamp',
                }),
              }
            ]} 
          />
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingHorizontal: 10,
  },
  banner: {
    borderRadius: 12,
    marginHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconContainer: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  body: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 18,
  },
  closeButton: {
    padding: 4,
  },
  progressBar: {
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  progress: {
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
});

export default InAppNotificationBanner;
