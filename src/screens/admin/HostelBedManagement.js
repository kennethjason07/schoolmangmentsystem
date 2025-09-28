import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';

const HostelBedManagement = ({ navigation, route }) => {
  const { hostel, room, allocationContext } = route.params;
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [beds, setBeds] = useState([]);
  const [students, setStudents] = useState([]);
  
  // Modal states
  const [addBedModalVisible, setAddBedModalVisible] = useState(false);
  const [assignStudentModalVisible, setAssignStudentModalVisible] = useState(false);
  const [studentSearchModalVisible, setStudentSearchModalVisible] = useState(false);
  const [selectedBed, setSelectedBed] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form data
  const [bedData, setBedData] = useState({
    bed_number: '',
    description: '',
    monthly_rent: room.rent_per_bed?.toString() || ''
  });

  useEffect(() => {
    loadBeds();
    loadStudents();
  }, []);

  // Show allocation message if in allocation mode
  useEffect(() => {
    if (allocationContext) {
      Alert.alert(
        'Bed Allocation',
        `Select an available bed in ${room.room_number} for ${allocationContext.student.first_name} ${allocationContext.student.last_name}`
      );
    }
  }, []);

  const loadBeds = () => {
    setLoading(true);
    // Mock data - replace with actual API call
    setTimeout(() => {
      const mockBeds = [
        {
          id: '1',
          bed_number: 'Bed 1',
          description: 'Window side bed',
          monthly_rent: room.rent_per_bed || 1500,
          status: 'occupied',
          student: {
            id: 'st1',
            name: 'Rahul Sharma',
            admission_no: 'ST001',
            class: '10',
            section: 'A',
            contact: '9876543210',
            allocation_date: '2024-01-15'
          }
        },
        {
          id: '2',
          bed_number: 'Bed 2',
          description: 'Near study table',
          monthly_rent: room.rent_per_bed || 1500,
          status: 'occupied',
          student: {
            id: 'st2',
            name: 'Priya Patel',
            admission_no: 'ST002',
            class: '11',
            section: 'B',
            contact: '9876543211',
            allocation_date: '2024-01-20'
          }
        },
        {
          id: '3',
          bed_number: 'Bed 3',
          description: 'Corner bed',
          monthly_rent: room.rent_per_bed || 1500,
          status: 'available',
          student: null
        },
        {
          id: '4',
          bed_number: 'Bed 4',
          description: 'Near entrance',
          monthly_rent: room.rent_per_bed || 1500,
          status: 'maintenance',
          student: null
        }
      ];
      setBeds(mockBeds);
      setLoading(false);
    }, 1000);
  };

  const loadStudents = () => {
    // Mock student data for assignment
    const mockStudents = [
      {
        id: 'st3',
        name: 'Amit Kumar',
        admission_no: 'ST003',
        class: '12',
        section: 'A',
        contact: '9876543212',
        hostel_status: 'not_allocated'
      },
      {
        id: 'st4',
        name: 'Sneha Singh',
        admission_no: 'ST004',
        class: '10',
        section: 'C',
        contact: '9876543213',
        hostel_status: 'not_allocated'
      },
      {
        id: 'st5',
        name: 'Vikash Yadav',
        admission_no: 'ST005',
        class: '11',
        section: 'A',
        contact: '9876543214',
        hostel_status: 'not_allocated'
      }
    ];
    setStudents(mockStudents);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBeds();
    setRefreshing(false);
  };

  const resetBedForm = () => {
    setBedData({
      bed_number: '',
      description: '',
      monthly_rent: room.rent_per_bed?.toString() || ''
    });
  };

  const addBed = () => {
    if (!bedData.bed_number.trim()) {
      Alert.alert('Error', 'Please enter bed number');
      return;
    }

    const newBed = {
      id: Date.now().toString(),
      bed_number: bedData.bed_number.trim(),
      description: bedData.description.trim(),
      monthly_rent: parseInt(bedData.monthly_rent) || room.rent_per_bed || 1500,
      status: 'available',
      student: null
    };

    setBeds(prev => [...prev, newBed]);
    setAddBedModalVisible(false);
    resetBedForm();
    Alert.alert('Success', 'Bed added successfully');
  };

  const assignStudent = (student) => {
    if (!selectedBed) return;

    const updatedBed = {
      ...selectedBed,
      status: 'occupied',
      student: {
        ...student,
        allocation_date: new Date().toISOString().split('T')[0]
      }
    };

    setBeds(prev => prev.map(bed => bed.id === selectedBed.id ? updatedBed : bed));
    setAssignStudentModalVisible(false);
    setStudentSearchModalVisible(false);
    setSelectedBed(null);
    Alert.alert('Success', `${student.name} has been assigned to ${selectedBed.bed_number}`);
  };

  const unassignStudent = (bed) => {
    Alert.alert(
      'Unassign Student',
      `Are you sure you want to unassign ${bed.student.name} from ${bed.bed_number}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unassign',
          style: 'destructive',
          onPress: () => {
            const updatedBed = {
              ...bed,
              status: 'available',
              student: null
            };
            setBeds(prev => prev.map(b => b.id === bed.id ? updatedBed : b));
            Alert.alert('Success', 'Student unassigned successfully');
          }
        }
      ]
    );
  };

  const deleteBed = (bed) => {
    if (bed.status === 'occupied') {
      Alert.alert('Error', 'Cannot delete bed with assigned student');
      return;
    }

    Alert.alert(
      'Delete Bed',
      `Are you sure you want to delete ${bed.bed_number}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setBeds(prev => prev.filter(b => b.id !== bed.id));
            Alert.alert('Success', 'Bed deleted successfully');
          }
        }
      ]
    );
  };

  const toggleBedStatus = (bed) => {
    const newStatus = bed.status === 'maintenance' ? 'available' : 'maintenance';
    const updatedBed = {
      ...bed,
      status: newStatus
    };
    setBeds(prev => prev.map(b => b.id === bed.id ? updatedBed : b));
    Alert.alert('Success', `Bed status updated to ${newStatus}`);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'occupied': return '#4CAF50';
      case 'available': return '#2196F3';
      case 'maintenance': return '#FF9800';
      default: return '#666';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'occupied': return 'person';
      case 'available': return 'bed';
      case 'maintenance': return 'build';
      default: return 'help';
    }
  };

  const filteredStudents = students.filter(student => 
    student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.admission_no.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderBedCard = (bed) => (
    <TouchableOpacity 
      key={bed.id} 
      style={styles.bedCard}
      onPress={() => {
        if (allocationContext && bed.status === 'available') {
          // Assign the student directly to this bed
          const updatedBed = {
            ...bed,
            status: 'occupied',
            student: {
              ...allocationContext.student,
              allocation_date: new Date().toISOString().split('T')[0]
            }
          };
          
          setBeds(prev => prev.map(b => b.id === bed.id ? updatedBed : b));
          
          Alert.alert(
            'Allocation Successful',
            `${allocationContext.student.first_name} ${allocationContext.student.last_name} has been allocated to ${bed.bed_number}`,
            [
              {
                text: 'OK',
                onPress: () => {
                  // Navigate back to hostel management
                  navigation.navigate('HostelManagement');
                }
              }
            ]
          );
        } else if (allocationContext && bed.status !== 'available') {
          Alert.alert(
            'Cannot Allocate',
            'This bed is not available for allocation. Please select another bed.'
          );
        }
      }}
    >
      <View style={styles.bedHeader}>
        <View style={styles.bedInfo}>
          <Text style={styles.bedNumber}>{bed.bed_number}</Text>
          <Text style={styles.bedDescription}>{bed.description}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(bed.status) }]}>
          <Ionicons name={getStatusIcon(bed.status)} size={16} color="#fff" />
          <Text style={styles.statusText}>{bed.status}</Text>
        </View>
      </View>

      <View style={styles.bedDetails}>
        <View style={styles.bedMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="cash" size={16} color="#4CAF50" />
            <Text style={styles.metaText}>₹{bed.monthly_rent}/month</Text>
          </View>
        </View>

        {bed.student && (
          <View style={styles.studentInfo}>
            <View style={styles.studentHeader}>
              <Ionicons name="person" size={18} color="#2196F3" />
              <Text style={styles.studentName}>{bed.student.name}</Text>
            </View>
            <Text style={styles.studentDetails}>
              {bed.student.admission_no} • Class {bed.student.class}-{bed.student.section}
            </Text>
            <Text style={styles.studentDetails}>
              Contact: {bed.student.contact}
            </Text>
            <Text style={styles.allocationDate}>
              Allocated: {new Date(bed.student.allocation_date).toLocaleDateString()}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.bedActions}>
        {bed.status === 'available' && !allocationContext && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#4CAF50' }]}
            onPress={(e) => {
              e.stopPropagation();
              setSelectedBed(bed);
              setStudentSearchModalVisible(true);
            }}
          >
            <Ionicons name="person-add" size={16} color="#fff" />
            <Text style={styles.actionButtonText}>Assign</Text>
          </TouchableOpacity>
        )}
        
        {bed.status === 'occupied' && !allocationContext && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#F44336' }]}
            onPress={(e) => {
              e.stopPropagation();
              unassignStudent(bed);
            }}
          >
            <Ionicons name="person-remove" size={16} color="#fff" />
            <Text style={styles.actionButtonText}>Unassign</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: bed.status === 'maintenance' ? '#2196F3' : '#FF9800' }]}
          onPress={(e) => {
            e.stopPropagation();
            toggleBedStatus(bed);
          }}
        >
          <Ionicons name={bed.status === 'maintenance' ? 'checkmark' : 'build'} size={16} color="#fff" />
          <Text style={styles.actionButtonText}>
            {bed.status === 'maintenance' ? 'Fix' : 'Maintenance'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#666' }]}
          onPress={(e) => {
            e.stopPropagation();
            deleteBed(bed);
          }}
        >
          <Ionicons name="trash" size={16} color="#fff" />
          <Text style={styles.actionButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderStudentItem = ({ item }) => (
    <TouchableOpacity
      style={styles.studentItem}
      onPress={() => assignStudent(item)}
    >
      <View style={styles.studentItemInfo}>
        <Text style={styles.studentItemName}>{item.name}</Text>
        <Text style={styles.studentItemDetails}>
          {item.admission_no} • Class {item.class}-{item.section}
        </Text>
        <Text style={styles.studentItemContact}>Contact: {item.contact}</Text>
      </View>
      <Ionicons name="person-add" size={20} color="#2196F3" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Header
        title={`${room.room_number} - Beds`}
        onBackPress={() => navigation.goBack()}
        showBack={true}
      />

      <View style={styles.headerSection}>
        <View style={styles.titleContainer}>
          <Ionicons name="bed" size={28} color="#2196F3" />
          <View style={styles.titleInfo}>
            <Text style={styles.mainTitle}>Bed Management</Text>
            <Text style={styles.subtitle}>{hostel.name} • {room.room_number}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setAddBedModalVisible(true)}
        >
          <Ionicons name="add" size={24} color="#fff" />
          <Text style={styles.addButtonText}>Add Bed</Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading beds...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {beds.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="bed-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No beds found</Text>
              <Text style={styles.emptySubtext}>Add beds to this room to get started</Text>
              <TouchableOpacity
                style={styles.emptyActionButton}
                onPress={() => setAddBedModalVisible(true)}
              >
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.emptyActionButtonText}>Add Bed</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.bedsList}>
              {beds.map(renderBedCard)}
            </View>
          )}
        </ScrollView>
      )}

      {/* Add Bed Modal */}
      <Modal visible={addBedModalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Bed</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Bed Number *"
              value={bedData.bed_number}
              onChangeText={(text) => setBedData(prev => ({ ...prev, bed_number: text }))}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Description"
              value={bedData.description}
              onChangeText={(text) => setBedData(prev => ({ ...prev, description: text }))}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Monthly Rent"
              value={bedData.monthly_rent}
              onChangeText={(text) => setBedData(prev => ({ ...prev, monthly_rent: text }))}
              keyboardType="numeric"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#f0f0f0' }]}
                onPress={() => {
                  setAddBedModalVisible(false);
                  resetBedForm();
                }}
              >
                <Text style={[styles.modalButtonText, { color: '#333' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#2196F3' }]}
                onPress={addBed}
              >
                <Text style={styles.modalButtonText}>Add Bed</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Student Search Modal */}
      <Modal visible={studentSearchModalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.searchHeader}>
              <Text style={styles.modalTitle}>Assign Student to {selectedBed?.bed_number}</Text>
              <TouchableOpacity
                onPress={() => setStudentSearchModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.searchInput}
              placeholder="Search students by name or admission number..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />

            <FlatList
              data={filteredStudents}
              keyExtractor={(item) => item.id}
              renderItem={renderStudentItem}
              style={styles.studentsList}
              ListEmptyComponent={() => (
                <View style={styles.emptySearch}>
                  <Ionicons name="search" size={48} color="#ccc" />
                  <Text style={styles.emptySearchText}>No students found</Text>
                </View>
              )}
            />
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
  headerSection: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  titleInfo: {
    marginLeft: 12,
    flex: 1,
  },
  mainTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  addButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  bedsList: {
    padding: 16,
  },
  bedCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  bedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  bedInfo: {
    flex: 1,
  },
  bedNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  bedDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 4,
    textTransform: 'capitalize',
  },
  bedDetails: {
    marginBottom: 16,
  },
  bedMeta: {
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
    fontWeight: '500',
  },
  studentInfo: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  studentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  studentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 6,
  },
  studentDetails: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  allocationDate: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
    fontStyle: 'italic',
  },
  bedActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
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
  emptyActionButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  emptyActionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
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
    fontSize: 18,
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
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
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
  searchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  closeButton: {
    padding: 4,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  studentsList: {
    maxHeight: 400,
  },
  studentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
  },
  studentItemInfo: {
    flex: 1,
  },
  studentItemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  studentItemDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  studentItemContact: {
    fontSize: 12,
    color: '#888',
  },
  emptySearch: {
    alignItems: 'center',
    padding: 32,
  },
  emptySearchText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
});

export default HostelBedManagement;