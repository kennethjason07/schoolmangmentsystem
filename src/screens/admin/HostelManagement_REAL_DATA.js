import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import Header from '../../components/Header';
import HostelStatCard from '../../components/HostelStatCard';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../utils/AuthContext';
import { getCurrentUserTenantByEmail } from '../../utils/getTenantByEmail';
import HostelService from '../../services/HostelService';

const { width } = Dimensions.get('window');

const HostelManagement = ({ navigation }) => {
  const route = useRoute();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalHostels: 0,
    totalCapacity: 0,
    totalOccupied: 0,
    availableBeds: 0,
    pendingApplications: 0,
    approvedApplications: 0,
    waitlistedApplications: 0,
    maintenanceIssues: 0
  });

  // Data states
  const [hostels, setHostels] = useState([]);
  const [applications, setApplications] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [maintenanceIssues, setMaintenanceIssues] = useState([]);
  
  // Allocation prompt control
  const [allocationPromptShown, setAllocationPromptShown] = useState(false);
  const [pendingAllocationContext, setPendingAllocationContext] = useState(null);
  
  // Modal states
  const [addHostelModalVisible, setAddHostelModalVisible] = useState(false);
  const [newHostelData, setNewHostelData] = useState({
    name: '',
    description: '',
    type: 'mixed',
    capacity: '',
    contact_phone: ''
  });

  // UI/Filter states
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'boys' | 'girls' | 'mixed'
  const [topSearch, setTopSearch] = useState('');

  useEffect(() => {
    // Load real data from database
    loadDashboardData();

    // If asked to directly open Add Hostel modal from another screen (initial mount)
    if (route.params?.openAddHostel) {
      setAddHostelModalVisible(true);
    }
    
    // Capture allocation context, but defer prompt until hostels are loaded
    if (route.params?.allocationContext) {
      setPendingAllocationContext(route.params.allocationContext);
      setAllocationPromptShown(false);
    }
  }, []);

  // When we have a pending allocation and hostels are loaded, prompt user to select hostel
  useEffect(() => {
    if (pendingAllocationContext && !allocationPromptShown && hostels && hostels.length > 0) {
      const { student } = pendingAllocationContext;
      Alert.alert(
        'Student Allocation',
        `Allocate ${student.first_name} ${student.last_name} to a hostel room.`,
        [
          {
            text: 'Select Hostel',
            onPress: () => {
              navigation.navigate('HostelDetailList', {
                type: 'hostels',
                title: 'Select Hostel for Allocation',
                data: hostels, // latest hostels state
                icon: 'business',
                color: '#2196F3',
                description: `Select a hostel for ${student.first_name} ${student.last_name}`,
                allocationContext: pendingAllocationContext,
              });
            }
          },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
      setAllocationPromptShown(true);
    }
  }, [pendingAllocationContext, allocationPromptShown, hostels]);

  // Also respond if another screen updates params to open the modal while mounted
  useEffect(() => {
    if (route.params?.openAddHostel) {
      setAddHostelModalVisible(true);
    }
  }, [route.params?.openAddHostel]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Get tenant
      const tenantResult = await getCurrentUserTenantByEmail();
      if (!tenantResult.success) {
        throw new Error(`Failed to resolve tenant: ${tenantResult.error || 'unknown'}`);
      }
      const tenantId = tenantResult.data.tenant.id;

      // Configure service
      HostelService.setTenantId(tenantId);

      // Load hostels from database
      const hostelsRes = await HostelService.getHostels();
      
      // Load applications from database
      const appsRes = await HostelService.getApplications({});
      
      // Load bed allocations
      const { data: allocationsData = [], error: allocationsError } = await supabase
        .from('bed_allocations')
        .select(`
          id, created_at, monthly_rent, status, academic_year,
          student:students(id, name),
          bed:beds(
            id, bed_label,
            room:rooms(id, room_number, hostel:hostels(id, name))
          )
        `)
        .eq('tenant_id', tenantId)
        .in('status', ['pending_acceptance', 'active', 'checked_in']);

      // Load maintenance logs
      const maintRes = await HostelService.getMaintenanceLogs(null);

      // Process hostels data
      const liveHostels = (hostelsRes.success ? (hostelsRes.data || []) : []).map(h => ({
        id: h.id,
        name: h.name,
        description: h.description,
        capacity: Number(h.capacity || 0),
        occupied: 0, // will compute from beds
        status: h.is_active ? 'active' : 'inactive',
        contact_phone: h.contact_phone || null,
        type: (h.hostel_type || h.type || 'mixed')?.toString().toLowerCase(),
      }));

      // Calculate occupancy from beds table
      const { data: allBeds = [] } = await supabase
        .from('beds')
        .select('id, status, room_id')
        .eq('tenant_id', tenantId);

      // Get room-to-hostel mapping
      const roomIds = [...new Set(allBeds.map(b => b.room_id).filter(Boolean))];
      let roomsMap = new Map();
      if (roomIds.length) {
        const { data: rooms = [] } = await supabase
          .from('rooms')
          .select('id, hostel_id')
          .in('id', roomIds);
        roomsMap = new Map(rooms.map(r => [r.id, r]));
      }

      // Count occupied beds per hostel
      const occByHostelId = new Map();
      for (const bed of allBeds) {
        const room = roomsMap.get(bed.room_id);
        const hostelId = room?.hostel_id;
        if (!hostelId) continue;
        if (!occByHostelId.has(hostelId)) {
          occByHostelId.set(hostelId, { total: 0, occupied: 0 });
        }
        const counts = occByHostelId.get(hostelId);
        counts.total++;
        if (bed.status === 'occupied') {
          counts.occupied++;
        }
        occByHostelId.set(hostelId, counts);
      }

      // Update hostels with occupancy data
      const hostelsWithOccupancy = liveHostels.map(h => {
        const counts = occByHostelId.get(h.id) || { total: 0, occupied: 0 };
        return {
          ...h,
          occupied: counts.occupied,
          // Update capacity from actual bed count if different
          capacity: Math.max(h.capacity, counts.total)
        };
      });

      // Process applications data
      const liveApplications = appsRes.success ? (appsRes.data || []) : [];

      // Process allocations data
      const liveAllocations = allocationsData.map(a => ({
        id: a.id,
        allocation_date: a.created_at,
        monthly_rent: a.monthly_rent || 0,
        status: a.status,
        academic_year: a.academic_year,
        students: { 
          name: a.student?.name || 'Student',
          id: a.student?.id 
        },
        hostels: { 
          name: a.bed?.room?.hostel?.name || 'Unknown Hostel' 
        },
        hostel_rooms: { 
          room_number: a.bed?.room?.room_number || 'N/A' 
        },
        hostel_beds: { 
          bed_number: a.bed?.bed_label || 'N/A' 
        }
      }));

      // Process maintenance data
      const liveMaintenance = maintRes.success ? (maintRes.data || []) : [];

      // Calculate statistics
      const totalHostels = hostelsWithOccupancy.length;
      const totalCapacity = hostelsWithOccupancy.reduce((sum, h) => sum + (h.capacity || 0), 0);
      const totalOccupied = hostelsWithOccupancy.reduce((sum, h) => sum + (h.occupied || 0), 0);
      const availableBeds = Math.max(totalCapacity - totalOccupied, 0);

      const statsComputed = {
        totalHostels,
        totalCapacity,
        totalOccupied,
        availableBeds,
        pendingApplications: liveApplications.filter(a => a.status === 'submitted').length,
        approvedApplications: liveApplications.filter(a => a.status === 'accepted').length,
        waitlistedApplications: liveApplications.filter(a => a.status === 'waitlisted').length,
        maintenanceIssues: liveMaintenance.length,
      };

      // Update state with real data
      setHostels(hostelsWithOccupancy);
      setApplications(liveApplications);
      setAllocations(liveAllocations);
      setMaintenanceIssues(liveMaintenance);
      setStats(statsComputed);
      setLoading(false);

    } catch (err) {
      console.error('[HostelManagement] Failed to load data:', err);
      Alert.alert(
        'Loading Error',
        `Failed to load hostel data: ${err.message}\n\nPlease check:\n1. Database connection\n2. Hostel tables are set up\n3. User permissions`,
        [
          { text: 'Retry', onPress: () => loadDashboardData() },
          { text: 'OK', style: 'cancel' }
        ]
      );
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const addHostel = async () => {
    try {
      if (!newHostelData.name.trim() || !newHostelData.capacity) {
        Alert.alert('Error', 'Please fill in all required fields');
        return;
      }

      const payload = {
        name: newHostelData.name.trim(),
        description: newHostelData.description?.trim() || null,
        hostel_type: newHostelData.type || 'mixed',
        capacity: parseInt(newHostelData.capacity, 10) || 0,
        is_active: true,
        contact_phone: newHostelData.contact_phone?.trim() || null,
      };

      const res = await HostelService.createHostel(payload);

      if (!res.success) {
        const msg = res.error || 'Failed to add hostel';
        
        if (msg.includes('42P01') || msg.includes('relation') || msg.includes('does not exist')) {
          Alert.alert(
            'Database Setup Required',
            'The hostel tables are not set up in your database. Please:\n\n1. Go to Supabase Dashboard\n2. Open SQL Editor\n3. Execute the hostel schema SQL\n\nContact support if you need help.',
            [
              { text: 'OK', style: 'default' },
              { 
                text: 'Help', 
                onPress: () => {
                  Alert.alert(
                    'Setup Instructions',
                    'You need to run the FINAL_HOSTEL_SCHEMA_FIXED.sql script in your Supabase SQL Editor.',
                    [{ text: 'Got it', style: 'default' }]
                  );
                }
              }
            ]
          );
        } else {
          Alert.alert('Error', `Failed to add hostel: ${msg}`);
        }
        return;
      }

      // Success - refresh data
      Alert.alert('Success', 'Hostel added successfully', [
        {
          text: 'OK',
          onPress: () => {
            setAddHostelModalVisible(false);
            setNewHostelData({ name: '', description: '', type: 'mixed', capacity: '', contact_phone: '' });
            // Refresh data to show new hostel
            onRefresh();
          }
        }
      ]);

    } catch (error) {
      console.error('Error adding hostel:', error);
      Alert.alert('Error', 'Failed to add hostel. Please try again.');
    }
  };

  const updateApplicationStatus = async (applicationId, newStatus) => {
    try {
      // Update application status in database
      const { error } = await supabase
        .from('hostel_applications')
        .update({ 
          status: newStatus,
          decision_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', applicationId);

      if (error) {
        throw error;
      }

      // Refresh data to show updated status
      Alert.alert('Success', `Application ${newStatus} successfully`, [
        {
          text: 'OK',
          onPress: () => onRefresh()
        }
      ]);

    } catch (error) {
      console.error('Error updating application:', error);
      Alert.alert('Error', 'Failed to update application. Please try again.');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#FF9800';
      case 'approved': return '#4CAF50';
      case 'rejected': return '#F44336';
      case 'waitlisted': return '#2196F3';
      case 'allocated': return '#9C27B0';
      case 'active': return '#4CAF50';
      case 'submitted': return '#FF9800';
      case 'accepted': return '#4CAF50';
      default: return '#757575';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return '#F44336';
      case 'high': return '#FF9800';
      case 'medium': return '#2196F3';
      case 'low': return '#4CAF50';
      default: return '#757575';
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading hostel data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header 
        title="Hostel Management" 
        onBackPress={() => navigation.goBack()}
        showBack={true}
      />

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header Section */}
        <View style={styles.headerSection}>
          <View style={styles.titleContainer}>
            <Ionicons name="bed" size={28} color="#2196F3" />
            <Text style={styles.mainTitle}>Hostel Management</Text>
          </View>
          <Text style={styles.subtitle}>Manage hostels, applications, and bed allocations</Text>
        </View>

        {/* Stats Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Overview</Text>
          <View style={styles.statsGrid}>
            <View style={styles.twoCol}>
              <HostelStatCard
                title="Hostels"
                value={stats.totalHostels.toString()}
                icon="business"
                color="#2196F3"
                subtitle="Active hostels"
                animated={true}
                size="small"
                fluid
                columns={1}
                onPress={() => navigation.navigate('HostelDetailList', {
                  type: 'hostels',
                  title: 'All Hostels Overview',
                  data: hostels,
                  icon: 'business',
                  color: '#2196F3',
                  description: 'Complete list of all hostel facilities',
                  showAddButton: true,
                  onAddPress: () => setAddHostelModalVisible(true),
                })}
              />
            </View>

            <View style={styles.twoCol}>
              <HostelStatCard
                title="Capacity"
                value={stats.totalCapacity.toString()}
                icon="home"
                color="#4CAF50"
                subtitle="Total beds"
                animated={true}
                size="small"
                fluid
                columns={1}
              />
            </View>

            <View style={styles.twoCol}>
              <HostelStatCard
                title="Occupied"
                value={stats.totalOccupied.toString()}
                icon="people"
                color="#FF9800"
                subtitle="Students housed"
                animated={true}
                size="small"
                fluid
                columns={1}
              />
            </View>

            <View style={styles.twoCol}>
              <HostelStatCard
                title="Available"
                value={stats.availableBeds.toString()}
                icon="bed"
                color="#9C27B0"
                subtitle="Free beds"
                animated={true}
                size="small"
                fluid
                columns={1}
              />
            </View>
          </View>
        </View>

        {/* Applications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📝 Applications</Text>
          <View style={styles.statsGrid}>
            <View style={styles.threeCol}>
              <HostelStatCard
                title="Pending"
                value={stats.pendingApplications.toString()}
                icon="clock"
                color="#FF9800"
                subtitle="Awaiting review"
                animated={true}
                size="small"
                fluid
                columns={1}
                onPress={() => navigation.navigate('HostelDetailList', {
                  type: 'applications',
                  title: 'Pending Applications',
                  data: applications.filter(app => app.status === 'submitted'),
                  icon: 'clock',
                  color: '#FF9800',
                  description: 'Applications awaiting review',
                })}
              />
            </View>

            <View style={styles.threeCol}>
              <HostelStatCard
                title="Approved"
                value={stats.approvedApplications.toString()}
                icon="checkmark-circle"
                color="#4CAF50"
                subtitle="Ready for allocation"
                animated={true}
                size="small"
                fluid
                columns={1}
                onPress={() => navigation.navigate('HostelDetailList', {
                  type: 'applications',
                  title: 'Approved Applications',
                  data: applications.filter(app => app.status === 'accepted'),
                  icon: 'checkmark-circle',
                  color: '#4CAF50',
                  description: 'Applications approved for allocation',
                })}
              />
            </View>

            <View style={styles.threeCol}>
              <HostelStatCard
                title="Waitlisted"
                value={stats.waitlistedApplications.toString()}
                icon="hourglass"
                color="#2196F3"
                subtitle="In queue"
                animated={true}
                size="small"
                fluid
                columns={1}
                onPress={() => navigation.navigate('HostelDetailList', {
                  type: 'applications',
                  title: 'Waitlisted Applications',
                  data: applications.filter(app => app.status === 'waitlisted'),
                  icon: 'hourglass',
                  color: '#2196F3',
                  description: 'Applications in waiting list',
                })}
              />
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚡ Quick Actions</Text>
          <View style={styles.actionGrid}>
            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => setAddHostelModalVisible(true)}
            >
              <Ionicons name="add-circle" size={24} color="#2196F3" />
              <Text style={styles.actionText}>Add New Hostel</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => navigation.navigate('HostelDetailList', {
                type: 'allocations',
                title: 'Recent Allocations',
                data: allocations,
                icon: 'key',
                color: '#9C27B0',
                description: 'Recent bed allocations to students',
              })}
            >
              <Ionicons name="key" size={24} color="#9C27B0" />
              <Text style={styles.actionText}>View Allocations</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => navigation.navigate('HostelDetailList', {
                type: 'maintenance',
                title: 'Maintenance Issues',
                data: maintenanceIssues,
                icon: 'build',
                color: '#FF5722',
                description: 'Active maintenance requests',
              })}
            >
              <Ionicons name="build" size={24} color="#FF5722" />
              <Text style={styles.actionText}>Maintenance Issues</Text>
              {stats.maintenanceIssues > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{stats.maintenanceIssues}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionCard}
              onPress={onRefresh}
            >
              <Ionicons name="refresh" size={24} color="#4CAF50" />
              <Text style={styles.actionText}>Refresh Data</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Activity Summary */}
        {(applications.length > 0 || allocations.length > 0) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📈 Recent Activity</Text>
            
            {/* Recent Applications */}
            {applications.slice(0, 3).map((app, index) => (
              <View key={`app-${app.id}-${index}`} style={styles.activityItem}>
                <View style={styles.activityIcon}>
                  <Ionicons name="document-text" size={20} color="#FF9800" />
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle}>
                    New Application - {app.student?.name || (app.students?.first_name && app.students?.last_name ? `${app.students.first_name} ${app.students.last_name}` : 'Unknown Student')}
                  </Text>
                  <Text style={styles.activitySubtitle}>
                    Status: {app.status || 'Unknown'} • {app.applied_at || app.application_date ? new Date(app.applied_at || app.application_date).toLocaleDateString() : 'No date'}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(app.status) }]}>
                  <Text style={styles.statusText}>{(app.status || 'unknown').toString().toUpperCase()}</Text>
                </View>
              </View>
            ))}

            {/* Recent Allocations */}
            {allocations.slice(0, 3).map((alloc, index) => (
              <View key={`alloc-${alloc.id}-${index}`} style={styles.activityItem}>
                <View style={styles.activityIcon}>
                  <Ionicons name="key" size={20} color="#9C27B0" />
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle}>
                    Bed Allocated - {alloc.students?.name || 'Unknown Student'}
                  </Text>
                  <Text style={styles.activitySubtitle}>
                    {alloc.hostels?.name || 'Unknown Hostel'} • Room {alloc.hostel_rooms?.room_number || 'N/A'} • Bed {alloc.hostel_beds?.bed_number || 'N/A'}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(alloc.status) }]}>
                  <Text style={styles.statusText}>{(alloc.status || 'unknown').toString().toUpperCase()}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add Hostel Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={addHostelModalVisible}
        onRequestClose={() => setAddHostelModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Hostel</Text>
              <TouchableOpacity onPress={() => setAddHostelModalVisible(false)}>
                <Ionicons name="close" size={24} color="#757575" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.modalForm}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Hostel Name *</Text>
                <TextInput
                  style={styles.formInput}
                  value={newHostelData.name}
                  onChangeText={(value) => setNewHostelData(prev => ({ ...prev, name: value }))}
                  placeholder="Enter hostel name"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Description</Text>
                <TextInput
                  style={[styles.formInput, styles.textArea]}
                  value={newHostelData.description}
                  onChangeText={(value) => setNewHostelData(prev => ({ ...prev, description: value }))}
                  placeholder="Enter hostel description"
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Type</Text>
                <View style={styles.typeButtonGroup}>
                  {['boys', 'girls', 'mixed'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeButton,
                        newHostelData.type === type && styles.typeButtonActive
                      ]}
                      onPress={() => setNewHostelData(prev => ({ ...prev, type }))}
                    >
                      <Text style={[
                        styles.typeButtonText,
                        newHostelData.type === type && styles.typeButtonTextActive
                      ]}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Total Capacity *</Text>
                <TextInput
                  style={styles.formInput}
                  value={newHostelData.capacity}
                  onChangeText={(value) => setNewHostelData(prev => ({ ...prev, capacity: value }))}
                  placeholder="Enter total number of beds"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Contact Phone</Text>
                <TextInput
                  style={styles.formInput}
                  value={newHostelData.contact_phone}
                  onChangeText={(value) => setNewHostelData(prev => ({ ...prev, contact_phone: value }))}
                  placeholder="Enter contact phone number"
                  keyboardType="phone-pad"
                />
              </View>
              
              {/* Add some bottom padding to ensure last field is scrollable */}
              <View style={{ height: 20 }} />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setAddHostelModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.addButton}
                onPress={addHostel}
              >
                <Text style={styles.addButtonText}>Add Hostel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
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
    color: '#757575',
  },
  scrollView: {
    flex: 1,
  },
  headerSection: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 16,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginLeft: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  twoCol: {
    width: '50%',
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  threeCol: {
    width: '33.33%',
    paddingHorizontal: 4,
    marginBottom: 16,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  actionCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    margin: 8,
    alignItems: 'center',
    flex: 1,
    minWidth: '42%',
    position: 'relative',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    textAlign: 'center',
    marginTop: 8,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#f44336',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  activitySubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: width * 0.9,
    maxHeight: '85%',
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  modalForm: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  typeButtonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#757575',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#757575',
  },
  addButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default HostelManagement;