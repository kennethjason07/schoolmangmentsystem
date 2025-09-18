import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';

const ExamsMarksTest = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);

  // Define individual load functions first
  const loadExams = useCallback(async () => {
    try {
      console.log('Loading exams...');
      // Simulate loading
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { success: true, data: ['Exam 1', 'Exam 2'] };
    } catch (error) {
      console.error('Error loading exams:', error);
      return { success: false, error };
    }
  }, []);

  const loadClasses = useCallback(async () => {
    try {
      console.log('Loading classes...');
      // Simulate loading
      await new Promise(resolve => setTimeout(resolve, 500));
      return { success: true, data: ['Class A', 'Class B'] };
    } catch (error) {
      console.error('Error loading classes:', error);
      return { success: false, error };
    }
  }, []);

  // Define loadAllData after individual load functions are defined
  const loadAllData = useCallback(async () => {
    console.log('Loading all data...');
    setLoading(true);
    
    try {
      const results = await Promise.all([
        loadExams(),
        loadClasses()
      ]);
      
      const allData = results.flatMap(result => result.data || []);
      setData(allData);
      console.log('All data loaded successfully');
      Alert.alert('Success', 'Data loaded successfully!');
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', `Failed to load data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [loadExams, loadClasses]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Exams & Marks Test</Text>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Exams & Marks Test</Text>
      <TouchableOpacity style={styles.button} onPress={loadAllData}>
        <Text style={styles.buttonText}>Load Data</Text>
      </TouchableOpacity>
      
      {data.length > 0 && (
        <View style={styles.dataContainer}>
          <Text style={styles.dataTitle}>Loaded Data:</Text>
          {data.map((item, index) => (
            <Text key={index} style={styles.dataItem}>{item}</Text>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  button: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    marginBottom: 20,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  dataContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: 'white',
    borderRadius: 5,
    minWidth: 200,
  },
  dataTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  dataItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
});

export default ExamsMarksTest;
