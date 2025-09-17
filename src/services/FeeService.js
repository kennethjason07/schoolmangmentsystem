import { calculateStudentFees } from '../utils/feeCalculation';
import { supabase, TABLES, getUserTenantId, isValidUUID } from '../utils/supabase';

/**
 * 🎯 CENTRALIZED FEE SERVICE
 * 
 * This service ensures consistent fee calculation and display across ALL login types:
 * - Student Login: Shows their own fees
 * - Parent Login: Shows their child's fees  
 * - Admin Login: Shows any student's fees
 * 
 * KEY FEATURES:
 * - Uses simplified fee architecture (class fees + dynamic discounts)
 * - Handles payments from student_fees table correctly
 * - Calculates remaining fees after payments
 * - Provides consistent fee breakdown across all interfaces
 */

class FeeService {
  /**
   * Get comprehensive fee information for a student
   * This is the SINGLE source of truth for fee calculations
   */
  static async getStudentFeeDetails(studentId, options = {}) {
    try {
      console.log('🏦 FeeService: Getting comprehensive fee details for student:', studentId);
      
      const { includePaymentHistory = true, includeFeeBreakdown = true } = options;
      
      // Step 1: Get basic student info
      const studentInfo = await this._getStudentBasicInfo(studentId);
      if (!studentInfo) {
        throw new Error('Student not found');
      }
      
      // Step 2: Calculate fees using centralized calculation
      console.log('📊 Calculating fees using centralized fee calculation...');
      const feeCalculation = await calculateStudentFees(
        studentId, 
        studentInfo.class_id, 
        studentInfo.tenant_id
      );
      
      if (feeCalculation.error) {
        throw new Error(`Fee calculation error: ${feeCalculation.error}`);
      }
      
      // Step 3: Get payment summary from student_fees table
      const paymentSummary = await this._getPaymentSummary(studentId, studentInfo.tenant_id);
      
      // Step 4: Build comprehensive fee response
      const response = {
        student: {
          id: studentInfo.id,
          name: studentInfo.name,
          admission_no: studentInfo.admission_no,
          roll_no: studentInfo.roll_no,
          class_info: {
            id: studentInfo.class_id,
            name: studentInfo.classes?.class_name,
            section: studentInfo.classes?.section,
            academic_year: studentInfo.academic_year
          }
        },
        
        // 💰 CORE FEE INFORMATION (centralized calculation)
        fees: {
          // Total amounts
          totalBaseFee: feeCalculation.totalBaseFee,
          totalDiscounts: feeCalculation.totalDiscounts,
          totalDue: feeCalculation.totalAmount,
          totalPaid: feeCalculation.totalPaid,
          totalOutstanding: feeCalculation.totalOutstanding,
          
          // Academic year
          academicYear: feeCalculation.academicYear,
          
          // Fee status
          status: this._determineFeeStatus(feeCalculation),
          
          // Component-wise breakdown
          components: includeFeeBreakdown ? feeCalculation.details.map(detail => ({
            component: detail.feeComponent,
            baseFee: detail.baseFeeAmount,
            discount: detail.discountAmount,
            finalAmount: detail.finalAmount,
            paidAmount: detail.paidAmount,
            outstandingAmount: detail.outstandingAmount,
            dueDate: detail.dueDate,
            status: detail.status || this._getComponentStatus(detail),
            
            // Show if this is class fee (should always be true in simplified system)
            isClassFee: detail.isClassFee,
            isIndividualFee: detail.isIndividualFee,
            
            // Applied discounts for this component
            appliedDiscounts: detail.discounts?.map(discount => ({
              type: discount.discount_type,
              value: discount.discount_value,
              reason: discount.reason || discount.description
            })) || []
          })) : [],
          
          // Payment information
          payments: includePaymentHistory ? {
            totalAmount: paymentSummary.totalPaid,
            count: paymentSummary.paymentCount,
            lastPayment: paymentSummary.lastPayment,
            recentPayments: paymentSummary.recentPayments || []
          } : null
        },
        
        // 🎁 DISCOUNT INFORMATION
        discounts: {
          hasDiscounts: feeCalculation.totalDiscounts > 0,
          totalDiscount: feeCalculation.totalDiscounts,
          activeDiscounts: feeCalculation.details
            .filter(detail => detail.discounts && detail.discounts.length > 0)
            .flatMap(detail => detail.discounts)
            .map(discount => ({
              id: discount.id,
              type: discount.discount_type,
              value: discount.discount_value,
              component: discount.fee_component,
              reason: discount.reason || discount.description,
              isActive: discount.is_active
            }))
        },
        
        // 📈 CALCULATION METADATA
        metadata: {
          calculatedAt: new Date().toISOString(),
          source: 'FeeService.getStudentFeeDetails',
          architecture: 'simplified', // Using simplified fee architecture
          ...feeCalculation.metadata
        }
      };
      
      console.log('✅ FeeService: Fee details calculated successfully');
      console.log(`   💰 Total Due: ₹${response.fees.totalDue}`);
      console.log(`   💳 Total Paid: ₹${response.fees.totalPaid}`);
      console.log(`   🔄 Outstanding: ₹${response.fees.totalOutstanding}`);
      console.log(`   🎁 Discounts: ₹${response.fees.totalDiscounts}`);
      
      return { success: true, data: response, error: null };
      
    } catch (error) {
      console.error('❌ FeeService Error:', error);
      return { 
        success: false, 
        data: null, 
        error: error.message || 'Failed to get fee details' 
      };
    }
  }
  
