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
import { useTenant } from '../../contexts/TenantContext';
import { calculateStudentFees } from '../../utils/feeCalculation';
import FeeService from '../../services/FeeService';
import { validateTenantAccess, createTenantQuery, validateDataTenancy, TENANT_ERROR_MESSAGES } from '../../utils/tenantValidation';
import { useAuth } from '../../utils/AuthContext';
import { 
  getOptimizedFeeManagementData, 
  calculateOptimizedClassPaymentStats, 
  getRecentPayments, 
  getOrganizedFeeStructures,
  clearFeeCache 
} from '../../utils/optimizedFeeHelpers';

const FeeManagement = () => {
  const navigation = useNavigation();
  const { tenantId, tenantName, currentTenant, loading: tenantLoading } = useTenant();
  const { user } = useAuth();
  
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
  const [optimizedData, setOptimizedData] = useState(null);
  const [useOptimizedQueries, setUseOptimizedQueries] = useState(true);
  
  
  // UPI Payment Verification state
  const [pendingUPIPayments, setPendingUPIPayments] = useState([]);
  const [upiLoading, setUpiLoading] = useState(false);

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
        // 🛡️ Validate tenant access first
        const validation = await validateTenantAccess(user?.id, tenantId, 'FeeManagement - calculateFeeStats');
        if (!validation.isValid) {
          console.error('❌ FeeManagement calculateFeeStats: Tenant validation failed:', validation.error);
          setFeeStats({ totalDue: 0, totalPaid: 0, pendingStudents: 0 });
          return;
        }

        try {
          console.log('🔍 FeeManagement: Calculating fee stats for tenant:', tenantId);
          
          // Validate tenantId and table names
          if (!tenantId) {
            throw new Error('TenantId is required for tenant-aware queries');
          }
          if (!TABLES.FEE_STRUCTURE || !TABLES.STUDENT_FEES || !TABLES.STUDENTS) {
            throw new Error('Required table constants are undefined');
          }
          
          const feeResult = await createTenantQuery(tenantId, TABLES.FEE_STRUCTURE)
            .select('amount')
            .execute();
          const { data: feeStructures, error: feeError } = feeResult;

          if (feeError) throw feeError;

          const paymentResult = await createTenantQuery(tenantId, TABLES.STUDENT_FEES)
            .select('amount_paid, student_id')
            .execute();
          const { data: studentFees, error: paymentError } = paymentResult;

          if (paymentError) throw paymentError;

          const studentsResult = await createTenantQuery(tenantId, TABLES.STUDENTS)
            .select('id')
            .execute();
          const { data: allStudents, error: studentsError } = studentsResult;

          if (studentsError) throw studentsError;

          // Calculate totals
          const totalDue = (feeStructures || []).reduce((sum, fee) => sum + Number(fee.amount), 0);
          const totalPaid = (studentFees || []).reduce((sum, payment) => sum + Number(payment.amount_paid || 0), 0);
          
          // Calculate pending students - students who have no payments at all
          const studentsWithPayments = new Set((studentFees || []).map(fee => fee.student_id));
          const pendingStudents = (allStudents?.length || 0) - studentsWithPayments.size;

          console.log('FeeManagement - Fee Stats (Tenant:', tenantId, ')- Total Paid Amount:', totalPaid);
          setFeeStats({ totalDue, totalPaid, pendingStudents });
    } catch (error) {
      console.error('FeeManagement - Error calculating fee statistics:', error);
      setFeeStats({ totalDue: 0, totalPaid: 0, pendingStudents: 0 });
    }
  };

  // Helper function to get pending fees for a student
  const getPendingFees = async (studentId, classId) => {
    // 🛡️ Validate tenant access first
    const validation = await validateTenantAccess(user?.id, tenantId, 'FeeManagement - getPendingFees');
    if (!validation.isValid) {
      console.error('❌ FeeManagement getPendingFees: Tenant validation failed:', validation.error);
      return [];
    }

    try {
      // Validate parameters
      if (!tenantId) {
        throw new Error('TenantId is required for tenant-aware queries');
      }
      if (!TABLES.STUDENT_FEES || !TABLES.FEE_STRUCTURE) {
        throw new Error('Required table constants are undefined');
      }
      
      const feesResult = await createTenantQuery(tenantId, TABLES.STUDENT_FEES)
        .select('*')
        .eq('student_id', studentId)
        .execute();
      const { data: fees, error } = feesResult;

      if (error) throw error;
      
      // Get fee structure for this class using tenant-aware query
      const structureResult = await createTenantQuery(tenantId, TABLES.FEE_STRUCTURE)
        .select('*')
        .eq('class_id', classId)
        .execute();
      const { data: feeStructure, error: feeError } = structureResult;
      
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

  // Calculate class-wise payment statistics - OPTIMIZED VERSION
  const calculateClassPaymentStats = async () => {
    // 🛡️ Validate tenant access first
    const validation = await validateTenantAccess(user?.id, tenantId, 'FeeManagement - calculateClassPaymentStats');
    if (!validation.isValid) {
      console.error('❌ FeeManagement calculateClassPaymentStats: Tenant validation failed:', validation.error);
      setClassPaymentStats([]);
      setPaymentSummary({ totalCollected: 0, totalDue: 0, totalOutstanding: 0, collectionRate: 0 });
      return;
    }

    const startTime = performance.now(); // 📊 Performance monitoring
    
    try {
      console.log('🚀 Calculating class payment stats with optimized queries for tenant:', tenantId);
      
      const currentYear = new Date().getFullYear();
      const academicYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
      console.log('📅 Academic year being used:', academicYear);

      // Validate tenantId and table name before creating query
      if (!tenantId) {
        throw new Error('TenantId is required for tenant-aware queries');
      }
      if (!TABLES.CLASSES) {
        throw new Error('TABLES.CLASSES is undefined');
      }
      
      console.log('🔍 Debug info:', { tenantId, tableName: TABLES.CLASSES });

      // Get all classes in a single query using tenant-aware query with error handling
      let classesWithStats, error;
      try {
        const result = await createTenantQuery(tenantId, TABLES.CLASSES)
          .select(`
            id,
            class_name,
            section
          `)
          .execute();
        classesWithStats = result.data;
        error = result.error;
      } catch (queryError) {
        console.error('❌ Error creating tenant query:', queryError);
        error = queryError;
      }

      if (error) throw error;
      console.log('📊 Classes found:', classesWithStats?.length || 0);

      if (!classesWithStats || classesWithStats.length === 0) {
        console.log('❌ No classes found, setting empty stats');
        setClassPaymentStats([]);
        setPaymentSummary({ totalCollected: 0, totalDue: 0, totalOutstanding: 0, collectionRate: 0 });
        return;
      }

      const classIds = classesWithStats.map(c => c.id);

      // Get all fee structures for all classes using tenant-aware query
      let allFeeStructures;
      try {
        if (!TABLES.FEE_STRUCTURE) {
          throw new Error('TABLES.FEE_STRUCTURE is undefined');
        }
        const feeResult = await createTenantQuery(tenantId, TABLES.FEE_STRUCTURE)
          .select('*')
          .in('class_id', classIds)
          .execute();
        allFeeStructures = feeResult.data;
        if (feeResult.error) {
          console.error('❌ Fee structures query error:', feeResult.error);
        }
      } catch (feeError) {
        console.error('❌ Error in fee structures query:', feeError);
        allFeeStructures = [];
      }

      console.log('💰 Fee structures found:', allFeeStructures?.length || 0);
      if (allFeeStructures && allFeeStructures.length > 0) {
        console.log('💰 Sample fee structure:', allFeeStructures[0]);
      }

      // Get all students for all classes using tenant-aware query
      let allStudents;
      try {
        if (!TABLES.STUDENTS) {
          throw new Error('TABLES.STUDENTS is undefined');
        }
        const studentsResult = await createTenantQuery(tenantId, TABLES.STUDENTS)
          .select('id, name, class_id')
          .in('class_id', classIds)
          .execute();
        allStudents = studentsResult.data;
        if (studentsResult.error) {
          console.error('❌ Students query error:', studentsResult.error);
        }
      } catch (studentsError) {
        console.error('❌ Error in students query:', studentsError);
        allStudents = [];
      }

      console.log('👥 Students found:', allStudents?.length || 0);

      // Get all student IDs for payment lookup
      const studentIds = allStudents?.map(s => s.id) || [];
      console.log('🎯 Student IDs from classes query:', studentIds.length > 0 ? studentIds.slice(0, 5) : 'No students found');
      
      // Use centralized FeeService for complete consistency with parent/student views
      console.log('🎯 FeeManagement - Using centralized FeeService for admin view consistency');
      const studentFeeCalculations = new Map();
      for (const student of (allStudents || [])) {
        try {
          const feeServiceResult = await FeeService.getStudentFeeDetails(student.id);
          if (feeServiceResult.success && feeServiceResult.data) {
            const feeData = feeServiceResult.data;
            studentFeeCalculations.set(student.id, {
              totalAmount: feeData.fees.totalDue,
              totalPaid: feeData.fees.totalPaid,
              totalOutstanding: feeData.fees.totalOutstanding,
              totalDiscounts: feeData.fees.totalDiscounts,
              allFees: feeData.fees.components || []
            });
            console.log(`💰 Admin - Student ${student.name} fee calc (FeeService):`, {
              totalDue: feeData.fees.totalDue,
              totalPaid: feeData.fees.totalPaid,
              outstanding: feeData.fees.totalOutstanding,
              discounts: feeData.fees.totalDiscounts
            });
          } else {
            console.log(`⚠️ Admin - FeeService failed for student ${student.id}, trying fallback`);
            // Fallback to old calculation method
            const feeCalc = await calculateStudentFees(student.id, student.class_id);
            if (feeCalc) {
              studentFeeCalculations.set(student.id, feeCalc);
            }
          }
        } catch (calcError) {
          console.error(`Error calculating fees for student ${student.id}:`, calcError);
          // Try fallback calculation
          try {
            const feeCalc = await calculateStudentFees(student.id, student.class_id);
            if (feeCalc) {
              studentFeeCalculations.set(student.id, feeCalc);
            }
          } catch (fallbackError) {
            console.error(`Fallback calculation also failed for student ${student.id}:`, fallbackError);
          }
        }
      }
      
      // Get all concessions for all students using tenant-aware query
      let allConcessions = [];
      if (studentIds.length > 0) {
        try {
          if (!TABLES.STUDENT_DISCOUNTS) {
            throw new Error('TABLES.STUDENT_DISCOUNTS is undefined');
          }
          const concessionsResult = await createTenantQuery(tenantId, TABLES.STUDENT_DISCOUNTS)
            .select('student_id, discount_value, fee_component')
            .in('student_id', studentIds)
            .eq('academic_year', academicYear)
            .eq('is_active', true)
            .execute();
          
          if (!concessionsResult.error && concessionsResult.data) {
            allConcessions = concessionsResult.data;
            console.log('🎫 Concessions found:', allConcessions.length);
          } else if (concessionsResult.error) {
            console.error('❌ Concessions query error:', concessionsResult.error);
          }
        } catch (concessionsError) {
          console.error('❌ Error in concessions query:', concessionsError);
        }
      }
      
      // Debug the table reference issue
      console.log('🔍 Table reference being used:', TABLES.STUDENT_FEES);
      
      // First, let's check what student IDs actually exist in the payments table using tenant-aware query
      // Fix: Remove fee_id as it doesn't exist in the schema
      let allPaymentsCheck;
      try {
        if (!TABLES.STUDENT_FEES) {
          throw new Error('TABLES.STUDENT_FEES is undefined');
        }
        const checkResult = await createTenantQuery(tenantId, TABLES.STUDENT_FEES)
          .select('student_id, amount_paid')
          .limit(5)
          .execute();
        allPaymentsCheck = checkResult.data;
        if (checkResult.error) {
          console.error('🚨 Error checking payments table:', checkResult.error);
        }
      } catch (checkError) {
        console.error('🚨 Error in payments check query:', checkError);
      }
      
      console.log('🎯 Sample payment student IDs from database:', allPaymentsCheck?.map(p => p.student_id) || 'No payments in DB');
      
      // Also try getting ALL payments for tenant without filtering to see if there's a mismatch
      let allPaymentsUnfiltered;
      try {
        const unfilteredResult = await createTenantQuery(tenantId, TABLES.STUDENT_FEES)
          .select('student_id, amount_paid')
          .execute();
        allPaymentsUnfiltered = unfilteredResult.data;
        if (unfilteredResult.error) {
          console.error('🚨 Error getting unfiltered payments:', unfilteredResult.error);
        }
      } catch (unfilteredError) {
        console.error('🚨 Error in unfiltered payments query:', unfilteredError);
      }
        
      console.log('🎯 Total payments in database (for tenant):', allPaymentsUnfiltered?.length || 0);
      if (allPaymentsUnfiltered && allPaymentsUnfiltered.length > 0) {
        console.log('🎯 Sample unfiltered payment:', allPaymentsUnfiltered[0]);
        const totalFromUnfiltered = allPaymentsUnfiltered.reduce((sum, p) => sum + (parseFloat(p.amount_paid || 0)), 0);
        console.log('🎯 Total amount from unfiltered payments:', totalFromUnfiltered);
      }
      
      // Get all payments for all students using tenant-aware query
      // Fix: Remove fee_id as it doesn't exist in the schema
      let allPayments, paymentsError;
      if (studentIds.length > 0) {
        try {
          const paymentsResult = await createTenantQuery(tenantId, TABLES.STUDENT_FEES)
            .select('student_id, amount_paid')
            .in('student_id', studentIds)
            .execute();
          allPayments = paymentsResult.data;
          paymentsError = paymentsResult.error;
        } catch (error) {
          console.error('🚨 Error in filtered payments query:', error);
          allPayments = [];
          paymentsError = error;
        }
      } else {
        allPayments = [];
        paymentsError = null;
      }
        
      if (paymentsError) {
        console.error('🚨 Error getting filtered payments:', paymentsError);
      }

      console.log('💳 Payments found:', allPayments?.length || 0);
      console.log('💳 Raw payments data:', allPayments);
      if (allPayments && allPayments.length > 0) {
        console.log('💳 Sample payment:', allPayments[0]);
        console.log('💳 All payment amounts:', allPayments.map(p => p.amount_paid));
        const totalFromAllPayments = allPayments.reduce((sum, p) => {
          const amount = parseFloat(p.amount_paid || 0);
          console.log(`Payment ${p.student_id}: ${p.amount_paid} -> parsed: ${amount}`);
          return sum + amount;
        }, 0);
        console.log('💳 Total payments amount:', totalFromAllPayments);
      }

      // Create lookup maps for O(1) access
      const feeStructureLookup = {};
      (allFeeStructures || []).forEach(fee => {
        if (!feeStructureLookup[fee.class_id]) {
          feeStructureLookup[fee.class_id] = [];
        }
        feeStructureLookup[fee.class_id].push(fee);
      });

      const studentsLookup = {};
      (allStudents || []).forEach(student => {
        if (!studentsLookup[student.class_id]) {
          studentsLookup[student.class_id] = [];
        }
        studentsLookup[student.class_id].push(student);
      });

      const paymentsLookup = {};
      (allPayments || []).forEach(payment => {
        if (!paymentsLookup[payment.student_id]) {
          paymentsLookup[payment.student_id] = [];
        }
        paymentsLookup[payment.student_id].push(payment);
      });
      
      // Create concessions lookup
      const concessionsLookup = {};
      (allConcessions || []).forEach(concession => {
        if (!concessionsLookup[concession.student_id]) {
          concessionsLookup[concession.student_id] = [];
        }
        concessionsLookup[concession.student_id].push(concession);
      });
      
      // Debug total payments
      console.log('Class Payment Stats - Total payments:', allPayments?.length || 0);
      const totalPaymentsAmount = (allPayments || []).reduce((sum, p) => sum + (parseFloat(p.amount_paid || 0)), 0);
      console.log('Class Payment Stats - Total payments amount:', totalPaymentsAmount);

        // Process all classes synchronously using lookup maps with centralized fee calculation
        const classStats = classesWithStats.map(classData => {
          const feeStructures = feeStructureLookup[classData.id] || [];
          const studentsInClass = studentsLookup[classData.id] || [];

          // Use centralized fee calculation for accurate totals
          let totalExpectedFees = 0;
          let totalPaid = 0;
          const studentsWithPaymentsSet = new Set();

          studentsInClass.forEach(student => {
            const studentCalc = studentFeeCalculations.get(student.id);
            if (studentCalc) {
              totalExpectedFees += studentCalc.totalAmount;
              totalPaid += studentCalc.totalPaid;
              
              if (studentCalc.totalPaid > 0) {
                studentsWithPaymentsSet.add(student.id);
              }
            } else {
              // Fallback to old calculation if centralized calc failed
              const studentPayments = paymentsLookup[student.id] || [];
              const studentTotalPaid = studentPayments.reduce((sum, payment) => 
                sum + (parseFloat(payment.amount_paid || 0)), 0);
              
              totalPaid += studentTotalPaid;
              
              if (studentTotalPaid > 0) {
                studentsWithPaymentsSet.add(student.id);
              }
            }
          });

          // Calculate total students in class
          const totalStudents = studentsInClass.length;
          
          // If centralized calculation didn't provide expected fees, use fallback
          if (totalExpectedFees === 0) {
            const totalFeeStructure = feeStructures.reduce((sum, fee) => sum + (parseFloat(fee.amount) || 0), 0);
            totalExpectedFees = totalFeeStructure * totalStudents;
          }
            
          console.log(`Class ${classData.class_name} - Students: ${studentsInClass.length}, Expected: ${totalExpectedFees}, Paid: ${totalPaid}`);
            
          // Debug each student's calculations
          studentsInClass.forEach(student => {
            const studentCalc = studentFeeCalculations.get(student.id);
            if (studentCalc && studentCalc.totalPaid > 0) {
              console.log(`  Student ${student.name} (${student.id}): Expected ₹${studentCalc.totalAmount}, Paid ₹${studentCalc.totalPaid}`);
            }
          });

          const studentsWithPayments = studentsWithPaymentsSet.size;
          const studentsWithoutPayments = totalStudents - studentsWithPayments;

          // Calculate outstanding amount
          const outstanding = Math.max(0, totalExpectedFees - totalPaid);

          // Calculate collection rate
          const collectionRate = totalExpectedFees > 0 ? (totalPaid / totalExpectedFees) * 100 : 0;
        
        // Calculate concessions for this class
        let totalConcessions = 0;
        let studentsWithConcessions = 0;
        const concessionDetails = [];
        
        studentsInClass.forEach(student => {
          const studentConcessions = concessionsLookup[student.id] || [];
          if (studentConcessions.length > 0) {
            studentsWithConcessions++;
            const studentTotalConcession = studentConcessions.reduce((sum, concession) => 
              sum + (parseFloat(concession.discount_value) || 0), 0);
            totalConcessions += studentTotalConcession;
            concessionDetails.push({
              studentId: student.id,
              studentName: student.name,
              concessionAmount: studentTotalConcession,
              concessions: studentConcessions
            });
          }
        });

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
            feeStructureAmount: totalExpectedFees / Math.max(totalStudents, 1), // Average fee per student
            totalConcessions,
            studentsWithConcessions,
            concessionDetails
          };
      });

      // Sort by outstanding amount (highest first)
      classStats.sort((a, b) => b.outstanding - a.outstanding);

      setClassPaymentStats(classStats);

      console.log('📈 Class stats before summary calculation:', classStats);
      
      // Calculate overall payment summary
      const summary = classStats.reduce((acc, classData) => {
        console.log(`📊 Processing class ${classData.className}: collected=${classData.totalPaid}, due=${classData.totalExpectedFees}, outstanding=${classData.outstanding}`);
        
        return {
          totalCollected: acc.totalCollected + (classData.totalPaid || 0),
          totalDue: acc.totalDue + (classData.totalExpectedFees || 0),
          totalOutstanding: acc.totalOutstanding + (classData.outstanding || 0),
        };
      }, { totalCollected: 0, totalDue: 0, totalOutstanding: 0 });
      
      console.log('💰 Final payment summary calculation:', summary);
      console.log('💰 Total collected from all classes (sum):', classStats.reduce((sum, c) => sum + (c.totalPaid || 0), 0));
      console.log('💰 Direct total from all payments query:', totalPaymentsAmount);

      // Override with direct calculation if available
      if (totalPaymentsAmount > 0 && summary.totalCollected === 0) {
        console.log('🔧 Using direct payment total instead of class aggregation');
        summary.totalCollected = totalPaymentsAmount;
        summary.totalOutstanding = summary.totalDue - totalPaymentsAmount;
      }

      summary.collectionRate = summary.totalDue > 0 ?
        Math.round((summary.totalCollected / summary.totalDue) * 10000) / 100 : 0;

      console.log('💰 Final payment summary (after override):', summary);
      setPaymentSummary(summary);

      // 📊 Performance monitoring
      const endTime = performance.now();
      const loadTime = Math.round(endTime - startTime);
      console.log(`✅ Class payment stats calculated successfully in ${loadTime}ms`);
      console.log(`📈 Performance: ${classStats.length} classes processed`);
      
      if (loadTime > 1000) {
        console.warn('⚠️ Slow calculation detected. Consider adding database indexes.');
      } else {
        console.log('🚀 Fast calculation achieved!');
      }

    } catch (error) {
      const endTime = performance.now();
      const loadTime = Math.round(endTime - startTime);
      console.error(`❌ Error calculating class payment stats after ${loadTime}ms:`, error);
    }
  };

  // Clear cache and refresh data helper
  const refreshWithCacheClear = async () => {
    if (tenantId) {
      clearFeeCache(tenantId);
      setOptimizedData(null);
      setUseOptimizedQueries(true);
      isLoadingRef.current = false; // Reset loading guard
    }
    await loadAllData();
  };
  

  // Load data when tenant is available (once)
  const hasInitiallyLoaded = useRef(false);
  useEffect(() => {
    if (!tenantLoading && tenantId && !hasInitiallyLoaded.current) {
      hasInitiallyLoaded.current = true;
      loadAllData();
    }
  }, [tenantId, tenantLoading]);


  // Remove the tab change effect as it's causing continuous refreshing
  // The useFocusEffect and pull-to-refresh should be sufficient for real-time updates

  const isLoadingRef = useRef(false);
  const loadAllData = async () => {
    if (!tenantId || isLoadingRef.current) {
      return;
    }
    
    isLoadingRef.current = true;

    try {
      setLoading(true);
      setRefreshing(true);

      if (useOptimizedQueries) {
        // Use optimized helper functions
        const processedData = await getOptimizedFeeManagementData(tenantId, user);
        setOptimizedData(processedData);
        
        // Set organized data for UI compatibility
        setClasses(Array.from(processedData.classesMap.values()));
        setFeeStructures(getOrganizedFeeStructures(processedData));
        setStudents(Array.from(processedData.studentsMap.values()).map(student => ({
          ...student,
          full_name: student.name
        })));
        setPayments(getRecentPayments(processedData, 50));
        
        // Calculate statistics using optimized methods
        const statsResult = await calculateOptimizedClassPaymentStats(processedData);
        setClassPaymentStats(statsResult.classStats);
        setPaymentSummary(statsResult.summary);
        
        // Calculate basic fee stats
        const totalDue = statsResult.summary.totalDue;
        const totalPaid = statsResult.summary.totalCollected;
        const pendingStudents = statsResult.classStats.reduce((sum, cls) => sum + cls.studentsWithoutPayments, 0);
        setFeeStats({ totalDue, totalPaid, pendingStudents });
      } else {
        // Fallback to original method if optimized queries fail
        await loadAllDataOriginal();
      }

    } catch (error) {
      if (useOptimizedQueries) {
        setUseOptimizedQueries(false);
        return loadAllData(); // Retry with original method
      } else {
        Alert.alert('Error', `Failed to load fee data: ${error.message}`);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      isLoadingRef.current = false;
    }
  };

  // Original method as fallback
  const loadAllDataOriginal = async () => {
    console.log('📋 Using original fee data loading method');
    // Load all data in parallel for better performance with tenant filtering
    const [
      { data: classesData, error: classesError },
      { data: feeStructuresData, error: feeStructuresError },
      { data: studentsData, error: studentsError },
      { data: paymentsData, error: paymentsError },
      { data: allFeeStructures, error: allFeeError }
    ] = await Promise.all([
      supabase.from(TABLES.CLASSES).select('*').eq('tenant_id', tenantId),
      supabase.from(TABLES.FEE_STRUCTURE).select(`
        *,
        classes:${TABLES.CLASSES}(id, class_name)
      `).eq('tenant_id', tenantId),
      supabase.from(TABLES.STUDENTS).select(`
        *,
        classes:${TABLES.CLASSES}(class_name)
      `).eq('tenant_id', tenantId),
      supabase.from(TABLES.STUDENT_FEES).select(`
        *,
        students(name)
      `).eq('tenant_id', tenantId),
      supabase.from(TABLES.FEE_STRUCTURE).select('*').eq('tenant_id', tenantId)
    ]);

    // Check for errors
    if (classesError) throw classesError;
    if (feeStructuresError) throw feeStructuresError;
    if (studentsError) throw studentsError;
    if (paymentsError) throw paymentsError;
    if (allFeeError) throw allFeeError;

    // Set classes data
    setClasses(classesData || []);
    
    // Process fee structures to group by class - optimized
    const groupedByClass = {};
    (feeStructuresData || []).forEach(fee => {
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
        due_date: fee.due_date,
        created_at: fee.created_at,
        description: fee.fee_component || 'No description',
        academic_year: fee.academic_year || '2024-25'
      });
    });
    
    // Convert grouped object to array
    const processedFeeStructures = Object.values(groupedByClass);
    setFeeStructures(processedFeeStructures);

    // Process students data - optimized mapping
    const mappedStudents = (studentsData || []).map(student => ({
      ...student,
      full_name: student.name
    }));
    setStudents(mappedStudents);

    // Create fee structure lookup for O(1) access
    const feeStructureLookup = {};
    (allFeeStructures || []).forEach(fs => {
      feeStructureLookup[fs.id] = fs;
    });

    // Process payments data with lookup - no async operations
    const enrichedPayments = (paymentsData || []).map(payment => {
      const feeStructure = feeStructureLookup[payment.fee_id];
      return {
        ...payment,
        students: { full_name: payment.students?.name },
        fee_structure: feeStructure
      };
    });
    setPayments(enrichedPayments);

    // Calculate fee statistics (already optimized with parallel queries)
    await calculateFeeStats();

    // Calculate class-wise payment statistics (now optimized)
    await calculateClassPaymentStats();
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
            description: operation === 'edit' ? feeData.description : newFeeStructure.description,
            tenant_id: tenantId
          }
        ])
        .select();

      if (error) throw error;

      await refreshWithCacheClear();
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
        .eq('id', feeId)
        .eq('tenant_id', tenantId);

      if (error) throw error;

      await refreshWithCacheClear();
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
  const handlePayment = async (studentId, feeStructureId, amount) => {
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
      
      // Get the fee structure to know the details
      const { data: feeStructure, error: feeStructureError } = await supabase
        .from(TABLES.FEE_STRUCTURE)
        .select('amount, fee_component, academic_year')
        .eq('id', feeStructureId)
        .eq('tenant_id', tenantId)
        .single();
        
      if (feeStructureError) throw feeStructureError;
      
      // First check if there's an existing record for this student and fee component
      const { data: existingFees, error: checkError } = await supabase
        .from(TABLES.STUDENT_FEES)
        .select('*')
        .eq('student_id', studentId)
        .eq('fee_component', feeStructure.fee_component)
        .eq('academic_year', feeStructure.academic_year)
        .eq('tenant_id', tenantId);
        
      if (checkError) {
        throw checkError;
      }
      
      const totalAmount = feeStructure.amount;
      const amountPaid = parseFloat(amount);
      
      // Calculate existing payments for this fee component
      const existingAmountPaid = existingFees?.reduce((sum, fee) => sum + Number(fee.amount_paid || 0), 0) || 0;
      const newTotalPaid = existingAmountPaid + amountPaid;
      
      let status = 'pending';
      if (newTotalPaid >= totalAmount) {
        status = 'paid';
      } else if (newTotalPaid > 0) {
        status = 'partial';
      }
      
      // Always create a new payment record (this represents a payment transaction)
      const { error: insertError } = await supabase
        .from(TABLES.STUDENT_FEES)
        .insert([
          {
            student_id: studentId,
            fee_component: feeStructure.fee_component,
            academic_year: feeStructure.academic_year,
            amount_paid: amountPaid,
            payment_date: paymentDate.toISOString().split('T')[0], // Date only
            payment_mode: 'Cash', // Default payment mode, can be made configurable
            tenant_id: tenantId
            // Note: status will be automatically calculated by the database trigger we created
          }
        ]);

      if (insertError) throw insertError;

      // Clear cache and refresh data
      await refreshWithCacheClear();
      Alert.alert('Success', 'Payment recorded successfully');
      setPaymentModal(false);
      setSelectedStudent(null);
      setSelectedFee(null);
      setPaymentAmount('');
      setPaymentDate(new Date());

    } catch (error) {
      console.error('Error adding payment:', error);
      Alert.alert('Error', `Failed to record payment: ${error.message}`);
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
        .eq('tenant_id', tenantId)
        .single();
      
      if (feeError) throw feeError;
      
      // Check if there are any student fees associated with this fee component
      const { data: associatedFees, error: checkError } = await supabase
        .from(TABLES.STUDENT_FEES)
        .select('id')
        .eq('fee_component', feeStructure?.fee_component || 'Unknown')
        .eq('academic_year', feeStructure?.academic_year || '2024-25')
        .eq('tenant_id', tenantId);
      
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
        .eq('id', feeId)
        .eq('tenant_id', tenantId);

      if (error) throw error;

      // Clear cache and refresh data
      await refreshWithCacheClear();
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
        .eq('academic_year', fee.academic_year || '2024-25')
        .eq('tenant_id', tenantId);
      
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
        .eq('id', fee.id)
        .eq('tenant_id', tenantId);

      if (error) throw error;

      // Clear cache and refresh data
      await refreshWithCacheClear();
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
      const amountValue = parseFloat(newFeeStructure.amount);
      const feeStructures = selectedClassIds.map(classId => ({
        class_id: classId,
        student_id: null, // ⚠️ CRITICAL: Explicitly set to null for class-level fees
        fee_component: newFeeStructure.type.trim(),
        amount: amountValue,
        base_amount: amountValue, // ✅ FIXED: Set base_amount equal to amount for class fees
        academic_year: newFeeStructure.academicYear.trim(),
        due_date: format(new Date(newFeeStructure.dueDate), 'yyyy-MM-dd'),
        tenant_id: tenantId
      }));

      const { error } = await supabase
        .from(TABLES.FEE_STRUCTURE)
        .insert(feeStructures);

      if (error) throw error;

      // Clear cache and reload data after successful operation
      await refreshWithCacheClear();
      
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
      <Header 
        title="Fee Management" 
        showBack={true}
        rightIcon="pricetags-outline"
        rightIconOnPress={() => navigation.navigate('DiscountManagement')}
        rightIconTitle="Manage Discounts"
      />
      
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
            <TouchableOpacity
              style={[styles.tab, tab === 'upi' && styles.activeTab]}
              onPress={() => {
                setTab('upi');
                // Navigate to UPI Payment Verification screen
                navigation.navigate('PendingUPIPayments');
              }}
            >
              <Text style={[styles.tabText, tab === 'upi' && styles.activeTabText]}>
                UPI Verification
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.scrollWrapper}>
            <ScrollView
              style={styles.scrollContainer}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={Platform.OS === 'web'}
              refreshControl={
                <RefreshControl 
                  refreshing={refreshing} 
                  onRefresh={refreshWithCacheClear}
                  title="Pull to refresh fee data"
                  tintColor="#1976d2"
                  colors={['#1976d2']}
                />
              }
              keyboardShouldPersistTaps="handled"
              bounces={Platform.OS !== 'web'}
            >
              {tab === 'structure' && (
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
                              {fee.type || fee.fee_component || 'Unknown Fee'}
                            </Text>
                            <View style={styles.feeAmountContainer}>
                              <Text style={styles.feeBaseAmount}>Base: {formatSafeCurrency(fee.amount)}</Text>
                              {/* TODO: Show discounted amount if different */}
                            </View>
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
              )}
              {tab === 'payments' && (
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
                            <Text style={styles.statLabel}>Total Fees:</Text>
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

                      </TouchableOpacity>
                    ))
                  )}
                </View>

              </View>
              )}
              {tab === 'recent' && (
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
              )}
            </ScrollView>
          </View>
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
          
          <ScrollView 
            style={styles.modalScrollView}
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
          >
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
              <View>
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
              </View>
            )}
          </ScrollView>
          
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
    maxWidth: 500,
  },
  modalScrollView: {
    maxHeight: '70vh',
    flexGrow: 1,
  },
  modalScrollContent: {
    paddingBottom: 20,
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
    paddingBottom: 80,
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
    paddingBottom: 80,
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
  feeAmountContainer: {
    marginVertical: 4,
  },
  feeBaseAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976d2',
  },
  // Scroll wrapper styles to fix scrolling issues
  scrollWrapper: {
    flex: 1,
    ...Platform.select({
      web: {
        height: 'calc(100vh - 160px)',
        maxHeight: 'calc(100vh - 160px)',
        minHeight: 400,
        overflow: 'hidden',
      },
    }),
  },
  scrollContainer: {
    flex: 1,
    ...Platform.select({
      web: {
        overflowY: 'auto',
      },
    }),
  },
  scrollContent: {
    padding: 16,
    flexGrow: 1,
    ...Platform.select({
      web: {
        paddingBottom: 40,
      },
    }),
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#666',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});

export default FeeManagement;
