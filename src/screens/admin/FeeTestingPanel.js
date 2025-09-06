import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import { supabase } from '../../utils/supabase';
import FeeService from '../../services/FeeService';

const FeeTestingPanel = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [systemStatus, setSystemStatus] = useState(null);
  const [testStudentId, setTestStudentId] = useState('');
  const [students, setStudents] = useState([]);

  useEffect(() => {
    loadStudents();
    checkSystemStatus();
  }, []);

  const loadStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('id, name, admission_no, classes(class_name, section)')
        .limit(10);

      if (!error && data) {
        setStudents(data);
        if (data.length > 0) {
          setTestStudentId(data[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading students:', error);
    }
  };

  const checkSystemStatus = async () => {
    try {
      // Check fee structure health
      const { data: allFees, error: feeError } = await supabase
        .from('fee_structure')
        .select('id, student_id, amount, base_amount, fee_component')
        .eq('academic_year', '2024-2025');

      if (feeError) throw feeError;

      const classFees = allFees?.filter(f => f.student_id === null) || [];
      const studentFees = allFees?.filter(f => f.student_id !== null) || [];
      const inconsistentFees = classFees.filter(f => f.amount !== f.base_amount);

      // Check discounts
      const { data: discounts, error: discountError } = await supabase
        .from('student_discounts')
        .select('id, is_active')
        .eq('academic_year', '2024-2025');

      if (discountError) throw discountError;

      const activeDiscounts = discounts?.filter(d => d.is_active) || [];

      setSystemStatus({
        classFees: classFees.length,
        studentFees: studentFees.length,
        inconsistentFees: inconsistentFees.length,
        activeDiscounts: activeDiscounts.length,
        healthy: studentFees.length === 0 && inconsistentFees.length === 0
      });

    } catch (error) {
      console.error('Error checking system status:', error);
    }
  };

  const addResult = (test, success, message) => {
    setResults(prev => [...prev, {
      id: Date.now(),
      test,
      success,
      message,
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  const clearResults = () => {
    setResults([]);
  };

  const runQuickTest = async () => {
    setLoading(true);
    addResult('Quick Test', null, 'Starting quick test...');

    try {
      // Test with selected student
      if (!testStudentId) {
        addResult('Quick Test', false, 'No student selected');
        return;
      }

      const result = await FeeService.getStudentFeesWithClassBase(testStudentId);

      if (result.success) {
        const { fees } = result.data;
        addResult('Quick Test', true, 
          `✅ Success! Class Fee: ₹${fees.classBaseFee}, ` +
          `Discounts: ₹${fees.individualDiscounts}, ` +
          `Total Due: ₹${fees.totalDue}, ` +
          `Components: ${fees.components.length}`
        );
      } else {
        addResult('Quick Test', false, `❌ Failed: ${result.error}`);
      }

    } catch (error) {
      addResult('Quick Test', false, `❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const testDiscountFlow = async () => {
    setLoading(true);
    addResult('Discount Test', null, 'Testing discount creation and deletion...');

    try {
      if (!testStudentId) {
        addResult('Discount Test', false, 'No student selected');
        return;
      }

      // Step 1: Get initial fees
      const initialResult = await FeeService.getStudentFeesWithClassBase(testStudentId);
      if (!initialResult.success) {
        addResult('Discount Test', false, `Failed to get initial fees: ${initialResult.error}`);
        return;
      }

      const tuitionFee = initialResult.data.fees.components.find(c => 
        c.component.toLowerCase().includes('tuition') || c.component.toLowerCase().includes('fee')
      );

      if (!tuitionFee) {
        addResult('Discount Test', false, 'No suitable fee component found for testing');
        return;
      }

      const initialAmount = tuitionFee.finalAmount;

      // Step 2: Create test discount
      const discountId = `test-discount-${Date.now()}`;
      const { error: createError } = await supabase
        .from('student_discounts')
        .insert([{
          id: discountId,
          student_id: testStudentId,
          fee_component: tuitionFee.component,
          discount_type: 'percentage',
          discount_value: 10,
          reason: 'Test discount',
          academic_year: '2024-2025',
          is_active: true
        }]);

      if (createError) {
        addResult('Discount Test', false, `Failed to create discount: ${createError.message}`);
        return;
      }

      // Step 3: Check fees with discount
      const discountedResult = await FeeService.getStudentFeesWithClassBase(testStudentId);
      if (!discountedResult.success) {
        addResult('Discount Test', false, `Failed to get discounted fees: ${discountedResult.error}`);
        return;
      }

      const discountedFee = discountedResult.data.fees.components.find(c => c.component === tuitionFee.component);
      const discountedAmount = discountedFee.finalAmount;
      const discountApplied = discountedFee.discountAmount;

      addResult('Discount Test', true, 
        `✅ Discount applied: ₹${initialAmount} → ₹${discountedAmount} (discount: ₹${discountApplied})`
      );

      // Step 4: Delete discount
      const { error: deleteError } = await supabase
        .from('student_discounts')
        .delete()
        .eq('id', discountId);

      if (deleteError) {
        addResult('Discount Test', false, `Failed to delete discount: ${deleteError.message}`);
        return;
      }

      // Step 5: Check fees after deletion
      const restoredResult = await FeeService.getStudentFeesWithClassBase(testStudentId);
      if (!restoredResult.success) {
        addResult('Discount Test', false, `Failed to get restored fees: ${restoredResult.error}`);
        return;
      }

      const restoredFee = restoredResult.data.fees.components.find(c => c.component === tuitionFee.component);
      const restoredAmount = restoredFee.finalAmount;

      if (Math.abs(restoredAmount - initialAmount) < 0.01) {
        addResult('Discount Test', true, 
          `✅ Fee restored correctly: ₹${restoredAmount} (discount removed)`
        );
      } else {
        addResult('Discount Test', false, 
          `❌ Fee restoration failed: expected ₹${initialAmount}, got ₹${restoredAmount}`
        );
      }

    } catch (error) {
      addResult('Discount Test', false, `❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const cleanupFeeStructure = async () => {
    setLoading(true);
    addResult('Cleanup', null, 'Cleaning up fee structure...');

    try {
      // Remove student-specific fees
      const { data: studentFees, error: fetchError } = await supabase
        .from('fee_structure')
        .select('id, fee_component, student_id')
        .not('student_id', 'is', null);

      if (fetchError) {
        addResult('Cleanup', false, `Error fetching student fees: ${fetchError.message}`);
        return;
      }

      if (studentFees && studentFees.length > 0) {
        const { error: deleteError } = await supabase
          .from('fee_structure')
          .delete()
          .not('student_id', 'is', null);

        if (deleteError) {
          addResult('Cleanup', false, `Error deleting student fees: ${deleteError.message}`);
          return;
        }

        addResult('Cleanup', true, `✅ Removed ${studentFees.length} student-specific fee entries`);
      }

      // Fix base_amount
      const { data: classFees, error: classFeesError } = await supabase
        .from('fee_structure')
        .select('id, fee_component, amount, base_amount')
        .is('student_id', null)
        .neq('base_amount', 'amount');

      if (classFeesError) {
        addResult('Cleanup', false, `Error fetching class fees: ${classFeesError.message}`);
        return;
      }

      if (classFees && classFees.length > 0) {
        for (const fee of classFees) {
          const { error: updateError } = await supabase
            .from('fee_structure')
            .update({ base_amount: fee.amount })
            .eq('id', fee.id);

          if (updateError) {
            addResult('Cleanup', false, `Error updating ${fee.fee_component}: ${updateError.message}`);
          }
        }

        addResult('Cleanup', true, `✅ Fixed base_amount for ${classFees.length} fees`);
      }

      addResult('Cleanup', true, '🎉 Fee structure cleanup completed');
      
      // Refresh system status
      await checkSystemStatus();

    } catch (error) {
      addResult('Cleanup', false, `❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Fee Testing Panel" showBack={true} />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* System Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔍 System Status</Text>
          {systemStatus ? (
            <View style={styles.statusContainer}>
              <View style={[styles.statusItem, { backgroundColor: systemStatus.healthy ? '#e8f5e8' : '#ffeaa7' }]}>
                <Text style={styles.statusLabel}>Health</Text>
                <Text style={[styles.statusValue, { color: systemStatus.healthy ? '#00b894' : '#e17055' }]}>
                  {systemStatus.healthy ? '✅ Healthy' : '⚠️ Needs Attention'}
                </Text>
              </View>
              <View style={styles.statusItem}>
                <Text style={styles.statusLabel}>Class Fees</Text>
                <Text style={styles.statusValue}>{systemStatus.classFees}</Text>
              </View>
              <View style={styles.statusItem}>
                <Text style={styles.statusLabel}>Student Fees (should be 0)</Text>
                <Text style={[styles.statusValue, { color: systemStatus.studentFees === 0 ? '#00b894' : '#e17055' }]}>
                  {systemStatus.studentFees}
                </Text>
              </View>
              <View style={styles.statusItem}>
                <Text style={styles.statusLabel}>Active Discounts</Text>
                <Text style={styles.statusValue}>{systemStatus.activeDiscounts}</Text>
              </View>
            </View>
          ) : (
            <ActivityIndicator size="small" color="#0984e3" />
          )}
        </View>

        {/* Test Controls */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🧪 Test Controls</Text>
          
          {/* Student Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Test Student</Text>
            <View style={styles.studentSelector}>
              {students.map((student) => (
                <TouchableOpacity
                  key={student.id}
                  style={[
                    styles.studentChip,
                    testStudentId === student.id && styles.selectedStudentChip
                  ]}
                  onPress={() => setTestStudentId(student.id)}
                >
                  <Text style={[
                    styles.studentChipText,
                    testStudentId === student.id && styles.selectedStudentChipText
                  ]}>
                    {student.name}
                  </Text>
                  <Text style={[
                    styles.studentChipSubtext,
                    testStudentId === student.id && styles.selectedStudentChipSubtext
                  ]}>
                    {student.classes?.class_name} - {student.admission_no}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Test Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.testButton, styles.primaryButton]}
              onPress={runQuickTest}
              disabled={loading}
            >
              <Ionicons name="play" size={16} color="#fff" />
              <Text style={styles.buttonText}>Quick Test</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.testButton, styles.secondaryButton]}
              onPress={testDiscountFlow}
              disabled={loading}
            >
              <Ionicons name="gift" size={16} color="#fff" />
              <Text style={styles.buttonText}>Discount Flow</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.testButton, styles.warningButton]}
              onPress={cleanupFeeStructure}
              disabled={loading}
            >
              <Ionicons name="construct" size={16} color="#fff" />
              <Text style={styles.buttonText}>Cleanup</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.testButton, styles.clearButton]}
              onPress={clearResults}
              disabled={loading}
            >
              <Ionicons name="trash" size={16} color="#666" />
              <Text style={[styles.buttonText, { color: '#666' }]}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Test Results */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Test Results</Text>
          
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#0984e3" />
              <Text style={styles.loadingText}>Running test...</Text>
            </View>
          )}
          
          <View style={styles.resultsContainer}>
            {results.length === 0 ? (
              <Text style={styles.noResults}>No test results yet. Run a test to see results here.</Text>
            ) : (
              results.slice(-10).reverse().map((result) => (
                <View key={result.id} style={styles.resultItem}>
                  <View style={styles.resultHeader}>
                    <View style={styles.resultTitle}>
                      <Text style={styles.resultTest}>{result.test}</Text>
                      <Text style={styles.resultTime}>{result.timestamp}</Text>
                    </View>
                    <View style={[
                      styles.resultStatus,
                      { backgroundColor: result.success === null ? '#74b9ff' : result.success ? '#00b894' : '#e17055' }
                    ]}>
                      <Text style={styles.resultStatusText}>
                        {result.success === null ? '⏳' : result.success ? '✅' : '❌'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.resultMessage}>{result.message}</Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📖 Instructions</Text>
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionText}>
              • <Text style={styles.bold}>Quick Test:</Text> Tests dynamic fee calculation with real data
            </Text>
            <Text style={styles.instructionText}>
              • <Text style={styles.bold}>Discount Flow:</Text> Creates a discount, verifies calculation, then removes it
            </Text>
            <Text style={styles.instructionText}>
              • <Text style={styles.bold}>Cleanup:</Text> Removes student-specific fees and fixes base_amount inconsistencies
            </Text>
            <Text style={styles.instructionText}>
              • <Text style={styles.bold}>System Health:</Text> Should show "Healthy" with 0 student fees
            </Text>
          </View>
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
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d3436',
    marginBottom: 12,
  },
  statusContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusItem: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: '48%',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 12,
    color: '#636e72',
    marginBottom: 2,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2d3436',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2d3436',
    marginBottom: 8,
  },
  studentSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  studentChip: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  selectedStudentChip: {
    backgroundColor: '#0984e3',
    borderColor: '#0984e3',
  },
  studentChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2d3436',
  },
  selectedStudentChipText: {
    color: '#fff',
  },
  studentChipSubtext: {
    fontSize: 11,
    color: '#636e72',
    marginTop: 2,
  },
  selectedStudentChipSubtext: {
    color: '#dfe6e9',
  },
  buttonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    minWidth: 120,
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#00b894',
  },
  secondaryButton: {
    backgroundColor: '#0984e3',
  },
  warningButton: {
    backgroundColor: '#e17055',
  },
  clearButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 14,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 8,
  },
  loadingText: {
    color: '#636e72',
  },
  resultsContainer: {
    gap: 8,
  },
  noResults: {
    color: '#636e72',
    textAlign: 'center',
    padding: 20,
    fontStyle: 'italic',
  },
  resultItem: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#0984e3',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  resultTitle: {
    flex: 1,
  },
  resultTest: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2d3436',
  },
  resultTime: {
    fontSize: 11,
    color: '#636e72',
  },
  resultStatus: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultStatusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  resultMessage: {
    fontSize: 13,
    color: '#636e72',
    lineHeight: 18,
  },
  instructionsContainer: {
    gap: 8,
  },
  instructionText: {
    fontSize: 14,
    color: '#636e72',
    lineHeight: 20,
  },
  bold: {
    fontWeight: '600',
    color: '#2d3436',
  },
});

export default FeeTestingPanel;
