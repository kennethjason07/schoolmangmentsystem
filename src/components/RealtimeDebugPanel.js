import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuth } from '../utils/AuthContext';
import { supabase } from '../utils/supabase';
import universalNotificationService from '../services/UniversalNotificationService';

const RealtimeDebugPanel = () => {
  const { user, userType } = useAuth();
  const [connectionStatus, setConnectionStatus] = useState('unknown');
  const [lastMessage, setLastMessage] = useState('None');
  const [messageCount, setMessageCount] = useState(0);

  useEffect(() => {
    if (!user?.id || !userType) return;

    console.log('🔧 [DEBUG PANEL] Setting up debug subscription for user:', user.id, userType);

    // Create a test channel to monitor real-time status
    const debugChannel = supabase.channel('debug-panel');
    
    // Monitor connection state
    debugChannel.on('presence', { event: 'sync' }, () => {
      setConnectionStatus('connected');
      console.log('🔧 [DEBUG PANEL] Realtime connected');
    });

    debugChannel.on('presence', { event: 'join' }, () => {
      setConnectionStatus('connected');
      console.log('🔧 [DEBUG PANEL] Client joined');
    });

    debugChannel.on('presence', { event: 'leave' }, () => {
      setConnectionStatus('disconnected');
      console.log('🔧 [DEBUG PANEL] Client left');
    });

    // Listen for broadcast events specifically for this user
    debugChannel.on('broadcast', { event: 'new-notification-for-user' }, (payload) => {
      if (payload.payload.user_id === user.id) {
        setLastMessage(`New notification: ${payload.payload.notification_id}`);
        setMessageCount(prev => prev + 1);
        console.log('🔧 [DEBUG PANEL] Received broadcast:', payload);
      }
    });

    // Subscribe to the channel
    debugChannel.subscribe((status) => {
      console.log('🔧 [DEBUG PANEL] Subscription status:', status);
      setConnectionStatus(status);
    });

    return () => {
      debugChannel.unsubscribe();
    };
  }, [user?.id, userType]);

  // Test function to send a manual broadcast
  const testBroadcast = async () => {
    try {
      console.log('🔧 [DEBUG PANEL] Testing manual broadcast...');
      const channel = supabase.channel('test-broadcast');
      await channel.subscribe();
      
      await channel.send({
        type: 'broadcast',
        event: 'new-notification-for-user',
        payload: {
          user_id: user.id,
          notification_id: 'test-' + Date.now(),
          notification_type: 'TEST',
          timestamp: new Date().toISOString()
        }
      });
      
      console.log('🔧 [DEBUG PANEL] Manual broadcast sent');
    } catch (error) {
      console.error('🔧 [DEBUG PANEL] Broadcast test failed:', error);
    }
  };

  if (!user?.id) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Real-time Debug Panel</Text>
      <View style={styles.row}>
        <Text style={styles.label}>User:</Text>
        <Text style={styles.value}>{user.email} ({userType})</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Connection:</Text>
        <Text style={[styles.value, { color: connectionStatus === 'SUBSCRIBED' ? 'green' : 'red' }]}>
          {connectionStatus}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Messages:</Text>
        <Text style={styles.value}>{messageCount}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Last:</Text>
        <Text style={styles.value} numberOfLines={1}>{lastMessage}</Text>
      </View>
      <TouchableOpacity style={styles.button} onPress={testBroadcast}>
        <Text style={styles.buttonText}>Test Broadcast</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    margin: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    width: 80,
  },
  value: {
    fontSize: 12,
    color: '#333',
    flex: 1,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 8,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default RealtimeDebugPanel;
