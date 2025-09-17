/**
 * Fee Structure Test Utilities
 * ============================
 * 
 * This utility provides helper functions to test and create sample
 * fee structure data for debugging the admin FeeManagement screen.
 */

import { supabase, TABLES } from './supabase';
import { validateTenantAccess } from './tenantValidation';

/**
 * Check if fee structures exist for a tenant
 */
export const checkFeeStructures = async (tenantId, user) => {
  try {
    console.log('🔍 Checking fee structures for tenant:', tenantId);
    
    // Validate tenant access
    const validation = await validateTenantAccess(user?.id, tenantId, 'checkFeeStructures');
    if (!validation.isValid) {
      console.error('❌ Tenant validation failed:', validation.error);
      return { success: false, error: validation.error };
    }

    // Check fee structures
    const { data: feeStructures, error: feeError } = await supabase
      .from(TABLES.FEE_STRUCTURE)
      .select('id, class_id, fee_component, amount, academic_year')
      .eq('tenant_id', tenantId);

    if (feeError) {
      console.error('❌ Error checking fee structures:', feeError);
      return { success: false, error: feeError.message };
    }

    // Check classes  
    const { data: classes, error: classError } = await supabase
      .from(TABLES.CLASSES)
      .select('id, class_name, section')
      .eq('tenant_id', tenantId);

    if (classError) {
      console.error('❌ Error checking classes:', classError);
      return { success: false, error: classError.message };
    }

    console.log('📊 Fee structure check results:', {
      feeStructures: feeStructures?.length || 0,
      classes: classes?.length || 0,
      sampleFeeStructure: feeStructures?.[0] || null,
      sampleClass: classes?.[0] || null
    });

    return {
      success: true,
      data: {
        feeStructures: feeStructures || [],
        classes: classes || [],
        hasData: (feeStructures?.length || 0) > 0 && (classes?.length || 0) > 0
      }
    };

  } catch (error) {
    console.error('❌ Error in checkFeeStructures:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Create sample fee structure data for testing
 */
export const createSampleFeeStructures = async (tenantId, user) => {
  try {
    console.log('🏗️ Creating sample fee structures for tenant:', tenantId);

    // Validate tenant access
    const validation = await validateTenantAccess(user?.id, tenantId, 'createSampleFeeStructures');
    if (!validation.isValid) {
      console.error('❌ Tenant validation failed:', validation.error);
      return { success: false, error: validation.error };
    }

    // First check if classes exist
    const { data: classes, error: classError } = await supabase
      .from(TABLES.CLASSES)
      .select('id, class_name, section')
      .eq('tenant_id', tenantId)
      .limit(5);

    if (classError) {
      console.error('❌ Error fetching classes:', classError);
      return { success: false, error: classError.message };
    }

    if (!classes || classes.length === 0) {
      console.log('🏫 No classes found. Creating sample classes first...');
      
      // Create sample classes
      const sampleClasses = [
        { class_name: '1st', section: 'A', tenant_id: tenantId },
        { class_name: '2nd', section: 'A', tenant_id: tenantId },
        { class_name: '3rd', section: 'A', tenant_id: tenantId },
      ];

      const { data: newClasses, error: createClassError } = await supabase
        .from(TABLES.CLASSES)
        .insert(sampleClasses)
        .select('id, class_name, section');

      if (createClassError) {
        console.error('❌ Error creating sample classes:', createClassError);
        return { success: false, error: createClassError.message };
      }

      console.log('✅ Created sample classes:', newClasses);
      classes.push(...(newClasses || []));
    }

    // Create sample fee structures for each class
    const currentYear = new Date().getFullYear();
    const academicYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
    
    const sampleFeeStructures = [];
    
    classes.forEach(classInfo => {
      // Add common fee types for each class
      const feeTypes = [
        { fee_component: 'Tuition Fee', amount: 5000, description: 'Monthly tuition fee' },
        { fee_component: 'Books Fee', amount: 1500, description: 'Academic books and materials' },
        { fee_component: 'Transport Fee', amount: 2000, description: 'School bus transportation' },
        { fee_component: 'Activity Fee', amount: 800, description: 'Sports and extracurricular activities' },
      ];

      feeTypes.forEach(feeType => {
        sampleFeeStructures.push({
          class_id: classInfo.id,
          fee_component: feeType.fee_component,
          amount: feeType.amount,
          base_amount: feeType.amount,
          due_date: new Date(currentYear, 3, 15).toISOString().split('T')[0], // April 15
          academic_year: academicYear,
          tenant_id: tenantId
        });
      });
    });

    console.log('💰 Creating fee structures:', sampleFeeStructures.length);

    const { data: createdFees, error: createFeeError } = await supabase
      .from(TABLES.FEE_STRUCTURE)
      .insert(sampleFeeStructures)
      .select('id, class_id, fee_component, amount');

    if (createFeeError) {
      console.error('❌ Error creating sample fee structures:', createFeeError);
      return { success: false, error: createFeeError.message };
    }

    console.log('✅ Created sample fee structures:', createdFees?.length);

    return {
      success: true,
      data: {
        classesCreated: classes.length,
        feeStructuresCreated: createdFees?.length || 0,
        createdFees: createdFees || []
      }
    };

  } catch (error) {
    console.error('❌ Error in createSampleFeeStructures:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Test the fee structure loading query
 */
export const testFeeStructureQuery = async (tenantId, user) => {
  try {
    console.log('🧪 Testing fee structure query for tenant:', tenantId);

    // Test the same query used in the optimized loader
    const { data: testData, error: testError } = await supabase
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
      .eq('tenant_id', tenantId);

    if (testError) {
      console.error('❌ Test query failed:', testError);
      return { success: false, error: testError.message };
    }

    console.log('✅ Test query results:', {
      totalClasses: testData?.length || 0,
      classesWithFees: testData?.filter(c => c.fee_structure?.length > 0).length || 0,
      totalFeeStructures: testData?.reduce((sum, c) => sum + (c.fee_structure?.length || 0), 0) || 0,
      sampleClass: testData?.[0] || null
    });

    return {
      success: true,
      data: testData || []
    };

  } catch (error) {
    console.error('❌ Error in testFeeStructureQuery:', error);
    return { success: false, error: error.message };
  }
};