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
      <View style={styles.bankIconContainer}>
        <Ionicons 
          name={item.icon} 
          size={24} 
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
        <Ionicons name="checkmark-circle" size={20} color="#fff" />
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
          <Text style={styles.summaryTitle}>Payment Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Fee Type:</Text>
            <Text style={styles.summaryValue}>{selectedFee.name}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Amount:</Text>
            <Text style={styles.summaryAmount}>₹{selectedFee.remainingAmount || selectedFee.amount}</Text>
          </View>
        </View>

        {/* Bank Selection */}
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>Select Your Bank</Text>
          
          <FlatList
            data={popularBanks}
            renderItem={renderBankItem}
            keyExtractor={(item) => item.code}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
          />

          {/* Info */}
          <View style={styles.bankingInfo}>
            <Ionicons name="information-circle" size={16} color="#FF9800" />
            <Text style={styles.bankingInfoText}>
              You will be redirected to your bank's secure website to complete the payment.
            </Text>
          </View>
        </View>

        {/* Pay Button */}
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
              <Ionicons name="globe" size={20} color="#fff" />
              <Text style={styles.payButtonText}>
                Pay ₹{selectedFee.remainingAmount || selectedFee.amount}
              </Text>
            </>
          )}
        </TouchableOpacity>
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
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 80,
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  summaryAmount: {
    fontSize: 18,
    color: '#FF9800',
    fontWeight: 'bold',
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  bankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  selectedBankItem: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  bankIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  bankInfo: {
    flex: 1,
  },
  bankName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  selectedBankName: {
    color: '#fff',
  },
  bankCode: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  selectedBankCode: {
    color: '#e3f2fd',
  },
  bankingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3e0',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  bankingInfoText: {
    fontSize: 12,
    color: '#f57c00',
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
  payButton: {
    backgroundColor: '#FF9800',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  payButtonDisabled: {
    backgroundColor: '#ccc',
  },
  payButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  processingText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 8,
  },
});

export default OnlineBankingPayment;