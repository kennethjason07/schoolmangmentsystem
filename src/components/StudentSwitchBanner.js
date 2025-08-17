import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { useSelectedStudent } from '../contexts/SelectedStudentContext';

const StudentSwitchBanner = ({ style }) => {
  const { 
    selectedStudent,
    availableStudents,
    hasMultipleStudents,
    switchStudent,
    getStudentDisplayName,
    getStudentClass,
    getStudentAdmissionNo 
  } = useSelectedStudent();
  
  // Debug logging
  console.log('StudentSwitchBanner - Functions received:', {
    hasGetStudentClass: typeof getStudentClass === 'function',
    hasGetStudentDisplayName: typeof getStudentDisplayName === 'function',
    hasGetStudentAdmissionNo: typeof getStudentAdmissionNo === 'function',
    hasSwitchStudent: typeof switchStudent === 'function',
    selectedStudent: selectedStudent?.name || 'None'
  });
  
  const [showSelector, setShowSelector] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Don't show banner if no multiple students
  if (!hasMultipleStudents || availableStudents.length <= 1) {
    return null;
  }

  const handleStudentSelect = (student, index) => {
    setSelectedIndex(index);
    switchStudent(student);
    setShowSelector(false);
  };

  const currentStudentIndex = availableStudents.findIndex(s => s.id === selectedStudent?.id);

  return (
    <>
      <Animatable.View 
        style={[styles.banner, style]}
        animation="slideInDown"
        duration={600}
      >
        <TouchableOpacity 
          style={styles.bannerContent}
          onPress={() => setShowSelector(true)}
          activeOpacity={0.8}
        >
          <View style={styles.studentInfo}>
            <View style={styles.studentAvatar}>
              <Image 
                source={require('../../assets/icon.png')} 
                style={styles.avatarImage}
              />
              {selectedStudent?.isPrimaryContact && (
                <View style={styles.primaryDot}>
                  <View style={styles.primaryDotInner} />
                </View>
              )}
            </View>
            
            <View style={styles.studentDetails}>
              <Text style={styles.currentStudentLabel}>Viewing data for</Text>
              <Text style={styles.studentName}>
                {typeof getStudentDisplayName === 'function' ? getStudentDisplayName(selectedStudent) : 'Loading...'}
              </Text>
              <Text style={styles.studentClass}>
                Class {typeof getStudentClass === 'function' ? getStudentClass(selectedStudent) : 'Loading...'} • {selectedStudent?.relationshipType || 'N/A'}
              </Text>
            </View>
          </View>

          <View style={styles.switchAction}>
            <Text style={styles.switchText}>
              {currentStudentIndex + 1}/{availableStudents.length}
            </Text>
            <Ionicons name="swap-horizontal" size={20} color="#FF9800" />
          </View>
        </TouchableOpacity>
      </Animatable.View>

      {/* Student Selection Modal */}
      <Modal
        visible={showSelector}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Switch Student</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowSelector(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.studentsScrollView}
              showsVerticalScrollIndicator={false}
            >
              {availableStudents.map((student, index) => (
                <TouchableOpacity
                  key={student.id}
                  style={[
                    styles.studentOption,
                    student.id === selectedStudent?.id && styles.studentOptionSelected
                  ]}
                  onPress={() => handleStudentSelect(student, index)}
                  activeOpacity={0.7}
                >
                  <View style={styles.studentOptionContent}>
                    <View style={styles.studentOptionAvatar}>
                      <Image 
                        source={require('../../assets/icon.png')} 
                        style={styles.optionAvatarImage}
                      />
                      {student.isPrimaryContact && (
                        <View style={styles.primaryBadge}>
                          <Ionicons name="star" size={10} color="#fff" />
                        </View>
                      )}
                    </View>
                    
                    <View style={styles.studentOptionInfo}>
                      <Text style={styles.studentOptionName}>{student.name}</Text>
                      <Text style={styles.studentOptionClass}>
                        Class {student.fullClassName}
                      </Text>
                      <Text style={styles.studentOptionDetails}>
                        Roll: {student.roll_no} • Admission: {student.admission_no}
                      </Text>
                      <Text style={styles.relationshipType}>
                        {student.relationshipType}
                      </Text>
                    </View>

                    <View style={styles.selectionIndicator}>
                      {student.id === selectedStudent?.id ? (
                        <View style={styles.selectedIcon}>
                          <Ionicons name="checkmark" size={16} color="#fff" />
                        </View>
                      ) : (
                        <View style={styles.unselectedIcon} />
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  studentInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  studentAvatar: {
    position: 'relative',
    marginRight: 12,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  primaryDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF9800',
  },
  studentDetails: {
    flex: 1,
  },
  currentStudentLabel: {
    fontSize: 11,
    color: '#888',
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 2,
  },
  studentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  studentClass: {
    fontSize: 12,
    color: '#666',
  },
  switchAction: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  switchText: {
    fontSize: 11,
    color: '#FF9800',
    fontWeight: '600',
    marginBottom: 4,
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  studentsScrollView: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  studentOption: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  studentOptionSelected: {
    backgroundColor: '#fff',
    borderColor: '#4CAF50',
  },
  studentOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  studentOptionAvatar: {
    position: 'relative',
    marginRight: 16,
  },
  optionAvatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
  },
  primaryBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF9800',
    justifyContent: 'center',
    alignItems: 'center',
  },
  studentOptionInfo: {
    flex: 1,
  },
  studentOptionName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  studentOptionClass: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  studentOptionDetails: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  relationshipType: {
    fontSize: 11,
    color: '#FF9800',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  selectionIndicator: {
    marginLeft: 12,
  },
  selectedIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unselectedIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ddd',
  },
});

export default StudentSwitchBanner;
