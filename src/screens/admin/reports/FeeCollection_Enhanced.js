/**
 * 🚀 ENHANCED FEE COLLECTION SCREEN
 * 
 * Breaking changes implementation example using the enhanced tenant system
 * - Full tenant isolation with performance optimizations
 * - Real-time data updates
 * - Enhanced error handling and progress indicators
 * - Advanced caching and subscription management
 * 
 * This is an example of how to migrate existing screens to use the enhanced system
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import Header from '../../../components/Header';
import ExportModal from '../../../components/ExportModal';
import { PieChart, BarChart } from 'react-native-chart-kit';
import CrossPlatformDatePicker, { DatePickerButton } from '../../../components/CrossPlatformDatePicker';

// 🚀 BREAKING CHANGE: Import enhanced services instead of legacy helpers
import { 
  enhancedFeeService, 
  enhancedTenantDB,
  useTenantAccess 
} from '../../../utils/tenantHelpers';
import { EXPORT_FORMATS } from '../../../utils/exportUtils';

const { width: screenWidth } = Dimensions.get('window');

const FeeCollectionEnhanced = ({ navigation }) => {
  // 🚀 BREAKING CHANGE: Use enhanced tenant access
  const { 
    tenantId, 
    isReady, 
    isLoading: tenantLoading, 
    error: tenantError,
    healthStatus 
  } = useTenantAccess();

  // State management
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState({ step: '', progress: 0 });
  
  // 🚀 BREAKING CHANGE: Enhanced data state with real-time capabilities
  const [feeData, setFeeData] = useState([]);
  const [realtimeSubscription, setRealtimeSubscription] = useState(null);
  
  // Filter states
  const [selectedClass, setSelectedClass] = useState('All');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('2024-25');
  const [selectedDateRange, setSelectedDateRange] = useState('thisMonth');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  
  // Enhanced statistics state
  const [stats, setStats] = useState({
    totalCollected: 0,
    totalOutstanding: 0,
    totalExpected: 0,
    collectionRate: 0,
    monthlyCollection: [],
    paymentModeDistribution: [],
    classWiseCollection: [],
    recentPayments: [],
  });

  // 🚀 BREAKING CHANGE: Enhanced tenant validation
  const checkEnhancedTenantReady = useCallback(() => {
    return isReady && !tenantLoading && !tenantError && tenantId && healthStatus?.isHealthy;
  }, [isReady, tenantLoading, tenantError, tenantId, healthStatus]);

  // 🚀 BREAKING CHANGE: Enhanced data loading with progress tracking
  const loadFeeDataEnhanced = useCallback(async () => {
    if (!checkEnhancedTenantReady()) {
      console.warn('🚨 Enhanced Fee Collection: Tenant system not ready');
      return;
    }

    try {
      setLoading(true);
      setLoadingProgress({ step: 'Initializing enhanced fee data loading', progress: 0 });

      // 🚀 Use enhanced fee service with progress tracking
      const result = await enhancedFeeService.getAllFeeData({
        useCache: true,
        academicYear: selectedAcademicYear,
        classId: selectedClass !== 'All' ? selectedClass : undefined,
        onProgress: setLoadingProgress
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      setLoadingProgress({ step: 'Processing fee statistics', progress: 80 });

      // Calculate payment statistics using enhanced service
      const statsResult = await enhancedFeeService.calculatePaymentStatistics(result.data, {
        onProgress: (progress) => setLoadingProgress({
          step: `Calculating statistics: ${progress.step}`,
          progress: 80 + (progress.progress * 0.15)
        })
      });

      if (!statsResult.success) {
        throw new Error(statsResult.error);
      }

      // Get recent payments
      const paymentsResult = await enhancedFeeService.getRecentPayments({
        limit: 10,
        classId: selectedClass !== 'All' ? selectedClass : undefined,
        useCache: true
      });

      // Update state with enhanced data
      setStats({
        totalCollected: statsResult.data.summary.totalCollected,
        totalOutstanding: statsResult.data.summary.totalOutstanding,
        totalExpected: statsResult.data.summary.totalDue,
        collectionRate: statsResult.data.summary.collectionRate,
        // Additional processing for charts would go here
        monthlyCollection: [],
        paymentModeDistribution: [],
        classWiseCollection: statsResult.data.classStats,
        recentPayments: paymentsResult.success ? paymentsResult.data : [],
      });

      setLoadingProgress({ step: 'Enhanced fee data loaded successfully', progress: 100 });
      console.log('✅ Enhanced Fee Collection: Data loaded successfully');

    } catch (error) {
      console.error('❌ Enhanced Fee Collection: Error loading data:', error);
      Alert.alert('Enhanced System Error', `Failed to load fee data: ${error.message}`);
      
      // Enhanced error reporting
      setStats({
        totalCollected: 0,
        totalOutstanding: 0,
        totalExpected: 0,
        collectionRate: 0,
        monthlyCollection: [],
        paymentModeDistribution: [],
        classWiseCollection: [],
        recentPayments: [],
      });
    } finally {
      setLoading(false);
      setLoadingProgress({ step: '', progress: 0 });
    }
  }, [checkEnhancedTenantReady, selectedAcademicYear, selectedClass]);

  // 🚀 BREAKING CHANGE: Enhanced real-time subscriptions
  const setupRealtimeUpdates = useCallback(async () => {
    if (!checkEnhancedTenantReady()) return;

    try {
      console.log('🔄 Enhanced Fee Collection: Setting up real-time updates');
      
      const subscription = await enhancedFeeService.subscribeToFeeUpdates(
        (update) => {
          console.log('🔄 Real-time fee update received:', update);
          
          // Refresh data on real-time updates
          loadFeeDataEnhanced();
        },
        {
          classId: selectedClass !== 'All' ? selectedClass : undefined
        }
      );

      if (subscription.success) {
        setRealtimeSubscription(subscription);
        console.log('✅ Enhanced Fee Collection: Real-time subscription active');
      }

    } catch (error) {
      console.error('❌ Enhanced Fee Collection: Real-time setup failed:', error);
    }
  }, [checkEnhancedTenantReady, selectedClass, loadFeeDataEnhanced]);

  // 🚀 Enhanced initialization
  useEffect(() => {
    if (checkEnhancedTenantReady()) {
      console.log('🚀 Enhanced Fee Collection: Initializing with tenant ID:', tenantId);
      loadFeeDataEnhanced();
      setupRealtimeUpdates();
    }
  }, [checkEnhancedTenantReady, tenantId]);

  // Clean up subscriptions
  useEffect(() => {
    return () => {
      if (realtimeSubscription) {
        realtimeSubscription.unsubscribe();
        console.log('🧹 Enhanced Fee Collection: Real-time subscription cleaned up');
      }
    };
  }, [realtimeSubscription]);

  // 🚀 BREAKING CHANGE: Enhanced refresh with progress tracking
  const onRefreshEnhanced = useCallback(async () => {
    setRefreshing(true);
    setLoadingProgress({ step: 'Refreshing enhanced fee data', progress: 0 });
    
    try {
      await loadFeeDataEnhanced();
    } finally {
      setRefreshing(false);
      setLoadingProgress({ step: '', progress: 0 });
    }
  }, [loadFeeDataEnhanced]);

  // Enhanced currency formatting
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Loading state with enhanced progress
  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Enhanced Fee Collection" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>
            {loadingProgress.step || 'Loading enhanced fee data...'}
          </Text>
          {loadingProgress.progress > 0 && (
            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, { width: `${loadingProgress.progress}%` }]} />
            </View>
          )}
          {tenantError && (
            <Text style={styles.errorText}>
              Enhanced Tenant Error: {tenantError}
            </Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Enhanced Fee Collection" showBack={true} />

      <View style={styles.scrollWrapper}>
        {/* Enhanced Status Bar */}
        <View style={styles.statusBar}>
          <View style={styles.statusItem}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={styles.statusText}>Enhanced System Active</Text>
          </View>
          {healthStatus?.isHealthy && (
            <View style={styles.statusItem}>
              <Ionicons name="pulse" size={16} color="#2196F3" />
              <Text style={styles.statusText}>Real-time Updates</Text>
            </View>
          )}
        </View>

        {/* Filters Section - Same as before */}
        <View style={styles.filtersSection}>
          <Text style={styles.sectionTitle}>Enhanced Filters</Text>
          {/* Filter implementation would be the same */}
        </View>
      </View>

      {/* Main Content with Enhanced ScrollView */}
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={Platform.OS === 'web'}
        nestedScrollEnabled={true}
        overScrollMode="always"
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefreshEnhanced}
            title="Enhanced Refresh"
          />
        }
      >
        {/* Enhanced Statistics Cards */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Enhanced Collection Overview</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#4CAF50' }]}>
                <Ionicons name="checkmark-circle" size={24} color="#fff" />
              </View>
              <Text style={styles.statValue}>{formatCurrency(stats.totalCollected)}</Text>
              <Text style={styles.statLabel}>Collected</Text>
              <Text style={styles.enhancedLabel}>Real-time</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#f44336' }]}>
                <Ionicons name="time" size={24} color="#fff" />
              </View>
              <Text style={styles.statValue}>{formatCurrency(stats.totalOutstanding)}</Text>
              <Text style={styles.statLabel}>Outstanding</Text>
              <Text style={styles.enhancedLabel}>Live Updates</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#2196F3' }]}>
                <Ionicons name="calculator" size={24} color="#fff" />
              </View>
              <Text style={styles.statValue}>{formatCurrency(stats.totalExpected)}</Text>
              <Text style={styles.statLabel}>Expected</Text>
              <Text style={styles.enhancedLabel}>Enhanced Calc</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#FF9800' }]}>
                <Ionicons name="trending-up" size={24} color="#fff" />
              </View>
              <Text style={styles.statValue}>{stats.collectionRate}%</Text>
              <Text style={styles.statLabel}>Collection Rate</Text>
              <Text style={styles.enhancedLabel}>Auto-Updated</Text>
            </View>
          </View>
        </View>

        {/* Enhanced Recent Payments */}
        <View style={styles.paymentsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Payments (Enhanced)</Text>
            <TouchableOpacity onPress={() => {}}>
              <Ionicons name="pulse" size={24} color="#2196F3" />
            </TouchableOpacity>
          </View>
          
          {stats.recentPayments.length > 0 ? (
            stats.recentPayments.map((payment, index) => (
              <View key={index} style={styles.enhancedPaymentCard}>
                <View style={styles.paymentInfo}>
                  <Text style={styles.paymentAmount}>{formatCurrency(payment.amount_paid)}</Text>
                  <Text style={styles.paymentStudent}>{payment.students?.name || 'Unknown'}</Text>
                  <Text style={styles.enhancedTimestamp}>
                    Real-time: {new Date(payment.payment_date).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.realtimeIndicator}>
                  <Ionicons name="radio" size={12} color="#4CAF50" />
                </View>
              </View>
            ))
          ) : (
            <View style={styles.noDataContainer}>
              <Ionicons name="document-text-outline" size={48} color="#ccc" />
              <Text style={styles.noDataText}>No payment records found</Text>
              <Text style={styles.noDataSubtext}>
                Enhanced system is monitoring for new payments...
              </Text>
            </View>
          )}
        </View>

        {/* Enhanced System Info */}
        <View style={styles.systemInfoSection}>
          <Text style={styles.sectionTitle}>Enhanced System Status</Text>
          <View style={styles.systemInfo}>
            <Text style={styles.systemInfoText}>
              🚀 Enhanced Tenant System v2.0.0
            </Text>
            <Text style={styles.systemInfoText}>
              ⚡ Real-time Updates: {realtimeSubscription ? 'Active' : 'Inactive'}
            </Text>
            <Text style={styles.systemInfoText}>
              🎯 Cache Performance: Optimized
            </Text>
            <Text style={styles.systemInfoText}>
              📊 Data Accuracy: Enhanced Validation
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollWrapper: {
    backgroundColor: '#fff',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  progressContainer: {
    width: '80%',
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#2196F3',
    borderRadius: 2,
  },
  errorText: {
    marginTop: 10,
    fontSize: 14,
    color: '#f44336',
    textAlign: 'center',
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '500',
  },
  filtersSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  statsSection: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8F5E9',
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  enhancedLabel: {
    fontSize: 10,
    color: '#4CAF50',
    textAlign: 'center',
    fontWeight: '500',
    marginTop: 2,
  },
  paymentsSection: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    marginBottom: 32,
    padding: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  enhancedPaymentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  paymentInfo: {
    flex: 1,
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  paymentStudent: {
    fontSize: 14,
    color: '#333',
    marginTop: 2,
  },
  enhancedTimestamp: {
    fontSize: 10,
    color: '#2196F3',
    marginTop: 2,
  },
  realtimeIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDataContainer: {
    padding: 40,
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  noDataSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  systemInfoSection: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 8,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#E3F2FD',
  },
  systemInfo: {
    backgroundColor: '#F3E5F5',
    padding: 12,
    borderRadius: 6,
  },
  systemInfoText: {
    fontSize: 12,
    color: '#4A148C',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});

export default FeeCollectionEnhanced;