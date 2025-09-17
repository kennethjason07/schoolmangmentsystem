/**
 * FeeManagement Performance Optimizations
 * ======================================
 * 
 * This utility provides optimized database queries and calculations
 * for the FeeManagement screen to reduce loading times.
 */

import { supabase, TABLES } from './supabase';
import { validateTenantAccess, createTenantQuery } from './tenantValidation';
import { sortFeeStructuresByClass, sortClassStatsByClass } from './classSortingUtils';

/**
 * Optimized fee management data loader
 * Reduces database calls and improves performance
 */
export class FeeManagementOptimizer {
  constructor(tenantId, user) {
    this.tenantId = tenantId;
    this.user = user;
    this.cache = new Map();
  }

  /**
   * Load all fee management data with minimal database calls
   */
  async loadOptimizedData() {
    const startTime = performance.now();
    console.log('🚀 FeeManagement Optimizer: Starting optimized data load...');

    try {
      // Validate tenant access first
      const validation = await validateTenantAccess(this.user?.id, this.tenantId, 'FeeManagement - loadOptimizedData');
      if (!validation.isValid) {
        throw new Error(`Tenant validation failed: ${validation.error}`);
      }

      // Single query to get all necessary data with joins
      const { data: optimizedData, error } = await supabase
        .from(TABLES.CLASSES)
        .select(`
          id,
          class_name,
          section,
          students(
            id,
            name,
            admission_no
          ),
          fee_structure(
            id,
            fee_component,
            amount,
            due_date,
            academic_year,
            base_amount,
            discount_applied
          )
        `)
        .eq('tenant_id', this.tenantId);

      if (error) throw error;
      
      console.log('📊 Raw optimized data:', {
        totalClasses: optimizedData?.length || 0,
        firstClass: optimizedData?.[0] || null,
        classesWithFeeStructures: optimizedData?.filter(c => c.fee_structure?.length > 0).length || 0
      });
      
      // Check if we got any fee structures
      const totalFeeStructures = optimizedData?.reduce((sum, cls) => sum + (cls.fee_structure?.length || 0), 0) || 0;
      console.log('💰 Total fee structures found:', totalFeeStructures);
      
      if (totalFeeStructures === 0) {
        console.warn('⚠️ No fee structures found in any class! This might indicate a data or query issue.');
        // Try a direct query to check if fee structures exist
        const { data: directFeeCheck } = await supabase
          .from(TABLES.FEE_STRUCTURE)
          .select('id, class_id, fee_component')
          .eq('tenant_id', this.tenantId)
          .limit(5);
        console.log('🔍 Direct fee structure check:', directFeeCheck);
      }

      // Get all student payments in a single query with student names
      const studentIds = optimizedData?.flatMap(cls => cls.students?.map(s => s.id) || []) || [];
      console.log('🎯 Student IDs for payment lookup:', studentIds.length);
      
      let payments = [];
      if (studentIds.length > 0) {
        const { data: paymentsData, error: paymentsError } = await supabase
          .from(TABLES.STUDENT_FEES)
          .select(`
            *,
            students(id, name)
          `)
          .in('student_id', studentIds)
          .eq('tenant_id', this.tenantId);

        if (paymentsError) throw paymentsError;
        payments = paymentsData || [];
      }
      
      console.log('💳 Payments found:', payments.length);

      // Process data efficiently
      const processedData = this.processOptimizedData(optimizedData || [], payments);
      
      const endTime = performance.now();
      console.log(`✅ FeeManagement Optimizer: Data loaded in ${Math.round(endTime - startTime)}ms`);
      
      return processedData;

    } catch (error) {
      const endTime = performance.now();
      console.error(`❌ FeeManagement Optimizer: Error after ${Math.round(endTime - startTime)}ms:`, error);
      throw error;
    }
  }

