import { supabase, TABLES, getUserTenantId } from './supabase';

/**
 * Helper function to find matching fee component using fuzzy matching
 * @param {string} paymentComponent - Payment fee component name
 * @param {Array} feeComponents - Available fee component names
 * @returns {string|null} Matching fee component or null
 */
const findMatchingFeeComponent = (paymentComponent, feeComponents) => {
  if (!paymentComponent) return null;
  
  // Exact match first
  if (feeComponents.includes(paymentComponent)) {
    return paymentComponent;
  }
  
  const normalizedPayment = paymentComponent.toLowerCase().replace(/\s+/g, '');
  
  // Check for similar names (tuition variations)
  for (const feeComp of feeComponents) {
    const normalizedFee = feeComp.toLowerCase().replace(/\s+/g, '');
    
    // Handle tuition variations
    if ((normalizedPayment.includes('tuition') || normalizedPayment.includes('tution')) &&
        (normalizedFee.includes('tuition') || normalizedFee.includes('tution'))) {
      return feeComp;
    }
    
    // Handle transport/bus variations
    if ((normalizedPayment.includes('transport') || normalizedPayment.includes('bus')) &&
        (normalizedFee.includes('transport') || normalizedFee.includes('bus'))) {
      return feeComp;
    }
    
    // Handle library/book variations  
    if ((normalizedPayment.includes('library') || normalizedPayment.includes('book')) &&
        (normalizedFee.includes('library') || normalizedFee.includes('book'))) {
      return feeComp;
    }
    
    // Other close matches
    if (normalizedPayment.includes(normalizedFee) || normalizedFee.includes(normalizedPayment)) {
      return feeComp;
    }
  }
  
  return null;
};

/**
 * Normalize academic year format for consistent comparison
 * @param {string} year - Academic year string
 * @returns {string} Normalized year in format YYYY-YY
 */
const normalizeAcademicYear = (year) => {
  if (!year) return '';
  
  // Convert formats like "2024-2025" to "2024-25"
  if (year.includes('-')) {
    const parts = year.split('-');
    if (parts.length === 2 && parts[1].length === 4) {
      return `${parts[0]}-${parts[1].slice(-2)}`;
    }
  }
  
  return year;
};

/**
 * Calculate complete fee information for a student
 * @param {string} studentId - The student's ID
 * @param {string} classId - Optional student's class ID (will be fetched if not provided)
 * @returns {Object} Complete fee calculation data
 */
