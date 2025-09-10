import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';

const WebReceiptDisplay = ({ visible, receiptData, onClose }) => {
  const printRef = useRef(null);

  const handlePrint = () => {
    if (Platform.OS === 'web') {
      const printContent = printRef.current;
      const originalContents = document.body.innerHTML;
      
      // Create print-specific styles
      const printStyles = `
        <style>
          @media print {
            body { 
              margin: 0; 
              padding: 20px; 
              font-family: Arial, sans-serif;
              background: white;
            }
            .receipt-container {
              max-width: 600px;
              margin: 0 auto;
              background: white;
              border: 2px solid #333;
              padding: 30px;
            }
            .receipt-header {
              text-align: center;
              border-bottom: 2px solid #333;
              padding-bottom: 20px;
              margin-bottom: 20px;
            }
            .school-name {
              font-size: 24px;
              font-weight: bold;
              color: #333;
              margin-bottom: 5px;
            }
            .receipt-title {
              font-size: 18px;
              font-weight: bold;
              color: #666;
              margin-top: 10px;
            }
            .receipt-info {
              margin: 20px 0;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 8px;
              padding: 5px 0;
            }
            .info-row.highlight {
              background-color: #f0f8ff;
              padding: 10px;
              border-left: 4px solid #2196F3;
              font-weight: bold;
            }
            .info-label {
              font-weight: 600;
              color: #333;
            }
            .info-value {
              color: #555;
            }
            .amount-section {
              border: 2px solid #333;
              padding: 15px;
              margin: 20px 0;
              background-color: #f9f9f9;
            }
            .amount-row {
              display: flex;
              justify-content: space-between;
              font-size: 16px;
              font-weight: bold;
              color: #333;
            }
            .words-row {
              font-style: italic;
              color: #666;
              margin-top: 10px;
              text-transform: capitalize;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              border-top: 1px solid #ccc;
              padding-top: 20px;
            }
            .signature-section {
              display: flex;
              justify-content: space-between;
              margin-top: 40px;
              padding-top: 20px;
            }
            .signature-box {
              text-align: center;
              width: 40%;
            }
            .signature-line {
              border-top: 1px solid #333;
              margin-top: 40px;
              padding-top: 5px;
              font-size: 12px;
            }
            @page {
              margin: 0.5in;
            }
          }
        </style>
      `;
      
      const receiptHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Fee Receipt - ${receiptData.receipt_no}</title>
          ${printStyles}
        </head>
        <body>
          <div class="receipt-container">
            <div class="receipt-header">
              <div class="school-name">${receiptData.school_name || 'School Name'}</div>
              <div style="font-size: 14px; color: #666; margin: 5px 0;">
                ${receiptData.school_address || 'School Address'}
              </div>
              <div style="font-size: 14px; color: #666;">
                Contact: ${receiptData.school_phone || 'Phone'} | Email: ${receiptData.school_email || 'Email'}
              </div>
              <div class="receipt-title">FEE PAYMENT RECEIPT</div>
            </div>
            
            <div class="receipt-info">
              <div class="info-row">
                <span class="info-label">Receipt No:</span>
                <span class="info-value">${receiptData.receipt_no}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Date:</span>
                <span class="info-value">${receiptData.payment_date_formatted}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Academic Year:</span>
                <span class="info-value">${receiptData.academic_year}</span>
              </div>
            </div>
            
            <div class="receipt-info">
              <div class="info-row">
                <span class="info-label">Student Name:</span>
                <span class="info-value">${receiptData.student_name}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Class:</span>
                <span class="info-value">${receiptData.class_name}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Admission No:</span>
                <span class="info-value">${receiptData.student_admission_no || 'N/A'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Roll No:</span>
                <span class="info-value">${receiptData.student_roll_no || 'N/A'}</span>
              </div>
            </div>
            
            <div class="receipt-info">
              <div class="info-row highlight">
                <span class="info-label">Fee Component:</span>
                <span class="info-value">${receiptData.fee_component}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Payment Mode:</span>
                <span class="info-value">${receiptData.payment_mode}</span>
              </div>
              ${receiptData.remarks ? `
              <div class="info-row">
                <span class="info-label">Remarks:</span>
                <span class="info-value">${receiptData.remarks}</span>
              </div>
              ` : ''}
            </div>
            
            <div class="amount-section">
              <div class="amount-row">
                <span>Amount Paid:</span>
                <span>₹${parseFloat(receiptData.amount_paid).toFixed(2)}</span>
              </div>
              <div class="words-row">
                <strong>In Words:</strong> ${receiptData.amount_in_words} rupees only
              </div>
            </div>
            
            <div class="signature-section">
              <div class="signature-box">
                <div class="signature-line">Received By</div>
              </div>
              <div class="signature-box">
                <div class="signature-line">Authorized Signature</div>
              </div>
            </div>
            
            <div class="footer">
              <div style="font-size: 12px; color: #666;">
                This is a computer generated receipt.
              </div>
              <div style="font-size: 11px; color: #999; margin-top: 5px;">
                Generated on: ${format(new Date(), 'dd MMM yyyy, HH:mm')}
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      // Open print dialog
      const printWindow = window.open('', '_blank');
      printWindow.document.write(receiptHTML);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }
  };

  if (!visible || !receiptData) return null;

  const formatCurrency = (amount) => {
    const num = parseFloat(amount) || 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Payment Receipt</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handlePrint} style={styles.printButton}>
              <Ionicons name="print" size={20} color="#fff" />
              <Text style={styles.printButtonText}>Print</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View ref={printRef} style={styles.receiptContainer}>
            {/* School Header */}
            <View style={styles.schoolHeader}>
              <Text style={styles.schoolName}>
                {receiptData.school_name || 'School Management System'}
              </Text>
              <Text style={styles.schoolAddress}>
                {receiptData.school_address || 'School Address'}
              </Text>
              <Text style={styles.schoolContact}>
                Contact: {receiptData.school_phone || 'Phone'} | Email: {receiptData.school_email || 'Email'}
              </Text>
              <View style={styles.receiptTitleContainer}>
                <Text style={styles.receiptTitle}>FEE PAYMENT RECEIPT</Text>
              </View>
            </View>

            {/* Receipt Info */}
            <View style={styles.infoSection}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Receipt No:</Text>
                <Text style={styles.infoValue}>{receiptData.receipt_no}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Date:</Text>
                <Text style={styles.infoValue}>{receiptData.payment_date_formatted}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Academic Year:</Text>
                <Text style={styles.infoValue}>{receiptData.academic_year}</Text>
              </View>
            </View>

            {/* Student Info */}
            <View style={styles.infoSection}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Student Name:</Text>
                <Text style={styles.infoValue}>{receiptData.student_name}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Class:</Text>
                <Text style={styles.infoValue}>{receiptData.class_name}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Admission No:</Text>
                <Text style={styles.infoValue}>{receiptData.student_admission_no || 'N/A'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Roll No:</Text>
                <Text style={styles.infoValue}>{receiptData.student_roll_no || 'N/A'}</Text>
              </View>
            </View>

            {/* Payment Details */}
            <View style={styles.infoSection}>
              <View style={[styles.infoRow, styles.highlightRow]}>
                <Text style={styles.infoLabel}>Fee Component:</Text>
                <Text style={styles.infoValue}>{receiptData.fee_component}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Payment Mode:</Text>
                <Text style={styles.infoValue}>{receiptData.payment_mode}</Text>
              </View>
              {receiptData.remarks && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Remarks:</Text>
                  <Text style={styles.infoValue}>{receiptData.remarks}</Text>
                </View>
              )}
            </View>

            {/* Amount Section */}
            <View style={styles.amountSection}>
              <View style={styles.amountRow}>
                <Text style={styles.amountLabel}>Amount Paid:</Text>
                <Text style={styles.amountValue}>
                  {formatCurrency(receiptData.amount_paid)}
                </Text>
              </View>
              <View style={styles.wordsRow}>
                <Text style={styles.wordsLabel}>In Words:</Text>
                <Text style={styles.wordsValue}>
                  {receiptData.amount_in_words} rupees only
                </Text>
              </View>
            </View>

            {/* Signature Section */}
            <View style={styles.signatureSection}>
              <View style={styles.signatureBox}>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureText}>Received By</Text>
              </View>
              <View style={styles.signatureBox}>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureText}>Authorized Signature</Text>
              </View>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                This is a computer generated receipt.
              </Text>
              <Text style={styles.timestampText}>
                Generated on: {format(new Date(), 'dd MMM yyyy, HH:mm')}
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  printButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  printButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  receiptContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 30,
    elevation: 3,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
    borderWidth: 2,
    borderColor: '#333',
  },
  schoolHeader: {
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#333',
    paddingBottom: 20,
    marginBottom: 20,
  },
  schoolName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  schoolAddress: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 5,
  },
  schoolContact: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  receiptTitleContainer: {
    marginTop: 15,
  },
  receiptTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
  },
  infoSection: {
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 5,
  },
  highlightRow: {
    backgroundColor: '#f0f8ff',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
    fontWeight: 'bold',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 0.4,
  },
  infoValue: {
    fontSize: 14,
    color: '#555',
    flex: 0.6,
    textAlign: 'right',
  },
  amountSection: {
    borderWidth: 2,
    borderColor: '#333',
    borderRadius: 8,
    padding: 15,
    marginVertical: 20,
    backgroundColor: '#f9f9f9',
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  amountLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  amountValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  wordsRow: {
    marginTop: 10,
  },
  wordsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
  },
  wordsValue: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    textTransform: 'capitalize',
    marginTop: 2,
  },
  signatureSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 40,
    paddingTop: 20,
  },
  signatureBox: {
    alignItems: 'center',
    width: '40%',
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: '#333',
    width: '100%',
    marginBottom: 5,
    height: 40,
  },
  signatureText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    marginTop: 30,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#ccc',
  },
  footerText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  timestampText: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    marginTop: 5,
  },
});

export default WebReceiptDisplay;
