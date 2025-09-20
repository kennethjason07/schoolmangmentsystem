import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { LinearGradient } from 'expo-linear-gradient';

// Import VidyaSetu logo
// TODO: Add your logo file to assets/logo-white.png
const VidyaSetuLogo = require('../../assets/logo-white.png');

const LoadingScreen = () => {
  const logoRef = useRef(null);

  useEffect(() => {
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
        {/* VidyaSetu Logo - Replace with your custom logo */}
        <Image
          source={VidyaSetuLogo}
          style={styles.logoImage}
          resizeMode="contain"
          onError={() => {
            // Fallback to icon if logo file is not found
            console.log('Logo file not found, using fallback icon');
          }}
        />
        {/* Logo already contains the VidyaSetu text, so we can hide these or keep them for emphasis */}
        {/* <Text style={styles.appTitle}>VidyaSetu</Text> */}
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
          Loading your dashboard...
        </Animatable.Text>
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
});

export default LoadingScreen;
