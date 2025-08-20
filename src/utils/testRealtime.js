import { supabase } from './supabase';

/**
 * Simple test function to verify real-time subscriptions are working
 * Call this from your component to test if Supabase real-time is properly configured
 */
export const testRealtimeConnection = (userId) => {
  console.log('🧪 STARTING REAL-TIME CONNECTION TEST');
  console.log('🔍 Testing with user ID:', userId);
  
  // Create a simple test subscription
  const testChannel = `realtime-test-${userId}-${Date.now()}`;
  
  const subscription = supabase
    .channel(testChannel)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'messages'
      },
      (payload) => {
        console.log('🎉 TEST SUCCESS: Real-time event received!');
        console.log('📦 Payload:', JSON.stringify(payload, null, 2));
        console.log('⏰ Test completed at:', new Date().toISOString());
      }
    )
    .subscribe((status, err) => {
      console.log('📊 Test subscription status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('✅ Test subscription established successfully!');
        console.log('🔔 Listening for ANY message changes on the messages table');
        console.log('💡 Try inserting/updating/deleting a message to test');
      } else if (status === 'CLOSED') {
        console.log('❌ Test subscription closed');
      } else if (status === 'CHANNEL_ERROR') {
        console.log('💥 Test subscription error:', err);
      } else {
        console.log('🔄 Test subscription status changed to:', status);
      }
    });
  
  // Log subscription details
  console.log('🔍 Test subscription details:');
  console.log('   - Channel:', testChannel);
  console.log('   - Table:', 'messages');
  console.log('   - Schema:', 'public');
  console.log('   - Events:', 'all (*, INSERT, UPDATE, DELETE)');
  console.log('   - Filter:', 'none (listening to all changes)');
  
  // Test Supabase configuration
  console.log('🔧 Supabase configuration check:');
  console.log('   - URL:', supabase.supabaseUrl || 'Missing');
  console.log('   - Key present:', !!supabase.supabaseKey);
  console.log('   - Realtime endpoint:', supabase.realtime?.endPoint || 'Not found');
  console.log('   - WebSocket ready state:', supabase.realtime?.socket?.readyState);
  
  // WebSocket ready states:
  // 0 = CONNECTING, 1 = OPEN, 2 = CLOSING, 3 = CLOSED
  const wsStates = {
    0: 'CONNECTING',
    1: 'OPEN', 
    2: 'CLOSING',
    3: 'CLOSED'
  };
  
  const wsState = supabase.realtime?.socket?.readyState;
  console.log('   - WebSocket state name:', wsStates[wsState] || 'UNKNOWN');
  
  // Return cleanup function
  return () => {
    console.log('🧹 Cleaning up test subscription');
    supabase.removeChannel(subscription);
  };
};

/**
 * Test if a specific user filter works
 */
export const testUserFilteredConnection = (userId) => {
  console.log('🧪 STARTING USER-FILTERED REAL-TIME TEST');
  console.log('🔍 Testing filtered subscription for user:', userId);
  
  const testChannel = `user-filtered-test-${userId}-${Date.now()}`;
  
  const subscription = supabase
    .channel(testChannel)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `or(sender_id.eq.${userId},receiver_id.eq.${userId})`
      },
      (payload) => {
        console.log('🎉 FILTERED TEST SUCCESS: User-specific event received!');
        console.log('📦 Payload:', JSON.stringify(payload, null, 2));
        console.log('👤 Event involves user:', userId);
        console.log('⏰ Filtered test completed at:', new Date().toISOString());
      }
    )
    .subscribe((status, err) => {
      console.log('📊 Filtered test subscription status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('✅ Filtered test subscription established!');
        console.log('🔔 Listening for messages involving user:', userId);
        console.log('💡 Try sending/receiving a message as this user to test');
      } else if (status === 'CLOSED') {
        console.log('❌ Filtered test subscription closed');
      } else if (status === 'CHANNEL_ERROR') {
        console.log('💥 Filtered test subscription error:', err);
      }
    });
  
  console.log('🔍 Filtered test subscription details:');
  console.log('   - Channel:', testChannel);
  console.log('   - Filter:', `or(sender_id.eq.${userId},receiver_id.eq.${userId})`);
  
  return () => {
    console.log('🧹 Cleaning up filtered test subscription');
    supabase.removeChannel(subscription);
  };
};

/**
 * Simple manual message insert test
 * This will insert a test message to trigger the real-time subscription
 */
export const insertTestMessage = async (userId) => {
  console.log('📝 INSERTING TEST MESSAGE');
  console.log('👤 From user:', userId);
  
  try {
    const testMessage = {
      sender_id: userId,
      receiver_id: userId, // Send to self for testing
      message: `Test message from real-time test at ${new Date().toISOString()}`,
      message_type: 'text'
    };
    
    console.log('📦 Test message data:', testMessage);
    
    const { data, error } = await supabase
      .from('messages')
      .insert(testMessage)
      .select();
    
    if (error) {
      console.log('💥 Test message insert error:', error);
      throw error;
    }
    
    console.log('✅ Test message inserted successfully!');
    console.log('📨 Inserted message:', data);
    console.log('🔔 This should trigger your real-time subscription if it\'s working');
    
    return data;
  } catch (error) {
    console.log('💥 Failed to insert test message:', error);
    throw error;
  }
};
