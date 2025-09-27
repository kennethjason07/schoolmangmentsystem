import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import HostelService from '../../services/HostelService';
import { useAuth } from '../../utils/AuthContext';

const HostelApplications = ({ navigation, route }) => {
  const { user, tenantId } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(route?.params?.status || 'all');
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [processing, setProcessing] = useState(false);

  const statusOptions = [
    { key: 'all', label: 'All Applications' },
    { key: 'submitted', label: 'Submitted' },
    { key: 'verified', label: 'Verified' },
    { key: 'accepted', label: 'Accepted' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'waitlisted', label: 'Waitlisted' }
  ];

  useEffect(() => {
    if (tenantId) {
      HostelService.setTenantId(tenantId);
    }
  }, [tenantId]);

  const loadApplications = async () => {
    try {
      const filters = selectedStatus === 'all' ? {} : { status: selectedStatus };
      const result = await HostelService.getApplications(filters);
      
      if (result.success) {
        setApplications(result.data);
      } else {
        Alert.alert('Error', result.error || 'Failed to load applications');
      }
    } catch (error) {
      console.error('Error loading applications:', error);
      Alert.alert('Error', 'Failed to load applications. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadApplications();
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadApplications();
    }, [selectedStatus])
  );

  const handleStatusChange = (application, newStatus) => {
    setSelectedApplication(application);
    setRemarks('');
    setActionModalVisible(true);
  };

  const processStatusUpdate = async (newStatus) => {
    if (!selectedApplication) return;
    
    setProcessing(true);
    try {
      const result = await HostelService.updateApplicationStatus(
        selectedApplication.id,
        newStatus,
        user.id,
        remarks.trim() || null
      );

      if (result.success) {
        setActionModalVisible(false);
        setRemarks('');
        await loadApplications();
        Alert.alert('Success', `Application ${newStatus} successfully`);
      } else {
        Alert.alert('Error', result.error || `Failed to ${newStatus} application`);
      }
    } catch (error) {
      console.error('Error updating application:', error);
      Alert.alert('Error', 'Failed to update application status');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'submitted': return '#FF9800';
      case 'verified': return '#2196F3';
      case 'accepted': return '#4CAF50';
      case 'rejected': return '#F44336';
      case 'waitlisted': return '#9C27B0';
      default: return '#666';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'submitted': return 'description';
      case 'verified': return 'verified';
      case 'accepted': return 'check-circle';
      case 'rejected': return 'cancel';
      case 'waitlisted': return 'schedule';
      default: return 'help';
    }
  };

  const renderApplication = ({ item }) => (
    <TouchableOpacity 
      style={styles.applicationCard}
      onPress={() => navigation.navigate('ApplicationDetails', { applicationId: item.id })}
    >
      <View style={styles.applicationHeader}>
        <View style={styles.studentInfo}>
          <Text style={styles.studentName}>{item.student.name}</Text>
          <Text style={styles.studentNumber}>ID: {item.student.student_number}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <MaterialIcons 
            name={getStatusIcon(item.status)} 
            size={16} 
            color={getStatusColor(item.status)} 
          />
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
      </View>

      <View style={styles.applicationDetails}>
        <View style={styles.detailRow}>
          <MaterialIcons name="hotel" size={16} color="#666" />
          <Text style={styles.detailText}>{item.hostel.name}</Text>
        </View>
        <View style={styles.detailRow}>
          <MaterialIcons name="room" size={16} color="#666" />
          <Text style={styles.detailText}>
            {item.preferred_room_type} • {item.hostel.hostel_type}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <MaterialIcons name="event" size={16} color="#666" />
          <Text style={styles.detailText}>
            Applied: {new Date(item.applied_at).toLocaleDateString()}
          </Text>
        </View>
        {item.special_requirements && (
          <View style={styles.detailRow}>
            <MaterialIcons name="note" size={16} color="#666" />
            <Text style={styles.detailText} numberOfLines={2}>
              {item.special_requirements}
            </Text>
          </View>
        )}
      </View>

      {/* Action buttons based on status */}
      <View style={styles.actionButtons}>
        {item.status === 'submitted' && (
          <>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: '#4CAF50' }]}
              onPress={() => handleStatusChange(item, 'verified')}
            >
              <MaterialIcons name="verified" size={16} color="#fff" />
              <Text style={styles.actionButtonText}>Verify</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: '#F44336' }]}
              onPress={() => handleStatusChange(item, 'rejected')}
            >
              <MaterialIcons name="cancel" size={16} color="#fff" />
              <Text style={styles.actionButtonText}>Reject</Text>
            </TouchableOpacity>
          </>
        )}
        {item.status === 'verified' && (
          <>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: '#4CAF50' }]}
              onPress={() => handleStatusChange(item, 'accepted')}
            >
              <MaterialIcons name="check-circle" size={16} color="#fff" />
              <Text style={styles.actionButtonText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: '#9C27B0' }]}
              onPress={() => handleStatusChange(item, 'waitlisted')}
            >
              <MaterialIcons name="schedule" size={16} color="#fff" />
              <Text style={styles.actionButtonText}>Waitlist</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: '#F44336' }]}
              onPress={() => handleStatusChange(item, 'rejected')}
            >
              <MaterialIcons name="cancel" size={16} color="#fff" />
              <Text style={styles.actionButtonText}>Reject</Text>
            </TouchableOpacity>
          </>
        )}
        {item.status === 'accepted' && (
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: '#2196F3' }]}
            onPress={() => navigation.navigate('BedAllocation', { applicationId: item.id })}
          >
            <MaterialIcons name="hotel" size={16} color="#fff" />
            <Text style={styles.actionButtonText}>Allocate Bed</Text>
          </TouchableOpacity>
        )}
      </View>

      {item.remarks && (
        <View style={styles.remarksSection}>
          <Text style={styles.remarksLabel}>Remarks:</Text>
          <Text style={styles.remarksText}>{item.remarks}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const StatusFilterTab = ({ status, label, count }) => (
    <TouchableOpacity
      style={[
        styles.filterTab,
        selectedStatus === status && styles.activeFilterTab
      ]}
      onPress={() => setSelectedStatus(status)}
    >
      <Text style={[
        styles.filterTabText,
        selectedStatus === status && styles.activeFilterTabText
      ]}>
        {label}
      </Text>
      {count !== undefined && (
        <View style={[
          styles.countBadge,
          selectedStatus === status && styles.activeCountBadge
        ]}>
          <Text style={[
            styles.countBadgeText,
            selectedStatus === status && styles.activeCountBadgeText
          ]}>
            {count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  // Calculate counts for each status
  const statusCounts = statusOptions.reduce((acc, option) => {
    if (option.key === 'all') {
      acc[option.key] = applications.length;
    } else {
      acc[option.key] = applications.filter(app => app.status === option.key).length;
    }
    return acc;
  }, {});

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading Applications...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Hostel Applications</Text>
        <TouchableOpacity onPress={onRefresh}>
          <MaterialIcons name="refresh" size={24} color="#2196F3" />
        </TouchableOpacity>
      </View>

      {/* Status Filter Tabs */}
      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={statusOptions}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => (
            <StatusFilterTab
              status={item.key}
              label={item.label}
              count={statusCounts[item.key]}
            />
          )}
          contentContainerStyle={styles.filterTabsContainer}
        />
      </View>

      {/* Applications List */}
      <FlatList
        data={applications}
        keyExtractor={(item) => item.id}
        renderItem={renderApplication}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="assignment" size={64} color="#ccc" />
            <Text style={styles.emptyText}>
              No {selectedStatus === 'all' ? '' : selectedStatus} applications found
            </Text>
          </View>
        )}
      />

      {/* Action Modal */}
      <Modal
        visible={actionModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setActionModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {selectedApplication && 
                `Update Application - ${selectedApplication.student.name}`
              }
            </Text>
            
            <TextInput
              style={styles.remarksInput}
              placeholder="Add remarks (optional)"
              value={remarks}
              onChangeText={setRemarks}
              multiline
              numberOfLines={4}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setActionModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={() => {
                  // Determine the new status based on current context
                  const currentStatus = selectedApplication?.status;
                  let newStatus = 'verified'; // default
                  
                  if (currentStatus === 'submitted') {
                    // Will be set based on button pressed
                  }
                  
                  processStatusUpdate(newStatus);
                }}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmButtonText}>Update</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  filterContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterTabsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  activeFilterTab: {
    backgroundColor: '#2196F3',
  },
  filterTabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeFilterTabText: {
    color: '#fff',
  },
  countBadge: {
    backgroundColor: '#666',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  activeCountBadge: {
    backgroundColor: '#fff',
  },
  countBadgeText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: 'bold',
  },
  activeCountBadgeText: {
    color: '#2196F3',
  },
  listContainer: {
    padding: 16,
  },
  applicationCard: {
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
  applicationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  studentNumber: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginLeft: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  applicationDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  remarksSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  remarksLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 4,
  },
  remarksText: {
    fontSize: 14,
    color: '#333',
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  remarksInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  confirmButton: {
    backgroundColor: '#2196F3',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default HostelApplications;