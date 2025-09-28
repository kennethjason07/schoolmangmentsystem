import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform, Dimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../utils/AuthContext';
import Theme from '../constants/Theme';
import Colors from '../constants/Colors';

const { width } = Dimensions.get('window');

const HostelStatCard = ({
  title,
  value,
  icon,
  color = '#2196F3',
  subtitle,
  trend,
  onPress,
  loading = false,
  progress, // For showing progress bars (0-100)
  maxValue, // For calculating progress
  animated = true, // Enable/disable animations
  variant = 'hostel', // Always use hostel variant
  size = 'medium' // 'small', 'medium', 'large'
}) => {
  const { userType } = useAuth();
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  
  // Animation values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const countAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  
  // Calculate progress percentage
  const progressPercentage = progress !== undefined ? progress : 
    (maxValue && value ? (parseInt(value) / maxValue) * 100 : 0);
    
  // Animate on mount
  useEffect(() => {
    if (animated && !loading) {
      // Fade in animation
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
      
      // Counter animation
      if (value && !isNaN(value)) {
        Animated.timing(countAnim, {
          toValue: parseInt(value) || 0,
          duration: 800,
          useNativeDriver: false,
        }).start();
      }
      
      // Progress animation
      if (progressPercentage > 0) {
        Animated.timing(progressAnim, {
          toValue: progressPercentage,
          duration: 1000,
          useNativeDriver: false,
        }).start();
      }
    } else {
      fadeAnim.setValue(1);
      countAnim.setValue(parseInt(value) || 0);
      progressAnim.setValue(progressPercentage);
    }
  }, [value, loading, animated, progressPercentage]);
  
  // Get card size styles optimized for hostel management
  const getCardSize = () => {
    const cardWidth = width - 64; // Full width minus margins and padding for centering
    switch (size) {
      case 'small':
        return { minHeight: 120, padding: 16, width: cardWidth };
      case 'large':
        return { minHeight: 180, padding: 24, width: cardWidth };
      default:
        return { minHeight: 160, padding: 20, width: cardWidth };
    }
  };
  
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

  const CardContent = () => {
    const cardSizeStyles = getCardSize();
    
    return (
      <Animated.View 
        style={[
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
        ]}
      >
        <View
          style={[
            styles.card,
            cardSizeStyles,
            { borderLeftColor: color },
            isPressed && styles.cardPressed
          ]}
        >
          {/* Background decorative elements */}
          <View style={[styles.decorativeCircle, { backgroundColor: `${color}08` }]} />
          
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <Text
                style={[
                  styles.title, 
                  size === 'small' && styles.titleSmall,
                  size === 'large' && styles.titleLarge
                ]}
                numberOfLines={2}
                adjustsFontSizeToFit={true}
                minimumFontScale={0.85}
              >
                {title}
              </Text>
              {trend !== undefined && trend !== 0 && (
                <View style={[styles.trendContainer, { backgroundColor: getTrendColor() + '15' }]}>
                  <Ionicons
                    name={getTrendIcon()}
                    size={10}
                    color={getTrendColor()}
                  />
                  <Text style={[styles.trendText, { color: getTrendColor() }]}>
                    {Math.abs(trend)}%
                  </Text>
                </View>
              )}
            </View>
            
            <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
              <Ionicons 
                name={icon} 
                size={size === 'large' ? 28 : size === 'small' ? 22 : 24} 
                color={color} 
              />
            </View>
          </View>

          <View style={styles.content}>
            {animated && !loading && !isNaN(value) ? (
              <Animated.Text style={[styles.value, { color }, size === 'large' && styles.valueLarge]}>
                {countAnim._value?.toFixed(0) || value}
              </Animated.Text>
            ) : (
              <Text style={[styles.value, { color }, size === 'large' && styles.valueLarge]}>
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <View style={[styles.loadingDot, { backgroundColor: color }]} />
                    <View style={[styles.loadingDot, { backgroundColor: color }]} />
                    <View style={[styles.loadingDot, { backgroundColor: color }]} />
                  </View>
                ) : value}
              </Text>
            )}
            
            {subtitle && (
              <Text style={[styles.subtitle, size === 'large' && styles.subtitleLarge]} numberOfLines={2}>
                {subtitle}
              </Text>
            )}
            
            {/* Progress bar for capacity metrics */}
            {(progressPercentage > 0 || maxValue) && (
              <View style={styles.progressContainer}>
                <View style={[styles.progressTrack, { backgroundColor: `${color}20` }]}>
                  <Animated.View 
                    style={[
                      styles.progressFill,
                      { 
                        backgroundColor: color,
                        width: progressAnim.interpolate({
                          inputRange: [0, 100],
                          outputRange: ['0%', '100%'],
                          extrapolate: 'clamp'
                        })
                      }
                    ]} 
                  />
                </View>
                <Text style={styles.progressText}>
                  {Math.round(progressPercentage)}% capacity
                </Text>
              </View>
            )}
          </View>

          {onPress && (
            <View style={styles.actionIndicator}>
              <MaterialCommunityIcons name="chevron-right" size={16} color={color} />
            </View>
          )}
          
          {/* Hover effect overlay */}
          {isHovered && (
            <View style={[styles.hoverOverlay, { backgroundColor: `${color}05` }]} />
          )}
        </View>
      </Animated.View>
    );
  };

  const handlePress = (event) => {
    console.log(`🔧 HostelStatCard pressed: ${title}`);
    
    // Prevent default action for web
    if (Platform.OS === 'web' && event && event.preventDefault) {
      event.preventDefault();
    }
    
    // Animate press feedback
    setIsPressed(true);
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.96,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      })
    ]).start(() => {
      setIsPressed(false);
    });
    
    if (onPress) {
      console.log('🔧 Calling onPress handler...');
      try {
        setTimeout(() => onPress(), 100); // Slight delay for animation
        console.log('🔧 onPress handler completed successfully');
      } catch (error) {
        console.error('🔧 Error in onPress handler:', error);
      }
    } else {
      console.log('🔧 No onPress handler provided');
    }
  };
  
  // Handle hover effects
  const handleMouseEnter = () => {
    if (Platform.OS === 'web') {
      setIsHovered(true);
      Animated.timing(scaleAnim, {
        toValue: 1.03,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  };
  
  const handleMouseLeave = () => {
    if (Platform.OS === 'web') {
      setIsHovered(false);
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  };

  if (onPress) {
    return (
      <TouchableOpacity 
        onPress={handlePress}
        onPressIn={() => setIsPressed(true)}
        onPressOut={() => setIsPressed(false)}
        activeOpacity={0.9}
        style={[
          Platform.OS === 'web' && styles.webTouchable,
          Platform.OS === 'web' && isHovered && styles.webHovered
        ]}
        accessibilityRole={Platform.OS === 'web' ? 'button' : undefined}
        accessibilityLabel={`Navigate to ${title} with value ${value}`}
        accessibilityHint={`Tap to view details for ${title}. ${subtitle || ''}`}
        accessible={true}
        testID={`hostel-stat-card-${title?.toLowerCase()?.replace(/\s+/g, '-')}`}
        onMouseEnter={Platform.OS === 'web' ? handleMouseEnter : undefined}
        onMouseLeave={Platform.OS === 'web' ? handleMouseLeave : undefined}
      >
        <CardContent />
      </TouchableOpacity>
    );
  }

  return <CardContent />;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Theme.BorderRadius.xl,
    padding: Theme.Spacing.lg,
    marginVertical: Theme.Spacing.sm,
    marginHorizontal: 0,
    borderLeftWidth: 4,
    minHeight: 160,
    position: 'relative',
    alignSelf: 'center',
    overflow: 'visible',
    ...Theme.Shadows.lg,
  },
  cardPressed: {
    ...Theme.Shadows.sm,
  },
  decorativeCircle: {
    position: 'absolute',
    top: -25,
    right: -25,
    width: 80,
    height: 80,
    borderRadius: 40,
    opacity: 0.4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Theme.Spacing.sm,
    minHeight: 45,
  },
  titleContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    flex: 1,
    paddingRight: Theme.Spacing.sm,
    maxWidth: '75%',
  },
  title: {
    fontSize: Theme.Typography.sizes.base,
    color: Colors.text,
    fontWeight: Theme.Typography.weights.bold,
    flexShrink: 1,
    lineHeight: 20,
    marginBottom: Theme.Spacing.xs,
    textAlign: 'left',
    includeFontPadding: false,
    textAlignVertical: 'top',
  },
  titleSmall: {
    fontSize: Theme.Typography.sizes.xs,
    lineHeight: 14,
  },
  titleLarge: {
    fontSize: Theme.Typography.sizes.base,
    lineHeight: 20,
    fontWeight: Theme.Typography.weights.extrabold,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Theme.BorderRadius.full,
    paddingHorizontal: Theme.Spacing.xs,
    paddingVertical: 2,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  trendText: {
    fontSize: 8,
    fontWeight: Theme.Typography.weights.bold,
    marginLeft: 2,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: Theme.BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Theme.Spacing.xs,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: Theme.Spacing.xs,
  },
  value: {
    fontSize: Theme.Typography.sizes.xl,
    fontWeight: Theme.Typography.weights.extrabold,
    marginBottom: Theme.Spacing.xs,
    letterSpacing: -0.2,
    lineHeight: 22,
    includeFontPadding: false,
  },
  valueLarge: {
    fontSize: Theme.Typography.sizes['2xl'],
    lineHeight: 28,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  loadingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 1,
    opacity: 0.6,
  },
  subtitle: {
    fontSize: Theme.Typography.sizes.xs,
    color: Colors.textSecondary,
    lineHeight: 14,
    fontWeight: Theme.Typography.weights.medium,
    opacity: 0.8,
    includeFontPadding: false,
  },
  subtitleLarge: {
    fontSize: Theme.Typography.sizes.sm,
    lineHeight: 16,
  },
  progressContainer: {
    marginTop: Theme.Spacing.sm,
  },
  progressTrack: {
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  progressText: {
    fontSize: 8,
    color: Colors.textSecondary,
    fontWeight: Theme.Typography.weights.semibold,
    textAlign: 'right',
  },
  actionIndicator: {
    position: 'absolute',
    bottom: Theme.Spacing.sm,
    right: Theme.Spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: Theme.BorderRadius.full,
    padding: 6,
    ...Theme.Shadows.sm,
  },
  hoverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: Theme.BorderRadius.xl,
  },
  // Web-specific styles
  webTouchable: {
    ...Platform.select({
      web: {
        cursor: 'pointer',
        userSelect: 'none',
        outlineStyle: 'none',
        WebkitTapHighlightColor: 'transparent',
        transition: 'transform 0.15s ease-in-out, box-shadow 0.15s ease-in-out',
      },
    }),
  },
  webHovered: {
    ...Platform.select({
      web: {
        transform: [{ scale: 1.03 }],
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 12,
      },
    }),
  },
});

export default HostelStatCard;