  /**
   * Get fee summary for quick display (used in dashboards)
   */
  static async getStudentFeeSummary(studentId) {
    try {
      const fullDetails = await this.getStudentFeeDetails(studentId, {
        includePaymentHistory: false,
        includeFeeBreakdown: false
      });
      
      if (!fullDetails.success) {
        return fullDetails;
      }
      
      return {
        success: true,
        data: {
          student: fullDetails.data.student,
          totalDue: fullDetails.data.fees.totalDue,
          totalPaid: fullDetails.data.fees.totalPaid,
          totalOutstanding: fullDetails.data.fees.totalOutstanding,
          totalDiscounts: fullDetails.data.fees.totalDiscounts,
          status: fullDetails.data.fees.status,
          hasDiscounts: fullDetails.data.discounts.hasDiscounts
        },
        error: null
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error.message
      };
    }
  }
  
  /**
   * Get fee details for parent login (works with multiple children)
   */
  /**
   * 🏫 GET CLASS FEE STRUCTURE (Total fees for the class)
   * This shows the base fee structure that applies to ALL students in a class
   * before any individual discounts are applied
   */
  static async getClassFeeStructure(classId, academicYear = '2024-2025') {
    try {
      console.log('🏫 FeeService: Getting class fee structure for:', { classId, academicYear });
      
      if (!classId || !isValidUUID(classId)) {
        return {
          success: false,
          error: 'Invalid class ID provided',
          data: null
        };
      }

      // Get class information
      const { data: classInfo, error: classError } = await supabase
        .from('classes')
        .select('id, class_name, section')
        .eq('id', classId)
        .single();

      if (classError || !classInfo) {
        return {
          success: false,
          error: 'Class not found',
          data: null
        };
      }

      // Get ALL fee structures for this class (base fees for all students)
      const { data: feeStructures, error: feeError } = await supabase
        .from('fee_structure')
        .select('*')
        .eq('class_id', classId)
        .eq('academic_year', academicYear)
        .is('student_id', null) // Only class-level fees
        .order('fee_component');

      if (feeError) {
        return {
          success: false,
          error: `Failed to fetch class fee structures: ${feeError.message}`,
          data: null
        };
      }

      console.log('🏫 Found', feeStructures?.length || 0, 'fee components for class', classInfo.class_name);

      // Calculate total class fee
      const totalClassFee = (feeStructures || []).reduce((sum, fee) => sum + (Number(fee.amount) || 0), 0);
      
      const feeComponents = (feeStructures || []).map(fee => ({
        id: fee.id,
        component: fee.fee_component,
        amount: Number(fee.amount) || 0,
        dueDate: fee.due_date,
        description: fee.fee_component,
        academicYear: fee.academic_year
      }));

      console.log('💰 Total Class Fee:', `₹${totalClassFee}`);

      return {
        success: true,
        data: {
          class: {
            id: classInfo.id,
            name: classInfo.class_name,
            section: classInfo.section
          },
          fees: {
            totalAmount: totalClassFee,
            academicYear: academicYear,
            components: feeComponents,
            componentCount: feeComponents.length
          },
          summary: {
            isClassFeeStructure: true,
            appliesToAllStudents: true,
            individualDiscountsMayApply: true
          }
        },
        error: null
      };

    } catch (error) {
      console.error('❌ FeeService: Error getting class fee structure:', error);
      return {
        success: false,
        error: `Unexpected error: ${error.message}`,
        data: null
      };
    }
  }