  /**
   * Process the optimized data into the format expected by the UI
   */
  processOptimizedData(classData, payments) {
    const paymentLookup = new Map();
    payments.forEach(payment => {
      const key = `${payment.student_id}_${payment.fee_component}`;
      paymentLookup.set(key, payment);
    });

    const classStats = classData.map(classInfo => {
      const students = classInfo.students || [];
      const feeStructures = classInfo.fee_structure || [];
      
      let totalExpectedFees = 0;
      let totalPaid = 0;
      let studentsWithPayments = 0;

      students.forEach(student => {
        let studentTotalExpected = 0;
        let studentTotalPaid = 0;

        feeStructures.forEach(fee => {
          studentTotalExpected += parseFloat(fee.amount) || 0;
          
          const paymentKey = `${student.id}_${fee.fee_component}`;
          const payment = paymentLookup.get(paymentKey);
          if (payment) {
            studentTotalPaid += parseFloat(payment.amount_paid) || 0;
          }
        });

        totalExpectedFees += studentTotalExpected;
        totalPaid += studentTotalPaid;
        
        if (studentTotalPaid > 0) {
          studentsWithPayments++;
        }
      });

      const outstanding = Math.max(0, totalExpectedFees - totalPaid);
      const collectionRate = totalExpectedFees > 0 ? (totalPaid / totalExpectedFees) * 100 : 0;

      return {
        classId: classInfo.id,
        className: `${classInfo.class_name}${classInfo.section ? ` - ${classInfo.section}` : ''}`,
        totalStudents: students.length,
        totalExpectedFees,
        totalPaid,
        outstanding,
        collectionRate: Math.round(collectionRate * 100) / 100,
        studentsWithPayments,
        studentsWithoutPayments: students.length - studentsWithPayments,
        feeStructureAmount: totalExpectedFees / Math.max(students.length, 1)
      };
    });

    // Calculate summary
    const summary = classStats.reduce((acc, cls) => ({
      totalCollected: acc.totalCollected + cls.totalPaid,
      totalDue: acc.totalDue + cls.totalExpectedFees,
      totalOutstanding: acc.totalOutstanding + cls.outstanding,
    }), { totalCollected: 0, totalDue: 0, totalOutstanding: 0 });

    summary.collectionRate = summary.totalDue > 0 ?
      Math.round((summary.totalCollected / summary.totalDue) * 10000) / 100 : 0;

    // Process payments to include student names for display
    const processedPayments = payments.map(payment => ({
      ...payment,
      students: { 
        full_name: payment.students?.name,
        name: payment.students?.name
      }
    }));

    // Process fee structures for UI display - group by class
    const groupedFeeStructures = [];
    const classMap = new Map();
    
    // Group fee structures by class
    classData.forEach(classInfo => {
      const fees = (classInfo.fee_structure || []).map(fee => ({
        id: fee.id,
        type: fee.fee_component || 'Unknown Fee',
        fee_component: fee.fee_component,
        amount: fee.amount || 0,
        due_date: fee.due_date,
        created_at: fee.created_at,
        description: fee.fee_component || 'No description',
        academic_year: fee.academic_year || '2024-25'
      }));
      
      if (fees.length > 0) {
        groupedFeeStructures.push({
          classId: classInfo.id,
          name: `${classInfo.class_name}${classInfo.section ? ` - ${classInfo.section}` : ''}`,
          fees: fees
        });
      }
    });

    console.log('🏗️ Processed fee structures for UI:', groupedFeeStructures.length, 'classes with fees');
    console.log('📊 Sample fee structure:', groupedFeeStructures[0] || 'No fee structures found');

    // Sort data for proper display order
    const sortedFeeStructures = sortFeeStructuresByClass(groupedFeeStructures);
    const sortedClassStats = sortClassStatsByClass(classStats);
    
    console.log('📋 Sorted fee structures:', sortedFeeStructures.map(f => f.name));
    console.log('📋 Sorted class stats:', sortedClassStats.map(c => c.className));

    return {
      classStats: sortedClassStats, // Sorted by class order instead of outstanding
      summary,
      classes: classData,
      feeStructures: sortedFeeStructures, // Now properly sorted for UI
      students: classData.flatMap(cls => cls.students || []),
      payments: processedPayments
    };
  }

  /**
   * Get lightweight class overview (for initial load)
   */
  async getClassOverview() {
    try {
      const validation = await validateTenantAccess(this.user?.id, this.tenantId, 'FeeManagement - getClassOverview');
      if (!validation.isValid) {
        throw new Error(`Tenant validation failed: ${validation.error}`);
      }

      const { data, error } = await supabase
        .from(TABLES.CLASSES)
        .select(`
          id,
          class_name,
          section,
          students(count)
        `)
        .eq('tenant_id', this.tenantId);

      if (error) throw error;
      return data || [];

    } catch (error) {
      console.error('Error getting class overview:', error);
      return [];
    }
  }

  /**
   * Clear optimizer cache
   */
  clearCache() {
    this.cache.clear();
  }
}

/**
 * Background data loader that doesn't block UI
 */
export const loadFeeDataInBackground = async (tenantId, user, onProgress) => {
  return new Promise(async (resolve, reject) => {
    try {
      const optimizer = new FeeManagementOptimizer(tenantId, user);
      
      // Step 1: Load basic class info immediately
      onProgress?.({ step: 1, message: 'Loading classes...' });
      const classOverview = await optimizer.getClassOverview();
      onProgress?.({ step: 2, message: 'Loading fee structures...' });
      
      // Step 2: Load detailed data
      const fullData = await optimizer.loadOptimizedData();
      onProgress?.({ step: 3, message: 'Processing calculations...' });
      
      // Step 3: Complete
      onProgress?.({ step: 4, message: 'Complete' });
      resolve(fullData);
      
    } catch (error) {
      reject(error);
    }
  });
};