import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import HostelStatCard from '../../components/HostelStatCard';

const HostelsOverview = ({ navigation, route }) => {
  const hostels = (route?.params?.hostels || route?.params?.data || []).map(h => ({
    ...h,
    type: (h.type || h.hostel_type || 'mixed')?.toString().toLowerCase(),
  }));
  const hideSummary = route?.params?.hideSummary === true;

  const initialFilterRaw = (route?.params?.typeFilter || 'all').toString().toLowerCase();
  const initialFilter = ['all','boys','girls','mixed'].includes(initialFilterRaw) ? initialFilterRaw : 'all';
  const [typeFilter, setTypeFilter] = useState(initialFilter); // 'all' | 'boys' | 'girls' | 'mixed'

  const filteredHostels = useMemo(() => (
    typeFilter === 'all' ? hostels : hostels.filter(h => (h.type || 'mixed') === typeFilter)
  ), [typeFilter, hostels]);

  const totals = filteredHostels.reduce(
    (acc, h) => {
      const capacity = Number(h.capacity || 0);
      const occupied = Number(h.occupied || 0);
      acc.totalHostels += 1;
      acc.totalCapacity += capacity;
      acc.totalOccupied += occupied;
      return acc;
    },
    { totalHostels: 0, totalCapacity: 0, totalOccupied: 0 }
  );
  const totalAvailable = Math.max(0, totals.totalCapacity - totals.totalOccupied);
  const utilization = totals.totalCapacity > 0 ? Math.round((totals.totalOccupied / totals.totalCapacity) * 100) : 0;

  return (
    <View style={styles.container}>
      <Header
        title="Hostels Overview"
        onBackPress={() => navigation.goBack()}
        showBack={true}
      />

      <ScrollView contentContainerStyle={styles.content}>

        {/* Filter chips */}
        <View style={styles.filterRow}>
          {['all','boys','girls','mixed'].map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.filterChip, typeFilter === t && styles.filterChipActive]}
              onPress={() => setTypeFilter(t)}
            >
              <Text style={[styles.filterChipText, typeFilter === t && styles.filterChipTextActive]}>
                {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Top summary stat cards */}
        {!hideSummary && (
          <View style={styles.grid}>
            <HostelStatCard
              title="Total Hostels"
              value={String(totals.totalHostels)}
              icon="business"
              color="#2196F3"
              subtitle="Active hostels"
              animated={true}
              onPress={() => {
                // Navigate to list view of all hostels
                navigation.navigate('HostelDetailList', {
                  type: 'hostels',
                  title: 'All Hostels',
                  data: hostels,
                  icon: 'business',
                  color: '#2196F3',
                  description: 'View and manage all hostels',
                });
              }}
            />

            <HostelStatCard
              title="Total Capacity"
              value={String(totals.totalCapacity)}
              icon="people"
              color="#4CAF50"
              subtitle="Beds across all hostels"
              animated={true}
            />

            <HostelStatCard
              title="Occupied"
              value={String(totals.totalOccupied)}
              icon="bed"
              color="#FF9800"
              subtitle={`${utilization}% utilization`
              }
              animated={true}
              maxValue={totals.totalCapacity || 0}
            />

            <HostelStatCard
              title="Available"
              value={String(totalAvailable)}
              icon="home"
              color="#9C27B0"
              subtitle="Beds available"
              animated={true}
              maxValue={totals.totalCapacity || 0}
            />
          </View>
        )}

        {/* Per-hostel stat cards */}
        <Text style={styles.sectionTitle}>Per Hostel</Text>
        <View style={styles.grid}>
          {filteredHostels.map((h) => {
            const capacity = Number(h.capacity || 0);
            const occupied = Number(h.occupied || 0);
            const available = Math.max(0, capacity - occupied);
            const utilization = capacity > 0 ? Math.round((occupied / capacity) * 100) : 0;
            return (
              <View key={h.id}>
                <HostelStatCard
                  title={h.name}
                  value={String(capacity)}
                  icon="business"
                  color="#2196F3"
                  subtitle={`Occupied ${occupied} • Available ${available}`}
                  animated={true}
                  maxValue={capacity}
                  progress={utilization}
                  onPress={() => navigation.navigate('HostelDetailView', { hostel: h })}
                  quickActions={[
                    {
                      label: 'Manage Rooms',
                      icon: 'bed',
                      color: '#2196F3',
                      onPress: () => navigation.navigate('HostelRoomManagement', { hostel: h }),
                    },
                  ]}
                />
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  grid: {
    gap: 12,
    marginBottom: 20,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  topActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  filterChipActive: {
    backgroundColor: '#2196F3',
  },
  filterChipText: {
    color: '#333',
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  quickActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  quickActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2c3e50',
    marginTop: 8,
    marginBottom: 8,
  },
});

export default HostelsOverview;
