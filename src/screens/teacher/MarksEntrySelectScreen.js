import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../utils/AuthContext';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';
import Header from '../../components/Header';
// 🚀 ENHANCED TENANT SYSTEM IMPORTS
import { 
  useTenantAccess, 
  tenantDatabase, 
  getCachedTenantId 
} from '../../utils/tenantHelpers';

export default function MarksEntrySelectScreen({ navigation }) {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  
  // 🚀 ENHANCED TENANT SYSTEM - Use reliable cached tenant access
  const { 
    getTenantId, 
    isReady, 
    isLoading: tenantLoading, 
    tenant, 
    tenantName, 
    error: tenantError 
  } = useTenantAccess();
  
  // 🚀 ENHANCED TENANT SYSTEM - Tenant validation helper
  const validateTenantAccess = () => {
    if (!isReady) {
      return { valid: false, error: 'Tenant context not ready' };
    }
    
    const tenantId = getCachedTenantId();
    if (!tenantId) {
      return { valid: false, error: 'No tenant ID available' };
    }
    
    return { valid: true, tenantId };
  };

  // 🚀 ENHANCED: Fetch teacher's assigned subjects with enhanced tenant system
  const fetchTeacherSubjects = async () => {
    try {
      setLoading(true);
      setError(null);

      // 🚀 ENHANCED: Validate tenant access using new helper
      const validation = validateTenantAccess();
      if (!validation.valid) {
        console.error('❌ Enhanced tenant validation failed:', validation.error);
        throw new Error(validation.error);
      }
      
      const tenantId = validation.tenantId;
      console.log('🚀 Enhanced tenant system: Using cached tenant ID:', tenantId);

      // 🚀 ENHANCED: Get teacher info using dbHelpers with enhanced validation
      console.log('🔍 Getting teacher info using dbHelpers...');
      const { data: teacherData, error: teacherError } = await dbHelpers.getTeacherByUserId(user.id);

      if (teacherError || !teacherData) {
        console.error('❌ Teacher not found for user:', user.id, 'Error:', teacherError);
        throw new Error('Teacher information not found for this tenant.');
      }
      
      // 🚀 ENHANCED: Teacher data validation (enhanced tenant system handles automatic validation)
      if (teacherData && teacherData.tenant_id && teacherData.tenant_id !== tenantId) {
        console.error('❌ Teacher data validation failed: tenant mismatch');
        throw new Error('Teacher data belongs to different tenant');
      }
      
      console.log('✅ Enhanced: Teacher lookup successful:', teacherData.name);

      // 🚀 ENHANCED: Get assigned subjects using enhanced tenant system
      console.log('📚 Loading teacher subjects...');
      const { data: assignedSubjects, error: subjectsError } = await tenantDatabase.read(
        TABLES.TEACHER_SUBJECTS,
        { teacher_id: teacherData.id },
        `
          *,
          subjects(name, id)
        `
      );

      if (subjectsError) throw subjectsError;

      // Extract unique subjects
      const uniqueSubjects = [];
      const subjectMap = new Map();

      assignedSubjects.forEach(assignment => {
        if (assignment.subjects && !subjectMap.has(assignment.subjects.id)) {
          subjectMap.set(assignment.subjects.id, assignment.subjects.name);
          uniqueSubjects.push({
            id: assignment.subjects.id,
            name: assignment.subjects.name
          });
        }
      });

      setSubjects(uniqueSubjects);

    } catch (err) {
      setError(err.message);
      console.error('Error fetching subjects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isReady) {
      fetchTeacherSubjects();
    }
  }, [isReady]);

  // 🚀 ENHANCED: Show tenant loading states
  if (tenantLoading) {
    return (
      <View style={styles.container}>
        <Header title="Select Subject" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Initializing tenant context...</Text>
          <Text style={styles.loadingSubtext}>Setting up secure access</Text>
        </View>
      </View>
    );
  }
  
  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Select Subject" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Loading subjects...</Text>
          {tenantName && (
            <Text style={styles.loadingSubtext}>📚 {tenantName}</Text>
          )}
        </View>
      </View>
    );
  }

  // 🚀 ENHANCED: Show tenant errors with enhanced messages
  if (tenantError) {
    return (
      <View style={styles.container}>
        <Header title="Select Subject" showBack={true} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Tenant Access Error</Text>
          <Text style={styles.errorText}>{tenantError}</Text>
          <Text style={styles.errorSubtext}>Please check your connection and try again.</Text>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={() => {
              // Refresh the page to retry tenant initialization
              fetchTeacherSubjects();
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Header title="Select Subject" showBack={true} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Loading Error</Text>
          <Text style={styles.errorText}>{error}</Text>
          {tenantName && (
            <Text style={styles.errorSubtext}>📚 {tenantName}</Text>
          )}
          <TouchableOpacity style={styles.retryButton} onPress={fetchTeacherSubjects}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Select Subject" showBack={true} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Select Subject</Text>
        
        {subjects.length === 0 ? (
          <View style={styles.noDataContainer}>
            <Ionicons name="book-outline" size={48} color="#ccc" />
            <Text style={styles.noDataText}>No subjects assigned</Text>
            <Text style={styles.noDataSubtext}>Contact administrator to assign subjects</Text>
          </View>
        ) : (
          subjects.map(subject => (
            <TouchableOpacity
              key={subject.id}
              style={styles.subjectCard}
              onPress={() => navigation.navigate('MarksEntryStudentsScreen', { 
                subject: subject.name,
                subjectId: subject.id 
              })}
            >
              <Ionicons name="book" size={24} color="#1976d2" style={styles.subjectIcon} />
              <Text style={styles.subjectText}>{subject.name}</Text>
              <Ionicons name="chevron-forward" size={20} color="#1976d2" style={styles.arrowIcon} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 18,
  },
  subjectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  subjectIcon: {
    marginRight: 12,
  },
  subjectText: {
    color: '#1976d2',
    fontWeight: 'bold',
    fontSize: 17,
    flex: 1,
  },
  arrowIcon: {
    marginLeft: 'auto',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#1976d2',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingSubtext: {
    marginTop: 8,
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtext: {
    color: '#666',
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noDataText: {
    fontSize: 18,
    color: '#666',
    marginTop: 12,
    fontWeight: 'bold',
  },
  noDataSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
}); 