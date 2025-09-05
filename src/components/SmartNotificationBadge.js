import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../utils/AuthContext';
import { useSmartNotificationPolling } from '../hooks/useSmartNotificationPolling';

const SmartNotificationBadge = ({ 
  onNotificationsPress, 
  style,
  showRefreshButton = true,
  fastInterval = 15000,
  showDebugInfo = false
}) => {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  
  // Get user type from user object
  const userType = user?.app_metadata?.user_type || user?.user_metadata?.user_type || 'student';
  
  // Use smart polling hook
  const { 
    counts, 
    loading, 
    error, 
    lastFetch, 
    refresh, 
    totalCount 
  } = useSmartNotificationPolling({
    userId: user?.id,
    userType,
    fastInterval,
    onCountsUpdate: (newCounts) => {
      console.log(`🔔 [SmartBadge-${userType}] Counts updated:`, newCounts);
    }
  });

  // Manual refresh with visual feedback
  const handleManualRefresh = async () => {
    if (refreshing) return;
    
    setRefreshing(true);
    try {
      await refresh();
      console.log('✅ [SmartBadge] Manual refresh completed');
    } catch (error) {
      console.error('❌ [SmartBadge] Manual refresh failed:', error);
      Alert.alert('Refresh Failed', 'Could not update notifications. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  // Handle notification press
  const handleNotificationPress = () => {
    console.log('🔔 [SmartBadge] Notifications pressed');
    if (onNotificationsPress) {
      onNotificationsPress();
    }
  };

  if (!user?.id) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      {/* Debug info (optional) */}
      {showDebugInfo && (
        <View style={styles.debugInfo}>
          <Text style={styles.debugText}>
            Last: {lastFetch ? new Date(lastFetch).toLocaleTimeString() : 'Never'}
          </Text>
          {error && <Text style={styles.errorText}>Error: {error}</Text>}
        </View>
      )}
      
      {/* Notification Bell */}
      <TouchableOpacity 
        style={styles.notificationButton}
        onPress={handleNotificationPress}
        activeOpacity={0.7}
      >
        <Ionicons 
          name="notifications-outline" 
          size={24} 
          color="#333" 
        />
        
        {/* Badge Count */}
        {totalCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {totalCount > 99 ? '99+' : totalCount.toString()}
            </Text>
          </View>
        )}
        
        {/* Loading indicator */}
        {loading && (
          <View style={styles.loadingIndicator}>
            <ActivityIndicator size="small" color="#2196F3" />
          </View>
        )}
      </TouchableOpacity>

      {/* Manual Refresh Button */}
      {showRefreshButton && (
        <TouchableOpacity
          style={[styles.refreshButton, refreshing && styles.refreshButtonLoading]}
          onPress={handleManualRefresh}
          disabled={refreshing}
          activeOpacity={0.7}
        >
          <Ionicons 
            name={refreshing ? "hourglass-outline" : "refresh-outline"} 
            size={18} 
            color={refreshing ? "#999" : "#2196F3"} 
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#FF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  loadingIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 2,
  },
  refreshButton: {
    marginLeft: 8,
    padding: 6,
    borderRadius: 15,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
  },
  refreshButtonLoading: {
    backgroundColor: 'rgba(153, 153, 153, 0.1)',
  },
  debugInfo: {
    position: 'absolute',
    top: -30,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 4,
    borderRadius: 4,
    minWidth: 100,
  },
  debugText: {
    color: '#fff',
    fontSize: 10,
    textAlign: 'center',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 9,
    textAlign: 'center',
    marginTop: 2,
  },
});

export default SmartNotificationBadge;
