import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';
import { useTenant } from '../contexts/TenantContext';
import { useAuth } from '../utils/AuthContext';

const TenantDebugger = () => {
  const { tenantId, currentTenant } = useTenant();
  const { user } = useAuth();
  const [debugInfo, setDebugInfo] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  const runDiagnosis = async () => {
    try {
      console.log('🔍 Running tenant diagnosis...');
      
      // Get current user info
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      // Get user record from database
      const { data: userRecord } = await supabase
        .from('users')
        .select('id, email, tenant_id, full_name')
        .eq('id', authUser?.id)
        .single();
      
      // Get all tenants
      const { data: allTenants } = await supabase
        .from('tenants')
        .select('id, name, subdomain, status')
        .eq('status', 'active');
      
      // Check data distribution across tenants
      const tenantDataCheck = await Promise.all(
        allTenants.map(async (tenant) => {
          const [items, purchases, students] = await Promise.all([
            supabase.from('stationary_items').select('id').eq('tenant_id', tenant.id),
            supabase.from('stationary_purchases').select('id').eq('tenant_id', tenant.id),
            supabase.from('students').select('id').eq('tenant_id', tenant.id)
          ]);
          
          return {
            ...tenant,
            items: items.data?.length || 0,
            purchases: purchases.data?.length || 0,
            students: students.data?.length || 0,
            total: (items.data?.length || 0) + (purchases.data?.length || 0) + (students.data?.length || 0)
          };
        })
      );
      
      setDebugInfo({
        authUser,
        userRecord,
        contextTenant: currentTenant,
        contextTenantId: tenantId,
        allTenants: tenantDataCheck,
        recommendations: generateRecommendations(userRecord, tenantDataCheck, tenantId)
      });
      
    } catch (error) {
      console.error('❌ Diagnosis failed:', error);
      Alert.alert('Error', 'Failed to run diagnosis: ' + error.message);
    }
  };

  const generateRecommendations = (userRecord, tenantDataCheck, contextTenantId) => {
    const recommendations = [];
    
    // Find tenant with most data
    const tenantWithMostData = tenantDataCheck.reduce((max, tenant) => 
      tenant.total > max.total ? tenant : max, tenantDataCheck[0]);
    
    // Check if user's assigned tenant matches context tenant
    if (userRecord?.tenant_id !== contextTenantId) {
      recommendations.push({
        type: 'error',
        message: `User DB tenant (${userRecord?.tenant_id}) != Context tenant (${contextTenantId})`
      });
    }
    
    // Check if user's tenant has data
    const userTenantData = tenantDataCheck.find(t => t.id === userRecord?.tenant_id);
    if (userTenantData && userTenantData.total === 0) {
      recommendations.push({
        type: 'warning',
        message: `User's assigned tenant "${userTenantData.name}" has no data`
      });
    }
    
    if (tenantWithMostData && tenantWithMostData.total > 0) {
      recommendations.push({
        type: 'suggestion',
        message: `"${tenantWithMostData.name}" has most data (${tenantWithMostData.total} items)`
      });
    }
    
    return recommendations;
  };

  const fixTenantAssignment = async (targetTenantId) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ tenant_id: targetTenantId })
        .eq('id', user?.id);
      
      if (error) throw error;
      
      Alert.alert('Success', 'Tenant assignment updated! Please restart the app.');
    } catch (error) {
      Alert.alert('Error', 'Failed to update tenant: ' + error.message);
    }
  };

  if (!isVisible) {
    return (
      <TouchableOpacity 
        style={styles.debugToggle} 
        onPress={() => setIsVisible(true)}
      >
        <Text style={styles.debugToggleText}>🔍</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.debugContainer}>
      <View style={styles.debugHeader}>
        <Text style={styles.debugTitle}>Tenant Debugger</Text>
        <TouchableOpacity onPress={() => setIsVisible(false)}>
          <Ionicons name="close" size={20} color="#333" />
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.debugContent}>
        <TouchableOpacity style={styles.diagnosisButton} onPress={runDiagnosis}>
          <Text style={styles.diagnosisButtonText}>Run Diagnosis</Text>
        </TouchableOpacity>
        
        {debugInfo && (
          <View>
            <Text style={styles.sectionTitle}>Current State:</Text>
            <Text style={styles.debugText}>Context Tenant: {debugInfo.contextTenantId}</Text>
            <Text style={styles.debugText}>Context Name: {debugInfo.contextTenant?.name}</Text>
            <Text style={styles.debugText}>User Email: {debugInfo.authUser?.email}</Text>
            <Text style={styles.debugText}>User DB Tenant: {debugInfo.userRecord?.tenant_id}</Text>
            
            <Text style={styles.sectionTitle}>Data Distribution:</Text>
            {debugInfo.allTenants.map(tenant => (
              <View key={tenant.id} style={styles.tenantRow}>
                <Text style={styles.tenantName}>{tenant.name}</Text>
                <Text style={styles.tenantData}>
                  Items: {tenant.items}, Purchases: {tenant.purchases}, Students: {tenant.students}
                </Text>
                {tenant.total > 0 && (
                  <TouchableOpacity 
                    style={styles.switchButton}
                    onPress={() => fixTenantAssignment(tenant.id)}
                  >
                    <Text style={styles.switchButtonText}>Switch Here</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
            
            <Text style={styles.sectionTitle}>Recommendations:</Text>
            {debugInfo.recommendations.map((rec, index) => (
              <Text 
                key={index} 
                style={[styles.recommendation, 
                  rec.type === 'error' ? styles.error : 
                  rec.type === 'warning' ? styles.warning : styles.suggestion
                ]}
              >
                {rec.type === 'error' ? '❌' : rec.type === 'warning' ? '⚠️' : '💡'} {rec.message}
              </Text>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  debugToggle: {
    position: 'absolute',
    top: 100,
    right: 20,
    width: 40,
    height: 40,
    backgroundColor: '#007AFF',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  debugToggleText: {
    color: 'white',
    fontSize: 16,
  },
  debugContainer: {
    position: 'absolute',
    top: 50,
    left: 10,
    right: 10,
    bottom: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 10,
    padding: 15,
    zIndex: 1000,
    elevation: 10,
  },
  debugHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingBottom: 10,
    marginBottom: 10,
  },
  debugTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  debugContent: {
    flex: 1,
  },
  diagnosisButton: {
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 15,
  },
  diagnosisButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 5,
    color: '#333',
  },
  debugText: {
    fontSize: 12,
    marginBottom: 3,
    fontFamily: 'monospace',
  },
  tenantRow: {
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderRadius: 4,
    marginBottom: 5,
  },
  tenantName: {
    fontWeight: 'bold',
    fontSize: 12,
  },
  tenantData: {
    fontSize: 11,
    color: '#666',
  },
  switchButton: {
    backgroundColor: '#28a745',
    padding: 4,
    borderRadius: 3,
    alignSelf: 'flex-start',
    marginTop: 3,
  },
  switchButtonText: {
    color: 'white',
    fontSize: 10,
  },
  recommendation: {
    fontSize: 11,
    marginBottom: 3,
    padding: 5,
    borderRadius: 3,
  },
  error: {
    backgroundColor: '#ffebee',
    color: '#c62828',
  },
  warning: {
    backgroundColor: '#fff8e1',
    color: '#f57c00',
  },
  suggestion: {
    backgroundColor: '#e8f5e8',
    color: '#2e7d32',
  },
});

export default TenantDebugger;
