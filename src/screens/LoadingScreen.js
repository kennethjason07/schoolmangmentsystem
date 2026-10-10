import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { LinearGradient } from 'expo-linear-gradient';

// Import CampusSentinel logo
// TODO: Add your logo file to assets/logo-white.png
const CampusSentinelLogo = require('../../assets/logo-white.png');

const LoadingScreen = () => {
  const logoRef = useRef(null);
  const [takingLong, setTakingLong] = React.useState(false);

  useEffect(() => {
    // Show "Slow connection" message after 12 seconds
    const timer = setTimeout(() => {
      setTakingLong(true);
    }, 12000);
    
    // Start a continuous pulse animation for the logo
    if (logoRef.current) {
      logoRef.current.pulse(1500);
      const interval = setInterval(() => {
        if (logoRef.current) {
          logoRef.current.pulse(1500);
        }
      }, 2000);

      return () => clearInterval(interval);
    }
  }, []);

  return (
    <LinearGradient
      colors={['#667eea', '#764ba2']}
      style={styles.container}
    >
      <Animatable.View 
        ref={logoRef}
        style={styles.logoContainer}
        animation="fadeInDown"
        duration={1000}
      >
        {/* CampusSentinel Logo - Replace with your custom logo */}
        <Image
          source={CampusSentinelLogo}
          style={styles.logoImage}
          resizeMode="contain"
          onError={() => {
            // Fallback to icon if logo file is not found
            console.log('Logo file not found, using fallback icon');
          }}
        />
        {/* Logo already contains the CampusSentinel text, so we can hide these or keep them for emphasis */}
        {/* <Text style={styles.appTitle}>CampusSentinel</Text> */}
        <Text style={styles.subtitle}>Bridge of Knowledge</Text>
      </Animatable.View>
      
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
        <Animatable.Text 
          style={styles.loadingText}
          animation="fadeIn"
          iterationCount="infinite"
          direction="alternate"
          duration={1000}
        >
          {takingLong ? 'Still connecting to server...' : 'Loading your dashboard...'}
        </Animatable.Text>
        {takingLong && (
          <Animatable.Text 
            style={styles.slowConnectionText}
            animation="fadeIn"
            duration={1000}
          >
            Connection seems slow. Please wait...
          </Animatable.Text>
        )}
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logoImage: {
    width: 150,
    height: 150,
    // tintColor removed to show original logo colors
  },
  appTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '300',
  },
  loadingContainer: {
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#fff',
    fontWeight: '400',
    textAlign: 'center',
  },
  slowConnectionText: {
    marginTop: 10,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '300',
    textAlign: 'center',
    fontStyle: 'italic'
  },
});

export default LoadingScreen;
