import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import HostelStatCard from '../../components/HostelStatCard';
import HostelService from '../../services/HostelService';
import { useAuth } from '../../utils/AuthContext';
import { getCurrentUserTenantByEmail } from '../../utils/getTenantByEmail';

const HostelsOverview = ({ navigation, route }) => {
  const { user } = useAuth();
  const hostels = (route?.params?.hostels || route?.params?.data || []).map(h => ({
    ...h,
    type: (h.type || h.hostel_type || 'mixed')?.toString().toLowerCase(),
  }));
  const hideSummary = route?.params?.hideSummary === true;

  const initialFilterRaw = (route?.params?.typeFilter || 'all').toString().toLowerCase();
  const initialFilter = ['all','boys','girls','mixed'].includes(initialFilterRaw) ? initialFilterRaw : 'all';
  const [typeFilter, setTypeFilter] = useState(initialFilter); // 'all' | 'boys' | 'girls' | 'mixed'
  
  // Modal states
  const [addHostelModalVisible, setAddHostelModalVisible] = useState(false);
  const [newHostelData, setNewHostelData] = useState({
    name: '',
    description: '',
    type: 'mixed',
    capacity: '',
    contact_phone: ''
  });


  const filteredHostels = useMemo(() => (
    typeFilter === 'all' ? hostels : hostels.filter(h => (h.type || 'mixed') === typeFilter)
  ), [typeFilter, hostels]);

  const totals = filteredHostels.reduce(
    (acc, h) => {
      const capacity = Number(h.capacity || 0);
      const occupied = Number(h.occupied || 0);
      acc.totalHostels += 1;
      acc.totalCapacity += capacity;
      acc.totalOccupied += occupied;
      return acc;
    },
    { totalHostels: 0, totalCapacity: 0, totalOccupied: 0 }
  );
  const totalAvailable = Math.max(0, totals.totalCapacity - totals.totalOccupied);
  const utilization = totals.totalCapacity > 0 ? Math.round((totals.totalOccupied / totals.totalCapacity) * 100) : 0;

  // Add Hostel function
  const addHostel = async () => {
    try {
      if (!newHostelData.name.trim() || !newHostelData.capacity) {
        Alert.alert('Error', 'Please fill in all required fields');
        return;
      }

      // Get tenant ID
      const tenantResult = await getCurrentUserTenantByEmail();
      if (!tenantResult.success) {
        Alert.alert('Error', 'Failed to resolve tenant');
        return;
      }
      const tenantId = tenantResult.data.tenant.id;
      HostelService.setTenantId(tenantId);

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

      Alert.alert('Success', 'Hostel added successfully!', [
        {
          text: 'OK',
          onPress: () => {
            setAddHostelModalVisible(false);
            setNewHostelData({ name: '', description: '', type: 'mixed', capacity: '', contact_phone: '' });
            // Refresh the page by navigating back and forth
            navigation.replace('HostelsOverview', route.params);
          }
        }
      ]);
    } catch (error) {
      console.error('Error adding hostel:', error);
      Alert.alert('Error', 'Failed to add hostel. Please try again.');
    }
  };


  return (
    <View style={styles.container}>
      <Header
        title="Hostels Overview"
        onBackPress={() => navigation.goBack()}
        showBack={true}
      />

      {/* Fixed Header Content */}
      <View style={styles.fixedHeader}>
        {/* Header with Add Hostel button */}
        <View style={styles.headerSection}>
          <View style={styles.titleContainer}>
            <Ionicons name="business" size={28} color="#2196F3" />
            <Text style={styles.mainTitle}>All Hostels</Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setAddHostelModalVisible(true)}
          >
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={styles.addBtnText}>Add Hostel</Text>
          </TouchableOpacity>
        </View>

        {/* Filter chips */}
        <View style={styles.filterRow}>
          {['all','boys','girls','mixed'].map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.filterChip, typeFilter === t && styles.filterChipActive]}
              onPress={() => setTypeFilter(t)}
            >
              <Text style={[styles.filterChipText, typeFilter === t && styles.filterChipTextActive]}>
                {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Top summary stat cards */}
        {!hideSummary && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsContainer}>
            <View style={styles.statsRow}>
              <HostelStatCard
                title="Total Hostels"
                value={String(totals.totalHostels)}
                icon="business"
                color="#2196F3"
                subtitle="Active hostels"
                animated={true}
                size="small"
                onPress={() => {
                  navigation.navigate('HostelDetailList', {
                    type: 'hostels',
                    title: 'All Hostels',
                    data: hostels,
                    icon: 'business',
                    color: '#2196F3',
                    description: 'View and manage all hostels',
                  });
                }}
              />

              <HostelStatCard
                title="Total Capacity"
                value={String(totals.totalCapacity)}
                icon="people"
                color="#4CAF50"
                subtitle="Beds across all hostels"
                animated={true}
                size="small"
              />

              <HostelStatCard
                title="Occupied"
                value={String(totals.totalOccupied)}
                icon="bed"
                color="#FF9800"
                subtitle={`${utilization}% utilization`
                }
                animated={true}
                maxValue={totals.totalCapacity || 0}
                size="small"
              />

              <HostelStatCard
                title="Available"
                value={String(totalAvailable)}
                icon="home"
                color="#9C27B0"
                subtitle="Beds available"
                animated={true}
                maxValue={totals.totalCapacity || 0}
                size="small"
              />
            </View>
          </ScrollView>
        )}

        {/* Section Title and Table Header */}
        <Text style={styles.sectionTitle}>Hostels List ({filteredHostels.length})</Text>
        
        {/* Improved List Header */}
        <View style={styles.tableHeader}>
          <View style={[styles.headerColumn, { flex: 2.8 }]}>
            <Text style={styles.headerText}>Hostel Name</Text>
          </View>
          <View style={[styles.headerColumn, { flex: 1.3 }]}>
            <Text style={styles.headerText}>Type</Text>
          </View>
          <View style={[styles.headerColumn, { flex: 1.6 }]}>
            <Text style={styles.headerText}>Capacity</Text>
          </View>
          <View style={[styles.headerColumn, { flex: 1.6 }]}>
            <Text style={styles.headerText}>Occupied</Text>
          </View>
          <View style={[styles.headerColumn, { flex: 1.7 }]}>
            <Text style={styles.headerText}>Available</Text>
          </View>
        </View>
      </View>
        
      {/* FlatList without ScrollView */}
      <FlatList
        data={filteredHostels}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={true}
        style={styles.listContainer}
        renderItem={({ item, index }) => {
          const capacity = Number(item.capacity || 0);
          const occupied = Number(item.occupied || 0);
          const available = Math.max(0, capacity - occupied);
          const utilization = capacity > 0 ? Math.round((occupied / capacity) * 100) : 0;
          
          return (
            <TouchableOpacity
              style={[styles.tableRow, index % 2 === 0 ? styles.evenRow : styles.oddRow]}
              onPress={() => navigation.navigate('HostelRoomManagement', { hostel: item })}
              activeOpacity={0.7}
            >
              <View style={[styles.dataColumn, { flex: 2.8 }]}>
                <View style={styles.nameColumn}>
                  <Ionicons name="business" size={14} color="#2196F3" />
                  <Text style={styles.hostelNameText} numberOfLines={2}>{item.name}</Text>
                </View>
              </View>
              
              <View style={[styles.dataColumn, { flex: 1.3 }]}>
                <View style={styles.typeChip}>
                  <Text style={styles.typeText}>
                    {(item.type || 'mixed').charAt(0).toUpperCase() + (item.type || 'mixed').slice(1)}
                  </Text>
                </View>
              </View>
              
              <View style={[styles.dataColumn, { flex: 1.6 }]}>
                <Text style={styles.numberText}>{capacity}</Text>
              </View>
              
              <View style={[styles.dataColumn, { flex: 1.6 }]}>
                <Text style={[styles.numberText, { color: '#FF9800' }]}>{occupied}</Text>
              </View>
              
              <View style={[styles.dataColumn, { flex: 1.7 }]}>
                <Text style={[styles.numberText, { color: '#4CAF50' }]}>{available}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="business" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No hostels found</Text>
          </View>
        }
      />

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
                style={[styles.modalButton, { backgroundColor: '#4CAF50' }]}
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
  fixedHeader: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 12,
  },
  grid: {
    gap: 12,
    marginBottom: 20,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  topActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2c3e50',
    marginTop: 16,
    marginBottom: 12,
  },
  // Stats container
  statsContainer: {
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 4,
  },
  // Table styles
  listContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1976D2',
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  headerColumn: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  headerText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
    minHeight: 54,
  },
  evenRow: {
    backgroundColor: '#fff',
  },
  oddRow: {
    backgroundColor: '#f9f9f9',
  },
  dataColumn: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  nameColumn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
    paddingHorizontal: 4,
  },
  hostelNameText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  typeChip: {
    backgroundColor: '#1976D2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  numberText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  typePickerContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  typePicker: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
  typePickerSelected: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  typePickerText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  typePickerTextSelected: {
    color: '#fff',
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default HostelsOverview;
