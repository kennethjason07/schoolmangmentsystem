import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../utils/AuthContext';
import { universalNotificationService } from '../services/UniversalNotificationService';

const SimpleNotificationBadge = ({ 
  onNotificationsPress, 
  style,
  showRefreshButton = true
}) => {
  const { user } = useAuth();
  const [counts, setCounts] = useState({
    totalCount: 0,
    notificationCount: 0,
    messageCount: 0
  });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Get user type from user object
  const userType = user?.app_metadata?.user_type || user?.user_metadata?.user_type || 'student';
  
  // Fetch counts
  const fetchCounts = async () => {
    if (!user?.id || !userType) return;
    
    try {
      setLoading(true);
      console.log(`🔔 [SimpleBadge] Fetching counts for ${userType} ${user.id}`);
      
      const result = await universalNotificationService.getUnreadCounts(user.id, userType);
      
      if (result) {
        setCounts(result);
        console.log(`✅ [SimpleBadge] Updated counts:`, result);
      }
    } catch (error) {
      console.error('❌ [SimpleBadge] Error fetching counts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Manual refresh
  const handleManualRefresh = async () => {
    if (refreshing || !user?.id || !userType) return;
    
    setRefreshing(true);
    try {
      console.log('🔄 [SimpleBadge] Manual refresh triggered');
      // Clear cache for fresh data
      universalNotificationService.clearCache(user.id, userType);
      await fetchCounts();
    } catch (error) {
      console.error('❌ [SimpleBadge] Manual refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Handle notification press
  const handleNotificationPress = () => {
    console.log('🔔 [SimpleBadge] Notifications pressed');
    if (onNotificationsPress) {
      onNotificationsPress();
    }
  };

  // Refresh on screen focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('👁️ [SimpleBadge] Screen focused, refreshing counts');
      fetchCounts();
    }, [user?.id, userType])
  );

  // Initial load
  useEffect(() => {
    fetchCounts();
  }, [user?.id, userType]);

  if (!user?.id) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
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
        {counts.totalCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {counts.totalCount > 99 ? '99+' : counts.totalCount.toString()}
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
});

export default SimpleNotificationBadge;
