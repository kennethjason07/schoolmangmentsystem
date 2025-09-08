# UPI Payment Implementation Guide
## Admin QR Code Generation & Manual Verification System

This guide provides a complete implementation for UPI payments in your school management system using QR codes and manual admin verification - **Zero transaction fees!**

---

## 🏗️ 1. Database Schema Enhancement

### Enhanced Payment Transactions Table

```sql
-- Add QR code support to payment transactions
ALTER TABLE public.payment_transactions ADD COLUMN qr_code_data text;
ALTER TABLE public.payment_transactions ADD COLUMN qr_code_url text;
ALTER TABLE public.payment_transactions ADD COLUMN verified_by uuid REFERENCES public.users(id);
ALTER TABLE public.payment_transactions ADD COLUMN verification_notes text;
ALTER TABLE public.payment_transactions ADD COLUMN payment_proof_url text;

-- Create admin verification log
CREATE TABLE public.payment_verifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.payment_transactions(id),
  verified_by uuid NOT NULL REFERENCES public.users(id),
  verification_status varchar(50) NOT NULL, -- 'VERIFIED', 'REJECTED', 'PENDING_INFO'
  verification_notes text,
  bank_reference_number varchar(255),
  verified_amount numeric,
  verified_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  tenant_id uuid NOT NULL,
  CONSTRAINT payment_verifications_pkey PRIMARY KEY (id)
);
```

---

## 📱 2. Required Dependencies

Add these dependencies to your `package.json`:

```json
{
  "dependencies": {
    "react-native-qrcode-svg": "^6.2.0",
    "react-native-view-shot": "^3.8.0",
    "react-native-svg": "^13.4.0",
    "expo-image-picker": "^14.3.2",
    "expo-sharing": "^11.5.0"
  }
}
```

Install dependencies:
```bash
npm install react-native-qrcode-svg react-native-view-shot react-native-svg
```

---

## 🔧 3. UPI QR Code Service

Create `services/UPIQRService.js`:

```javascript
// services/UPIQRService.js
import QRCode from 'react-native-qrcode-svg';

class UPIQRService {
  static generateUPIString(paymentDetails) {
    const {
      merchantUPI,        // Your school's UPI ID
      merchantName,       // School name
      transactionId,      // Unique transaction ID
      amount,            // Payment amount
      note               // Payment note
    } = paymentDetails;

    // Standard UPI QR format
    const upiString = `upi://pay?pa=${merchantUPI}&pn=${encodeURIComponent(merchantName)}&tid=${transactionId}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;
    
    return upiString;
  }

  static getPaymentDetails(studentInfo, feeDetails, transactionId) {
    return {
      merchantUPI: 'yourschool@paytm', // Replace with your school's UPI ID
      merchantName: 'VidyaSetu School',
      transactionId: transactionId,
      amount: feeDetails.totalAmount,
      note: `Fee Payment - ${studentInfo.name} (${studentInfo.admission_no}) - ${feeDetails.components.join(', ')}`
    };
  }

  static generateTransactionId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 5);
    return `VS${timestamp}${random}`.toUpperCase();
  }
}

export default UPIQRService;
```

---

## 💳 4. Admin Payment Screen with QR Code

Create `screens/AdminPaymentScreen.js`:

```javascript
// screens/AdminPaymentScreen.js
import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Alert, 
  Modal, 
  StyleSheet,
  Share 
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';
import UPIQRService from '../services/UPIQRService';
import PaymentDBService from '../services/PaymentDBService';

