import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../utils/AuthContext';
import Theme from '../../constants/Theme';
import Colors from '../../constants/Colors';

const StatCard = ({
  title,
  value,
  icon,
  color = Colors.primary,
  subtitle,
  trend,
  change,
  onPress,
  loading = false,
  variant = 'default', // default, gradient, minimal, compact
  size = 'medium', // small, medium, large
  showTrend = true,
  animated = true,
  style,
}) => {
  const { userType } = useAuth();
  const scaleValue = useRef(new Animated.Value(1)).current;
  const opacityValue = useRef(new Animated.Value(0)).current;

  // Animate in on mount
  React.useEffect(() => {
    if (animated) {
      Animated.timing(opacityValue, {
        toValue: 1,
        duration: Theme.Animations.timing.slow,
        useNativeDriver: true,
      }).start();
    }
  }, [animated, opacityValue]);

  // Handle press animations
  const handlePressIn = () => {
    if (!onPress || loading) return;
    Animated.spring(scaleValue, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (!onPress || loading) return;
    Animated.spring(scaleValue, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  // Get trend properties
  const getTrendIcon = () => {
    if (trend === 1 || (change && change > 0)) return 'trending-up';
    if (trend === -1 || (change && change < 0)) return 'trending-down';
    return null;
  };

  const getTrendColor = () => {
    if (trend === 1 || (change && change > 0)) return Colors.success;
    if (trend === -1 || (change && change < 0)) return Colors.error;
    return Colors.textSecondary;
  };

  const getTrendText = () => {
    if (change) {
      const absChange = Math.abs(change);
      const prefix = change > 0 ? '+' : '';
      return `${prefix}${absChange}%`;
    }
    return null;
  };

  // Get size-based styles
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          padding: Theme.Spacing.md,
          minHeight: 100,
          titleSize: Theme.Typography.sizes.sm,
          valueSize: Theme.Typography.sizes.lg,
          iconSize: 20,
        };
      case 'large':
        return {
          padding: Theme.Spacing.xl,
          minHeight: 160,
          titleSize: Theme.Typography.sizes.lg,
          valueSize: Theme.Typography.sizes['4xl'],
          iconSize: 32,
        };
      default: // medium
        return {
          padding: Theme.Spacing.base,
          minHeight: 130,
          titleSize: Theme.Typography.sizes.base,
          valueSize: Theme.Typography.sizes['3xl'],
          iconSize: 24,
        };
    }
  };

  const sizeStyles = getSizeStyles();

  // Get variant styles
  const getVariantStyles = () => {
    const baseStyle = {
      borderRadius: Theme.BorderRadius.lg,
      padding: sizeStyles.padding,
      minHeight: sizeStyles.minHeight,
    };

    switch (variant) {
      case 'gradient':
        return {
          ...baseStyle,
          ...Theme.Shadows.md,
        };
      case 'minimal':
        return {
          ...baseStyle,
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: Colors.border,
          ...Theme.Shadows.none,
        };
      case 'compact':
        return {
          ...baseStyle,
          padding: Theme.Spacing.md,
          minHeight: sizeStyles.minHeight * 0.8,
          backgroundColor: Colors.surface,
          ...Theme.Shadows.sm,
        };
      default:
        return {
          ...baseStyle,
          backgroundColor: Colors.surface,
          borderLeftWidth: 4,
          borderLeftColor: color,
          ...Theme.Shadows.base,
        };
    }
  };

  const variantStyles = getVariantStyles();

  const renderContent = () => (
    <View style={styles.container}>
      {/* Header with title and icon */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text
            style={[
              styles.title,
              {
                fontSize: sizeStyles.titleSize,
                color: variant === 'gradient' ? Colors.white : Colors.text,
              },
            ]}
            numberOfLines={2}
          >
            {title}
          </Text>
          
          {/* Trend indicator */}
          {showTrend && (trend !== undefined || change !== undefined) && (
            <View style={styles.trendContainer}>
              {getTrendIcon() && (
                <Ionicons
                  name={getTrendIcon()}
                  size={12}
                  color={variant === 'gradient' ? Colors.white : getTrendColor()}
                />
              )}
              {getTrendText() && (
                <Text
                  style={[
                    styles.trendText,
                    {
                      color: variant === 'gradient' ? Colors.white : getTrendColor(),
                    },
                  ]}
                >
                  {getTrendText()}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Icon */}
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: variant === 'gradient' 
                ? 'rgba(255, 255, 255, 0.2)' 
                : `${color}15`,
            },
          ]}
        >
          <Ionicons
            name={icon}
            size={sizeStyles.iconSize}
            color={variant === 'gradient' ? Colors.white : color}
          />
        </View>
      </View>

      {/* Value and subtitle */}
      <View style={styles.content}>
        <Text
          style={[
            styles.value,
            {
              fontSize: sizeStyles.valueSize,
              color: variant === 'gradient' ? Colors.white : color,
            },
          ]}
        >
          {loading ? '...' : value}
        </Text>
        
        {subtitle && (
          <Text
            style={[
              styles.subtitle,
              {
                color: variant === 'gradient' ? 'rgba(255, 255, 255, 0.8)' : Colors.textSecondary,
              },
            ]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        )}
      </View>

      {/* Action indicator */}
      {onPress && (
        <View style={styles.actionIndicator}>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={variant === 'gradient' ? 'rgba(255, 255, 255, 0.6)' : Colors.textLight}
          />
        </View>
      )}
    </View>
  );

  const animatedStyle = {
    transform: [{ scale: scaleValue }],
    opacity: animated ? opacityValue : 1,
  };

  // Render gradient variant
  if (variant === 'gradient') {
    const gradientColors = color ? [color, `${color}CC`] : [Colors.primary, `${Colors.primary}CC`];

    if (onPress) {
      return (
        <Animated.View style={[variantStyles, animatedStyle, style]}>
          <TouchableOpacity
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={0.9}
            disabled={loading}
          >
            <LinearGradient
              colors={gradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradient}
            >
              {renderContent()}
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      );
    }

    return (
      <Animated.View style={[variantStyles, animatedStyle, style]}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {renderContent()}
        </LinearGradient>
      </Animated.View>
    );
  }

  // Render regular variants
  if (onPress) {
    return (
      <Animated.View style={[variantStyles, animatedStyle, style]}>
        <TouchableOpacity
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.7}
          disabled={loading}
        >
          {renderContent()}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[variantStyles, animatedStyle, style]}>
      {renderContent()}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  gradient: {
    borderRadius: Theme.BorderRadius.lg,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Theme.Spacing.md,
  },
  titleContainer: {
    flex: 1,
    paddingRight: Theme.Spacing.sm,
  },
  title: {
    fontWeight: Theme.Typography.weights.semibold,
    lineHeight: 20,
    marginBottom: Theme.Spacing.xs,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: Theme.BorderRadius.base,
    paddingHorizontal: Theme.Spacing.xs,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  trendText: {
    fontSize: Theme.Typography.sizes.xs,
    fontWeight: Theme.Typography.weights.medium,
    marginLeft: Theme.Spacing.xs / 2,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: Theme.BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  value: {
    fontWeight: Theme.Typography.weights.bold,
    lineHeight: 32,
    marginBottom: Theme.Spacing.xs,
  },
  subtitle: {
    fontSize: Theme.Typography.sizes.sm,
    lineHeight: 18,
    fontWeight: Theme.Typography.weights.medium,
  },
  actionIndicator: {
    position: 'absolute',
    bottom: Theme.Spacing.md,
    right: Theme.Spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: Theme.BorderRadius.sm,
    padding: Theme.Spacing.xs,
  },
});

export default StatCard;
