/**
 * SAFE STUDENT DISCOUNTS MODULE
 * This module provides safe functions for creating student discounts
 * that never modify class-level fee_structure
 */
import { supabase, TABLES } from './supabase';
import { getUserTenantId } from './tenantValidation';

/**
 * 🔒 Apply a safe discount to a student that never modifies class fees
 * @param {string} studentId - Student ID (REQUIRED)
 * @param {string} classId - Class ID
 * @param {number} discountAmount - Discount amount
 * @param {string} feeComponent - Fee component (e.g., "Tution fee", "Bus Fee")
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Result object
 */
export const applySafeStudentDiscount = async (studentId, classId, discountAmount, feeComponent, options = {}) => {
  try {
    console.log('🔒 Applying SAFE student discount...', {
      studentId,
      classId,
      discountAmount,
      feeComponent,
      options
    });
    
    // CRITICAL SAFETY CHECK 1: Require student_id
    if (!studentId) {
      throw new Error('❌ BLOCKED: student_id is required. Class-wide discounts are not allowed.');
    }
    
    const tenantId = await getUserTenantId();
    if (!tenantId) {
      throw new Error('Tenant context required');
    }
    
    const { academicYear = '2024-25', description = '', isActive = true } = options;
    
    // CRITICAL SAFETY CHECK 2: Verify we have a valid fee component
    if (!feeComponent) {
      throw new Error('❌ BLOCKED: fee_component is required.');
    }
    
    // CRITICAL SAFETY CHECK 3: Verify class-level fee structure exists and get amount
    const { data: feeStructure, error: feeError } = await supabase
      .from(TABLES.FEE_STRUCTURE)
      .select('id, fee_component, amount, base_amount')
      .eq('class_id', classId)
      .is('student_id', null) // ONLY class-level fees
      .eq('academic_year', academicYear)
      .eq('tenant_id', tenantId)
      .ilike('fee_component', feeComponent);
      
    if (feeError) {
      throw new Error(`Error fetching fee structure: ${feeError.message}`);
    }
    
    if (!feeStructure || feeStructure.length === 0) {
      throw new Error(`No fee structure found for ${feeComponent} in class ${classId}`);
    }
    
    const fee = feeStructure[0];
    const maxPossibleDiscount = Number(fee.amount) || 0;
    
    // CRITICAL SAFETY CHECK 4: Cap discount at fee amount
    const safeDiscountAmount = Math.min(Number(discountAmount) || 0, maxPossibleDiscount);
    
    console.log(`💰 Safe discount for ${feeComponent}: ₹${safeDiscountAmount} (max: ₹${maxPossibleDiscount})`);
    
    if (safeDiscountAmount <= 0) {
      throw new Error(`Invalid discount amount: ${discountAmount}`);
    }
    
    // SAFE STEP: Check if a discount already exists for this student+component
    const { data: existingDiscount, error: discountError } = await supabase
      .from('student_discounts')
      .select('id, discount_value, is_active')
      .eq('student_id', studentId)
      .eq('class_id', classId)
      .eq('academic_year', academicYear)
      .eq('fee_component', feeComponent)
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .maybeSingle();
      
    if (discountError) {
      console.warn(`Warning checking existing discounts: ${discountError.message}`);
    }
    
    let result;
    
    if (existingDiscount) {
      console.log(`✏️ Updating existing discount: ${existingDiscount.id}`);
      
      // Update the existing discount
      const { data: updated, error: updateError } = await supabase
        .from('student_discounts')
        .update({
          discount_value: safeDiscountAmount,
          description: description || 'Updated discount',
          is_active: isActive
        })
        .eq('id', existingDiscount.id)
        .select();
        
      if (updateError) {
        throw new Error(`Error updating discount: ${updateError.message}`);
      }
      
      result = { type: 'updated', record: updated?.[0] || null };
    } else {
      console.log(`➕ Creating new discount`);
      
      // Create a new discount record
      const newDiscount = {
        student_id: studentId, // 🔒 ALWAYS per-student only
        class_id: classId,
        tenant_id: tenantId,
        academic_year: academicYear,
        discount_type: 'fixed_amount',
        discount_value: safeDiscountAmount,
        fee_component: feeComponent,
        description: description || `Discount for ${feeComponent}`,
        is_active: isActive,
        created_at: new Date().toISOString()
      };
      
      const { data: inserted, error: insertError } = await supabase
        .from('student_discounts')
        .insert(newDiscount)
        .select();
        
      if (insertError) {
        throw new Error(`Error creating discount: ${insertError.message}`);
      }
      
      result = { type: 'created', record: inserted?.[0] || null };
    }
    
    console.log('✅ Discount safely applied!');
    
    // IMPORTANT: We do NOT touch fee_structure table at all
    // The UI should calculate student discounts at display time
    
    return {
      success: true,
      data: {
        originalAmount: maxPossibleDiscount,
        discountAmount: safeDiscountAmount,
        finalAmount: maxPossibleDiscount - safeDiscountAmount,
        ...result
      },
      error: null
    };
    
  } catch (error) {
    console.error('❌ Error in applySafeStudentDiscount:', error);
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
};

/**
 * 🔒 Get all active discounts for a student
 * @param {string} studentId - Student ID
 * @param {string} classId - Class ID
 * @param {string} academicYear - Academic Year
 * @returns {Promise<Object>} Student's active discounts
 */
export const getStudentActiveDiscounts = async (studentId, classId, academicYear = '2024-25') => {
  try {
    const tenantId = await getUserTenantId();
    if (!tenantId) {
      throw new Error('Tenant context required');
    }
    
    const { data: discounts, error } = await supabase
      .from('student_discounts')
      .select(`
        id,
        fee_component,
        discount_type,
        discount_value,
        description,
        created_at
      `)
      .eq('student_id', studentId)
      .eq('class_id', classId)
      .eq('academic_year', academicYear)
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('fee_component');
      
    if (error) {
      throw new Error(`Error fetching discounts: ${error.message}`);
    }
    
    return {
      success: true,
      data: discounts || [],
      error: null
    };
    
  } catch (error) {
    console.error('❌ Error in getStudentActiveDiscounts:', error);
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
};

/**
 * 📊 Calculate the effective fee for a student with discounts
 * @param {string} studentId - Student ID
 * @param {string} classId - Class ID
 * @param {string} academicYear - Academic Year
 * @returns {Promise<Object>} Student's fees with discounts applied
 */
export const calculateStudentFeeWithDiscounts = async (studentId, classId, academicYear = '2024-25') => {
  try {
    const tenantId = await getUserTenantId();
    if (!tenantId) {
      throw new Error('Tenant context required');
    }
    
    // Step 1: Get class-level fee structure
    const { data: classFees, error: feeError } = await supabase
      .from(TABLES.FEE_STRUCTURE)
      .select('id, fee_component, amount, base_amount')
      .eq('class_id', classId)
      .is('student_id', null) // ONLY class-level fees
      .eq('academic_year', academicYear)
      .eq('tenant_id', tenantId);
      
    if (feeError) {
      throw new Error(`Error fetching class fees: ${feeError.message}`);
    }
    
    if (!classFees || classFees.length === 0) {
      throw new Error(`No fee structure found for class ${classId}`);
    }
    
    // Step 2: Get student's active discounts
    const { data: discounts, error: discountError } = await supabase
      .from('student_discounts')
      .select('id, fee_component, discount_type, discount_value')
      .eq('student_id', studentId)
      .eq('class_id', classId)
      .eq('academic_year', academicYear)
      .eq('tenant_id', tenantId)
      .eq('is_active', true);
      
    if (discountError) {
      throw new Error(`Error fetching discounts: ${discountError.message}`);
    }
    
    // Step 3: Calculate effective fees
    const effectiveFees = classFees.map(fee => {
      // Find applicable discount for this fee component
      const discount = discounts?.find(d => d.fee_component === fee.fee_component);
      const discountAmount = discount ? Number(discount.discount_value) || 0 : 0;
      const feeAmount = Number(fee.amount) || 0;
      const effectiveAmount = Math.max(0, feeAmount - discountAmount);
      
      return {
        fee_component: fee.fee_component,
        original_amount: feeAmount,
        discount_amount: discountAmount,
        effective_amount: effectiveAmount,
        has_discount: discountAmount > 0
      };
    });
    
    // Calculate totals
    const totalOriginal = effectiveFees.reduce((sum, fee) => sum + fee.original_amount, 0);
    const totalDiscount = effectiveFees.reduce((sum, fee) => sum + fee.discount_amount, 0);
    const totalEffective = effectiveFees.reduce((sum, fee) => sum + fee.effective_amount, 0);
    
    return {
      success: true,
      data: {
        fees: effectiveFees,
        totals: {
          original: totalOriginal,
          discount: totalDiscount,
          effective: totalEffective
        }
      },
      error: null
    };
    
  } catch (error) {
    console.error('❌ Error in calculateStudentFeeWithDiscounts:', error);
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
};

/**
 * 🗑️ Remove a discount from a student
 * @param {string} discountId - Discount ID to remove
 * @returns {Promise<Object>} Result of removal
 */
export const removeStudentDiscount = async (discountId) => {
  try {
    const tenantId = await getUserTenantId();
    if (!tenantId) {
      throw new Error('Tenant context required');
    }
    
    // Safety check: Make sure the discount exists and belongs to the tenant
    const { data: discount, error: findError } = await supabase
      .from('student_discounts')
      .select('id, student_id, class_id, fee_component')
      .eq('id', discountId)
      .eq('tenant_id', tenantId)
      .single();
      
    if (findError || !discount) {
      throw new Error(`Discount not found or not authorized: ${findError?.message}`);
    }
    
    // Soft delete by setting is_active to false
    const { data: updated, error: updateError } = await supabase
      .from('student_discounts')
      .update({ is_active: false })
      .eq('id', discountId)
      .select();
      
    if (updateError) {
      throw new Error(`Error removing discount: ${updateError.message}`);
    }
    
    console.log(`🗑️ Discount ${discountId} removed (deactivated)`);
    
    return {
      success: true,
      data: updated?.[0] || null,
      error: null
    };
    
  } catch (error) {
    console.error('❌ Error in removeStudentDiscount:', error);
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
};