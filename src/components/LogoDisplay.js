import React, { useState } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const LogoDisplay = ({ logoUrl, onImageError, size = 60 }) => {
  const [imageError, setImageError] = useState(false);
  
  // Check if the URL is valid for display
  const isValidImageUrl = (url) => {
    if (!url) return false;
    
    // Check for local file paths that won't work across sessions
    if (url.startsWith('file://')) {
      console.log('🚫 Local file path detected, not accessible:', url);
      return false;
    }
    
    // Check for other invalid patterns
    if (url.includes('ExperienceData') || url.includes('ImagePicker')) {
      console.log('🚫 Temporary image picker path detected:', url);
      return false;
    }
    
    
    // Must be a valid HTTP/HTTPS URL
    return url.startsWith('http://') || url.startsWith('https://');
  };

  // Show placeholder if URL is invalid or image failed to load
  const shouldShowPlaceholder = !logoUrl || !isValidImageUrl(logoUrl) || imageError;

  if (shouldShowPlaceholder) {
    return (
      <View style={[styles.logoPlaceholder, { width: size, height: size, borderRadius: size / 2 }]}>
        <Ionicons name="school" size={size * 0.67} color="#fff" />
      </View>
    );
  }

  return (
    <Image 
      source={{ uri: logoUrl }} 
      style={[styles.schoolLogo, { width: size, height: size, borderRadius: size / 2 }]}
      onError={(error) => {
        // Extract error message safely to avoid cyclical JSON structure
        const errorMsg = error.nativeEvent?.error || 'Image loading failed';
        console.log('🗺️ Logo image loading error:', errorMsg);
        console.log('🗺️ Image URL:', logoUrl);
        setImageError(true);
        if (onImageError) {
          onImageError({ message: errorMsg, url: logoUrl });
        }
      }}
      onLoad={() => {
        console.log('✅ Logo image loaded successfully');
        setImageError(false);
      }}
      onLoadStart={() => {
        console.log('🔄 Starting to load logo image:', logoUrl);
      }}
    />
  );
};

const styles = StyleSheet.create({
  schoolLogo: {
    marginRight: 15,
  },
  logoPlaceholder: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
});

export default LogoDisplay;
