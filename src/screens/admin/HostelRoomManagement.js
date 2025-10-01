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
  Dimensions,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';

const { width } = Dimensions.get('window');

const HostelRoomManagement = ({ navigation, route }) => {
  const { hostel, allocationContext } = route.params;
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [rooms, setRooms] = useState([]);
  
  // Filter states
  const [floorFilter, setFloorFilter] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  
  // Dropdown states
  const [showFloorDropdown, setShowFloorDropdown] = useState(false);
  const [showAvailabilityDropdown, setShowAvailabilityDropdown] = useState(false);
  
  // Modal states
  const [addRoomModalVisible, setAddRoomModalVisible] = useState(false);
  const [editRoomModalVisible, setEditRoomModalVisible] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  
  // Form data
  const [roomData, setRoomData] = useState({
    room_number: '',
    floor: '',
    room_type: 'shared',
    capacity: '4',
    rent_per_bed: '',
    description: '',
    amenities: ''
  });

  const roomTypes = [
    { value: 'single', label: 'Single Occupancy' },
    { value: 'double', label: 'Double Sharing' },
    { value: 'triple', label: 'Triple Sharing' },
    { value: 'shared', label: 'Shared (4+)' },
  ];

  useEffect(() => {
    loadRooms();
  }, []);

  // Show allocation message if in allocation mode
  useEffect(() => {
    if (allocationContext) {
      Alert.alert(
        'Room Allocation',
        `Select a room in ${hostel.name} for ${allocationContext.student.first_name} ${allocationContext.student.last_name}`,
        [{ text: 'OK' }]
      );
    }
  }, []);

  const loadRooms = () => {
    setLoading(true);
    // Mock data - replace with actual API call
    setTimeout(() => {
      const mockRooms = [
        {
          id: '1',
          room_number: 'A101',
          floor: '1',
          room_type: 'shared',
          capacity: 4,
          occupied: 3,
          rent_per_bed: 1500,
          description: 'Well-ventilated room with study area',
          amenities: 'AC, WiFi, Study Table, Wardrobe',
          status: 'active'
        },
        {
          id: '2',
          room_number: 'A102',
          floor: '1',
          room_type: 'double',
          capacity: 2,
          occupied: 2,
          rent_per_bed: 2500,
          description: 'Premium double sharing room',
          amenities: 'AC, WiFi, Attached Bathroom, Study Table',
          status: 'active'
        },
        {
          id: '3',
          room_number: 'A201',
          floor: '2',
          room_type: 'single',
          capacity: 1,
          occupied: 0,
          rent_per_bed: 4000,
          description: 'Private single room',
          amenities: 'AC, WiFi, Attached Bathroom, Study Table, Wardrobe',
          status: 'maintenance'
        },
        {
          id: '4',
          room_number: 'B101',
          floor: '1',
          room_type: 'triple',
          capacity: 3,
          occupied: 1,
          rent_per_bed: 2000,
          description: 'Spacious triple sharing room',
          amenities: 'Fan, WiFi, Study Area, Common Bathroom',
          status: 'active'
        }
      ];
      setRooms(mockRooms);
      setLoading(false);
    }, 1000);
  };

  // Get unique floors for dropdown
  const getUniqueFloors = () => {
    const floors = [...new Set(rooms.map(room => room.floor))];
    return floors.sort((a, b) => parseInt(a) - parseInt(b));
  };

  // Filter rooms based on selected filters
  const getFilteredRooms = () => {
    return rooms.filter(room => {
      // Floor filter
      if (floorFilter !== 'all' && room.floor !== floorFilter) {
        return false;
      }
      
      // Availability filter
      const availableBeds = room.capacity - room.occupied;
      switch (availabilityFilter) {
        case 'full':
          return availableBeds === 0;
        case 'empty':
          return availableBeds === room.capacity;
        case 'partial':
          return availableBeds > 0 && availableBeds < room.capacity;
        default:
          return true;
      }
    });
  };

  // Get room count text for display
  const getRoomCountText = () => {
    const filteredCount = getFilteredRooms().length;
    if (floorFilter === 'all' && availabilityFilter === 'all') {
      return `${rooms.length} rooms`;
    }
    return `${filteredCount} of ${rooms.length} rooms`;
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRooms();
    setRefreshing(false);
  };

  const resetForm = () => {
    setRoomData({
      room_number: '',
      floor: '',
      room_type: 'shared',
      capacity: '4',
      rent_per_bed: '',
      description: '',
      amenities: ''
    });
  };

  const addRoom = () => {
    if (!roomData.room_number.trim() || !roomData.floor.trim() || !roomData.rent_per_bed.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const newRoom = {
      id: Date.now().toString(),
      room_number: roomData.room_number.trim(),
      floor: roomData.floor.trim(),
      room_type: roomData.room_type,
      capacity: parseInt(roomData.capacity),
      occupied: 0,
      rent_per_bed: parseInt(roomData.rent_per_bed),
      description: roomData.description.trim(),
      amenities: roomData.amenities.trim(),
      status: 'active'
    };

    setRooms(prev => [...prev, newRoom]);
    setAddRoomModalVisible(false);
    resetForm();
    Alert.alert('Success', 'Room added successfully');
  };

  const editRoom = () => {
    if (!selectedRoom || !roomData.room_number.trim() || !roomData.floor.trim() || !roomData.rent_per_bed.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const updatedRoom = {
      ...selectedRoom,
      room_number: roomData.room_number.trim(),
      floor: roomData.floor.trim(),
      room_type: roomData.room_type,
      capacity: parseInt(roomData.capacity),
      rent_per_bed: parseInt(roomData.rent_per_bed),
      description: roomData.description.trim(),
      amenities: roomData.amenities.trim(),
    };

    setRooms(prev => prev.map(room => room.id === selectedRoom.id ? updatedRoom : room));
    setEditRoomModalVisible(false);
    setSelectedRoom(null);
    resetForm();
    Alert.alert('Success', 'Room updated successfully');
  };

  const deleteRoom = (room) => {
    Alert.alert(
      'Delete Room',
      `Are you sure you want to delete room ${room.room_number}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setRooms(prev => prev.filter(r => r.id !== room.id));
            Alert.alert('Success', 'Room deleted successfully');
          }
        }
      ]
    );
  };

  const openEditModal = (room) => {
    setSelectedRoom(room);
    setRoomData({
      room_number: room.room_number,
      floor: room.floor,
      room_type: room.room_type,
      capacity: room.capacity.toString(),
      rent_per_bed: room.rent_per_bed.toString(),
      description: room.description || '',
      amenities: room.amenities || ''
    });
    setEditRoomModalVisible(true);
  };

  const getRoomTypeLabel = (type) => {
    const roomType = roomTypes.find(rt => rt.value === type);
    return roomType ? roomType.label : type;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#4CAF50';
      case 'maintenance': return '#FF9800';
      case 'inactive': return '#F44336';
      default: return '#666';
    }
  };

  const getOccupancyColor = (occupied, capacity) => {
    const rate = (occupied / capacity) * 100;
    if (rate === 100) return '#F44336';
    if (rate >= 75) return '#FF9800';
    if (rate >= 50) return '#2196F3';
    return '#4CAF50';
  };

  const renderRoomCard = (room) => (
    <TouchableOpacity 
      key={room.id} 
      style={styles.roomCard}
      onPress={() => {
        if (allocationContext && room.status === 'active' && room.occupied < room.capacity) {
          // Navigate to bed management for allocation
          navigation.navigate('HostelBedManagement', { 
            hostel, 
            room,
            allocationContext: allocationContext
          });
        } else if (allocationContext) {
          Alert.alert(
            'Cannot Allocate',
            'This room is not available for allocation. Please select another room.'
          );
        }
      }}
    >
      <View style={styles.roomHeader}>
        <View style={styles.roomTitleContainer}>
          <Text style={styles.roomNumber}>{room.room_number}</Text>
          <Text style={styles.roomFloor}>Floor {room.floor}</Text>
        </View>
        <View style={styles.roomActions}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(room.status) }]}>
            <Text style={styles.statusText}>{room.status}</Text>
          </View>
        </View>
      </View>

      <View style={styles.roomDetails}>
        <View style={styles.roomInfo}>
          <Text style={styles.roomType}>{getRoomTypeLabel(room.room_type)}</Text>
          <Text style={styles.roomDescription}>{room.description}</Text>
        </View>

        <View style={styles.occupancyContainer}>
          <View style={styles.occupancyInfo}>
            <Text style={styles.occupancyLabel}>Occupancy</Text>
            <Text style={[styles.occupancyValue, { color: getOccupancyColor(room.occupied, room.capacity) }]}>
              {room.occupied}/{room.capacity}
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  width: `${(room.occupied / room.capacity) * 100}%`,
                  backgroundColor: getOccupancyColor(room.occupied, room.capacity)
                }
              ]} 
            />
          </View>
        </View>

        <View style={styles.roomMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="cash" size={16} color="#4CAF50" />
            <Text style={styles.metaText}>₹{room.rent_per_bed}/bed</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="bed" size={16} color="#2196F3" />
            <Text style={styles.metaText}>{room.capacity - room.occupied} available</Text>
          </View>
        </View>

        {room.amenities && (
          <View style={styles.amenitiesContainer}>
            <Text style={styles.amenitiesLabel}>Amenities:</Text>
            <Text style={styles.amenitiesText}>{room.amenities}</Text>
          </View>
        )}
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#2196F3' }]}
          onPress={(e) => {
            e.stopPropagation();
            navigation.navigate('HostelBedManagement', { hostel, room });
          }}
        >
          <Ionicons name="bed" size={16} color="#fff" />
          <Text style={styles.actionButtonText}>Manage Beds</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#FF9800' }]}
          onPress={(e) => {
            e.stopPropagation();
            openEditModal(room);
          }}
        >
          <Ionicons name="create" size={16} color="#fff" />
          <Text style={styles.actionButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#F44336' }]}
          onPress={(e) => {
            e.stopPropagation();
            deleteRoom(room);
          }}
        >
          <Ionicons name="trash" size={16} color="#fff" />
          <Text style={styles.actionButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const RoomModal = ({ visible, onClose, onSubmit, title, isEdit = false }) => (
    <Modal 
      visible={visible} 
      transparent 
      animationType="slide"
      onRequestClose={() => { /* prevent accidental back-closing while typing */ }}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{title}</Text>
          
          <ScrollView style={styles.modalForm} keyboardShouldPersistTaps="always">
            <TextInput
              style={styles.input}
              placeholder="Room Number *"
              value={roomData.room_number}
              onChangeText={(text) => setRoomData(prev => ({ ...prev, room_number: text }))}
              autoCorrect={false}
              autoCapitalize="none"
              blurOnSubmit={false}
              keyboardType="default"
              returnKeyType="done"
            />
            
            <TextInput
              style={styles.input}
              placeholder="Floor *"
              value={roomData.floor}
              onChangeText={(text) => setRoomData(prev => ({ ...prev, floor: text }))}
              keyboardType="numeric"
              autoCorrect={false}
              blurOnSubmit={false}
              returnKeyType="next"
            />
            <View style={styles.pickerContainer}>
              <Text style={styles.pickerLabel}>Room Type</Text>
              <Picker
                selectedValue={roomData.room_type}
                onValueChange={(itemValue) => {
                  setRoomData(prev => ({ 
                    ...prev, 
                    room_type: itemValue,
                    capacity: itemValue === 'single' ? '1' : 
                             itemValue === 'double' ? '2' : 
                             itemValue === 'triple' ? '3' : '4'
                  }));
                }}
              >
                {roomTypes.map((type) => (
                  <Picker.Item key={type.value} label={type.label} value={type.value} />
                ))}
              </Picker>
            </View>
            
            <TextInput
              style={styles.input}
              placeholder="Capacity"
              value={roomData.capacity}
              onChangeText={(text) => setRoomData(prev => ({ ...prev, capacity: text }))}
              keyboardType="numeric"
              autoCorrect={false}
              blurOnSubmit={false}
              returnKeyType="next"
            />
            <TextInput
              style={styles.input}
              placeholder="Rent per Bed *"
              value={roomData.rent_per_bed}
              onChangeText={(text) => setRoomData(prev => ({ ...prev, rent_per_bed: text }))}
              keyboardType="numeric"
              autoCorrect={false}
              blurOnSubmit={false}
              returnKeyType="done"
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description"
              value={roomData.description}
              onChangeText={(text) => setRoomData(prev => ({ ...prev, description: text }))}
              multiline
              numberOfLines={3}
              autoCorrect={false}
              blurOnSubmit={false}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Amenities (comma separated)"
              value={roomData.amenities}
              onChangeText={(text) => setRoomData(prev => ({ ...prev, amenities: text }))}
              multiline
              numberOfLines={2}
              autoCorrect={false}
              blurOnSubmit={false}
            />

          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: '#f0f0f0' }]}
              onPress={() => {
                onClose();
                resetForm();
              }}
            >
              <Text style={[styles.modalButtonText, { color: '#333' }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: '#2196F3' }]}
              onPress={onSubmit}
            >
              <Text style={styles.modalButtonText}>{isEdit ? 'Update' : 'Add'} Room</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <Header
        title={`${hostel.name} - Rooms`}
        onBackPress={() => navigation.goBack()}
        showBack={true}
      />

      <View style={styles.headerSection}>
        <View style={styles.titleContainer}>
          <Ionicons name="business" size={28} color="#2196F3" />
          <View style={styles.titleInfo}>
            <Text style={styles.mainTitle}>Room Management</Text>
            <Text style={styles.subtitle}>{hostel.name} • {getRoomCountText()}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setAddRoomModalVisible(true)}
        >
          <Ionicons name="add" size={24} color="#fff" />
          <Text style={styles.addButtonText}>Add Room</Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading rooms...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Filter Section */}
          <View style={styles.filterSection}>
            <View style={styles.filterRow}>
              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Floor:</Text>
                <TouchableOpacity 
                  style={styles.dropdown}
                  onPress={() => setShowFloorDropdown(true)}
                >
                  <Text style={styles.dropdownText}>
                    {floorFilter === 'all' ? 'All Floors' : `Floor ${floorFilter}`}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#666" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Availability:</Text>
                <TouchableOpacity 
                  style={styles.dropdown}
                  onPress={() => setShowAvailabilityDropdown(true)}
                >
                  <Text style={styles.dropdownText}>
                    {availabilityFilter === 'all' ? 'All Rooms' : 
                     availabilityFilter === 'full' ? 'Full (0 available)' :
                     availabilityFilter === 'empty' ? 'Empty (All available)' :
                     'Partially Occupied'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#666" />
                </TouchableOpacity>
              </View>
            </View>
            
            <TouchableOpacity 
              style={styles.resetButton}
              onPress={() => {
                setFloorFilter('all');
                setAvailabilityFilter('all');
              }}
            >
              <Text style={styles.resetButtonText}>Reset Filters</Text>
            </TouchableOpacity>
          </View>
          
          {rooms.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="bed-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No rooms found</Text>
              <Text style={styles.emptySubtext}>Add your first room to get started</Text>
              <TouchableOpacity
                style={styles.emptyActionButton}
                onPress={() => setAddRoomModalVisible(true)}
              >
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.emptyActionButtonText}>Add Room</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.roomsList}>
              {getFilteredRooms().map(renderRoomCard)}
            </View>
          )}
        </ScrollView>
      )}

      {/* Floor Dropdown Modal */}
      <Modal
        visible={showFloorDropdown}
        transparent={true}
        animationType="fade"
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          onPress={() => setShowFloorDropdown(false)}
        >
          <View style={styles.dropdownModal}>
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                setFloorFilter('all');
                setShowFloorDropdown(false);
              }}
            >
              <Text style={[styles.dropdownItemText, floorFilter === 'all' && styles.dropdownItemTextSelected]}>
                All Floors
              </Text>
            </TouchableOpacity>
            {getUniqueFloors().map(floor => (
              <TouchableOpacity
                key={floor}
                style={styles.dropdownItem}
                onPress={() => {
                  setFloorFilter(floor);
                  setShowFloorDropdown(false);
                }}
              >
                <Text style={[styles.dropdownItemText, floorFilter === floor && styles.dropdownItemTextSelected]}>
                  Floor {floor}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Availability Dropdown Modal */}
      <Modal
        visible={showAvailabilityDropdown}
        transparent={true}
        animationType="fade"
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          onPress={() => setShowAvailabilityDropdown(false)}
        >
          <View style={styles.dropdownModal}>
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                setAvailabilityFilter('all');
                setShowAvailabilityDropdown(false);
              }}
            >
              <Text style={[styles.dropdownItemText, availabilityFilter === 'all' && styles.dropdownItemTextSelected]}>
                All Rooms
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                setAvailabilityFilter('full');
                setShowAvailabilityDropdown(false);
              }}
            >
              <Text style={[styles.dropdownItemText, availabilityFilter === 'full' && styles.dropdownItemTextSelected]}>
                Full (0 available)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                setAvailabilityFilter('empty');
                setShowAvailabilityDropdown(false);
              }}
            >
              <Text style={[styles.dropdownItemText, availabilityFilter === 'empty' && styles.dropdownItemTextSelected]}>
                Empty (All available)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                setAvailabilityFilter('partial');
                setShowAvailabilityDropdown(false);
              }}
            >
              <Text style={[styles.dropdownItemText, availabilityFilter === 'partial' && styles.dropdownItemTextSelected]}>
                Partially Occupied
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Add Room Modal */}
      <RoomModal
        visible={addRoomModalVisible}
        onClose={() => setAddRoomModalVisible(false)}
        onSubmit={addRoom}
        title="Add New Room"
      />

      {/* Edit Room Modal */}
      <RoomModal
        visible={editRoomModalVisible}
        onClose={() => {
          setEditRoomModalVisible(false);
          setSelectedRoom(null);
        }}
        onSubmit={editRoom}
        title="Edit Room"
        isEdit={true}
      />
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
  filterSection: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  filterGroup: {
    flex: 1,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 40,
    width: '100%',
  },
  dropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
  },
  dropdownText: {
    fontSize: 16,
    color: '#333',
  },
  resetButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownModal: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
    minWidth: 200,
    maxHeight: 300,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#333',
  },
  dropdownItemTextSelected: {
    fontWeight: 'bold',
    color: '#2196F3',
  },
  roomsList: {
    padding: 16,
  },
  roomCard: {
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
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  roomTitleContainer: {
    flex: 1,
  },
  roomNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  roomFloor: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  roomActions: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },
  roomDetails: {
    marginBottom: 16,
  },
  roomInfo: {
    marginBottom: 12,
  },
  roomType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2196F3',
    marginBottom: 4,
  },
  roomDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  occupancyContainer: {
    marginBottom: 12,
  },
  occupancyInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  occupancyLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  occupancyValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  roomMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  amenitiesContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  amenitiesLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginBottom: 4,
  },
  amenitiesText: {
    fontSize: 13,
    color: '#333',
    lineHeight: 18,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    marginHorizontal: 4,
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
    maxWidth: 500,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  modalForm: {
    maxHeight: 400,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    marginBottom: 16,
  },
  pickerLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
    marginBottom: 8,
  },
  pickerOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  pickerOptionSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  pickerOptionText: {
    fontSize: 14,
    color: '#666',
  },
  pickerOptionTextSelected: {
    color: '#fff',
    fontWeight: '600',
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
});

export default HostelRoomManagement;