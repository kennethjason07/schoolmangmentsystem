import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import UpcomingFeatureBanner from '../../components/UpcomingFeatureBanner';
import FloatingRefreshButton from '../../components/FloatingRefreshButton';

const { width } = Dimensions.get('window');

const AutoGrading = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Simulate initial loading
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    // Simulate AI model refresh
    setTimeout(() => {
      setRefreshing(false);
    }, 2000);
  };

  // AI-powered features that would be available
  const upcomingFeatures = [
    {
      icon: 'brain',
      title: 'AI-Powered Essay Grading',
      description: 'Intelligent evaluation of written assignments with detailed feedback',
      color: '#6B73FF'
    },
    {
      icon: 'scan',
      title: 'Optical Answer Recognition',
      description: 'Scan and automatically grade multiple choice and fill-in-the-blank questions',
      color: '#4CAF50'
    },
    {
      icon: 'analytics',
      title: 'Intelligent Analytics',
      description: 'Performance insights and learning pattern analysis for each student',
      color: '#FF9800'
    },
    {
      icon: 'chatbubbles',
      title: 'Personalized Feedback',
      description: 'AI-generated constructive feedback tailored to each student\'s performance',
      color: '#9C27B0'
    },
    {
      icon: 'speedometer',
      title: 'Instant Results',
      description: 'Real-time grading with immediate result publication to students',
      color: '#F44336'
    },
    {
      icon: 'shield-checkmark',
      title: 'Plagiarism Detection',
      description: 'Advanced AI to detect and flag potential academic dishonesty',
      color: '#607D8B'
    }
  ];

  // AI capabilities showcase
  const aiCapabilities = [
    {
      title: 'Natural Language Processing',
      description: 'Understanding context, grammar, and meaning in student responses',
      percentage: 85,
      color: '#2196F3'
    },
    {
      title: 'Mathematical Problem Solving',
      description: 'Step-by-step solution verification and partial credit assignment',
      percentage: 70,
      color: '#4CAF50'
    },
    {
      title: 'Image & Diagram Recognition',
      description: 'Processing handwritten work and technical drawings',
      percentage: 60,
      color: '#FF9800'
    },
    {
      title: 'Multi-language Support',
      description: 'Grading assignments in multiple languages and scripts',
      percentage: 40,
      color: '#9C27B0'
    }
  ];

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Auto Grading System" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6B73FF" />
          <Text style={styles.loadingText}>Loading auto grading system...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Auto Grading System" showBack={true} />
      
      <View style={styles.scrollWrapper}>
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={Platform.OS === 'web'}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          keyboardShouldPersistTaps="handled"
          bounces={Platform.OS !== 'web'}
        >
        {/* Upcoming Feature Banner */}
        <UpcomingFeatureBanner
          title="AI Auto Grading"
          description="Revolutionary AI-powered grading system that provides instant, accurate, and fair assessment of student work with detailed feedback and analytics."
          icon="brain"
          primaryColor="#6B73FF"
          backgroundColor="#F3F4FF"
        />

        {/* AI Capabilities Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI Capabilities</Text>
          <Text style={styles.sectionSubtitle}>
            Our advanced AI system is being trained to handle various types of assessments:
          </Text>
          
          <View style={styles.capabilitiesContainer}>
            {aiCapabilities.map((capability, index) => (
              <View key={index} style={styles.capabilityCard}>
                <View style={styles.capabilityHeader}>
                  <Text style={styles.capabilityTitle}>{capability.title}</Text>
                  <Text style={[styles.capabilityPercentage, { color: capability.color }]}>
                    {capability.percentage}%
                  </Text>
                </View>
                <Text style={styles.capabilityDescription}>{capability.description}</Text>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { 
                        width: `${capability.percentage}%`, 
                        backgroundColor: capability.color 
                      }
                    ]} 
                  />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Feature Preview Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Features</Text>
          
          <View style={styles.featuresGrid}>
            {upcomingFeatures.map((feature, index) => (
              <View key={index} style={styles.featureCard}>
                <View style={[styles.featureIcon, { backgroundColor: feature.color }]}>
                  <Ionicons name={feature.icon} size={24} color="#fff" />
                </View>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Technology Stack */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Technology Stack</Text>
          
          <View style={styles.techStackContainer}>
            <View style={styles.techItem}>
              <Ionicons name="hardware-chip" size={24} color="#6B73FF" />
              <Text style={styles.techName}>Machine Learning</Text>
              <Text style={styles.techDescription}>TensorFlow & Neural Networks</Text>
            </View>
            
            <View style={styles.techItem}>
              <Ionicons name="language" size={24} color="#4CAF50" />
              <Text style={styles.techName}>Natural Language Processing</Text>
              <Text style={styles.techDescription}>Advanced text analysis</Text>
            </View>
            
            <View style={styles.techItem}>
              <Ionicons name="camera" size={24} color="#FF9800" />
              <Text style={styles.techName}>Computer Vision</Text>
              <Text style={styles.techDescription}>Handwriting & image recognition</Text>
            </View>
          </View>
        </View>

        {/* Contact Section */}
        <View style={styles.section}>
          <View style={styles.contactCard}>
            <Ionicons name="rocket" size={32} color="#6B73FF" />
            <Text style={styles.contactTitle}>Excited About AI Grading?</Text>
            <Text style={styles.contactText}>
              Be among the first to know when our AI grading system launches!
            </Text>
            <TouchableOpacity style={[styles.contactButton, { backgroundColor: '#6B73FF' }]}>
              <Ionicons name="notifications" size={16} color="#fff" />
              <Text style={styles.contactButtonText}>Get Notified</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Add bottom padding to ensure last content is fully visible */}
        <View style={styles.bottomSpacer} />
        </ScrollView>
      </View>
      
      <FloatingRefreshButton 
        onPress={onRefresh}
        refreshing={refreshing}
        bottom={80}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  // Enhanced scroll wrapper styles for web compatibility
  scrollWrapper: {
    flex: 1,
    ...Platform.select({
      web: {
        height: 'calc(100vh - 160px)',
        maxHeight: 'calc(100vh - 160px)',
        minHeight: 400,
        overflow: 'hidden',
      },
    }),
  },
  scrollContainer: {
    flex: 1,
    ...Platform.select({
      web: {
        overflowY: 'auto',
      },
    }),
  },
  scrollContent: {
    flexGrow: 1,
    ...Platform.select({
      web: {
        paddingBottom: 40,
      },
    }),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  section: {
    margin: 16,
    marginTop: 0,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  capabilitiesContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  capabilityCard: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  capabilityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  capabilityTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  capabilityPercentage: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  capabilityDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
    lineHeight: 18,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  featureCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: (width - 56) / 2, // Two columns with margins
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    alignItems: 'center',
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  featureDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 16,
  },
  techStackContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  techItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  techName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  techDescription: {
    fontSize: 12,
    color: '#666',
    marginLeft: 12,
    flex: 1,
  },
  contactCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
    marginBottom: 8,
  },
  contactText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  contactButton: {
    backgroundColor: '#6B73FF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  contactButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  bottomSpacer: {
    height: 20,
  },
});

export default AutoGrading;
