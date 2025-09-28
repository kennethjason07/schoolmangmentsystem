import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';

const InfoRow = ({ icon, label, value }) => (
  <View style={styles.infoRow}>
    <Ionicons name={icon} size={18} color="#666" />
    <Text style={styles.infoLabel}>{label}:</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const ActionButton = ({ color, icon, label, onPress }) => (
  <TouchableOpacity style={[styles.actionButton, { backgroundColor: color }]} onPress={onPress}>
    <Ionicons name={icon} size={18} color="#fff" />
    <Text style={styles.actionText}>{label}</Text>
  </TouchableOpacity>
);

const HostelQuickActions = ({ navigation, route }) => {
  const hostel = route?.params?.hostel;
  if (!hostel) {
    return (
      <View style={styles.container}>
        <Header title="Hostel" onBackPress={() => navigation.goBack()} showBack />
        <View style={styles.body}><Text>Hostel not found.</Text></View>
      </View>
    );
  }

  const capacity = Number(hostel.capacity || 0);
  const occupied = Number(hostel.occupied || 0);
  const available = Math.max(0, capacity - occupied);

  return (
    <View style={styles.container}>
      <Header title={hostel.name} onBackPress={() => navigation.goBack()} showBack />
      <View style={styles.body}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Overview</Text>
          <InfoRow icon="information-circle" label="Status" value={hostel.status || 'active'} />
          <InfoRow icon="people" label="Capacity" value={String(capacity)} />
          <InfoRow icon="bed" label="Occupied" value={String(occupied)} />
          <InfoRow icon="home" label="Available" value={String(available)} />
          {hostel.description ? (
            <View style={styles.descBox}>
              <Text style={styles.descText}>{hostel.description}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.actionsCard}>
          <Text style={styles.cardTitle}>Quick Actions</Text>
          <View style={styles.actionsRow}>
            <ActionButton
              color="#2196F3"
              icon="bed"
              label="Manage Rooms"
              onPress={() => navigation.navigate('HostelRoomManagement', { hostel })}
            />
            <ActionButton
              color="#4CAF50"
              icon="eye"
              label="View Details"
              onPress={() => navigation.navigate('HostelDetailView', { hostel })}
            />
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  body: { padding: 16 },
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
  actionsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#2c3e50', marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  infoLabel: { marginLeft: 6, color: '#666', fontSize: 14, width: 90 },
  infoValue: { color: '#333', fontSize: 14, flex: 1 },
  descBox: { marginTop: 8, padding: 10, backgroundColor: '#f5f7fa', borderRadius: 8 },
  descText: { color: '#555' },
  actionsRow: { flexDirection: 'row', gap: 12 },
  actionButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10 },
  actionText: { color: '#fff', fontWeight: '700', marginLeft: 6 },
});

export default HostelQuickActions;
