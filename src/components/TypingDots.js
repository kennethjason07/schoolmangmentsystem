import React from 'react';
import { View, StyleSheet } from 'react-native';
import * as Animatable from 'react-native-animatable';

// Simple WhatsApp-style typing indicator with three animated dots inside a bubble
// Props:
// - dotColor: color of the dots (default '#1976d2')
// - bubbleColor: background color of bubble (default 'rgba(25,118,210,0.12)')
// - style: container style overrides
// - size: dot size (default 6)
// - spacing: spacing between dots (default 4)
export default function TypingDots({ dotColor = '#1976d2', bubbleColor = 'rgba(25,118,210,0.12)', style, size = 6, spacing = 4 }) {
  const dotAnim = {
    0: { opacity: 0.3, transform: [{ translateY: 0 }] },
    0.5: { opacity: 1, transform: [{ translateY: -2 }] },
    1: { opacity: 0.3, transform: [{ translateY: 0 }] },
  };

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.bubble, { backgroundColor: bubbleColor }]}>
        <Animatable.View
          animation={dotAnim}
          iterationCount="infinite"
          duration={900}
          delay={0}
          useNativeDriver
          style={[styles.dot, { backgroundColor: dotColor, width: size, height: size, marginHorizontal: spacing / 2 }]}
        />
        <Animatable.View
          animation={dotAnim}
          iterationCount="infinite"
          duration={900}
          delay={150}
          useNativeDriver
          style={[styles.dot, { backgroundColor: dotColor, width: size, height: size, marginHorizontal: spacing / 2 }]}
        />
        <Animatable.View
          animation={dotAnim}
          iterationCount="infinite"
          duration={900}
          delay={300}
          useNativeDriver
          style={[styles.dot, { backgroundColor: dotColor, width: size, height: size, marginHorizontal: spacing / 2 }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  dot: {
    borderRadius: 999,
  },
});