const AdminPaymentScreen = ({ route, navigation }) => {
  const { studentInfo, feeDetails } = route.params;
  const [showQRModal, setShowQRModal] = useState(false);
  const [paymentRecord, setPaymentRecord] = useState(null);
  const [transactionId, setTransactionId] = useState('');
  const qrRef = useRef();

  const handlePaymentInitiation = async () => {
    try {
      // Generate unique transaction ID
      const txnId = UPIQRService.generateTransactionId();
      setTransactionId(txnId);

      // Create payment record in database
      const paymentData = {
        student_id: studentInfo.id,
        merchant_transaction_id: txnId,
        amount: feeDetails.totalAmount,
        fee_components: feeDetails.components,
        payment_status: 'QR_GENERATED',
        created_by: currentUser.id, // Admin who initiated
        tenant_id: currentUser.tenant_id
      };

      const record = await PaymentDBService.createPaymentRecord(paymentData);
      setPaymentRecord(record);

      // Show QR code modal
      setShowQRModal(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to generate payment QR code');
    }
  };

  const QRCodeModal = () => {
    const paymentDetails = UPIQRService.getPaymentDetails(
      studentInfo, 
      feeDetails, 
      transactionId
    );
    const upiString = UPIQRService.generateUPIString(paymentDetails);

    return (
      <Modal
        visible={showQRModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.qrModalContainer}>
          <View style={styles.qrHeader}>
            <Text style={styles.qrTitle}>UPI Payment</Text>
            <TouchableOpacity 
              onPress={() => setShowQRModal(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.paymentDetails}>
            <Text style={styles.studentName}>{studentInfo.name}</Text>
            <Text style={styles.admissionNo}>({studentInfo.admission_no})</Text>
            <Text style={styles.amount}>₹{feeDetails.totalAmount}</Text>
            <Text style={styles.transactionId}>ID: {transactionId}</Text>
          </View>

          <View style={styles.qrContainer} ref={qrRef}>
            <QRCode
              value={upiString}
              size={250}
              backgroundColor="white"
              color="black"
              logo={require('../assets/school-logo.png')}
              logoSize={50}
            />
          </View>

          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsTitle}>Payment Instructions:</Text>
            <Text style={styles.instruction}>1. Open any UPI app (PhonePe, Google Pay, etc.)</Text>
            <Text style={styles.instruction}>2. Scan this QR code</Text>
            <Text style={styles.instruction}>3. Verify payment details</Text>
            <Text style={styles.instruction}>4. Complete payment with UPI PIN</Text>
            <Text style={styles.instruction}>5. Show payment confirmation to admin</Text>
          </View>

          <View style={styles.qrActions}>
            <TouchableOpacity 
              style={styles.shareButton}
              onPress={shareQRCode}
            >
              <Text style={styles.shareText}>Share QR Code</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.verifyButton}
              onPress={navigateToVerification}
            >
              <Text style={styles.verifyText}>Payment Done - Verify</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  const shareQRCode = async () => {
    try {
      const uri = await captureRef(qrRef, {
        format: 'png',
        quality: 0.9,
      });
      
      // Share QR code image
      await Share.share({
        url: uri,
        message: `UPI Payment QR for ${studentInfo.name} - Amount: ₹${feeDetails.totalAmount}`
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share QR code');
    }
  };

  const navigateToVerification = () => {
    setShowQRModal(false);
    navigation.navigate('PaymentVerification', {
      transactionId,
      paymentRecord,
      studentInfo,
      feeDetails
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.studentCard}>
        <Text style={styles.studentName}>{studentInfo.name}</Text>
        <Text style={styles.class}>Class: {studentInfo.class_name}</Text>
        <Text style={styles.admissionNo}>Admission No: {studentInfo.admission_no}</Text>
      </View>

      <View style={styles.feeCard}>
        <Text style={styles.feeTitle}>Fee Details</Text>
        {feeDetails.components.map((fee, index) => (
          <View key={index} style={styles.feeRow}>
            <Text style={styles.feeComponent}>{fee.component}</Text>
            <Text style={styles.feeAmount}>₹{fee.amount}</Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total Amount</Text>
          <Text style={styles.totalAmount}>₹{feeDetails.totalAmount}</Text>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.payButton}
        onPress={handlePaymentInitiation}
      >
        <Text style={styles.payButtonText}>Generate Payment QR Code</Text>
      </TouchableOpacity>

      <QRCodeModal />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  studentCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  studentName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  class: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  admissionNo: {
    fontSize: 16,
    color: '#666',
  },
  feeCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  feeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  feeComponent: {
    fontSize: 16,
    color: '#666',
  },
  feeAmount: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderTopWidth: 2,
    borderTopColor: '#ddd',
    marginTop: 10,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  payButton: {
    backgroundColor: '#4CAF50',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  payButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // QR Modal Styles
  qrModalContainer: {
    flex: 1,
    backgroundColor: 'white',
    padding: 20,
  },
  qrHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    paddingTop: 20,
  },
  qrTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 10,
  },
  closeText: {
    fontSize: 24,
    color: '#666',
  },
  paymentDetails: {
    alignItems: 'center',
    marginBottom: 30,
  },
  amount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginVertical: 10,
  },
  transactionId: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'monospace',
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 30,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  instructionsContainer: {
    backgroundColor: '#f8f9fa',
    padding: 20,
    borderRadius: 12,
    marginBottom: 30,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  instruction: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
    paddingLeft: 10,
  },
  qrActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
  },
  shareButton: {
    flex: 1,
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  shareText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  verifyButton: {
    flex: 1,
    backgroundColor: '#FF9800',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  verifyText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AdminPaymentScreen;
```

---

## ✅ 5. Payment Verification Screen

Create `screens/PaymentVerificationScreen.js`:

```javascript
// screens/PaymentVerificationScreen.js
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  ScrollView,
  StyleSheet 
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import PaymentDBService from '../services/PaymentDBService';

const PaymentVerificationScreen = ({ route, navigation }) => {
  const { transactionId, paymentRecord, studentInfo, feeDetails } = route.params;
  const [verificationData, setVerificationData] = useState({
    bankReferenceNumber: '',
    verifiedAmount: feeDetails.totalAmount.toString(),
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
    if (!verificationData.bankReferenceNumber.trim()) {
      Alert.alert('Required', 'Please enter bank reference number');
      return;
    }

    setIsVerifying(true);

    try {
      // Upload payment proof if available
      let proofUrl = null;
      if (verificationData.paymentProof) {
        proofUrl = await uploadPaymentProof(verificationData.paymentProof, transactionId);
      }

      // Create verification record
      const verificationRecord = {
        transaction_id: paymentRecord.id,
        verified_by: currentUser.id,
        verification_status: status,
        verification_notes: verificationData.verificationNotes,
        bank_reference_number: verificationData.bankReferenceNumber,
        verified_amount: parseFloat(verificationData.verifiedAmount),
        tenant_id: currentUser.tenant_id
      };

      await PaymentDBService.createVerificationRecord(verificationRecord);

      // Update payment transaction status
      const paymentUpdateData = {
        payment_status: status === 'VERIFIED' ? 'SUCCESS' : 'FAILED',
        verified_by: currentUser.id,
        verification_notes: verificationData.verificationNotes,
        payment_proof_url: proofUrl,
        completed_at: new Date().toISOString()
      };

      await PaymentDBService.updatePaymentTransaction(transactionId, paymentUpdateData);

      if (status === 'VERIFIED') {
        // Create fee payment record
        await PaymentDBService.createFeePaymentRecord({
          student_id: studentInfo.id,
          academic_year: new Date().getFullYear().toString(),
          fee_components: feeDetails.components,
          amount_paid: parseFloat(verificationData.verifiedAmount),
          payment_date: new Date().toISOString().split('T')[0],
          payment_mode: 'UPI',
          receipt_number: await PaymentDBService.generateReceiptNumber(),
          remarks: `UPI Payment - Ref: ${verificationData.bankReferenceNumber}`,
          tenant_id: currentUser.tenant_id
        });

        // Generate and show receipt
        await generatePaymentReceipt({
          transactionId,
          studentInfo,
          feeDetails,
          verificationData,
          receiptNumber: await PaymentDBService.generateReceiptNumber()
        });

        Alert.alert(
          'Payment Verified',
          'Payment has been successfully verified and receipt generated.',
          [
            {
              text: 'View Receipt',
              onPress: () => navigation.navigate('PaymentReceipt', { transactionId })
            },
            {
              text: 'Done',
              onPress: () => navigation.navigate('AdminDashboard')
            }
          ]
        );
      } else {
        Alert.alert('Payment Rejected', 'Payment has been rejected and student will be notified.');
        navigation.navigate('AdminDashboard');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to verify payment');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Verify Payment</Text>
        <Text style={styles.transactionId}>Transaction: {transactionId}</Text>
      </View>

      <View style={styles.studentCard}>
        <Text style={styles.studentName}>{studentInfo.name}</Text>
        <Text style={styles.amount}>Amount: ₹{feeDetails.totalAmount}</Text>
      </View>

      <View style={styles.verificationForm}>
        <Text style={styles.formTitle}>Verification Details</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Bank Reference Number *</Text>
          <TextInput
            style={styles.input}
            value={verificationData.bankReferenceNumber}
            onChangeText={(text) => setVerificationData({
              ...verificationData,
              bankReferenceNumber: text
            })}
            placeholder="Enter UPI reference number"
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
            keyboardType="numeric"
            placeholder="0.00"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Verification Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={verificationData.verificationNotes}
            onChangeText={(text) => setVerificationData({
              ...verificationData,
              verificationNotes: text
            })}
            placeholder="Add any notes about this verification"
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Payment Proof (Optional)</Text>
          <TouchableOpacity style={styles.imageButton} onPress={pickPaymentProof}>
            <Text style={styles.imageButtonText}>
              {verificationData.paymentProof ? 'Change Image' : 'Upload Screenshot'}
            </Text>
          </TouchableOpacity>
          {verificationData.paymentProof && (
            <Text style={styles.imageSelected}>✓ Image selected</Text>
          )}
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.verifyButton]}
          onPress={() => verifyPayment('VERIFIED')}
          disabled={isVerifying}
        >
          <Text style={styles.verifyButtonText}>
            {isVerifying ? 'Verifying...' : 'Verify Payment'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionButton, styles.rejectButton]}
          onPress={() => verifyPayment('REJECTED')}
          disabled={isVerifying}
        >
          <Text style={styles.rejectButtonText}>Reject Payment</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: 'white',
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
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
    borderWidth: 2,
    borderColor: '#2196F3',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
  },
  imageButtonText: {
    color: '#2196F3',
    fontSize: 16,
    fontWeight: '600',
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
  },
  actionButton: {
    flex: 1,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  verifyButton: {
    backgroundColor: '#4CAF50',
  },
  verifyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  rejectButton: {
    backgroundColor: '#f44336',
  },
  rejectButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default PaymentVerificationScreen;
```

---

## 🗄️ 6. Database Service

Create `services/PaymentDBService.js`:

```javascript
// services/PaymentDBService.js
import { supabase } from '../lib/supabase'; // Your supabase client

class PaymentDBService {
  static async createPaymentRecord(paymentData) {
    const { data, error } = await supabase
      .from('payment_transactions')
      .insert(paymentData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async createVerificationRecord(verificationData) {
    const { data, error } = await supabase
      .from('payment_verifications')
      .insert(verificationData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async updatePaymentTransaction(transactionId, updateData) {
    const { data, error } = await supabase
      .from('payment_transactions')
      .update(updateData)
      .eq('merchant_transaction_id', transactionId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async createFeePaymentRecord(feeData) {
    const { data, error } = await supabase
      .from('student_fees')
      .insert(feeData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async generateReceiptNumber() {
    // Generate unique receipt number
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `RCP${timestamp}${random}`;
  }

  static async getPaymentHistory(studentId, limit = 10) {
    const { data, error } = await supabase
      .from('payment_transactions')
      .select(`
        *,
        student:students(name, admission_no),
        verifications:payment_verifications(*)
      `)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data;
  }

  static async getPendingVerifications(tenantId) {
    const { data, error } = await supabase
      .from('payment_transactions')
      .select(`
        *,
        student:students(name, admission_no, class_id),
        class:students.classes(class_name)
      `)
      .eq('tenant_id', tenantId)
      .eq('payment_status', 'QR_GENERATED')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  }
}

export default PaymentDBService;
```

---

## 📱 7. Navigation Setup

Add these screens to your navigation:

```javascript
// navigation/AppNavigator.js
import AdminPaymentScreen from '../screens/AdminPaymentScreen';
import PaymentVerificationScreen from '../screens/PaymentVerificationScreen';

const Stack = createStackNavigator();

function AppNavigator() {
  return (
    <Stack.Navigator>
      {/* Your existing screens */}
      
      <Stack.Screen 
        name="AdminPayment" 
        component={AdminPaymentScreen}
        options={{ 
          title: 'Process Payment',
          headerStyle: { backgroundColor: '#4CAF50' },
          headerTintColor: 'white'
        }}
      />
      
      <Stack.Screen 
        name="PaymentVerification" 
        component={PaymentVerificationScreen}
        options={{ 
          title: 'Verify Payment',
          headerStyle: { backgroundColor: '#FF9800' },
          headerTintColor: 'white'
        }}
      />
    </Stack.Navigator>
  );
}
```

---

## ⚙️ 8. Configuration

### School UPI ID Setup

1. **Get School UPI ID**: Register your school with any UPI provider (Paytm, PhonePe, etc.)
2. **Update UPI ID**: Replace `yourschool@paytm` in `UPIQRService.js` with your actual UPI ID
3. **Add School Logo**: Place your school logo in `assets/school-logo.png`

### Environment Configuration

Create `.env` file:
```env
SCHOOL_UPI_ID=yourschool@paytm
SCHOOL_NAME="VidyaSetu School"
MERCHANT_NAME="VidyaSetu School Fee Payment"
```

---

## 🔄 9. Usage Workflow

### Admin Process:
1. **Select Student** → Navigate to fee payment screen
2. **Click "Generate QR"** → System creates transaction and shows QR code
3. **Student/Parent Scans QR** → They use any UPI app to scan and pay
4. **Payment Completion** → User completes payment in their UPI app
5. **Verify Payment** → Admin clicks "Verify" and enters reference number
6. **Receipt Generation** → System creates receipt and updates all records

### Database Flow:
1. **Transaction Created** → Status: `QR_GENERATED`
2. **Payment Made** → User completes UPI payment
3. **Admin Verification** → Status: `SUCCESS` or `FAILED`
4. **Fee Record Updated** → Entry added to `student_fees` table
5. **Receipt Generated** → PDF receipt created and stored

---

## 💰 10. Benefits

### Financial Benefits:
- **Zero Transaction Fees** - No payment gateway costs
- **Direct UPI Payments** - Money goes directly to your account
- **No Monthly/Annual Fees** - Unlike payment gateways
- **Estimated Savings**: ₹2-4+ lakhs annually for medium schools

### Technical Benefits:
- **Universal UPI Support** - Works with all UPI apps
- **Simple Implementation** - No complex API integrations
- **Admin Control** - Complete manual verification system
- **Audit Trail** - Complete payment verification history
- **Offline Capable** - Works even with poor internet

### User Experience:
- **Familiar Interface** - Parents use their preferred UPI app
- **Instant Payment** - Real-time UPI transactions
- **QR Code Sharing** - Can share QR via WhatsApp/SMS
- **Receipt Generation** - Professional PDF receipts

---

## 🛠️ 11. Additional Features

### Payment Dashboard
Create an admin dashboard to view:
- Pending verifications
- Payment history
- Daily/monthly collection reports
- Failed payment analysis

### Notification System
Implement SMS/Email notifications for:
- Payment QR generation
- Payment completion confirmations
- Receipt delivery to parents

### Bulk Payment Processing
Add features for:
- Multiple student fee payments
- Class-wise payment collection
- Scholarship/discount applications

---

## 📋 12. Testing Checklist

- [ ] QR code generates correctly
- [ ] UPI apps can scan and parse QR code
- [ ] Payment amount displays correctly in UPI app
- [ ] Transaction ID is unique and trackable
- [ ] Admin can verify payments successfully
- [ ] Fee records are updated correctly
- [ ] Receipts generate properly
- [ ] Database constraints work as expected

---

## 🚀 Implementation Steps

1. **Database Setup** - Run the SQL schema updates
2. **Install Dependencies** - Add required npm packages
3. **Create Services** - Implement UPIQRService and PaymentDBService
4. **Build Screens** - Create payment and verification screens
5. **Navigation Setup** - Add screens to your navigator
6. **Configuration** - Set up school UPI ID and branding
7. **Testing** - Test the complete payment flow
8. **Production Setup** - Configure production UPI ID and settings

---

## 🎯 Result

You'll have a complete UPI payment system that:
- Generates professional QR codes for payments
- Supports ALL UPI apps (PhonePe, Google Pay, Amazon Pay, etc.)
- Provides admin control over payment verification
- Saves thousands in transaction fees annually
- Maintains complete audit trails
- Works reliably without external API dependencies

**Total Cost: ₹0 transaction fees vs ₹2-4+ lakhs annually with payment gateways!**
