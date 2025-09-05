/**
 * Notification System Test Utilities
 * 
 * Use these utilities to test and demonstrate the ultra-fast notification system
 */

import universalNotificationService from '../services/UniversalNotificationService';

/**
 * Test the notification system performance
 * @param {string} userId - User ID to test with
 * @param {string} userType - User type to test with
 */
export const testNotificationPerformance = async (userId, userType) => {
  console.log('🧪 [NotificationTest] Starting performance test...');
  
  const startTime = Date.now();
  
  try {
    // Test 1: Fast cached retrieval
    console.log('📊 Test 1: Fast cached retrieval');
    const cachedResult = await universalNotificationService.getUnreadCountsFast(userId, userType);
    console.log('✅ Cached result:', cachedResult, `Time: ${Date.now() - startTime}ms`);
    
    // Test 2: Fresh data retrieval
    console.log('📊 Test 2: Fresh data retrieval');
    const freshResult = await universalNotificationService.getUnreadCounts(userId, userType);
    console.log('✅ Fresh result:', freshResult, `Time: ${Date.now() - startTime}ms`);
    
    // Test 3: Broadcast notification read
    console.log('📊 Test 3: Broadcasting notification read event');
    await universalNotificationService.broadcastNotificationRead(userId, 'test-notification-id');
    console.log('✅ Broadcast sent', `Time: ${Date.now() - startTime}ms`);
    
    // Test 4: Direct count update
    console.log('📊 Test 4: Direct count update');
    const testCounts = { messageCount: 2, notificationCount: 3, totalCount: 5 };
    await universalNotificationService.broadcastDirectCountUpdate(userId, testCounts);
    console.log('✅ Direct count update sent', `Time: ${Date.now() - startTime}ms`);
    
    console.log('🎉 [NotificationTest] Performance test completed successfully!');
    console.log(`⚡ Total time: ${Date.now() - startTime}ms`);
    
  } catch (error) {
    console.error('❌ [NotificationTest] Test failed:', error);
  }
};

/**
 * Simulate real-time notification updates for testing
 * @param {Array} userIds - Array of user IDs to simulate updates for
 */
export const simulateRealTimeUpdates = async (userIds) => {
  console.log('🎭 [NotificationTest] Simulating real-time updates...');
  
  // Simulate a bulk update affecting multiple users
  await universalNotificationService.broadcastBulkUpdate(userIds, 'test_bulk_update');
  
  // Simulate individual user updates
  for (const userId of userIds) {
    setTimeout(async () => {
      const randomCounts = {
        messageCount: Math.floor(Math.random() * 5),
        notificationCount: Math.floor(Math.random() * 10),
        totalCount: 0
      };
      randomCounts.totalCount = randomCounts.messageCount + randomCounts.notificationCount;
      
      await universalNotificationService.broadcastDirectCountUpdate(userId, randomCounts);
      console.log(`📨 Sent direct update to ${userId}:`, randomCounts);
    }, Math.random() * 2000); // Random delay up to 2 seconds
  }
};

/**
 * Monitor notification system performance
 * @param {string} userId - User ID to monitor
 * @param {string} userType - User type to monitor
 * @param {number} duration - Duration to monitor in milliseconds (default: 30 seconds)
 */
export const monitorNotificationPerformance = (userId, userType, duration = 30000) => {
  console.log('📈 [NotificationTest] Starting performance monitoring...');
  
  let updateCount = 0;
  let totalResponseTime = 0;
  const startTime = Date.now();
  
  const unsubscribe = universalNotificationService.subscribeToUpdates(
    userId,
    userType,
    (reason) => {
      const responseTime = Date.now() - startTime;
      updateCount++;
      totalResponseTime += responseTime;
      
      console.log(`🔔 Update #${updateCount} - Reason: ${reason}, Response time: ${responseTime}ms`);
    }
  );
  
  // Stop monitoring after specified duration
  setTimeout(() => {
    unsubscribe();
    const averageResponseTime = updateCount > 0 ? totalResponseTime / updateCount : 0;
    
    console.log('📊 [NotificationTest] Performance monitoring results:');
    console.log(`📈 Total updates received: ${updateCount}`);
    console.log(`⚡ Average response time: ${averageResponseTime.toFixed(2)}ms`);
    console.log(`🕐 Monitoring duration: ${duration}ms`);
    console.log('✅ Monitoring completed');
  }, duration);
};

