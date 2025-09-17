import { createNavigationContainerRef } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
    if (navigationRef.isReady()) {
      navigationRef.reset(state);
    } else {
      // For web, if navigation isn't ready, try direct URL navigation as fallback
      if (typeof window !== 'undefined') {
        const routeName = state?.routes?.[state.index || 0]?.name;
        if (routeName === 'Login') {
          // For login, redirect to root which should show login
          window.location.href = '/';
        }
      }
      console.warn('Navigation not ready for reset');
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
