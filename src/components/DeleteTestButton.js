import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { supabase, TABLES } from '../utils/supabase';
import { getCachedTenantId } from '../utils/tenantHelpers';

const DeleteTestButton = ({ classId, className }) => {
  const testDelete = async () => {
    console.log('='.repeat(50));
    console.log('🧪 STARTING WEB DELETE TEST');
    console.log('='.repeat(50));
    console.log('🧪 Class:', className, 'ID:', classId);
    console.log('🧪 Environment: Web browser');
    console.log('🧪 Time:', new Date().toLocaleTimeString());
    
    try {
      // Step 1: Check tenant context
      const cachedTenantId = getCachedTenantId();
      console.log('🏢 Cached tenant ID:', cachedTenantId);
      
      if (!cachedTenantId) {
        Alert.alert('Test Result', 'No tenant ID found - this is likely the issue!');
        return;
      }
      
      // Step 2: Try a simple select to verify access
      console.log('📋 Testing basic class access...');
      const { data: classData, error: selectError } = await supabase
        .from(TABLES.CLASSES)
        .select('id, class_name, tenant_id')
        .eq('id', classId)
        .eq('tenant_id', cachedTenantId);
      
      if (selectError) {
        console.error('❌ Select error:', selectError);
        Alert.alert('Test Result', `Select failed: ${selectError.message}`);
        return;
      }
      
      if (!classData || classData.length === 0) {
        Alert.alert('Test Result', 'Class not found with current tenant context');
        return;
      }
      
      console.log('✅ Class found:', classData[0]);
      
      // Step 3: Test delete permission with a non-existent ID (safe test)
      console.log('🔒 Testing delete permissions...');
      const { error: deleteTestError } = await supabase
        .from(TABLES.CLASSES)
        .delete()
        .eq('id', 'non-existent-test-id')
        .eq('tenant_id', cachedTenantId);
      
      let message = 'Delete test completed!\n\n';
      
      if (deleteTestError) {
        console.error('❌ Delete test error:', deleteTestError);
        message += `Delete Error: ${deleteTestError.message}\n`;
        message += `Error Code: ${deleteTestError.code}\n\n`;
        
        if (deleteTestError.code === 'PGRST116' || 
            deleteTestError.message.includes('row-level security') ||
            deleteTestError.message.includes('policy')) {
          message += 'ISSUE: Row Level Security policy is blocking delete operations.\n';
          message += 'SOLUTION: Check your RLS policies in Supabase dashboard.';
        } else if (deleteTestError.code === '42501') {
          message += 'ISSUE: Database permission denied.\n';
          message += 'SOLUTION: Check database user permissions.';
        }
      } else {
        message += 'Delete permissions: ✅ OK\n';
        message += 'The issue might be elsewhere in the deletion process.';
      }
      
      // Enhanced web debugging
      console.log('='.repeat(50));
      console.log('🧪 WEB DELETE TEST COMPLETE');
      console.log('='.repeat(50));
      console.log('🧪 Summary:', message.replace(/\\n/g, ' | '));
      console.log('='.repeat(50));
      
      Alert.alert('Delete Test Results', message);
      
    } catch (error) {
      console.error('❌ Test failed:', error);
      Alert.alert('Test Error', error.message);
    }
  };
  
  return (
    <TouchableOpacity style={styles.testButton} onPress={testDelete}>
      <Text style={styles.testButtonText}>🧪 Test Delete</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  testButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    margin: 2,
  },
  testButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default DeleteTestButton;