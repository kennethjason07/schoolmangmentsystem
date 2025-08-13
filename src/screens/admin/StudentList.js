import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import Header from '../../components/Header';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../utils/supabase';

const StudentList = ({ route, navigation }) => {
  const { classId, className, section } = route.params || {};
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log('StudentList: Component mounted');
    console.log('StudentList: route.params:', route.params);
    console.log('StudentList: classId from params:', classId);
    
    const fetchStudents = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log('StudentList: Received classId:', classId);
        
        if (!classId) {
          console.log('StudentList: No classId provided');
          setError('No class ID provided');
          setLoading(false);
          return;
        }
        
        // Get students by class ID - using direct Supabase query
        const { data, error } = await supabase
          .from('students')
          .select(`
            *,
            classes(class_name, section),
            users!students_parent_id_fkey(full_name, phone, email)
          `)
          .eq('class_id', classId)
          .order('roll_no', { ascending: true });

        if (error) {
          console.error('StudentList: Supabase error:', error);
          throw error;
        }
        
        console.log('StudentList: Query result:', { data, error });
        console.log('StudentList: Number of students found:', data?.length || 0);
        
        if (data && data.length > 0) {
          console.log('StudentList: First student:', data[0]);
        }
        
        setStudents(data || []);
      } catch (err) {
        console.error('Error fetching students:', err);
        setError('Failed to load students.');
        Alert.alert('Error', 'Failed to load students');
      } finally {
        setLoading(false);
      }
    };
    
    fetchStudents();
  }, [classId]);

  const renderStudent = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => {
        console.log('StudentList: Navigating to StudentDetails with student:', item);
        console.log('StudentList: Student ID:', item.id);
        navigation.navigate('StudentDetails', { student: item });
      }}
    >
      <View style={styles.avatar}>
        <Ionicons name="person" size={28} color="#2196F3" />
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.detail}>Roll No: {item.roll_no || 'N/A'}</Text>
        <Text style={styles.detail}>
          Class: {item.classes?.class_name} {item.classes?.section}
        </Text>
        <Text style={styles.detail}>
          Parent: {item.users?.full_name || 'N/A'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#999" />
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="people" size={64} color="#ccc" />
      <Text style={styles.emptyText}>No students found</Text>
      <Text style={styles.emptySubtext}>
        This class doesn't have any students yet
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Students" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading students...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Header title="Students" showBack={true} />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#f44336" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Students" showBack={true} />
      
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Total Students: {students.length}</Text>
          <Text style={styles.headerSubtitle}>
            {className && section ? `Class: ${className} - Section ${section}` : `Class ID: ${classId}`}
          </Text>
        </View>
      </View>

      <FlatList
        data={students}
        renderItem={renderStudent}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.list}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  list: {
    padding: 16,
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
    padding: 40,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e3f2fd',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  detail: {
    fontSize: 13,
    color: '#666',
    marginBottom: 1,
  },
});

export default StudentList; 