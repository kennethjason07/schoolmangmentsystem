import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';

const CardPayment = ({ route, navigation }) => {
  const { selectedFee, studentData } = route.params;
  
  const [formData, setFormData] = useState({
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    cardHolderName: '',
    saveCard: false
  });
  const [processing, setProcessing] = useState(false);

  const handleInputChange = (field, value) => {
    let processedValue = value;
    
    if (field === 'cardNumber') {
      processedValue = value.replace(/\s/g, '');
    } else if (field === 'expiryDate') {
      let formatted = value.replace(/\D/g, '');
      if (formatted.length >= 2) {
        formatted = formatted.substring(0, 2) + '/' + formatted.substring(2, 4);
      }
      processedValue = formatted;
    } else if (field === 'cvv') {
      processedValue = value.replace(/\D/g, '');
    }
    
    setFormData({ ...formData, [field]: processedValue });
  };

  const validateForm = () => {
    if (!formData.cardNumber || formData.cardNumber.length < 16) {
      return 'Please enter a valid 16-digit card number';
    }
    if (!formData.expiryDate || !/^\d{2}\/\d{2}$/.test(formData.expiryDate)) {
      return 'Please enter expiry date in MM/YY format';
    }
    if (!formData.cvv || formData.cvv.length < 3) {
      return 'Please enter a valid CVV';
    }
    if (!formData.cardHolderName || formData.cardHolderName.trim().length < 2) {
      return 'Please enter card holder name';
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
      // Simulate card payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulate 90% success rate
      const success = Math.random() > 0.1;
      
      if (success) {
        const transactionId = `CARD${Date.now()}`;
        Alert.alert(
          'Payment Successful',
          `Payment of ₹${selectedFee.remainingAmount || selectedFee.amount} has been processed successfully.\n\nTransaction ID: ${transactionId}\nCard: ****-****-****-${formData.cardNumber.slice(-4)}`,
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      } else {
        Alert.alert('Payment Failed', 'Card payment failed. Please check your card details and try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'An error occurred while processing your payment. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Card Payment" showBack={true} />
      
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

        {/* Card Form */}
        <View style={styles.formContainer}>
          <View style={styles.formHeader}>
            <Ionicons name="card-outline" size={24} color="#2196F3" />
            <Text style={styles.formTitle}>Enter Card Details</Text>
          </View>
          <Text style={styles.formSubtitle}>Please enter your card information securely</Text>
          
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Card Number *</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="card" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.formInput}
                placeholder="1234 5678 9012 3456"
                placeholderTextColor="#999"
                value={formData.cardNumber}
                onChangeText={(text) => handleInputChange('cardNumber', text)}
                keyboardType="numeric"
                maxLength={16}
              />
            </View>
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.formLabel}>Expiry Date *</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="calendar-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.formInput}
                  placeholder="MM/YY"
                  placeholderTextColor="#999"
                  value={formData.expiryDate}
                  onChangeText={(text) => handleInputChange('expiryDate', text)}
                  keyboardType="numeric"
                  maxLength={5}
                />
              </View>
            </View>
            
            <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.formLabel}>CVV *</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.formInput}
                  placeholder="123"
                  placeholderTextColor="#999"
                  value={formData.cvv}
                  onChangeText={(text) => handleInputChange('cvv', text)}
                  keyboardType="numeric"
                  maxLength={4}
                  secureTextEntry
                />
              </View>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Card Holder Name *</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.formInput}
                placeholder="John Doe"
                placeholderTextColor="#999"
                value={formData.cardHolderName}
                onChangeText={(text) => handleInputChange('cardHolderName', text)}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Security Info */}
          <View style={styles.securityInfo}>
            <View style={styles.securityHeader}>
              <Ionicons name="shield-checkmark" size={18} color="#4CAF50" />
              <Text style={styles.securityTitle}>Bank-Level Security</Text>
            </View>
            <Text style={styles.securityText}>
              Your card details are protected with 256-bit SSL encryption and are never stored on our servers. All transactions are processed securely.
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
                <Text style={styles.processingText}>Processing payment...</Text>
              </View>
            ) : (
              <>
                <Ionicons name="card" size={22} color="#fff" />
                <Text style={styles.payButtonText}>
                  Pay ₹{selectedFee.remainingAmount || selectedFee.amount} Securely
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
    marginBottom: 24,
    lineHeight: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e8e8e8',
    borderRadius: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  formInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1a1a1a',
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  securityInfo: {
    backgroundColor: '#f0f8ff',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  securityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  securityTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1976d2',
    marginLeft: 8,
  },
  securityText: {
    fontSize: 14,
    color: '#1976d2',
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

export default CardPayment;