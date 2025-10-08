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
import HostelStatCard from '../../components/HostelStatCard';

const HostelStudentManagement = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [students, setStudents] = useState([]);
  const [hostelStudents, setHostelStudents] = useState([]);
  
  // Modal states
  const [addStudentModalVisible, setAddStudentModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form data
  const [studentData, setStudentData] = useState({
    admission_no: '',
    first_name: '',
    last_name: '',
    class: '',
    section: '',
    contact: '',
    parent_contact: '',
    address: ''
  });

  useEffect(() => {
    loadStudents();
    loadHostelStudents();
  }, []);

  const loadStudents = () => {
    // Mock available students data
    const mockStudents = [
      {
        id: 'st1',
        admission_no: 'ST001',
        first_name: 'Rahul',
        last_name: 'Sharma',
        class: '10',
        section: 'A',
        contact: '9876543210',
        parent_contact: '9876543200',
        address: 'Delhi, India',
        hostel_status: 'not_allocated'
      },
      {
        id: 'st2',
        admission_no: 'ST002',
        first_name: 'Priya',
        last_name: 'Patel',
        class: '11',
        section: 'B',
        contact: '9876543211',
        parent_contact: '9876543201',
        address: 'Mumbai, India',
        hostel_status: 'not_allocated'
      },
      {
        id: 'st3',
        admission_no: 'ST003',
        first_name: 'Amit',
        last_name: 'Kumar',
        class: '12',
        section: 'A',
        contact: '9876543212',
        parent_contact: '9876543202',
        address: 'Bangalore, India',
        hostel_status: 'not_allocated'
      }
    ];
    setStudents(mockStudents);
  };

  const loadHostelStudents = () => {
    setLoading(true);
    // Mock hostel students data
    setTimeout(() => {
      const mockHostelStudents = [
        {
          id: 'hs1',
          admission_no: 'ST010',
          first_name: 'Aarav',
          last_name: 'Gupta',
          class: '12',
          section: 'B',
          contact: '9876543220',
          parent_contact: '9876543210',
          address: 'Chennai, India',
          hostel_status: 'allocated',
          hostel_name: 'Main Hostel Block',
          room_number: 'A101',
          bed_number: 'Bed 1',
          allocation_date: '2024-01-15',
          monthly_rent: 5000
        },
        {
          id: 'hs2',
          admission_no: 'ST011',
          first_name: 'Riya',
          last_name: 'Mehta',
          class: '11',
          section: 'C',
          contact: '9876543221',
          parent_contact: '9876543211',
          address: 'Kolkata, India',
          hostel_status: 'allocated',
          hostel_name: 'Girls Hostel',
          room_number: 'G201',
          bed_number: 'Bed 2',
          allocation_date: '2024-01-20',
          monthly_rent: 4500
        },
        {
          id: 'hs3',
          admission_no: 'ST012',
          first_name: 'Arjun',
          last_name: 'Verma',
          class: '10',
          section: 'A',
          contact: '9876543222',
          parent_contact: '9876543212',
          address: 'Hyderabad, India',
          hostel_status: 'allocated',
          hostel_name: 'New Block',
          room_number: 'N301',
          bed_number: 'Bed 1',
          allocation_date: '2024-01-25',
          monthly_rent: 5200
        }
      ];
      setHostelStudents(mockHostelStudents);
      setLoading(false);
    }, 1000);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHostelStudents();
    await loadStudents();
    setRefreshing(false);
  };

  const resetForm = () => {
    setStudentData({
      admission_no: '',
      first_name: '',
      last_name: '',
      class: '',
      section: '',
      contact: '',
      parent_contact: '',
      address: ''
    });
  };

  const addStudent = () => {
    if (!studentData.admission_no.trim() || !studentData.first_name.trim() || !studentData.last_name.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const newStudent = {
      id: Date.now().toString(),
      admission_no: studentData.admission_no.trim(),
      first_name: studentData.first_name.trim(),
      last_name: studentData.last_name.trim(),
      class: studentData.class.trim(),
      section: studentData.section.trim(),
      contact: studentData.contact.trim(),
      parent_contact: studentData.parent_contact.trim(),
      address: studentData.address.trim(),
      hostel_status: 'not_allocated'
    };

    setStudents(prev => [...prev, newStudent]);
    setAddStudentModalVisible(false);
    resetForm();
    Alert.alert('Success', 'Student added successfully');
  };

  const deallocateStudent = (student) => {
    Alert.alert(
      'Deallocate Student',
      `Are you sure you want to deallocate ${student.first_name} ${student.last_name} from their current hostel bed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deallocate',
          style: 'destructive',
          onPress: () => {
            // Move student from hostel to available students
            const deallocatedStudent = {
              ...student,
              hostel_status: 'not_allocated'
            };
            delete deallocatedStudent.hostel_name;
            delete deallocatedStudent.room_number;
            delete deallocatedStudent.bed_number;
            delete deallocatedStudent.allocation_date;
            delete deallocatedStudent.monthly_rent;

            setHostelStudents(prev => prev.filter(s => s.id !== student.id));
            setStudents(prev => [...prev, deallocatedStudent]);
            Alert.alert('Success', 'Student deallocated successfully');
          }
        }
      ]
    );
  };

  const filteredStudents = students.filter(student => 
    student.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.admission_no.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderHostelStudentCard = (student) => (
    <View key={student.id} style={styles.studentCard}>
      <View style={styles.studentHeader}>
        <View style={styles.studentInfo}>
          <Text style={styles.studentName}>{student.first_name} {student.last_name}</Text>
          <Text style={styles.studentDetails}>{student.admission_no} • Class {student.class}-{student.section}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: '#4CAF50' }]}>
          <Ionicons name="bed" size={12} color="#fff" />
          <Text style={styles.statusText}>Allocated</Text>
        </View>
      </View>

      <View style={styles.allocationDetails}>
        <View style={styles.allocationRow}>
          <Ionicons name="business" size={16} color="#2196F3" />
          <Text style={styles.allocationText}>Hostel: {student.hostel_name}</Text>
        </View>
        <View style={styles.allocationRow}>
          <Ionicons name="home" size={16} color="#FF9800" />
          <Text style={styles.allocationText}>Room: {student.room_number}, {student.bed_number}</Text>
        </View>
        <View style={styles.allocationRow}>
          <Ionicons name="cash" size={16} color="#4CAF50" />
          <Text style={styles.allocationText}>Rent: ₹{student.monthly_rent}/month</Text>
        </View>
        <View style={styles.allocationRow}>
          <Ionicons name="calendar" size={16} color="#9C27B0" />
          <Text style={styles.allocationText}>Since: {new Date(student.allocation_date).toLocaleDateString()}</Text>
        </View>
      </View>

      <View style={styles.contactInfo}>
        <Text style={styles.contactText}>Student: {student.contact}</Text>
        <Text style={styles.contactText}>Parent: {student.parent_contact}</Text>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#F44336' }]}
          onPress={() => deallocateStudent(student)}
        >
          <Ionicons name="remove-circle" size={16} color="#fff" />
          <Text style={styles.actionButtonText}>Deallocate</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderAvailableStudent = ({ item }) => (
    <View style={styles.availableStudentItem}>
      <View style={styles.studentItemInfo}>
        <Text style={styles.studentItemName}>{item.first_name} {item.last_name}</Text>
        <Text style={styles.studentItemDetails}>
          {item.admission_no} • Class {item.class}-{item.section}
        </Text>
        <Text style={styles.studentItemContact}>
          Student: {item.contact} | Parent: {item.parent_contact}
        </Text>
      </View>
      <View style={styles.availableActions}>
        <View style={[styles.statusBadge, { backgroundColor: '#2196F3' }]}>
          <Ionicons name="person-add" size={12} color="#fff" />
          <Text style={styles.statusText}>Available</Text>
        </View>
        <TouchableOpacity
          style={[styles.assignBtn, { backgroundColor: '#4CAF50' }]}
          onPress={() => navigation.navigate('HostelManagement', {
            allocationContext: { student: item, applicationId: null, allocationMode: true }
          })}
        >
          <Ionicons name="bed" size={14} color="#fff" />
          <Text style={styles.assignBtnText}>Assign</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Header
        title="Student Management"
        onBackPress={() => navigation.goBack()}
        showBack={true}
      />

      <View style={styles.headerSection}>
        <View style={styles.titleContainer}>
          <Ionicons name="people" size={28} color="#FF9800" />
          <View style={styles.titleInfo}>
            <Text style={styles.mainTitle}>Hostel Student Management</Text>
            <Text style={styles.subtitle}>Manage student allocations and records</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setAddStudentModalVisible(true)}
        >
          <Ionicons name="person-add" size={24} color="#fff" />
          <Text style={styles.addButtonText}>Add Student</Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading students...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Summary Stat Cards */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📚 Student Overview</Text>
            <View style={{ gap: 12 }}>
              <HostelStatCard
                title="All Classes"
                value={String(new Set([...students, ...hostelStudents].map(s => `${s.class}-${s.section}`)).size)}
                icon="school"
                color="#3F51B5"
                subtitle="Tap to view all classes"
                animated
                onPress={() => {
                  const combined = [...students, ...hostelStudents];
                  // Build class items with embedded student lists
                  const classMap = new Map();
                  combined.forEach(s => {
                    const key = `${s.class}-${s.section}`;
                    if (!classMap.has(key)) classMap.set(key, []);
                    classMap.get(key).push(s);
                  });
                  const classes = Array.from(classMap.entries()).map(([key, list]) => {
                    const [cls, sec] = key.split('-');
                    return {
                      id: `class-${key}`,
                      name: `Class ${cls}-${sec}`,
                      class: cls,
                      section: sec,
                      total: list.length,
                      studentsList: list,
                    };
                  });
                  navigation.navigate('HostelDetailList', {
                    type: 'classes',
                    title: 'All Classes',
                    data: classes,
                    icon: 'school',
                    color: '#3F51B5',
                    description: 'Browse classes and drill down to students',
                  });
                }}
              />

              <HostelStatCard
                title="All Students"
                value={String(students.length + hostelStudents.length)}
                icon="people"
                color="#FF9800"
                subtitle="Tap to view all students"
                animated
                onPress={() => {
                  const combined = [...students, ...hostelStudents].map(s => ({ ...s, full_name: `${s.first_name} ${s.last_name}` }));
                  navigation.navigate('HostelDetailList', {
                    type: 'students',
                    title: 'All Students',
                    data: combined,
                    icon: 'people',
                    color: '#FF9800',
                    description: 'All students with quick actions',
                  });
                }}
              />
            </View>
          </View>

          {/* Allocated Students Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🛏️ Allocated Students ({hostelStudents.length})</Text>
            {hostelStudents.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="bed-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No students allocated to hostels</Text>
              </View>
            ) : (
              <View style={styles.studentsList}>
                {hostelStudents.map(renderHostelStudentCard)}
              </View>
            )}
          </View>

          {/* Available Students Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>👥 Available Students ({students.length})</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search students by name or admission number..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {filteredStudents.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No available students found</Text>
              </View>
            ) : (
              <FlatList
                data={filteredStudents}
                keyExtractor={(item) => item.id}
                renderItem={renderAvailableStudent}
                scrollEnabled={false}
              />
            )}
          </View>
        </ScrollView>
      )}

      {/* Add Student Modal */}
      <Modal visible={addStudentModalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Add New Student</Text>
              
              <TextInput
                style={styles.input}
                placeholder="Admission Number *"
                value={studentData.admission_no}
                onChangeText={(text) => setStudentData(prev => ({ ...prev, admission_no: text }))}
              />
              
              <TextInput
                style={styles.input}
                placeholder="First Name *"
                value={studentData.first_name}
                onChangeText={(text) => setStudentData(prev => ({ ...prev, first_name: text }))}
              />
              
              <TextInput
                style={styles.input}
                placeholder="Last Name *"
                value={studentData.last_name}
                onChangeText={(text) => setStudentData(prev => ({ ...prev, last_name: text }))}
              />
              
              <TextInput
                style={styles.input}
                placeholder="Class"
                value={studentData.class}
                onChangeText={(text) => setStudentData(prev => ({ ...prev, class: text }))}
              />
              
              <TextInput
                style={styles.input}
                placeholder="Section"
                value={studentData.section}
                onChangeText={(text) => setStudentData(prev => ({ ...prev, section: text }))}
              />
              
              <TextInput
                style={styles.input}
                placeholder="Student Contact"
                value={studentData.contact}
                onChangeText={(text) => setStudentData(prev => ({ ...prev, contact: text }))}
                keyboardType="phone-pad"
              />
              
              <TextInput
                style={styles.input}
                placeholder="Parent Contact"
                value={studentData.parent_contact}
                onChangeText={(text) => setStudentData(prev => ({ ...prev, parent_contact: text }))}
                keyboardType="phone-pad"
              />
              
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Address"
                value={studentData.address}
                onChangeText={(text) => setStudentData(prev => ({ ...prev, address: text }))}
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: '#f0f0f0' }]}
                  onPress={() => {
                    setAddStudentModalVisible(false);
                    resetForm();
                  }}
                >
                  <Text style={[styles.modalButtonText, { color: '#333' }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: '#FF9800' }]}
                  onPress={addStudent}
                >
                  <Text style={styles.modalButtonText}>Add Student</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
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
    backgroundColor: '#FF9800',
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
  section: {
    backgroundColor: '#fff',
    margin: 12,
    borderRadius: 12,
    padding: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    color: '#2c3e50',
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
    gap: 12,
  },
  studentCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  studentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  studentDetails: {
    fontSize: 14,
    color: '#666',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  allocationDetails: {
    marginBottom: 12,
  },
  allocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  allocationText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 8,
  },
  contactInfo: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  contactText: {
    fontSize: 12,
    color: '#888',
    marginBottom: 2,
  },
  cardActions: {
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  availableStudentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
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
  availableActions: {
    alignItems: 'flex-end',
  },
  assignBtn: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  assignBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
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
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
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

export default HostelStudentManagement;