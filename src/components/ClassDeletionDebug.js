import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { supabase, TABLES } from '../utils/supabase';
import { getCachedTenantId } from '../utils/tenantHelpers';

const ClassDeletionDebug = () => {
  const [isDebugging, setIsDebugging] = useState(false);

  const debugClassDeletion = async () => {
    if (isDebugging) return;
    
    setIsDebugging(true);
    console.log('🔍 Starting class deletion debug...');
    
    try {
      // Get cached tenant ID
      const cachedTenantId = getCachedTenantId();
      if (!cachedTenantId) {
        Alert.alert('Debug Error', 'No tenant ID found');
        return;
      }
      
      console.log('🏢 Using tenant ID:', cachedTenantId);
      
      // Step 1: Check if we can access classes table
      const { data: classes, error: classesError } = await supabase
        .from(TABLES.CLASSES)
        .select('id, class_name, tenant_id')
        .eq('tenant_id', cachedTenantId)
        .limit(5);
      
      if (classesError) {
        console.error('❌ Classes table access failed:', classesError);
        Alert.alert('Debug Result', `Classes table error: ${classesError.message}`);
        return;
      }
      
      console.log('✅ Classes table accessible, found:', classes?.length || 0, 'classes');
      
      if (!classes || classes.length === 0) {
        Alert.alert('Debug Result', 'No classes found to test with');
        return;
      }
      
      // Step 2: Test delete permissions with a safe non-existent ID
      console.log('🔒 Testing delete permissions...');
      const { error: deleteTestError } = await supabase
        .from(TABLES.CLASSES)
        .delete()
        .eq('id', 'test-non-existent-id')
        .eq('tenant_id', cachedTenantId);
      
      let permissionStatus = 'Unknown';
      let debugMessage = 'Debug completed successfully!\\n\\n';
      
      if (deleteTestError) {
        console.error('❌ Delete test error:', deleteTestError);
        
        if (deleteTestError.code === 'PGRST116' || 
            deleteTestError.message.includes('row-level security') ||
            deleteTestError.message.includes('policy')) {
          permissionStatus = '❌ RLS Policy Blocking';
          debugMessage += 'ISSUE FOUND: Row Level Security policy is blocking delete operations.\\n\\n';
          debugMessage += 'SOLUTION: Check your RLS policies on the classes table and related tables to ensure delete operations are allowed for admin users.\\n\\n';
          debugMessage += 'You may need to update your database policies or contact your database administrator.';
        } else if (deleteTestError.code === '42501') {
          permissionStatus = '❌ Permission Denied';
          debugMessage += 'ISSUE FOUND: Database user lacks delete permissions.\\n\\n';
          debugMessage += 'SOLUTION: Grant delete permissions to your database user.';
        } else {
          permissionStatus = '⚠️ Other Error';
          debugMessage += `ISSUE FOUND: ${deleteTestError.message}\\n\\n`;
          debugMessage += 'Check the console logs for more details.';
        }
      } else {
        permissionStatus = '✅ Delete Allowed';
        debugMessage += 'No issues detected with class deletion permissions.\\n\\n';
        debugMessage += 'If deletion is still not working, the issue may be with:\\n';
        debugMessage += '- Foreign key constraints\\n';
        debugMessage += '- Related data not being properly deleted\\n';
        debugMessage += '- Network connectivity\\n\\n';
        debugMessage += 'Check the console logs when attempting to delete for more specific error messages.';
      }
      
      // Step 3: Check for related data
      const testClass = classes[0];
      console.log('🎯 Testing with class:', testClass.class_name);
      
      const relatedDataChecks = await Promise.allSettled([
        supabase.from('subjects').select('id').eq('class_id', testClass.id).limit(1),
        supabase.from('students').select('id').eq('class_id', testClass.id).limit(1),
        supabase.from('assignments').select('id').eq('class_id', testClass.id).limit(1),
        supabase.from('exams').select('id').eq('class_id', testClass.id).limit(1),
      ]);
      
      let relatedDataSummary = '\\nRelated data found:\\n';
      relatedDataSummary += `- Subjects: ${relatedDataChecks[0].status === 'fulfilled' ? (relatedDataChecks[0].value.data?.length || 0) : 'Error'}\\n`;
      relatedDataSummary += `- Students: ${relatedDataChecks[1].status === 'fulfilled' ? (relatedDataChecks[1].value.data?.length || 0) : 'Error'}\\n`;
      relatedDataSummary += `- Assignments: ${relatedDataChecks[2].status === 'fulfilled' ? (relatedDataChecks[2].value.data?.length || 0) : 'Error'}\\n`;
      relatedDataSummary += `- Exams: ${relatedDataChecks[3].status === 'fulfilled' ? (relatedDataChecks[3].value.data?.length || 0) : 'Error'}\\n`;
      
      console.log('📊 Debug Summary:');
      console.log('- Tenant ID:', cachedTenantId);
      console.log('- Classes found:', classes.length);
      console.log('- Delete permission status:', permissionStatus);
      console.log('- Test class:', testClass.class_name);
      
      Alert.alert(
        'Class Deletion Debug Results',
        `${debugMessage}${relatedDataSummary}\\nPermission Status: ${permissionStatus}`,
        [{ text: 'OK' }]
      );
      
    } catch (error) {
      console.error('❌ Debug failed:', error);
      Alert.alert('Debug Error', `Debug failed: ${error.message}`);
    } finally {
      setIsDebugging(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.debugButton, isDebugging && styles.debugButtonDisabled]}
        onPress={debugClassDeletion}
        disabled={isDebugging}
      >
        <Text style={styles.debugButtonText}>
          {isDebugging ? '🔍 Debugging...' : '🔍 Debug Class Deletion'}
        </Text>
      </TouchableOpacity>
      <Text style={styles.debugText}>
        Tap to check if class deletion is working properly. 
        Results will appear in an alert and console logs.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    margin: 10,
  },
  debugButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  debugButtonDisabled: {
    backgroundColor: '#ccc',
  },
  debugButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  debugText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default ClassDeletionDebug;