/**
 * Test cross-user notification updates
 * @param {Array<{userId: string, userType: string}>} users - Array of users to test
 */
export const testCrossUserUpdates = async (users) => {
  console.log('👥 [NotificationTest] Testing cross-user updates...');
  
  // Set up subscriptions for all users
  const unsubscribers = users.map(({ userId, userType }) => {
    return universalNotificationService.subscribeToUpdates(
      userId,
      userType,
      (reason) => {
        console.log(`🔔 User ${userId} (${userType}) received update: ${reason}`);
      }
    );
  });
  
  // Test bulk update affecting all users
  setTimeout(async () => {
    const allUserIds = users.map(u => u.userId);
    await universalNotificationService.broadcastBulkUpdate(allUserIds, 'cross_user_test', false);
    console.log('📦 Sent bulk update to all users');
  }, 1000);
  
  // Test individual updates
  users.forEach(({ userId }, index) => {
    setTimeout(async () => {
      await universalNotificationService.broadcastNotificationRead(userId, `test-notification-${index}`);
      console.log(`📖 Simulated notification read for user ${userId}`);
    }, 2000 + (index * 500));
  });
  
  // Clean up after 10 seconds
  setTimeout(() => {
    unsubscribers.forEach(unsub => unsub());
    console.log('✅ Cross-user test completed and cleaned up');
  }, 10000);
};

/**
 * Benchmark the notification system against different load scenarios
 * @param {string} userId - User ID to benchmark with
 * @param {string} userType - User type to benchmark with
 */
export const benchmarkNotificationSystem = async (userId, userType) => {
  console.log('🏁 [NotificationTest] Starting notification system benchmark...');
  
  const scenarios = [
    { name: 'Light Load', operations: 10, interval: 1000 },
    { name: 'Medium Load', operations: 50, interval: 200 },
    { name: 'Heavy Load', operations: 100, interval: 50 }
  ];
  
  for (const scenario of scenarios) {
    console.log(`📊 Testing ${scenario.name} scenario...`);
    const startTime = Date.now();
    const responseTimes = [];
    
    for (let i = 0; i < scenario.operations; i++) {
      const opStartTime = Date.now();
      
      try {
        await universalNotificationService.getUnreadCountsFast(userId, userType);
        responseTimes.push(Date.now() - opStartTime);
      } catch (error) {
        console.error(`❌ Operation ${i + 1} failed:`, error);
      }
      
      if (i < scenario.operations - 1) {
        await new Promise(resolve => setTimeout(resolve, scenario.interval));
      }
    }
    
    const totalTime = Date.now() - startTime;
    const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const minResponseTime = Math.min(...responseTimes);
    const maxResponseTime = Math.max(...responseTimes);
    
    console.log(`✅ ${scenario.name} Results:`);
    console.log(`   📈 Operations: ${scenario.operations}`);
    console.log(`   ⏱️  Total Time: ${totalTime}ms`);
    console.log(`   ⚡ Average Response: ${averageResponseTime.toFixed(2)}ms`);
    console.log(`   🚀 Min Response: ${minResponseTime}ms`);
    console.log(`   🐌 Max Response: ${maxResponseTime}ms`);
    console.log(`   📊 Throughput: ${(scenario.operations / (totalTime / 1000)).toFixed(2)} ops/sec`);
    console.log('');
  }
  
  console.log('🏆 Benchmark completed!');
};

export default {
  testNotificationPerformance,
  simulateRealTimeUpdates,
  monitorNotificationPerformance,
  testCrossUserUpdates,
  benchmarkNotificationSystem
};
