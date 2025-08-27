import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet, Animated, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Theme from '../../constants/Theme';
import Colors from '../../constants/Colors';

const Button = ({
  title,
  onPress,
  variant = 'primary', // primary, secondary, outline, ghost, danger, success
  size = 'medium', // small, medium, large
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left', // left, right
  fullWidth = false,
  gradient = false,
  style,
  textStyle,
  ...props
}) => {
  const [pressed, setPinned] = React.useState(false);
  const animatedScale = React.useRef(new Animated.Value(1)).current;

  // Handle press animations
  const handlePressIn = () => {
    setPinned(true);
    Animated.timing(animatedScale, {
      toValue: 0.95,
      duration: Theme.Animations.timing.fast,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    setPinned(false);
    Animated.timing(animatedScale, {
      toValue: 1,
      duration: Theme.Animations.timing.fast,
      useNativeDriver: true,
    }).start();
  };

  // Get variant styles
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: disabled ? Colors.gray : Colors.primary,
          borderColor: disabled ? Colors.gray : Colors.primary,
          borderWidth: 0,
        };
      case 'secondary':
        return {
          backgroundColor: disabled ? Colors.lightGray : Colors.secondary,
          borderColor: disabled ? Colors.lightGray : Colors.secondary,
          borderWidth: 0,
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderColor: disabled ? Colors.gray : Colors.primary,
          borderWidth: 1.5,
        };
      case 'ghost':
        return {
          backgroundColor: disabled ? Colors.lightGray : 'transparent',
          borderColor: 'transparent',
          borderWidth: 0,
        };
      case 'danger':
        return {
          backgroundColor: disabled ? Colors.gray : Colors.error,
          borderColor: disabled ? Colors.gray : Colors.error,
          borderWidth: 0,
        };
      case 'success':
        return {
          backgroundColor: disabled ? Colors.gray : Colors.success,
          borderColor: disabled ? Colors.gray : Colors.success,
          borderWidth: 0,
        };
      default:
        return {
          backgroundColor: disabled ? Colors.gray : Colors.primary,
          borderColor: disabled ? Colors.gray : Colors.primary,
          borderWidth: 0,
        };
    }
  };

  // Get text color based on variant
  const getTextColor = () => {
    if (disabled) return Colors.textLight;
    
    switch (variant) {
      case 'primary':
      case 'secondary':
      case 'danger':
      case 'success':
        return Colors.white;
      case 'outline':
        return Colors.primary;
      case 'ghost':
        return Colors.primary;
      default:
        return Colors.white;
    }
  };

  // Get size styles
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          paddingHorizontal: Theme.Spacing.md,
          paddingVertical: Theme.Spacing.sm,
          minHeight: 36,
        };
      case 'large':
        return {
          paddingHorizontal: Theme.Spacing.xl,
          paddingVertical: Theme.Spacing.base,
          minHeight: 52,
        };
      default: // medium
        return {
          paddingHorizontal: Theme.Spacing.lg,
          paddingVertical: Theme.Spacing.md,
          minHeight: 44,
        };
    }
  };

  // Get text size based on button size
  const getTextSize = () => {
    switch (size) {
      case 'small':
        return Theme.TextStyles.buttonSmall;
      case 'large':
        return Theme.TextStyles.buttonLarge;
      default:
        return Theme.TextStyles.button;
    }
  };

  // Get icon size based on button size
  const getIconSize = () => {
    switch (size) {
      case 'small':
        return 16;
      case 'large':
        return 24;
      default:
        return 20;
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();
  const textColor = getTextColor();

  const buttonStyle = [
    styles.button,
    variantStyles,
    sizeStyles,
    fullWidth && styles.fullWidth,
    disabled && styles.disabled,
    style,
  ];

  const textStyles = [
    getTextSize(),
    { color: textColor },
    textStyle,
  ];

  // Render button content
  const renderContent = () => (
    <View style={styles.content}>
      {loading && (
        <ActivityIndicator
          size="small"
          color={textColor}
          style={styles.loader}
        />
      )}
      {icon && iconPosition === 'left' && !loading && (
        <Ionicons
          name={icon}
          size={getIconSize()}
          color={textColor}
          style={[styles.icon, styles.iconLeft]}
        />
      )}
      <Text style={textStyles} numberOfLines={1}>
        {title}
      </Text>
      {icon && iconPosition === 'right' && !loading && (
        <Ionicons
          name={icon}
          size={getIconSize()}
          color={textColor}
          style={[styles.icon, styles.iconRight]}
        />
      )}
    </View>
  );

  // Render gradient button if requested
  if (gradient && variant === 'primary' && !disabled) {
    return (
      <Animated.View style={[{ transform: [{ scale: animatedScale }] }, fullWidth && styles.fullWidth]}>
        <TouchableOpacity
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled || loading}
          activeOpacity={0.8}
          {...props}
        >
          <LinearGradient
            colors={Colors.chart.blue && Colors.chart.purple ? [Colors.chart.blue, Colors.chart.purple] : ['#2196F3', '#9C27B0']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[buttonStyle, { backgroundColor: 'transparent' }]}
          >
            {renderContent()}
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={{ transform: [{ scale: animatedScale }] }}>
      <TouchableOpacity
        style={buttonStyle}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        activeOpacity={0.8}
        {...props}
      >
        {renderContent()}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: Theme.BorderRadius.base,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    ...Theme.Shadows.sm,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.6,
    ...Theme.Shadows.none,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: {
    marginRight: Theme.Spacing.sm,
  },
  icon: {
    // Base icon styles
  },
  iconLeft: {
    marginRight: Theme.Spacing.sm,
  },
  iconRight: {
    marginLeft: Theme.Spacing.sm,
  },
});

export default Button;
