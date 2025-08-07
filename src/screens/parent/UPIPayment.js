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

const UPIPayment = ({ route, navigation }) => {
  const { selectedFee, studentData } = route.params;
  
  const [formData, setFormData] = useState({
    upiId: '',
    verifyUpiId: false
  });
  const [processing, setProcessing] = useState(false);

  const handleInputChange = (field, value) => {
    let processedValue = value;
    
    if (field === 'upiId') {
      processedValue = value.toLowerCase();
    }
    
    setFormData({ ...formData, [field]: processedValue });
  };

  const validateForm = () => {
    if (!formData.upiId || !formData.upiId.includes('@')) {
      return 'Please enter a valid UPI ID (e.g., yourname@paytm)';
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
      // Simulate UPI payment processing
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Simulate 95% success rate
      const success = Math.random() > 0.05;
      
      if (success) {
        const transactionId = `UPI${Date.now()}`;
        Alert.alert(
          'Payment Successful',
          `Payment of ₹${selectedFee.remainingAmount || selectedFee.amount} has been processed successfully.\n\nTransaction ID: ${transactionId}\nUPI ID: ${formData.upiId}`,
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      } else {
        Alert.alert('Payment Failed', 'UPI payment failed. Please check your UPI ID and try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'An error occurred while processing your payment. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const popularUPIApps = [
    { name: 'Google Pay', suffix: '@okaxis', icon: 'logo-google' },
    { name: 'PhonePe', suffix: '@ybl', icon: 'phone-portrait' },
    { name: 'Paytm', suffix: '@paytm', icon: 'wallet' },
    { name: 'BHIM', suffix: '@upi', icon: 'card' },
  ];

  const handleQuickSelect = (suffix) => {
    const currentId = formData.upiId.split('@')[0];
    setFormData({ ...formData, upiId: currentId + suffix });
  };

  return (
    <View style={styles.container}>
      <Header title="UPI Payment" showBack={true} />
      
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

        {/* UPI Form */}
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>Enter UPI Details</Text>
          
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>UPI ID</Text>
            <TextInput
              style={styles.formInput}
              placeholder="yourname@paytm"
              value={formData.upiId}
              onChangeText={(text) => handleInputChange('upiId', text)}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* Quick Select UPI Apps */}
          <View style={styles.quickSelectContainer}>
            <Text style={styles.quickSelectTitle}>Quick Select UPI App</Text>
            <View style={styles.upiAppsContainer}>
              {popularUPIApps.map((app, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.upiAppButton}
                  onPress={() => handleQuickSelect(app.suffix)}
                >
                  <Ionicons name={app.icon} size={24} color="#2196F3" />
                  <Text style={styles.upiAppText}>{app.name}</Text>
                  <Text style={styles.upiAppSuffix}>{app.suffix}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* UPI Info */}
          <View style={styles.upiInfo}>
            <Ionicons name="information-circle" size={16} color="#2196F3" />
            <Text style={styles.upiInfoText}>
              Enter your UPI ID from any UPI app like Google Pay, PhonePe, Paytm, BHIM, etc.
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
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="qr-code" size={20} color="#fff" />
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
    color: '#4CAF50',
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
  quickSelectContainer: {
    marginBottom: 16,
  },
  quickSelectTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 12,
  },
  upiAppsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  upiAppButton: {
    flexDirection: 'column',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    minWidth: 80,
  },
  upiAppText: {
    fontSize: 10,
    color: '#333',
    marginTop: 4,
    textAlign: 'center',
  },
  upiAppSuffix: {
    fontSize: 8,
    color: '#666',
    marginTop: 2,
  },
  upiInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
  },
  upiInfoText: {
    fontSize: 12,
    color: '#1976d2',
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
  payButton: {
    backgroundColor: '#4CAF50',
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

export default UPIPayment;