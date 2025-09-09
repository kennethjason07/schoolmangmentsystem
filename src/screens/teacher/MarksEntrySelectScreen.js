import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../utils/AuthContext';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';
import Header from '../../components/Header';

export default function MarksEntrySelectScreen({ navigation }) {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  // Fetch teacher's assigned subjects
  const fetchTeacherSubjects = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get teacher info using the helper function (which uses email-based lookup)
      const { data: teacherData, error: teacherError } = await dbHelpers.getTeacherByUserId(user.id);

      if (teacherError || !teacherData) {
        console.error('❌ Teacher not found for user:', user.id, 'Error:', teacherError);
        throw new Error('Teacher information not found for this tenant.');
      }

      // Get assigned subjects
      const { data: assignedSubjects, error: subjectsError } = await supabase
        .from(TABLES.TEACHER_SUBJECTS)
        .select(`
          *,
          subjects(name, id)
        `)
        .eq('teacher_id', teacherData.id);

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
    fetchTeacherSubjects();
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Select Subject" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Loading subjects...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Header title="Select Subject" showBack={true} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
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
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 16,
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