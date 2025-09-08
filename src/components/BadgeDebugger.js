import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import universalNotificationService from '../services/UniversalNotificationService';
import { useAuth } from '../utils/AuthContext';
import { supabase, TABLES } from '../utils/supabase';

const BadgeDebugger = () => {
  const { user, userType } = useAuth();
  const [counts, setCounts] = useState({ messageCount: 0, notificationCount: 0, totalCount: 0 });
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Fetch current counts
  const fetchCounts = async (forceRefresh = false) => {
    if (!user?.id || !userType) return;
    
    setLoading(true);
    try {
      const newCounts = forceRefresh 
        ? await universalNotificationService.forceRefreshCounts(user.id, userType)
        : await universalNotificationService.getUnreadCounts(user.id, userType);
      
      setCounts(newCounts);
      setLastUpdate(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Error fetching counts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Debug cache state
  const debugCache = () => {
    universalNotificationService.debugCache(user?.id);
  };

  // Clear all cache
  const clearCache = () => {
    universalNotificationService.clearAllCache();
    Alert.alert('Cache Cleared', 'All badge caches have been cleared. Refresh to see new counts.');
  };

  // Mark all messages as read for current user
  const markAllMessagesRead = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      const { error } = await supabase
        .from(TABLES.MESSAGES)
        .update({ is_read: true })
        .eq('receiver_id', user.id)
        .eq('is_read', false);

      if (error) throw error;

      // Clear cache and refresh
      universalNotificationService.clearCache(user.id, userType);
      await fetchCounts(true);
      
      Alert.alert('Success', 'All messages marked as read');
    } catch (error) {
      console.error('Error marking messages as read:', error);
      Alert.alert('Error', 'Failed to mark messages as read');
    } finally {
      setLoading(false);
    }
  };

  // Get detailed message info
  const getDetailedInfo = async () => {
    if (!user?.id) return;
    
    try {
      // Get unread messages
      const { data: unreadMessages, error: msgError } = await supabase
        .from(TABLES.MESSAGES)
        .select('id, sender_id, message, sent_at, is_read')
        .eq('receiver_id', user.id)
        .eq('is_read', false);

      // Get unread notifications  
      const { data: unreadNotifs, error: notifError } = await supabase
        .from(TABLES.NOTIFICATION_RECIPIENTS)
        .select(`
          id, 
          is_read, 
          notifications(id, message, type)
        `)
        .eq('recipient_id', user.id)
        .eq('recipient_type', universalNotificationService.getUserTypeForDB(userType))
        .eq('is_read', false);

      let details = `📊 Detailed Badge Count Analysis\n\n`;
      details += `User: ${user.id} (${userType})\n`;
      details += `Last Updated: ${lastUpdate || 'Never'}\n\n`;
      
      details += `📨 MESSAGES (${unreadMessages?.length || 0}):\n`;
      if (unreadMessages?.length > 0) {
        unreadMessages.forEach((msg, idx) => {
          details += `  ${idx + 1}. From ${msg.sender_id}: "${msg.message?.substring(0, 30)}..."\n`;
        });
      } else {
        details += `  ✅ No unread messages\n`;
      }
      
      details += `\n🔔 NOTIFICATIONS (${unreadNotifs?.length || 0}):\n`;
      if (unreadNotifs?.length > 0) {
        unreadNotifs.forEach((notif, idx) => {
          details += `  ${idx + 1}. ${notif.notifications?.message?.substring(0, 40)}...\n`;
        });
      } else {
        details += `  ✅ No unread notifications\n`;
      }

      details += `\n🧮 CACHE STATE:\n`;
      const cacheKey = `${user.id}-${userType}`;
      const cached = universalNotificationService.cache.get(cacheKey);
      if (cached) {
        const age = Math.round((Date.now() - cached.timestamp) / 1000);
        details += `  Cached: ${JSON.stringify(cached.data)} (${age}s ago)\n`;
        details += `  Expired: ${age >= (universalNotificationService.cacheTimeout / 1000)}\n`;
      } else {
        details += `  No cache found\n`;
      }

      Alert.alert('Debug Info', details);
    } catch (error) {
      Alert.alert('Error', 'Failed to get detailed info: ' + error.message);
    }
  };

  useEffect(() => {
    if (user?.id && userType) {
      fetchCounts();
    }
  }, [user?.id, userType]);

  if (!user?.id || !userType) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Badge Debugger</Text>
        <Text style={styles.error}>User not logged in</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🐛 Badge Debugger</Text>
      <Text style={styles.subtitle}>User: {user.id.substring(0, 8)}... ({userType})</Text>
      
      <View style={styles.countsContainer}>
        <View style={styles.countItem}>
          <Text style={styles.countLabel}>Messages</Text>
          <Text style={styles.countValue}>{counts.messageCount}</Text>
        </View>
        <View style={styles.countItem}>
          <Text style={styles.countLabel}>Notifications</Text>
          <Text style={styles.countValue}>{counts.notificationCount}</Text>
        </View>
        <View style={styles.countItem}>
          <Text style={styles.countLabel}>Total</Text>
          <Text style={[styles.countValue, styles.totalCount]}>{counts.totalCount}</Text>
        </View>
      </View>

      {lastUpdate && (
        <Text style={styles.lastUpdate}>Last updated: {lastUpdate}</Text>
      )}

      <View style={styles.buttonsContainer}>
        <TouchableOpacity 
          style={[styles.button, styles.refreshButton]} 
          onPress={() => fetchCounts(false)}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Refresh</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.forceButton]} 
          onPress={() => fetchCounts(true)}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Force Refresh</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.debugButton]} 
          onPress={debugCache}
        >
          <Text style={styles.buttonText}>Debug Cache</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.clearButton]} 
          onPress={clearCache}
        >
          <Text style={styles.buttonText}>Clear Cache</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.infoButton]} 
          onPress={getDetailedInfo}
        >
          <Text style={styles.buttonText}>Detailed Info</Text>
        </TouchableOpacity>

        {counts.messageCount > 0 && (
          <TouchableOpacity 
            style={[styles.button, styles.fixButton]} 
            onPress={markAllMessagesRead}
            disabled={loading}
          >
            <Text style={styles.buttonText}>Fix: Mark All Read</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading && (
        <Text style={styles.loading}>Loading...</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f5f5f5',
    margin: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
    color: '#333',
  },
  subtitle: {
    fontSize: 12,
    textAlign: 'center',
    color: '#666',
    marginBottom: 15,
  },
  error: {
    color: '#d32f2f',
    textAlign: 'center',
    fontSize: 16,
  },
  countsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  countItem: {
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    minWidth: 80,
  },
  countLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  countValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  totalCount: {
    color: '#1976d2',
  },
  lastUpdate: {
    fontSize: 10,
    color: '#888',
    textAlign: 'center',
    marginBottom: 15,
  },
  buttonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginHorizontal: 2,
    marginVertical: 2,
  },
  buttonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  refreshButton: {
    backgroundColor: '#4CAF50',
  },
  forceButton: {
    backgroundColor: '#2196F3',
  },
  debugButton: {
    backgroundColor: '#FF9800',
  },
  clearButton: {
    backgroundColor: '#f44336',
  },
  infoButton: {
    backgroundColor: '#9C27B0',
  },
  fixButton: {
    backgroundColor: '#FF5722',
  },
  loading: {
    textAlign: 'center',
    color: '#1976d2',
    marginTop: 10,
    fontStyle: 'italic',
  },
});

export default BadgeDebugger;
