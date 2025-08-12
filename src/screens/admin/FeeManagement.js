import React, { useState, useEffect, useRef } from 'react';
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
  Dimensions,
  Platform,
  Pressable,
} from 'react-native';
import Header from '../../components/Header';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { supabase, dbHelpers, TABLES } from '../../utils/supabase';
import { format, parseISO } from 'date-fns';
import { CrossPlatformPieChart, CrossPlatformBarChart } from '../../components/CrossPlatformChart';
import { formatCurrency } from '../../utils/helpers';
import { isValidDate, isReasonableDate, formatDateForDB, cleanDateForForm } from '../../utils/dateValidation';
import * as Animatable from 'react-native-animatable';
import { Picker } from '@react-native-picker/picker';

const FeeManagement = () => {
  const navigation = useNavigation();
  const [tab, setTab] = useState('structure');
  const [classes, setClasses] = useState([]);
  const [feeStructures, setFeeStructures] = useState([]);
  const [students, setStudents] = useState([]);
  const [payments, setPayments] = useState([]);
  const [classPaymentStats, setClassPaymentStats] = useState([]);
  const [paymentSummary, setPaymentSummary] = useState({
    totalCollected: 0,
    totalDue: 0,
    totalOutstanding: 0,
    collectionRate: 0
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feeModal, setFeeModal] = useState({ 
    visible: false, 
    classId: '', 
    fee: { 
      id: '', 
      type: '', 
      amount: '', 
      dueDate: '', 
      description: '' 
    } 
  });
  const [editFeeId, setEditFeeId] = useState(null);
  const [expandedClass, setExpandedClass] = useState(null);
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [feeStructureModal, setFeeStructureModal] = useState(false);
  const [selectedClassIds, setSelectedClassIds] = useState([]); // Changed to array
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [paymentAmount, setPaymentAmount] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedFee, setSelectedFee] = useState(null);
  const [newFeeStructure, setNewFeeStructure] = useState({
    type: '',
    amount: '',
    dueDate: null,
    academicYear: '2024-25'
  });
  const [feeStats, setFeeStats] = useState({ 
    totalDue: 0, 
    totalPaid: 0, 
    pendingStudents: 0 
  });

  // Add safe date formatting function at the top
  const formatSafeDate = (dateValue) => {
    console.log('formatSafeDate input:', dateValue, typeof dateValue); // Debug log
    
    if (!dateValue) return 'No date selected';
    
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      return format(date, 'MMM dd, yyyy');
    } catch (error) {
      console.error('Date formatting error:', error);
      return 'Invalid date';
    }
  };

  // Safe currency formatting
  const formatSafeCurrency = (amount) => {
    if (!amount || isNaN(amount)) return '₹0';
    return `₹${parseFloat(amount).toFixed(2)}`;
  };

  // Helper function to calculate total fees for a student
  // Calculate fee statistics
  const calculateFeeStats = async () => {
    try {
      const { data: feeStructures, error: feeError } = await supabase
        .from(TABLES.FEE_STRUCTURE)
        .select('amount');

      if (feeError) throw feeError;

      const { data: studentFees, error: paymentError } = await supabase
        .from(TABLES.STUDENT_FEES)
        .select('amount_paid, student_id');

      if (paymentError) throw paymentError;

      const { data: allStudents, error: studentsError } = await supabase
        .from(TABLES.STUDENTS)
        .select('id');

      if (studentsError) throw studentsError;

      // Calculate totals
      const totalDue = feeStructures.reduce((sum, fee) => sum + Number(fee.amount), 0);
      const totalPaid = studentFees.reduce((sum, payment) => sum + Number(payment.amount_paid), 0);
      
      // Calculate pending students - students who have no payments at all
      const studentsWithPayments = new Set(studentFees.map(fee => fee.student_id));
      const pendingStudents = (allStudents?.length || 0) - studentsWithPayments.size;

      setFeeStats({ totalDue, totalPaid, pendingStudents });
    } catch (error) {
      console.error('Error calculating fee statistics:', error);
      setFeeStats({ totalDue: 0, totalPaid: 0, pendingStudents: 0 });
    }
  };

  // Helper function to get pending fees for a student
  const getPendingFees = async (studentId, classId) => {
    try {
      const { data: fees, error } = await supabase
        .from(TABLES.STUDENT_FEES)
        .select('*')
        .eq('student_id', studentId);

      if (error) throw error;
      
      // Get fee structure for this class
      const { data: feeStructure, error: feeError } = await supabase
        .from(TABLES.FEE_STRUCTURE)
        .select('*')
        .eq('class_id', classId);
      
      if (feeError) throw feeError;
      
      // Since we don't have fee_id relationship, return all unpaid fee structures
      // This is a simplified approach - you may need to adjust based on your actual schema
      const pendingFees = feeStructure?.filter(fee => {
        // Check if student has made any payment for this fee type
        const hasPayment = fees?.some(f => f.amount_paid > 0);
        return !hasPayment || fees?.reduce((sum, f) => sum + f.amount_paid, 0) < fee.amount;
      }) || [];
      
      return pendingFees;
    } catch (error) {
      console.error('Error getting pending fees:', error);
      return [];
    }
  };

  // Calculate class-wise payment statistics
  const calculateClassPaymentStats = async () => {
    try {
      // Get all classes with their fee structures and payments
      const { data: classesWithStats, error } = await supabase
        .from(TABLES.CLASSES)
        .select(`
          id,
          class_name,
          section
        `);

      if (error) throw error;

      const currentYear = new Date().getFullYear();
      const academicYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;

      const classStats = await Promise.all(classesWithStats.map(async (classData) => {
        // Get fee structures for this class
        const { data: feeStructures, error: feeError } = await supabase
          .from(TABLES.FEE_STRUCTURE)
          .select('*')
          .eq('class_id', classData.id)
          .eq('academic_year', academicYear);

        if (feeError) throw feeError;

        // Get students in this class
        const { data: studentsInClass, error: studentsError } = await supabase
          .from(TABLES.STUDENTS)
          .select('id, name')
          .eq('class_id', classData.id);

        if (studentsError) throw studentsError;

        // Calculate total fee structure for this class
        const totalFeeStructure = feeStructures?.reduce((sum, fee) => sum + (parseFloat(fee.amount) || 0), 0) || 0;

        // Calculate total students in class
        const totalStudents = studentsInClass?.length || 0;

        // Calculate total expected fees (fee structure × number of students)
        const totalExpectedFees = totalFeeStructure * totalStudents;

        // Get payments for students in this class
        const studentIds = studentsInClass?.map(s => s.id) || [];
        let totalPaid = 0;
        let studentsWithPayments = 0;

        if (studentIds.length > 0) {
          const { data: paymentsForClass, error: paymentsError } = await supabase
            .from(TABLES.STUDENT_FEES)
            .select('student_id, amount_paid, academic_year')
            .in('student_id', studentIds)
            .eq('academic_year', academicYear);

          if (paymentsError) throw paymentsError;

          totalPaid = paymentsForClass?.reduce((sum, payment) => sum + (parseFloat(payment.amount_paid) || 0), 0) || 0;
          studentsWithPayments = new Set(paymentsForClass?.map(p => p.student_id) || []).size;
        }

        // Calculate outstanding amount
        const outstanding = totalExpectedFees - totalPaid;

        // Calculate collection rate
        const collectionRate = totalExpectedFees > 0 ? (totalPaid / totalExpectedFees) * 100 : 0;

        const studentsWithoutPayments = totalStudents - studentsWithPayments;

        return {
          classId: classData.id,
          className: `${classData.class_name}${classData.section ? ` - ${classData.section}` : ''}`,
          totalStudents,
          totalExpectedFees,
          totalPaid,
          outstanding,
          collectionRate: Math.round(collectionRate * 100) / 100,
          studentsWithPayments,
          studentsWithoutPayments,
          feeStructureAmount: totalFeeStructure
        };
      }));

      // Sort by outstanding amount (highest first)
      classStats.sort((a, b) => b.outstanding - a.outstanding);

      setClassPaymentStats(classStats);

      // Calculate overall payment summary
      const summary = classStats.reduce((acc, classData) => ({
        totalCollected: acc.totalCollected + classData.totalPaid,
        totalDue: acc.totalDue + classData.totalExpectedFees,
        totalOutstanding: acc.totalOutstanding + classData.outstanding,
      }), { totalCollected: 0, totalDue: 0, totalOutstanding: 0 });

      summary.collectionRate = summary.totalDue > 0 ?
        Math.round((summary.totalCollected / summary.totalDue) * 10000) / 100 : 0;

      setPaymentSummary(summary);

    } catch (error) {
      console.error('Error calculating class payment stats:', error);
    }
  };

  // Load all data from Supabase
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      setRefreshing(true);

      // Load classes
      const { data: classesData, error: classesError } = await supabase
        .from(TABLES.CLASSES)
        .select('*');

      if (classesError) throw classesError;
      setClasses(classesData || []);

      // Load fee structures with class information - include due_date
      const { data: feeStructuresData, error: feeStructuresError } = await supabase
        .from(TABLES.FEE_STRUCTURE)
        .select(`
          *,
          classes:${TABLES.CLASSES}(id, class_name)
        `);

      if (feeStructuresError) throw feeStructuresError;
      
      console.log('Raw fee structures from DB:', feeStructuresData); // Debug log
      
      // Process fee structures to group by class
      const processedFeeStructures = [];
      
      // Group fee structures by class_id and filter out invalid dates
      const groupedByClass = {};
      feeStructuresData.forEach(fee => {
        console.log('Processing fee:', fee); // Debug log
        
        if (!groupedByClass[fee.class_id]) {
          groupedByClass[fee.class_id] = {
            classId: fee.class_id,
            name: fee.classes?.class_name || 'Unknown Class',
            fees: []
          };
        }

        groupedByClass[fee.class_id].fees.push({
          id: fee.id,
          type: fee.fee_component || 'Unknown Fee',
          amount: fee.amount || 0,
          due_date: fee.due_date, // Make sure due_date is included
          created_at: fee.created_at,
          description: fee.fee_component || 'No description',
          academic_year: fee.academic_year || '2024-25'
        });
      });
      
      // Convert grouped object to array
      Object.values(groupedByClass).forEach(classGroup => {
        processedFeeStructures.push(classGroup);
      });
      
      console.log('Processed fee structures:', processedFeeStructures); // Debug log
      setFeeStructures(processedFeeStructures || []);

      // Load students - fix column name
      const { data: studentsData, error: studentsError } = await supabase
        .from(TABLES.STUDENTS)
        .select(`
          *,
          classes:${TABLES.CLASSES}(class_name)
        `);

      if (studentsError) throw studentsError;

      // Map name to full_name for consistency
      const mappedStudents = studentsData?.map(student => ({
        ...student,
        full_name: student.name
      })) || [];

      setStudents(mappedStudents);

      // Load payments - fix the column name
      const { data: paymentsData, error: paymentsError } = await supabase
        .from(TABLES.STUDENT_FEES)
        .select(`
          *,
          students(name)
        `);

      if (paymentsError) throw paymentsError;

      // Load fee structures separately
      const { data: allFeeStructures, error: allFeeError } = await supabase
        .from(TABLES.FEE_STRUCTURE)
        .select('*');

      if (allFeeError) throw allFeeError;

      // Manually join the data
      const enrichedPayments = paymentsData?.map(payment => {
        const feeStructure = allFeeStructures?.find(fs => fs.id === payment.fee_id);
        return {
          ...payment,
          students: { full_name: payment.students?.name }, // Map name to full_name for consistency
          fee_structure: feeStructure
        };
      }) || [];

      setPayments(enrichedPayments);

      // Calculate fee statistics
      await calculateFeeStats();

      // Calculate class-wise payment statistics
      await calculateClassPaymentStats();

    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', `Failed to load fee data: ${error.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Handle fee operations (add/edit)
  const handleFeeOperation = async (operation, feeData) => {
    if (!feeData || !feeData.type || !feeData.amount) {
      Alert.alert('Error', 'Missing required fee information');
      return;
    }

    // Validate due date
    const dueDate = operation === 'edit' ? feeData.dueDate : newFeeStructure.dueDate;
    if (!dueDate || !isValidDate(dueDate)) {
      Alert.alert('Error', 'Please select a valid due date');
      return;
    }

    try {
      setPaymentLoading(true);

      // Format the date properly before saving
      const formattedDueDate = formatDateForDB(dueDate);

      const { error } = await supabase
        .from(TABLES.FEE_STRUCTURE)
        .upsert([
          {
            id: operation === 'edit' ? feeData.id : undefined,
            class_id: operation === 'edit' ? feeData.classId : selectedClassId,
            type: operation === 'edit' ? feeData.type : newFeeStructure.type,
            amount: operation === 'edit' ? feeData.amount : newFeeStructure.amount,
            due_date: formattedDueDate,
            description: operation === 'edit' ? feeData.description : newFeeStructure.description
          }
        ])
        .select();

      if (error) throw error;

      await loadAllData();
      if (operation === 'edit') {
        setFeeModal({ visible: false, classId: '', fee: { type: '', amount: '', dueDate: '', description: '' } });
        setEditFeeId(null);
        Alert.alert('Success', 'Fee updated successfully');
      } else {
        setFeeStructureModal(false);
        setNewFeeStructure({ type: '', amount: '', dueDate: '', description: '' });
        Alert.alert('Success', 'Fee added successfully');
      }

    } catch (error) {
      console.error('Error handling fee operation:', error);
      Alert.alert('Error', `${operation === 'edit' ? 'Failed to update fee' : 'Failed to add fee'}: ${error.message}`);
    } finally {
      setPaymentLoading(false);
    }
  };
  
  // Handle edit fee
  const handleEditFee = async (classId, feeId, fee) => {
    if (!feeId || !fee.type || !fee.amount) {
      Alert.alert('Error', 'Missing required fee information');
      return;
    }

    // Validate due date
    if (!fee.dueDate || !isValidDate(fee.dueDate)) {
      Alert.alert('Error', 'Please select a valid due date');
      return;
    }

    try {
      setPaymentLoading(true);

      // Format the date properly before saving
      const formattedDueDate = formatDateForDB(fee.dueDate);

      const { error } = await supabase
        .from(TABLES.FEE_STRUCTURE)
        .update({
          fee_component: fee.type,
          amount: fee.amount,
          due_date: fee.dueDate ? new Date(fee.dueDate).toISOString().split('T')[0] : null
        })
        .eq('id', feeId);

      if (error) throw error;

      await loadAllData();
      setFeeModal({ visible: false, classId: '', fee: { type: '', amount: '', dueDate: '', description: '' } });
      setEditFeeId(null);
      Alert.alert('Success', 'Fee updated successfully');

    } catch (error) {
      console.error('Error updating fee:', error);
      Alert.alert('Error', 'Failed to update fee');
    } finally {
      setPaymentLoading(false);
    }
  };

  // Handle payment
  const handlePayment = async (studentId, feeId, amount) => {
    if (!studentId || !amount) {
      Alert.alert('Error', 'Missing required payment information');
      return;
    }

    // Validate payment date
    if (!isValidDate(paymentDate)) {
      Alert.alert('Error', 'Invalid payment date selected. Please select a valid date.');
      return;
    }
    
    try {
      setPaymentLoading(true);
      
      // First check if there's an existing record
      const { data: existingFee, error: checkError } = await supabase
        .from(TABLES.STUDENT_FEES)
        .select('*')
        .eq('student_id', studentId)
        .eq('fee_id', feeId)
        .single();
        
      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is the error code for no rows returned
        throw checkError;
      }
      
      // Get the fee structure to know the total amount
      const { data: feeStructure, error: feeStructureError } = await supabase
        .from(TABLES.FEE_STRUCTURE)
        .select('amount')
        .eq('id', feeId)
        .single();
        
      if (feeStructureError) throw feeStructureError;
      
      const totalAmount = feeStructure.amount;
      const amountPaid = parseFloat(amount);
      let status = 'partial';
      
      // If payment is complete
      if (amountPaid >= totalAmount) {
        status = 'paid';
      }
      
      // If there's an existing record, update it
      if (existingFee) {
        const newAmountPaid = existingFee.amount_paid + amountPaid;
        const newStatus = newAmountPaid >= totalAmount ? 'paid' : 'partial';
        
        const { error: updateError } = await supabase
          .from(TABLES.STUDENT_FEES)
          .update({
            amount_paid: newAmountPaid,
            payment_date: paymentDate.toISOString(),
            status: newStatus
          })
          .eq('id', existingFee.id);
          
        if (updateError) throw updateError;
      } else {
        // Create a new payment record
        const { error: insertError } = await supabase
          .from(TABLES.STUDENT_FEES)
          .insert([
            {
              student_id: studentId,
              fee_id: feeId,
              amount_paid: amountPaid,
              payment_date: paymentDate.toISOString(),
              status: status
            }
          ]);

        if (insertError) throw insertError;
      }

      // Refresh data
      await loadAllData();
      Alert.alert('Success', 'Payment recorded successfully');
      setPaymentModal(false);
      setSelectedStudent(null);
      setSelectedFee(null);
      setPaymentAmount('');
      setPaymentDate(new Date());

    } catch (error) {
      console.error('Error adding payment:', error);
      Alert.alert('Error', 'Failed to record payment');
    } finally {
      setPaymentLoading(false);
    }
  };

  // Open fee modal
  const openFeeModal = (classId, fee = null) => {
    if (!classId) {
      Alert.alert('Error', 'Class ID is required');
      return;
    }
    
    if (fee) {
      // Edit existing fee
      setFeeModal({
        visible: true,
        classId,
        fee: {
          id: fee.id,
          type: fee.fee_component || fee.type || 'Unknown Fee',
          amount: (fee.amount || 0).toString(),
          dueDate: fee.due_date || null,
          description: fee.description || fee.fee_component || 'No description'
        }
      });
      setEditFeeId(fee.id);
    } else {
      // Add new fee
      setFeeModal({
        visible: true,
        classId,
        fee: { type: '', amount: '', dueDate: null, description: '' }
      });
      setEditFeeId(null);
    }
  };

  // Note: Using imported isValidDate from dateValidation utils

  // Handle date change
  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);

    if (!selectedDate) return;

    // Validate the selected date
    if (!isValidDate(selectedDate)) {
      Alert.alert('Error', 'Invalid date selected. Please select a valid date.');
      return;
    }

    // Check for reasonable date range
    if (!isReasonableDate(selectedDate)) {
      Alert.alert('Error', 'Please select a date within a reasonable range (within 1 year ago to 5 years from now).');
      return;
    }

    // Format date to ensure it's properly formatted
    const formattedDate = selectedDate.toISOString();

    if (paymentModal) {
      setPaymentDate(selectedDate);
    } else if (feeModal.visible) {
      setFeeModal(prev => ({
        ...prev,
        fee: {
          ...prev.fee,
          dueDate: formattedDate
        }
      }));
    } else if (feeStructureModal) {
      setNewFeeStructure(prev => ({
        ...prev,
        dueDate: formattedDate
      }));
    }
  };

  // Handle delete structure
  const handleDeleteStructure = async (feeId) => {
    if (!feeId) {
      Alert.alert('Error', 'Invalid fee structure ID');
      return;
    }
    
    try {
      setPaymentLoading(true);
      
      // First get the fee structure details
      const { data: feeStructure, error: feeError } = await supabase
        .from(TABLES.FEE_STRUCTURE)
        .select('fee_component, academic_year')
        .eq('id', feeId)
        .single();
      
      if (feeError) throw feeError;
      
      // Check if there are any student fees associated with this fee component
      const { data: associatedFees, error: checkError } = await supabase
        .from(TABLES.STUDENT_FEES)
        .select('id')
        .eq('fee_component', feeStructure?.fee_component || 'Unknown')
        .eq('academic_year', feeStructure?.academic_year || '2024-25');
      
      if (checkError) throw checkError;
      
      if (associatedFees && associatedFees.length > 0) {
        Alert.alert(
          'Cannot Delete', 
          'This fee structure has associated student payments. Please remove those first.'
        );
        return;
      }
      
      // If no associated fees, proceed with deletion
      const { error } = await supabase
        .from(TABLES.FEE_STRUCTURE)
        .delete()
        .eq('id', feeId);

      if (error) throw error;

      // Refresh data
      await loadAllData();
      Alert.alert('Success', 'Fee structure deleted successfully');

    } catch (error) {
      console.error('Error deleting fee structure:', error);
      Alert.alert('Error', 'Failed to delete fee structure');
    } finally {
      setPaymentLoading(false);
    }
  };
  
  // Handle delete fee
  const handleDeleteFee = async (fee) => {
    if (!fee || !fee.id) {
      Alert.alert('Error', 'Invalid fee ID');
      return;
    }
    
    try {
      setPaymentLoading(true);
      
      // Check if there are any student fees associated with this fee component
      const { data: associatedFees, error: checkError } = await supabase
        .from(TABLES.STUDENT_FEES)
        .select('id')
        .eq('fee_component', fee.fee_component || fee.type || 'Unknown')
        .eq('academic_year', fee.academic_year || '2024-25');
      
      if (checkError) throw checkError;
      
      if (associatedFees && associatedFees.length > 0) {
        Alert.alert(
          'Cannot Delete', 
          'This fee has associated student payments. Please remove those first.'
        );
        return;
      }
      
      // If no associated fees, proceed with deletion
      const { error } = await supabase
        .from(TABLES.FEE_STRUCTURE)
        .delete()
        .eq('id', fee.id);

      if (error) throw error;

      // Refresh data
      await loadAllData();
      Alert.alert('Success', 'Fee deleted successfully');

    } catch (error) {
      console.error('Error deleting fee:', error);
      Alert.alert('Error', 'Failed to delete fee');
    } finally {
      setPaymentLoading(false);
    }
  };

  // Handle add fee structure
  const handleAddFeeStructure = async () => {
    // Validation
    if (selectedClassIds.length === 0) {
      Alert.alert('Error', 'Please select at least one class');
      return;
    }
    
    if (!newFeeStructure.type.trim()) {
      Alert.alert('Error', 'Please enter fee component');
      return;
    }
    
    if (!newFeeStructure.amount.trim() || isNaN(parseFloat(newFeeStructure.amount))) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (!newFeeStructure.dueDate) {
      Alert.alert('Error', 'Please select a due date');
      return;
    }

    if (!newFeeStructure.academicYear.trim()) {
      Alert.alert('Error', 'Please enter academic year');
      return;
    }

    // Validate the due date
    if (!isValidDate(newFeeStructure.dueDate)) {
      Alert.alert('Error', 'Please select a valid due date');
      return;
    }

    try {
      setPaymentLoading(true);
      
      // Create fee structure for each selected class
      const feeStructures = selectedClassIds.map(classId => ({
        class_id: classId,
        fee_component: newFeeStructure.type.trim(),
        amount: parseFloat(newFeeStructure.amount),
        academic_year: newFeeStructure.academicYear.trim(),
        due_date: format(new Date(newFeeStructure.dueDate), 'yyyy-MM-dd')
      }));

      const { error } = await supabase
        .from(TABLES.FEE_STRUCTURE)
        .insert(feeStructures);

      if (error) throw error;

      await loadAllData();
      
      setFeeStructureModal(false);
      setSelectedClassIds([]);
      setNewFeeStructure({
        type: '',
        amount: '',
        dueDate: null,
        academicYear: '2024-25'
      });
      
      Alert.alert(
        'Success', 
        `Fee structure added successfully for ${selectedClassIds.length} class(es)!`
      );

    } catch (error) {
      console.error('Error adding fee structure:', error);
      Alert.alert('Error', 'Failed to add fee structure. Please try again.');
    } finally {
      setPaymentLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Fee Management" showBack={true} />
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
        </View>
      ) : (
        <View style={styles.mainContainer}>
          {/* Tab Navigation */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, tab === 'structure' && styles.activeTab]}
              onPress={() => setTab('structure')}
            >
              <Text style={[styles.tabText, tab === 'structure' && styles.activeTabText]}>
                Fee Structure
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, tab === 'payments' && styles.activeTab]}
              onPress={() => setTab('payments')}
            >
              <Text style={[styles.tabText, tab === 'payments' && styles.activeTabText]}>
                Payments
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, tab === 'recent' && styles.activeTab]}
              onPress={() => setTab('recent')}
            >
              <Text style={[styles.tabText, tab === 'recent' && styles.activeTabText]}>
                Recent Payments
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          {tab === 'structure' && (
            <ScrollView 
              style={styles.contentContainer}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={loadAllData} />
              }
            >
              <View style={styles.structureContent}>
                {feeStructures.map((classData) => (
                  <View key={classData.classId} style={styles.classCard}>
                    {/* Class Header */}
                    <View style={styles.classHeader}>
                      <Text style={styles.className}>{classData.name}</Text>
                    </View>

                    {/* Fee Items */}
                    {classData.fees && classData.fees.map((fee, index) => (
                      <TouchableOpacity 
                        key={index} 
                        style={styles.feeItemCard}
                        onPress={() => openFeeModal(classData.classId, fee)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.feeItemContent}>
                          <View style={styles.feeItemLeft}>
                            <Text style={styles.feeItemTitle}>
                              {fee.type || fee.fee_component || 'Unknown Fee'} {formatSafeCurrency(fee.amount)}
                            </Text>
                            <Text style={styles.feeItemDescription}>
                              {fee.description || fee.fee_component || 'No description'}
                            </Text>
                            <View style={styles.feeItemDate}>
                              <Ionicons name="calendar-outline" size={14} color="#1976d2" />
                              <Text style={styles.feeItemDateText}>
                                Due: {formatSafeDate(fee.due_date)}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.feeItemActions}>
                            <TouchableOpacity 
                              style={styles.feeActionButton}
                              onPress={(e) => {
                                e.stopPropagation();
                                handleDeleteFee(fee);
                              }}
                            >
                              <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
                {/* Add bottom padding to ensure last card is fully visible */}
                <View style={styles.bottomSpacer} />
              </View>
            </ScrollView>
          )}
          {tab === 'payments' && (
            <ScrollView 
              style={styles.contentContainer}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={loadAllData} />
              }
            >
              <View style={styles.paymentsContent}>
                {/* Payment Summary Cards */}
                <View style={styles.paymentSummaryContainer}>
                  <Text style={styles.sectionTitle}>Payment Overview</Text>
                  <View style={styles.summaryCardsRow}>
                    <View style={[styles.summaryCard, { backgroundColor: '#4CAF50' }]}>
                      <Text style={styles.summaryCardValue}>{formatSafeCurrency(paymentSummary.totalCollected)}</Text>
                      <Text style={styles.summaryCardLabel}>Total Collected</Text>
                    </View>
                    <View style={[styles.summaryCard, { backgroundColor: '#FF9800' }]}>
                      <Text style={styles.summaryCardValue}>{formatSafeCurrency(paymentSummary.totalOutstanding)}</Text>
                      <Text style={styles.summaryCardLabel}>Outstanding</Text>
                    </View>
                  </View>
                  <View style={styles.summaryCardsRow}>
                    <View style={[styles.summaryCard, { backgroundColor: '#2196F3' }]}>
                      <Text style={styles.summaryCardValue}>{paymentSummary.collectionRate}%</Text>
                      <Text style={styles.summaryCardLabel}>Collection Rate</Text>
                    </View>
                    <View style={[styles.summaryCard, { backgroundColor: '#9C27B0' }]}>
                      <Text style={styles.summaryCardValue}>{formatSafeCurrency(paymentSummary.totalDue)}</Text>
                      <Text style={styles.summaryCardLabel}>Total Due</Text>
                    </View>
                  </View>
                </View>

                {/* Class-wise Payment Statistics */}
                <View style={styles.classStatsContainer}>
                  <Text style={styles.sectionTitle}>Class-wise Payment Status</Text>
                  {classPaymentStats.length === 0 ? (
                    <Text style={styles.noDataText}>No payment data available</Text>
                  ) : (
                    classPaymentStats.map((classData, index) => (
                      <TouchableOpacity
                        key={classData.classId}
                        style={styles.classStatCard}
                        onPress={() => {
                          navigation.navigate('ClassStudentDetails', { classData });
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.classStatHeader}>
                          <Text style={styles.classStatName}>{classData.className}</Text>
                          <View style={styles.classStatHeaderRight}>
                            <View style={[
                              styles.collectionRateBadge,
                              { backgroundColor: classData.collectionRate >= 80 ? '#4CAF50' :
                                classData.collectionRate >= 50 ? '#FF9800' : '#F44336' }
                            ]}>
                              <Text style={styles.collectionRateText}>{classData.collectionRate}%</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#666" style={{ marginLeft: 8 }} />
                          </View>
                        </View>

                        <View style={styles.classStatDetails}>
                          <View style={styles.statRow}>
                            <Text style={styles.statLabel}>Students: {classData.totalStudents}</Text>
                            <Text style={styles.statValue}>
                              Paid: {classData.studentsWithPayments} | Pending: {classData.studentsWithoutPayments}
                            </Text>
                          </View>

                          <View style={styles.statRow}>
                            <Text style={styles.statLabel}>Expected Fees:</Text>
                            <Text style={styles.statValue}>{formatSafeCurrency(classData.totalExpectedFees)}</Text>
                          </View>

                          <View style={styles.statRow}>
                            <Text style={styles.statLabel}>Collected:</Text>
                            <Text style={[styles.statValue, { color: '#4CAF50' }]}>
                              {formatSafeCurrency(classData.totalPaid)}
                            </Text>
                          </View>

                          <View style={styles.statRow}>
                            <Text style={styles.statLabel}>Outstanding:</Text>
                            <Text style={[styles.statValue, { color: '#F44336' }]}>
                              {formatSafeCurrency(classData.outstanding)}
                            </Text>
                          </View>
                        </View>

                        {/* Progress Bar */}
                        <View style={styles.progressBarContainer}>
                          <View style={styles.progressBarBackground}>
                            <View
                              style={[
                                styles.progressBarFill,
                                {
                                  width: `${Math.min(classData.collectionRate, 100)}%`,
                                  backgroundColor: classData.collectionRate >= 80 ? '#4CAF50' :
                                    classData.collectionRate >= 50 ? '#FF9800' : '#F44336'
                                }
                              ]}
                            />
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </View>

              </View>
            </ScrollView>
          )}
          {tab === 'recent' && (
            <ScrollView 
              style={styles.contentContainer}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={loadAllData} />
              }
            >
              <View style={styles.paymentsContent}>
                {/* Recent Payments */}
                <View style={styles.recentPaymentsContainer}>
                  <Text style={styles.sectionTitle}>Recent Payments</Text>
                  {payments.slice(0, 20).map((item, index) => (
                    <View key={item.id} style={styles.paymentItem}>
                      <View style={styles.paymentItemLeft}>
                        <Text style={styles.paymentStudentName}>{item.students?.full_name || 'Unknown Student'}</Text>
                        <Text style={styles.paymentFeeType}>{item.fee_structure?.fee_component || item.fee_component || 'Unknown Fee'}</Text>
                        <Text style={styles.paymentDate}>{formatSafeDate(item.payment_date)}</Text>
                      </View>
                      <View style={styles.paymentItemRight}>
                        <Text style={styles.paymentAmount}>{formatSafeCurrency(item.amount_paid)}</Text>
                        <View style={styles.paymentStatus}>
                          <View style={[
                            styles.statusDot, 
                            { backgroundColor: item.status === 'paid' ? '#4CAF50' : 
                                              item.status === 'partial' ? '#FF9800' : '#F44336' }
                          ]} />
                          <Text style={styles.statusText}>
                            {item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : 'Paid'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                  {payments.length === 0 && (
                    <View style={styles.emptyContainer}>
                      <Ionicons name="receipt-outline" size={48} color="#ccc" />
                      <Text style={styles.noPaymentsText}>No payments found</Text>
                      <Text style={styles.emptySubtext}>Payment records will appear here when available</Text>
                    </View>
                  )}
                </View>
              </View>
            </ScrollView>
          )}
        </View>
      )}
      {tab === 'structure' && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            setSelectedClassIds([]); // Reset to empty array
            setNewFeeStructure({
              type: '',
              amount: '',
              dueDate: null,
              academicYear: '2024-25'
            });
            setFeeStructureModal(true);
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

    {/* Modal for Payment, Fee Edit/Add, and Fee Structure */}
    <Modal
      animationType="slide"
      transparent={true}
      visible={paymentModal || feeModal.visible || feeStructureModal}
      onRequestClose={() => {
        if (paymentModal) {
          setPaymentModal(false);
        } else if (feeModal.visible) {
          setFeeModal({ visible: false, classId: '', fee: { type: '', amount: '', dueDate: '', description: '' } });
        } else {
          setFeeStructureModal(false);
        }
      }}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>
            {paymentModal 
              ? 'Make Payment' 
              : feeModal.visible 
                ? (editFeeId ? 'Edit Fee' : 'Add New Fee')
                : 'Add New Fee Structure'
            }
          </Text>
          
          {paymentModal ? (
            <View>
              <Text style={styles.studentInfo}>Student: {selectedStudent?.name || 'Unknown'}</Text>
              <Text style={styles.studentInfo}>Fee: {selectedFee?.type || 'Unknown'}</Text>
              <Text style={styles.studentInfo}>Amount: {formatSafeCurrency(paymentAmount)}</Text>
              <Text style={styles.studentInfo}>Payment Date: {formatSafeDate(paymentDate)}</Text>
              <TextInput
                style={styles.input}
                value={paymentAmount}
                onChangeText={setPaymentAmount}
                placeholder="Enter payment amount"
                keyboardType="numeric"
              />
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.dateButtonText}>Select Payment Date</Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={paymentDate && !isNaN(new Date(paymentDate).getTime()) ? new Date(paymentDate) : new Date()}
                  mode="date"
                  is24Hour={true}
                  display="default"
                  onChange={handleDateChange}
                />
              )}
            </View>
          ) : feeModal.visible ? (
            <View>
              <TextInput
                style={styles.input}
                placeholder="Fee Type"
                value={feeModal.fee.type}
                onChangeText={text => {
                  setFeeModal(prev => ({
                    ...prev,
                    fee: {
                      ...prev.fee,
                      type: text
                    }
                  }));
                }}
              />
              <TextInput
                style={styles.input}
                placeholder="Amount"
                value={feeModal.fee.amount}
                onChangeText={text => {
                  setFeeModal(prev => ({
                    ...prev,
                    fee: {
                      ...prev.fee,
                      amount: text
                    }
                  }));
                }}
                keyboardType="numeric"
              />
              <TextInput
                style={styles.input}
                placeholder="Description"
                value={feeModal.fee.description}
                onChangeText={text => {
                  setFeeModal(prev => ({
                    ...prev,
                    fee: {
                      ...prev.fee,
                      description: text
                    }
                  }));
                }}
                multiline
                numberOfLines={3}
              />
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.dateButtonText}>Select Due Date</Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={feeModal.fee.dueDate ? new Date(feeModal.fee.dueDate) : new Date()}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false);
                    if (selectedDate) {
                      setFeeModal(prev => ({
                        ...prev,
                        fee: {
                          ...prev.fee,
                          dueDate: selectedDate.toISOString().split('T')[0]
                        }
                      }));
                    }
                  }}
                  minimumDate={new Date()}
                />
              )}
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 400 }}>
              {/* Multiple Class Selection */}
              <Text style={styles.inputLabel}>Select Classes *</Text>
              <Text style={styles.helperText}>Tap classes to select/deselect multiple</Text>
              
              {/* All Classes Button */}
              <View style={styles.allClassesContainer}>
                <TouchableOpacity
                  style={[
                    styles.allClassesButton,
                    selectedClassIds.length === classes.length && styles.allClassesButtonSelected
                  ]}
                  onPress={() => {
                    if (selectedClassIds.length === classes.length) {
                      // Deselect all
                      setSelectedClassIds([]);
                    } else {
                      // Select all
                      setSelectedClassIds(classes.map(cls => cls.id));
                    }
                  }}
                >
                  <Ionicons 
                    name={selectedClassIds.length === classes.length ? "checkmark-circle" : "ellipse-outline"} 
                    size={20} 
                    color={selectedClassIds.length === classes.length ? "#fff" : "#1976d2"} 
                    style={{ marginRight: 8 }}
                  />
                  <Text style={[
                    styles.allClassesButtonText,
                    selectedClassIds.length === classes.length && styles.allClassesButtonTextSelected
                  ]}>
                    All Classes ({classes.length})
                  </Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.classSelectionContainer}>
                {classes.map((cls) => (
                  <TouchableOpacity
                    key={cls.id}
                    style={[
                      styles.classChip,
                      selectedClassIds.includes(cls.id) && styles.selectedClassChip
                    ]}
                    onPress={() => {
                      if (selectedClassIds.includes(cls.id)) {
                        // Remove from selection
                        setSelectedClassIds(prev => prev.filter(id => id !== cls.id));
                      } else {
                        // Add to selection
                        setSelectedClassIds(prev => [...prev, cls.id]);
                      }
                    }}
                  >
                    <Text style={[
                      styles.classChipText,
                      selectedClassIds.includes(cls.id) && styles.selectedClassChipText
                    ]}>
                      {cls.class_name} - {cls.section || 'A'}
                    </Text>
                    {selectedClassIds.includes(cls.id) && (
                      <Ionicons name="checkmark-circle" size={16} color="#fff" style={{ marginLeft: 4 }} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Fee Component *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Tuition Fee, Bus Fee, Lab Fee"
                value={newFeeStructure.type}
                onChangeText={(text) => setNewFeeStructure({ ...newFeeStructure, type: text })}
              />
              
              <Text style={styles.inputLabel}>Amount *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter amount in ₹"
                value={newFeeStructure.amount}
                onChangeText={(text) => setNewFeeStructure({ ...newFeeStructure, amount: text })}
                keyboardType="numeric"
              />

              <Text style={styles.inputLabel}>Due Date *</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color="#1976d2" />
                <Text style={[styles.dateButtonText, { color: newFeeStructure.dueDate ? '#333' : '#999' }]}>
                  {newFeeStructure.dueDate ? formatSafeDate(newFeeStructure.dueDate) : 'Select due date'}
                </Text>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={newFeeStructure.dueDate || new Date()}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false);
                    if (selectedDate) {
                      setNewFeeStructure({ ...newFeeStructure, dueDate: selectedDate });
                    }
                  }}
                  minimumDate={new Date()}
                />
              )}

              <Text style={styles.requiredNote}>* Required fields</Text>
              
              {/* Selected Classes Summary */}
              {selectedClassIds.length > 0 && (
                <View style={styles.summaryContainer}>
                  <Text style={styles.summaryTitle}>
                    Fee will be created for {selectedClassIds.length} class(es):
                  </Text>
                  {selectedClassIds.map(classId => {
                    const cls = classes.find(c => c.id === classId);
                    return (
                      <Text key={classId} style={styles.summaryItem}>
                        • {cls?.class_name} - {cls?.section || 'A'}
                      </Text>
                    );
                  })}
                  {newFeeStructure.dueDate && (
                    <Text style={styles.summaryItem}>
                      • Due Date: {formatSafeDate(newFeeStructure.dueDate)}
                    </Text>
                  )}
                </View>
              )}
            </ScrollView>
          )}
          
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => {
                if (paymentModal) {
                  setPaymentModal(false);
                } else if (feeModal.visible) {
                  setFeeModal({ visible: false, classId: '', fee: { type: '', amount: '', dueDate: '', description: '' } });
                } else {
                  setFeeStructureModal(false);
                }
              }}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.saveButton]}
              onPress={() => {
                if (paymentModal) {
                  handlePayment(selectedStudent?.id, selectedFee?.id, paymentAmount);
                } else if (feeModal.visible) {
                  if (editFeeId) {
                    handleEditFee(feeModal.classId, editFeeId, feeModal.fee);
                  } else {
                    handleFeeOperation('add', feeModal.fee);
                  }
                } else {
                  handleAddFeeStructure();
                }
              }}
              disabled={paymentLoading}
            >
              <Text style={[styles.buttonText, { color: '#fff' }]}>
                {paymentLoading ? 'Saving...' : 
                  paymentModal ? 'Pay' : 
                  feeModal.visible ? (editFeeId ? 'Update' : 'Save') : 
                  'Add'
                }
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  </View>
);};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  mainContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#E8E8E8',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    textAlign: 'center',
  },
  activeTabText: {
    color: '#333',
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  structureContent: {
    gap: 16,
  },
  classCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  classHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  className: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  editClassButton: {
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
  },
  classInfo: {
    backgroundColor: '#f8f9ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  classDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  dueStudents: {
    fontSize: 14,
    color: '#4A90E2',
    marginBottom: 2,
  },
  totalDue: {
    fontSize: 14,
    color: '#4A90E2',
    fontWeight: '500',
  },
  feeItemCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    marginBottom: 8,
  },
  feeItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  feeItemLeft: {
    flex: 1,
  },
  feeItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A5568',
    marginBottom: 4,
  },
  feeItemDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  feeItemDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  feeItemDateText: {
    fontSize: 12,
    color: '#4A90E2',
  },
  feeItemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  feeActionButton: {
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    width: '90%',
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 24,
    textAlign: 'center',
  },
  studentInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  dateButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  dateButtonText: {
    fontSize: 14,
    color: '#666',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 24,
    gap: 12,
  },
  modalButton: {
    padding: 12,
    borderRadius: 8,
    minWidth: 100,
    marginRight: 8,
  },
  cancelButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  saveButton: {
    backgroundColor: '#2196F3',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
  },
  studentInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
    marginTop: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  picker: {
    height: 50,
  },
  requiredNote: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 80,
    backgroundColor: '#1976d2',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 1000,
  },
  bottomSpacer: {
    height: 100,
    width: '100%',
  },
  classSelectionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    gap: 8,
  },
  classChip: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedClassChip: {
    backgroundColor: '#1976d2',
    borderColor: '#1976d2',
  },
  classChipText: {
    fontSize: 14,
    color: '#333',
  },
  selectedClassChipText: {
    color: '#fff',
    fontWeight: '500',
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  datePickerText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
    marginLeft: 8,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  summaryContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#1976d2',
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  summaryItem: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  // Missing styles for payments tab
  paymentsContent: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  paymentItem: {
    backgroundColor: '#fff',
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  paymentStudentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  paymentFeeType: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
    marginBottom: 4,
  },
  paymentDate: {
    fontSize: 12,
    color: '#999',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 200,
  },
  noPaymentsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Missing styles for reports tab
  reportsContent: {
    padding: 16,
  },
  statisticItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    marginVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statisticLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  statisticValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2196F3',
  },
  // Payment section styles
  paymentSummaryContainer: {
    marginBottom: 20,
  },
  summaryCardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  summaryCardValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  summaryCardLabel: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.9,
    textAlign: 'center',
  },
  classStatsContainer: {
    marginBottom: 20,
  },
  classStatCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  classStatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  classStatName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  classStatHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  collectionRateBadge: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  collectionRateText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  classStatDetails: {
    marginBottom: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'right',
  },
  progressBarContainer: {
    marginTop: 8,
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 3,
  },
  recentPaymentsContainer: {
    marginBottom: 20,
  },
  paymentItemLeft: {
    flex: 1,
  },
  paymentItemRight: {
    alignItems: 'flex-end',
  },
  noDataText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    fontStyle: 'italic',
    marginVertical: 20,
  },
  // All Classes Button Styles
  allClassesContainer: {
    marginBottom: 12,
  },
  allClassesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#1976d2',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  allClassesButtonSelected: {
    backgroundColor: '#1976d2',
    borderStyle: 'solid',
  },
  allClassesButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976d2',
  },
  allClassesButtonTextSelected: {
    color: '#fff',
  },
  // Recent Payments Tab Specific Styles
  paymentStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});

export default FeeManagement;
