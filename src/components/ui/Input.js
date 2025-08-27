import React, { useState, useRef } from 'react';
import { View, TextInput, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Theme from '../../constants/Theme';
import Colors from '../../constants/Colors';

const Input = ({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  success,
  helperText,
  leftIcon,
  rightIcon,
  onRightIconPress,
  secureTextEntry = false,
  variant = 'outlined', // outlined, filled, underlined
  size = 'medium', // small, medium, large
  disabled = false,
  multiline = false,
  numberOfLines = 1,
  maxLength,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  autoCompleteType,
  style,
  inputStyle,
  labelStyle,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const animatedValue = useRef(new Animated.Value(value ? 1 : 0)).current;

  // Handle focus animations
  const handleFocus = () => {
    setIsFocused(true);
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: Theme.Animations.timing.base,
      useNativeDriver: false,
    }).start();
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (!value) {
      Animated.timing(animatedValue, {
        toValue: 0,
        duration: Theme.Animations.timing.base,
        useNativeDriver: false,
      }).start();
    }
  };

  // Get variant styles
  const getVariantStyles = () => {
    const baseStyle = {
      borderRadius: Theme.BorderRadius.base,
      minHeight: getSizeHeight(),
    };

    if (error) {
      switch (variant) {
        case 'outlined':
          return {
            ...baseStyle,
            borderWidth: 2,
            borderColor: Colors.error,
            backgroundColor: Colors.surface,
          };
        case 'filled':
          return {
            ...baseStyle,
            borderWidth: 0,
            backgroundColor: `${Colors.error}10`,
            borderBottomWidth: 2,
            borderBottomColor: Colors.error,
          };
        case 'underlined':
          return {
            ...baseStyle,
            borderWidth: 0,
            backgroundColor: 'transparent',
            borderBottomWidth: 2,
            borderBottomColor: Colors.error,
            borderRadius: 0,
          };
      }
    }

    if (success) {
      switch (variant) {
        case 'outlined':
          return {
            ...baseStyle,
            borderWidth: 2,
            borderColor: Colors.success,
            backgroundColor: Colors.surface,
          };
        case 'filled':
          return {
            ...baseStyle,
            borderWidth: 0,
            backgroundColor: `${Colors.success}10`,
            borderBottomWidth: 2,
            borderBottomColor: Colors.success,
          };
        case 'underlined':
          return {
            ...baseStyle,
            borderWidth: 0,
            backgroundColor: 'transparent',
            borderBottomWidth: 2,
            borderBottomColor: Colors.success,
            borderRadius: 0,
          };
      }
    }

    switch (variant) {
      case 'outlined':
        return {
          ...baseStyle,
          borderWidth: isFocused ? 2 : 1,
          borderColor: isFocused ? Colors.primary : Colors.border,
          backgroundColor: Colors.surface,
        };
      case 'filled':
        return {
          ...baseStyle,
          borderWidth: 0,
          backgroundColor: Colors.lightGray,
          borderBottomWidth: isFocused ? 2 : 1,
          borderBottomColor: isFocused ? Colors.primary : Colors.border,
        };
      case 'underlined':
        return {
          ...baseStyle,
          borderWidth: 0,
          backgroundColor: 'transparent',
          borderBottomWidth: isFocused ? 2 : 1,
          borderBottomColor: isFocused ? Colors.primary : Colors.border,
          borderRadius: 0,
        };
      default:
        return {
          ...baseStyle,
          borderWidth: isFocused ? 2 : 1,
          borderColor: isFocused ? Colors.primary : Colors.border,
          backgroundColor: Colors.surface,
        };
    }
  };

  // Get size-specific height
  const getSizeHeight = () => {
    if (multiline) return undefined;
    
    switch (size) {
      case 'small':
        return 36;
      case 'large':
        return 56;
      default:
        return 48;
    }
  };

  // Get padding based on size and icons
  const getPaddingStyles = () => {
    const basePadding = size === 'small' ? Theme.Spacing.sm : Theme.Spacing.md;
    const leftPadding = leftIcon ? Theme.Spacing['3xl'] : basePadding;
    const rightPadding = (rightIcon || secureTextEntry) ? Theme.Spacing['3xl'] : basePadding;

    return {
      paddingLeft: leftPadding,
      paddingRight: rightPadding,
      paddingTop: variant === 'underlined' ? Theme.Spacing.sm : basePadding,
      paddingBottom: variant === 'underlined' ? Theme.Spacing.sm : basePadding,
    };
  };

  // Animated label styles for floating labels
  const getAnimatedLabelStyle = () => {
    if (variant === 'underlined' || !label) return {};

    return {
      position: 'absolute',
      left: getPaddingStyles().paddingLeft,
      top: animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [getSizeHeight() / 2 - 8, 8],
      }),
      fontSize: animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [Theme.Typography.sizes.base, Theme.Typography.sizes.sm],
      }),
      color: error ? Colors.error : success ? Colors.success : isFocused ? Colors.primary : Colors.textSecondary,
      backgroundColor: variant === 'outlined' ? Colors.surface : 'transparent',
      paddingHorizontal: variant === 'outlined' ? Theme.Spacing.xs : 0,
    };
  };

  const variantStyles = getVariantStyles();
  const paddingStyles = getPaddingStyles();
  const shouldShowFloatingLabel = variant !== 'underlined' && label;

  return (
    <View style={[styles.container, style]}>
      {/* Fixed label for underlined variant */}
      {variant === 'underlined' && label && (
        <Text style={[styles.fixedLabel, labelStyle]}>
          {label}
        </Text>
      )}
      
      <View style={[styles.inputContainer, variantStyles]}>
        {/* Left icon */}
        {leftIcon && (
          <View style={styles.leftIconContainer}>
            <Ionicons
              name={leftIcon}
              size={size === 'small' ? 18 : 20}
              color={error ? Colors.error : success ? Colors.success : isFocused ? Colors.primary : Colors.textSecondary}
            />
          </View>
        )}

        {/* Floating label */}
        {shouldShowFloatingLabel && (
          <Animated.Text style={[styles.animatedLabel, getAnimatedLabelStyle(), labelStyle]}>
            {label}
          </Animated.Text>
        )}

        {/* Text input */}
        <TextInput
          style={[
            styles.input,
            paddingStyles,
            multiline && styles.multilineInput,
            disabled && styles.disabledInput,
            inputStyle,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={shouldShowFloatingLabel ? undefined : (label || placeholder)}
          placeholderTextColor={Colors.textLight}
          secureTextEntry={secureTextEntry && !showPassword}
          onFocus={handleFocus}
          onBlur={handleBlur}
          editable={!disabled}
          multiline={multiline}
          numberOfLines={multiline ? numberOfLines : 1}
          maxLength={maxLength}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCompleteType={autoCompleteType}
          {...props}
        />

        {/* Right icon or password toggle */}
        {(rightIcon || secureTextEntry) && (
          <TouchableOpacity
            style={styles.rightIconContainer}
            onPress={secureTextEntry ? () => setShowPassword(!showPassword) : onRightIconPress}
            disabled={disabled}
          >
            <Ionicons
              name={secureTextEntry ? (showPassword ? 'eye-off' : 'eye') : rightIcon}
              size={size === 'small' ? 18 : 20}
              color={error ? Colors.error : success ? Colors.success : isFocused ? Colors.primary : Colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Helper text or error */}
      {(error || success || helperText) && (
        <Text style={[
          styles.helperText,
          error && styles.errorText,
          success && styles.successText,
        ]}>
          {error || helperText}
        </Text>
      )}

      {/* Character count */}
      {maxLength && (
        <Text style={styles.characterCount}>
          {(value || '').length}/{maxLength}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Theme.Spacing.md,
  },
  inputContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: Theme.Typography.sizes.base,
    color: Colors.text,
    fontFamily: Theme.Typography.families.regular,
  },
  multilineInput: {
    textAlignVertical: 'top',
    paddingTop: Theme.Spacing.md,
  },
  disabledInput: {
    opacity: 0.6,
  },
  fixedLabel: {
    fontSize: Theme.Typography.sizes.sm,
    fontWeight: Theme.Typography.weights.medium,
    color: Colors.text,
    marginBottom: Theme.Spacing.xs,
  },
  animatedLabel: {
    fontWeight: Theme.Typography.weights.medium,
  },
  leftIconContainer: {
    position: 'absolute',
    left: Theme.Spacing.md,
    zIndex: 1,
  },
  rightIconContainer: {
    position: 'absolute',
    right: Theme.Spacing.md,
    zIndex: 1,
  },
  helperText: {
    fontSize: Theme.Typography.sizes.xs,
    color: Colors.textSecondary,
    marginTop: Theme.Spacing.xs,
    marginLeft: Theme.Spacing.sm,
  },
  errorText: {
    color: Colors.error,
  },
  successText: {
    color: Colors.success,
  },
  characterCount: {
    fontSize: Theme.Typography.sizes.xs,
    color: Colors.textLight,
    textAlign: 'right',
    marginTop: Theme.Spacing.xs,
  },
});

export default Input;
