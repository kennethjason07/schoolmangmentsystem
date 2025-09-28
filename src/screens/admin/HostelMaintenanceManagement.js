import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Picker,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';

const HostelMaintenanceManagement = ({ navigation, route }) => {
  const { hostel } = route.params;
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [issues, setIssues] = useState([]);
  
  // Modal states
  const [addIssueModalVisible, setAddIssueModalVisible] = useState(false);
  const [editIssueModalVisible, setEditIssueModalVisible] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState(null);
  
  // Form data
  const [issueData, setIssueData] = useState({
    title: '',
    description: '',
    issue_type: 'maintenance',
    priority: 'medium',
    location: '',
    estimated_cost: '',
    assigned_to: '',
    reporter_name: '',
    reporter_contact: ''
  });

  const issueTypes = [
    { value: 'electrical', label: 'Electrical' },
    { value: 'plumbing', label: 'Plumbing' },
    { value: 'furniture', label: 'Furniture' },
    { value: 'structural', label: 'Structural' },
    { value: 'cleaning', label: 'Cleaning' },
    { value: 'security', label: 'Security' },
    { value: 'internet', label: 'Internet/WiFi' },
    { value: 'other', label: 'Other' }
  ];

  const priorities = [
    { value: 'low', label: 'Low', color: '#4CAF50' },
    { value: 'medium', label: 'Medium', color: '#2196F3' },
    { value: 'high', label: 'High', color: '#FF9800' },
    { value: 'urgent', label: 'Urgent', color: '#F44336' }
  ];

  const statuses = [
    { value: 'reported', label: 'Reported', color: '#FF9800' },
    { value: 'assigned', label: 'Assigned', color: '#2196F3' },
    { value: 'in_progress', label: 'In Progress', color: '#9C27B0' },
    { value: 'completed', label: 'Completed', color: '#4CAF50' },
    { value: 'cancelled', label: 'Cancelled', color: '#F44336' }
  ];

  useEffect(() => {
    loadIssues();
  }, []);

  const loadIssues = () => {
    setLoading(true);
    // Mock data - replace with actual API call
    setTimeout(() => {
      const mockIssues = [
        {
          id: '1',
          title: 'AC not working in Room A101',
          description: 'The air conditioning unit in room A101 is not cooling properly. Students have complained about hot temperature.',
          issue_type: 'electrical',
          priority: 'high',
          status: 'reported',
          location: 'Room A101',
          estimated_cost: 2500,
          assigned_to: 'Electrician Team',
          reporter_name: 'Rahul Sharma',
          reporter_contact: '9876543210',
          reported_date: '2024-01-15',
          updated_date: '2024-01-15'
        },
        {
          id: '2',
          title: 'Leaking tap in bathroom',
          description: 'Water tap in the common bathroom on first floor is leaking continuously.',
          issue_type: 'plumbing',
          priority: 'medium',
          status: 'assigned',
          location: 'First Floor Bathroom',
          estimated_cost: 500,
          assigned_to: 'Plumber',
          reporter_name: 'Hostel Warden',
          reporter_contact: '9876543211',
          reported_date: '2024-01-14',
          updated_date: '2024-01-16'
        },
        {
          id: '3',
          title: 'Broken study table',
          description: 'Study table in room B201 has a broken leg and needs replacement.',
          issue_type: 'furniture',
          priority: 'low',
          status: 'in_progress',
          location: 'Room B201',
          estimated_cost: 800,
          assigned_to: 'Carpenter',
          reporter_name: 'Priya Patel',
          reporter_contact: '9876543212',
          reported_date: '2024-01-13',
          updated_date: '2024-01-17'
        }
      ];
      setIssues(mockIssues);
      setLoading(false);
    }, 1000);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadIssues();
    setRefreshing(false);
  };

  const resetForm = () => {
    setIssueData({
      title: '',
      description: '',
      issue_type: 'maintenance',
      priority: 'medium',
      location: '',
      estimated_cost: '',
      assigned_to: '',
      reporter_name: '',
      reporter_contact: ''
    });
  };

  const addIssue = () => {
    if (!issueData.title.trim() || !issueData.description.trim()) {
      Alert.alert('Error', 'Please fill in title and description');
      return;
    }

    const newIssue = {
      id: Date.now().toString(),
      title: issueData.title.trim(),
      description: issueData.description.trim(),
      issue_type: issueData.issue_type,
      priority: issueData.priority,
      status: 'reported',
      location: issueData.location.trim(),
      estimated_cost: issueData.estimated_cost ? parseInt(issueData.estimated_cost) : 0,
      assigned_to: issueData.assigned_to.trim(),
      reporter_name: issueData.reporter_name.trim(),
      reporter_contact: issueData.reporter_contact.trim(),
      reported_date: new Date().toISOString().split('T')[0],
      updated_date: new Date().toISOString().split('T')[0]
    };

    setIssues(prev => [...prev, newIssue]);
    setAddIssueModalVisible(false);
    resetForm();
    Alert.alert('Success', 'Maintenance issue reported successfully');
  };

  const updateIssueStatus = (issue, newStatus) => {
    const updatedIssue = {
      ...issue,
      status: newStatus,
      updated_date: new Date().toISOString().split('T')[0]
    };

    setIssues(prev => prev.map(i => i.id === issue.id ? updatedIssue : i));
    Alert.alert('Success', `Issue status updated to ${newStatus}`);
  };

  const deleteIssue = (issue) => {
    Alert.alert(
      'Delete Issue',
      `Are you sure you want to delete this maintenance issue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setIssues(prev => prev.filter(i => i.id !== issue.id));
            Alert.alert('Success', 'Issue deleted successfully');
          }
        }
      ]
    );
  };

  const getPriorityColor = (priority) => {
    const priorityObj = priorities.find(p => p.value === priority);
    return priorityObj ? priorityObj.color : '#666';
  };

  const getStatusColor = (status) => {
    const statusObj = statuses.find(s => s.value === status);
    return statusObj ? statusObj.color : '#666';
  };

  const getIssueTypeIcon = (type) => {
    switch (type) {
      case 'electrical': return 'flash';
      case 'plumbing': return 'water';
      case 'furniture': return 'bed';
      case 'structural': return 'home';
      case 'cleaning': return 'brush';
      case 'security': return 'shield';
      case 'internet': return 'wifi';
      default: return 'build';
    }
  };

  const renderIssueCard = (issue) => (
    <View key={issue.id} style={styles.issueCard}>
      <View style={styles.issueHeader}>
        <View style={styles.issueTypeContainer}>
          <Ionicons name={getIssueTypeIcon(issue.issue_type)} size={20} color="#2196F3" />
          <Text style={styles.issueTitle}>{issue.title}</Text>
        </View>
        <View style={styles.badgeContainer}>
          <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(issue.priority) }]}>
            <Text style={styles.badgeText}>{issue.priority}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(issue.status) }]}>
            <Text style={styles.badgeText}>{issue.status.replace('_', ' ')}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.issueDescription}>{issue.description}</Text>

      <View style={styles.issueDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="location" size={16} color="#666" />
          <Text style={styles.detailText}>Location: {issue.location || 'Not specified'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="cash" size={16} color="#4CAF50" />
          <Text style={styles.detailText}>Cost: ₹{issue.estimated_cost || 'Not estimated'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="person" size={16} color="#2196F3" />
          <Text style={styles.detailText}>Assigned: {issue.assigned_to || 'Not assigned'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="call" size={16} color="#FF9800" />
          <Text style={styles.detailText}>Reporter: {issue.reporter_name} ({issue.reporter_contact})</Text>
        </View>
      </View>

      <View style={styles.issueMeta}>
        <Text style={styles.dateText}>Reported: {new Date(issue.reported_date).toLocaleDateString()}</Text>
        <Text style={styles.dateText}>Updated: {new Date(issue.updated_date).toLocaleDateString()}</Text>
      </View>

      <View style={styles.issueActions}>
        {issue.status === 'reported' && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#2196F3' }]}
            onPress={() => updateIssueStatus(issue, 'assigned')}
          >
            <Ionicons name="person-add" size={16} color="#fff" />
            <Text style={styles.actionButtonText}>Assign</Text>
          </TouchableOpacity>
        )}
        
        {issue.status === 'assigned' && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#9C27B0' }]}
            onPress={() => updateIssueStatus(issue, 'in_progress')}
          >
            <Ionicons name="play" size={16} color="#fff" />
            <Text style={styles.actionButtonText}>Start Work</Text>
          </TouchableOpacity>
        )}
        
        {issue.status === 'in_progress' && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#4CAF50' }]}
            onPress={() => updateIssueStatus(issue, 'completed')}
          >
            <Ionicons name="checkmark" size={16} color="#fff" />
            <Text style={styles.actionButtonText}>Complete</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#FF9800' }]}
          onPress={() => {
            setSelectedIssue(issue);
            setIssueData({
              title: issue.title,
              description: issue.description,
              issue_type: issue.issue_type,
              priority: issue.priority,
              location: issue.location,
              estimated_cost: issue.estimated_cost?.toString() || '',
              assigned_to: issue.assigned_to,
              reporter_name: issue.reporter_name,
              reporter_contact: issue.reporter_contact
            });
            setEditIssueModalVisible(true);
          }}
        >
          <Ionicons name="create" size={16} color="#fff" />
          <Text style={styles.actionButtonText}>Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#F44336' }]}
          onPress={() => deleteIssue(issue)}
        >
          <Ionicons name="trash" size={16} color="#fff" />
          <Text style={styles.actionButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const IssueModal = ({ visible, onClose, onSubmit, title, isEdit = false }) => (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalContainer}>
        <ScrollView contentContainerStyle={styles.modalScrollContent}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{title}</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Issue Title *"
              value={issueData.title}
              onChangeText={(text) => setIssueData(prev => ({ ...prev, title: text }))}
            />
            
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Issue Description *"
              value={issueData.description}
              onChangeText={(text) => setIssueData(prev => ({ ...prev, description: text }))}
              multiline
              numberOfLines={4}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Location (e.g., Room A101, First Floor)"
              value={issueData.location}
              onChangeText={(text) => setIssueData(prev => ({ ...prev, location: text }))}
            />
            
            <View style={styles.pickerContainer}>
              <Text style={styles.pickerLabel}>Issue Type</Text>
              {issueTypes.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.pickerOption,
                    issueData.issue_type === type.value && styles.pickerOptionSelected
                  ]}
                  onPress={() => setIssueData(prev => ({ ...prev, issue_type: type.value }))}
                >
                  <Text style={[
                    styles.pickerOptionText,
                    issueData.issue_type === type.value && styles.pickerOptionTextSelected
                  ]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <View style={styles.pickerContainer}>
              <Text style={styles.pickerLabel}>Priority</Text>
              {priorities.map((priority) => (
                <TouchableOpacity
                  key={priority.value}
                  style={[
                    styles.pickerOption,
                    issueData.priority === priority.value && styles.pickerOptionSelected
                  ]}
                  onPress={() => setIssueData(prev => ({ ...prev, priority: priority.value }))}
                >
                  <Text style={[
                    styles.pickerOptionText,
                    issueData.priority === priority.value && styles.pickerOptionTextSelected
                  ]}>
                    {priority.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <TextInput
              style={styles.input}
              placeholder="Estimated Cost (optional)"
              value={issueData.estimated_cost}
              onChangeText={(text) => setIssueData(prev => ({ ...prev, estimated_cost: text }))}
              keyboardType="numeric"
            />
            
            <TextInput
              style={styles.input}
              placeholder="Assigned To (optional)"
              value={issueData.assigned_to}
              onChangeText={(text) => setIssueData(prev => ({ ...prev, assigned_to: text }))}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Reporter Name"
              value={issueData.reporter_name}
              onChangeText={(text) => setIssueData(prev => ({ ...prev, reporter_name: text }))}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Reporter Contact"
              value={issueData.reporter_contact}
              onChangeText={(text) => setIssueData(prev => ({ ...prev, reporter_contact: text }))}
              keyboardType="phone-pad"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#f0f0f0' }]}
                onPress={() => {
                  onClose();
                  resetForm();
                }}
              >
                <Text style={[styles.modalButtonText, { color: '#333' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#2196F3' }]}
                onPress={onSubmit}
              >
                <Text style={styles.modalButtonText}>{isEdit ? 'Update' : 'Report'} Issue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <Header
        title={`${hostel.name} - Maintenance`}
        onBackPress={() => navigation.goBack()}
        showBackButton={true}
      />

      <View style={styles.headerSection}>
        <View style={styles.titleContainer}>
          <Ionicons name="construct" size={28} color="#F44336" />
          <View style={styles.titleInfo}>
            <Text style={styles.mainTitle}>Maintenance Issues</Text>
            <Text style={styles.subtitle}>{hostel.name}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setAddIssueModalVisible(true)}
        >
          <Ionicons name="add" size={24} color="#fff" />
          <Text style={styles.addButtonText}>Report Issue</Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading maintenance issues...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {issues.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="construct-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No maintenance issues found</Text>
              <Text style={styles.emptySubtext}>Report your first maintenance issue</Text>
              <TouchableOpacity
                style={styles.emptyActionButton}
                onPress={() => setAddIssueModalVisible(true)}
              >
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.emptyActionButtonText}>Report Issue</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.issuesList}>
              {issues.map(renderIssueCard)}
            </View>
          )}
        </ScrollView>
      )}

      {/* Add Issue Modal */}
      <IssueModal
        visible={addIssueModalVisible}
        onClose={() => setAddIssueModalVisible(false)}
        onSubmit={addIssue}
        title="Report New Issue"
      />

      {/* Edit Issue Modal */}
      <IssueModal
        visible={editIssueModalVisible}
        onClose={() => {
          setEditIssueModalVisible(false);
          setSelectedIssue(null);
        }}
        onSubmit={() => {
          if (selectedIssue) {
            const updatedIssue = {
              ...selectedIssue,
              title: issueData.title.trim(),
              description: issueData.description.trim(),
              issue_type: issueData.issue_type,
              priority: issueData.priority,
              location: issueData.location.trim(),
              estimated_cost: issueData.estimated_cost ? parseInt(issueData.estimated_cost) : 0,
              assigned_to: issueData.assigned_to.trim(),
              reporter_name: issueData.reporter_name.trim(),
              reporter_contact: issueData.reporter_contact.trim(),
              updated_date: new Date().toISOString().split('T')[0]
            };
            setIssues(prev => prev.map(i => i.id === selectedIssue.id ? updatedIssue : i));
            setEditIssueModalVisible(false);
            setSelectedIssue(null);
            resetForm();
            Alert.alert('Success', 'Issue updated successfully');
          }
        }}
        title="Edit Issue"
        isEdit={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  titleInfo: {
    marginLeft: 12,
    flex: 1,
  },
  mainTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  addButton: {
    backgroundColor: '#F44336',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
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
  scrollView: {
    flex: 1,
  },
  issuesList: {
    padding: 16,
  },
  issueCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  issueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  issueTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  issueTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  badgeContainer: {
    alignItems: 'flex-end',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },
  issueDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
  issueDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  issueMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  dateText: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
  },
  issueActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
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
  emptyActionButton: {
    backgroundColor: '#F44336',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  emptyActionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 500,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    marginBottom: 16,
  },
  pickerLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
    marginBottom: 8,
  },
  pickerOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  pickerOptionSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  pickerOptionText: {
    fontSize: 14,
    color: '#666',
  },
  pickerOptionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default HostelMaintenanceManagement;