export const calculateStudentFees = async (studentId, classId = null) => {
  try {
    console.log('=== FEE CALCULATION START ===');
    console.log('Student ID:', studentId);
    console.log('Class ID:', classId);

    const tenantId = await getUserTenantId();
    if (!tenantId) {
      throw new Error('Tenant context required but not found');
    }

    // Step 1: Get student info and class ID if needed
    let actualClassId = classId;
    if (!actualClassId) {
      const { data: studentRecord, error: studentError } = await supabase
        .from(TABLES.STUDENTS)
        .select('class_id, academic_year')
        .eq('id', studentId)
        .eq('tenant_id', tenantId)
        .single();
      
      if (studentError || !studentRecord?.class_id) {
        throw new Error('Could not determine student class ID');
      }
      
      actualClassId = studentRecord.class_id;
      console.log('Fetched class ID from student record:', actualClassId);
    }

    // Step 2: Get fee structure for student's class
    console.log('Step 2: Fetching fee structure...');
    const { data: feeStructureData, error: feeStructureError } = await supabase
      .from(TABLES.FEE_STRUCTURE)
      .select(`
        id,
        fee_component,
        amount,
        due_date,
        academic_year,
        class_id,
        student_id
      `)
      .or(`class_id.eq.${actualClassId},student_id.eq.${studentId}`)
      .eq('tenant_id', tenantId)
      .order('due_date', { ascending: true });

    if (feeStructureError) {
      throw new Error(`Failed to fetch fee structure: ${feeStructureError.message}`);
    }

    console.log(`Found ${feeStructureData?.length || 0} fee structure records`);
    if (!feeStructureData || feeStructureData.length === 0) {
      console.log('No fee structure found for this student/class');
      return {
        totalAmount: 0,
        totalPaid: 0,
        totalOutstanding: 0,
        totalBaseFee: 0,
        totalDiscounts: 0,
        academicYear: '2024-25',
        details: [],
        orphanedPayments: [],
        totalDue: 0,
        pendingFees: [],
        paidFees: [],
        allFees: []
      };
    }

    // Step 3: Get student discounts
    console.log('Step 3: Fetching student discounts...');
    const { data: discountData, error: discountError } = await supabase
      .from(TABLES.STUDENT_DISCOUNTS)
      .select('*')
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    if (discountError && discountError.code !== '42P01') {
      console.warn('Discount fetch error:', discountError);
    }

    console.log(`Found ${discountData?.length || 0} active discounts`);

    // Step 4: Get ALL student payments (we'll filter by fee component and year later)
    console.log('Step 4: Fetching ALL student payments...');
    const { data: allPaymentData, error: paymentError } = await supabase
      .from(TABLES.STUDENT_FEES)
      .select(`
        id,
        student_id,
        fee_component,
        amount_paid,
        payment_date,
        payment_mode,
        academic_year,
        remarks,
        receipt_number
      `)
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .order('payment_date', { ascending: false });

    if (paymentError) {
      throw new Error(`Failed to fetch payment data: ${paymentError.message}`);
    }

    console.log(`Found ${allPaymentData?.length || 0} total payment records`);

    // Step 5: Process each fee component
    const processedFees = [];
    const usedPaymentIds = new Set();
    let totalCalculatedPaid = 0;
    let totalCalculatedOutstanding = 0;

    // Group fee structure by component + academic year
    const feeMap = new Map();
    (feeStructureData || []).forEach(fee => {
      const key = `${fee.fee_component}_${normalizeAcademicYear(fee.academic_year)}`;
      if (!feeMap.has(key)) {
        feeMap.set(key, {
          component: fee.fee_component,
          academicYear: normalizeAcademicYear(fee.academic_year),
          fees: []
        });
      }
      feeMap.get(key).fees.push(fee);
    });

    console.log('Step 5: Processing grouped fees...');
    console.log('Fee groups:', Array.from(feeMap.keys()));

    for (const [key, feeGroup] of feeMap) {
      const { component, academicYear, fees } = feeGroup;
      console.log(`\n--- Processing: ${component} (${academicYear}) ---`);
      
      // Calculate total base amount for this component
      const baseAmount = fees.reduce((sum, fee) => sum + (Number(fee.amount) || 0), 0);
      console.log(`Base amount: ₹${baseAmount}`);

      // Find applicable discounts
      const applicableDiscounts = (discountData || []).filter(discount => {
        const discountYear = normalizeAcademicYear(discount.academic_year);
        return (discount.fee_component === component || discount.fee_component === 'ALL') &&
               (discountYear === academicYear || !discount.academic_year);
      });

      // Calculate discount
      let totalDiscount = 0;
      applicableDiscounts.forEach(discount => {
        if (discount.discount_type === 'percentage') {
          totalDiscount += (baseAmount * Number(discount.discount_value)) / 100;
        } else if (discount.discount_type === 'fixed' || discount.discount_type === 'fixed_amount') {
          totalDiscount += Number(discount.discount_value) || 0;
        }
      });

      const finalAmount = Math.max(0, baseAmount - totalDiscount);
      console.log(`After ₹${totalDiscount} discount: ₹${finalAmount}`);

      // Find matching payments for this specific component and academic year
      const matchingPayments = (allPaymentData || []).filter(payment => {
        // Skip already used payments
        if (usedPaymentIds.has(payment.id)) return false;
        
        const paymentYear = normalizeAcademicYear(payment.academic_year);
        const isYearMatch = paymentYear === academicYear;
        
        // Try exact match first
        if (payment.fee_component === component && isYearMatch) {
          return true;
        }
        
        // Try fuzzy match for same academic year
        if (isYearMatch) {
          const matchedComponent = findMatchingFeeComponent(payment.fee_component, [component]);
          return matchedComponent === component;
        }
        
        return false;
      });

      // Mark payments as used
      matchingPayments.forEach(payment => {
        usedPaymentIds.add(payment.id);
      });

      const totalPaid = matchingPayments.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0);
      console.log(`Matched ${matchingPayments.length} payments totaling: ₹${totalPaid}`);
      
      // Calculate remaining amount for this fee
      const remainingAmount = Math.max(0, finalAmount - totalPaid);
      
      // Determine status
      let status = 'unpaid';
      if (totalPaid >= finalAmount && finalAmount > 0) {
        status = 'paid';
      } else if (totalPaid > 0) {
        status = 'partial';
      }

      // Add to totals (only count what's actually due and paid)
      totalCalculatedPaid += Math.min(totalPaid, finalAmount); // Don't count overpayments
      totalCalculatedOutstanding += remainingAmount;

      processedFees.push({
        id: fees[0].id,
        name: component,
        baseFeeAmount: baseAmount,
        discountAmount: totalDiscount,
        finalAmount: finalAmount,
        paidAmount: Math.min(totalPaid, finalAmount), // Cap at final amount for display
        actualPaidAmount: totalPaid, // Keep track of actual amount paid (including overpayments)
        remainingAmount: remainingAmount,
        status: status,
        dueDate: fees[0].due_date,
        academicYear: academicYear,
        payments: matchingPayments.map(p => ({
          id: p.id,
          amount: Number(p.amount_paid),
          paymentDate: p.payment_date,
          paymentMode: p.payment_mode,
          remarks: p.remarks,
          receiptNumber: p.receipt_number
        })),
        discounts: applicableDiscounts
      });

      console.log(`Final: Base ₹${baseAmount} - Discount ₹${totalDiscount} = ₹${finalAmount} | Paid ₹${totalPaid} | Remaining ₹${remainingAmount}`);
    }

    // Calculate final totals
    const totalBaseFee = processedFees.reduce((sum, fee) => sum + fee.baseFeeAmount, 0);
    const totalDiscounts = processedFees.reduce((sum, fee) => sum + fee.discountAmount, 0);
    const totalAmount = processedFees.reduce((sum, fee) => sum + fee.finalAmount, 0);
    
    // Find orphaned payments (not matched to any fee)
    const orphanedPayments = (allPaymentData || []).filter(payment => 
      !usedPaymentIds.has(payment.id)
    );

    console.log('\n=== FINAL CALCULATION SUMMARY ===');
    console.log('Total fees due:', totalAmount);
    console.log('Total paid (capped):', totalCalculatedPaid);
    console.log('Total outstanding:', totalCalculatedOutstanding);
    console.log('Orphaned payments:', orphanedPayments.length);
    console.log('=== END ===\n');

    // Transform for component compatibility
    const details = processedFees.map(fee => ({
      id: fee.id,
      feeComponent: fee.name,
      baseFeeAmount: fee.baseFeeAmount,
      discountAmount: fee.discountAmount,
      finalAmount: fee.finalAmount,
      paidAmount: fee.paidAmount,
      outstandingAmount: fee.remainingAmount,
      dueDate: fee.dueDate,
      academicYear: fee.academicYear,
      isClassFee: fee.class_id ? true : false,
      isIndividualFee: fee.student_id ? true : false,
      payments: fee.payments,
      discounts: fee.discounts
    }));

    return {
      totalAmount,
      totalPaid: totalCalculatedPaid,
      totalOutstanding: totalCalculatedOutstanding,
      totalBaseFee,
      totalDiscounts,
      academicYear: processedFees[0]?.academicYear || '2024-25',
      details,
      orphanedPayments,
      totalDue: totalAmount,
      pendingFees: processedFees.filter(fee => fee.status !== 'paid'),
      paidFees: processedFees.filter(fee => fee.status === 'paid'),
      allFees: processedFees
    };

  } catch (error) {
    console.error('Fee calculation error:', error);
    return null;
  }
};

/**
 * Get fee status text for dashboard display
 * @param {Object} feeSummary - Fee summary from calculateStudentFees
 * @returns {string} Fee status text
 */
export const getFeeStatusText = (feeSummary) => {
  if (!feeSummary || feeSummary.totalDue === 0) {
    return 'No fees';
  }
  
  if (feeSummary.totalOutstanding <= 0) {
    return 'All paid';
  }
  
  return `₹${feeSummary.totalOutstanding.toLocaleString()}`;
};

/**
 * Get fee status color for UI display
 * @param {Object} feeSummary - Fee summary from calculateStudentFees
 * @returns {string} Color hex code
 */
export const getFeeStatusColor = (feeSummary) => {
  if (!feeSummary || feeSummary.totalDue === 0) {
    return '#666'; // Grey for no fees
  }
  
  if (feeSummary.totalOutstanding <= 0) {
    return '#4CAF50'; // Green for all paid
  }
  
  if (feeSummary.totalOutstanding > 0) {
    return '#FF9800'; // Orange for pending
  }
  
  return '#666'; // Default grey
};
