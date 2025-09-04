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
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTenant } from '../../contexts/TenantContext';
import { useAuth } from '../../utils/AuthContext';
import { supabase } from '../../utils/supabase';

const TenantManagement = ({ navigation }) => {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    subdomain: '',
    contact_email: '',
    contact_phone: '',
    subscription_plan: 'basic',
    max_students: 500,
    max_teachers: 50,
    max_classes: 20,
    status: 'active'
  });

  const { user, userType } = useAuth();
  const tenantContext = useTenant();

  useEffect(() => {
    // Only super admin can access tenant management
    if (userType !== 'admin') {
      Alert.alert('Access Denied', 'You need super admin privileges to access tenant management.');
      navigation.goBack();
      return;
    }
    
    loadTenants();
  }, [userType]);

  const loadTenants = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get additional stats for each tenant
      const tenantsWithStats = await Promise.all(
        data.map(async (tenant) => {
          const [studentsCount, teachersCount, classesCount] = await Promise.all([
            getTenantResourceCount(tenant.id, 'students'),
            getTenantResourceCount(tenant.id, 'teachers'),
            getTenantResourceCount(tenant.id, 'classes')
          ]);

          return {
            ...tenant,
            stats: {
              students: studentsCount,
              teachers: teachersCount,
              classes: classesCount
            }
          };
        })
      );

      setTenants(tenantsWithStats);
    } catch (error) {
      console.error('Error loading tenants:', error);
      Alert.alert('Error', 'Failed to load tenants');
    } finally {
      setLoading(false);
    }
  };

  const getTenantResourceCount = async (tenantId, resourceType) => {
    try {
      const tableName = resourceType;
      const { count, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error(`Error counting ${resourceType}:`, error);
      return 0;
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTenants();
    setRefreshing(false);
  };

  const openModal = (tenant = null) => {
    setEditingTenant(tenant);
    if (tenant) {
      setFormData({
        name: tenant.name,
        subdomain: tenant.subdomain,
        contact_email: tenant.contact_email || '',
        contact_phone: tenant.contact_phone || '',
        subscription_plan: tenant.subscription_plan,
        max_students: tenant.max_students,
        max_teachers: tenant.max_teachers,
        max_classes: tenant.max_classes,
        status: tenant.status
      });
    } else {
      setFormData({
        name: '',
        subdomain: '',
        contact_email: '',
        contact_phone: '',
        subscription_plan: 'basic',
        max_students: 500,
        max_teachers: 50,
        max_classes: 20,
        status: 'active'
      });
    }
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingTenant(null);
  };

  const saveTenant = async () => {
    try {
      if (!formData.name.trim() || !formData.subdomain.trim()) {
        Alert.alert('Error', 'Tenant name and subdomain are required');
        return;
      }

      setLoading(true);

      if (editingTenant) {
        // Update existing tenant
        const { error } = await tenantContext.updateTenant(formData);
        if (error) throw error;
        Alert.alert('Success', 'Tenant updated successfully');
      } else {
        // Create new tenant
        await tenantContext.createTenant(formData);
        Alert.alert('Success', 'Tenant created successfully');
      }

      closeModal();
      await loadTenants();
    } catch (error) {
      console.error('Error saving tenant:', error);
      Alert.alert('Error', error.message || 'Failed to save tenant');
    } finally {
      setLoading(false);
    }
  };

  const deleteTenant = (tenant) => {
    Alert.alert(
      'Delete Tenant',
      `Are you sure you want to delete "${tenant.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              
              // In a real app, you'd want to check if tenant has data first
              const { error } = await supabase
                .from('tenants')
                .delete()
                .eq('id', tenant.id);

              if (error) throw error;

              Alert.alert('Success', 'Tenant deleted successfully');
              await loadTenants();
            } catch (error) {
              console.error('Error deleting tenant:', error);
              Alert.alert('Error', 'Failed to delete tenant');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const switchToTenant = async (tenant) => {
    try {
      await tenantContext.switchTenant(tenant.id);
      Alert.alert('Success', `Switched to ${tenant.name}`);
      navigation.navigate('AdminDashboard');
    } catch (error) {
      console.error('Error switching tenant:', error);
      Alert.alert('Error', 'Failed to switch tenant');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#4CAF50';
      case 'suspended': return '#FF9800';
      case 'inactive': return '#F44336';
      default: return '#757575';
    }
  };

  const getSubscriptionColor = (plan) => {
    switch (plan) {
      case 'basic': return '#2196F3';
      case 'standard': return '#4CAF50';
      case 'premium': return '#FF9800';
      case 'enterprise': return '#9C27B0';
      default: return '#757575';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading tenants...</Text>
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
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Tenant Management</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => openModal()}
        >
          <Ionicons name="add" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.scrollWrapper}>
        <ScrollView 
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={Platform.OS === 'web'}
          keyboardShouldPersistTaps="handled"
          bounces={Platform.OS !== 'web'}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
        {tenants.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="business-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No tenants found</Text>
            <Text style={styles.emptySubtext}>Create your first tenant to get started</Text>
          </View>
        ) : (
          tenants.map((tenant) => (
            <View key={tenant.id} style={styles.tenantCard}>
              <View style={styles.tenantHeader}>
                <View style={styles.tenantInfo}>
                  <Text style={styles.tenantName}>{tenant.name}</Text>
                  <Text style={styles.tenantSubdomain}>@{tenant.subdomain}</Text>
                </View>
                <View style={styles.statusContainer}>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(tenant.status) }]}>
                    <Text style={styles.statusText}>{tenant.status.toUpperCase()}</Text>
                  </View>
                  <View style={[styles.planBadge, { backgroundColor: getSubscriptionColor(tenant.subscription_plan) }]}>
                    <Text style={styles.planText}>{tenant.subscription_plan.toUpperCase()}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{tenant.stats.students}</Text>
                  <Text style={styles.statLabel}>Students</Text>
                  <Text style={styles.statLimit}>/ {tenant.max_students}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{tenant.stats.teachers}</Text>
                  <Text style={styles.statLabel}>Teachers</Text>
                  <Text style={styles.statLimit}>/ {tenant.max_teachers}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{tenant.stats.classes}</Text>
                  <Text style={styles.statLabel}>Classes</Text>
                  <Text style={styles.statLimit}>/ {tenant.max_classes}</Text>
                </View>
              </View>

              {tenant.contact_email && (
                <Text style={styles.contactInfo}>
                  <Ionicons name="mail-outline" size={14} /> {tenant.contact_email}
                </Text>
              )}

              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.switchButton]}
                  onPress={() => switchToTenant(tenant)}
                >
                  <Ionicons name="enter-outline" size={16} color="#fff" />
                  <Text style={styles.switchButtonText}>Switch</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionButton, styles.editButton]}
                  onPress={() => openModal(tenant)}
                >
                  <Ionicons name="pencil-outline" size={16} color="#007AFF" />
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={() => deleteTenant(tenant)}
                >
                  <Ionicons name="trash-outline" size={16} color="#F44336" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
        </ScrollView>
      </View>

      {/* Create/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingTenant ? 'Edit Tenant' : 'Create New Tenant'}
              </Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Tenant Name *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  placeholder="Enter tenant name"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Subdomain *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.subdomain}
                  onChangeText={(text) => setFormData({ ...formData, subdomain: text.toLowerCase() })}
                  placeholder="Enter subdomain"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Contact Email</Text>
                <TextInput
                  style={styles.input}
                  value={formData.contact_email}
                  onChangeText={(text) => setFormData({ ...formData, contact_email: text })}
                  placeholder="Enter contact email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Contact Phone</Text>
                <TextInput
                  style={styles.input}
                  value={formData.contact_phone}
                  onChangeText={(text) => setFormData({ ...formData, contact_phone: text })}
                  placeholder="Enter contact phone"
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Max Students</Text>
                <TextInput
                  style={styles.input}
                  value={formData.max_students.toString()}
                  onChangeText={(text) => setFormData({ ...formData, max_students: parseInt(text) || 0 })}
                  placeholder="Maximum students allowed"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Max Teachers</Text>
                <TextInput
                  style={styles.input}
                  value={formData.max_teachers.toString()}
                  onChangeText={(text) => setFormData({ ...formData, max_teachers: parseInt(text) || 0 })}
                  placeholder="Maximum teachers allowed"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Max Classes</Text>
                <TextInput
                  style={styles.input}
                  value={formData.max_classes.toString()}
                  onChangeText={(text) => setFormData({ ...formData, max_classes: parseInt(text) || 0 })}
                  placeholder="Maximum classes allowed"
                  keyboardType="numeric"
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={closeModal}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={saveTenant}
              >
                <Text style={styles.saveButtonText}>
                  {editingTenant ? 'Update' : 'Create'}
                </Text>
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
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    padding: 5,
  },
  // Enhanced scroll wrapper styles for web compatibility
  scrollWrapper: {
    flex: 1,
    ...Platform.select({
      web: {
        height: 'calc(100vh - 160px)',
        maxHeight: 'calc(100vh - 160px)',
        minHeight: 400,
        overflow: 'hidden',
      },
    }),
  },
  scrollContainer: {
    flex: 1,
    ...Platform.select({
      web: {
        overflowY: 'auto'
      }
    })
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    ...Platform.select({
      web: {
        paddingBottom: 40,
      },
    }),
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 5,
  },
  tenantCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tenantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  tenantInfo: {
    flex: 1,
  },
  tenantName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  tenantSubdomain: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 5,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  planBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  planText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  statLimit: {
    fontSize: 10,
    color: '#999',
  },
  contactInfo: {
    fontSize: 12,
    color: '#666',
    marginBottom: 15,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginLeft: 10,
  },
  switchButton: {
    backgroundColor: '#007AFF',
  },
  switchButtonText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
  },
  editButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  deleteButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#F44336',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 10,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 6,
    marginLeft: 10,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default TenantManagement;
