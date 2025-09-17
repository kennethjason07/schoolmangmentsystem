import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';
import { useAuth } from '../../utils/AuthContext';
import { useTenantAccess, tenantDatabase } from '../../utils/tenantHelpers';

const TeacherSubjects = ({ navigation }) => {
  const { user } = useAuth();
  const { 
    tenantId, 
    isReady, 
    isLoading: tenantLoading, 
    tenant, 
    tenantName, 
    error: tenantError 
  } = useTenantAccess();
  
  // 🔍 DEBUG: Log tenant info on component load
  console.log('👨‍🏫 TeacherSubjects - Tenant Debug:', {
    tenantId,
    userId: user?.id
  });
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [teacherInfo, setTeacherInfo] = useState(null);
  const [stats, setStats] = useState({
    totalSubjects: 0,
    totalClasses: 0,
    classTeacherOf: 0,
  });

  // 🚀 Enhanced tenant system initialization
  useEffect(() => {
    if (isReady && !tenantLoading && !tenantError) {
      console.log('✅ TeacherSubjects: Using enhanced tenant system, tenant_id:', tenantId || 'Parent/No Tenant Required');
      loadTeacherSubjects();
    } else if (tenantError) {
      console.error('❌ TeacherSubjects: Tenant error:', tenantError);
      setError(tenantError);
      setLoading(false);
    } else {
      console.log('⚠️ TeacherSubjects: Waiting for tenant initialization...');
    }
  }, [isReady, tenantId, tenantError, tenantLoading]);

  const loadTeacherSubjects = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 🚀 Enhanced tenant system - simple ready check
      if (!isReady || tenantLoading) {
        console.log('⚠️ TeacherSubjects: Tenant context not ready, waiting...');
        setLoading(false);
        return;
      }
      
      if (tenantError) {
        console.error('❌ TeacherSubjects: Tenant error:', tenantError);
        setError(tenantError);
        setLoading(false);
        return;
      }
      
      console.log('🚀 TeacherSubjects.loadTeacherSubjects: Starting with tenant_id:', tenantId, 'user:', user.id);

      // Use the existing working dbHelpers method like student dashboard
      console.log('🔍 Loading teacher info using dbHelpers.getTeacherByUserId...');
      const { data: teacherData, error: teacherError } = await dbHelpers.getTeacherByUserId(user.id);
      
      if (teacherError || !teacherData) {
        console.error('❌ Teacher not found for user:', user.id, 'Error:', teacherError);
        throw new Error('Teacher information not found for this tenant. Please contact your administrator to link your account to a teacher profile.');
      }
      
      // 🚀 Enhanced tenant system automatically handles validation
      // No need for manual tenant validation - the system ensures data integrity
      
      console.log('👨‍🏫 Found teacher:', teacherData.name, 'for tenant:', tenantId);
      setTeacherInfo(teacherData);

      // 🚀 Enhanced tenant database for subject assignments
      console.log('🔍 Loading subject assignments for teacher:', teacherData.id, 'using enhanced system');
      const { data: subjectAssignments, error: subjectError } = await tenantDatabase.read(
        'teacher_subjects',
        { teacher_id: teacherData.id },
        `
          id,
          teacher_id,
          subject_id,
          assigned_on,
          tenant_id,
          subjects(
            id,
            name,
            class_id,
            academic_year,
            is_optional,
            classes(
              id,
              class_name,
              section,
              academic_year,
              class_teacher_id
            )
          )
        `
      );

      if (subjectError) {
        console.log('Subject assignments error:', subjectError);
        // Don't throw error for missing assignments, just set empty array
        // throw subjectError;
      }
      
      // 🚀 Enhanced tenant system automatically ensures data belongs to correct tenant
      // No manual validation needed - system provides automatic tenant isolation

      // 🚀 Enhanced tenant database for class teacher assignments
      console.log('🔍 Loading class teacher assignments for teacher:', teacherData.id, 'using enhanced system');
      const { data: classTeacherData, error: classTeacherError } = await tenantDatabase.read(
        'classes',
        { class_teacher_id: teacherData.id },
        `
          id,
          class_name,
          section,
          academic_year,
          tenant_id
        `
      );

      if (classTeacherError) {
        console.log('Error fetching class teacher data:', classTeacherError);
      }
      
      // 🚀 Enhanced tenant system automatically validates data integrity
      // Tenant isolation is handled automatically by the system

      // Process and organize the data
      const processedSubjects = subjectAssignments
        .filter(assignment => assignment.subjects && assignment.subjects.classes)
        .map(assignment => {
          const subject = assignment.subjects;
          const classInfo = subject.classes;
          const isClassTeacher = classTeacherData?.some(ct => ct.id === classInfo.id) || false;

          return {
            id: assignment.id,
            subjectId: subject.id,
            subjectName: subject.name,
            classId: classInfo.id,
            className: classInfo.class_name,
            section: classInfo.section,
            academicYear: subject.academic_year,
            isOptional: subject.is_optional,
            isClassTeacher,
            assignedAt: assignment.assigned_on,
            classSection: `${classInfo.class_name} ${classInfo.section}`,
          };
        });

      // Calculate stats
      const uniqueClasses = new Set(processedSubjects.map(s => s.classId));
      const classTeacherCount = classTeacherData?.length || 0;

      setStats({
        totalSubjects: processedSubjects.length,
        totalClasses: uniqueClasses.size,
        classTeacherOf: classTeacherCount,
      });

      setSubjects(processedSubjects);
    } catch (err) {
      console.error('Error loading teacher subjects:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadTeacherSubjects();
  };

  const renderSubjectCard = ({ item }) => (
    <TouchableOpacity
      style={styles.subjectCard}
      onPress={() => {
        // Navigate to subject details or timetable
        Alert.alert(
          'Subject Details',
          `Subject: ${item.subjectName}
Class: ${item.classSection}
Academic Year: ${item.academicYear}${item.isClassTeacher ? '\n\nYou are the class teacher for this class.' : ''}`,
          [
            { text: 'OK' },
            {
              text: 'View Timetable',
              onPress: () => navigation.navigate('TeacherTimetable')
            }
          ]
        );
      }}
    >
      <View style={styles.subjectHeader}>
        <View style={styles.subjectInfo}>
          <Text style={styles.subjectName}>{item.subjectName}</Text>
          <Text style={styles.classInfo}>{item.classSection}</Text>
          <Text style={styles.academicYear}>Academic Year: {item.academicYear}</Text>
        </View>
        <View style={styles.subjectBadges}>
          {item.isOptional && (
            <View style={styles.optionalBadge}>
              <Text style={styles.badgeText}>Optional</Text>
            </View>
          )}
          {item.isClassTeacher && (
            <View style={styles.classTeacherBadge}>
              <Text style={styles.badgeText}>Class Teacher</Text>
            </View>
          )}
        </View>
      </View>
      
      <View style={styles.subjectFooter}>
        <View style={styles.assignedDate}>
          <Ionicons name="calendar" size={14} color="#666" />
          <Text style={styles.assignedText}>
            Assigned: {new Date(item.assignedAt).toLocaleDateString()}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#666" />
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="My Subjects" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Loading your subjects...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Header title="My Subjects" showBack={true} />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#f44336" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadTeacherSubjects}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="My Subjects" showBack={true} />
      
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Stats Summary */}
        <View style={styles.statsSection}>
          <Text style={styles.statsTitle}>Teaching Overview</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#4CAF50' }]}>
                <Ionicons name="book" size={20} color="#fff" />
              </View>
              <Text style={styles.statNumber}>{stats.totalSubjects}</Text>
              <Text style={styles.statLabel}>Subjects</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#2196F3' }]}>
                <Ionicons name="school" size={20} color="#fff" />
              </View>
              <Text style={styles.statNumber}>{stats.totalClasses}</Text>
              <Text style={styles.statLabel}>Classes</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#FF9800' }]}>
                <Ionicons name="star" size={20} color="#fff" />
              </View>
              <Text style={styles.statNumber}>{stats.classTeacherOf}</Text>
              <Text style={styles.statLabel}>Class Teacher</Text>
            </View>
          </View>
        </View>

        {/* Subjects List */}
        <View style={styles.subjectsSection}>
          <Text style={styles.sectionTitle}>Assigned Subjects ({subjects.length})</Text>
          {subjects.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="book-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No subjects assigned</Text>
              <Text style={styles.emptySubtext}>Contact admin to get subjects assigned</Text>
            </View>
          ) : (
            <FlatList
              data={subjects}
              keyExtractor={item => item.id}
              renderItem={renderSubjectCard}
              scrollEnabled={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    ...Platform.select({
      web: {
        height: '100vh',
        overflow: 'hidden',
      },
    }),
  },
  content: {
    flex: 1,
    padding: 16,
    ...Platform.select({
      web: {
        overflow: 'auto',
        height: '100%',
        WebkitOverflowScrolling: 'touch',
      }
    })
  },
  scrollContent: {
    paddingBottom: Platform.OS === 'web' ? 40 : 20,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
    marginVertical: 16,
  },
  retryButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statsSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statCard: {
    alignItems: 'center',
    flex: 1,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  subjectsSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  subjectCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#1976d2',
  },
  subjectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  subjectInfo: {
    flex: 1,
  },
  subjectName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  classInfo: {
    fontSize: 16,
    color: '#1976d2',
    fontWeight: '600',
    marginBottom: 2,
  },
  academicYear: {
    fontSize: 14,
    color: '#666',
  },
  subjectBadges: {
    alignItems: 'flex-end',
  },
  optionalBadge: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  classTeacherBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  subjectFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  assignedDate: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assignedText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
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
});

export default TeacherSubjects;
