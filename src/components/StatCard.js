import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../utils/AuthContext';

const StatCard = ({
  title,
  value,
  icon,
  color = '#2196F3',
  subtitle,
  trend,
  onPress,
  loading = false
}) => {
  const { userType } = useAuth();
  const isTeacher = userType === 'teacher';
  const getTrendIcon = () => {
    if (trend === 1) return 'trending-up';
    if (trend === -1) return 'trending-down';
    return null;
  };

  const getTrendColor = () => {
    if (trend === 1) return '#4CAF50';
    if (trend === -1) return '#f44336';
    return '#666';
  };

  const CardContent = () => (
    <View style={[styles.card, { borderLeftColor: color }, isTeacher && styles.cardTeacher]}>
      {/* Icon at the top right */}
      <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={32} color={color} />
      </View>

      {/* Main content - title, value, subtitle in vertical alignment */}
      <View style={styles.mainContent}>
        <View style={styles.titleContainer}>
          <Text
            style={[styles.title, isTeacher && styles.titleTeacher]}
            numberOfLines={isTeacher ? 2 : 1}
            adjustsFontSizeToFit={false}
          >
            {title}
          </Text>
          {trend !== undefined && trend !== 0 && (
            <View style={styles.trendContainer}>
              <Ionicons
                name={getTrendIcon()}
                size={12}
                color={getTrendColor()}
              />
            </View>
          )}
        </View>

        <Text style={[styles.value, { color }]}>
          {loading ? '...' : value}
        </Text>

        {subtitle && (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>

      {onPress && (
        <View style={styles.actionIndicator}>
          <Ionicons name="chevron-forward" size={16} color="#ccc" />
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        <CardContent />
      </TouchableOpacity>
    );
  }

  return <CardContent />;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16, // Original padding for non-teacher dashboards
    marginVertical: 8,
    marginHorizontal: 4,
    borderLeftWidth: 5,
    minHeight: 110, // Original height for non-teacher dashboards
    position: 'relative',
  },
  cardTeacher: {
    padding: 24, // Much more padding for very large teacher text
    minHeight: 150, // Much more height for very large teacher text
    marginHorizontal: 0, // Full width for teacher cards
    marginVertical: 12, // More vertical spacing between cards
  },
  mainContent: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingRight: 60, // Space for the icon
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    color: '#444',
    fontWeight: '600',
    flexShrink: 1,
    lineHeight: 20,
  },
  titleTeacher: {
    fontSize: 28, // Very large size for teachers (100% increase from original 14px)
    color: '#000', // Pure black for maximum visibility
    fontWeight: '900', // Maximum bold weight
    lineHeight: 32, // Adjusted line height for very large text
    textAlign: 'left', // Ensure proper alignment
  },
  trendContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  iconContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: -0.5,
    lineHeight: 32,
    marginTop: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    fontWeight: '500',
    opacity: 0.8,
  },
  actionIndicator: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 4,
  },
});

export default StatCard; 