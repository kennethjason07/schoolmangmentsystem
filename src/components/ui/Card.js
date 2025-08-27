import React from 'react';
import { View, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Theme from '../../constants/Theme';
import Colors from '../../constants/Colors';

const Card = ({
  children,
  variant = 'default', // default, elevated, outlined, gradient
  padding = 'medium', // none, small, medium, large
  margin = 'medium', // none, small, medium, large
  onPress,
  disabled = false,
  style,
  contentStyle,
  gradientColors,
  borderColor,
  backgroundColor,
  ...props
}) => {
  const [pressed, setPressed] = React.useState(false);
  const animatedScale = React.useRef(new Animated.Value(1)).current;
  const animatedOpacity = React.useRef(new Animated.Value(1)).current;

  // Handle press animations for interactive cards
  const handlePressIn = () => {
    if (!onPress || disabled) return;
    
    setPressed(true);
    Animated.parallel([
      Animated.timing(animatedScale, {
        toValue: 0.98,
        duration: Theme.Animations.timing.fast,
        useNativeDriver: true,
      }),
      Animated.timing(animatedOpacity, {
        toValue: 0.8,
        duration: Theme.Animations.timing.fast,
        useNativeDriver: true,
      })
    ]).start();
  };

  const handlePressOut = () => {
    if (!onPress || disabled) return;
    
    setPressed(false);
    Animated.parallel([
      Animated.timing(animatedScale, {
        toValue: 1,
        duration: Theme.Animations.timing.fast,
        useNativeDriver: true,
      }),
      Animated.timing(animatedOpacity, {
        toValue: 1,
        duration: Theme.Animations.timing.fast,
        useNativeDriver: true,
      })
    ]).start();
  };

  // Get variant styles
  const getVariantStyles = () => {
    switch (variant) {
      case 'elevated':
        return {
          backgroundColor: backgroundColor || Colors.surface,
          ...Theme.Shadows.lg,
          borderWidth: 0,
        };
      case 'outlined':
        return {
          backgroundColor: backgroundColor || Colors.surface,
          borderWidth: 1,
          borderColor: borderColor || Colors.border,
          ...Theme.Shadows.none,
        };
      case 'gradient':
        return {
          borderWidth: 0,
          ...Theme.Shadows.md,
        };
      default: // default
        return {
          backgroundColor: backgroundColor || Colors.surface,
          ...Theme.Shadows.base,
          borderWidth: 0,
        };
    }
  };

  // Get padding styles
  const getPaddingStyles = () => {
    switch (padding) {
      case 'none':
        return { padding: 0 };
      case 'small':
        return { padding: Theme.Spacing.sm };
      case 'large':
        return { padding: Theme.Spacing.xl };
      default: // medium
        return { padding: Theme.Spacing.base };
    }
  };

  // Get margin styles
  const getMarginStyles = () => {
    switch (margin) {
      case 'none':
        return { margin: 0 };
      case 'small':
        return { margin: Theme.Spacing.sm };
      case 'large':
        return { margin: Theme.Spacing.xl };
      default: // medium
        return { margin: Theme.Spacing.md };
    }
  };

  const variantStyles = getVariantStyles();
  const paddingStyles = getPaddingStyles();
  const marginStyles = getMarginStyles();

  const cardStyle = [
    styles.card,
    variantStyles,
    marginStyles,
    disabled && styles.disabled,
    style,
  ];

  const cardContentStyle = [
    paddingStyles,
    contentStyle,
  ];

  const animatedStyle = {
    transform: [{ scale: animatedScale }],
    opacity: animatedOpacity,
  };

  // Render gradient card
  if (variant === 'gradient') {
    const colors = gradientColors || Colors.chart.blue && Colors.chart.purple 
      ? [Colors.chart.blue, Colors.chart.purple] 
      : ['#2196F3', '#9C27B0'];

    if (onPress && !disabled) {
      return (
        <Animated.View style={[animatedStyle, cardStyle, { backgroundColor: 'transparent' }]}>
          <TouchableOpacity
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={disabled}
            activeOpacity={0.9}
            {...props}
          >
            <LinearGradient
              colors={colors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradient}
            >
              <View style={cardContentStyle}>
                {children}
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      );
    }

    return (
      <View style={[cardStyle, { backgroundColor: 'transparent' }]}>
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <View style={cardContentStyle}>
            {children}
          </View>
        </LinearGradient>
      </View>
    );
  }

  // Render interactive card
  if (onPress && !disabled) {
    return (
      <Animated.View style={animatedStyle}>
        <TouchableOpacity
          style={cardStyle}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled}
          activeOpacity={0.9}
          {...props}
        >
          <View style={cardContentStyle}>
            {children}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // Render static card
  return (
    <View style={cardStyle} {...props}>
      <View style={cardContentStyle}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: Theme.BorderRadius.md,
    overflow: 'hidden',
  },
  gradient: {
    borderRadius: Theme.BorderRadius.md,
  },
  disabled: {
    opacity: 0.6,
  },
});

export default Card;
