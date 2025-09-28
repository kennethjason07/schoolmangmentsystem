import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';

const HostelDetailView = ({ navigation, route }) => {
  const { hostel } = route.params;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [students, setStudents] = useState([]);

  useEffect(() => {
    loadHostelDetails();
  }, []);

  const loadHostelDetails = async () => {
    setLoading(true);
    
    // Simulate loading delay
    setTimeout(() => {
      // Generate mock rooms and beds based on hostel capacity
      const mockRooms = generateMockRooms(hostel);
      const mockStudents = generateMockStudents(mockRooms);
      
      setRooms(mockRooms);
      setStudents(mockStudents);
      setLoading(false);
    }, 800);
  };

  const generateMockRooms = (hostel) => {
    const rooms = [];
    const bedsPerRoom = 2; // Assuming double occupancy rooms
    const totalRooms = Math.ceil(hostel.capacity / bedsPerRoom);
    
    let occupiedBeds = 0;
    const targetOccupied = hostel.occupied;
    
    for (let i = 1; i <= totalRooms; i++) {
      const roomNumber = `${hostel.name.charAt(0)}${String(i).padStart(3, '0')}`;
      const beds = [];
      
      for (let j = 1; j <= bedsPerRoom; j++) {
        const isOccupied = occupiedBeds < targetOccupied;
        if (isOccupied) occupiedBeds++;
        
        beds.push({
          id: `bed-${i}-${j}`,
          bedNumber: `Bed ${j}`,
          status: isOccupied ? 'occupied' : 'available',
          studentId: isOccupied ? `student-${i}-${j}` : null,
          rentAmount: Math.floor(Math.random() * 2000) + 4000, // 4000-6000 range
        });
      }
      
      rooms.push({
        id: `room-${i}`,
        roomNumber,
        floor: Math.ceil(i / 10),
        roomType: bedsPerRoom === 1 ? 'Single' : bedsPerRoom === 2 ? 'Double' : 'Triple',
        capacity: bedsPerRoom,
        occupied: beds.filter(b => b.status === 'occupied').length,
        beds,
        amenities: ['AC', 'Wi-Fi', 'Study Table', 'Wardrobe'],
        status: beds.some(b => b.status === 'occupied') ? 
                (beds.every(b => b.status === 'occupied') ? 'Full' : 'Partial') : 'Empty'
      });
    }
    
    return rooms;
  };

  const generateMockStudents = (rooms) => {
    const students = [];
    const firstNames = ['Aarav', 'Vivaan', 'Aditya', 'Arjun', 'Sai', 'Riya', 'Ananya', 'Isha', 'Kavya', 'Priya'];
    const lastNames = ['Sharma', 'Patel', 'Kumar', 'Singh', 'Gupta', 'Verma', 'Agarwal', 'Jain', 'Shah', 'Mehta'];
    const classes = ['10', '11', '12'];
    const sections = ['A', 'B', 'C'];
    
    let studentIndex = 0;
    
    rooms.forEach(room => {
      room.beds.forEach(bed => {
        if (bed.status === 'occupied' && bed.studentId) {
          students.push({
            id: bed.studentId,
            admissionNo: `ST${String(studentIndex + 1).padStart(3, '0')}`,
            firstName: firstNames[studentIndex % firstNames.length],
            lastName: lastNames[studentIndex % lastNames.length],
            class: classes[Math.floor(Math.random() * classes.length)],
            section: sections[Math.floor(Math.random() * sections.length)],
            phone: `98765${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`,
            roomId: room.id,
            bedId: bed.id,
            allocatedDate: new Date(2025, 8, Math.floor(Math.random() * 20) + 1).toISOString().split('T')[0]
          });
          studentIndex++;
        }
      });
    });
    
    return students;
  };

  const getStudentForBed = (bedId) => {
    return students.find(s => s.bedId === bedId);
  };

  const getBedStatusColor = (status) => {
    switch (status) {
      case 'occupied': return '#FF9800';
      case 'available': return '#4CAF50';
      case 'maintenance': return '#F44336';
      default: return '#757575';
    }
  };

  const getRoomStatusColor = (status) => {
    switch (status) {
      case 'Full': return '#F44336';
      case 'Partial': return '#FF9800';
      case 'Empty': return '#4CAF50';
      default: return '#757575';
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHostelDetails();
    setRefreshing(false);
  };

  const renderBed = (bed, room) => {
    const student = getStudentForBed(bed.id);
    
    return (
      <View key={bed.id} style={styles.bedCard}>
        <View style={styles.bedHeader}>
          <View style={[styles.bedIcon, { backgroundColor: `${getBedStatusColor(bed.status)}20` }]}>
            <Ionicons 
              name={bed.status === 'occupied' ? 'bed' : 'bed-outline'} 
              size={20} 
              color={getBedStatusColor(bed.status)} 
            />
          </View>
          <View style={styles.bedInfo}>
            <Text style={styles.bedNumber}>{bed.bedNumber}</Text>
            <View style={[styles.bedStatusBadge, { backgroundColor: getBedStatusColor(bed.status) }]}>
              <Text style={styles.bedStatusText}>{bed.status}</Text>
            </View>
          </View>
        </View>
        
        {student && (
          <View style={styles.studentInfo}>
            <Text style={styles.studentName}>{student.firstName} {student.lastName}</Text>
            <Text style={styles.studentDetails}>
              Class: {student.class}-{student.section} | {student.admissionNo}
            </Text>
            <Text style={styles.studentDetails}>Phone: {student.phone}</Text>
            <Text style={styles.rentInfo}>Rent: ₹{bed.rentAmount}/month</Text>
          </View>
        )}
        
        {bed.status === 'available' && (
          <View style={styles.availableInfo}>
            <Text style={styles.availableText}>Available for allocation</Text>
            <Text style={styles.rentInfo}>Rent: ₹{bed.rentAmount}/month</Text>
          </View>
        )}
      </View>
    );
  };

  const renderRoom = (room) => {
    return (
      <View key={room.id} style={styles.roomCard}>
        <View style={styles.roomHeader}>
          <View style={styles.roomTitleSection}>
            <View style={[styles.roomIcon, { backgroundColor: `${getRoomStatusColor(room.status)}20` }]}>
              <Ionicons name="home" size={24} color={getRoomStatusColor(room.status)} />
            </View>
            <View>
              <Text style={styles.roomNumber}>{room.roomNumber}</Text>
              <Text style={styles.roomType}>
                {room.roomType} • Floor {room.floor}
              </Text>
            </View>
          </View>
          <View style={[styles.roomStatusBadge, { backgroundColor: getRoomStatusColor(room.status) }]}>
            <Text style={styles.roomStatusText}>{room.status}</Text>
          </View>
        </View>

        <View style={styles.roomStats}>
          <View style={styles.roomStat}>
            <Text style={styles.roomStatNumber}>{room.occupied}</Text>
            <Text style={styles.roomStatLabel}>Occupied</Text>
          </View>
          <View style={styles.roomStat}>
            <Text style={styles.roomStatNumber}>{room.capacity - room.occupied}</Text>
            <Text style={styles.roomStatLabel}>Available</Text>
          </View>
          <View style={styles.roomStat}>
            <Text style={styles.roomStatNumber}>{room.capacity}</Text>
            <Text style={styles.roomStatLabel}>Total Beds</Text>
          </View>
        </View>

        <View style={styles.amenitiesSection}>
          <Text style={styles.amenitiesTitle}>Amenities:</Text>
          <View style={styles.amenitiesList}>
            {room.amenities.map((amenity, index) => (
              <View key={index} style={styles.amenityChip}>
                <Text style={styles.amenityText}>{amenity}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.bedsSection}>
          <Text style={styles.bedsSectionTitle}>Beds in this room:</Text>
          <View style={styles.bedsGrid}>
            {room.beds.map(bed => renderBed(bed, room))}
          </View>
        </View>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading hostel details...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header 
        title={hostel.name}
        onBackPress={() => navigation.goBack()}
        showBack={true}
      />
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Hostel Overview */}
        <View style={styles.overviewCard}>
          <View style={styles.overviewHeader}>
            <View style={styles.hostelIcon}>
              <Ionicons name="business" size={32} color="#2196F3" />
            </View>
            <View style={styles.overviewInfo}>
              <Text style={styles.hostelName}>{hostel.name}</Text>
              <Text style={styles.hostelDescription}>{hostel.description}</Text>
            </View>
          </View>
          
          <View style={styles.overviewStats}>
            <View style={styles.overviewStat}>
              <Text style={styles.overviewStatNumber}>{hostel.capacity}</Text>
              <Text style={styles.overviewStatLabel}>Total Capacity</Text>
            </View>
            <View style={styles.overviewStat}>
              <Text style={styles.overviewStatNumber}>{hostel.occupied}</Text>
              <Text style={styles.overviewStatLabel}>Occupied</Text>
            </View>
            <View style={styles.overviewStat}>
              <Text style={styles.overviewStatNumber}>{hostel.capacity - hostel.occupied}</Text>
              <Text style={styles.overviewStatLabel}>Available</Text>
            </View>
            <View style={styles.overviewStat}>
              <Text style={styles.overviewStatNumber}>{rooms.length}</Text>
              <Text style={styles.overviewStatLabel}>Total Rooms</Text>
            </View>
          </View>

          {hostel.contact_phone && (
            <View style={styles.contactSection}>
              <Ionicons name="call" size={16} color="#666" />
              <Text style={styles.contactText}>Contact: {hostel.contact_phone}</Text>
            </View>
          )}
        </View>

        {/* Rooms List */}
        <View style={styles.roomsSection}>
          <Text style={styles.roomsSectionTitle}>🏠 Rooms ({rooms.length})</Text>
          {rooms.map(renderRoom)}
        </View>
      </ScrollView>
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
  overviewCard: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 16,
    padding: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  overviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  hostelIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  overviewInfo: {
    flex: 1,
  },
  hostelName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  hostelDescription: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },
  overviewStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  overviewStat: {
    alignItems: 'center',
  },
  overviewStatNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  overviewStatLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  contactSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  contactText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  roomsSection: {
    padding: 16,
  },
  roomsSectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  roomCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  roomTitleSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roomIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  roomNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  roomType: {
    fontSize: 14,
    color: '#666',
  },
  roomStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  roomStatusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: 'bold',
  },
  roomStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingVertical: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
  },
  roomStat: {
    alignItems: 'center',
  },
  roomStatNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  roomStatLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  amenitiesSection: {
    marginBottom: 16,
  },
  amenitiesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  amenitiesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  amenityChip: {
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  amenityText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
  },
  bedsSection: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  bedsSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  bedsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bedCard: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  bedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  bedIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  bedInfo: {
    flex: 1,
  },
  bedNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  bedStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  bedStatusText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
  studentInfo: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  studentName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  studentDetails: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  rentInfo: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '600',
    marginTop: 4,
  },
  availableInfo: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  availableText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
    marginBottom: 4,
  },
});

export default HostelDetailView;