  /**
   * 🎯 GET STUDENT FEES BASED ON CLASS STRUCTURE + INDIVIDUAL DISCOUNTS
   * This is the new method that follows your requirements:
   * 1. Start with class fee structure
   * 2. Apply individual discounts only if student has them
   * 3. All other students get the same class fees
   */
  static async getStudentFeesWithClassBase(studentId, options = {}) {
    try {
      console.log('🎯 FeeService: Getting class-based fees for student:', studentId);
      
      if (!studentId || !isValidUUID(studentId)) {
        return {
          success: false,
          error: 'Invalid student ID provided',
          data: null
        };
      }

      const academicYear = options.academicYear || '2024-2025';

      // Step 1: Get student info
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select(`
          id,
          name,
          admission_no,
          roll_no,
          class_id,
          classes:class_id (
            id,
            class_name,
            section
          )
        `)
        .eq('id', studentId)
        .single();

      if (studentError || !student) {
        return {
          success: false,
          error: 'Student not found',
          data: null
        };
      }

      // Step 2: Get the class fee structure (base fees for all students)
      const classFeeResult = await this.getClassFeeStructure(student.class_id, academicYear);
      if (!classFeeResult.success) {
        return classFeeResult;
      }

      const classFeeStructure = classFeeResult.data;
      
      console.log('🏫 Using class fee structure as base for:', student.name);
      console.log('   Total class fee: ₹' + classFeeStructure.fees.totalAmount);

      // Step 3: Get student's individual discounts (if any)
      const { data: studentDiscounts, error: discountError } = await supabase
        .from('student_discounts')
        .select('*')
        .eq('student_id', studentId)
        .eq('academic_year', academicYear)
        .eq('is_active', true);

      if (discountError) {
        console.warn('Warning: Error fetching student discounts:', discountError);
      }

      const hasIndividualDiscounts = (studentDiscounts?.length || 0) > 0;
      console.log(`🎁 Student ${hasIndividualDiscounts ? 'HAS' : 'has NO'} individual discounts:`, studentDiscounts?.length || 0);

      // Step 4: Get student's payment history
      const { data: studentPayments, error: paymentError } = await supabase
        .from('student_fees')
        .select('*')
        .eq('student_id', studentId)
        .eq('academic_year', academicYear);

      if (paymentError) {
        console.warn('Warning: Error fetching student payments:', paymentError);
      }

      console.log('💳 Found', studentPayments?.length || 0, 'payments for student');

      // Step 5: Process each fee component with potential individual discounts
      const processedComponents = [];
      let totalBaseFee = 0;
      let totalDiscounts = 0;
      let totalDue = 0;
      let totalPaid = 0;

      for (const feeComponent of classFeeStructure.fees.components) {
        const baseFeeAmount = feeComponent.amount;
        totalBaseFee += baseFeeAmount;

        console.log(`  Processing: ${feeComponent.component} (Base: ₹${baseFeeAmount})`);

        // Check for individual discount on this component
        let discountAmount = 0;
        let applicableDiscount = null;

        if (hasIndividualDiscounts) {
          // Look for specific component discount
          applicableDiscount = studentDiscounts.find(d => 
            d.fee_component === feeComponent.component
          );

          // If no specific discount, check for general discount
          if (!applicableDiscount) {
            applicableDiscount = studentDiscounts.find(d => 
              !d.fee_component || d.fee_component === null || d.fee_component === ''
            );
          }
        }

        if (applicableDiscount) {
          if (applicableDiscount.discount_type === 'percentage') {
            discountAmount = (baseFeeAmount * Number(applicableDiscount.discount_value)) / 100;
          } else if (applicableDiscount.discount_type === 'fixed') {
            discountAmount = Number(applicableDiscount.discount_value);
          }
          
          discountAmount = Math.min(discountAmount, baseFeeAmount);
          totalDiscounts += discountAmount;
          
          console.log(`    ✨ Individual discount: ₹${discountAmount}`);
        } else {
          console.log(`    📋 No individual discount - using class fee`);
        }

        const finalAmount = baseFeeAmount - discountAmount;
        totalDue += finalAmount;

        // Calculate payments for this component
        const componentPayments = (studentPayments || []).filter(payment => 
          payment.fee_component === feeComponent.component
        );
        
        const paidAmount = componentPayments.reduce((sum, payment) => 
          sum + (Number(payment.amount_paid) || 0), 0
        );
        
        totalPaid += paidAmount;
        const remainingAmount = Math.max(0, finalAmount - paidAmount);
        
        // Determine status
        let status = 'unpaid';
        if (paidAmount >= finalAmount) {
          status = 'paid';
        } else if (paidAmount > 0) {
          status = 'partial';
        }

        processedComponents.push({
          id: feeComponent.id,
          name: feeComponent.component,
          component: feeComponent.component,
          baseFeeAmount,
          discountAmount,
          finalAmount,
          paidAmount,
          remainingAmount,
          status,
          dueDate: feeComponent.dueDate,
          academicYear,
          isClassFee: true,
          hasIndividualDiscount: discountAmount > 0,
          payments: componentPayments.map(p => ({
            id: p.id,
            amount: Number(p.amount_paid) || 0,
            paymentDate: p.payment_date,
            paymentMode: p.payment_mode,
            receiptNumber: p.receipt_number,
            remarks: p.remarks
          })),
          appliedDiscount: applicableDiscount ? {
            id: applicableDiscount.id,
            type: applicableDiscount.discount_type,
            value: applicableDiscount.discount_value,
            amount: discountAmount,
            reason: applicableDiscount.reason
          } : null
        });

        console.log(`    💰 Final: ₹${baseFeeAmount} - ₹${discountAmount} = ₹${finalAmount} | Paid: ₹${paidAmount}`);
      }

      const totalOutstanding = totalDue - totalPaid;

      console.log('📊 FINAL CALCULATION for', student.name, ':');
      console.log('   🏫 Class base total: ₹' + totalBaseFee);
      console.log('   🎁 Individual discounts: ₹' + totalDiscounts);
      console.log('   💰 Total due: ₹' + totalDue);
      console.log('   💳 Total paid: ₹' + totalPaid);
      console.log('   🔄 Outstanding: ₹' + totalOutstanding);

      return {
        success: true,
        data: {
          student: {
            id: student.id,
            name: student.name,
            admissionNo: student.admission_no,
            rollNo: student.roll_no,
            class: {
              id: student.classes?.id,
              name: student.classes?.class_name,
              section: student.classes?.section
            }
          },
          fees: {
            // Base class fee (same for all students in class)
            classBaseFee: totalBaseFee,
            // Individual discounts (only for this student)
            individualDiscounts: totalDiscounts,
            // Final amounts
            totalDue,
            totalPaid,
            totalOutstanding,
            academicYear,
            components: processedComponents
          },
          classFeeStructure: {
            totalClassFee: classFeeStructure.fees.totalAmount,
            components: classFeeStructure.fees.components.length,
            appliesToAllStudents: true
          },
          individualInfo: {
            hasIndividualDiscounts,
            discountCount: studentDiscounts?.length || 0,
            isDiscountedStudent: totalDiscounts > 0
          }
        },
        error: null
      };

    } catch (error) {
      console.error('❌ FeeService: Error in getStudentFeesWithClassBase:', error);
      return {
        success: false,
        error: `Unexpected error: ${error.message}`,
        data: null
      };
    }
  }

