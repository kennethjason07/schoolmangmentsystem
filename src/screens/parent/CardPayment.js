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
      
      <ScrollView style={styles.content}>
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

        {/* Card Form */}
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>Enter Card Details</Text>
          
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Card Number</Text>
            <TextInput
              style={styles.formInput}
              placeholder="1234 5678 9012 3456"
              value={formData.cardNumber}
              onChangeText={(text) => handleInputChange('cardNumber', text)}
              keyboardType="numeric"
              maxLength={16}
            />
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.formLabel}>Expiry Date</Text>
              <TextInput
                style={styles.formInput}
                placeholder="MM/YY"
                value={formData.expiryDate}
                onChangeText={(text) => handleInputChange('expiryDate', text)}
                keyboardType="numeric"
                maxLength={5}
              />
            </View>
            
            <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.formLabel}>CVV</Text>
              <TextInput
                style={styles.formInput}
                placeholder="123"
                value={formData.cvv}
                onChangeText={(text) => handleInputChange('cvv', text)}
                keyboardType="numeric"
                maxLength={4}
                secureTextEntry
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Card Holder Name</Text>
            <TextInput
              style={styles.formInput}
              placeholder="John Doe"
              value={formData.cardHolderName}
              onChangeText={(text) => handleInputChange('cardHolderName', text)}
              autoCapitalize="words"
            />
          </View>

          {/* Security Info */}
          <View style={styles.securityInfo}>
            <Ionicons name="shield-checkmark" size={16} color="#4CAF50" />
            <Text style={styles.securityText}>Your card details are secure and encrypted</Text>
          </View>
        </View>

        {/* Pay Button */}
        <TouchableOpacity 
          style={[styles.payButton, processing && styles.payButtonDisabled]}
          onPress={processPayment}
          disabled={processing}
        >
          {processing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="card" size={20} color="#fff" />
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
    padding: 16,
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
    color: '#2196F3',
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
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e8',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  securityText: {
    fontSize: 12,
    color: '#4CAF50',
    marginLeft: 8,
    flex: 1,
  },
  payButton: {
    backgroundColor: '#2196F3',
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
});

export default CardPayment;