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

  const handlePrint = async () => {
    if (Platform.OS === 'web') {
      // Auto-print script to wait for images and styles before printing, then close window
      const autoPrintScript = `
        <script>
          (function() {
            function waitForImagesAndPrint() {
              try {
                var imgs = Array.from(document.images || []);
                if (imgs.length === 0) {
                  setTimeout(function() { window.print(); }, 150);
                  return;
                }
                var loaded = 0;
                function done() {
                  loaded++;
                  if (loaded >= imgs.length) {
                    setTimeout(function() { window.print(); }, 200);
                  }
                }
                imgs.forEach(function(img) {
                  if (img.complete) return done();
                  img.addEventListener('load', done);
                  img.addEventListener('error', done);
                });
              } catch (e) {
                setTimeout(function() { window.print(); }, 200);
              }
            }
            window.addEventListener('load', function() {
              setTimeout(waitForImagesAndPrint, 150);
            });
            if ('onafterprint' in window) {
              window.onafterprint = function() { setTimeout(function(){ window.close(); }, 300); };
            } else {
              // Fallback: close after a delay
              setTimeout(function(){ window.close(); }, 1500);
            }
          })();
        </script>
      `;

      // Try unified two-per-page template first
      try {
        const { generateUnifiedReceiptHTML } = require('../utils/unifiedReceiptTemplate');
        const schoolDetails = {
          name: receiptData.school_name,
          address: receiptData.school_address,
          phone: receiptData.school_phone,
          email: receiptData.school_email,
          academic_year: receiptData.academic_year || '2024-25',
          logo_url: receiptData.school_logo_url,
        };
        const unifiedData = {
          student_name: receiptData.student_name,
          student_admission_no: receiptData.student_admission_no,
          class_name: receiptData.class_name,
          fee_component: receiptData.fee_component,
          payment_date_formatted: receiptData.payment_date_formatted,
          receipt_no: receiptData.receipt_no,
          payment_mode: receiptData.payment_mode,
          amount_paid: receiptData.amount_paid,
          amount_remaining: receiptData.amount_remaining,
          amount_in_words: receiptData.amount_in_words,
          cashier_name: receiptData.cashier_name,
          fine_amount: receiptData.fine_amount,
          total_paid_till_date: receiptData.total_paid_till_date,
          father_name: receiptData.father_name,
          uid: receiptData.uid || receiptData.student_uid,
        };
        let htmlContent = await generateUnifiedReceiptHTML(unifiedData, schoolDetails);
        // Inject auto print script before closing body
        htmlContent = htmlContent.replace('</body>', `${autoPrintScript}</body>`);
        const printWindow = window.open('', '_blank');
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        // Do not call print() here; let the injected script handle it
        return;
      } catch (e) {
        console.warn('Unified template failed, falling back to simple print:', e);
      }

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
      
      let receiptHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Fee Receipt - ${receiptData.receipt_no}</title>
          ${printStyles}
        </head>
        <body>
          <div class=\"receipt-container\">
            <div class=\"receipt-header\">\
              <div class=\"school-name\">${receiptData.school_name || 'School Name'}</div>
              <div style=\"font-size: 14px; color: #666; margin: 5px 0;\">\
                ${receiptData.school_address || 'School Address'}\
              </div>
              <div style=\"font-size: 14px; color: #666;\">\
                Contact: ${receiptData.school_phone || 'Phone'} | Email: ${receiptData.school_email || 'Email'}\
              </div>
              <div class=\"receipt-title\">FEE PAYMENT RECEIPT</div>
            </div>
            
            <div class=\"receipt-info\">\
              <div class=\"info-row\">\
                <span class=\"info-label\">Receipt No:</span>\
                <span class=\"info-value\">${receiptData.receipt_no}</span>\
              </div>
              <div class=\"info-row\">\
                <span class=\"info-label\">Date:</span>\
                <span class=\"info-value\">${receiptData.payment_date_formatted}</span>\
              </div>
              <div class=\"info-row\">\
                <span class=\"info-label\">Academic Year:</span>\
                <span class=\"info-value\">${receiptData.academic_year}</span>\
              </div>
            </div>
            
            <div class=\"receipt-info\">\
              <div class=\"info-row\">\
                <span class=\"info-label\">Student Name:</span>\
                <span class=\"info-value\">${receiptData.student_name}</span>\
              </div>
              <div class=\"info-row\">\
                <span class=\"info-label\">Class:</span>\
                <span class=\"info-value\">${receiptData.class_name}</span>\
              </div>
              <div class=\"info-row\">\
                <span class=\"info-label\">Admission No:</span>\
                <span class=\"info-value\">${receiptData.student_admission_no || 'N/A'}</span>\
              </div>
              <div class=\"info-row\">\
                <span class=\"info-label\">Roll No:</span>\
                <span class=\"info-value\">${receiptData.student_roll_no || 'N/A'}</span>\
              </div>
            </div>
            
            <div class=\"receipt-info\">\
              <div class=\"info-row highlight\">\
                <span class=\"info-label\">Fee Component:</span>\
                <span class=\"info-value\">${receiptData.fee_component}</span>\
              </div>
              <div class=\"info-row\">\
                <span class=\"info-label\">Payment Mode:</span>\
                <span class=\"info-value\">${receiptData.payment_mode}</span>\
              </div>
              ${receiptData.cashier_name ? `\
              <div class=\"info-row\">\
                <span class=\"info-label\">Cashier:</span>\
                <span class=\"info-value\">${receiptData.cashier_name}</span>\
              </div>
              ` : ''}
              ${receiptData.remarks ? `\
              <div class=\"info-row\">\
                <span class=\"info-label\">Remarks:</span>\
                <span class=\"info-value\">${receiptData.remarks}</span>\
              </div>
              ` : ''}
            </div>
            
            <div class=\"amount-section\">\
              <div class=\"amount-row\">\
                <span>Amount Paid:</span>\
                <span>₹${parseFloat(receiptData.amount_paid).toFixed(2)}</span>\
              </div>
              ${receiptData.amount_remaining !== undefined && receiptData.amount_remaining !== null ? `\
              <div class=\"amount-row\">\
                <span>Amount Remaining:</span>\
                <span>₹${parseFloat(receiptData.amount_remaining).toFixed(2)}</span>\
              </div>
              ` : ''}
              <div class=\"words-row\">\
                <strong>In Words:</strong> ${receiptData.amount_in_words} rupees only\
              </div>
            </div>
            
            ${receiptData.cashier_name ? `\
            <div class=\"signature-section\">\
              <div class=\"signature-box\" style=\"margin-left:auto; width:220px; text-align:center;\">\
                <div class=\"signature-line\"></div>\
                <div>Cashier Signature - ${receiptData.cashier_name}</div>\
              </div>\
            </div>
            ` : `\
            <div class=\"signature-section\">\
              <div class=\"signature-box\">\
                <div class=\"signature-line\">Received By</div>\
              </div>\
              <div class=\"signature-box\">\
                <div class=\"signature-line\">Authorized Signature</div>\
              </div>\
            </div>
            `}
            
            <div class=\"footer\">\
              ${receiptData.cashier_name ? `<div style=\"font-size: 12px; color: #666;\">This receipt was generated by: ${receiptData.cashier_name}</div>` : ''}
              <div style=\"font-size: 12px; color: #666;\">\
                This is a computer generated receipt.\
              </div>\
              <div style=\"font-size: 11px; color: #999; margin-top: 5px;\">\
                Generated on: ${format(new Date(), 'dd MMM yyyy, HH:mm')}\
              </div>\
            </div>
          </div>
        </body>
        </html>
      `;

      // Inject auto print script
      receiptHTML = receiptHTML.replace('</body>', `${autoPrintScript}</body>`);

      // Open print dialog
      const printWindow = window.open('', '_blank');
      printWindow.document.write(receiptHTML);
      printWindow.document.close();
      printWindow.focus();
      // Let the injected script call print and close
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
            {/* School Header - Global's Sanmarg Format */}
            <View style={styles.schoolHeader}>
              <View style={styles.headerRow}>
                <View style={styles.logoSection}>
                  <View style={styles.logoPlaceholder}>
                    <Text style={styles.logoText}>🏦</Text>
                  </View>
                </View>
                <View style={styles.schoolInfo}>
                  <Text style={styles.schoolName}>
                    {receiptData.school_name || "GLOBAL'S SANMARG PUBLIC SCHOOL"}
                  </Text>
                  <Text style={styles.schoolAddress}>
                    {receiptData.school_address || 'Near Fateh Darwaza, Pansal Taleem, Bidar-585401'}
                  </Text>
                  <Text style={styles.schoolContact}>
                    Contact: {receiptData.school_phone || '+91 9341111576'}, Email:{receiptData.school_email || 'global295000@gmail.com'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Student Information Grid - Exactly like reference */}
            <View style={styles.studentInfoGrid}>
              <View style={styles.studentRow}>
                <View style={styles.studentLeft}>
                  <Text style={styles.infoLabel}>Student Name: </Text>
                  <Text style={styles.infoValue}>{receiptData.student_name}</Text>
                </View>
                <View style={styles.studentCenter}>
                  <Text style={styles.infoLabel}>UID: </Text>
                  <Text style={styles.infoValue}>{receiptData.uid || receiptData.student_admission_no}</Text>
                </View>
                <View style={styles.studentRight}>
                  <Text style={styles.infoLabel}>Receipt No: </Text>
                  <Text style={styles.infoValue}>{receiptData.receipt_no}</Text>
                </View>
              </View>
              
              <View style={styles.studentRow}>
                <View style={styles.studentLeft}>
                  <Text style={styles.infoLabel}>Fathers Name: </Text>
                  <Text style={styles.infoValue}>{receiptData.father_name || 'N/A'}</Text>
                </View>
                <View style={styles.studentCenter}>
                  <Text style={styles.infoLabel}>Class: </Text>
                  <Text style={styles.infoValue}>{receiptData.class_name}</Text>
                </View>
                <View style={styles.studentRight}>
                  <Text style={styles.infoLabel}>Year: </Text>
                  <Text style={styles.infoValue}>{receiptData.academic_year || '2024/25'}</Text>
                </View>
              </View>
              
              <View style={styles.studentRow}>
                <View style={styles.studentLeft}></View>
                <View style={styles.studentCenter}></View>
                <View style={styles.studentRight}>
                  <Text style={styles.infoLabel}>Date: </Text>
                  <Text style={styles.infoValue}>{receiptData.payment_date_formatted}</Text>
                </View>
              </View>
            </View>

            {/* Fee Table - Exactly like reference */}
            <View style={styles.feeTableContainer}>
              <View style={styles.feeTableHeader}>
                <Text style={styles.tableHeaderLeft}>Particulars</Text>
                <Text style={styles.tableHeaderRight}>Fees Amount</Text>
              </View>
              
              <View style={styles.feeTableBody}>
                <View style={styles.feeRow}>
                  <Text style={styles.feeParticular}>{receiptData.fee_component}</Text>
                  <Text style={styles.feeAmount}>Rs. {Number(receiptData.amount_paid).toLocaleString('en-IN', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</Text>
                </View>
                
                {receiptData.fine_amount && parseFloat(receiptData.fine_amount) > 0 && (
                  <View style={styles.feeRow}>
                    <Text style={styles.feeParticular}>Fine</Text>
                    <Text style={styles.feeAmount}>Rs. {Number(receiptData.fine_amount).toLocaleString('en-IN', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</Text>
                  </View>
                )}
                
                <View style={[styles.feeRow, styles.totalRow]}>
                  <Text style={styles.feeParticularTotal}>Total:</Text>
                  <Text style={styles.feeAmountTotal}>Rs. {Number(
                    (parseFloat(receiptData.amount_paid) || 0) + (parseFloat(receiptData.fine_amount) || 0)
                  ).toLocaleString('en-IN', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</Text>
                </View>
              </View>
            </View>

            {/* Fee Summary - Exactly like reference */}
            <View style={styles.feeSummary}>
              <Text style={styles.summaryText}>Total fees paid : Rs. {Number(
                receiptData.total_paid_till_date || receiptData.amount_paid
              ).toLocaleString('en-IN', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</Text>
              <Text style={styles.summaryText}>Total fees Due : Rs. {Number(
                receiptData.amount_remaining || 0
              ).toLocaleString('en-IN', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</Text>
            </View>

            {/* Footer Section - Exactly like reference */}
            <View style={styles.footerSection}>
              <Text style={styles.wordsText}>In Words: Rupees {receiptData.amount_in_words || 'Zero'} Only</Text>
              <Text style={styles.noteText}>Note: Fees once deposited will not be refunded under any Circumstances</Text>
              
              <View style={styles.footerDetails}>
                <Text style={styles.footerText}>Payment Mode: {receiptData.payment_mode}</Text>
                <Text style={styles.footerText}>Cashier Name:{receiptData.cashier_name || 'System Generated'} &nbsp;&nbsp;&nbsp; Date : {receiptData.payment_date_formatted}</Text>
              </View>
              
              <View style={styles.signatureArea}>
                <View style={styles.signatureBox}>
                  <Text style={styles.signatureText}>Received with thanks,</Text>
                  <View style={styles.signatureLine}>
                    <Text style={styles.signatureLabel}>Cashier/Accountant</Text>
                  </View>
                </View>
              </View>
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
  // Header styles for Global's Sanmarg format
  schoolHeader: {
    borderBottomWidth: 2,
    borderBottomColor: '#000',
    paddingBottom: 15,
    marginBottom: 15,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  logoSection: {
    width: 80,
    marginRight: 15,
    alignItems: 'center',
  },
  logoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f5f5f5',
    borderWidth: 2,
    borderColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 30,
  },
  schoolInfo: {
    flex: 1,
    alignItems: 'center',
  },
  schoolName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 5,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  schoolAddress: {
    fontSize: 12,
    color: '#000',
    textAlign: 'center',
    marginBottom: 2,
  },
  schoolContact: {
    fontSize: 12,
    color: '#000',
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
  // Student Information Grid - Global's Sanmarg format
  studentInfoGrid: {
    marginVertical: 15,
  },
  studentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingBottom: 5,
  },
  studentLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  studentCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#000',
  },
  infoValue: {
    fontSize: 13,
    color: '#000',
  },

  // Fee Table - Global's Sanmarg format
  feeTableContainer: {
    marginVertical: 20,
    borderWidth: 2,
    borderColor: '#000',
  },
  feeTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingVertical: 10,
  },
  tableHeaderLeft: {
    flex: 2,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000',
  },
  tableHeaderRight: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000',
  },
  feeTableBody: {
    backgroundColor: '#fff',
  },
  feeRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  feeParticular: {
    flex: 2,
    fontSize: 13,
    color: '#000',
  },
  feeAmount: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    color: '#000',
  },
  totalRow: {
    backgroundColor: '#fff',
    borderBottomWidth: 0,
  },
  feeParticularTotal: {
    flex: 2,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: 'bold',
    color: '#000',
  },
  feeAmountTotal: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: 'bold',
    color: '#000',
  },

  // Fee Summary - Global's Sanmarg format
  feeSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#000',
    paddingVertical: 10,
    marginVertical: 15,
  },
  summaryText: {
    fontSize: 13,
    color: '#000',
  },

  // Footer Section - Global's Sanmarg format
  footerSection: {
    marginTop: 15,
  },
  wordsText: {
    fontSize: 12,
    color: '#000',
    marginBottom: 3,
  },
  noteText: {
    fontSize: 12,
    color: '#000',
    marginBottom: 10,
  },
  footerDetails: {
    marginBottom: 15,
  },
  footerText: {
    fontSize: 12,
    color: '#000',
    marginVertical: 2,
  },
  signatureArea: {
    alignItems: 'flex-end',
    marginTop: 30,
  },
  signatureBox: {
    alignItems: 'center',
    width: 200,
  },
  signatureText: {
    fontSize: 12,
    color: '#000',
    marginBottom: 30,
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: '#000',
    width: '100%',
    paddingTop: 5,
    alignItems: 'center',
  },
  signatureLabel: {
    fontSize: 12,
    color: '#000',
    textAlign: 'center',
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
