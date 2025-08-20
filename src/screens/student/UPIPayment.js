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
      
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Payment Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Ionicons name="receipt-outline" size={24} color="#4CAF50" />
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

        {/* UPI Form */}
        <View style={styles.formContainer}>
          <View style={styles.formHeader}>
            <Ionicons name="qr-code-outline" size={24} color="#4CAF50" />
            <Text style={styles.formTitle}>Enter UPI Details</Text>
          </View>
          <Text style={styles.formSubtitle}>Enter your UPI ID to proceed with the payment</Text>
          
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>UPI ID *</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="at-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.formInput}
                placeholder="yourname@paytm"
                placeholderTextColor="#999"
                value={formData.upiId}
                onChangeText={(text) => handleInputChange('upiId', text)}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Quick Select UPI Apps */}
          <View style={styles.quickSelectContainer}>
            <Text style={styles.quickSelectTitle}>Quick Select UPI App</Text>
            <Text style={styles.quickSelectSubtitle}>Tap on your preferred UPI app to auto-fill the suffix</Text>
            <View style={styles.upiAppsContainer}>
              {popularUPIApps.map((app, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.upiAppButton}
                  onPress={() => handleQuickSelect(app.suffix)}
                >
                  <View style={styles.upiAppIconContainer}>
                    <Ionicons name={app.icon} size={24} color="#4CAF50" />
                  </View>
                  <Text style={styles.upiAppText}>{app.name}</Text>
                  <Text style={styles.upiAppSuffix}>{app.suffix}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Security Info */}
          <View style={styles.securityInfo}>
            <View style={styles.securityHeader}>
              <Ionicons name="shield-checkmark" size={18} color="#4CAF50" />
              <Text style={styles.securityTitle}>Secure & Instant</Text>
            </View>
            <Text style={styles.securityText}>
              Your UPI payment is processed instantly and secured with UPI's robust security protocols. No card details required.
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
                <Ionicons name="flash" size={22} color="#fff" />
                <Text style={styles.payButtonText}>
                  Pay ₹{selectedFee.remainingAmount || selectedFee.amount} via UPI
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
    color: '#4CAF50',
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
  quickSelectContainer: {
    marginBottom: 20,
  },
  quickSelectTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  quickSelectSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  upiAppsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  upiAppButton: {
    flexDirection: 'column',
    alignItems: 'center',
    padding: 16,
    borderWidth: 2,
    borderColor: '#e8e8e8',
    borderRadius: 12,
    backgroundColor: '#fff',
    minWidth: 75,
    flex: 0.23,
  },
  upiAppIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f8f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  upiAppText: {
    fontSize: 12,
    color: '#1a1a1a',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  upiAppSuffix: {
    fontSize: 10,
    color: '#4CAF50',
    fontWeight: '500',
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
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#4CAF50',
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

export default UPIPayment;