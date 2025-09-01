import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const UpcomingFeatureBanner = ({ 
  title, 
  description = "This feature is currently under development and will be available soon.",
  icon = "construct",
  primaryColor = "#FF9800",
  backgroundColor = "#FFF3E0"
}) => {
  return (
    <View style={[styles.bannerContainer, { backgroundColor }]}>
      <View style={styles.bannerContent}>
        <View style={[styles.iconContainer, { backgroundColor: primaryColor }]}>
          <Ionicons name={icon} size={32} color="#fff" />
        </View>
        
        <View style={styles.textContainer}>
          <Text style={[styles.bannerTitle, { color: primaryColor }]}>
            {title} - Coming Soon!
          </Text>
          <Text style={styles.bannerDescription}>
            {description}
          </Text>
          
          <View style={styles.featureInfo}>
            <Ionicons name="time" size={16} color="#666" />
            <Text style={styles.featureInfoText}>
              Feature in development • Expected release: Q1 2025
            </Text>
          </View>
        </View>
      </View>
      
      <View style={styles.decorativeElements}>
        <View style={[styles.decorativeCircle, { backgroundColor: primaryColor }]} />
        <View style={[styles.decorativeCircle2, { backgroundColor: primaryColor }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bannerContainer: {
    margin: 16,
    borderRadius: 16,
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 152, 0, 0.2)',
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    zIndex: 2,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  textContainer: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  bannerDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  featureInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureInfoText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
    fontStyle: 'italic',
  },
  decorativeElements: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 100,
    zIndex: 1,
  },
  decorativeCircle: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    opacity: 0.1,
    top: -20,
    right: -20,
  },
  decorativeCircle2: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    opacity: 0.15,
    bottom: -10,
    right: 20,
  },
});

export default UpcomingFeatureBanner;
