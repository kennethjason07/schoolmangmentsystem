import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Theme from '../../constants/Theme';
import Colors from '../../constants/Colors';

const LoadingState = ({
  variant = 'spinner', // spinner, skeleton, dots, pulse
  size = 'medium', // small, medium, large
  color = Colors.primary,
  text,
  fullScreen = false,
  style,
  textStyle,
}) => {
  const animatedValue = React.useRef(new Animated.Value(0)).current;
  const pulseValue = React.useRef(new Animated.Value(1)).current;
  const dotsValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (variant === 'pulse') {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseValue, {
            toValue: 1.2,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseValue, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
      return () => pulseAnimation.stop();
    }

    if (variant === 'dots') {
      const dotsAnimation = Animated.loop(
        Animated.timing(dotsValue, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      dotsAnimation.start();
      return () => dotsAnimation.stop();
    }
  }, [variant, pulseValue, dotsValue]);

  const getSize = () => {
    switch (size) {
      case 'small':
        return { width: 20, height: 20, fontSize: Theme.Typography.sizes.sm };
      case 'large':
        return { width: 48, height: 48, fontSize: Theme.Typography.sizes.lg };
      default:
        return { width: 32, height: 32, fontSize: Theme.Typography.sizes.base };
    }
  };

  const sizeProps = getSize();

  const renderSpinner = () => (
    <ActivityIndicator
      size={size === 'small' ? 'small' : 'large'}
      color={color}
    />
  );

  const renderSkeleton = () => {
    const skeletonAnimation = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
      const shimmer = Animated.loop(
        Animated.sequence([
          Animated.timing(skeletonAnimation, {
            toValue: 1,
            duration: 1000,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(skeletonAnimation, {
            toValue: 0,
            duration: 1000,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ])
      );
      shimmer.start();
      return () => shimmer.stop();
    }, []);

    const opacity = skeletonAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 0.7],
    });

    return (
      <View style={styles.skeletonContainer}>
        <Animated.View
          style={[
            styles.skeletonLine,
            { opacity, backgroundColor: Colors.lightGray },
            sizeProps,
          ]}
        />
        {text && (
          <Animated.View
            style={[
              styles.skeletonText,
              { opacity, backgroundColor: Colors.lightGray },
            ]}
          />
        )}
      </View>
    );
  };

  const renderDots = () => {
    const dots = [0, 1, 2];
    
    return (
      <View style={styles.dotsContainer}>
        {dots.map((index) => {
          const dotOpacity = dotsValue.interpolate({
            inputRange: [0, 0.33, 0.66, 1],
            outputRange: [0.3, index === 0 ? 1 : 0.3, index === 1 ? 1 : 0.3, index === 2 ? 1 : 0.3],
            extrapolate: 'clamp',
          });

          return (
            <Animated.View
              key={index}
              style={[
                styles.dot,
                {
                  opacity: dotOpacity,
                  backgroundColor: color,
                  width: sizeProps.width / 3,
                  height: sizeProps.height / 3,
                },
              ]}
            />
          );
        })}
      </View>
    );
  };

  const renderPulse = () => (
    <Animated.View
      style={[
        styles.pulseContainer,
        {
          transform: [{ scale: pulseValue }],
          backgroundColor: `${color}20`,
          width: sizeProps.width * 2,
          height: sizeProps.height * 2,
        },
      ]}
    >
      <View
        style={[
          styles.pulseCore,
          {
            backgroundColor: color,
            width: sizeProps.width,
            height: sizeProps.height,
          },
        ]}
      />
    </Animated.View>
  );

  const renderLoadingIndicator = () => {
    switch (variant) {
      case 'skeleton':
        return renderSkeleton();
      case 'dots':
        return renderDots();
      case 'pulse':
        return renderPulse();
      default:
        return renderSpinner();
    }
  };

  const containerStyle = [
    styles.container,
    fullScreen && styles.fullScreenContainer,
    style,
  ];

  return (
    <View style={containerStyle}>
      {renderLoadingIndicator()}
      {text && (
        <Text style={[styles.text, { fontSize: sizeProps.fontSize, color }, textStyle]}>
          {text}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Theme.Spacing.base,
  },
  fullScreenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 1000,
  },
  text: {
    marginTop: Theme.Spacing.md,
    textAlign: 'center',
    fontWeight: Theme.Typography.weights.medium,
  },
  skeletonContainer: {
    alignItems: 'center',
  },
  skeletonLine: {
    borderRadius: Theme.BorderRadius.sm,
  },
  skeletonText: {
    width: 120,
    height: 16,
    borderRadius: Theme.BorderRadius.sm,
    marginTop: Theme.Spacing.sm,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: 60,
  },
  dot: {
    borderRadius: Theme.BorderRadius.full,
  },
  pulseContainer: {
    borderRadius: Theme.BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseCore: {
    borderRadius: Theme.BorderRadius.full,
  },
});

export default LoadingState;
