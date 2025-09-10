import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  FlatList,
  StyleSheet,
  ActivityIndicator 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Header from '../components/Header';
import { UPIDBService } from '../services/UPIDBService';
import { useAuth } from '../utils/AuthContext';

const PaymentVerificationScreen = ({ route, navigation }) => {
  const { transactionId, paymentRecord, studentInfo, feeDetails } = route.params;
  const { user } = useAuth();
  
  const [verificationData, setVerificationData] = useState({
    bankReferenceNumber: '',
    verifiedAmount: feeDetails?.totalAmount?.toString() || paymentRecord?.amount?.toString() || '',
    verificationNotes: '',
    paymentProof: null
  });
  const [isVerifying, setIsVerifying] = useState(false);

  const pickPaymentProof = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        setVerificationData({
          ...verificationData,
          paymentProof: result.assets[0]
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadPaymentProof = async (proofFile, txnId) => {
    // Implement your file upload logic here
    // Return the uploaded file URL
    return `payment_proofs/${txnId}_proof.jpg`;
  };

  const verifyPayment = async (status) => {
    if (status === 'SUCCESS' && !verificationData.bankReferenceNumber.trim()) {
      Alert.alert('Required Field', 'Please enter UPI reference number');
      return;
    }

    if (status === 'SUCCESS' && (!verificationData.verifiedAmount || parseFloat(verificationData.verifiedAmount) <= 0)) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount');
      return;
    }

    setIsVerifying(true);

    try {
      // Create verification record using UPI DB Service
      const verificationDetails = {
        status: status,
        adminId: user.id,
        bankRef: verificationData.bankReferenceNumber,
        notes: verificationData.verificationNotes
      };

      await UPIDBService.verifyUPITransaction(transactionId, verificationDetails);

      if (status === 'SUCCESS') {
        // Create student fee record
        const feeData = {
          studentId: studentInfo?.id || paymentRecord?.student_id,
          feeComponent: feeDetails?.feeComponent || paymentRecord?.fee_component || 'General Fee',
          amount: parseFloat(verificationData.verifiedAmount),
          paymentDate: new Date().toISOString().split('T')[0],
          upiTransactionId: transactionId,
          bankReference: verificationData.bankReferenceNumber,
          tenantId: studentInfo?.tenant_id || paymentRecord?.tenant_id || user?.tenant_id
        };

        console.log('💰 Creating fee record with data:', feeData);
        
        const feeRecord = await UPIDBService.createStudentFeeRecord(feeData);
        
        // Link UPI transaction to fee record
        await UPIDBService.linkToStudentFee(transactionId, feeRecord.id);

        Alert.alert(
          'Payment Verified!', 
          `Payment of ₹${verificationData.verifiedAmount} has been successfully verified and recorded.`,
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      } else {
        Alert.alert(
          'Payment Rejected', 
          'Payment has been marked as failed.',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error verifying payment:', error);
      Alert.alert('Error', 'Failed to verify payment. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Create data array for FlatList rendering
  const verificationData_array = [
    {
      id: 'header',
      type: 'header',
      data: { transactionId: transactionId || paymentRecord?.reference_number || 'N/A' }
    },
    {
      id: 'student',
      type: 'student',
      data: {
        name: studentInfo?.name || paymentRecord?.student?.name || 'Unknown Student',
        amount: feeDetails?.totalAmount || paymentRecord?.amount || '0',
        feeComponent: feeDetails?.feeComponent || paymentRecord?.fee_component || 'General Fee'
      }
    },
    {
      id: 'form',
      type: 'form',
      data: {}
    },
    {
      id: 'actions',
      type: 'actions',
      data: {}
    }
  ];

  const renderVerificationItem = ({ item }) => {
    switch (item.type) {
      case 'header':
        return (
          <View style={styles.header}>
            <Text style={styles.transactionId}>
              Transaction: {item.data.transactionId}
            </Text>
          </View>
        );
      
      case 'student':
        return (
          <View style={styles.studentCard}>
            <Text style={styles.studentName}>{item.data.name}</Text>
            <Text style={styles.amount}>Amount: ₹{item.data.amount}</Text>
            <Text style={styles.feeComponent}>{item.data.feeComponent}</Text>
          </View>
        );
      
      case 'form':
        return (
          <View style={styles.verificationForm}>
            <Text style={styles.formTitle}>Verification Details</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>UPI Reference Number *</Text>
              <TextInput
                style={styles.input}
                value={verificationData.bankReferenceNumber}
                onChangeText={(text) => setVerificationData({
                  ...verificationData,
                  bankReferenceNumber: text.toUpperCase()
                })}
                placeholder="Enter 12-digit UTR/Ref number"
                maxLength={20}
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Verified Amount</Text>
              <TextInput
                style={styles.input}
                value={verificationData.verifiedAmount}
                onChangeText={(text) => setVerificationData({
                  ...verificationData,
                  verifiedAmount: text
                })}
                placeholder="0.00"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Verification Notes (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={verificationData.verificationNotes}
                onChangeText={(text) => setVerificationData({
                  ...verificationData,
                  verificationNotes: text
                })}
                placeholder="Any additional notes about this verification..."
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Payment Proof (Optional)</Text>
              <TouchableOpacity style={styles.imageButton} onPress={pickPaymentProof}>
                <Ionicons name="camera" size={24} color="#2196F3" />
                <Text style={styles.imageButtonText}>
                  {verificationData.paymentProof ? 'Change Screenshot' : 'Upload Screenshot'}
                </Text>
              </TouchableOpacity>
              {verificationData.paymentProof && (
                <Text style={styles.imageSelected}>✓ Screenshot selected</Text>
              )}
            </View>
          </View>
        );
      
      case 'actions':
        return (
          <View style={styles.actions}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => verifyPayment('FAILED')}
              disabled={isVerifying}
            >
              <Ionicons name="close-circle-outline" size={20} color="white" />
              <Text style={styles.rejectButtonText}>Reject Payment</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, styles.verifyButton]}
              onPress={() => verifyPayment('SUCCESS')}
              disabled={isVerifying}
            >
              {isVerifying ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="checkmark-circle-outline" size={20} color="white" />
              )}
              <Text style={styles.verifyButtonText}>
                {isVerifying ? 'Verifying...' : 'Verify Payment'}
              </Text>
            </TouchableOpacity>
          </View>
        );
      
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <Header 
        title="Verify Payment" 
        showBack={true} 
        navigation={navigation}
      />
      
      <FlatList
        data={verificationData_array}
        keyExtractor={(item) => item.id}
        renderItem={renderVerificationItem}
        showsVerticalScrollIndicator={true}
        scrollEnabled={true}
        bounces={true}
        contentContainerStyle={styles.flatListContent}
        style={styles.flatListStyle}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={false}
        ListHeaderComponent={() => (
          <View style={styles.listHeaderSpacer}>
            <Text style={styles.listHeaderText}>📋 Payment Verification Form</Text>
          </View>
        )}
        ListFooterComponent={() => (
          <View style={styles.listFooterSpacer}>
            <Text style={styles.listFooterText}>Verify payment details carefully</Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  flatListStyle: {
    flex: 1,
  },
  flatListContent: {
    paddingBottom: 100, // Extra padding for better scroll experience
    flexGrow: 1,
  },
  listHeaderSpacer: {
    backgroundColor: '#e3f2fd',
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginBottom: 5,
    alignItems: 'center',
  },
  listHeaderText: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: 'bold',
  },
  listFooterSpacer: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginTop: 20,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 20,
  },
  listFooterText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  header: {
    backgroundColor: 'white',
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginBottom: 20,
  },
  transactionId: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'monospace',
  },
  studentCard: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    marginTop: 0,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  studentName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  amount: {
    fontSize: 18,
    color: '#4CAF50',
    fontWeight: '600',
    marginBottom: 4,
  },
  feeComponent: {
    fontSize: 14,
    color: '#666',
  },
  verificationForm: {
    backgroundColor: 'white',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  imageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#2196F3',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 20,
  },
  imageButtonText: {
    color: '#2196F3',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  imageSelected: {
    color: '#4CAF50',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    padding: 20,
    gap: 15,
    marginBottom: 40,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 12,
    gap: 8,
  },
  rejectButton: {
    backgroundColor: '#f44336',
  },
  rejectButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  verifyButton: {
    backgroundColor: '#4CAF50',
  },
  verifyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default PaymentVerificationScreen;
