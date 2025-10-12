import chatPushNotificationService from '../services/ChatPushNotificationService';
import { getCachedTenantId } from './tenantHelpers';

/**
 * Debug utility for testing ChatPushNotificationService
 * Use this to test and debug push notification issues
 */
export const debugChatNotifications = {
  /**
   * Test basic service functionality
   */
  async testService() {
    console.log('🧪 [DEBUG] Testing ChatPushNotificationService...');
    
    try {
      // Test initialization
      const initResult = await chatPushNotificationService.initialize();
      console.log('✅ [DEBUG] Service initialization:', initResult);
      
      // Test tenant ID
      const tenantId = getCachedTenantId();
      console.log('🏢 [DEBUG] Tenant ID:', tenantId);
      
      return { 
        success: true, 
        initialized: initResult,
        tenantId: tenantId
      };
    } catch (error) {
      console.error('❌ [DEBUG] Service test failed:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  },

  /**
   * Test getUserInfo function with safety checks
   */
  async testGetUserInfo(userId) {
    console.log('🧪 [DEBUG] Testing getUserInfo for:', userId);
    
    try {
      if (!userId) {
        console.warn('⚠️ [DEBUG] No userId provided');
        return { success: false, error: 'No userId provided' };
      }

      const tenantId = getCachedTenantId();
      if (!tenantId) {
        console.warn('⚠️ [DEBUG] No tenant ID available');
        return { success: false, error: 'No tenant ID available' };
      }

      console.log('🔍 [DEBUG] Looking up user:', userId, 'in tenant:', tenantId);
      
      const userInfo = await chatPushNotificationService.getUserInfo(userId, tenantId);
      
      if (userInfo) {
        console.log('✅ [DEBUG] User info found:', userInfo);
        return { success: true, userInfo };
      } else {
        console.warn('⚠️ [DEBUG] No user info returned');
        return { success: false, error: 'No user info returned' };
      }
    } catch (error) {
      console.error('❌ [DEBUG] getUserInfo test failed:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Test getUserPushTokens function
   */
  async testGetUserPushTokens(userId) {
    console.log('🧪 [DEBUG] Testing getUserPushTokens for:', userId);
    
    try {
      if (!userId) {
        console.warn('⚠️ [DEBUG] No userId provided');
        return { success: false, error: 'No userId provided' };
      }

      const tenantId = getCachedTenantId();
      if (!tenantId) {
        console.warn('⚠️ [DEBUG] No tenant ID available');
        return { success: false, error: 'No tenant ID available' };
      }

      const tokens = await chatPushNotificationService.getUserPushTokens(userId, tenantId);
      
      console.log('📱 [DEBUG] Push tokens found:', tokens?.length || 0);
      
      if (tokens && tokens.length > 0) {
        console.log('✅ [DEBUG] Token details:', tokens.map(t => ({
          platform: t.platform,
          hasToken: !!t.token,
          tokenLength: t.token?.length || 0
        })));
      }
      
      return { success: true, tokenCount: tokens?.length || 0, tokens };
    } catch (error) {
      console.error('❌ [DEBUG] getUserPushTokens test failed:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Test sending a notification with full error tracking
   */
  async testSendNotification(senderId, receiverId, message = 'Test message') {
    console.log('🧪 [DEBUG] Testing send notification:', { senderId, receiverId, message });
    
    try {
      // Validate inputs
      if (!senderId || !receiverId) {
        console.error('❌ [DEBUG] Missing senderId or receiverId');
        return { success: false, error: 'Missing senderId or receiverId' };
      }

      // Test user info for both users
      const [senderTest, receiverTest] = await Promise.all([
        this.testGetUserInfo(senderId),
        this.testGetUserInfo(receiverId)
      ]);

      console.log('👤 [DEBUG] Sender test result:', senderTest);
      console.log('👤 [DEBUG] Receiver test result:', receiverTest);

      if (!senderTest.success) {
        return { success: false, error: 'Sender user info failed: ' + senderTest.error };
      }

      if (!receiverTest.success) {
        return { success: false, error: 'Receiver user info failed: ' + receiverTest.error };
      }

      // Test push tokens for receiver
      const tokenTest = await this.testGetUserPushTokens(receiverId);
      console.log('📱 [DEBUG] Receiver token test:', tokenTest);

      if (!tokenTest.success) {
        return { success: false, error: 'Receiver push tokens failed: ' + tokenTest.error };
      }

      if (tokenTest.tokenCount === 0) {
        console.warn('⚠️ [DEBUG] No push tokens found for receiver - notification will not be sent');
        return { success: false, error: 'No push tokens found for receiver' };
      }

      // Attempt to send notification
      const result = await chatPushNotificationService.sendChatMessageNotification({
        senderId,
        receiverId,
        message,
        messageType: 'text',
        studentId: null
      });

      console.log('📤 [DEBUG] Send notification result:', result);
      
      return { 
        success: result, 
        senderInfo: senderTest.userInfo,
        receiverInfo: receiverTest.userInfo,
        tokenCount: tokenTest.tokenCount
      };

    } catch (error) {
      console.error('❌ [DEBUG] Send notification test failed:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Comprehensive test of the entire flow
   */
  async runFullTest(senderId, receiverId) {
    console.log('🚀 [DEBUG] Running comprehensive test...');
    
    const results = {
      service: await this.testService(),
      sender: await this.testGetUserInfo(senderId),
      receiver: await this.testGetUserInfo(receiverId),
      tokens: await this.testGetUserPushTokens(receiverId),
      notification: null
    };

    // Only test notification if everything else passes
    if (results.service.success && results.sender.success && results.receiver.success) {
      results.notification = await this.testSendNotification(senderId, receiverId);
    }

    console.log('📋 [DEBUG] Full test results:', results);
    return results;
  }
};

// Export for use in console
if (typeof window !== 'undefined') {
  window.debugChatNotifications = debugChatNotifications;
}

export default debugChatNotifications;