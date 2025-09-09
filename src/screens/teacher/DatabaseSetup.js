import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import { useAuth } from '../../utils/AuthContext';
import { setupTeacherData, DatabaseSetupHelper } from '../../utils/DatabaseSetupHelper';
import { DatabaseDiagnostic } from '../../utils/DatabaseDiagnostic';
import { createSampleParents, verifyParentStudentRelationships } from '../../utils/createSampleParents';
import { getCurrentUserTenantByEmail, showTenantErrorAlert } from '../../utils/getTenantByEmail';

const DatabaseSetup = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState([]);
  const [tenantInfo, setTenantInfo] = useState(null);
  const [tenantLoading, setTenantLoading] = useState(true);
  const { user } = useAuth();

  const addProgress = (message) => {
    setProgress(prev => [...prev, { message, timestamp: new Date().toLocaleTimeString() }]);
  };

  // Initialize tenant context on component mount
  useEffect(() => {
    const initializeTenant = async () => {
      if (!user?.email) {
        Alert.alert(
          'Authentication Required',
          'Please log in to access the database setup.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        return;
      }

      setTenantLoading(true);
      try {
        console.log('🏢 DatabaseSetup: Initializing tenant context for:', user.email);
        const tenantResult = await getCurrentUserTenantByEmail();
        
        if (!tenantResult.success) {
          console.error('❌ DatabaseSetup: Failed to get tenant:', tenantResult.error);
          showTenantErrorAlert(
            tenantResult,
            () => initializeTenant(), // Retry function
            () => navigation.goBack()  // Cancel function
          );
          return;
        }

        setTenantInfo(tenantResult.data);
        console.log('✅ DatabaseSetup: Tenant context initialized for:', tenantResult.data.tenant.name);
        
      } catch (error) {
        console.error('❌ DatabaseSetup: Error initializing tenant:', error);
        Alert.alert(
          'Initialization Error',
          'Failed to initialize database setup. Please try again.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } finally {
        setTenantLoading(false);
      }
    };

    initializeTenant();
  }, [user?.email, navigation]);

  const handleSetupAll = async () => {
    if (!tenantInfo) {
      Alert.alert(
        'Tenant Not Initialized',
        'School information is still loading. Please wait and try again.',
        [{ text: 'OK' }]
      );
      return;
    }

    setLoading(true);
    setProgress([]);
    
    try {
      addProgress(`🚀 Starting complete database setup for ${tenantInfo.tenant.name}...`);
      addProgress(`👤 Current user: ${user.email}`);
      addProgress(`🏢 Tenant ID: ${tenantInfo.tenantId}`);
      
      // Step 1: Setup Bheem Rao Patil as class teacher (tenant-aware)
      addProgress('🏦 Setting up Bheem Rao Patil as Class Teacher of 3 A...');
      const bheemResult = await DatabaseSetupHelper.setupBheemRaoPatilAsClassTeacher(tenantInfo.tenantId);
      if (bheemResult.success) {
        addProgress('✅ Bheem Rao Patil setup completed!');
        addProgress(`   Teacher: ${bheemResult.teacher?.name}`);
        addProgress(`   Class: ${bheemResult.class?.class_name} ${bheemResult.class?.section}`);
      } else {
        addProgress(`⚠️ Bheem setup: ${bheemResult.error}`);
      }
      
      // Step 2: Create parent accounts (tenant-aware)
      addProgress('👨‍👩‍👧‍👦 Creating parent accounts for current tenant...');
      const parentResult = await DatabaseSetupHelper.createParentAccounts(tenantInfo.tenantId);
      if (parentResult.success) {
        addProgress('✅ Parent accounts created!');
      } else {
        addProgress(`❌ Parent creation failed: ${parentResult.error}`);
      }
      
      // Step 3: Setup teacher assignments (tenant-aware)
      addProgress('👨‍🏫 Setting up teacher assignments...');
      const result = await setupTeacherData(user.id, tenantInfo.tenantId);
      
      if (result.success) {
        addProgress(`✅ Database setup completed successfully for ${tenantInfo.tenant.name}!`);
        Alert.alert(
          'Success! 🎉',
          `Database setup completed successfully for ${tenantInfo.tenant.name}!\n\n✅ Bheem Rao Patil is now Class Teacher of 3 A\n✅ Parent accounts created\n✅ Subject assignments completed\n✅ Sample timetable created\n\nPlease go back and refresh the dashboard.`,
          [
            { 
              text: 'Go to Dashboard', 
              onPress: () => navigation.navigate('TeacherTabs') 
            }
          ]
        );
      } else {
        addProgress(`❌ Setup failed: ${result.error}`);
        Alert.alert('Setup Failed', result.error);
      }
    } catch (error) {
      addProgress(`❌ Error: ${error.message}`);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateParents = async () => {
    setLoading(true);
    setProgress([]);
    
    try {
      addProgress('👨‍👩‍👧‍👦 Creating parent accounts...');
      const result = await DatabaseSetupHelper.createParentAccounts();
      
      if (result.success) {
        addProgress('✅ Parent accounts created successfully!');
        Alert.alert('Success!', 'Parent accounts have been created for all students.');
      } else {
        addProgress(`❌ Failed: ${result.error}`);
        Alert.alert('Error', result.error);
      }
    } catch (error) {
      addProgress(`❌ Error: ${error.message}`);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetupBheemRaoPatil = async () => {
    setLoading(true);
    setProgress([]);
    
    try {
      addProgress('🏫 Setting up Bheem Rao Patil as Class Teacher...');
      const result = await DatabaseSetupHelper.setupBheemRaoPatilAsClassTeacher();
      
      if (result.success) {
        addProgress('✅ Bheem Rao Patil setup completed!');
        addProgress(`   Teacher: ${result.teacher?.name}`);
        addProgress(`   Class: ${result.class?.class_name} ${result.class?.section}`);
        Alert.alert(
          'Teacher Setup Complete! 👨‍🏫',
          `Bheem Rao Patil has been set up as Class Teacher of ${result.class?.class_name} ${result.class?.section} with sample students.`
        );
      } else {
        addProgress(`❌ Failed: ${result.error}`);
        Alert.alert('Error', result.error);
      }
    } catch (error) {
      addProgress(`❌ Error: ${error.message}`);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const runDatabaseDiagnostic = async () => {
    setLoading(true);
    setProgress([]);
    
    try {
      addProgress('🔍 Running database diagnostic...');
      addProgress('This will check your database structure and current data.');
      addProgress('Check the console for detailed results.');
      
      // Run table structure check
      await DatabaseDiagnostic.checkTableStructure();
      addProgress('✅ Table structure check completed (see console)');
      
      // Run Bheem Rao Patil specific check
      await DatabaseDiagnostic.checkBheemRaoPatilData();
      addProgress('✅ Bheem Rao Patil data check completed (see console)');
      
      // Test current query
      await DatabaseDiagnostic.testCurrentQuery(user.id);
      addProgress('✅ Query test completed (see console)');
      
      addProgress('✅ Diagnostic completed! Check the browser console for detailed results.');
      Alert.alert(
        'Diagnostic Complete! 🔍',
        'Database diagnostic completed. Please check the browser console (F12) for detailed results. This will help identify the exact field names and relationships in your database.'
      );
    } catch (error) {
      addProgress(`❌ Error: ${error.message}`);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSampleParents = async () => {
    setLoading(true);
    setProgress([]);
    
    try {
      addProgress('👨‍👩‍👧‍👦 Creating sample parent data...');
      const result = await createSampleParents();
      
      if (result.success) {
        addProgress(`✅ Success! Created ${result.created} parent records`);
        if (result.created === 0) {
          addProgress('ℹ️ All students already have parent records');
        }
        Alert.alert(
          'Parent Data Created! 👨‍👩‍👧‍👦',
          `Successfully created ${result.created} parent records in the parents table. Now students will show their parent information in View Student Info.`
        );
      } else {
        addProgress(`❌ Error: ${result.error?.message || 'Unknown error'}`);
        Alert.alert('Error', result.error?.message || 'Failed to create parent data');
      }
      
    } catch (error) {
      addProgress(`❌ Unexpected error: ${error.message}`);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyParentRelationships = async () => {
    setLoading(true);
    setProgress([]);
    
    try {
      addProgress('🔍 Verifying parent-student relationships...');
      const result = await verifyParentStudentRelationships();
      
      if (result.success) {
        addProgress('📊 Verification complete:');
        addProgress(`   Total students: ${result.totalStudents}`);
        addProgress(`   With parent info: ${result.studentsWithParents}`);
        addProgress(`   Without parent info: ${result.studentsWithoutParents}`);
        
        if (result.studentsWithoutParents > 0) {
          addProgress('⚠️ Some students are missing parent information');
          Alert.alert(
            'Verification Complete ⚠️',
            `Found ${result.studentsWithoutParents} students without parent information. Consider running "Create Sample Parents" to fix this.`
          );
        } else {
          addProgress('✅ All students have parent information');
          Alert.alert(
            'Verification Complete ✅',
            'All students have parent information! Your View Student Info screen should now display parent details properly.'
          );
        }
      } else {
        addProgress(`❌ Verification failed: ${result.error?.message || 'Unknown error'}`);
        Alert.alert('Error', result.error?.message || 'Verification failed');
      }
      
    } catch (error) {
      addProgress(`❌ Unexpected error: ${error.message}`);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  // Show tenant loading state
  if (tenantLoading) {
    return (
      <View style={styles.container}>
        <Header title="Database Setup" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Initializing tenant context...</Text>
          <Text style={styles.loadingSubtext}>Connecting to {user?.email}</Text>
        </View>
      </View>
    );
  }

  // Show error state if no tenant info
  if (!tenantInfo) {
    return (
      <View style={styles.container}>
        <Header title="Database Setup" showBack={true} />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#F44336" />
          <Text style={styles.errorTitle}>Tenant Not Available</Text>
          <Text style={styles.errorText}>Unable to load school information. Please try again.</Text>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={() => {
              setTenantLoading(true);
              // Re-run tenant initialization
              const initializeTenant = async () => {
                try {
                  const tenantResult = await getCurrentUserTenantByEmail();
                  if (tenantResult.success) {
                    setTenantInfo(tenantResult.data);
                  } else {
                    showTenantErrorAlert(tenantResult, null, () => navigation.goBack());
                  }
                } finally {
                  setTenantLoading(false);
                }
              };
              initializeTenant();
            }}
          >
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title={`Database Setup - ${tenantInfo.tenant.name}`} showBack={true} />
      
      <ScrollView style={styles.content}>
        <View style={styles.warningBox}>
          <Ionicons name="warning" size={24} color="#FF9800" />
          <Text style={styles.warningText}>
            This screen will help fix the missing data in your teacher dashboard.
          </Text>
        </View>

        <View style={styles.issuesBox}>
          <Text style={styles.issuesTitle}>📋 Issues Detected:</Text>
          <Text style={styles.issueItem}>• Bheem Rao Patil not set as Class Teacher of 3 A</Text>
          <Text style={styles.issueItem}>• No parent information for students</Text>
          <Text style={styles.issueItem}>• No subject assignments for teacher</Text>
          <Text style={styles.issueItem}>• No timetable entries</Text>
        </View>

        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>🛠️ Fix Options:</Text>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.primaryButton]} 
            onPress={handleSetupAll}
            disabled={loading}
          >
            <Ionicons name="construct" size={20} color="#fff" />
            <Text style={styles.buttonText}>Fix Everything (Recommended)</Text>
          </TouchableOpacity>

          <Text style={styles.orText}>OR</Text>

          <TouchableOpacity 
            style={[styles.actionButton, styles.secondaryButton]} 
            onPress={handleCreateParents}
            disabled={loading}
          >
            <Ionicons name="people" size={20} color="#2196F3" />
            <Text style={[styles.buttonText, { color: '#2196F3' }]}>Create Parent Accounts Only</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: '#e8f5e8', borderWidth: 1, borderColor: '#4CAF50' }]} 
            onPress={handleSetupBheemRaoPatil}
            disabled={loading}
          >
            <Ionicons name="school" size={20} color="#4CAF50" />
            <Text style={[styles.buttonText, { color: '#4CAF50' }]}>Setup Bheem Rao Patil as Class Teacher</Text>
          </TouchableOpacity>

          <Text style={styles.orText}>Debug Options:</Text>

          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: '#fff3e0', borderWidth: 1, borderColor: '#FF9800' }]} 
            onPress={runDatabaseDiagnostic}
            disabled={loading}
          >
            <Ionicons name="search" size={20} color="#FF9800" />
            <Text style={[styles.buttonText, { color: '#FF9800' }]}>Run Database Diagnostic</Text>
          </TouchableOpacity>

          <Text style={styles.orText}>Parent Data Options:</Text>

          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: '#e8f5e8', borderWidth: 1, borderColor: '#4CAF50' }]} 
            onPress={handleCreateSampleParents}
            disabled={loading}
          >
            <Ionicons name="people" size={20} color="#4CAF50" />
            <Text style={[styles.buttonText, { color: '#4CAF50' }]}>Create Sample Parents</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: '#e3f2fd', borderWidth: 1, borderColor: '#2196F3' }]} 
            onPress={handleVerifyParentRelationships}
            disabled={loading}
          >
            <Ionicons name="checkmark-circle" size={20} color="#2196F3" />
            <Text style={[styles.buttonText, { color: '#2196F3' }]}>Verify Parent Relationships</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.progressSection}>
          <Text style={styles.sectionTitle}>📝 Progress:</Text>
          
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#2196F3" />
              <Text style={styles.loadingText}>Setting up database...</Text>
            </View>
          )}

          <ScrollView style={styles.progressLog} nestedScrollEnabled={true}>
            {progress.map((item, index) => (
              <View key={index} style={styles.progressItem}>
                <Text style={styles.progressTime}>{item.timestamp}</Text>
                <Text style={styles.progressMessage}>{item.message}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>ℹ️ What this will do:</Text>
          <Text style={styles.infoItem}>1. Set up Bheem Rao Patil as Class Teacher of 3 A</Text>
          <Text style={styles.infoItem}>2. Create sample students for Class 3 A if needed</Text>
          <Text style={styles.infoItem}>3. Create parent user accounts for all students</Text>
          <Text style={styles.infoItem}>4. Assign subjects (Math, Science, English) to your teacher account</Text>
          <Text style={styles.infoItem}>5. Create sample timetable entries for this week</Text>
          <Text style={styles.infoItem}>6. Link everything together properly</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3e0',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  warningText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#F57C00',
  },
  issuesBox: {
    backgroundColor: '#ffebee',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  issuesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#d32f2f',
  },
  issueItem: {
    fontSize: 14,
    color: '#d32f2f',
    marginBottom: 4,
  },
  actionsSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#2196F3',
  },
  secondaryButton: {
    backgroundColor: '#e3f2fd',
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  orText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#666',
    marginVertical: 8,
  },
  progressSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    minHeight: 200,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#2196F3',
  },
  loadingSubtext: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F44336',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  progressLog: {
    maxHeight: 200,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 8,
  },
  progressItem: {
    marginBottom: 8,
  },
  progressTime: {
    fontSize: 12,
    color: '#666',
  },
  progressMessage: {
    fontSize: 14,
    color: '#333',
    marginTop: 2,
  },
  infoBox: {
    backgroundColor: '#e8f5e8',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#2e7d32',
  },
  infoItem: {
    fontSize: 14,
    color: '#2e7d32',
    marginBottom: 4,
  },
});

export default DatabaseSetup;
