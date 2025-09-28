import { supabase, TABLES } from './supabase';
import { getUserTenantId } from './tenantValidation';

/**
 * 🎯 SMART CONCESSION DISTRIBUTION ALGORITHM
 * 
 * This algorithm intelligently distributes a concession amount across fee components
 * starting with the highest fee amount first, as per the requirement:
 * 
 * Example: 
 * - Fee Structure: Term 1 (₹3000), Term 2 (₹7000)
 * - Concession ₹2000 → Applied to Term 2 (₹2000 concession)
 * - Concession ₹8000 → Applied to Term 2 (₹7000) + Term 1 (₹1000)
 * 
 * Creates separate concession records for each affected component.
 */

/**
 * Get fee structure for a student's class sorted by amount (highest first)
 * @param {string} studentId - Student ID
 * @param {string} classId - Class ID
 * @param {string} academicYear - Academic Year
 * @returns {Object} Fee structure data sorted by amount
 */
export const getStudentFeeStructureSorted = async (studentId, classId, academicYear = '2024-25') => {
  try {
    console.log('🔍 Getting fee structure for smart concession distribution...', {
      studentId,
      classId,
      academicYear
    });

    const tenantId = await getUserTenantId();
    if (!tenantId) {
      throw new Error('Tenant context required');
    }

    // Get class-level fee structure (student_id should be null for class fees)
    const { data: feeStructure, error } = await supabase
      .from(TABLES.FEE_STRUCTURE)
      .select(`
        id,
        fee_component,
        amount,
        base_amount,
        due_date,
        academic_year
      `)
      .eq('class_id', classId)
      .is('student_id', null) // Only class-level fees
      .eq('tenant_id', tenantId)
      .eq('academic_year', academicYear)
      .order('amount', { ascending: false }); // Highest amount first

    if (error) {
      console.error('❌ Error fetching fee structure:', error);
      throw error;
    }

    console.log(`✅ Found ${feeStructure?.length || 0} fee components`);
    
    // Log fee structure for debugging
    if (feeStructure && feeStructure.length > 0) {
      console.log('📊 Fee Structure (sorted by amount):');
      feeStructure.forEach((fee, index) => {
        console.log(`  ${index + 1}. ${fee.fee_component}: ₹${fee.amount}`);
      });
    }

    return {
      success: true,
      data: feeStructure || [],
      error: null
    };

  } catch (error) {
    console.error('❌ Error in getStudentFeeStructureSorted:', error);
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
};

/**
 * Calculate smart concession distribution across fee components
 * @param {Array} feeStructure - Fee structure sorted by amount (highest first)
 * @param {number} totalConcessionAmount - Total concession amount to distribute
 * @returns {Object} Distribution plan showing how concession will be applied
 */
export const calculateConcessionDistribution = (feeStructure, totalConcessionAmount) => {
  console.log('🎯 Calculating smart concession distribution...', {
    totalComponents: feeStructure.length,
    totalConcessionAmount
  });

  const distribution = [];
  let remainingConcession = totalConcessionAmount;

  // Sort by amount to ensure we start with highest fees
  const sortedFees = [...feeStructure].sort((a, b) => b.amount - a.amount);

  for (const fee of sortedFees) {
    if (remainingConcession <= 0) break;

    const feeAmount = Number(fee.amount) || 0;
    const concessionForThisFee = Math.min(remainingConcession, feeAmount);

    if (concessionForThisFee > 0) {
      distribution.push({
        id: fee.id,
        feeComponent: fee.fee_component,
        originalAmount: feeAmount,
        concessionAmount: concessionForThisFee,
        finalAmount: feeAmount - concessionForThisFee,
        dueDate: fee.due_date,
        academicYear: fee.academic_year
      });

      remainingConcession -= concessionForThisFee;
      
      console.log(`💰 ${fee.fee_component}: ₹${feeAmount} → Concession: ₹${concessionForThisFee} → Final: ₹${feeAmount - concessionForThisFee}`);
    }
  }

  const totalDistributed = totalConcessionAmount - remainingConcession;
  const summary = {
    totalConcessionRequested: totalConcessionAmount,
    totalConcessionApplied: totalDistributed,
    remainingConcession: remainingConcession,
    componentsAffected: distribution.length,
    distribution
  };

  console.log('📊 Distribution Summary:', {
    requested: totalConcessionAmount,
    applied: totalDistributed,
    remaining: remainingConcession,
    components: distribution.length
  });

  return summary;
};

/**
 * Calculate equal-split concession across all available fee components
 * Example: 5000 with 2 components (Tuition, Bus) → 2500 each (capped to component amount)
 */
export const calculateEqualSplitDistribution = (feeStructure, totalConcessionAmount) => {
  console.log('🔄 Calculating equal-split concession distribution...', {
    totalComponents: feeStructure.length,
    totalConcessionAmount
  });

  const components = [...feeStructure];
  const distribution = [];
  if (components.length === 0 || totalConcessionAmount <= 0) {
    return {
      totalConcessionRequested: totalConcessionAmount,
      totalConcessionApplied: 0,
      remainingConcession: totalConcessionAmount,
      componentsAffected: 0,
      distribution: []
    };
  }

  const perComponent = Math.floor((Number(totalConcessionAmount) || 0) / components.length);
  let remainder = (Number(totalConcessionAmount) || 0) - perComponent * components.length;

  let totalApplied = 0;
  components.forEach((fee, idx) => {
    const feeAmount = Number(fee.amount) || 0;
    // Distribute remainder to first few components to match the exact requested amount
    const share = perComponent + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;

    const applyAmount = Math.min(share, feeAmount);
    if (applyAmount > 0) {
      distribution.push({
        id: fee.id,
        feeComponent: fee.fee_component,
        originalAmount: feeAmount,
        concessionAmount: applyAmount,
        finalAmount: Math.max(0, feeAmount - applyAmount),
        dueDate: fee.due_date,
        academicYear: fee.academic_year
      });
      totalApplied += applyAmount;
      console.log(`⚖️ ${fee.fee_component}: base ₹${feeAmount} → apply ₹${applyAmount} (equal split)`);
    }
  });

  return {
    totalConcessionRequested: totalConcessionAmount,
    totalConcessionApplied: totalApplied,
    remainingConcession: Math.max(0, (Number(totalConcessionAmount) || 0) - totalApplied),
    componentsAffected: distribution.length,
    distribution
  };
};

/**
 * Create multiple student discount records based on distribution plan
 * ⚠️ ENFORCES PER-STUDENT ONLY: No class-wide discounts allowed
 * @param {string} studentId - Student ID (REQUIRED - no null allowed)
 * @param {string} classId - Class ID
 * @param {Object} distributionPlan - Result from calculateConcessionDistribution
 * @param {Object} additionalData - Additional data for discount records
 * @returns {Object} Result of creating multiple discount records
 */
export const createMultipleConcessionRecords = async (
  studentId, 
  classId, 
  distributionPlan, 
  additionalData = {}
) => {
  try {
    // 🚨 CRITICAL GUARDRAIL: Per-student only enforcement
    if (!studentId || studentId === null || studentId === undefined) {
      throw new Error('❌ BLOCKED: student_id is required. Class-wide discounts are not allowed.');
    }

    console.log('💾 Creating multiple concession records (PER-STUDENT ONLY)...', {
      studentId,
      classId,
      recordsToCreate: distributionPlan.distribution.length
    });

    const tenantId = await getUserTenantId();
    if (!tenantId) {
      throw new Error('Tenant context required');
    }

    const { description = '', academicYear = '2024-25' } = additionalData;

    // Prepare desired records (PER-STUDENT ONLY - no class-wide modifications)
    const desiredRecords = distributionPlan.distribution.map(dist => ({
      student_id: studentId, // 🔒 ALWAYS per-student, never null
      class_id: classId,
      tenant_id: tenantId,
      academic_year: academicYear,
      discount_type: 'fixed_amount',
      discount_value: dist.concessionAmount,
      fee_component: dist.feeComponent,
      description: description + (distributionPlan.distribution.length > 1 ? ` (Auto-distributed)` : ''),
      is_active: true,
      created_at: new Date().toISOString()
    }));

    // 🚨 VALIDATION: Double-check no class-wide records
    const hasNullStudent = desiredRecords.some(rec => !rec.student_id);
    if (hasNullStudent) {
      throw new Error('❌ BLOCKED: Attempted to create class-wide discount. All discounts must be per-student.');
    }

    console.log('📝 Concession records (desired state):');
    desiredRecords.forEach((record, index) => {
      console.log(`  ${index + 1}. ${record.fee_component}: ₹${record.discount_value}`);
    });

    const createdOrUpdated = [];

    // Upsert behavior: if a record exists for this student+class+year+component → update, else insert
    for (const rec of desiredRecords) {
      // Find existing active record
      const { data: existing, error: findErr } = await supabase
        .from('student_discounts')
        .select('id, discount_value, is_active')
        .eq('tenant_id', rec.tenant_id)
        .eq('student_id', rec.student_id)
        .eq('class_id', rec.class_id)
        .eq('academic_year', rec.academic_year)
        .eq('fee_component', rec.fee_component)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (findErr) {
        console.warn('⚠️ Lookup failed, attempting insert anyway:', findErr.message);
      }

      if (existing && existing.id) {
        // Update the existing record's discount_value and description
        const { data: updated, error: updErr } = await supabase
          .from('student_discounts')
          .update({
            discount_value: rec.discount_value,
            description: rec.description,
            updated_at: new Date().toISOString(),
            is_active: true
          })
          .eq('id', existing.id)
          .select();

        if (updErr) {
          console.error('❌ Error updating concession record:', updErr);
          throw updErr;
        }
        createdOrUpdated.push(updated?.[0] || { id: existing.id, ...rec });
      } else {
        // Insert new record
        const { data: inserted, error: insErr } = await supabase
          .from('student_discounts')
          .insert(rec)
          .select();

        if (insErr) {
          console.error('❌ Error inserting concession record:', insErr);
          throw insErr;
        }
        createdOrUpdated.push(inserted?.[0] || rec);
      }
    }

    console.log(`✅ Upserted ${createdOrUpdated.length} concession records`);

    return {
      success: true,
      data: {
        createdRecords: createdOrUpdated,
        distributionSummary: distributionPlan,
        recordsCreated: createdOrUpdated.length
      },
      error: null
    };

  } catch (error) {
    console.error('❌ Error in createMultipleConcessionRecords:', error);
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
};

/**
 * 🎯 MAIN FUNCTION: Apply Smart Concession Distribution
 * 
 * This is the main function that coordinates the entire smart concession process:
 * 1. Gets fee structure sorted by amount
 * 2. Calculates optimal distribution
 * 3. Creates multiple concession records
 * 
 * @param {string} studentId - Student ID
 * @param {string} classId - Class ID
 * @param {number} totalConcessionAmount - Total concession amount
 * @param {Object} additionalData - Additional data (description, academic year, etc.)
 * @returns {Object} Complete result of the smart concession application
 */
export const applySmartConcessionDistribution = async (
  studentId, 
  classId, 
  totalConcessionAmount, 
  additionalData = {}
) => {
  try {
    console.log('🚀 Starting Smart Concession Distribution Process (PER-STUDENT ONLY)...', {
      studentId,
      classId,
      totalConcessionAmount,
      additionalData
    });

    // 🚨 CRITICAL GUARDRAILS: Per-student only enforcement
    if (!studentId || studentId === null || studentId === undefined) {
      throw new Error('❌ BLOCKED: Student ID is required for all concessions. Class-wide discounts are prohibited.');
    }

    // Additional guardrail against bypassing via additionalData
    if (additionalData.applyToClass || additionalData.classWide) {
      throw new Error('❌ BLOCKED: Class-wide concessions are not allowed. Use per-student discounts only.');
    }

    // Step 1: Get fee structure (class-level fees only)
    const feeStructureResult = await getStudentFeeStructureSorted(
      studentId, 
      classId, 
      additionalData.academicYear || '2024-25'
    );

    if (!feeStructureResult.success || !feeStructureResult.data?.length) {
      throw new Error('Could not fetch fee structure or no fees found for this class');
    }

    const fees = feeStructureResult.data;

    // Determine application mode
    // additionalData.applyTo:
    //   - 'TUITION' => apply entire amount to Tuition fee only
    //   - 'BUS'     => apply entire amount to Bus fee only
    //   - 'OVERALL' => split equally across all components
    // If not provided: default to OVERALL (equal split) when no specific feeComponent is selected
    const applyTo = additionalData.applyTo || (additionalData.feeComponent ? 'SPECIFIC' : 'OVERALL');

    let distributionPlan;

    if (applyTo === 'OVERALL') {
      distributionPlan = calculateEqualSplitDistribution(fees, totalConcessionAmount);
    } else if (applyTo === 'SPECIFIC' || additionalData.feeComponent) {
      // Apply to a specific component only
      const target = fees.find(f => (f.fee_component || '').toLowerCase() === (additionalData.feeComponent || '').toLowerCase());
      if (!target) throw new Error(`Fee component not found: ${additionalData.feeComponent}`);

      const feeAmount = Number(target.amount) || 0;
      const applyAmount = Math.min(Number(totalConcessionAmount) || 0, feeAmount);
      distributionPlan = {
        totalConcessionRequested: totalConcessionAmount,
        totalConcessionApplied: applyAmount,
        remainingConcession: Math.max(0, (Number(totalConcessionAmount) || 0) - applyAmount),
        componentsAffected: applyAmount > 0 ? 1 : 0,
        distribution: applyAmount > 0 ? [{
          id: target.id,
          feeComponent: target.fee_component,
          originalAmount: feeAmount,
          concessionAmount: applyAmount,
          finalAmount: Math.max(0, feeAmount - applyAmount),
          dueDate: target.due_date,
          academicYear: target.academic_year
        }] : []
      };
    } else if (applyTo === 'TUITION' || applyTo === 'BUS') {
      const targetName = applyTo === 'TUITION' ? 'Tution fee' : 'Bus Fee';
      const target = fees.find(f => (f.fee_component || '').toLowerCase() === targetName.toLowerCase());
      if (!target) throw new Error(`Fee component not found: ${targetName}`);

      const feeAmount = Number(target.amount) || 0;
      const applyAmount = Math.min(Number(totalConcessionAmount) || 0, feeAmount);
      distributionPlan = {
        totalConcessionRequested: totalConcessionAmount,
        totalConcessionApplied: applyAmount,
        remainingConcession: Math.max(0, (Number(totalConcessionAmount) || 0) - applyAmount),
        componentsAffected: applyAmount > 0 ? 1 : 0,
        distribution: applyAmount > 0 ? [{
          id: target.id,
          feeComponent: target.fee_component,
          originalAmount: feeAmount,
          concessionAmount: applyAmount,
          finalAmount: Math.max(0, feeAmount - applyAmount),
          dueDate: target.due_date,
          academicYear: target.academic_year
        }] : []
      };
    } else {
      // Fallback: smart (highest-first) distribution
      distributionPlan = calculateConcessionDistribution(fees, totalConcessionAmount);
    }

    // Validate distribution
    if (!distributionPlan.distribution.length) {
      throw new Error('No fee components available for concession application');
    }

    if (distributionPlan.remainingConcession === totalConcessionAmount) {
      throw new Error('Concession amount exceeds total fee amount');
    }

    // Step 4: Upsert concession records (per student, per component)
    const creationResult = await createMultipleConcessionRecords(
      studentId, 
      classId, 
      distributionPlan, 
      additionalData
    );

    if (!creationResult.success) {
      throw new Error(creationResult.error);
    }

    console.log('🎉 Smart Concession Distribution completed successfully!');

    return {
      success: true,
      data: {
        distributionPlan,
        createdRecords: creationResult.data.createdRecords,
        summary: {
          totalRequested: totalConcessionAmount,
          totalApplied: distributionPlan.totalConcessionApplied,
          componentsAffected: distributionPlan.componentsAffected,
          recordsCreated: creationResult.data.recordsCreated
        }
      },
      error: null
    };

  } catch (error) {
    console.error('❌ Error in applySmartConcessionDistribution:', error);
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
};

/**
 * Preview concession distribution without creating records
 * @param {string} studentId - Student ID
 * @param {string} classId - Class ID
 * @param {number} totalConcessionAmount - Total concession amount
 * @param {string} academicYear - Academic Year
 * @returns {Object} Preview of how concession will be distributed
 */
export const previewConcessionDistribution = async (
  studentId, 
  classId, 
  totalConcessionAmount, 
  academicYear = '2024-25'
) => {
  try {
    console.log('👀 Previewing concession distribution...');

    const feeStructureResult = await getStudentFeeStructureSorted(
      studentId, 
      classId, 
      academicYear
    );

    if (!feeStructureResult.success) {
      throw new Error(feeStructureResult.error);
    }

    const distributionPlan = calculateConcessionDistribution(
      feeStructureResult.data, 
      totalConcessionAmount
    );

    return {
      success: true,
      data: distributionPlan,
      error: null
    };

  } catch (error) {
    console.error('❌ Error in previewConcessionDistribution:', error);
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
};