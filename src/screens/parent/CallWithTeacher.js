import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Linking,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import { useAuth } from '../../utils/AuthContext';
import { supabase, TABLES } from '../../utils/supabase';

const CallWithTeacher = ({ navigation }) => {
  const { user } = useAuth();
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTeachers();
  }, []);

  // Helper function to get teacher's phone number and profile photo from teachers and users tables
  const getTeacherDetails = async (teacherId) => {
    try {
      // Get teacher data including user_id
      const { data: teacherData, error: teacherError } = await supabase
        .from(TABLES.TEACHERS)
        .select('phone, user_id')
        .eq('id', teacherId)
        .single();

      if (teacherError) {
        console.log('❌ Error fetching teacher details:', teacherError);
        return { phone: null, profilePhoto: null };
      }

      let profilePhoto = null;

      // If teacher has a user_id, get profile photo from users table
      if (teacherData?.user_id) {
        const { data: userData, error: userError } = await supabase
          .from(TABLES.USERS)
          .select('profile_picture')
          .eq('id', teacherData.user_id)
          .single();

        if (!userError && userData?.profile_picture) {
          profilePhoto = userData.profile_picture;
        }
      }

      return {
        phone: teacherData?.phone || null,
        profilePhoto: profilePhoto
      };
    } catch (err) {
      console.log('❌ Exception getting teacher details:', err);
      return { phone: null, profilePhoto: null };
    }
  };

  const fetchTeachers = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🚀 === STARTING TEACHER FETCH (CALL VERSION) ===');
      console.log('👤 Current user:', user);

      // Step 1: Get parent user data and linked student (exact same as ChatWithTeacher)
      const { data: parentData, error: parentError } = await supabase
        .from(TABLES.USERS)
        .select(`
          *,
          students!users_linked_parent_of_fkey(
            id,
            name,
            class_id,
            classes(id, class_name, section)
          )
        `)
        .eq('id', user.id)
        .single();

      console.log('👪 Parent query result:', { parentData, parentError });

      if (parentError || !parentData?.linked_parent_of) {
        throw new Error('Parent account is not linked to any student. Please contact the administrator.');
      }

      const student = parentData.students;
      if (!student) {
        throw new Error('Student information not found.');
      }

      console.log('👦 Student data:', student);
      console.log('🏫 Student class:', student.classes);
      console.log('Student class_id:', student.class_id);

      // Step 2: Get teachers assigned to this specific class (using same logic as ChatWithTeacher)
      const uniqueTeachers = [];
      const seen = new Set();
      const studentClassId = student.class_id;

      console.log('🔍 Finding teachers for class:', studentClassId);
      console.log('🎯 Class:', student.classes?.class_name, student.classes?.section);

      // Method 1A: Get class teacher from classes table (using class_teacher_id)
      console.log('Fetching class teacher via classes table for class_id:', student.class_id);
      const { data: classInfo, error: classInfoError } = await supabase
        .from(TABLES.CLASSES)
        .select(`
          id,
          class_name,
          section,
          class_teacher_id,
          teachers!classes_class_teacher_id_fkey(
            id,
            name,
            qualification
          )
        `)
        .eq('id', student.class_id)
        .single();

      if (!classInfoError && classInfo) {
        console.log('Found class info:', classInfo);

        // Add class teacher if available
        if (classInfo.class_teacher_id && classInfo.teachers && classInfo.teachers.name) {
          console.log('Found class teacher from classes table:', classInfo.teachers);

          // Get teacher's phone number and profile photo
          const teacherDetails = await getTeacherDetails(classInfo.teachers.id);

          uniqueTeachers.push({
            id: classInfo.teachers.id,
            name: classInfo.teachers.name,
            phone: teacherDetails.phone,
            profilePhoto: teacherDetails.profilePhoto,
            qualification: classInfo.teachers.qualification,
            subjects: ['Class Teacher'],
            role: 'class_teacher',
            className: `${student.classes.class_name} ${student.classes.section}`,
            studentName: student.name,
            hasPhone: !!teacherDetails.phone
          });
          seen.add(classInfo.teachers.id);
        }
      } else {
        console.log('Class info fetch error:', classInfoError);
      }

      // Method 1B: Alternative - Get class teacher directly from teachers table
      if (uniqueTeachers.length === 0) {
        console.log('Trying direct teacher fetch for class_id:', student.class_id);
        const { data: directClassTeacher, error: directTeacherError } = await supabase
          .from(TABLES.TEACHERS)
          .select('id, name, qualification, phone, is_class_teacher, assigned_class_id, user_id')
          .eq('assigned_class_id', student.class_id)
          .eq('is_class_teacher', true);

        if (!directTeacherError && directClassTeacher && directClassTeacher.length > 0) {
          console.log('Found class teacher directly:', directClassTeacher[0]);
          const teacher = directClassTeacher[0];
          if (teacher.name && !seen.has(teacher.id)) {
            // Get teacher's profile photo
            const teacherDetails = await getTeacherDetails(teacher.id);

            uniqueTeachers.push({
              id: teacher.id,
              name: teacher.name,
              phone: teacher.phone,
              profilePhoto: teacherDetails.profilePhoto,
              qualification: teacher.qualification,
              subjects: ['Class Teacher'],
              role: 'class_teacher',
              className: `${student.classes.class_name} ${student.classes.section}`,
              studentName: student.name,
              hasPhone: !!teacher.phone
            });
            seen.add(teacher.id);
          }
        }
      }

      // Method 2: Get subject teachers using the same approach as ChatWithTeacher
      console.log('Fetching subject teachers for class_id:', student.class_id);

      // Get all subjects for this specific class
      const { data: classSubjects, error: classSubjectsError } = await supabase
        .from(TABLES.SUBJECTS)
        .select('id, name')
        .eq('class_id', student.class_id);

      console.log('Class subjects:', classSubjects, 'Error:', classSubjectsError);

      if (!classSubjectsError && classSubjects && classSubjects.length > 0) {
        // For each subject, find the assigned teachers
        for (const subject of classSubjects) {
          console.log('Finding teachers for subject:', subject.name, 'ID:', subject.id);

          // Use a simpler query without the problematic relationship
          const { data: teacherAssignments, error: teacherError } = await supabase
            .from(TABLES.TEACHER_SUBJECTS)
            .select('teacher_id')
            .eq('subject_id', subject.id);

          console.log('Teacher assignments for', subject.name, ':', teacherAssignments, 'Error:', teacherError);

          if (!teacherError && teacherAssignments && teacherAssignments.length > 0) {
            for (const assignment of teacherAssignments) {
              if (assignment.teacher_id && !seen.has(assignment.teacher_id)) {

                // Get teacher details separately
                const { data: teacherData, error: teacherDataError } = await supabase
                  .from(TABLES.TEACHERS)
                  .select('id, name, qualification, phone, is_class_teacher, user_id')
                  .eq('id', assignment.teacher_id)
                  .single();

                if (!teacherDataError && teacherData && teacherData.name) {
                  // Get teacher's profile photo
                  const teacherDetails = await getTeacherDetails(teacherData.id);

                  uniqueTeachers.push({
                    id: teacherData.id,
                    name: teacherData.name,
                    phone: teacherData.phone,
                    profilePhoto: teacherDetails.profilePhoto,
                    qualification: teacherData.qualification,
                    subjects: [subject.name],
                    role: 'subject_teacher',
                    className: `${student.classes.class_name} ${student.classes.section}`,
                    studentName: student.name,
                    hasPhone: !!teacherData.phone
                  });

                  seen.add(teacherData.id);
                  console.log('Added subject teacher:', teacherData.name, 'for', subject.name);
                }
              }
            }
          }
        }
      }

      console.log('Final teachers list:', uniqueTeachers);
      setTeachers(uniqueTeachers);

    } catch (err) {
      console.error('❌ Error fetching teachers:', err);
      setError(err.message);
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCallTeacher = (teacher) => {
    if (!teacher.phone) {
      Alert.alert(
        'No Phone Number',
        `${teacher.name} doesn't have a phone number on file. Please contact the school administration.`,
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Call Teacher',
      `Do you want to call ${teacher.name}?\n\nPhone: ${teacher.phone}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Call', 
          onPress: () => {
            const phoneUrl = `tel:${teacher.phone}`;
            Linking.openURL(phoneUrl).catch(() => {
              Alert.alert('Error', 'Unable to make phone call');
            });
          }
        }
      ]
    );
  };

  // Helper function to sort teachers (same as ChatWithTeacher)
  const getSortedTeachers = () => {
    return teachers.sort((a, b) => {
      // Class teachers first
      if (a.role === 'class_teacher' && b.role !== 'class_teacher') return -1;
      if (b.role === 'class_teacher' && a.role !== 'class_teacher') return 1;

      // Then by name
      return a.name.localeCompare(b.name);
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Call Teacher" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading teachers...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Header title="Call Teacher" showBack={true} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchTeachers}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Call Teacher" showBack={true} />
      <View style={styles.teacherListContainer}>
        <View style={styles.headerSection}>
          <Text style={styles.sectionTitle}>Your Child's Teachers</Text>
          <Text style={styles.sectionSubtitle}>
            {teachers.length} teacher{teachers.length !== 1 ? 's' : ''} available for calling
          </Text>
          {teachers.length > 0 && (
            <View style={styles.classInfo}>
              <Ionicons name="call" size={16} color="#4CAF50" />
              <Text style={styles.classInfoText}>
                Class: {teachers[0]?.className || 'N/A'} • Student: {teachers[0]?.studentName || 'N/A'}
              </Text>
            </View>
          )}
        </View>

        {teachers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.noTeachersIcon}>
              <Ionicons name="people-outline" size={48} color="#9e9e9e" />
            </View>
            <Text style={styles.noTeachersTitle}>No Teachers Assigned</Text>
            <Text style={styles.noTeachersMessage}>
              Your child's teachers have not been assigned yet. Please contact the school administration for assistance.
            </Text>
            <TouchableOpacity
              style={styles.contactButton}
              onPress={() => {
                Alert.alert(
                  'Contact Administration',
                  'Please contact the school office to have teachers assigned to your child\'s class.',
                  [{ text: 'OK' }]
                );
              }}
            >
              <Ionicons name="call" size={16} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.contactButtonText}>Contact School</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={getSortedTeachers()}
            keyExtractor={item => item.id}
            renderItem={({ item, index }) => {
              const sortedTeachers = getSortedTeachers();
              const showClassTeacherHeader = index === 0 && item.role === 'class_teacher';
              const showSubjectTeacherHeader = index > 0 &&
                item.role === 'subject_teacher' &&
                sortedTeachers[index - 1].role !== 'subject_teacher';

              const hasPhone = !!item.phone;

              return (
                <View>
                  {showClassTeacherHeader && (
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionHeaderText}>Class Teacher</Text>
                    </View>
                  )}
                  {showSubjectTeacherHeader && (
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionHeaderText}>Subject Teachers</Text>
                    </View>
                  )}
                  <TouchableOpacity style={[
                    styles.teacherCard,
                    item.role === 'class_teacher' && styles.classTeacherCard,
                    hasPhone && styles.phoneAvailableCard
                  ]} onPress={() => handleCallTeacher(item)}>
                    <View style={[
                      styles.teacherAvatarContainer,
                      hasPhone && styles.phoneAvailableAvatar
                    ]}>
                      {item.profilePhoto ? (
                        <Image
                          source={{ uri: item.profilePhoto }}
                          style={styles.teacherProfileImage}
                          onError={() => {
                            console.log('Failed to load profile image for:', item.name);
                          }}
                        />
                      ) : (
                        <View style={[
                          styles.teacherAvatar,
                          { backgroundColor: item.role === 'class_teacher' ? '#4CAF50' :
                                            item.role === 'both' ? '#FF9800' : '#2196F3' }
                        ]}>
                          <Ionicons
                            name="person"
                            size={24}
                            color="#fff"
                          />
                        </View>
                      )}
                      {hasPhone && (
                        <View style={styles.phoneAvailableDot} />
                      )}
                    </View>
                    <View style={styles.teacherInfo}>
                      <View style={styles.teacherHeader}>
                        <Text style={[
                          styles.teacherName,
                          hasPhone && styles.phoneAvailableText
                        ]}>
                          {item.name}
                        </Text>
                        <View style={[styles.roleBadge, {
                          backgroundColor: item.role === 'class_teacher' ? '#4CAF50' :
                                          item.role === 'both' ? '#FF9800' : '#2196F3'
                        }]}>
                          <Text style={styles.roleBadgeText}>
                            {item.role === 'class_teacher' ? 'CLASS' :
                             item.role === 'both' ? 'BOTH' : 'SUBJECT'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.teacherSubject} numberOfLines={1}>
                        {Array.isArray(item.subjects) ? item.subjects.join(', ') : item.subjects || 'Teacher'}
                      </Text>

                      {/* Phone Status */}
                      {item.phone ? (
                        <View style={styles.phoneContainer}>
                          <Text style={styles.phoneText}>
                            📞 {item.phone}
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.noPhoneText}>
                          No phone number available
                        </Text>
                      )}
                    </View>
                    <View style={styles.chatActions}>
                      {hasPhone ? (
                        <View style={styles.phoneAvailableBadge}>
                          <Ionicons name="call" size={24} color="#fff" />
                        </View>
                      ) : (
                        <View style={styles.phoneUnavailableBadge}>
                          <Ionicons name="call-outline" size={24} color="#9E9E9E" />
                        </View>
                      )}
                      <Ionicons name="chevron-forward" size={20} color="#ccc" />
                    </View>
                  </TouchableOpacity>
                </View>
              );
            }}
            contentContainerStyle={{ padding: 16 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  teacherListContainer: {
    flex: 1
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976d2',
    margin: 16
  },
  teacherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    elevation: 2
  },
  teacherName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222'
  },
  teacherSubject: {
    fontSize: 14,
    color: '#666'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },

  // Enhanced Teacher Card Styles with Profile Photo Support
  teacherAvatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    position: 'relative',
  },
  teacherAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1976d2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  teacherProfileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
  },
  teacherInfo: {
    flex: 1,
    paddingRight: 8,
  },
  teacherHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    minWidth: 50,
    alignItems: 'center',
  },
  roleBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  teacherQualification: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  chatActions: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Header Section Styles (same as ChatWithTeacher)
  headerSection: {
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  classInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  classInfoText: {
    fontSize: 13,
    color: '#1976d2',
    marginLeft: 6,
    fontWeight: '500',
  },

  // Section Header Styles (same as ChatWithTeacher)
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Enhanced Teacher Card Styles (same as ChatWithTeacher)
  classTeacherCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    backgroundColor: '#f8fff8',
  },

  // No Teachers Assigned Styles (same as ChatWithTeacher)
  noTeachersIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  noTeachersTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#424242',
    textAlign: 'center',
    marginBottom: 8,
  },
  noTeachersMessage: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 32,
    marginBottom: 24,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1976d2',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    elevation: 2,
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  contactButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Phone-specific styles (adapted from unread styles)
  phoneAvailableCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
    backgroundColor: '#f8fff8',
  },
  phoneAvailableAvatar: {
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  phoneAvailableDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#fff',
  },
  phoneAvailableText: {
    fontWeight: 'bold',
    color: '#222',
  },
  phoneAvailableBadge: {
    backgroundColor: '#4CAF50',
    borderRadius: 18,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    elevation: 3,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  phoneUnavailableBadge: {
    backgroundColor: '#E0E0E0',
    borderRadius: 18,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#BDBDBD',
  },

  // Phone Display
  phoneContainer: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  phoneText: {
    fontSize: 13,
    color: '#4CAF50',
    fontWeight: '500',
  },
  noPhoneText: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 4,
  },
});

export default CallWithTeacher;
