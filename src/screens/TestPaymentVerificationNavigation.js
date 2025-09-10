import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';

const TestPaymentVerificationNavigation = ({ navigation }) => {
  
  const handleNavigateToVerification = () => {
    // Example data that you would typically get from a pending payment or QR code scan
    const mockTransactionData = {
      transactionId: 'upi_test_123',
      paymentRecord: {
        id: 'payment_123',
        reference_number: 'ADM001-20241207-001',
        amount: 1500,
        fee_component: 'Tuition Fee',
        student_id: 'student_123',
        tenant_id: 'tenant_123',
        student: {
          name: 'John Doe'
        }
      },
      studentInfo: {
        id: 'student_123',
        name: 'John Doe',
        tenant_id: 'tenant_123'
      },
      feeDetails: {
        totalAmount: 1500,
        feeComponent: 'Tuition Fee'
      }
    };

    navigation.navigate('PaymentVerification', mockTransactionData);
  };

  return (
    <View style={styles.container}>
      <Header 
        title="Test Payment Verification" 
        showBack={true} 
        navigation={navigation}
      />
      
      <View style={styles.content}>
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={64} color="#2196F3" />
          <Text style={styles.title}>Payment Verification Screen</Text>
          <Text style={styles.description}>
            This screen is now properly registered in navigation. 
            Tap the button below to test navigation to the PaymentVerificationScreen.
          </Text>
          
          <TouchableOpacity 
            style={styles.testButton}
            onPress={handleNavigateToVerification}
          >
            <Ionicons name="card-outline" size={20} color="#fff" />
            <Text style={styles.testButtonText}>
              Test Payment Verification Navigation
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.usageCard}>
          <Text style={styles.usageTitle}>How to Use in Your App:</Text>
          <View style={styles.usageStep}>
            <Text style={styles.stepNumber}>1.</Text>
            <Text style={styles.stepText}>
              From anywhere in your admin interface, call:
            </Text>
          </View>
          <View style={styles.codeBlock}>
            <Text style={styles.codeText}>
              navigation.navigate('PaymentVerification', {'{'}
              {'\n  transactionId: "your_transaction_id",'}
              {'\n  paymentRecord: paymentData,'}
              {'\n  studentInfo: studentData,'}
              {'\n  feeDetails: feeData'}
              {'\n});'}
            </Text>
          </View>
          
          <View style={styles.usageStep}>
            <Text style={styles.stepNumber}>2.</Text>
            <Text style={styles.stepText}>
              This can be called from UPI QR Modal, Pending Payments list, 
              or any other admin screen where payment verification is needed.
            </Text>
          </View>
        </View>
      </View>
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
    padding: 20,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  testButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  testButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  usageCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  usageTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  usageStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginRight: 8,
    marginTop: 2,
  },
  stepText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    lineHeight: 20,
  },
  codeBlock: {
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  codeText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#333',
    lineHeight: 16,
  },
});

export default TestPaymentVerificationNavigation;
