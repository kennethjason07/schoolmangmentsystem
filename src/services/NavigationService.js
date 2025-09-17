import { createNavigationContainerRef } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * Navigation Service for handling navigation from push notifications
 * Provides global navigation capabilities outside of React components
 */

// Create navigation reference
export const navigationRef = createNavigationContainerRef();

class NavigationService {
  constructor() {
    this.currentRoute = null;
    this.currentRouteData = null;
  }

  /**
   * Navigate to a screen
   * @param {string} name - Screen name
   * @param {Object} params - Navigation parameters
   */
  navigate(name, params = {}) {
    if (navigationRef.isReady()) {
      navigationRef.navigate(name, params);
      this.setCurrentRoute(name, params);
    } else {
      console.warn('Navigation not ready');
    }
  }

  /**
   * Go back
   */
  goBack() {
    if (navigationRef.isReady() && navigationRef.canGoBack()) {
      navigationRef.goBack();
    }
  }

  /**
   * Reset navigation stack
   * @param {Object} state - Navigation state
   */
  reset(state) {
    console.log('🧭 [NavigationService] Reset called:', state);
    if (navigationRef.isReady()) {
      console.log('✅ [NavigationService] Navigation ref is ready, executing reset');
      try {
        navigationRef.reset(state);
        console.log('✅ [NavigationService] Reset completed successfully');
      } catch (error) {
        console.error('❌ [NavigationService] Error during reset:', error);
        // If reset fails, try direct navigation as fallback
        if (state && state.routes && state.routes[0]) {
          const targetRoute = state.routes[0].name;
          console.log('🧭 [NavigationService] Trying direct navigation to:', targetRoute);
          try {
            this.navigate(targetRoute, state.routes[0].params || {});
          } catch (navError) {
            console.error('❌ [NavigationService] Direct navigation also failed:', navError);
            // Last resort for web: reload the page
            this.handleWebNavigationFallback();
          }
        }
      }
    } else {
      console.warn('⚠️ [NavigationService] Navigation not ready, cannot reset');
      // Try to navigate to target screen directly if reset fails
      if (state && state.routes && state.routes[0]) {
        const targetRoute = state.routes[0].name;
        console.log('🧭 [NavigationService] Navigation not ready, trying direct navigation to:', targetRoute);
        try {
          this.navigate(targetRoute, state.routes[0].params || {});
        } catch (error) {
          console.error('❌ [NavigationService] Direct navigation failed:', error);
          // Last resort for web: reload the page
          this.handleWebNavigationFallback();
        }
      }
      
      // Additional web-specific fallback
      this.handleWebNavigationFallback();
    }
  }

  /**
   * Handle web navigation fallback with proper error checking
   */
  handleWebNavigationFallback() {
    if (Platform.OS === 'web') {
      console.log('🧭 [NavigationService] Additional web fallback - forcing navigation');
      // Check if window and window.location are properly defined
      if (typeof window !== 'undefined' && window && typeof window.location !== 'undefined' && window.location) {
        try {
          window.location.href = '/'; // Navigate to root
          return;
        } catch (locationError) {
          console.error('❌ [NavigationService] Error setting window.location.href:', locationError);
        }
      } else {
        console.error('❌ [NavigationService] window.location is not available for navigation');
      }
      
      // Additional fallback using setTimeout
      setTimeout(() => {
        if (typeof window !== 'undefined' && window && typeof window.location !== 'undefined' && window.location) {
          try {
            window.location.href = '/';
          } catch (delayedError) {
            console.error('❌ [NavigationService] Error setting delayed window.location.href:', delayedError);
          }
        } else {
          console.error('❌ [NavigationService] window.location is not available for delayed navigation');
        }
      }, 500);
    }
  }

  /**
   * Get current route name
   * @returns {string|null}
   */
  getCurrentRouteName() {
    if (navigationRef.isReady()) {
      return navigationRef.getCurrentRoute()?.name || null;
    }
    return this.currentRoute;
  }

  /**
   * Set current route for tracking
   * @param {string} routeName - Route name
   * @param {Object} params - Route parameters
   */
  async setCurrentRoute(routeName, params = {}) {
    this.currentRoute = routeName;
    this.currentRouteData = params;
    
    try {
      // Store in AsyncStorage for push notification service
      await AsyncStorage.setItem('currentRoute', routeName);
      await AsyncStorage.setItem('currentRouteData', JSON.stringify(params));
    } catch (error) {
      console.error('Error storing current route:', error);
    }
  }

