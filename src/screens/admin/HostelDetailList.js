import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';

const HostelDetailList = ({ navigation, route }) => {
  const { type, title, data, icon, color } = route.params;

  const renderHostelItem = (hostel) => (
    <View key={hostel.id} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
          <Ionicons name="business" size={24} color={color} />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{hostel.name}</Text>
          <Text style={styles.cardDescription}>{hostel.description}</Text>
          <View style={styles.statsRow}>
            <Text style={styles.statText}>Capacity: {hostel.capacity}</Text>
            <Text style={styles.statText}>Occupied: {hostel.occupied}</Text>
            <Text style={styles.statText}>Available: {hostel.capacity - hostel.occupied}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: hostel.status === 'active' ? '#4CAF50' : '#FF9800' }]}>
          <Text style={styles.statusText}>{hostel.status}</Text>
        </View>
      </View>
      {hostel.contact_phone && (
        <View style={styles.contactRow}>
          <Ionicons name="call" size={16} color="#666" />
          <Text style={styles.contactText}>{hostel.contact_phone}</Text>
        </View>
      )}
    </View>
  );

  const renderApplicationItem = (application) => (
    <View key={application.id} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
          <Ionicons name="person" size={24} color={color} />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>
            {application.students?.first_name} {application.students?.last_name}
          </Text>
          <Text style={styles.cardDescription}>
            Class: {application.students?.class}-{application.students?.section}
          </Text>
          <Text style={styles.cardDescription}>
            Admission No: {application.students?.admission_no}
          </Text>
          <Text style={styles.dateText}>
            Applied: {new Date(application.application_date).toLocaleDateString()}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(application.status) }]}>
          <Text style={styles.statusText}>{application.status}</Text>
        </View>
      </View>
    </View>
  );

  const renderAllocationItem = (allocation) => (
    <View key={allocation.id} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
          <Ionicons name="bed" size={24} color={color} />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>
            {allocation.students?.first_name} {allocation.students?.last_name}
          </Text>
          <Text style={styles.cardDescription}>
            Class: {allocation.students?.class}-{allocation.students?.section}
          </Text>
          <Text style={styles.cardDescription}>
            {allocation.hostels?.name} - Room {allocation.hostel_rooms?.room_number}
          </Text>
          <Text style={styles.cardDescription}>
            {allocation.hostel_beds?.bed_number} - ₹{allocation.monthly_rent}/month
          </Text>
          <Text style={styles.dateText}>
            Allocated: {new Date(allocation.allocation_date).toLocaleDateString()}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderMaintenanceItem = (issue) => (
    <View key={issue.id} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
          <Ionicons name="construct" size={24} color={color} />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{issue.issue_type}</Text>
          <Text style={styles.cardDescription}>{issue.description}</Text>
          <Text style={styles.cardDescription}>
            Hostel: {issue.hostels?.name}
          </Text>
          <Text style={styles.cardDescription}>
            Cost: ₹{issue.estimated_cost}
          </Text>
          <Text style={styles.dateText}>
            Reported: {new Date(issue.reported_date).toLocaleDateString()}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getPriorityColor(issue.priority) }]}>
          <Text style={styles.statusText}>{issue.priority}</Text>
        </View>
      </View>
    </View>
  );

  const renderItem = (item) => {
    switch (type) {
      case 'hostels':
        return renderHostelItem(item);
      case 'applications':
        return renderApplicationItem(item);
      case 'allocations':
        return renderAllocationItem(item);
      case 'maintenance':
        return renderMaintenanceItem(item);
      default:
        return null;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#FF9800';
      case 'approved': return '#4CAF50';
      case 'rejected': return '#F44336';
      case 'waitlisted': return '#2196F3';
      default: return '#757575';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return '#F44336';
      case 'high': return '#FF9800';
      case 'medium': return '#2196F3';
      case 'low': return '#4CAF50';
      default: return '#757575';
    }
  };

  return (
    <View style={styles.container}>
      <Header 
        title={title}
        onBackPress={() => navigation.goBack()}
        showBackButton={true}
      />
      
      <View style={styles.headerSection}>
        <View style={styles.titleContainer}>
          <Ionicons name={icon} size={28} color={color} />
          <Text style={styles.mainTitle}>{title}</Text>
        </View>
        <Text style={styles.subtitle}>{data.length} items found</Text>
      </View>

      <ScrollView style={styles.scrollView}>
        {data.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name={icon} size={64} color="#ccc" />
            <Text style={styles.emptyText}>No items found</Text>
            <Text style={styles.emptySubtext}>There are no {title.toLowerCase()} to display</Text>
          </View>
        ) : (
          data.map(renderItem)
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  headerSection: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  dateText: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  statText: {
    fontSize: 12,
    color: '#555',
    fontWeight: '600',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  contactText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    padding: 48,
    marginTop: 64,
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

export default HostelDetailList;