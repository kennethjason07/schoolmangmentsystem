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
    // Attempt live data load; fallback to mock data if tables missing
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
          contact_phone: '9876543210',
          type: 'boys'
        },
        {
          id: '2',
          name: 'Girls Hostel',
          description: 'Dedicated hostel for female students',
          capacity: 80,
          occupied: 61,
          status: 'active',
          contact_phone: '9876543211',
          type: 'girls'
        },
        {
          id: '3',
          name: 'New Block',
          description: 'Recently constructed hostel building',
          capacity: 40,
          occupied: 30,
          status: 'active',
          contact_phone: '9876543212',
          type: 'mixed'
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
    setLoading(true);
    try {
      // Derive tenant
      const tenantResult = await getCurrentUserTenantByEmail();
      if (!tenantResult.success) throw new Error(`Failed to resolve tenant: ${tenantResult.error || 'unknown'}`);
      const tenantId = tenantResult.data.tenant.id;

      // Configure service
      HostelService.setTenantId(tenantId);

      // Parallel load: hostels, occupancy, applications, allocations, maintenance
      const hostelsQ = HostelService.getHostels();
      const occupancyQ = HostelService.getOccupancyReport(null);
      const appsQ = HostelService.getApplications({});

      // Direct allocation query (service does not expose a list method)
      const allocationsQ = supabase
        .from('bed_allocations')
        .select(`
          id, created_at, monthly_rent, status,
          student:students(id, name, class_id),
          bed:beds(
            id, bed_label,
            room:rooms(id, room_number, hostel:hostels(id, name))
          )
        `)
        .eq('tenant_id', tenantId)
        .in('status', ['pending_acceptance','active']);

      const maintenanceQ = HostelService.getMaintenanceLogs(null);

      const [hostelsRes, occRes, appsRes, allocationsRes, maintRes] = await Promise.all([
        hostelsQ, occupancyQ, appsQ, allocationsQ, maintenanceQ
      ]);

      // If occupancy view failed, compute fallback from beds/rooms
      let occ = occRes.success ? (occRes.data || []) : [];
      if (!occRes.success) {
        try {
          const { data: allBeds = [] } = await supabase
            .from('beds')
            .select('id, status, room_id')
            .eq('tenant_id', tenantId);
          const roomIds = [...new Set(allBeds.map(b => b.room_id).filter(Boolean))];
          let roomsMap = new Map();
          if (roomIds.length) {
            const { data: rooms = [] } = await supabase
              .from('rooms')
              .select('id, hostel_id')
              .in('id', roomIds);
            roomsMap = new Map(rooms.map(r => [r.id, r]));
          }
          const occByHostelId = new Map();
          for (const b of allBeds) {
            const room = roomsMap.get(b.room_id);
            const hId = room?.hostel_id;
            if (!hId) continue;
            if (!occByHostelId.has(hId)) occByHostelId.set(hId, 0);
            if (b.status === 'occupied') occByHostelId.set(hId, occByHostelId.get(hId) + 1);
          }
          occ = Array.from(occByHostelId.entries()).map(([hostel_id, total_occupied]) => ({
            tenant_id: tenantId,
            hostel_id,
            total_occupied
          }));
        } catch (e) {
          console.warn('[HostelManagement] Occupancy fallback failed:', e?.message);
          occ = [];
        }
      }

      // Hostels
      const liveHostels = (hostelsRes.success ? (hostelsRes.data || []) : []).map(h => ({
        id: h.id,
        name: h.name,
        description: h.description,
        capacity: Number(h.capacity || 0),
        occupied: 0, // will compute from occupancy
        status: h.is_active ? 'active' : 'inactive',
        contact_phone: h.contact_phone || null,
        type: (h.hostel_type || h.type || 'mixed')?.toString().toLowerCase(),
      }));

      // Occupancy
      const occByHostel = new Map(occ.map(o => [o.hostel_id, o]));
      const withOcc = liveHostels.map(h => {
        const o = occByHostel.get(h.id);
        return {
          ...h,
          occupied: Number(o?.total_occupied || 0)
        };
      });

      // Applications
      const liveApplications = appsRes.success ? (appsRes.data || []) : [];

      // Allocations
      const allocationsData = allocationsRes.error ? [] : (allocationsRes.data || []);

      // Manual enrichment without relying on FK relationships
      const bedIds = [...new Set(allocationsData.map(a => a.bed?.id || a.bed_id).filter(Boolean))];
      let bedsMap = new Map();
      if (bedIds.length) {
        const { data: bedsRows = [] } = await supabase
          .from('beds')
          .select('id, bed_label, room_id')
          .in('id', bedIds);
        bedsMap = new Map(bedsRows.map(b => [b.id, b]));
      }
      const roomIds2 = [...new Set(Array.from(bedsMap.values()).map(b => b.room_id).filter(Boolean))];
      let roomsMap2 = new Map();
      if (roomIds2.length) {
        const { data: roomRows = [] } = await supabase
          .from('rooms')
          .select('id, room_number, hostel_id')
          .in('id', roomIds2);
        roomsMap2 = new Map(roomRows.map(r => [r.id, r]));
      }
      const hostelIds = [...new Set(Array.from(roomsMap2.values()).map(r => r.hostel_id).filter(Boolean))];
      let hostelsMap2 = new Map();
      if (hostelIds.length) {
        const { data: hostelRows = [] } = await supabase
          .from('hostels')
          .select('id, name')
          .in('id', hostelIds);
        hostelsMap2 = new Map(hostelRows.map(h => [h.id, h]));
      }

      const liveAllocations = allocationsData.map(a => {
        // Try nested value, otherwise use manual map
        const bedId = a.bed?.id || a.bed_id;
        const bed = a.bed || bedsMap.get(bedId);
        const room = (a.bed?.room) || (bed ? roomsMap2.get(bed.room_id) : null);
        const hostel = (a.bed?.room?.hostel) || (room ? hostelsMap2.get(room.hostel_id) : null);
        return {
          id: a.id,
          allocation_date: a.created_at,
          monthly_rent: a.monthly_rent || 0,
          students: { name: a.student?.name || 'Student' },
          hostels: { name: hostel?.name || 'Hostel' },
          hostel_rooms: { room_number: room?.room_number || '-' },
          hostel_beds: { bed_number: bed?.bed_label || '-' }
        };
      });

      // Maintenance
      const liveMaintenance = maintRes.success ? (maintRes.data || []) : [];

      // Stats
      const totalHostels = withOcc.length;
      const totalCapacity = withOcc.reduce((s, h) => s + (h.capacity || 0), 0);
      const totalOccupied = withOcc.reduce((s, h) => s + (h.occupied || 0), 0);
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

      setHostels(withOcc);
      setApplications(liveApplications);
      setAllocations(liveAllocations);
      setMaintenanceIssues(liveMaintenance);
      setStats(statsComputed);
      setLoading(false);
    } catch (err) {
      console.warn('[HostelManagement] Live load failed, falling back to demo:', err?.message);
      await loadMockData();
    }
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
        // If table missing or any failure, inform user rather than silently acting like success
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
                    'You need to run the hostel schema SQL script in your Supabase database. Check the project files for EXECUTE_THIS_IN_SUPABASE.sql and run it in your Supabase SQL Editor.',
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

      const saved = res.data;
      const appended = {
        id: saved.id,
        name: saved.name,
        description: saved.description,
        capacity: Number(saved.capacity || 0),
        occupied: 0,
        status: saved.is_active ? 'active' : 'inactive',
        contact_phone: saved.contact_phone || null,
      };

      setHostels(prev => [...prev, appended]);

      setStats(prev => ({
        ...prev,
        totalHostels: prev.totalHostels + 1,
        totalCapacity: prev.totalCapacity + appended.capacity,
        availableBeds: prev.availableBeds + appended.capacity,
      }));

      Alert.alert('Success', 'Hostel added successfully');
      setAddHostelModalVisible(false);
      setNewHostelData({ name: '', description: '', type: 'mixed', capacity: '', contact_phone: '' });
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
        showBack={true}
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
            <View style={styles.twoCol}><HostelStatCard
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
                stats: {
                  total: stats.totalHostels,
                  active: hostels.filter(h => h.status === 'active').length,
                  totalCapacity: stats.totalCapacity,
                  totalOccupied: stats.totalOccupied
                }
              })}
            /></View>
            <View style={styles.twoCol}><HostelStatCard
              title="Capacity"
              fluid
              value={stats.totalCapacity.toString()}
              icon="people"
              color="#4CAF50"
              subtitle="Total beds"
              animated={true}
              size="small"
              columns={1}
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
            /></View>
            <View style={styles.twoCol}><HostelStatCard
              title="Occupied"
              fluid
              value={stats.totalOccupied.toString()}
              icon="bed"
              color="#FF9800"
              subtitle="Currently occupied"
              animated={true}
              maxValue={stats.totalCapacity}
              progress={(stats.totalOccupied / stats.totalCapacity) * 100}
              size="small"
              columns={1}
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
            <View style={styles.twoCol}><HostelStatCard
              title="Available"
              fluid
              value={stats.availableBeds.toString()}
              icon="home"
              color="#9C27B0"
              subtitle="Available beds"
              animated={true}
              maxValue={stats.totalCapacity}
              progress={(stats.availableBeds / stats.totalCapacity) * 100}
              size="small"
              columns={1}
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
            /></View></View>
          </View>
        </View>


        {/* Management Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚙️ Management Tools</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: '#E8F5E8' }]}
              onPress={() => navigation.navigate('HostelsOverview', { data: hostels, typeFilter: 'all', hideSummary: true })}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: '#2196F3' }]}>
                <Ionicons name="business" size={24} color="#fff" />
              </View>
              <Text style={styles.actionText}>All Hostels</Text>
              <Text style={styles.actionSubtext}>View all hostels overview</Text>

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
onPress={() => navigation.navigate('HostelApplications', {
                status: 'all'
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
            
            <Text style={styles.inputLabel}>Hostel Type</Text>
            <View style={styles.typePickerContainer}>
              {['mixed', 'boys', 'girls'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typePicker,
                    newHostelData.type === type && styles.typePickerSelected
                  ]}
                  onPress={() => setNewHostelData(prev => ({ ...prev, type }))}
                >
                  <Text style={[
                    styles.typePickerText,
                    newHostelData.type === type && styles.typePickerTextSelected
                  ]}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
  },
  twoCol: {
    width: '100%',
    marginBottom: 12,
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
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    color: '#2c3e50',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  filterChipActive: {
    backgroundColor: '#2196F3',
  },
  filterChipText: {
    color: '#333',
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  quickActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  quickActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
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
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 8,
  },
  typePickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  typePicker: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  typePickerSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  typePickerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  typePickerTextSelected: {
    color: '#fff',
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
  // Bottom Navigation Styles
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  navText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontWeight: '500',
  },
});

export default HostelManagement;