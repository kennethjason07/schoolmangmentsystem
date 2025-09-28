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
  const { type, title, data, icon, color, description, stats } = route.params;

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

  const renderCapacityItem = (hostel) => (
    <View key={hostel.id} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
          <Ionicons name="people" size={24} color={color} />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{hostel.name}</Text>
          <Text style={styles.cardDescription}>Capacity Analysis</Text>
          <View style={styles.capacityStats}>
            <View style={styles.capacityStat}>
              <Text style={styles.capacityLabel}>Total Capacity</Text>
              <Text style={styles.capacityValue}>{hostel.capacity}</Text>
            </View>
            <View style={styles.capacityStat}>
              <Text style={styles.capacityLabel}>Occupied</Text>
              <Text style={[styles.capacityValue, { color: '#FF9800' }]}>{hostel.occupied}</Text>
            </View>
            <View style={styles.capacityStat}>
              <Text style={styles.capacityLabel}>Available</Text>
              <Text style={[styles.capacityValue, { color: '#4CAF50' }]}>{hostel.availableSpace}</Text>
            </View>
          </View>
          <View style={styles.utilizationContainer}>
            <Text style={styles.utilizationLabel}>Utilization Rate</Text>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    width: `${hostel.utilizationRate}%`, 
                    backgroundColor: parseFloat(hostel.utilizationRate) > 85 ? '#F44336' : 
                                   parseFloat(hostel.utilizationRate) > 70 ? '#FF9800' : '#4CAF50'
                  }
                ]} 
              />
            </View>
            <Text style={styles.utilizationText}>{hostel.utilizationRate}%</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderOccupiedItem = (allocation) => (
    <View key={allocation.id} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
          <Ionicons name="bed" size={24} color={color} />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{allocation.studentInfo}</Text>
          <Text style={styles.cardDescription}>
            Class: {allocation.students?.class}-{allocation.students?.section}
          </Text>
          <Text style={styles.cardDescription}>
            Location: {allocation.locationInfo}
          </Text>
          <Text style={styles.cardDescription}>
            Bed: {allocation.bedInfo}
          </Text>
          <Text style={styles.cardDescription}>
            Monthly Rent: ₹{allocation.monthly_rent}
          </Text>
          <Text style={styles.dateText}>
            Occupied Since: {new Date(allocation.occupancyDate).toLocaleDateString()}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: '#FF9800' }]}>
          <Text style={styles.statusText}>Occupied</Text>
        </View>
      </View>
    </View>
  );

  const renderAvailableItem = (hostel) => (
    <View key={hostel.id} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
          <Ionicons name="home" size={24} color={color} />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{hostel.name}</Text>
          <Text style={styles.cardDescription}>Available Space Analysis</Text>
          <View style={styles.availabilityStats}>
            <View style={styles.availabilityStat}>
              <Text style={styles.availabilityLabel}>Available Beds</Text>
              <Text style={[styles.availabilityValue, { color: '#4CAF50' }]}>{hostel.availableBeds}</Text>
            </View>
            <View style={styles.availabilityStat}>
              <Text style={styles.availabilityLabel}>Total Capacity</Text>
              <Text style={styles.availabilityValue}>{hostel.capacity}</Text>
            </View>
            <View style={styles.availabilityStat}>
              <Text style={styles.availabilityLabel}>Availability Rate</Text>
              <Text style={[styles.availabilityValue, { color: '#9C27B0' }]}>{hostel.availabilityRate}%</Text>
            </View>
          </View>
          <View style={styles.statusContainer}>
            <Text style={styles.statusLabel}>Status: </Text>
            <Text style={[
              styles.statusValue,
              { color: hostel.availableBeds > 10 ? '#4CAF50' : 
                       hostel.availableBeds > 5 ? '#FF9800' : '#F44336' }
            ]}>
              {hostel.availableBeds > 10 ? 'High Availability' : 
               hostel.availableBeds > 5 ? 'Medium Availability' : 'Limited Availability'}
            </Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: '#4CAF50' }]}>
          <Text style={styles.statusText}>Available</Text>
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
      case 'capacity':
        return renderCapacityItem(item);
      case 'occupied':
        return renderOccupiedItem(item);
      case 'available':
        return renderAvailableItem(item);
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
        <Text style={styles.subtitle}>{description || `${data.length} items found`}</Text>
        
        {/* Stats Summary */}
        {stats && (
          <View style={styles.statsContainer}>
            {type === 'capacity' && (
              <View style={styles.statsSummary}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Total Capacity</Text>
                  <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>{stats.totalCapacity}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Occupied</Text>
                  <Text style={[styles.summaryValue, { color: '#FF9800' }]}>{stats.totalOccupied}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Available</Text>
                  <Text style={[styles.summaryValue, { color: '#9C27B0' }]}>{stats.totalAvailable}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Utilization</Text>
                  <Text style={[styles.summaryValue, { color }]}>{stats.utilizationRate}%</Text>
                </View>
              </View>
            )}
            
            {type === 'occupied' && (
              <View style={styles.statsSummary}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Occupied Beds</Text>
                  <Text style={[styles.summaryValue, { color }]}>{stats.totalOccupied}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Occupancy Rate</Text>
                  <Text style={[styles.summaryValue, { color }]}>{stats.occupancyRate}%</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Monthly Revenue</Text>
                  <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>₹{stats.totalRevenue}</Text>
                </View>
              </View>
            )}
            
            {type === 'available' && (
              <View style={styles.statsSummary}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Available Beds</Text>
                  <Text style={[styles.summaryValue, { color }]}>{stats.totalAvailable}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Availability Rate</Text>
                  <Text style={[styles.summaryValue, { color }]}>{stats.availabilityRate}%</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Hostels Available</Text>
                  <Text style={[styles.summaryValue, { color }]}>{stats.hostelsWithAvailability}</Text>
                </View>
              </View>
            )}
            
            {type === 'hostels' && (
              <View style={styles.statsSummary}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Total Hostels</Text>
                  <Text style={[styles.summaryValue, { color }]}>{stats.total}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Active Hostels</Text>
                  <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>{stats.active}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Total Capacity</Text>
                  <Text style={[styles.summaryValue, { color }]}>{stats.totalCapacity}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Total Occupied</Text>
                  <Text style={[styles.summaryValue, { color: '#FF9800' }]}>{stats.totalOccupied}</Text>
                </View>
              </View>
            )}
          </View>
        )}
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
  // New styles for enhanced views
  statsContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  statsSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
    minWidth: '22%',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  // Capacity-specific styles
  capacityStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 12,
  },
  capacityStat: {
    alignItems: 'center',
    flex: 1,
  },
  capacityLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  capacityValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  utilizationContainer: {
    marginTop: 12,
  },
  utilizationLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  utilizationText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '600',
    textAlign: 'right',
  },
  // Availability-specific styles
  availabilityStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 12,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  availabilityStat: {
    alignItems: 'center',
    flex: 1,
  },
  availabilityLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
    textAlign: 'center',
  },
  availabilityValue: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  statusLabel: {
    fontSize: 12,
    color: '#666',
  },
  statusValue: {
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default HostelDetailList;