  /**
   * Navigate to chat based on user types
   * @param {Object} params - Chat parameters
   */
  navigateToChat({
    senderId,
    senderName,
    senderType,
    receiverId,
    receiverName,
    receiverType,
  }) {
    // Determine the correct chat screen based on current user type
    const chatScreens = {
      'admin': this.getAdminChatScreen(senderType, receiverType),
      'teacher': this.getTeacherChatScreen(senderType, receiverType),
      'parent': this.getParentChatScreen(senderType, receiverType),
      'student': this.getStudentChatScreen(senderType, receiverType),
    };

    const currentUserType = this.getCurrentUserType(); // This would need to be set somewhere
    const screenName = chatScreens[currentUserType] || 'Chat';

    this.navigate(screenName, {
      senderId,
      senderName,
      senderType,
      receiverId,
      receiverName,
      receiverType,
    });
  }

  /**
   * Navigate to appropriate notifications screen
   * @param {string} userType - Current user type
   */
  navigateToNotifications(userType) {
    const notificationScreens = {
      'admin': 'AdminNotifications',
      'teacher': 'TeacherNotifications',
      'parent': 'ParentNotifications',
      'student': 'StudentNotifications',
    };

    const screenName = notificationScreens[userType.toLowerCase()] || 'StudentNotifications';
    this.navigate(screenName);
  }

  /**
   * Get appropriate chat screen for admin
   * @param {string} senderType - Sender type
   * @param {string} receiverType - Receiver type
   * @returns {string} - Screen name
   */
  getAdminChatScreen(senderType, receiverType) {
    // Admin can chat with anyone, use general Chat screen
    return 'Chat';
  }

  /**
   * Get appropriate chat screen for teacher
   * @param {string} senderType - Sender type
   * @param {string} receiverType - Receiver type
   * @returns {string} - Screen name
   */
  getTeacherChatScreen(senderType, receiverType) {
    // Teacher uses TeacherChat for all communications
    return 'Chat'; // This maps to TeacherChat in the tab navigator
  }

  /**
   * Get appropriate chat screen for parent
   * @param {string} senderType - Sender type
   * @param {string} receiverType - Receiver type
   * @returns {string} - Screen name
   */
  getParentChatScreen(senderType, receiverType) {
    // Parent uses ChatWithTeacher for all communications
    return 'Chat'; // This maps to ChatWithTeacher in the tab navigator
  }

  /**
   * Get appropriate chat screen for student
   * @param {string} senderType - Sender type
   * @param {string} receiverType - Receiver type
   * @returns {string} - Screen name
   */
  getStudentChatScreen(senderType, receiverType) {
    // Student uses StudentChatWithTeacher for all communications
    return 'Chat'; // This maps to StudentChatWithTeacher in the tab navigator
  }

  /**
   * Handle notification tap navigation
   * @param {Object} notificationData - Notification data
   */
  handleNotificationTap(notificationData) {
    const { type, senderId, senderName, senderType, userType } = notificationData;

    if (type === 'chat_message') {
      this.navigateToChat({
        senderId,
        senderName,
        senderType,
      });
    } else if (type === 'formal_notification') {
      this.navigateToNotifications(userType);
    }
  }

  /**
   * Set current user type (called from AuthContext)
   * @param {string} userType - Current user type
   */
  setCurrentUserType(userType) {
    this.currentUserType = userType;
  }

  /**
   * Get current user type
   * @returns {string} - Current user type
   */
  getCurrentUserType() {
    return this.currentUserType || 'student';
  }

  /**
   * Check if user is currently in a specific chat
   * @param {string} chatUserId - User ID to check
   * @returns {boolean}
   */
  isInChatWith(chatUserId) {
    const currentRoute = this.getCurrentRouteName();
    const isChatScreen = ['Chat', 'TeacherChat', 'ChatWithTeacher', 'StudentChatWithTeacher'].includes(currentRoute);
    
    if (!isChatScreen) return false;
    
    return this.currentRouteData?.senderId === chatUserId || 
           this.currentRouteData?.receiverId === chatUserId;
  }

  /**
   * Check if user is on notifications screen
   * @returns {boolean}
   */
  isOnNotificationsScreen() {
    const currentRoute = this.getCurrentRouteName();
    return currentRoute?.includes('Notifications') || false;
  }

  /**
   * Navigate with fallback handling
   * @param {string} screenName - Primary screen to navigate to
   * @param {string} fallbackScreen - Fallback screen if primary fails
   * @param {Object} params - Navigation parameters
   */
  navigateWithFallback(screenName, fallbackScreen, params = {}) {
    try {
      this.navigate(screenName, params);
    } catch (error) {
      console.warn(`Navigation to ${screenName} failed, trying fallback:`, error);
      try {
        this.navigate(fallbackScreen, params);
      } catch (fallbackError) {
        console.error('Fallback navigation also failed:', fallbackError);
      }
    }
  }
}

// Export singleton instance
const navigationService = new NavigationService();

// Set up global reference
global.navigationRef = navigationRef;
global.navigationService = navigationService;

export { navigationService };
export default navigationService;
