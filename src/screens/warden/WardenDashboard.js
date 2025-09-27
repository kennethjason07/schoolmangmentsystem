import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Platform
} from 'react-native';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import HostelService from '../../services/HostelService';
import { useAuth } from '../../utils/AuthContext';

const WardenDashboard = ({ navigation }) => {
  const { user, tenantId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState({
    hostels: [],
    occupancyStats: [],
    applicationStats: null,
    recentApplications: []
  });

  // Set tenant ID for HostelService
  useEffect(() => {
    if (tenantId) {
      HostelService.setTenantId(tenantId);
    }
  }, [tenantId]);

  const loadDashboardData = async () => {
    try {
      const [hostelsResult, occupancyResult, applicationStatsResult, applicationsResult] = await Promise.all([
        HostelService.getHostels(),
        HostelService.getOccupancyReport(),
        HostelService.getApplicationStats(),
        HostelService.getApplications({ status: 'submitted' })
      ]);

      if (hostelsResult.success) {
        setDashboardData(prev => ({ ...prev, hostels: hostelsResult.data }));
      }

      if (occupancyResult.success) {
        setDashboardData(prev => ({ ...prev, occupancyStats: occupancyResult.data }));
      }

      if (applicationStatsResult.success) {
        setDashboardData(prev => ({ ...prev, applicationStats: applicationStatsResult.data }));
      }

      if (applicationsResult.success) {
        setDashboardData(prev => ({ ...prev, recentApplications: applicationsResult.data.slice(0, 5) }));
      }

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      Alert.alert('Error', 'Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [])
  );

  const getOccupancyColor = (percentage) => {
    if (percentage >= 90) return '#FF5252';
    if (percentage >= 75) return '#FF9800';
    if (percentage >= 50) return '#4CAF50';
    return '#2196F3';
  };

  const StatCard = ({ title, value, subtitle, color, icon, onPress }) => (
    <TouchableOpacity style={[styles.statCard, { borderLeftColor: color }]} onPress={onPress}>
      <View style={styles.statContent}>
        <View style={styles.statTextContainer}>
          <Text style={styles.statTitle}>{title}</Text>
          <Text style={[styles.statValue, { color }]}>{value}</Text>
          {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
        </View>
        <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
          <MaterialIcons name={icon} size={24} color={color} />
        </View>
      </View>
    </TouchableOpacity>
  );

  const QuickAction = ({ title, icon, color, onPress, iconFamily = 'MaterialIcons' }) => (
    <TouchableOpacity style={styles.quickAction} onPress={onPress}>
      <View style={[styles.quickActionIcon, { backgroundColor: color + '20' }]}>
        {iconFamily === 'FontAwesome5' ? (
          <FontAwesome5 name={icon} size={20} color={color} />
        ) : (
          <MaterialIcons name={icon} size={24} color={color} />
        )}
      </View>
      <Text style={styles.quickActionText}>{title}</Text>
    </TouchableOpacity>
  );

  const HostelCard = ({ hostel }) => {
    const occupancyData = dashboardData.occupancyStats.find(stat => stat.hostel_id === hostel.id);
    const occupancyPercentage = occupancyData ? occupancyData.occupancy_percentage : 0;
    
    return (
      <TouchableOpacity 
        style={styles.hostelCard}
        onPress={() => navigation.navigate('HostelDetails', { hostelId: hostel.id, hostelName: hostel.name })}
      >
        <View style={styles.hostelHeader}>
          <Text style={styles.hostelName}>{hostel.name}</Text>
          <View style={[styles.occupancyBadge, { backgroundColor: getOccupancyColor(occupancyPercentage) }]}>
            <Text style={styles.occupancyText}>{occupancyPercentage}%</Text>
          </View>
        </View>
        <View style={styles.hostelStats}>
          <View style={styles.hostelStat}>
            <Text style={styles.hostelStatValue}>{occupancyData?.total_beds || 0}</Text>
            <Text style={styles.hostelStatLabel}>Total Beds</Text>
          </View>
          <View style={styles.hostelStat}>
            <Text style={styles.hostelStatValue}>{occupancyData?.occupied_beds || 0}</Text>
            <Text style={styles.hostelStatLabel}>Occupied</Text>
          </View>
          <View style={styles.hostelStat}>
            <Text style={styles.hostelStatValue}>{occupancyData?.available_beds || 0}</Text>
            <Text style={styles.hostelStatLabel}>Available</Text>
          </View>
        </View>
        {hostel.warden && (
          <Text style={styles.wardenInfo}>Warden: {hostel.warden.full_name}</Text>
        )}
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <MaterialIcons name="hotel" size={48} color="#666" />
        <Text style={styles.loadingText}>Loading Dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Welcome, {user?.full_name}</Text>
        <Text style={styles.roleText}>Hostel Warden</Text>
      </View>

      {/* Statistics Cards */}
      <View style={styles.statsGrid}>
        <StatCard
          title="Total Applications"
          value={dashboardData.applicationStats?.total || 0}
          subtitle="This academic year"
          color="#2196F3"
          icon="assignment"
          onPress={() => navigation.navigate('HostelApplications')}
        />
        <StatCard
          title="Pending Reviews"
          value={dashboardData.applicationStats?.submitted || 0}
          subtitle="Awaiting verification"
          color="#FF9800"
          icon="pending"
          onPress={() => navigation.navigate('HostelApplications', { status: 'submitted' })}
        />
        <StatCard
          title="Acceptance Rate"
          value={`${dashboardData.applicationStats?.acceptance_rate || 0}%`}
          subtitle="Current academic year"
          color="#4CAF50"
          icon="check-circle"
        />
        <StatCard
          title="Waitlisted"
          value={dashboardData.applicationStats?.waitlisted || 0}
          subtitle="Students waiting"
          color="#9C27B0"
          icon="queue"
          onPress={() => navigation.navigate('Waitlist')}
        />
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          <QuickAction
            title="Applications"
            icon="assignment"
            color="#2196F3"
            onPress={() => navigation.navigate('HostelApplications')}
          />
          <QuickAction
            title="Allocations"
            icon="bed"
            color="#4CAF50"
            iconFamily="FontAwesome5"
            onPress={() => navigation.navigate('BedAllocations')}
          />
          <QuickAction
            title="Maintenance"
            icon="build"
            color="#FF9800"
            onPress={() => navigation.navigate('Maintenance')}
          />
          <QuickAction
            title="Reports"
            icon="analytics"
            color="#9C27B0"
            onPress={() => navigation.navigate('HostelReports')}
          />
        </View>
      </View>

      {/* Hostels Overview */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Hostels Overview</Text>
          <TouchableOpacity onPress={() => navigation.navigate('ManageHostels')}>
            <Text style={styles.seeAll}>Manage</Text>
          </TouchableOpacity>
        </View>
        {dashboardData.hostels.map((hostel) => (
          <HostelCard key={hostel.id} hostel={hostel} />
        ))}
      </View>

      {/* Recent Applications */}
      {dashboardData.recentApplications.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Applications</Text>
            <TouchableOpacity onPress={() => navigation.navigate('HostelApplications')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          {dashboardData.recentApplications.map((application) => (
            <TouchableOpacity 
              key={application.id}
              style={styles.applicationCard}
              onPress={() => navigation.navigate('ApplicationDetails', { applicationId: application.id })}
            >
              <View style={styles.applicationContent}>
                <Text style={styles.studentName}>{application.student.name}</Text>
                <Text style={styles.applicationDetails}>
                  {application.hostel.name} • {application.preferred_room_type}
                </Text>
                <Text style={styles.applicationDate}>
                  Applied: {new Date(application.applied_at).toLocaleDateString()}
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(application.status) + '20' }]}>
                <Text style={[styles.statusText, { color: getStatusColor(application.status) }]}>
                  {application.status.charAt(0).toUpperCase() + application.status.slice(1)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const getStatusColor = (status) => {
  switch (status) {
    case 'submitted': return '#FF9800';
    case 'verified': return '#2196F3';
    case 'accepted': return '#4CAF50';
    case 'rejected': return '#F44336';
    case 'waitlisted': return '#9C27B0';
    default: return '#666';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  roleText: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flex: 1,
    minWidth: '45%',
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statTextContainer: {
    flex: 1,
  },
  statTitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statSubtitle: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  seeAll: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  quickAction: {
    alignItems: 'center',
    flex: 1,
  },
  quickActionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
  },
  hostelCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  hostelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  hostelName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  occupancyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  occupancyText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  hostelStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  hostelStat: {
    alignItems: 'center',
  },
  hostelStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  hostelStatLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  wardenInfo: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  applicationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  applicationContent: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  applicationDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  applicationDate: {
    fontSize: 12,
    color: '#999',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginLeft: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default WardenDashboard;