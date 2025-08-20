import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';

const OnlineBankingPayment = ({ route, navigation }) => {
  const { selectedFee, studentData } = route.params;
  
  const [formData, setFormData] = useState({
    bankName: '',
    accountType: 'savings'
  });
  const [processing, setProcessing] = useState(false);

  const popularBanks = [
    { name: 'State Bank of India', code: 'SBI', icon: 'business' },
    { name: 'HDFC Bank', code: 'HDFC', icon: 'card' },
    { name: 'ICICI Bank', code: 'ICICI', icon: 'diamond' },
    { name: 'Axis Bank', code: 'AXIS', icon: 'triangle' },
    { name: 'Punjab National Bank', code: 'PNB', icon: 'square' },
    { name: 'Bank of Baroda', code: 'BOB', icon: 'ellipse' },
    { name: 'Canara Bank', code: 'CANARA', icon: 'hexagon' },
    { name: 'Union Bank of India', code: 'UNION', icon: 'star' },
  ];

  const validateForm = () => {
    if (!formData.bankName) {
      return 'Please select a bank';
    }
    return null;
  };

  const processPayment = async () => {
    const validationError = validateForm();
    if (validationError) {
      Alert.alert('Validation Error', validationError);
      return;
    }

    setProcessing(true);
    
    try {
      // Simulate online banking redirect and processing
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Simulate 85% success rate
      const success = Math.random() > 0.15;
      
      if (success) {
        const transactionId = `NET${Date.now()}`;
        Alert.alert(
          'Payment Successful',
          `Payment of ₹${selectedFee.remainingAmount || selectedFee.amount} has been processed successfully.\n\nTransaction ID: ${transactionId}\nBank: ${formData.bankName}`,
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      } else {
        Alert.alert('Payment Failed', 'Online banking payment failed. Please check your internet connection and try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'An error occurred while processing your payment. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleBankSelect = (bank) => {
    setFormData({ ...formData, bankName: bank.name });
  };

  const renderBankItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.bankItem,
        formData.bankName === item.name && styles.selectedBankItem
      ]}
      onPress={() => handleBankSelect(item)}
    >
      <View style={[
        styles.bankIconContainer,
        formData.bankName === item.name && styles.selectedBankIconContainer
      ]}>
        <Ionicons 
          name={item.icon} 
          size={22} 
          color={formData.bankName === item.name ? '#fff' : '#2196F3'} 
        />
      </View>
      <View style={styles.bankInfo}>
        <Text style={[
          styles.bankName,
          formData.bankName === item.name && styles.selectedBankName
        ]}>
          {item.name}
        </Text>
        <Text style={[
          styles.bankCode,
          formData.bankName === item.name && styles.selectedBankCode
        ]}>
          {item.code}
        </Text>
      </View>
      {formData.bankName === item.name && (
        <View style={styles.checkmarkContainer}>
          <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Header title="Net Banking" showBack={true} />
      
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Payment Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Ionicons name="receipt-outline" size={24} color="#2196F3" />
            <Text style={styles.summaryTitle}>Payment Summary</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Fee Type</Text>
            <Text style={styles.summaryValue}>{selectedFee.name}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Student</Text>
            <Text style={styles.summaryValue}>{studentData.name}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Class</Text>
            <Text style={styles.summaryValue}>{studentData.classes?.class_name || 'N/A'}</Text>
          </View>
          <View style={styles.summaryRowHighlight}>
            <Text style={styles.summaryLabelHighlight}>Total Amount</Text>
            <Text style={styles.summaryAmount}>₹{selectedFee.remainingAmount || selectedFee.amount}</Text>
          </View>
        </View>

        {/* Bank Selection */}
        <View style={styles.formContainer}>
          <View style={styles.formHeader}>
            <Ionicons name="business-outline" size={24} color="#2196F3" />
            <Text style={styles.formTitle}>Select Your Bank</Text>
          </View>
          <Text style={styles.formSubtitle}>Choose your bank to proceed with net banking payment</Text>
          
          <FlatList
            data={popularBanks}
            renderItem={renderBankItem}
            keyExtractor={(item) => item.code}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
            style={styles.bankList}
          />

          {/* Security Info */}
          <View style={styles.securityInfo}>
            <View style={styles.securityHeader}>
              <Ionicons name="shield-checkmark" size={18} color="#4CAF50" />
              <Text style={styles.securityTitle}>Secure Payment</Text>
            </View>
            <Text style={styles.securityText}>
              You will be redirected to your bank's secure website to complete the payment. Your transaction is protected with bank-level security.
            </Text>
          </View>
        </View>

        {/* Pay Button Container */}
        <View style={styles.payButtonContainer}>
          <TouchableOpacity 
            style={[styles.payButton, processing && styles.payButtonDisabled]}
            onPress={processPayment}
            disabled={processing}
          >
            {processing ? (
              <View style={styles.processingContainer}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.processingText}>Redirecting to bank...</Text>
              </View>
            ) : (
              <>
                <Ionicons name="card-outline" size={22} color="#fff" />
                <Text style={styles.payButtonText}>
                  Pay ₹{selectedFee.remainingAmount || selectedFee.amount}
                </Text>
              </>
            )}
          </TouchableOpacity>
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
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginLeft: 12,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#e8e8e8',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryRowHighlight: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
  },
  summaryLabel: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  summaryLabelHighlight: {
    fontSize: 16,
    color: '#1a1a1a',
    fontWeight: 'bold',
  },
  summaryValue: {
    fontSize: 15,
    color: '#1a1a1a',
    fontWeight: '600',
  },
  summaryAmount: {
    fontSize: 20,
    color: '#2196F3',
    fontWeight: 'bold',
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginLeft: 12,
  },
  formSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  bankList: {
    marginTop: 8,
  },
  bankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 2,
    borderColor: '#e8e8e8',
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#fff',
    transition: 'all 0.2s ease',
  },
  selectedBankItem: {
    backgroundColor: '#f0f8ff',
    borderColor: '#2196F3',
    elevation: 2,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  bankIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  selectedBankIconContainer: {
    backgroundColor: '#2196F3',
  },
  bankInfo: {
    flex: 1,
  },
  bankName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  selectedBankName: {
    color: '#2196F3',
  },
  bankCode: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  selectedBankCode: {
    color: '#2196F3',
  },
  checkmarkContainer: {
    marginLeft: 12,
  },
  securityInfo: {
    backgroundColor: '#f0f8f5',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  securityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  securityTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2e7d32',
    marginLeft: 8,
  },
  securityText: {
    fontSize: 14,
    color: '#388e3c',
    lineHeight: 20,
    fontWeight: '400',
  },
  payButtonContainer: {
    paddingTop: 16,
    paddingBottom: 60,
    marginTop: 8,
  },
  payButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  payButtonDisabled: {
    backgroundColor: '#bbb',
    elevation: 0,
    shadowOpacity: 0,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  processingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
});

export default OnlineBankingPayment;