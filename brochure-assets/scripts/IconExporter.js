import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { captureRef } from 'react-native-view-shot';

/**
 * VidyaSethu Icon Exporter Component
 * 
 * This component renders and exports the exact Ionicons used in the VidyaSethu app
 * for use in brochures, websites, and marketing materials.
 * 
 * Usage:
 * 1. Import this component in your React Native app
 * 2. Add it to a screen temporarily
 * 3. Run the export functions to generate icon files
 * 4. Use the generated files in your brochures
 */

const VidyaSethuIconExporter = () => {
  const iconRefs = {
    academic: React.useRef(),
    attendance: React.useRef(),
    finance: React.useRef(),
    communication: React.useRef(),
    reports: React.useRef(),
    administration: React.useRef(),
    mobile: React.useRef(),
  };

  // VidyaSethu feature icons configuration
  const vidyaSethuIcons = [
    {
      key: 'academic',
      name: 'school',
      color: '#4CAF50',
      feature: 'Academic Management',
      description: 'Student & teacher profiles, classes, subjects, exams, grades'
    },
    {
      key: 'attendance',
      name: 'checkmark-circle',
      color: '#4CAF50',
      feature: 'Attendance Tracking',
      description: 'Daily attendance for students & staff with analytics'
    },
    {
      key: 'finance',
      name: 'card',
      color: '#2196F3',
      feature: 'Finance & Fees',
      description: 'Digital fee collection, expense tracking, reports'
    },
    {
      key: 'communication',
      name: 'chatbubbles',
      color: '#9C27B0',
      feature: 'Communication',
      description: 'In-App chat, SMS & WhatsApp notifications'
    },
    {
      key: 'reports',
      name: 'bar-chart',
      color: '#2196F3',
      feature: 'Reports & Analytics',
      description: 'Real-time dashboards, report cards, custom reports'
    },
    {
      key: 'administration',
      name: 'people',
      color: '#2196F3',
      feature: 'Administration Tools',
      description: 'Roles, events, tasks, leave management'
    },
    {
      key: 'mobile',
      name: 'phone-portrait',
      color: '#2196F3',
      feature: 'Mobile-Friendly',
      description: 'Access anytime via app with live updates'
    }
  ];

  // Export single icon as PNG
  const exportIconAsPNG = async (iconKey, size = 64) => {
    try {
      const ref = iconRefs[iconKey];
      if (!ref.current) return;

      const uri = await captureRef(ref.current, {
        format: 'png',
        quality: 1,
        width: size,
        height: size,
        backgroundColor: 'transparent'
      });

      const icon = vidyaSethuIcons.find(i => i.key === iconKey);
      const fileName = `vidyasethu-${iconKey}-${size}px.png`;
      
      // Save to device storage
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status === 'granted') {
        await MediaLibrary.createAssetAsync(uri);
        console.log(`✅ Exported: ${fileName} for ${icon.feature}`);
      }

      return { uri, fileName, feature: icon.feature };
    } catch (error) {
      console.error(`❌ Error exporting ${iconKey}:`, error);
      return null;
    }
  };

  // Export all icons in multiple sizes
  const exportAllIcons = async () => {
    const sizes = [24, 32, 48, 64, 128, 256]; // Multiple sizes for different use cases
    const results = [];

    console.log('🚀 Starting VidyaSethu icon export...');

    for (const icon of vidyaSethuIcons) {
      for (const size of sizes) {
        const result = await exportIconAsPNG(icon.key, size);
        if (result) {
          results.push(result);
        }
        // Small delay to ensure smooth rendering
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`✅ Export complete! Generated ${results.length} icon files.`);
    return results;
  };

  // Export icons with brand colors variants
  const exportBrandVariants = async () => {
    const brandColors = {
      primary: '#2196F3',
      success: '#4CAF50', 
      warning: '#FF9800',
      purple: '#9C27B0',
      danger: '#F44336',
      dark: '#333333',
      light: '#666666'
    };

    console.log('🎨 Exporting brand color variants...');
    
    // This would require dynamic color rendering
    // For now, we'll export a reference guide
    const colorGuide = {
      message: 'Brand color variants available',
      colors: brandColors,
      icons: vidyaSethuIcons.map(icon => ({
        feature: icon.feature,
        iconName: icon.name,
        defaultColor: icon.color,
        variants: Object.keys(brandColors)
      }))
    };

    console.log('🎨 Brand variants guide:', colorGuide);
    return colorGuide;
  };

  return (
    <View style={styles.container}>
      {vidyaSethuIcons.map((icon) => (
        <View key={icon.key} style={styles.iconContainer}>
          <View
            ref={iconRefs[icon.key]}
            style={styles.iconWrapper}
            collapsable={false}
          >
            <Ionicons
              name={icon.name}
              size={64}
              color={icon.color}
            />
          </View>
        </View>
      ))}
      
      {/* Export Controls - Add buttons to trigger exports */}
      <View style={styles.controls}>
        {/* These would be TouchableOpacity buttons in a real implementation */}
        {/* For now, call exportAllIcons() programmatically */}
      </View>
    </View>
  );
};

// Export utility functions for external use
export const IconExportUtils = {
  // Get icon data for external processing
  getIconData: () => [
    { key: 'academic', name: 'school', color: '#4CAF50', feature: 'Academic Management' },
    { key: 'attendance', name: 'checkmark-circle', color: '#4CAF50', feature: 'Attendance Tracking' },
    { key: 'finance', name: 'card', color: '#2196F3', feature: 'Finance & Fees' },
    { key: 'communication', name: 'chatbubbles', color: '#9C27B0', feature: 'Communication' },
    { key: 'reports', name: 'bar-chart', color: '#2196F3', feature: 'Reports & Analytics' },
    { key: 'administration', name: 'people', color: '#2196F3', feature: 'Administration Tools' },
    { key: 'mobile', name: 'phone-portrait', color: '#2196F3', feature: 'Mobile-Friendly' }
  ],

  // Generate SVG string for an icon (for web use)
  generateIconSVG: (iconName, color = '#2196F3', size = 24) => {
    // This would need to be implemented with a proper SVG library
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="${color}">
      <!-- ${iconName} SVG path would go here -->
      <!-- This requires converting Ionicons to SVG format -->
    </svg>`;
  },

  // Get CSS classes for web implementation
  getWebCSS: () => `
    .vidyasethu-icon {
      display: inline-block;
      width: 24px;
      height: 24px;
      vertical-align: middle;
    }
    
    .vidyasethu-icon--academic { color: #4CAF50; }
    .vidyasethu-icon--attendance { color: #4CAF50; }
    .vidyasethu-icon--finance { color: #2196F3; }
    .vidyasethu-icon--communication { color: #9C27B0; }
    .vidyasethu-icon--reports { color: #2196F3; }
    .vidyasethu-icon--administration { color: #2196F3; }
    .vidyasethu-icon--mobile { color: #2196F3; }
    
    .vidyasethu-icon--small { width: 16px; height: 16px; }
    .vidyasethu-icon--medium { width: 24px; height: 24px; }
    .vidyasethu-icon--large { width: 32px; height: 32px; }
    .vidyasethu-icon--xl { width: 48px; height: 48px; }
  `
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    margin: 10,
    alignItems: 'center',
  },
  iconWrapper: {
    width: 80,
    height: 80,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    marginTop: 30,
    alignItems: 'center',
  }
});

export default VidyaSethuIconExporter;