  static async getChildrenFeeDetails(parentUserId) {
    try {
      console.log('👨‍👩‍👧‍👦 FeeService: Getting fee details for parent:', parentUserId);
      
      // Get tenant context
      const tenantId = await getUserTenantId();
      if (!tenantId) {
        console.log('No tenant context found, but proceeding for parent access');
        // Don't throw error for parents as they might not have tenant_id
      }
      
      // Find children linked to this parent
      let query = supabase
        .from(TABLES.USERS)
        .select(`
          id, full_name, email,
          students!users_linked_parent_of_fkey(
            id, name, admission_no, roll_no, class_id, academic_year,
            classes(class_name, section)
          )
        `)
        .eq('id', parentUserId);
      
      // Only filter by tenant_id if it exists
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }
      
      const { data: parentUser, error: parentError } = await query.single();
      
      if (parentError || !parentUser) {
        // Try alternative approach without tenant filtering for parents
        console.log('Trying alternative parent lookup without tenant filtering');
        const { data: altParentUser, error: altParentError } = await supabase
          .from(TABLES.USERS)
          .select(`
            id, full_name, email,
            students!users_linked_parent_of_fkey(
              id, name, admission_no, roll_no, class_id, academic_year,
              classes(class_name, section)
            )
          `)
          .eq('id', parentUserId)
          .single();
          
        if (altParentError || !altParentUser) {
          throw new Error('Parent user not found');
        }
        parentUser = altParentUser;
      }
      
      // Also check parents table for additional children
      let parentQuery = supabase
        .from(TABLES.PARENTS)
        .select(`
          student_id, relation,
          students(id, name, admission_no, roll_no, class_id, academic_year,
            classes(class_name, section)
          )
        `)
        .eq('email', parentUser.email);
      
      // Only filter by tenant_id if it exists
      if (tenantId) {
        parentQuery = parentQuery.eq('tenant_id', tenantId);
      }
      
      const { data: parentRecords } = await parentQuery;
      
      // Combine children from both relationships
      const children = [];
      
      // Add primary linked child
      if (parentUser.students) {
        children.push(parentUser.students);
      }
      
      // Add additional children from parents table
      if (parentRecords) {
        parentRecords.forEach(record => {
          if (record.students && !children.find(child => child.id === record.students.id)) {
            children.push(record.students);
          }
        });
      }
      
      if (children.length === 0) {
        return {
          success: true,
          data: {
            parent: {
              id: parentUser.id,
              name: parentUser.full_name,
              email: parentUser.email
            },
            children: []
          },
          error: null
        };
      }
      
      // Get fee details for each child
      const childrenFeeDetails = await Promise.all(
        children.map(async (child) => {
          const feeDetails = await this.getStudentFeeDetails(child.id);
          return {
            child,
            fees: feeDetails.success ? feeDetails.data.fees : null,
            discounts: feeDetails.success ? feeDetails.data.discounts : null,
            error: feeDetails.success ? null : feeDetails.error
          };
        })
      );
      
      console.log(`✅ FeeService: Processed fee details for ${children.length} children`);
      
      return {
        success: true,
        data: {
          parent: {
            id: parentUser.id,
            name: parentUser.full_name,
            email: parentUser.email
          },
          children: childrenFeeDetails
        },
        error: null
      };
      
    } catch (error) {
      console.error('❌ FeeService Parent Error:', error);
      return {
        success: false,
        data: null,
        error: error.message
      };
    }
  }
  
  // Private helper methods
  static async _getStudentBasicInfo(studentId) {
    try {
      const tenantId = await getUserTenantId();
      const { data, error } = await supabase
        .from(TABLES.STUDENTS)
        .select(`
          id, name, admission_no, roll_no, class_id, academic_year, tenant_id,
          classes(class_name, section)
        `)
        .eq('id', studentId)
        .eq('tenant_id', tenantId)
        .single();
      
      if (error) {
        console.error('Error fetching student info:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Error in _getStudentBasicInfo:', error);
      return null;
    }
  }
  
  static async _getPaymentSummary(studentId, tenantId) {
    try {
      const { data: payments, error } = await supabase
        .from(TABLES.STUDENT_FEES)
        .select('*')
        .eq('student_id', studentId)
        .eq('tenant_id', tenantId)
        .order('payment_date', { ascending: false });
      
      if (error) {
        console.error('Error fetching payment summary:', error);
        return {
          totalPaid: 0,
          paymentCount: 0,
          lastPayment: null,
          recentPayments: []
        };
      }
      
      const totalPaid = (payments || []).reduce((sum, payment) => 
        sum + (parseFloat(payment.amount_paid) || 0), 0
      );
      
      return {
        totalPaid,
        paymentCount: (payments || []).length,
        lastPayment: payments && payments.length > 0 ? payments[0] : null,
        recentPayments: (payments || []).slice(0, 5).map(payment => ({
          id: payment.id,
          amount: parseFloat(payment.amount_paid) || 0,
          date: payment.payment_date,
          mode: payment.payment_mode,
          component: payment.fee_component,
          receipt: payment.receipt_number,
          remarks: payment.remarks
        }))
      };
    } catch (error) {
      console.error('Error in _getPaymentSummary:', error);
      return {
        totalPaid: 0,
        paymentCount: 0,
        lastPayment: null,
        recentPayments: []
      };
    }
  }
  
  static _determineFeeStatus(feeCalculation) {
    if (feeCalculation.totalOutstanding <= 0) {
      return 'paid';
    } else if (feeCalculation.totalPaid > 0) {
      return 'partial';
    } else {
      return 'unpaid';
    }
  }
  
  static _getComponentStatus(component) {
    if (component.outstandingAmount <= 0) {
      return 'paid';
    } else if (component.paidAmount > 0) {
      return 'partial';
    } else {
      return 'unpaid';
    }
  }
}

export default FeeService;
