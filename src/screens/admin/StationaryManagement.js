import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Header from '../../components/Header';
import { Picker } from '@react-native-picker/picker';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useTenant } from '../../contexts/TenantContext';
import { useAuth } from '../../utils/AuthContext';
import StationaryServiceEnhanced from '../../services/StationaryServiceEnhanced';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../../utils/supabase';

const StationaryManagement = ({ navigation }) => {
  const { user } = useAuth();
  
  // 🏢 EMAIL-BASED TENANT SYSTEM: All tenant info derived from user email
  console.log('🔐 StationaryManagement - Email-Based Authentication:', {
    userId: user?.id,
    userEmail: user?.email,
    timestamp: new Date().toISOString()
  });
  
  // 🚨 CRITICAL: Validate authenticated user before proceeding
  useEffect(() => {
    if (!user?.email) {
      console.warn('⚠️ StationaryManagement: No authenticated user or email available');
      Alert.alert(
        'Authentication Error', 
        'No authenticated user found. Please log in again.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
      return;
    }
    
    console.log('✅ StationaryManagement: Using authenticated user:', user.email);
  }, [user]);
  
  // 📊 Store tenant information (loaded dynamically via email)
  const [tenantInfo, setTenantInfo] = useState(null);
  const [tenantLoading, setTenantLoading] = useState(true);
  
  // Tab state
  const [activeTab, setActiveTab] = useState('items');
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Data states
  const [items, setItems] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [schoolDetails, setSchoolDetails] = useState(null);
  const [analytics, setAnalytics] = useState({
    totalRevenue: 0,
    totalQuantitySold: 0,
    totalTransactions: 0,
    categoryBreakdown: {}
  });
  
  // Modal states
  const [itemModal, setItemModal] = useState({
    visible: false,
    editMode: false,
    item: {
      name: '',
      description: '',
      fee_amount: ''
    }
  });
  
  const [feeModal, setFeeModal] = useState({
    visible: false,
    step: 1, // 1: select class, 2: select student, 3: select items and pay
    payment: {
      class_id: '',
      student_id: '',
      selected_items: [],
      payment_mode: 'Cash',
      remarks: ''
    }
  });

  const [receiptModal, setReceiptModal] = useState({
    visible: false,
    receipt: null
  });
  
  // Filter states
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  const [selectedClass, setSelectedClass] = useState('');

  // Load data on component mount and focus
  useFocusEffect(
    useCallback(() => {
      if (user?.email) {
        initializeComponent();
      }
    }, [user?.email])
  );
  
  // Initialize component with email-based tenant validation
  const initializeComponent = async () => {
    console.log('🚀 StationaryManagement: Initializing email-based tenant system...');
    
    if (!user?.email) {
      console.error('❌ No authenticated user email available');
      setTenantLoading(false);
      return;
    }
    
    try {
      setTenantLoading(true);
      
      // Use enhanced service to load all data with tenant validation
      const result = await StationaryServiceEnhanced.loadAllData(user);
      
      if (!result.success) {
        console.error('❌ Failed to initialize tenant system:', result.error);
        Alert.alert(
          'Access Denied',
          result.error,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        return;
      }
      
      // Store tenant info and load data
      setTenantInfo(result.tenant);
      setItems(result.data.items || []);
      setClasses(result.data.classes || []);
      setSchoolDetails(result.data.schoolDetails);
      
      console.log('✅ Email-based tenant system initialized successfully');
      console.log('🏢 Tenant:', result.tenant.name);
      
      // Load additional data
      await Promise.all([
        loadPurchases(),
        loadAnalytics()
      ]);
      
    } catch (error) {
      console.error('❌ Failed to initialize component:', error);
      Alert.alert(
        'Initialization Error',
        `Failed to load stationary management: ${error.message}`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } finally {
      setTenantLoading(false);
      setLoading(false);
    }
  };
  

  const loadData = async () => {
    console.log('🔄 StationaryManagement: Refreshing data with email-based tenant system...');
    
    if (!user?.email) {
      console.error('❌ No authenticated user email available for data refresh');
      return;
    }
    
    setLoading(true);
    try {
      await Promise.all([
        loadItems(),
        loadPurchases(),
        loadClasses(),
        loadAnalytics()
      ]);
      console.log('✅ StationaryManagement: All data refreshed successfully');
    } catch (error) {
      console.error('❌ StationaryManagement: Error refreshing data:', error);
      Alert.alert('Error', `Failed to refresh data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadItems = async () => {
    try {
      console.log('🔍 Loading stationary items via email-based tenant system');
      const itemsData = await StationaryServiceEnhanced.getStationaryItems(true);
      console.log('📦 Loaded items:', itemsData?.length, 'items');
      setItems(itemsData);
    } catch (error) {
      console.error('❌ Error loading items:', error);
    }
  };

  const loadPurchases = async () => {
    try {
      console.log('🔍 Loading purchases via email-based tenant system, date range:', dateRange);
      const purchasesData = await StationaryServiceEnhanced.getPurchases({
        startDate: dateRange.start,
        endDate: dateRange.end
      });
      console.log('📄 Loaded purchases:', purchasesData?.length, 'purchases');
      setPurchases(purchasesData);
    } catch (error) {
      console.error('❌ Error loading purchases:', error);
    }
  };

  const loadClasses = async () => {
    try {
      console.log('🔍 Loading classes via email-based tenant system');
      const classesData = await StationaryServiceEnhanced.getClasses();
      console.log('🏢 Loaded classes:', classesData?.length, 'classes');
      setClasses(classesData);
    } catch (error) {
      console.error('❌ Error loading classes:', error);
    }
  };

  const loadStudents = async (classId) => {
    try {
      console.log('🔍 Loading students for class:', classId, 'via email-based tenant system');
      const studentsData = await StationaryServiceEnhanced.getStudentsByClass(classId);
      console.log('👥 Loaded students:', studentsData?.length, 'students');
      setStudents(studentsData);
    } catch (error) {
      console.error('Error loading students:', error);
    }
  };

  const loadSchoolDetails = async () => {
    try {
      console.log('🔍 Loading school details via email-based tenant system');
      const schoolData = await StationaryServiceEnhanced.getSchoolDetails();
      console.log('🏠 Loaded school details');
      setSchoolDetails(schoolData);
    } catch (error) {
      console.error('❌ Error loading school details:', error);
    }
  };

  const loadAnalytics = async () => {
    try {
      console.log('🔍 Loading analytics via email-based tenant system');
      const analyticsData = await StationaryServiceEnhanced.getSalesAnalytics(
        dateRange.start,
        dateRange.end
      );
      console.log('📈 Loaded analytics:', analyticsData);
      setAnalytics(analyticsData);
    } catch (error) {
      console.error('❌ Error loading analytics:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // ============ ITEM MANAGEMENT ============
  
  const handleSaveItem = async () => {
    if (!itemModal.item.name || !itemModal.item.fee_amount) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      const itemData = {
        name: itemModal.item.name,
        description: itemModal.item.description || '',
        fee_amount: parseFloat(itemModal.item.fee_amount),
        is_active: true
      };

      if (itemModal.editMode && itemModal.item.id) {
        await StationaryServiceEnhanced.updateStationaryItem(itemModal.item.id, itemData);
        Alert.alert('Success', 'Fee item updated successfully');
      } else {
        await StationaryServiceEnhanced.addStationaryItem(itemData);
        Alert.alert('Success', 'Fee item added successfully');
      }

      setItemModal({
        visible: false,
        editMode: false,
        item: {
          name: '',
          description: '',
          fee_amount: ''
        }
      });
      
      loadItems();
    } catch (error) {
      console.error('Error saving item:', error);
      Alert.alert('Error', 'Failed to save item. Please try again.');
    }
  };

  const handleDeleteItem = (itemId) => {
    Alert.alert(
      'Delete Item',
      'Are you sure you want to delete this fee item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await StationaryServiceEnhanced.deleteStationaryItem(itemId);
              Alert.alert('Success', 'Fee item deleted successfully');
              loadItems();
            } catch (error) {
              console.error('Error deleting item:', error);
              Alert.alert('Error', 'Failed to delete item');
            }
          }
        }
      ]
    );
  };

  // ============ FEE PAYMENT ============

  const handleClassSelection = (classId) => {
    setFeeModal(prev => ({
      ...prev,
      payment: { ...prev.payment, class_id: classId, student_id: '' },
      step: 2
    }));
    loadStudents(classId);
  };

  const handleStudentSelection = (studentId) => {
    setFeeModal(prev => ({
      ...prev,
      payment: { ...prev.payment, student_id: studentId },
      step: 3
    }));
  };

  const toggleItemSelection = (item) => {
    setFeeModal(prev => {
      const isSelected = prev.payment.selected_items.find(i => i.id === item.id);
      const selected_items = isSelected 
        ? prev.payment.selected_items.filter(i => i.id !== item.id)
        : [...prev.payment.selected_items, { ...item, quantity: 1 }];

      return {
        ...prev,
        payment: { ...prev.payment, selected_items }
      };
    });
  };

  const updateItemQuantity = (itemId, quantity) => {
    setFeeModal(prev => ({
      ...prev,
      payment: {
        ...prev.payment,
        selected_items: prev.payment.selected_items.map(item =>
          item.id === itemId ? { ...item, quantity: parseInt(quantity) || 1 } : item
        )
      }
    }));
  };

  const calculateTotal = () => {
    return feeModal.payment.selected_items.reduce((total, item) => 
      total + (item.fee_amount * item.quantity), 0
    );
  };

  const handlePayment = async () => {
    if (feeModal.payment.selected_items.length === 0) {
      Alert.alert('Error', 'Please select at least one item');
      return;
    }

    try {
      const selectedStudent = students.find(s => s.id === feeModal.payment.student_id);
      const totalAmount = calculateTotal();

      // Record each selected item as a separate purchase
      const purchases = await Promise.all(
        feeModal.payment.selected_items.map(async item => {
          const receiptNumber = await generateReceiptNumber();
          const purchaseData = {
            student_id: feeModal.payment.student_id,
            class_id: feeModal.payment.class_id,
            item_id: item.id,
            quantity: item.quantity,
            unit_price: item.fee_amount,
            total_amount: item.fee_amount * item.quantity,
            payment_date: format(new Date(), 'yyyy-MM-dd'),
            payment_mode: feeModal.payment.payment_mode,
            remarks: feeModal.payment.remarks || '',
            receipt_number: receiptNumber
          };
          
          return StationaryServiceEnhanced.recordPurchase(purchaseData);
        })
      );

      // Create consolidated receipt data
      const receiptData = {
        student: selectedStudent,
        items: feeModal.payment.selected_items,
        totalAmount: totalAmount,
        paymentMode: feeModal.payment.payment_mode,
        paymentDate: format(new Date(), 'yyyy-MM-dd'),
        receiptNumbers: purchases.map(p => p.receipt_number).join(', '),
        remarks: feeModal.payment.remarks
      };

      // Show receipt modal instead of alert
      setReceiptModal({
        visible: true,
        receipt: receiptData
      });
      
      resetFeeModal();
      
      loadData();
    } catch (error) {
      console.error('Error recording payment:', error);
      Alert.alert('Error', 'Failed to record payment. Please try again.');
    }
  };

  const resetFeeModal = () => {
    setFeeModal({
      visible: false,
      step: 1,
      payment: {
        class_id: '',
        student_id: '',
        selected_items: [],
        payment_mode: 'Cash',
        remarks: ''
      }
    });
    setStudents([]);
  };

  // ============ RECEIPT NUMBER GENERATION ============
  
  const generateReceiptNumber = async () => {
    try {
      // Use enhanced service for receipt generation (handles tenant automatically)
      return await StationaryServiceEnhanced.generateReceiptNumber();
    } catch (error) {
      console.error('Error generating receipt number:', error);
      // Fallback to timestamp-based receipt number
      return Date.now().toString();
    }
  };

  // ============ RECEIPT GENERATION ============

  const formatDateForReceipt = (dateString) => {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      
      if (isNaN(date.getTime())) {
        return dateString;
      }
      
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      
      return `${day}-${month}-${year}`;
    } catch (error) {
      console.warn('Error formatting date:', dateString, error);
      return dateString;
    }
  };

  // Generate receipt HTML using new web receipt generator
  const generateReceiptHTML = async (receipt) => {
    try {
      // Use the new web receipt generator for demo bill format
      const { generateWebReceiptHTML } = await import('../../utils/webReceiptGenerator');
      
      return await generateWebReceiptHTML({
        schoolDetails,
        studentData: {
          name: receipt.student?.name || 'N/A',
          admissionNo: receipt.student?.admission_no || 'N/A',
          className: 'N/A' // Stationary doesn't have class context
        },
        feeData: {
          component: 'Stationary Items',
          amount: receipt.totalAmount
        },
        paymentData: {
          mode: receipt.paymentMode,
          transactionId: receipt.receiptNumbers
        },
        outstandingAmount: 0,
        receiptNumber: receipt.receiptNumbers,
        academicYear: '2024-25',
        // Additional data for stationary receipt
        items: receipt.items, // Pass items for detailed breakdown
        remarks: receipt.remarks,
        isStationaryReceipt: true // Flag to identify stationary receipts
      });
    } catch (error) {
      console.error('Error generating receipt HTML with new format:', error);
      // Fallback to old format if new generator fails
      return generateOldReceiptHTML(receipt);
    }
  };

  // Keep old receipt HTML as fallback
  const generateOldReceiptHTML = (receipt) => {
    const schoolName = schoolDetails?.name || 'School Name';
    const schoolAddress = schoolDetails?.address || '';
    const schoolPhone = schoolDetails?.phone || '';
    const schoolEmail = schoolDetails?.email || '';
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Stationary Fee Receipt</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
              color: #333;
              background-color: #fff;
            }
            .receipt-header {
              text-align: center;
              border-bottom: 2px solid #2196F3;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .school-name {
              font-size: 24px;
              font-weight: bold;
              color: #2196F3;
              margin-bottom: 5px;
            }
            .school-info {
              font-size: 14px;
              color: #666;
              margin: 2px 0;
            }
            .receipt-title {
              font-size: 20px;
              font-weight: bold;
              margin-top: 15px;
              color: #333;
            }
            .receipt-info {
              background-color: #f8f9fa;
              padding: 15px;
              border-radius: 8px;
              margin-bottom: 20px;
              border: 1px solid #e0e0e0;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 8px;
              padding: 4px 0;
            }
            .info-row:last-child {
              margin-bottom: 0;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            .items-table th,
            .items-table td {
              border: 1px solid #e0e0e0;
              padding: 10px;
              text-align: left;
            }
            .items-table th {
              background-color: #f8f9fa;
              font-weight: bold;
            }
            .items-table .amount {
              text-align: right;
            }
            .amount-section {
              text-align: center;
              margin: 25px 0;
              padding: 20px;
              background-color: #e3f2fd;
              border-radius: 8px;
              border: 2px solid #2196F3;
            }
            .amount {
              font-size: 28px;
              font-weight: bold;
              color: #2196F3;
              margin-bottom: 8px;
            }
            .amount-label {
              font-size: 14px;
              color: #666;
              font-weight: 500;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              font-size: 12px;
              color: #666;
              border-top: 1px solid #e0e0e0;
              padding-top: 15px;
            }
            .footer p {
              margin: 5px 0;
            }
          </style>
        </head>
        <body>
          <div class="receipt-header">
            <div class="school-name">${schoolName}</div>
            ${schoolAddress ? `<div class="school-info">${schoolAddress}</div>` : ''}
            ${schoolPhone ? `<div class="school-info">Phone: ${schoolPhone}</div>` : ''}
            ${schoolEmail ? `<div class="school-info">Email: ${schoolEmail}</div>` : ''}
            <div class="receipt-title">STATIONARY FEE RECEIPT</div>
          </div>

          <div class="receipt-info">
            <div class="info-row">
              <span><strong>Student Name:</strong> ${receipt.student?.name || 'N/A'}</span>
              <span><strong>Receipt No:</strong> ${receipt.receiptNumbers}</span>
            </div>
            <div class="info-row">
              <span><strong>Admission No:</strong> ${receipt.student?.admission_no || 'N/A'}</span>
              <span><strong>Payment Date:</strong> ${formatDateForReceipt(receipt.paymentDate)}</span>
            </div>
            <div class="info-row">
              <span><strong>Payment Method:</strong> ${receipt.paymentMode}</span>
              <span><strong>Academic Year:</strong> 2024-25</span>
            </div>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Description</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${receipt.items.map(item => `
                <tr>
                  <td>${item.name}</td>
                  <td>${item.description || 'Stationary item'}</td>
                  <td>${item.quantity}</td>
                  <td class="amount">₹${item.fee_amount}</td>
                  <td class="amount">₹${(item.fee_amount * item.quantity).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr style="background-color: #f8f9fa; font-weight: bold;">
                <td colspan="4">Total Amount</td>
                <td class="amount">₹${receipt.totalAmount.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>

          <div class="amount-section">
            <div class="amount">₹${receipt.totalAmount.toFixed(2)}</div>
            <div class="amount-label">Total Amount Paid</div>
          </div>

          ${receipt.remarks ? `
            <div style="margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-radius: 8px;">
              <strong>Remarks:</strong> ${receipt.remarks}
            </div>
          ` : ''}

          <div class="footer">
            <p>This is a computer generated receipt. No signature required.</p>
            <p>Thank you for your payment!</p>
            <p>Generated on ${formatDateForReceipt(new Date().toISOString())}</p>
          </div>
        </body>
      </html>
    `;
  };

  const handleDownloadReceipt = async () => {
    if (!receiptModal.receipt) return;

    try {
      const htmlContent = generateReceiptHTML(receiptModal.receipt);
      
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false
      });

      const fileName = `Stationary_Receipt_${receiptModal.receipt.student?.name?.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`;

      if (Platform.OS === 'android') {
        try {
          const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (!permissions.granted) {
            Alert.alert('Permission Required', 'Please grant storage permission to save the receipt.');
            return;
          }

          const destUri = await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            fileName,
            'application/pdf'
          );

          const fileData = await FileSystem.readAsStringAsync(uri, { 
            encoding: FileSystem.EncodingType.Base64 
          });
          await FileSystem.writeAsStringAsync(destUri, fileData, { 
            encoding: FileSystem.EncodingType.Base64 
          });

          Alert.alert('Receipt Downloaded', `Receipt saved as ${fileName}`);
        } catch (error) {
          console.error('Download error:', error);
          Alert.alert('Error', 'Failed to download receipt. Please try again.');
        }
      } else {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share Receipt',
          UTI: 'com.adobe.pdf'
        });
      }
    } catch (error) {
      console.error('Receipt generation error:', error);
      Alert.alert('Error', 'Failed to generate receipt. Please try again.');
    }
  };

  const resetReceiptModal = () => {
    setReceiptModal({
      visible: false,
      receipt: null
    });
  };

  // ============ REPORTS ============

  const getClassReport = async (classId) => {
    try {
      console.log('📈 Loading class report via email-based tenant system');
      const classReport = await StationaryServiceEnhanced.getClassWiseReport(classId, dateRange.start, dateRange.end);
      return classReport;
    } catch (error) {
      console.error('Error loading class report:', error);
      return {};
    }
  };

  // ============ RENDER FUNCTIONS ============

  const renderTabButton = (tabName, title, icon) => (
    <TouchableOpacity
      style={[styles.tabButton, activeTab === tabName && styles.activeTab]}
      onPress={() => setActiveTab(tabName)}
    >
      <Ionicons
        name={icon}
        size={20}
        color={activeTab === tabName ? '#fff' : '#2196F3'}
      />
      <Text style={[styles.tabText, activeTab === tabName && styles.activeTabText]}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  const renderItemCard = ({ item }) => (
    <View style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.name}</Text>
          {item.description && (
            <Text style={styles.itemDescription}>{item.description}</Text>
          )}
        </View>
        <View style={styles.itemActions}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => setItemModal({
              visible: true,
              editMode: true,
              item: { ...item, fee_amount: item.fee_amount.toString() }
            })}
          >
            <Ionicons name="pencil" size={20} color="#2196F3" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteItem(item.id)}
          >
            <Ionicons name="trash" size={20} color="#f44336" />
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.itemStats}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Fee Amount</Text>
          <Text style={styles.statValue}>₹{parseFloat(item.fee_amount).toFixed(2)}</Text>
        </View>
      </View>
    </View>
  );

  const handlePurchaseCardTap = (purchase) => {
    // Create receipt data from the purchase record
    const receiptData = {
      student: purchase.students,
      items: [{
        id: purchase.item_id,
        name: purchase.stationary_items?.name || 'Unknown Item',
        description: purchase.stationary_items?.description || 'Stationary item',
        fee_amount: parseFloat(purchase.unit_price),
        quantity: purchase.quantity
      }],
      totalAmount: parseFloat(purchase.total_amount),
      paymentMode: purchase.payment_mode,
      paymentDate: purchase.payment_date,
      receiptNumbers: purchase.receipt_number,
      remarks: purchase.remarks || ''
    };

    // Show receipt modal
    setReceiptModal({
      visible: true,
      receipt: receiptData
    });
  };

  const renderPurchaseCard = ({ item }) => (
    <TouchableOpacity 
      style={styles.purchaseCard} 
      onPress={() => handlePurchaseCardTap(item)}
      activeOpacity={0.7}
    >
      <View style={styles.purchaseHeader}>
        <View>
          <Text style={styles.purchaseStudent}>{item.students?.name}</Text>
          <Text style={styles.purchaseItem}>{item.stationary_items?.name}</Text>
        </View>
        <View style={styles.purchaseAmount}>
          <Text style={styles.amountText}>₹{parseFloat(item.total_amount).toFixed(2)}</Text>
          <Text style={styles.receiptNumber}>Receipt: {item.receipt_number}</Text>
        </View>
      </View>
      
      <View style={styles.purchaseDetails}>
        <Text style={styles.detailText}>Quantity: {item.quantity}</Text>
        <Text style={styles.detailText}>Unit Price: ₹{parseFloat(item.unit_price).toFixed(2)}</Text>
        <Text style={styles.detailText}>Date: {format(new Date(item.payment_date || item.purchase_date), 'MMM dd, yyyy')}</Text>
        <Text style={styles.detailText}>Payment: {item.payment_mode}</Text>
      </View>
      
      <View style={styles.tapHintContainer}>
        <Text style={styles.tapHintText}>Tap to view receipt</Text>
        <Ionicons name="receipt-outline" size={16} color="#2196F3" />
      </View>
    </TouchableOpacity>
  );

  const renderItemsTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Stationary Fee Items</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setItemModal({ ...itemModal, visible: true })}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        renderItem={renderItemCard}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={Platform.OS === 'web'}
        nestedScrollEnabled={true}
        bounces={false}
        overScrollMode="never"
        scrollBehavior="smooth"
        style={styles.scrollContainer}
        WebkitOverflowScrolling="touch"
      />
    </View>
  );

  const renderPaymentsTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Fee Payments</Text>
        <TouchableOpacity
          style={styles.payButton}
          onPress={() => setFeeModal({ ...feeModal, visible: true })}
        >
          <Ionicons name="card" size={24} color="#fff" />
          <Text style={styles.payButtonText}>Collect Fee</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={purchases}
        renderItem={renderPurchaseCard}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={Platform.OS === 'web'}
        nestedScrollEnabled={true}
        bounces={false}
        overScrollMode="never"
        scrollBehavior="smooth"
        style={styles.scrollContainer}
        WebkitOverflowScrolling="touch"
      />
    </View>
  );

  const renderReportsTab = () => (
    <ScrollView 
      style={[styles.tabContent, styles.scrollContainer]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={Platform.OS === 'web'}
      nestedScrollEnabled={true}
      bounces={false}
      overScrollMode="never"
      scrollBehavior="smooth"
      WebkitOverflowScrolling="touch"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <Text style={styles.sectionTitle}>Fee Collection Reports</Text>

      {/* Summary Cards */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryCard}>
          <Ionicons name="cash" size={30} color="#4CAF50" />
          <Text style={styles.summaryValue}>₹{analytics.totalRevenue.toFixed(2)}</Text>
          <Text style={styles.summaryLabel}>Total Revenue</Text>
        </View>
        
        <View style={styles.summaryCard}>
          <Ionicons name="receipt" size={30} color="#2196F3" />
          <Text style={styles.summaryValue}>{analytics.totalTransactions}</Text>
          <Text style={styles.summaryLabel}>Transactions</Text>
        </View>
      </View>

      {/* Class Filter */}
      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>Filter by Class:</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedClass}
            onValueChange={setSelectedClass}
            style={styles.picker}
          >
            <Picker.Item label="All Classes" value="" />
            {classes.map(cls => (
              <Picker.Item 
                key={cls.id} 
                label={`${cls.class_name} ${cls.section}`} 
                value={cls.id} 
              />
            ))}
          </Picker>
        </View>
      </View>

      {/* Students who paid */}
      <View style={styles.reportSection}>
        <Text style={styles.reportTitle}>Students with Fee Payments</Text>
        {purchases.length > 0 ? (
          purchases
            .filter(purchase => !selectedClass || purchase.class_id === selectedClass)
            .map((purchase, index) => (
              <View key={index} style={styles.reportItem}>
                <Text style={styles.studentName}>{purchase.students?.name}</Text>
                <Text style={styles.itemName}>{purchase.stationary_items?.name}</Text>
                <Text style={styles.amountText}>₹{parseFloat(purchase.total_amount).toFixed(2)}</Text>
              </View>
            ))
        ) : (
          <Text style={styles.noDataText}>No fee payments found</Text>
        )}
      </View>
    </ScrollView>
  );

  // Enhanced loading state for email-based tenant system
  if ((loading || tenantLoading) && !refreshing) {
    const loadingMessage = tenantLoading 
      ? 'Initializing tenant access...'
      : 'Loading Stationary Management...';
      
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>{loadingMessage}</Text>
        {tenantLoading && (
          <Text style={[styles.loadingText, { fontSize: 14, marginTop: 5 }]}>
            Verifying admin access via email: {user?.email}
          </Text>
        )}
      </View>
    );
  }
  
  // Show error state if no tenant info after initialization
  if (!tenantLoading && !tenantInfo) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#f44336" />
        <Text style={[styles.loadingText, { color: '#f44336', marginTop: 16 }]}>
          Access Denied
        </Text>
        <Text style={[styles.loadingText, { fontSize: 14, marginTop: 8 }]}>
          Unable to access stationary management for this account
        </Text>
        <TouchableOpacity
          style={[styles.payButton, { marginTop: 20, backgroundColor: '#f44336' }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.payButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header 
        title="Stationary Fee Management" 
        navigation={navigation} 
        showBack={true}
        subtitle={tenantInfo ? `${tenantInfo.name} - ${user?.email}` : user?.email}
      />
      
      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        {renderTabButton('items', 'Fee Items', 'pricetag-outline')}
        {renderTabButton('payments', 'Payments', 'card-outline')}
        {renderTabButton('reports', 'Reports', 'analytics-outline')}
      </View>

      {/* Tab Content with scrollWrapper for web */}
      <View style={styles.scrollWrapper}>
        {activeTab === 'items' && renderItemsTab()}
        {activeTab === 'payments' && renderPaymentsTab()}
        {activeTab === 'reports' && renderReportsTab()}
      </View>

      {/* Fee Item Modal */}
      <Modal
        visible={itemModal.visible}
        animationType="slide"
        onRequestClose={() => setItemModal({ ...itemModal, visible: false })}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {itemModal.editMode ? 'Edit Fee Item' : 'Add New Fee Item'}
            </Text>
            <TouchableOpacity
              onPress={() => setItemModal({ ...itemModal, visible: false })}
            >
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Item Name *</Text>
              <TextInput
                style={styles.textInput}
                value={itemModal.item.name}
                onChangeText={(text) => setItemModal({
                  ...itemModal,
                  item: { ...itemModal.item, name: text }
                })}
                placeholder="Enter item name"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.textInput, styles.multilineInput]}
                value={itemModal.item.description}
                onChangeText={(text) => setItemModal({
                  ...itemModal,
                  item: { ...itemModal.item, description: text }
                })}
                placeholder="Enter description (optional)"
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Fee Amount (₹) *</Text>
              <TextInput
                style={styles.textInput}
                value={itemModal.item.fee_amount}
                onChangeText={(text) => setItemModal({
                  ...itemModal,
                  item: { ...itemModal.item, fee_amount: text }
                })}
                placeholder="0.00"
                keyboardType="numeric"
              />
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setItemModal({ ...itemModal, visible: false })}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.saveButton]}
              onPress={handleSaveItem}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Fee Collection Modal */}
      <Modal
        visible={feeModal.visible}
        animationType="slide"
        onRequestClose={resetFeeModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {feeModal.step === 1 ? 'Select Class' : 
               feeModal.step === 2 ? 'Select Student' : 'Collect Fee'}
            </Text>
            <TouchableOpacity onPress={resetFeeModal}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {feeModal.step === 1 && (
              <View>
                <Text style={styles.stepTitle}>Choose a class to collect fees:</Text>
                {classes.map(cls => (
                  <TouchableOpacity
                    key={cls.id}
                    style={styles.listItem}
                    onPress={() => handleClassSelection(cls.id)}
                  >
                    <Text style={styles.listItemText}>{cls.class_name} {cls.section}</Text>
                    <Ionicons name="chevron-forward" size={20} color="#666" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {feeModal.step === 2 && (
              <View>
                <Text style={styles.stepTitle}>Choose a student:</Text>
                {students.map(student => (
                  <TouchableOpacity
                    key={student.id}
                    style={styles.listItem}
                    onPress={() => handleStudentSelection(student.id)}
                  >
                    <View>
                      <Text style={styles.listItemText}>{student.name}</Text>
                      <Text style={styles.listItemSubText}>Admission No: {student.admission_no}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#666" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {feeModal.step === 3 && (
              <View>
                <Text style={styles.stepTitle}>Select items and collect fee:</Text>
                
                {/* Selected Student Info */}
                <View style={styles.studentInfo}>
                  <Text style={styles.selectedStudent}>
                    Student: {students.find(s => s.id === feeModal.payment.student_id)?.name}
                  </Text>
                </View>

                {/* Item Selection */}
                {items.map(item => {
                  const isSelected = feeModal.payment.selected_items.find(i => i.id === item.id);
                  return (
                    <View key={item.id} style={styles.itemSelection}>
                      <TouchableOpacity
                        style={[styles.itemCheckbox, isSelected && styles.itemCheckboxSelected]}
                        onPress={() => toggleItemSelection(item)}
                      >
                        <View style={styles.itemCheckboxContent}>
                          <View>
                            <Text style={styles.itemCheckboxText}>{item.name}</Text>
                            <Text style={styles.itemCheckboxPrice}>₹{item.fee_amount}</Text>
                          </View>
                          {isSelected && <Ionicons name="checkmark" size={20} color="#4CAF50" />}
                        </View>
                      </TouchableOpacity>
                      
                      {isSelected && (
                        <View style={styles.quantityInput}>
                          <Text style={styles.quantityLabel}>Quantity:</Text>
                          <TextInput
                            style={styles.quantityTextInput}
                            value={isSelected.quantity.toString()}
                            onChangeText={(text) => updateItemQuantity(item.id, text)}
                            keyboardType="numeric"
                          />
                        </View>
                      )}
                    </View>
                  );
                })}

                {/* Total Amount */}
                <View style={styles.totalSection}>
                  <Text style={styles.totalText}>Total: ₹{calculateTotal().toFixed(2)}</Text>
                </View>

                {/* Payment Mode */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Payment Mode</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={feeModal.payment.payment_mode}
                      onValueChange={(value) => setFeeModal(prev => ({
                        ...prev,
                        payment: { ...prev.payment, payment_mode: value }
                      }))}
                      style={styles.picker}
                    >
                      {StationaryServiceEnhanced.getAvailablePaymentModes().map(mode => (
                        <Picker.Item key={mode} label={mode} value={mode} />
                      ))}
                    </Picker>
                  </View>
                </View>

                {/* Remarks */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Remarks</Text>
                  <TextInput
                    style={[styles.textInput, styles.multilineInput]}
                    value={feeModal.payment.remarks}
                    onChangeText={(text) => setFeeModal(prev => ({
                      ...prev,
                      payment: { ...prev.payment, remarks: text }
                    }))}
                    placeholder="Optional remarks"
                    multiline
                    numberOfLines={3}
                  />
                </View>
              </View>
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            {feeModal.step > 1 && (
              <TouchableOpacity
                style={[styles.modalButton, styles.backButton]}
                onPress={() => setFeeModal(prev => ({ ...prev, step: prev.step - 1 }))}
              >
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
            )}
            
            {feeModal.step === 3 && (
              <TouchableOpacity
                style={[styles.modalButton, styles.payNowButton]}
                onPress={handlePayment}
              >
                <Text style={styles.payNowButtonText}>Pay Now</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* Receipt Preview Modal */}
      <Modal
        visible={receiptModal.visible}
        animationType="slide"
        onRequestClose={resetReceiptModal}
      >
        <View style={styles.receiptModalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Payment Successful!</Text>
              <TouchableOpacity onPress={resetReceiptModal}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            {receiptModal.receipt && (
              <ScrollView style={styles.receiptPreviewContent}>
                <View style={styles.receiptPreview}>
                  <View style={styles.receiptSuccessIcon}>
                    <Ionicons name="checkmark-circle" size={60} color="#4CAF50" />
                  </View>
                  
                  <View style={styles.receiptSummary}>
                    <Text style={styles.receiptStudentName}>
                      {receiptModal.receipt.student?.name}
                    </Text>
                    <Text style={styles.receiptAmount}>
                      ₹{receiptModal.receipt.totalAmount.toFixed(2)}
                    </Text>
                    <Text style={styles.receiptAmountLabel}>Amount Paid</Text>
                  </View>

                  <View style={styles.receiptDetails}>
                    <View style={styles.receiptDetailRow}>
                      <Text style={styles.receiptDetailLabel}>Receipt No:</Text>
                      <Text style={styles.receiptDetailValue}>{receiptModal.receipt.receiptNumbers}</Text>
                    </View>
                    <View style={styles.receiptDetailRow}>
                      <Text style={styles.receiptDetailLabel}>Payment Date:</Text>
                      <Text style={styles.receiptDetailValue}>{formatDateForReceipt(receiptModal.receipt.paymentDate)}</Text>
                    </View>
                    <View style={styles.receiptDetailRow}>
                      <Text style={styles.receiptDetailLabel}>Payment Mode:</Text>
                      <Text style={styles.receiptDetailValue}>{receiptModal.receipt.paymentMode}</Text>
                    </View>
                  </View>

                  <View style={styles.receiptItemsSection}>
                    <Text style={styles.receiptItemsTitle}>Items Purchased:</Text>
                    {receiptModal.receipt.items.map((item, index) => (
                      <View key={index} style={styles.receiptItemRow}>
                        <Text style={styles.receiptItemName}>{item.name}</Text>
                        <Text style={styles.receiptItemQty}>Qty: {item.quantity}</Text>
                        <Text style={styles.receiptItemAmount}>₹{(item.fee_amount * item.quantity).toFixed(2)}</Text>
                      </View>
                    ))}
                  </View>

                  {receiptModal.receipt.remarks && (
                    <View style={styles.receiptRemarksSection}>
                      <Text style={styles.receiptRemarksTitle}>Remarks:</Text>
                      <Text style={styles.receiptRemarksText}>{receiptModal.receipt.remarks}</Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            )}

            <View style={styles.receiptModalFooter}>
              <TouchableOpacity 
                style={styles.receiptCloseButton} 
                onPress={resetReceiptModal}
              >
                <Text style={styles.receiptCloseButtonText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.receiptDownloadButton} 
                onPress={handleDownloadReceipt}
              >
                <Ionicons name="download" size={20} color="#fff" />
                <Text style={styles.receiptDownloadButtonText}>Download PDF</Text>
              </TouchableOpacity>
            </View>
        </View>
      </Modal>
      
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollWrapper: {
    flex: 1,
    ...(Platform.OS === 'web' ? {
      height: 'calc(100vh - 120px)',
      minHeight: 300,
      maxHeight: '100%',
      overflow: 'hidden',
    } : {}),
  },
  scrollContainer: {
    flex: 1,
    ...(Platform.OS === 'web' ? {
      overflowY: 'scroll',
    } : {}),
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginHorizontal: 5,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  activeTab: {
    backgroundColor: '#2196F3',
  },
  tabText: {
    marginLeft: 5,
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
  },
  activeTabText: {
    color: '#fff',
  },
  tabContent: {
    flex: 1,
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    backgroundColor: '#4CAF50',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  payButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  payButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  listContainer: {
    paddingBottom: 20,
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  itemDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButton: {
    padding: 8,
    marginRight: 5,
  },
  deleteButton: {
    padding: 8,
  },
  itemStats: {
    alignItems: 'flex-start',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 2,
  },
  purchaseCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  purchaseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  purchaseStudent: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  purchaseItem: {
    fontSize: 14,
    color: '#2196F3',
    marginTop: 2,
  },
  purchaseAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  receiptNumber: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  purchaseDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  detailText: {
    fontSize: 12,
    color: '#666',
    width: '48%',
    marginBottom: 2,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginVertical: 5,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  filterSection: {
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  picker: {
    height: 50,
  },
  reportSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  reportItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  studentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  noDataText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  textInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  multilineInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  saveButton: {
    backgroundColor: '#2196F3',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  listItemText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  listItemSubText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  studentInfo: {
    backgroundColor: '#e3f2fd',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  selectedStudent: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976d2',
  },
  itemSelection: {
    marginBottom: 15,
  },
  itemCheckbox: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 15,
  },
  itemCheckboxSelected: {
    borderColor: '#4CAF50',
    backgroundColor: '#f1f8e9',
  },
  itemCheckboxContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemCheckboxText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  itemCheckboxPrice: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
    marginTop: 2,
  },
  quantityInput: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 15,
  },
  quantityLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 10,
  },
  quantityTextInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 16,
    minWidth: 60,
    textAlign: 'center',
  },
  totalSection: {
    backgroundColor: '#e8f5e8',
    padding: 15,
    borderRadius: 8,
    marginVertical: 20,
    alignItems: 'center',
  },
  totalText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  backButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  payNowButton: {
    backgroundColor: '#4CAF50',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  payNowButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // Receipt Modal Styles
  receiptModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 20,
    paddingHorizontal: 10,
    paddingBottom: 20,
  },
  receiptModalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  receiptPreviewContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  receiptPreview: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  receiptSuccessIcon: {
    alignItems: 'center',
    marginBottom: 20,
  },
  receiptSummary: {
    alignItems: 'center',
    marginBottom: 24,
  },
  receiptStudentName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  receiptAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 4,
  },
  receiptAmountLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  receiptDetails: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  receiptDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    alignItems: 'center',
  },
  receiptDetailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  receiptDetailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  receiptItemsSection: {
    marginBottom: 20,
  },
  receiptItemsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  receiptItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    marginBottom: 8,
  },
  receiptItemName: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 1,
  },
  receiptItemQty: {
    fontSize: 12,
    color: '#666',
    marginHorizontal: 8,
  },
  receiptItemAmount: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  receiptRemarksSection: {
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  receiptRemarksTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 4,
  },
  receiptRemarksText: {
    fontSize: 14,
    color: '#856404',
    lineHeight: 20,
  },
  receiptModalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  receiptCloseButton: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  receiptCloseButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  receiptDownloadButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginLeft: 8,
  },
  receiptDownloadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 6,
  },
  // Tap Hint Styles
  tapHintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  tapHintText: {
    fontSize: 12,
    color: '#2196F3',
    fontStyle: 'italic',
    marginRight: 4,
  },
});

export default StationaryManagement;
