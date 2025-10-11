import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import HostelService from '../../services/HostelService';

const HostelDetailList = ({ navigation, route }) => {
  const { type, title, data, icon, color, description, stats, allocationContext } = route.params;

  // Popup allocation state
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assigningStudent, setAssigningStudent] = useState(null);
  const [hostelList, setHostelList] = useState([]);
  const [selectedHostel, setSelectedHostel] = useState(null);
  const [roomList, setRoomList] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [bedList, setBedList] = useState([]);
  const [selectedBed, setSelectedBed] = useState(null);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const startAllocation = async (student) => {
    setAssigningStudent(student);
    setAssignModalVisible(true);
    setSelectedHostel(null);
    setSelectedRoom(null);
    setSelectedBed(null);
    await loadHostelsForModal();
  };

  const loadHostelsForModal = async () => {
    setLoadingOptions(true);
    try {
      const res = await HostelService.getHostels();
      if (res && res.success && Array.isArray(res.data) && res.data.length) {
        setHostelList(res.data.map(h => ({ id: h.id, name: h.name })));
      } else {
        setHostelList([
          { id: '1', name: 'Main Hostel Block' },
          { id: '2', name: 'Girls Hostel' },
          { id: '3', name: 'New Block' },
        ]);
      }
    } catch (e) {
      setHostelList([
        { id: '1', name: 'Main Hostel Block' },
        { id: '2', name: 'Girls Hostel' },
        { id: '3', name: 'New Block' },
      ]);
    } finally {
      setLoadingOptions(false);
    }
  };

  const onSelectHostel = async (hostel) => {
    setSelectedHostel(hostel);
    setSelectedRoom(null);
    setSelectedBed(null);
    setRoomList([]);
    setBedList([]);
    setLoadingOptions(true);
    try {
      const res = await HostelService.getRooms(hostel.id, true);
      if (res && res.success && Array.isArray(res.data) && res.data.length) {
        setRoomList(res.data.map(r => ({ id: r.id, name: r.room_number || `Room ${r.id}` })));
      } else {
        setRoomList([
          { id: 'r1', name: 'A101' },
          { id: 'r2', name: 'A102' },
          { id: 'r3', name: 'A201' },
        ]);
      }
    } catch (e) {
      setRoomList([
        { id: 'r1', name: 'A101' },
        { id: 'r2', name: 'A102' },
        { id: 'r3', name: 'A201' },
      ]);
    } finally {
      setLoadingOptions(false);
    }
  };

  const onSelectRoom = async (room) => {
    setSelectedRoom(room);
    setSelectedBed(null);
    setBedList([]);
    setLoadingOptions(true);
    try {
      const res = await HostelService.getAvailableBeds(selectedHostel?.id || null, null);
      if (res && res.success && Array.isArray(res.data) && res.data.length) {
        const beds = res.data
          .filter(b => !room.id || b.room_id === room.id || b.room?.id === room.id)
          .map(b => ({ id: b.id, name: b.bed_label || `Bed ${b.id}` }));
        setBedList(beds.length ? beds : [
          { id: 'b1', name: 'Bed 1' },
          { id: 'b2', name: 'Bed 2' },
          { id: 'b3', name: 'Bed 3' },
        ]);
      } else {
        setBedList([
          { id: 'b1', name: 'Bed 1' },
          { id: 'b2', name: 'Bed 2' },
          { id: 'b3', name: 'Bed 3' },
        ]);
      }
    } catch (e) {
      setBedList([
        { id: 'b1', name: 'Bed 1' },
        { id: 'b2', name: 'Bed 2' },
        { id: 'b3', name: 'Bed 3' },
      ]);
    } finally {
      setLoadingOptions(false);
    }
  };

  const onConfirmAllocation = () => {
    if (!assigningStudent || !selectedHostel || !selectedRoom || !selectedBed) return;
    Alert.alert(
      'Allocation Saved',
      `${assigningStudent.first_name || assigningStudent.name || 'Student'} assigned to ${selectedHostel.name}, Room ${selectedRoom.name}, ${selectedBed.name} (Demo)`
    );
    setAssignModalVisible(false);
    setAssigningStudent(null);
    setSelectedHostel(null);
    setSelectedRoom(null);
    setSelectedBed(null);
  };

  const renderHostelItem = (hostel) => (
    <TouchableOpacity 
      key={hostel.id} 
      style={styles.card}
      onPress={() => {
        if (allocationContext) {
          // If we're in allocation mode, navigate to room selection
          navigation.navigate('HostelRoomManagement', {
            hostel: hostel,
            allocationContext: allocationContext
          });
        } else {
          // Normal navigation
          navigation.navigate('HostelDetailView', { hostel });
        }
      }}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
          <Ionicons name="business" size={24} color={color} />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{hostel.name}</Text>
          <Text style={styles.cardDescription}>{hostel.description}</Text>
          <View style={styles.statsRow}>
            <Text style={styles.statText}>Capacity: {hostel.capacity}</Text>
            <Text style={styles.statText}>Occupied: {hostel.occupied}</Text>
            <Text style={styles.statText}>Available: {hostel.capacity - hostel.occupied}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: hostel.status === 'active' ? '#4CAF50' : '#FF9800' }]}>
          <Text style={styles.statusText}>{hostel.status}</Text>
        </View>
      </View>
      {hostel.contact_phone && (
        <View style={styles.contactRow}>
          <Ionicons name="call" size={16} color="#666" />
          <Text style={styles.contactText}>{hostel.contact_phone}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderApplicationItem = (application) => (
    <TouchableOpacity 
      key={application.id} 
      style={styles.card}
      onPress={() => {
        // Navigate to hostel management with student allocation context
        navigation.navigate('HostelManagement', {
          allocationContext: {
            student: application.students,
            applicationId: application.id,
            allocationMode: true
          }
        });
      }}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
          <Ionicons name="person" size={24} color={color} />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>
            {application.students?.first_name} {application.students?.last_name}
          </Text>
          <Text style={styles.cardDescription}>
            Class: {application.students?.class}-{application.students?.section}
          </Text>
          <Text style={styles.cardDescription}>
            Admission No: {application.students?.admission_no}
          </Text>
          <Text style={styles.dateText}>
            Applied: {new Date(application.application_date).toLocaleDateString()}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(application.status) }]}>
          <Text style={styles.statusText}>{application.status}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderAllocationItem = (allocation) => (
    <View key={allocation.id} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
          <Ionicons name="bed" size={24} color={color} />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>
            {allocation.students?.first_name} {allocation.students?.last_name}
          </Text>
          <Text style={styles.cardDescription}>
            Class: {allocation.students?.class}-{allocation.students?.section}
          </Text>
          <Text style={styles.cardDescription}>
            {allocation.hostels?.name} - Room {allocation.hostel_rooms?.room_number}
          </Text>
          <Text style={styles.cardDescription}>
            {allocation.hostel_beds?.bed_number} - ₹{allocation.monthly_rent}/month
          </Text>
          <Text style={styles.dateText}>
            Allocated: {new Date(allocation.allocation_date).toLocaleDateString()}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderCapacityItem = (hostel) => (
    <View key={hostel.id} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
          <Ionicons name="people" size={24} color={color} />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{hostel.name}</Text>
          <Text style={styles.cardDescription}>Capacity Analysis</Text>
          <View style={styles.capacityStats}>
            <View style={styles.capacityStat}>
              <Text style={styles.capacityLabel}>Total Capacity</Text>
              <Text style={styles.capacityValue}>{hostel.capacity}</Text>
            </View>
            <View style={styles.capacityStat}>
              <Text style={styles.capacityLabel}>Occupied</Text>
              <Text style={[styles.capacityValue, { color: '#FF9800' }]}>{hostel.occupied}</Text>
            </View>
            <View style={styles.capacityStat}>
              <Text style={styles.capacityLabel}>Available</Text>
              <Text style={[styles.capacityValue, { color: '#4CAF50' }]}>{hostel.availableSpace}</Text>
            </View>
          </View>
          <View style={styles.utilizationContainer}>
            <Text style={styles.utilizationLabel}>Utilization Rate</Text>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    width: `${hostel.utilizationRate}%`, 
                    backgroundColor: parseFloat(hostel.utilizationRate) > 85 ? '#F44336' : 
                                   parseFloat(hostel.utilizationRate) > 70 ? '#FF9800' : '#4CAF50'
                  }
                ]} 
              />
            </View>
            <Text style={styles.utilizationText}>{hostel.utilizationRate}%</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderOccupiedItem = (allocation) => (
    <View key={allocation.id} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
          <Ionicons name="bed" size={24} color={color} />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{allocation.studentInfo}</Text>
          <Text style={styles.cardDescription}>
            Class: {allocation.students?.class}-{allocation.students?.section}
          </Text>
          <Text style={styles.cardDescription}>
            Location: {allocation.locationInfo}
          </Text>
          <Text style={styles.cardDescription}>
            Bed: {allocation.bedInfo}
          </Text>
          <Text style={styles.cardDescription}>
            Monthly Rent: ₹{allocation.monthly_rent}
          </Text>
          <Text style={styles.dateText}>
            Occupied Since: {new Date(allocation.occupancyDate).toLocaleDateString()}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: '#FF9800' }]}>
          <Text style={styles.statusText}>Occupied</Text>
        </View>
      </View>
    </View>
  );

  const renderAvailableItem = (hostel) => (
    <View key={hostel.id} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
          <Ionicons name="home" size={24} color={color} />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{hostel.name}</Text>
          <Text style={styles.cardDescription}>Available Space Analysis</Text>
          <View style={styles.availabilityStats}>
            <View style={styles.availabilityStat}>
              <Text style={styles.availabilityLabel}>Available Beds</Text>
              <Text style={[styles.availabilityValue, { color: '#4CAF50' }]}>{hostel.availableBeds}</Text>
            </View>
            <View style={styles.availabilityStat}>
              <Text style={styles.availabilityLabel}>Total Capacity</Text>
              <Text style={styles.availabilityValue}>{hostel.capacity}</Text>
            </View>
            <View style={styles.availabilityStat}>
              <Text style={styles.availabilityLabel}>Availability Rate</Text>
              <Text style={[styles.availabilityValue, { color: '#9C27B0' }]}>{hostel.availabilityRate}%</Text>
            </View>
          </View>
          <View style={styles.statusContainer}>
            <Text style={styles.statusLabel}>Status: </Text>
            <Text style={[
              styles.statusValue,
              { color: hostel.availableBeds > 10 ? '#4CAF50' : 
                       hostel.availableBeds > 5 ? '#FF9800' : '#F44336' }
            ]}>
              {hostel.availableBeds > 10 ? 'High Availability' : 
               hostel.availableBeds > 5 ? 'Medium Availability' : 'Limited Availability'}
            </Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: '#4CAF50' }]}>
          <Text style={styles.statusText}>Available</Text>
        </View>
      </View>
    </View>
  );

  const renderMaintenanceItem = (issue) => (
    <View key={issue.id} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
          <Ionicons name="construct" size={24} color={color} />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{issue.issue_type}</Text>
          <Text style={styles.cardDescription}>{issue.description}</Text>
          <Text style={styles.cardDescription}>
            Hostel: {issue.hostels?.name}
          </Text>
          <Text style={styles.cardDescription}>
            Cost: ₹{issue.estimated_cost}
          </Text>
          <Text style={styles.dateText}>
            Reported: {new Date(issue.reported_date).toLocaleDateString()}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getPriorityColor(issue.priority) }]}>
          <Text style={styles.statusText}>{issue.priority}</Text>
        </View>
      </View>
    </View>
  );

  const renderClassItem = (cls) => (
    <TouchableOpacity key={cls.id} style={styles.card}
      onPress={() => navigation.navigate('HostelDetailList', {
        type: 'students',
        title: `Students - ${cls.name}`,
        data: Array.isArray(cls.studentsList) ? cls.studentsList : [],
        icon: 'people',
        color: '#FF9800',
        description: `${cls.total} students in ${cls.name}`,
      })}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
          <Ionicons name="school" size={24} color={color} />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{cls.name}</Text>
          <Text style={styles.cardDescription}>{cls.total} students</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderStudentItem = (student) => (
    <View key={student.id} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
          <Ionicons name="person" size={24} color={color} />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{student.first_name} {student.last_name}</Text>
          <Text style={styles.cardDescription}>Admission: {student.admission_no}</Text>
          <Text style={styles.cardDescription}>Class {student.class}-{student.section}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: student.hostel_status === 'allocated' ? '#4CAF50' : '#2196F3' }]}>
          <Text style={styles.statusText}>{student.hostel_status === 'allocated' ? 'Allocated' : 'Available'}</Text>
        </View>
      </View>
      {student.hostel_status !== 'allocated' && (
        <View style={{ marginTop: 12 }}>
          <TouchableOpacity
            style={styles.assignCTA}
            onPress={() => startAllocation(student)}
            activeOpacity={0.9}
          >
            <View style={styles.assignCTAContent}>
              <View style={styles.assignIconChip}>
                <Ionicons name="bed" size={18} color="#fff" />
              </View>
              <Text style={styles.assignCTAText}>Assign to Hostel</Text>
              <Ionicons name="chevron-forward" size={18} color="#fff" style={{ marginLeft: 6 }} />
            </View>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderItem = (item) => {
    switch (type) {
      case 'hostels':
        return renderHostelItem(item);
      case 'capacity':
        return renderCapacityItem(item);
      case 'occupied':
        return renderOccupiedItem(item);
      case 'available':
        return renderAvailableItem(item);
      case 'applications':
        return renderApplicationItem(item);
      case 'allocations':
        return renderAllocationItem(item);
      case 'maintenance':
        return renderMaintenanceItem(item);
      case 'classes':
        return renderClassItem(item);
      case 'students':
        return renderStudentItem(item);
      default:
        return null;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#FF9800';
      case 'approved': return '#4CAF50';
      case 'rejected': return '#F44336';
      case 'waitlisted': return '#2196F3';
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

  return (
    <View style={styles.container}>
      <Header 
        title={title}
        onBackPress={() => navigation.goBack()}
        showBack={true}
      />
      
      <View style={styles.headerSection}>
        <View style={styles.headerTopRow}>
          <View style={styles.titleContainer}>
            <Ionicons name={icon} size={28} color={color} />
            <Text style={styles.mainTitle}>{title}</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>{description || `${data.length} items found`}</Text>
        
        {/* Stats Summary */}
        {stats && (
          <View style={styles.statsContainer}>
            {type === 'capacity' && (
              <View style={styles.statsSummary}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Total Capacity</Text>
                  <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>{stats.totalCapacity}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Occupied</Text>
                  <Text style={[styles.summaryValue, { color: '#FF9800' }]}>{stats.totalOccupied}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Available</Text>
                  <Text style={[styles.summaryValue, { color: '#9C27B0' }]}>{stats.totalAvailable}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Utilization</Text>
                  <Text style={[styles.summaryValue, { color }]}>{stats.utilizationRate}%</Text>
                </View>
              </View>
            )}
            
            {type === 'occupied' && (
              <View style={styles.statsSummary}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Occupied Beds</Text>
                  <Text style={[styles.summaryValue, { color }]}>{stats.totalOccupied}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Occupancy Rate</Text>
                  <Text style={[styles.summaryValue, { color }]}>{stats.occupancyRate}%</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Monthly Revenue</Text>
                  <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>₹{stats.totalRevenue}</Text>
                </View>
              </View>
            )}
            
            {type === 'available' && (
              <View style={styles.statsSummary}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Available Beds</Text>
                  <Text style={[styles.summaryValue, { color }]}>{stats.totalAvailable}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Availability Rate</Text>
                  <Text style={[styles.summaryValue, { color }]}>{stats.availabilityRate}%</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Hostels Available</Text>
                  <Text style={[styles.summaryValue, { color }]}>{stats.hostelsWithAvailability}</Text>
                </View>
              </View>
            )}
            
            {type === 'hostels' && (
              <View style={styles.statsSummary}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Total Hostels</Text>
                  <Text style={[styles.summaryValue, { color }]}>{stats.total}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Active Hostels</Text>
                  <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>{stats.active}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Total Capacity</Text>
                  <Text style={[styles.summaryValue, { color }]}>{stats.totalCapacity}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Total Occupied</Text>
                  <Text style={[styles.summaryValue, { color: '#FF9800' }]}>{stats.totalOccupied}</Text>
                </View>
              </View>
            )}
          </View>
        )}
      </View>

      <ScrollView style={styles.scrollView}>
        {data.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name={icon} size={64} color="#ccc" />
            <Text style={styles.emptyText}>No items found</Text>
            <Text style={styles.emptySubtext}>There are no {title.toLowerCase()} to display</Text>
          </View>
        ) : (
          data.map(renderItem)
        )}
      </ScrollView>

      {/* Single Popup Assign Flow */}
      {assignModalVisible && (
        <Modal visible transparent animationType="slide">
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Assign to Hostel</Text>

              {/* Hostel selection */}
              <Text style={styles.modalSectionTitle}>1) Select Hostel</Text>
              <ScrollView style={{ maxHeight: 150 }}>
                {hostelList.map(h => (
                  <TouchableOpacity
                    key={h.id}
                    style={[styles.optionRow, selectedHostel?.id === h.id && styles.optionRowSelected]}
                    onPress={() => onSelectHostel(h)}
                  >
                    <Ionicons name="business" size={18} color={selectedHostel?.id === h.id ? '#fff' : '#2196F3'} />
                    <Text style={[styles.optionText, selectedHostel?.id === h.id && styles.optionTextSelected]}>{h.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Room selection */}
              {selectedHostel && (
                <>
                  <Text style={[styles.modalSectionTitle, { marginTop: 12 }]}>2) Select Room</Text>
                  <ScrollView style={{ maxHeight: 150 }}>
                    {roomList.map(r => (
                      <TouchableOpacity
                        key={r.id}
                        style={[styles.optionRow, selectedRoom?.id === r.id && styles.optionRowSelected]}
                        onPress={() => onSelectRoom(r)}
                      >
                        <Ionicons name="home" size={18} color={selectedRoom?.id === r.id ? '#fff' : '#FF9800'} />
                        <Text style={[styles.optionText, selectedRoom?.id === r.id && styles.optionTextSelected]}>{r.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              {/* Bed selection */}
              {selectedRoom && (
                <>
                  <Text style={[styles.modalSectionTitle, { marginTop: 12 }]}>3) Select Bed</Text>
                  <ScrollView style={{ maxHeight: 150 }}>
                    {bedList.map(b => (
                      <TouchableOpacity
                        key={b.id}
                        style={[styles.optionRow, selectedBed?.id === b.id && styles.optionRowSelected]}
                        onPress={() => setSelectedBed(b)}
                      >
                        <Ionicons name="bed" size={18} color={selectedBed?.id === b.id ? '#fff' : '#4CAF50'} />
                        <Text style={[styles.optionText, selectedBed?.id === b.id && styles.optionTextSelected]}>{b.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              {/* Actions */}
              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.modalButton, { backgroundColor: '#f0f0f0' }]} onPress={() => setAssignModalVisible(false)}>
                  <Text style={[styles.modalButtonText, { color: '#333' }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: selectedBed ? '#4CAF50' : '#c8e6c9' }]}
                  disabled={!selectedBed}
                  onPress={onConfirmAllocation}
                >
                  <Text style={styles.modalButtonText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
    padding: 16,
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
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
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
  },
  card: {
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  dateText: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  statText: {
    fontSize: 12,
    color: '#555',
    fontWeight: '600',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  contactText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    padding: 48,
    marginTop: 64,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  // Modal styles for assign flow
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '95%',
    maxWidth: 420,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#e0e0e0',
  },
  optionRowSelected: {
    backgroundColor: '#2196F3',
    borderLeftColor: '#1976D2',
  },
  optionText: {
    marginLeft: 10,
    color: '#333',
    fontWeight: '600',
  },
  optionTextSelected: {
    color: '#fff',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // New styles for enhanced views
  statsContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  statsSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
    minWidth: '22%',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  // Capacity-specific styles
  capacityStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 12,
  },
  capacityStat: {
    alignItems: 'center',
    flex: 1,
  },
  capacityLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  capacityValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  utilizationContainer: {
    marginTop: 12,
  },
  utilizationLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  utilizationText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '600',
    textAlign: 'right',
  },
  // Availability-specific styles
  availabilityStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 12,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  availabilityStat: {
    alignItems: 'center',
    flex: 1,
  },
  availabilityLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
    textAlign: 'center',
  },
  availabilityValue: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  statusLabel: {
    fontSize: 12,
    color: '#666',
  },
  statusValue: {
    fontSize: 12,
    fontWeight: 'bold',
  },

  // CTA styles for improved Assign button
  assignCTA: {
    backgroundColor: '#4CAF50',
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  assignCTAContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assignIconChip: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  assignCTAText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

export default HostelDetailList;