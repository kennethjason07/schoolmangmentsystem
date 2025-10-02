import { supabase, TABLES } from './supabase';
import { getUserTenantId } from './tenantValidation';

// Optional logging suppression for bulk operations (e.g., exports)
let FEE_CALC_SUPPRESS_LOGS = false;
export const setFeeCalcLogSuppressed = (v) => { FEE_CALC_SUPPRESS_LOGS = !!v; };
const logError = (...args) => { if (!FEE_CALC_SUPPRESS_LOGS) console.error(...args); };

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
  // Hoist variables so they are available in catch as well
  let actualTenantId = tenantId;
  let actualClassId = classId;
  let studentRecord = null;
  
  try {
    console.log('=== Fee Calculation Start ===');
    console.log('Student ID:', studentId);
    console.log('Class ID:', classId);
    console.log('Tenant ID (provided):', tenantId);

    // Use provided tenantId or fetch from context
    if (!actualTenantId) {
      actualTenantId = await getUserTenantId();
      if (!actualTenantId) {
        throw new Error('Tenant context required but not found');
      }
    }
    console.log('✅ Using tenant ID:', actualTenantId);

    // Step 1: Get student info and class ID if needed
    if (!actualClassId) {
      const { data: studentData, error: studentError } = await supabase
        .from(TABLES.STUDENTS)
        .select('class_id, academic_year, name')
        .eq('id', studentId)
        .eq('tenant_id', actualTenantId)
        .single();
      
      if (studentError || !studentData?.class_id) {
logError('❌ Student lookup error:', studentError);
        throw new Error(`Could not determine student class ID: ${studentError?.message || 'Student not found'}`);
      }
      
      actualClassId = studentData.class_id;
      studentRecord = studentData;
      console.log('✅ Fetched class ID from student record:', actualClassId, 'for student:', studentData.name);
    } else {
      // Still get student record for academic year info
      const { data: studentData, error: studentError } = await supabase
        .from(TABLES.STUDENTS)
        .select('class_id, academic_year, name')
        .eq('id', studentId)
        .eq('tenant_id', actualTenantId)
        .single();
      
      if (!studentError && studentData) {
        studentRecord = studentData;
      }
    }

  // Step 2: Get ONLY class-level fee structure (simplified approach)
  console.log('📊 Step 2: Fetching CLASS-LEVEL fee structure...');
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
      tenant_id,
      base_amount,
      discount_applied
    `)
    .eq('class_id', actualClassId)
    .is('student_id', null) // Only get class-level fees
    .eq('tenant_id', actualTenantId)
    .order('due_date', { ascending: true });

    if (feeStructureError) {
logError('❌ Fee structure error:', feeStructureError);
      throw new Error(`Failed to fetch fee structure: ${feeStructureError.message}`);
    }

    console.log(`✅ Found ${feeStructureData?.length || 0} fee structure records`);
    if (!feeStructureData || feeStructureData.length === 0) {
      console.log('⚠️ No fee structure found for this student/class');
      return {
        totalAmount: 0,
        totalPaid: 0,
        totalOutstanding: 0,
        totalBaseFee: 0,
        totalDiscounts: 0,
        academicYear: studentRecord?.academic_year || '2024-25',
        details: [],
        orphanedPayments: [],
        totalDue: 0,
        pendingFees: [],
        paidFees: [],
        allFees: [],
        metadata: {
          studentId,
          classId: actualClassId,
          tenantId: actualTenantId,
          calculatedAt: new Date().toISOString(),
          hasError: false,
          errorMessage: 'No fee structure found'
        }
      };
    }

    // Step 3: Get student discounts
    console.log('🎁 Step 3: Fetching student discounts...');
    const { data: discountData, error: discountError } = await supabase
      .from(TABLES.STUDENT_DISCOUNTS)
      .select('*')
      .eq('student_id', studentId)
      .eq('tenant_id', actualTenantId)
      .eq('is_active', true);

    if (discountError && discountError.code !== '42P01') {
      console.warn('⚠️ Discount fetch error:', discountError);
    }

    console.log(`✅ Found ${discountData?.length || 0} active discounts`);

    // Step 4: Get ALL student payments with ENHANCED LOGGING
    console.log('💰 Step 4: Fetching ALL student payments...');
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
        receipt_number,
        total_amount,
        remaining_amount,
        status
      `)
      .eq('student_id', studentId)
      .eq('tenant_id', actualTenantId)
      .order('payment_date', { ascending: false });

    if (paymentError) {
logError('❌ Payment fetch error:', paymentError);
      throw new Error(`Failed to fetch payment data: ${paymentError.message}`);
    }

    console.log(`✅ Found ${allPaymentData?.length || 0} total payment records`);
    
    // 🔍 ENHANCED: Log payment details for debugging
    if (allPaymentData && allPaymentData.length > 0) {
      console.log('📊 Payment Analysis:');
      allPaymentData.forEach((payment, index) => {
        console.log(`  Payment ${index + 1}: ${payment.fee_component} - ₹${payment.amount_paid} (Year: ${payment.academic_year || 'N/A'})`);
      });
      
      const totalPaidRaw = allPaymentData.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0);
      console.log(`  📊 Total Paid (Raw): ₹${totalPaidRaw}`);
    }

  // Step 5: Process each fee component with ENHANCED MATCHING
  const processedFees = [];
  const usedPaymentIds = new Set();
  let totalCalculatedPaid = 0;
  let totalCalculatedOutstanding = 0;

  // 🎯 ENHANCED: Group class-level fees by component + academic year with better normalization
  const feeMap = new Map();
  (feeStructureData || []).forEach(fee => {
    const normalizedYear = normalizeAcademicYear(fee.academic_year);
    const key = `${fee.fee_component}_${normalizedYear}`;
    if (!feeMap.has(key)) {
      feeMap.set(key, {
        component: fee.fee_component,
        academicYear: normalizedYear,
        fees: []
      });
    }
    
    const feeGroup = feeMap.get(key);
    feeGroup.fees.push(fee);
  });

  console.log('📊 Step 5: Processing grouped class fees...');
  console.log('Fee groups:', Array.from(feeMap.keys()));
  
  // 🔍 Debug: Show class-level fees (all fees should be class-level with student_id = null)
  for (const [key, feeGroup] of feeMap) {
    console.log(`📊 Fee group ${key}: feeCount=${feeGroup.fees.length}`);
    feeGroup.fees.forEach((fee, idx) => {
      console.log(`  🎯 Class Fee ${idx + 1}: ID=${fee.id}, student_id=${fee.student_id || 'null'}, class_id=${fee.class_id}, amount=${fee.amount}, base_amount=${fee.base_amount || fee.amount}, discount=${fee.discount_applied || 0}`);
    });
  }

  for (const [key, feeGroup] of feeMap) {
    const { component, academicYear, fees } = feeGroup;
    console.log(`\n--- 🎯 Processing CLASS FEE: ${component} (${academicYear}) ---`);
    
    // 🔥 ENHANCED: Calculate total base amount for this component with proper discount handling
    let baseAmount = 0;
    let structureDiscount = 0;
    
    fees.forEach(fee => {
      const feeBaseAmount = Number(fee.base_amount) || Number(fee.amount) || 0;
      const feeStructureDiscount = Number(fee.discount_applied) || 0;
      
      baseAmount += feeBaseAmount;
      structureDiscount += feeStructureDiscount;
      
      console.log(`  📊 Fee Detail: base=₹${feeBaseAmount}, structure_discount=₹${feeStructureDiscount}`);
    });
    
    console.log(`📊 Total Base Amount: ₹${baseAmount}`);
    console.log(`📊 Total Structure Discounts: ₹${structureDiscount}`);

    // 🎯 ENHANCED: Find applicable discounts from student_discounts table with improved matching
    const applicableDiscounts = (discountData || []).filter(discount => {
      const discountYear = normalizeAcademicYear(discount.academic_year);
      const isComponentMatch = discount.fee_component === component || 
                               discount.fee_component === 'ALL' ||
                               discount.fee_component === null ||
                               discount.fee_component === '';
      const isYearMatch = discountYear === academicYear || 
                         !discount.academic_year ||
                         discount.academic_year === '' ||
                         discountYear === '';
      
      console.log(`🔍 Checking discount: ${discount.fee_component || 'ALL'} (${discount.discount_type}: ${discount.discount_value}) - ComponentMatch: ${isComponentMatch}, YearMatch: ${isYearMatch}`);
      
      return isComponentMatch && isYearMatch;
    });

    console.log(`🎁 Found ${applicableDiscounts.length} applicable student discounts`);

    // Calculate total discount from student_discounts table
    let individualDiscount = 0;
    applicableDiscounts.forEach(discount => {
      let discountAmount = 0;
      if (discount.discount_type === 'percentage') {
        discountAmount = (baseAmount * Number(discount.discount_value)) / 100;
      } else if (discount.discount_type === 'fixed' || discount.discount_type === 'fixed_amount') {
        discountAmount = Number(discount.discount_value) || 0;
      }
      // Ensure discount doesn't exceed base amount
      discountAmount = Math.min(discountAmount, baseAmount);
      individualDiscount += discountAmount;
      console.log(`  💰 Applied ${discount.discount_type} discount: ₹${discountAmount} (reason: ${discount.reason || discount.description || 'No reason'})`);
    });

    // 🔥 ENHANCED: Calculate final amount with all discounts
    const totalDiscounts = structureDiscount + individualDiscount;
    // Ensure final amount doesn't go below zero
    const finalAmount = Math.max(0, baseAmount - totalDiscounts);
    console.log(`💸 Final amount calculation: Base(₹${baseAmount}) - StructureDisc(₹${structureDiscount}) - IndividualDisc(₹${individualDiscount}) = ₹${finalAmount}`);


      // 🔥 ENHANCED: Find matching payments with SUPER FLEXIBLE matching
      const matchingPayments = (allPaymentData || []).filter(payment => {
        // Skip already used payments
        if (usedPaymentIds.has(payment.id)) return false;
        
        const paymentYear = normalizeAcademicYear(payment.academic_year);
        console.log(`  🔍 Checking payment: component="${payment.fee_component}", year="${payment.academic_year}" -> normalized="${paymentYear}", amount=${payment.amount_paid}`);
        
        // 🔥 ENHANCED: Super flexible academic year matching
        const isYearMatch = (
          paymentYear === academicYear ||           // Exact year match
          !payment.academic_year ||                // Payment has no year specified
          !paymentYear ||                          // Normalized year is empty
          paymentYear === '' ||                    // Normalized year is empty string
          paymentYear === academicYear.replace('-', '/') || // Handle different year formats
          academicYear === paymentYear.replace('-', '/') ||    // Handle different year formats
          paymentYear.includes(academicYear.split('-')[0]) || // Match on start year
          academicYear.includes(paymentYear.split('-')[0])    // Match on start year
        );
        
        console.log(`    📌 Year match check: payment="${paymentYear}" vs expected="${academicYear}" = ${isYearMatch}`);
        
        // 🔥 ENHANCED: Super flexible component matching
        let isComponentMatch = false;
        
        // Try exact component match first
        if (payment.fee_component === component) {
          console.log(`    ✅ Exact match: ${payment.fee_component} === ${component}`);
          isComponentMatch = true;
        }
        // Try case-insensitive exact match
        else if (payment.fee_component && payment.fee_component.toLowerCase() === component.toLowerCase()) {
          console.log(`    ✅ Case-insensitive match: ${payment.fee_component} === ${component}`);
          isComponentMatch = true;
        }
        // Try fuzzy component matching
        else {
          const matchedComponent = findMatchingFeeComponent(payment.fee_component, [component]);
          if (matchedComponent === component) {
            console.log(`    ✅ Fuzzy matched payment: ${payment.fee_component} -> ${component}`);
            isComponentMatch = true;
          }
        }
        
        const finalMatch = isComponentMatch && isYearMatch;
        console.log(`    🎯 Final match decision: ${finalMatch} (component: ${isComponentMatch}, year: ${isYearMatch})`);
        
        return finalMatch;
      });

      // Mark payments as used
      matchingPayments.forEach(payment => {
        usedPaymentIds.add(payment.id);
      });

      const totalPaid = matchingPayments.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0);
      console.log(`💰 Matched ${matchingPayments.length} payments totaling: ₹${totalPaid}`);
      
      if (matchingPayments.length > 0) {
        console.log('  Matched payment details:');
        matchingPayments.forEach((p, idx) => {
          console.log(`    ${idx + 1}. ₹${p.amount_paid} on ${p.payment_date} (${p.fee_component})`);
        });
      }
      
      // 🔥 ENHANCED: Calculate remaining amount for this fee
      // Ensure remaining amount doesn't go below zero
      const remainingAmount = Math.max(0, finalAmount - totalPaid);
      
      // 🔥 ENHANCED: Determine status with better logic
      let status = 'pending';
      if (baseAmount === 0) {
        status = 'no_fee';
      } else if (totalPaid >= finalAmount) {
        status = 'paid';
      } else if (totalPaid > 0) {
        status = 'partial';
      }

      // Add to totals (only count what's actually due and paid)
      totalCalculatedPaid += Math.min(totalPaid, finalAmount); // Don't count overpayments
      totalCalculatedOutstanding += remainingAmount;

      // 🔥 ENHANCED: Store processed fee with comprehensive data
      processedFees.push({
        id: fees[0].id,
        name: component,
        baseFeeAmount: baseAmount,
        structureDiscountAmount: structureDiscount,
        individualDiscountAmount: individualDiscount,
        totalDiscountAmount: totalDiscounts,
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
          receiptNumber: p.receipt_number,
          totalAmount: p.total_amount,
          remainingAmountInRecord: p.remaining_amount,
          statusInRecord: p.status
        })),
        discounts: applicableDiscounts
      });

      console.log(`💯 Final Result: Base ₹${baseAmount} - StructureDisc ₹${structureDiscount} - IndividualDisc ₹${individualDiscount} = ₹${finalAmount} | Paid ₹${totalPaid} | Remaining ₹${remainingAmount} | Status: ${status}`);
    }

    // Calculate final totals
    const totalBaseFee = processedFees.reduce((sum, fee) => sum + fee.baseFeeAmount, 0);
    const totalStructureDiscounts = processedFees.reduce((sum, fee) => sum + fee.structureDiscountAmount, 0);
    const totalIndividualDiscounts = processedFees.reduce((sum, fee) => sum + fee.individualDiscountAmount, 0);
    const totalDiscounts = totalStructureDiscounts + totalIndividualDiscounts;
    const totalAmount = processedFees.reduce((sum, fee) => sum + fee.finalAmount, 0);
    
    // Find orphaned payments (not matched to any fee)
    const orphanedPayments = (allPaymentData || []).filter(payment => 
      !usedPaymentIds.has(payment.id)
    );

    console.log('\n=== 🔥 ENHANCED FINAL CALCULATION SUMMARY ===');
    console.log('Total base fees:', totalBaseFee);
    console.log('Total structure discounts:', totalStructureDiscounts);
    console.log('Total individual discounts:', totalIndividualDiscounts);
    console.log('Total discounts combined:', totalDiscounts);
    console.log('Total fees due (after discounts):', totalAmount);
    console.log('Total paid (capped):', totalCalculatedPaid);
    console.log('Total outstanding:', totalCalculatedOutstanding);
    console.log('Orphaned payments:', orphanedPayments.length);
    
    if (orphanedPayments.length > 0) {
      console.log('⚠️ Orphaned payments details:');
      orphanedPayments.forEach((payment, idx) => {
        console.log(`  ${idx + 1}. ${payment.fee_component}: ₹${payment.amount_paid} (${payment.academic_year || 'No year'})`);
      });
    }
    console.log('=== 🏁 END CALCULATION ===\n');

    // Transform for component compatibility
    const details = processedFees.map(fee => ({
      id: fee.id,
      feeComponent: fee.name,
      baseFeeAmount: fee.baseFeeAmount,
      structureDiscountAmount: fee.structureDiscountAmount,
      individualDiscountAmount: fee.individualDiscountAmount,
      totalDiscountAmount: fee.totalDiscountAmount,
      finalAmount: fee.finalAmount,
      paidAmount: fee.paidAmount,
      outstandingAmount: fee.remainingAmount,
      dueDate: fee.dueDate,
      academicYear: fee.academicYear,
      isClassFee: true, // 🎯 All fees are now class-level fees
      isIndividualFee: false, // 🎯 No individual fee entries, discounts managed separately
      payments: fee.payments,
      discounts: fee.discounts,
      status: fee.status
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
      orphanedPaymentsCount: orphanedPayments.length,
      studentRecord: studentRecord
    };

    return {
      totalAmount,
      totalPaid: totalCalculatedPaid,
      totalOutstanding: totalCalculatedOutstanding,
      totalBaseFee,
      totalDiscounts,
      academicYear: processedFees[0]?.academicYear || studentRecord?.academic_year || '2024-25',
      details,
      orphanedPayments,
      totalDue: totalAmount,
      pendingFees: processedFees.filter(fee => fee.status !== 'paid'),
      paidFees: processedFees.filter(fee => fee.status === 'paid'),
      allFees: processedFees,
      metadata: calculationMetadata
    };

  } catch (error) {
logError('❌ ENHANCED Fee calculation error:', error);
logError('🔍 Error details:', {
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
      academicYear: studentRecord?.academic_year || '2024-25',
      details: [],
      orphanedPayments: [],
      totalDue: 0,
      pendingFees: [],
      paidFees: [],
      allFees: [],
      error: error.message,
      metadata: {
        studentId,
        classId: actualClassId || classId,
        tenantId: actualTenantId || tenantId || 'unknown',
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
  console.log('📊 getFeeStatusText called with:', {
    hasSummary: !!feeSummary,
    totalDue: feeSummary?.totalDue,
    totalOutstanding: feeSummary?.totalOutstanding,
    totalPaid: feeSummary?.totalPaid,
    error: feeSummary?.error
  });
  
  if (!feeSummary) {
    console.log('⚠️ No fee summary provided');
    return 'No data';
  }
  
  if (feeSummary.error) {
    console.log('❌ Fee summary has error:', feeSummary.error);
    return 'Error loading fees';
  }
  
  if (feeSummary.totalDue === 0 || !feeSummary.totalDue) {
    console.log('ℹ️ No fees due');
    return 'No fees';
  }
  
  if (feeSummary.totalOutstanding <= 0) {
    console.log('✅ All fees paid');
    return 'All paid';
  }
  
  const statusText = `₹${feeSummary.totalOutstanding.toLocaleString()}`;
  console.log('💰 Outstanding amount:', statusText);
  return statusText;
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
