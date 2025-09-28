import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';

const ActionTile = ({ color, icon, title, subtitle, onPress }) => (
  <TouchableOpacity style={[styles.tile, { backgroundColor: color }]} onPress={onPress}>
    <View style={styles.tileIcon}>
      <Ionicons name={icon} size={22} color="#fff" />
    </View>
    <View style={styles.tileTextBox}>
      <Text style={styles.tileTitle}>{title}</Text>
      {subtitle ? <Text style={styles.tileSubtitle}>{subtitle}</Text> : null}
    </View>
    <Ionicons name="chevron-forward" size={20} color="#fff" />
  </TouchableOpacity>
);

const HostelTools = ({ navigation, route }) => {
  const hostels = route?.params?.hostels || [];
  const [hostelName, setHostelName] = useState('');
  const [hostelCapacity, setHostelCapacity] = useState('');

  const quickAddHostel = () => {
    if (!hostelName.trim() || !hostelCapacity.trim()) {
      Alert.alert('Error', 'Please provide hostel name and capacity');
      return;
    }
    Alert.alert('Success', `Hostel "${hostelName}" added (demo mode)`);
    setHostelName('');
    setHostelCapacity('');
  };

  return (
    <View style={styles.container}>
      <Header title="Hostel Tools" onBackPress={() => navigation.goBack()} showBack />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Quick Add */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quick Add Hostel</Text>
          <TextInput
            style={styles.input}
            placeholder="Hostel Name"
            value={hostelName}
            onChangeText={setHostelName}
          />
          <TextInput
            style={styles.input}
            placeholder="Capacity"
            value={hostelCapacity}
            onChangeText={setHostelCapacity}
            keyboardType="numeric"
          />
          <TouchableOpacity style={[styles.addButton, { backgroundColor: '#4CAF50' }]} onPress={quickAddHostel}>
            <Ionicons name="add-circle" size={18} color="#fff" />
            <Text style={styles.addButtonText}>Add Hostel</Text>
          </TouchableOpacity>
        </View>

        {/* Tools */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tools</Text>
          <View style={styles.tilesBox}>
            <ActionTile
              color="#4CAF50"
              icon="add-circle"
              title="Add Hostel"
              subtitle="Create a new hostel"
              onPress={() => Alert.alert('Info', 'Use the Quick Add above or go to Add Hostel in Management Tools.')}
            />
            <ActionTile
              color="#FF9800"
              icon="people"
              title="Manage Students"
              subtitle="Assign/deassign students"
              onPress={() => navigation.navigate('HostelStudentManagement')}
            />
            <ActionTile
              color="#2196F3"
              icon="document-text"
              title="Applications"
              subtitle="Review & update status"
              onPress={() => navigation.navigate('HostelApplications', { status: 'all' })}
            />
            <ActionTile
              color="#F44336"
              icon="construct"
              title="Maintenance"
              subtitle="Manage issues"
              onPress={() => navigation.navigate('HostelMaintenanceManagement', { hostel: hostels[0] || { name: 'All Hostels', id: 'all' } })}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#2c3e50', marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginTop: 6,
  },
  addButtonText: { color: '#fff', fontWeight: '700', marginLeft: 6 },
  tilesBox: { gap: 10 },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  tileIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  tileTextBox: { flex: 1, marginHorizontal: 10 },
  tileTitle: { color: '#fff', fontWeight: '800', fontSize: 14 },
  tileSubtitle: { color: '#eef3ff', marginTop: 2, fontSize: 12 },
});

export default HostelTools;
