import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import { useAuth } from '../../utils/AuthContext';
import { useSelectedStudent } from '../../contexts/SelectedStudentContext';

const StudentSelectionScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { 
    availableStudents, 
    loading, 
    switchStudent, 
    hasMultipleStudents,
    getStudentClass,
    getStudentAdmissionNo 
  } = useSelectedStudent();
  
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Auto-navigate if only one student
  useEffect(() => {
    if (!loading && availableStudents.length === 1) {
      // Auto-select the single student and navigate
      switchStudent(availableStudents[0]);
      navigation.replace('ParentTabs');
    }
  }, [loading, availableStudents]);

  const handleStudentSelect = (student, index) => {
    setSelectedIndex(index);
    switchStudent(student);
    // Small delay for visual feedback, then navigate
    setTimeout(() => {
      navigation.replace('ParentTabs');
    }, 500);
  };

  const handleSkip = () => {
    if (availableStudents.length > 0) {
      switchStudent(availableStudents[0]);
    }
    navigation.replace('ParentTabs');
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.gradient}
        >
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Loading your children...</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  if (availableStudents.length === 0) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.gradient}
        >
          <View style={styles.centerContainer}>
            <Ionicons name="school-outline" size={80} color="#fff" />
            <Text style={styles.noStudentsTitle}>No Students Found</Text>
            <Text style={styles.noStudentsSubtitle}>
              No students are associated with your account. Please contact the school administration.
            </Text>
            <TouchableOpacity
              style={styles.contactButton}
              onPress={() => Alert.alert('Contact School', 'Please contact your school administration to link students to your account.')}
            >
              <Text style={styles.contactButtonText}>Contact School</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.gradient}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animatable.View 
            style={styles.headerContainer}
            animation="fadeInDown"
            duration={800}
          >
            <Ionicons name="people" size={60} color="#fff" />
            <Text style={styles.title}>Select Your Child</Text>
            <Text style={styles.subtitle}>
              Choose which child you'd like to view information for
            </Text>
          </Animatable.View>

          <Animatable.View 
            style={styles.studentsContainer}
            animation="fadeInUp"
            duration={800}
            delay={200}
          >
            {availableStudents.map((student, index) => (
              <TouchableOpacity
                key={student.id}
                style={[
                  styles.studentCard,
                  selectedIndex === index && styles.studentCardSelected
                ]}
                onPress={() => handleStudentSelect(student, index)}
                activeOpacity={0.8}
              >
                <View style={styles.studentCardContent}>
                  <View style={styles.studentAvatar}>
                    <Image 
                      source={require('../../../assets/icon.png')} 
                      style={styles.avatarImage}
                    />
                    {student.isPrimaryContact && (
                      <View style={styles.primaryBadge}>
                        <Ionicons name="star" size={12} color="#fff" />
                      </View>
                    )}
                  </View>
                  
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>{student.name}</Text>
                    <Text style={styles.studentClass}>
                      Class {typeof getStudentClass === 'function' ? getStudentClass(student) : 'Loading...'}
                    </Text>
                    <Text style={styles.studentDetails}>
                      Roll: {student.roll_no} • Admission: {typeof getStudentAdmissionNo === 'function' ? getStudentAdmissionNo(student) : 'Loading...'}
                    </Text>
                    <Text style={styles.relationshipType}>
                      Your relationship: {student.relationshipType || 'N/A'}
                    </Text>
                  </View>

                  <View style={styles.selectIcon}>
                    {selectedIndex === index ? (
                      <View style={styles.selectedIcon}>
                        <Ionicons name="checkmark" size={20} color="#fff" />
                      </View>
                    ) : (
                      <Ionicons name="chevron-forward" size={20} color="#ccc" />
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </Animatable.View>

          {availableStudents.length > 0 && (
            <Animatable.View 
              style={styles.bottomActions}
              animation="fadeIn"
              delay={400}
            >
              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleSkip}
              >
                <Text style={styles.skipButtonText}>
                  Continue with {availableStudents[0]?.name}
                </Text>
              </TouchableOpacity>
            </Animatable.View>
          )}
        </ScrollView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 20,
    fontWeight: '500',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 22,
  },
  studentsContainer: {
    marginBottom: 30,
  },
  studentCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    transform: [{ scale: 1 }],
  },
  studentCardSelected: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#4CAF50',
    transform: [{ scale: 1.02 }],
  },
  studentCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  studentAvatar: {
    position: 'relative',
    marginRight: 16,
  },
  avatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f0f0',
  },
  primaryBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF9800',
    justifyContent: 'center',
    alignItems: 'center',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  studentClass: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  studentDetails: {
    fontSize: 14,
    color: '#888',
    marginBottom: 4,
  },
  relationshipType: {
    fontSize: 12,
    color: '#FF9800',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  selectIcon: {
    marginLeft: 10,
  },
  selectedIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomActions: {
    alignItems: 'center',
  },
  skipButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  skipButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  noStudentsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  noStudentsSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  contactButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  contactButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default StudentSelectionScreen;
