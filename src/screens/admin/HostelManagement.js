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
import Header from '../../components/Header';
import HostelStatCard from '../../components/HostelStatCard';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../utils/AuthContext';
import { getCurrentUserTenantByEmail } from '../../utils/getTenantByEmail';

const { width } = Dimensions.get('window');

const HostelManagement = ({ navigation }) => {
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
  
  // Modal states
  const [addHostelModalVisible, setAddHostelModalVisible] = useState(false);
  const [newHostelData, setNewHostelData] = useState({
    name: '',
    description: '',
    type: 'mixed',
    capacity: '',
    contact_phone: ''
  });

  useEffect(() => {
    // Load mock data for frontend demo
    loadMockData();
  }, []);

  // Mock data for frontend demo
  const loadMockData = async () => {
    setLoading(true);
    
    // Simulate loading delay
    setTimeout(() => {
      // Set mock stats
      setStats({
        totalHostels: 3,
        totalCapacity: 240,
        totalOccupied: 186,
        availableBeds: 54,
        pendingApplications: 12,
        approvedApplications: 8,
        waitlistedApplications: 5,
        maintenanceIssues: 3
      });

      // Set mock hostels
      setHostels([
        {
          id: '1',
          name: 'Main Hostel Block',
          description: 'Primary residential facility for students',
          capacity: 120,
          occupied: 95,
          status: 'active',
          contact_phone: '9876543210'
        },
        {
          id: '2',
          name: 'Girls Hostel',
          description: 'Dedicated hostel for female students',
          capacity: 80,
          occupied: 61,
          status: 'active',
          contact_phone: '9876543211'
        },
        {
          id: '3',
          name: 'New Block',
          description: 'Recently constructed hostel building',
          capacity: 40,
          occupied: 30,
          status: 'active',
          contact_phone: '9876543212'
        }
      ]);

      // Set mock applications
      setApplications([
        {
          id: '1',
          status: 'pending',
          application_date: '2025-09-25',
          students: {
            first_name: 'Rahul',
            last_name: 'Sharma',
            class: '10',
            section: 'A',
            admission_no: 'ST001'
          }
        },
        {
          id: '2',
          status: 'approved',
          application_date: '2025-09-24',
          students: {
            first_name: 'Priya',
            last_name: 'Patel',
            class: '11',
            section: 'B',
            admission_no: 'ST002'
          }
        },
        {
          id: '3',
          status: 'pending',
          application_date: '2025-09-23',
          students: {
            first_name: 'Amit',
            last_name: 'Kumar',
            class: '12',
            section: 'A',
            admission_no: 'ST003'
          }
        },
        {
          id: '4',
          status: 'waitlisted',
          application_date: '2025-09-22',
          students: {
            first_name: 'Sneha',
            last_name: 'Singh',
            class: '10',
            section: 'C',
            admission_no: 'ST004'
          }
        },
        {
          id: '5',
          status: 'pending',
          application_date: '2025-09-21',
          students: {
            first_name: 'Vikash',
            last_name: 'Yadav',
            class: '11',
            section: 'A',
            admission_no: 'ST005'
          }
        }
      ]);

      // Set mock allocations
      setAllocations([
        {
          id: '1',
          allocation_date: '2025-09-15',
          monthly_rent: 5000,
          students: {
            first_name: 'Aarav',
            last_name: 'Gupta',
            class: '12',
            section: 'B',
            admission_no: 'ST010'
          },
          hostels: { name: 'Main Hostel Block' },
          hostel_rooms: { room_number: 'A101' },
          hostel_beds: { bed_number: 'Bed 1' }
        },
        {
          id: '2',
          allocation_date: '2025-09-14',
          monthly_rent: 4500,
          students: {
            first_name: 'Riya',
            last_name: 'Mehta',
            class: '11',
            section: 'C',
            admission_no: 'ST011'
          },
          hostels: { name: 'Girls Hostel' },
          hostel_rooms: { room_number: 'G201' },
          hostel_beds: { bed_number: 'Bed 2' }
        },
        {
          id: '3',
          allocation_date: '2025-09-13',
          monthly_rent: 5200,
          students: {
            first_name: 'Arjun',
            last_name: 'Verma',
            class: '10',
            section: 'A',
            admission_no: 'ST012'
          },
          hostels: { name: 'New Block' },
          hostel_rooms: { room_number: 'N301' },
          hostel_beds: { bed_number: 'Bed 1' }
        }
      ]);

      // Set mock maintenance issues
      setMaintenanceIssues([
        {
          id: '1',
          issue_type: 'Electrical',
          description: 'AC not working properly in room A101',
          priority: 'high',
          status: 'reported',
          reported_date: '2025-09-26',
          estimated_cost: 2500,
          hostels: { name: 'Main Hostel Block' }
        },
        {
          id: '2',
          issue_type: 'Plumbing',
          description: 'Bathroom tap needs repair',
          priority: 'medium',
          status: 'assigned',
          reported_date: '2025-09-24',
          estimated_cost: 500,
          hostels: { name: 'Girls Hostel' }
        },
        {
          id: '3',
          issue_type: 'Furniture',
          description: 'Study table broken in room N301',
          priority: 'low',
          status: 'in_progress',
          reported_date: '2025-09-23',
          estimated_cost: 800,
          hostels: { name: 'New Block' }
        }
      ]);

      setLoading(false);
    }, 1000); // 1 second delay to show loading
  };

  const loadDashboardData = async () => {
    // This will be used later when connecting to backend
    // For now, just call loadMockData
    await loadMockData();
  };

  // Database functions removed for frontend demo
  // These will be added back when connecting to backend

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

      // Add hostel to mock data
      const newHostel = {
        id: Date.now().toString(),
        name: newHostelData.name.trim(),
        description: newHostelData.description.trim(),
        capacity: parseInt(newHostelData.capacity),
        occupied: 0,
        status: 'active',
        contact_phone: newHostelData.contact_phone.trim()
      };

      setHostels(prev => [...prev, newHostel]);
      
      // Update stats
      setStats(prev => ({
        ...prev,
        totalHostels: prev.totalHostels + 1,
        totalCapacity: prev.totalCapacity + newHostel.capacity,
        availableBeds: prev.availableBeds + newHostel.capacity
      }));

      Alert.alert('Success', 'Hostel added successfully (Demo Mode)');
      setAddHostelModalVisible(false);
      setNewHostelData({
        name: '',
        description: '',
        type: 'mixed',
        capacity: '',
        contact_phone: ''
      });

    } catch (error) {
      console.error('Error adding hostel:', error);
      Alert.alert('Error', 'Failed to add hostel. Please try again.');
    }
  };

  const updateApplicationStatus = async (applicationId, newStatus) => {
    try {
      // Update application status in mock data
      setApplications(prev => 
        prev.map(app => 
          app.id === applicationId 
            ? { ...app, status: newStatus }
            : app
        )
      );

      // Update stats based on status change
      setStats(prev => {
        const newStats = { ...prev };
        
        if (newStatus === 'approved') {
          newStats.approvedApplications += 1;
          newStats.pendingApplications = Math.max(0, newStats.pendingApplications - 1);
        } else if (newStatus === 'rejected') {
          newStats.pendingApplications = Math.max(0, newStats.pendingApplications - 1);
        } else if (newStatus === 'waitlisted') {
          newStats.waitlistedApplications += 1;
          newStats.pendingApplications = Math.max(0, newStats.pendingApplications - 1);
        }
        
        return newStats;
      });

      Alert.alert('Success', `Application ${newStatus} successfully (Demo Mode)`);

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
        showBackButton={true}
      />

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Demo Banner */}
        <View style={styles.demoBanner}>
          <Ionicons name="code" size={16} color="#FF9800" />
          <Text style={styles.demoText}>Frontend Demo Mode - Sample Data</Text>
        </View>

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
            <HostelStatCard
              title="Hostels"
              value={stats.totalHostels.toString()}
              icon="business"
              color="#2196F3"
              subtitle="Active hostels"
              animated={true}
              onPress={() => navigation.navigate('HostelDetailList', {
                type: 'hostels',
                title: 'All Hostels Overview',
                data: hostels,
                icon: 'business',
                color: '#2196F3',
                description: 'Complete list of all hostel facilities',
                stats: {
                  total: stats.totalHostels,
                  active: hostels.filter(h => h.status === 'active').length,
                  totalCapacity: stats.totalCapacity,
                  totalOccupied: stats.totalOccupied
                }
              })}
            />
            <HostelStatCard
              title="Capacity"
              value={stats.totalCapacity.toString()}
              icon="people"
              color="#4CAF50"
              subtitle="Total beds"
              animated={true}
              onPress={() => navigation.navigate('HostelDetailList', {
                type: 'capacity',
                title: 'Capacity Analysis',
                data: hostels.map(hostel => ({
                  ...hostel,
                  utilizationRate: ((hostel.occupied / hostel.capacity) * 100).toFixed(1),
                  availableSpace: hostel.capacity - hostel.occupied
                })),
                icon: 'people',
                color: '#4CAF50',
                description: 'Detailed capacity utilization across all hostels',
                stats: {
                  totalCapacity: stats.totalCapacity,
                  totalOccupied: stats.totalOccupied,
                  totalAvailable: stats.availableBeds,
                  utilizationRate: ((stats.totalOccupied / stats.totalCapacity) * 100).toFixed(1)
                }
              })}
            />
            <HostelStatCard
              title="Occupied"
              value={stats.totalOccupied.toString()}
              icon="bed"
              color="#FF9800"
              subtitle="Currently occupied"
              animated={true}
              maxValue={stats.totalCapacity}
              progress={(stats.totalOccupied / stats.totalCapacity) * 100}
              onPress={() => navigation.navigate('HostelDetailList', {
                type: 'occupied',
                title: 'Occupied Beds Details',
                data: allocations.map(allocation => ({
                  ...allocation,
                  occupancyDate: allocation.allocation_date,
                  studentInfo: `${allocation.students?.first_name} ${allocation.students?.last_name}`,
                  locationInfo: `${allocation.hostels?.name} - ${allocation.hostel_rooms?.room_number}`,
                  bedInfo: allocation.hostel_beds?.bed_number
                })),
                icon: 'bed',
                color: '#FF9800',
                description: 'Currently occupied beds and resident details',
                stats: {
                  totalOccupied: stats.totalOccupied,
                  totalCapacity: stats.totalCapacity,
                  occupancyRate: ((stats.totalOccupied / stats.totalCapacity) * 100).toFixed(1),
                  totalRevenue: allocations.reduce((sum, a) => sum + (a.monthly_rent || 0), 0)
                }
              })}
            />
            <HostelStatCard
              title="Available"
              value={stats.availableBeds.toString()}
              icon="home"
              color="#9C27B0"
              subtitle="Available beds"
              animated={true}
              maxValue={stats.totalCapacity}
              progress={(stats.availableBeds / stats.totalCapacity) * 100}
              onPress={() => navigation.navigate('HostelDetailList', {
                type: 'available',
                title: 'Available Beds',
                data: hostels
                  .filter(h => h.capacity - h.occupied > 0)
                  .map(hostel => ({
                    ...hostel,
                    availableBeds: hostel.capacity - hostel.occupied,
                    availabilityRate: (((hostel.capacity - hostel.occupied) / hostel.capacity) * 100).toFixed(1)
                  })),
                icon: 'home',
                color: '#9C27B0',
                description: 'Available beds across all hostels',
                stats: {
                  totalAvailable: stats.availableBeds,
                  totalCapacity: stats.totalCapacity,
                  availabilityRate: ((stats.availableBeds / stats.totalCapacity) * 100).toFixed(1),
                  hostelsWithAvailability: hostels.filter(h => h.capacity - h.occupied > 0).length
                }
              })}
            />
          </View>
        </View>

        {/* Application Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📝 Applications</Text>
          <View style={styles.statsGrid}>
            <HostelStatCard
              title="Pending"
              value={stats.pendingApplications.toString()}
              icon="time"
              color="#FF9800"
              subtitle="Applications"
              animated={true}
              onPress={() => navigation.navigate('HostelDetailList', {
                type: 'applications',
                title: 'Pending Applications',
                data: applications.filter(a => a.status === 'pending'),
                icon: 'time',
                color: '#FF9800'
              })}
            />
            <HostelStatCard
              title="Approved"
              value={stats.approvedApplications.toString()}
              icon="checkmark-circle"
              color="#4CAF50"
              subtitle="Applications"
              animated={true}
              onPress={() => navigation.navigate('HostelDetailList', {
                type: 'applications',
                title: 'Approved Applications',
                data: applications.filter(a => a.status === 'approved'),
                icon: 'checkmark-circle',
                color: '#4CAF50'
              })}
            />
            <HostelStatCard
              title="Waitlisted"
              value={stats.waitlistedApplications.toString()}
              icon="list"
              color="#2196F3"
              subtitle="Applications"
              animated={true}
              onPress={() => navigation.navigate('HostelDetailList', {
                type: 'applications',
                title: 'Waitlisted Applications',
                data: applications.filter(a => a.status === 'waitlisted'),
                icon: 'list',
                color: '#2196F3'
              })}
            />
            <HostelStatCard
              title="Issues"
              value={stats.maintenanceIssues.toString()}
              icon="construct"
              color="#F44336"
              subtitle="Maintenance"
              animated={true}
              onPress={() => navigation.navigate('HostelDetailList', {
                type: 'maintenance',
                title: 'Maintenance Issues',
                data: maintenanceIssues,
                icon: 'construct',
                color: '#F44336'
              })}
            />
          </View>
        </View>

        {/* Management Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚙️ Management Tools</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: '#E8F5E8' }]}
              onPress={() => setAddHostelModalVisible(true)}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: '#4CAF50' }]}>
                <Ionicons name="add-circle" size={24} color="#fff" />
              </View>
              <Text style={styles.actionText}>Add Hostel</Text>
              <Text style={styles.actionSubtext}>Create new hostel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: '#FFF3E0' }]}
              onPress={() => navigation.navigate('HostelStudentManagement')}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: '#FF9800' }]}>
                <Ionicons name="people" size={24} color="#fff" />
              </View>
              <Text style={styles.actionText}>Manage Students</Text>
              <Text style={styles.actionSubtext}>Add & assign students</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: '#E3F2FD' }]}
              onPress={() => navigation.navigate('HostelDetailList', {
                type: 'applications',
                title: 'All Applications',
                data: applications,
                icon: 'document-text',
                color: '#2196F3',
                description: 'View and manage all hostel applications'
              })}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: '#2196F3' }]}>
                <Ionicons name="document-text" size={24} color="#fff" />
              </View>
              <Text style={styles.actionText}>Applications</Text>
              <Text style={styles.actionSubtext}>Review applications</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: '#FFEBEE' }]}
              onPress={() => navigation.navigate('HostelMaintenanceManagement', { hostel: hostels[0] || { name: 'All Hostels', id: 'all' } })}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: '#F44336' }]}>
                <Ionicons name="construct" size={24} color="#fff" />
              </View>
              <Text style={styles.actionText}>Maintenance</Text>
              <Text style={styles.actionSubtext}>Manage issues</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Hostels Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏢 Hostels ({hostels.length})</Text>
          {hostels.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="business-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No hostels found</Text>
              <Text style={styles.emptySubtext}>Add your first hostel to get started</Text>
            </View>
          ) : (
            hostels.slice(0, 3).map((hostel) => (
              <TouchableOpacity
                key={hostel.id}
                style={styles.hostelCard}
                onPress={() => navigation.navigate('HostelDetailView', { hostel })}
                activeOpacity={0.7}
              >
                <View style={styles.hostelHeader}>
                  <Text style={styles.hostelName}>{hostel.name}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: hostel.status === 'active' ? '#4CAF50' : '#FF9800' }]}>
                    <Text style={styles.statusText}>{hostel.status}</Text>
                  </View>
                </View>
                <Text style={styles.hostelDescription}>{hostel.description}</Text>
                <View style={styles.hostelStats}>
                  <Text style={styles.statText}>Capacity: {hostel.capacity}</Text>
                  <Text style={styles.statText}>Occupied: {hostel.occupied}</Text>
                  <Text style={styles.statText}>Available: {hostel.capacity - hostel.occupied}</Text>
                </View>
                <View style={styles.hostelCardActions}>
                  <TouchableOpacity
                    style={[styles.hostelActionButton, { backgroundColor: '#2196F3' }]}
                    onPress={() => navigation.navigate('HostelRoomManagement', { hostel })}
                  >
                    <Ionicons name="bed" size={14} color="#fff" />
                    <Text style={styles.hostelActionText}>Manage Rooms</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.hostelActionButton, { backgroundColor: '#4CAF50' }]}
                    onPress={() => navigation.navigate('HostelDetailView', { hostel })}
                  >
                    <Ionicons name="eye" size={14} color="#fff" />
                    <Text style={styles.hostelActionText}>View Details</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Recent Applications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📝 Recent Applications ({applications.length})</Text>
          {applications.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No applications found</Text>
            </View>
          ) : (
            applications.slice(0, 5).map((application) => (
              <View key={application.id} style={styles.applicationCard}>
                <View style={styles.applicationHeader}>
                  <Text style={styles.studentName}>
                    {application.students?.first_name} {application.students?.last_name}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(application.status) }]}>
                    <Text style={styles.statusText}>{application.status}</Text>
                  </View>
                </View>
                <Text style={styles.applicationInfo}>
                  Class: {application.students?.class}-{application.students?.section}
                </Text>
                <Text style={styles.applicationInfo}>
                  Admission No: {application.students?.admission_no}
                </Text>
                <Text style={styles.applicationDate}>
                  Applied: {new Date(application.application_date).toLocaleDateString()}
                </Text>
                
                {application.status === 'pending' && (
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: '#4CAF50' }]}
                      onPress={() => updateApplicationStatus(application.id, 'approved')}
                    >
                      <Text style={styles.actionButtonText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: '#F44336' }]}
                      onPress={() => updateApplicationStatus(application.id, 'rejected')}
                    >
                      <Text style={styles.actionButtonText}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: '#2196F3' }]}
                      onPress={() => updateApplicationStatus(application.id, 'waitlisted')}
                    >
                      <Text style={styles.actionButtonText}>Waitlist</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))
          )}
        </View>

        {/* Current Allocations Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🛏️ Current Allocations ({allocations.length})</Text>
          {allocations.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="bed-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No allocations found</Text>
            </View>
          ) : (
            allocations.slice(0, 5).map((allocation) => (
              <View key={allocation.id} style={styles.allocationCard}>
                <View style={styles.allocationHeader}>
                  <Text style={styles.studentName}>
                    {allocation.students?.first_name} {allocation.students?.last_name}
                  </Text>
                  <Text style={styles.allocationDate}>
                    {new Date(allocation.allocation_date).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={styles.allocationInfo}>
                  Hostel: {allocation.hostels?.name}
                </Text>
                <Text style={styles.allocationInfo}>
                  Room: {allocation.hostel_rooms?.room_number}, Bed: {allocation.hostel_beds?.bed_number}
                </Text>
                <Text style={styles.allocationInfo}>
                  Monthly Rent: ₹{allocation.monthly_rent}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Maintenance Issues Section */}
        {maintenanceIssues.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔧 Maintenance Issues ({maintenanceIssues.length})</Text>
            {maintenanceIssues.slice(0, 3).map((issue) => (
              <View key={issue.id} style={styles.maintenanceCard}>
                <View style={styles.maintenanceHeader}>
                  <Text style={styles.maintenanceTitle}>{issue.issue_type}</Text>
                  <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(issue.priority) }]}>
                    <Text style={styles.statusText}>{issue.priority}</Text>
                  </View>
                </View>
                <Text style={styles.maintenanceDescription}>{issue.description}</Text>
                <Text style={styles.maintenanceInfo}>
                  Hostel: {issue.hostels?.name}
                </Text>
                <Text style={styles.maintenanceDate}>
                  Reported: {new Date(issue.reported_date).toLocaleDateString()}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add Hostel Modal */}
      <Modal
        visible={addHostelModalVisible}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Hostel</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Hostel Name *"
              value={newHostelData.name}
              onChangeText={(text) => setNewHostelData(prev => ({ ...prev, name: text }))}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Description"
              value={newHostelData.description}
              onChangeText={(text) => setNewHostelData(prev => ({ ...prev, description: text }))}
              multiline
            />
            
            <TextInput
              style={styles.input}
              placeholder="Capacity *"
              value={newHostelData.capacity}
              onChangeText={(text) => setNewHostelData(prev => ({ ...prev, capacity: text }))}
              keyboardType="numeric"
            />
            
            <TextInput
              style={styles.input}
              placeholder="Contact Phone"
              value={newHostelData.contact_phone}
              onChangeText={(text) => setNewHostelData(prev => ({ ...prev, contact_phone: text }))}
              keyboardType="phone-pad"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#f0f0f0' }]}
                onPress={() => setAddHostelModalVisible(false)}
              >
                <Text style={[styles.modalButtonText, { color: '#333' }]}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#2196F3' }]}
                onPress={addHostel}
              >
                <Text style={styles.modalButtonText}>Add Hostel</Text>
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
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  demoBanner: {
    backgroundColor: '#FFF3E0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#FFE0B2',
  },
  demoText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#F57C00',
    fontWeight: '600',
  },
  headerSection: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },
  statsGrid: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    padding: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    alignItems: 'stretch',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    color: '#2c3e50',
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    minHeight: 120,
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  actionSubtext: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  hostelCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  hostelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  hostelName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  hostelDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  hostelStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statText: {
    fontSize: 12,
    color: '#888',
  },
  hostelCardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 8,
  },
  hostelActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  hostelActionText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
    marginLeft: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: 'bold',
  },
  applicationCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  applicationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  studentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  applicationInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  applicationDate: {
    fontSize: 12,
    color: '#888',
    marginBottom: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  allocationCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  allocationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  allocationDate: {
    fontSize: 12,
    color: '#888',
  },
  allocationInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  maintenanceCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  maintenanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  maintenanceTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  maintenanceDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  maintenanceInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  maintenanceDate: {
    fontSize: 12,
    color: '#888',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 8,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  setupContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  setupCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    maxWidth: 400,
    width: '100%',
  },
  setupTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 12,
  },
  setupMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  setupSteps: {
    fontSize: 14,
    color: '#555',
    textAlign: 'left',
    marginBottom: 24,
    lineHeight: 20,
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    width: '100%',
  },
  setupButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  setupButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default HostelManagement;