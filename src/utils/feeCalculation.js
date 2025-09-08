import { supabase, TABLES, getUserTenantId } from './supabase';

/**
 * Helper function to find matching fee component using enhanced fuzzy matching
 * @param {string} paymentComponent - Payment fee component name
 * @param {Array} feeComponents - Available fee component names
 * @returns {string|null} Matching fee component or null
 */
const findMatchingFeeComponent = (paymentComponent, feeComponents) => {
  if (!paymentComponent) return null;
  
  // Exact match first (case-sensitive)
  if (feeComponents.includes(paymentComponent)) {
    return paymentComponent;
  }
  
  // Case-insensitive exact match
  const paymentLower = paymentComponent.toLowerCase();
  for (const feeComp of feeComponents) {
    if (feeComp.toLowerCase() === paymentLower) {
      console.log(`  Case-insensitive match: ${paymentComponent} -> ${feeComp}`);
      return feeComp;
    }
  }
  
  const normalizedPayment = paymentComponent.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
  
  // Enhanced fuzzy matching with better normalization
  for (const feeComp of feeComponents) {
    const normalizedFee = feeComp.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
    
    // Exact normalized match
    if (normalizedPayment === normalizedFee) {
      console.log(`  Normalized exact match: ${paymentComponent} -> ${feeComp}`);
      return feeComp;
    }
    
    // Handle tuition variations (tution/tuition)
    if ((normalizedPayment.includes('tuition') || normalizedPayment.includes('tution')) &&
        (normalizedFee.includes('tuition') || normalizedFee.includes('tution'))) {
      console.log(`  Tuition variation match: ${paymentComponent} -> ${feeComp}`);
      return feeComp;
    }
    
    // Handle transport/bus variations
    if ((normalizedPayment.includes('transport') || normalizedPayment.includes('bus')) &&
        (normalizedFee.includes('transport') || normalizedFee.includes('bus'))) {
      console.log(`  Transport variation match: ${paymentComponent} -> ${feeComp}`);
      return feeComp;
    }
    
    // Handle library/book variations  
    if ((normalizedPayment.includes('library') || normalizedPayment.includes('book')) &&
        (normalizedFee.includes('library') || normalizedFee.includes('book'))) {
      console.log(`  Library variation match: ${paymentComponent} -> ${feeComp}`);
      return feeComp;
    }
    
    // Handle uniform variations
    if (normalizedPayment.includes('uniform') && normalizedFee.includes('uniform')) {
      console.log(`  Uniform variation match: ${paymentComponent} -> ${feeComp}`);
      return feeComp;
    }
    
    // Handle exam/examination variations
    if ((normalizedPayment.includes('exam') || normalizedPayment.includes('examination')) &&
        (normalizedFee.includes('exam') || normalizedFee.includes('examination'))) {
      console.log(`  Exam variation match: ${paymentComponent} -> ${feeComp}`);
      return feeComp;
    }
    
    // Handle activity/activities variations
    if ((normalizedPayment.includes('activity') || normalizedPayment.includes('activities')) &&
        (normalizedFee.includes('activity') || normalizedFee.includes('activities'))) {
      console.log(`  Activity variation match: ${paymentComponent} -> ${feeComp}`);
      return feeComp;
    }
    
    // Substring matches (more lenient)
    if (normalizedPayment.length > 3 && normalizedFee.length > 3) {
      if (normalizedPayment.includes(normalizedFee) || normalizedFee.includes(normalizedPayment)) {
        console.log(`  Substring match: ${paymentComponent} -> ${feeComp}`);
        return feeComp;
      }
    }
  }
  
  console.log(`  No match found for payment component: ${paymentComponent}`);
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
 * @param {string} tenantId - Optional tenant ID (will be fetched if not provided)
 * @returns {Object} Complete fee calculation data
 */
export const calculateStudentFees = async (studentId, classId = null, tenantId = null) => {
  try {
    console.log('=== FEE CALCULATION START ===');
    console.log('Student ID:', studentId);
    console.log('Class ID:', classId);
    console.log('Tenant ID (provided):', tenantId);

    // Use provided tenantId or fetch from context
    let actualTenantId = tenantId;
    if (!actualTenantId) {
      actualTenantId = await getUserTenantId();
      if (!actualTenantId) {
        throw new Error('Tenant context required but not found');
      }
    }
    console.log('Using tenant ID:', actualTenantId);

    // Step 1: Get student info and class ID if needed
    let actualClassId = classId;
    if (!actualClassId) {
      const { data: studentRecord, error: studentError } = await supabase
        .from(TABLES.STUDENTS)
        .select('class_id, academic_year, name')
        .eq('id', studentId)
        .eq('tenant_id', actualTenantId)
        .single();
      
      if (studentError || !studentRecord?.class_id) {
        console.error('Student lookup error:', studentError);
        throw new Error(`Could not determine student class ID: ${studentError?.message || 'Student not found'}`);
      }
      
      actualClassId = studentRecord.class_id;
      console.log('Fetched class ID from student record:', actualClassId, 'for student:', studentRecord.name);
    }

  // Step 2: Get ONLY class-level fee structure (simplified approach)
  console.log('Step 2: Fetching CLASS-LEVEL fee structure...');
  const { data: feeStructureData, error: feeStructureError } = await supabase
    .from(TABLES.FEE_STRUCTURE)
    .select(`
      id,
      fee_component,
      amount,
      due_date,
      academic_year,
      class_id,
      student_id,
      tenant_id
    `)
    .eq('class_id', actualClassId)
    .is('student_id', null) // 🎯 SIMPLIFIED: Only get class-level fees
    .eq('tenant_id', actualTenantId)
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
      .eq('tenant_id', actualTenantId)
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
      .eq('tenant_id', actualTenantId)
      .order('payment_date', { ascending: false });

    if (paymentError) {
      throw new Error(`Failed to fetch payment data: ${paymentError.message}`);
    }

    console.log(`Found ${allPaymentData?.length || 0} total payment records`);

  // Step 5: Process each fee component (simplified approach)
  const processedFees = [];
  const usedPaymentIds = new Set();
  let totalCalculatedPaid = 0;
  let totalCalculatedOutstanding = 0;

  // 🎯 SIMPLIFIED: Group ONLY class-level fees by component + academic year
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
    
    const feeGroup = feeMap.get(key);
    feeGroup.fees.push(fee);
  });

  console.log('Step 5: Processing grouped class fees...');
  console.log('Fee groups:', Array.from(feeMap.keys()));
  
  // Debug: Show class-level fees (all fees should be class-level with student_id = null)
  for (const [key, feeGroup] of feeMap) {
    console.log(`Fee group ${key}: feeCount=${feeGroup.fees.length}`);
    feeGroup.fees.forEach((fee, idx) => {
      console.log(`  🎯 Class Fee ${idx + 1}: ID=${fee.id}, student_id=${fee.student_id || 'null'}, class_id=${fee.class_id}, amount=${fee.amount}`);
    });
  }

  for (const [key, feeGroup] of feeMap) {
    const { component, academicYear, fees } = feeGroup;
    console.log(`\n--- 🎯 Processing CLASS FEE: ${component} (${academicYear}) ---`);
    
    // Calculate total base amount for this component (from class fees only)
    const baseAmount = fees.reduce((sum, fee) => sum + (Number(fee.amount) || 0), 0);
    console.log(`📊 Base class fee amount: ₹${baseAmount}`);

    // 🎯 SIMPLIFIED: Find applicable discounts from student_discounts table
    const applicableDiscounts = (discountData || []).filter(discount => {
      const discountYear = normalizeAcademicYear(discount.academic_year);
      const isComponentMatch = discount.fee_component === component || discount.fee_component === 'ALL';
      const isYearMatch = discountYear === academicYear || !discount.academic_year;
      
      console.log(`🔍 Checking discount: ${discount.fee_component} (${discount.discount_type}: ${discount.discount_value}) - ComponentMatch: ${isComponentMatch}, YearMatch: ${isYearMatch}`);
      
      return isComponentMatch && isYearMatch;
    });

    console.log(`🎁 Found ${applicableDiscounts.length} applicable discounts`);

    // Calculate total discount from student_discounts table
    let totalDiscount = 0;
    applicableDiscounts.forEach(discount => {
      let discountAmount = 0;
      if (discount.discount_type === 'percentage') {
        discountAmount = (baseAmount * Number(discount.discount_value)) / 100;
      } else if (discount.discount_type === 'fixed' || discount.discount_type === 'fixed_amount') {
        discountAmount = Number(discount.discount_value) || 0;
      }
      totalDiscount += discountAmount;
      console.log(`  💰 Applied ${discount.discount_type} discount: ₹${discountAmount} (reason: ${discount.reason || 'No reason'})`);
    });

    const finalAmount = Math.max(0, baseAmount - totalDiscount);
    console.log(`💸 Final amount (₹${baseAmount} - ₹${totalDiscount}): ₹${finalAmount}`);

      // Find matching payments for this specific component with improved matching
      const matchingPayments = (allPaymentData || []).filter(payment => {
        // Skip already used payments
        if (usedPaymentIds.has(payment.id)) return false;
        
        const paymentYear = normalizeAcademicYear(payment.academic_year);
        console.log(`  🔍 Checking payment: component="${payment.fee_component}", year="${payment.academic_year}" -> normalized="${paymentYear}", amount=${payment.amount_paid}`);
        
        // Academic year matching - be more flexible
        const isYearMatch = (
          paymentYear === academicYear ||           // Exact year match
          !payment.academic_year ||                // Payment has no year specified
          !paymentYear ||                          // Normalized year is empty
          paymentYear === '' ||                    // Normalized year is empty string
          paymentYear === academicYear.replace('-', '/') || // Handle different year formats
          academicYear === paymentYear.replace('-', '/')    // Handle different year formats
        );
        
        console.log(`    Year match check: payment="${paymentYear}" vs expected="${academicYear}" = ${isYearMatch}`);
        
        // Try exact component match first
        if (payment.fee_component === component && isYearMatch) {
          console.log(`    ✅ Exact match: ${payment.fee_component} === ${component}`);
          return true;
        }
        
        // Try fuzzy component matching if year matches
        if (isYearMatch) {
          const matchedComponent = findMatchingFeeComponent(payment.fee_component, [component]);
          if (matchedComponent === component) {
            console.log(`    ✅ Fuzzy matched payment: ${payment.fee_component} -> ${component}`);
            return true;
          }
        }
        
        // Fallback: Try fuzzy match regardless of year if payment has no year
        if (!payment.academic_year || payment.academic_year === '') {
          const matchedComponent = findMatchingFeeComponent(payment.fee_component, [component]);
          if (matchedComponent === component) {
            console.log(`    ✅ Year-agnostic fuzzy matched payment: ${payment.fee_component} -> ${component}`);
            return true;
          }
        }
        
        console.log(`    ❌ No match for payment: ${payment.fee_component}`);
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
      isClassFee: true, // 🎯 SIMPLIFIED: All fees are now class-level fees
      isIndividualFee: false, // 🎯 SIMPLIFIED: No individual fee entries, discounts managed separately
      payments: fee.payments,
      discounts: fee.discounts
    }));

    // Add metadata for debugging and validation
    const calculationMetadata = {
      studentId,
      classId: actualClassId,
      tenantId: actualTenantId,
      calculatedAt: new Date().toISOString(),
      feeStructureCount: feeStructureData?.length || 0,
      paymentRecordsCount: allPaymentData?.length || 0,
      processedFeesCount: processedFees.length,
      orphanedPaymentsCount: orphanedPayments.length
    };

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
      allFees: processedFees,
      metadata: calculationMetadata
    };

  } catch (error) {
    console.error('Fee calculation error:', error);
    console.error('Error details:', {
      studentId,
      classId,
      tenantId: actualTenantId,
      error: error.message,
      stack: error.stack
    });
    
    // Return empty calculation instead of null to prevent crashes
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
      allFees: [],
      error: error.message,
      metadata: {
        studentId,
        classId,
        tenantId: actualTenantId || 'unknown',
        calculatedAt: new Date().toISOString(),
        hasError: true,
        errorMessage: error.message
      }
    };
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
