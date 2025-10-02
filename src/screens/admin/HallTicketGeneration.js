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

const HallTicketGeneration = ({ navigation }) => {
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
    // Simulate data refresh
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  };

  // Placeholder features that would be available
  const upcomingFeatures = [
    {
      icon: 'document-text',
      title: 'Bulk Hall Ticket Generation',
      description: 'Generate hall tickets for entire classes or individual students',
      color: '#2196F3'
    },
    {
      icon: 'qr-code',
      title: 'QR Code Integration',
      description: 'Automatic QR codes for digital verification and attendance tracking',
      color: '#4CAF50'
    },
    {
      icon: 'print',
      title: 'Print & Download',
      description: 'Direct printing and PDF download with custom templates',
      color: '#FF9800'
    },
    {
      icon: 'calendar',
      title: 'Exam Schedule Integration',
      description: 'Automatic inclusion of exam dates, times, and venue information',
      color: '#9C27B0'
    },
    {
      icon: 'shield-checkmark',
      title: 'Anti-Fraud Features',
      description: 'Watermarks, security codes, and verification systems',
      color: '#F44336'
    },
    {
      icon: 'mail',
      title: 'Automated Distribution',
      description: 'Email and SMS delivery to students and parents',
      color: '#607D8B'
    }
  ];

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Hall Ticket Generation" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading hall ticket generation...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Hall Ticket Generation" showBack={true} />
      
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
          title="Hall Ticket Generation"
          description="A comprehensive hall ticket generation system with automated student information, exam schedules, QR codes, and bulk processing capabilities."
          icon="document-text"
          primaryColor="#2196F3"
          backgroundColor="#E3F2FD"
        />

        {/* Feature Preview Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Planned Features</Text>
          <Text style={styles.sectionSubtitle}>
            When this feature is ready, you'll be able to:
          </Text>
          
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

        {/* Development Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Development Status</Text>
          
          <View style={styles.statusContainer}>
            <View style={styles.statusItem}>
              <View style={styles.statusIndicator}>
                <View style={[styles.statusDot, { backgroundColor: '#4CAF50' }]} />
                <Text style={styles.statusLabel}>UI Design</Text>
              </View>
              <Text style={styles.statusValue}>100%</Text>
            </View>
            
            <View style={styles.statusItem}>
              <View style={styles.statusIndicator}>
                <View style={[styles.statusDot, { backgroundColor: '#FF9800' }]} />
                <Text style={styles.statusLabel}>Backend Development</Text>
              </View>
              <Text style={styles.statusValue}>45%</Text>
            </View>
            
            <View style={styles.statusItem}>
              <View style={styles.statusIndicator}>
                <View style={[styles.statusDot, { backgroundColor: '#F44336' }]} />
                <Text style={styles.statusLabel}>Testing & Integration</Text>
              </View>
              <Text style={styles.statusValue}>0%</Text>
            </View>
          </View>
        </View>

        {/* Contact Section */}
        <View style={styles.section}>
          <View style={styles.contactCard}>
            <Ionicons name="bulb" size={32} color="#FF9800" />
            <Text style={styles.contactTitle}>Have Suggestions?</Text>
            <Text style={styles.contactText}>
              We'd love to hear your ideas for the hall ticket generation system!
            </Text>
            <TouchableOpacity style={styles.contactButton}>
              <Ionicons name="mail" size={16} color="#fff" />
              <Text style={styles.contactButtonText}>Send Feedback</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Add bottom padding to ensure last content is fully visible */}
        <View style={styles.bottomSpacer} />
        </ScrollView>
      </View>
      
      <FloatingRefreshButton 
        onRefresh={onRefresh}
        isRefreshing={refreshing}
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
  statusContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  statusLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
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
    backgroundColor: '#FF9800',
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

export default HallTicketGeneration;
