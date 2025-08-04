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
      <View style={[styles.header, isTeacher && styles.headerTeacher]}>
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
        <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
          <Ionicons name={icon} size={24} color={color} />
        </View>
      </View>

      <View style={styles.content}>
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
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    minHeight: 110, // Original height for non-teacher dashboards
    position: 'relative',
  },
  cardTeacher: {
    padding: 24, // Much more padding for very large teacher text
    minHeight: 150, // Much more height for very large teacher text
    marginHorizontal: 0, // Full width for teacher cards
    marginVertical: 12, // More vertical spacing between cards
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8, // Original spacing for non-teacher dashboards
  },
  headerTeacher: {
    marginBottom: 16, // Much more spacing for very large teacher text
  },
  titleContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    flex: 1,
    paddingRight: 8,
  },
  title: {
    fontSize: 18, // Increased significantly for better readability in admin dashboard
    color: '#666', // Original color
    fontWeight: '700', // Increased weight for better visibility
    marginRight: 8,
    flexShrink: 1,
    lineHeight: 22, // Adjusted line height proportionally
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
    width: 48, // Moderate size to balance with larger title
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  value: {
    fontSize: 26, // Reverted back to original size
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: -0.5,
    lineHeight: 30, // Reverted back to original
  },
  subtitle: {
    fontSize: 12, // Reverted back to original size
    color: '#888',
    lineHeight: 16, // Reverted back to original
    fontWeight: '500',
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