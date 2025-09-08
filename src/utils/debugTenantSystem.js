/**
 * Debug utility to diagnose tenant system issues
 * This helps identify problems with the email-based tenant system
 */

import { supabase } from './supabase';

export const debugCurrentUser = async () => {
  console.log('🔍 DEBUG: Starting comprehensive user debug...');
  
  try {
    // 1. Get current authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.log('❌ DEBUG: No authenticated user found');
      return {
        success: false,
        error: 'No authenticated user',
        data: null
      };
    }
    
    console.log('✅ DEBUG: Authenticated user found:', {
      id: user.id,
      email: user.email,
      created_at: user.created_at
    });
    
    // 2. Look up user record in users table
    console.log('🔍 DEBUG: Querying users table...');
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', user.email)
      .maybeSingle();
    
    console.log('📄 DEBUG: User record query result:', {
      found: !!userRecord,
      error: userError?.message || 'none',
      data: userRecord
    });
    
    if (!userRecord) {
      return {
        success: false,
        error: 'User record not found in users table',
        recommendations: [
          'User needs to be added to users table',
          `Run: INSERT INTO users (id, email, tenant_id, role_id, full_name) VALUES ('${user.id}', '${user.email}', 'your-tenant-id', 4, 'Student Name');`
        ],
        data: { authUser: user }
      };
    }
    
    // 3. Check tenant assignment
    let tenantData = null;
    if (userRecord.tenant_id) {
      console.log('🔍 DEBUG: Querying tenant data for:', userRecord.tenant_id);
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', userRecord.tenant_id)
        .maybeSingle();
      
      console.log('🏢 DEBUG: Tenant query result:', {
        found: !!tenant,
        error: tenantError?.message || 'none',
        data: tenant
      });
      
      tenantData = tenant;
    }
    
    // 4. Check for student record if user has linked_student_id
    let studentData = null;
    if (userRecord.linked_student_id) {
      console.log('🔍 DEBUG: Querying student record for:', userRecord.linked_student_id);
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('id', userRecord.linked_student_id)
        .maybeSingle();
      
      console.log('🎓 DEBUG: Student query result:', {
        found: !!student,
        error: studentError?.message || 'none',
        data: student
      });
      
      studentData = student;
    }
    
    // 5. Generate recommendations
    const recommendations = [];
    
    if (!userRecord.tenant_id) {
      recommendations.push('❌ User has no tenant_id assigned - needs tenant assignment');
    } else if (!tenantData) {
      recommendations.push('❌ User assigned to invalid/missing tenant - check tenants table');
    } else if (tenantData.status !== 'active') {
      recommendations.push(`❌ Tenant status is '${tenantData.status}' - needs to be 'active'`);
    } else {
      recommendations.push('✅ Tenant assignment is valid');
    }
    
    if (!userRecord.linked_student_id) {
      recommendations.push('❌ User has no linked_student_id - needed for student functionality');
    } else if (!studentData) {
      recommendations.push('❌ User linked to invalid/missing student record');
    } else if (studentData.tenant_id !== userRecord.tenant_id) {
      recommendations.push('❌ Student record has different tenant_id than user - data mismatch');
    } else {
      recommendations.push('✅ Student record link is valid');
    }
    
    // 6. Check role assignment
    if (!userRecord.role_id) {
      recommendations.push('❌ User has no role_id assigned');
    } else if (userRecord.role_id === 4) {
      recommendations.push('✅ User has student role (role_id = 4)');
    } else {
      recommendations.push(`⚠️ User has role_id = ${userRecord.role_id} (expected 4 for students)`);
    }
    
    return {
      success: true,
      data: {
        authUser: user,
        userRecord,
        tenantData,
        studentData,
        canAccessStudentFeatures: !!(userRecord.tenant_id && userRecord.linked_student_id && tenantData && studentData)
      },
      recommendations
    };
    
  } catch (error) {
    console.error('❌ DEBUG: Error during user debug:', error);
    return {
      success: false,
      error: error.message,
      data: null
    };
  }
};

export const debugAllTenants = async () => {
  console.log('🔍 DEBUG: Getting all tenants...');
  
  try {
    const { data: tenants, error } = await supabase
      .from('tenants')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ DEBUG: Error fetching tenants:', error);
      return { success: false, error: error.message };
    }
    
    console.log('🏢 DEBUG: Found tenants:', tenants?.length || 0);
    tenants?.forEach((tenant, index) => {
      console.log(`🏢 ${index + 1}. ${tenant.name} (ID: ${tenant.id}) - Status: ${tenant.status}`);
    });
    
    return { success: true, data: tenants };
  } catch (error) {
    console.error('❌ DEBUG: Error getting tenants:', error);
    return { success: false, error: error.message };
  }
};

export const debugAllStudents = async (tenantId = null) => {
  console.log('🔍 DEBUG: Getting students...');
  
  try {
    let query = supabase
      .from('students')
      .select('id, name, email, class_id, tenant_id, created_at')
      .order('created_at', { ascending: false });
    
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
      console.log('🏢 DEBUG: Filtering by tenant:', tenantId);
    }
    
    const { data: students, error } = await query;
    
    if (error) {
      console.error('❌ DEBUG: Error fetching students:', error);
      return { success: false, error: error.message };
    }
    
    console.log('🎓 DEBUG: Found students:', students?.length || 0);
    students?.forEach((student, index) => {
      console.log(`🎓 ${index + 1}. ${student.name} (ID: ${student.id}) - Tenant: ${student.tenant_id}`);
    });
    
    return { success: true, data: students };
  } catch (error) {
    console.error('❌ DEBUG: Error getting students:', error);
    return { success: false, error: error.message };
  }
};

export const fixUserTenantAssignment = async (userEmail, tenantId, studentId = null) => {
  console.log('🔧 DEBUG: Fixing user tenant assignment...');
  console.log('📧 User email:', userEmail);
  console.log('🏢 Tenant ID:', tenantId);
  console.log('🎓 Student ID:', studentId);
  
  try {
    // 1. Verify tenant exists and is active
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .eq('status', 'active')
      .single();
    
    if (tenantError || !tenant) {
      return {
        success: false,
        error: `Tenant ${tenantId} not found or not active`
      };
    }
    
    console.log('✅ Tenant verified:', tenant.name);
    
    // 2. Verify student exists if provided
    if (studentId) {
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentId)
        .eq('tenant_id', tenantId)
        .single();
      
      if (studentError || !student) {
        return {
          success: false,
          error: `Student ${studentId} not found or not in tenant ${tenantId}`
        };
      }
      
      console.log('✅ Student verified:', student.name);
    }
    
    // 3. Update user record
    const updateData = {
      tenant_id: tenantId,
      role_id: 4, // Student role
      full_name: userEmail.split('@')[0] // Use email prefix if no name
    };
    
    if (studentId) {
      updateData.linked_student_id = studentId;
    }
    
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('email', userEmail)
      .select()
      .single();
    
    if (updateError) {
      console.error('❌ Update error:', updateError);
      return {
        success: false,
        error: `Failed to update user: ${updateError.message}`
      };
    }
    
    console.log('✅ User updated successfully:', updatedUser);
    
    return {
      success: true,
      data: {
        user: updatedUser,
        tenant: tenant,
        message: `User ${userEmail} successfully assigned to tenant ${tenant.name}${studentId ? ` and linked to student ${studentId}` : ''}`
      }
    };
    
  } catch (error) {
    console.error('❌ DEBUG: Error fixing user assignment:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export const createMissingUserRecord = async (authUserId, email, tenantId, studentId = null) => {
  console.log('🔧 DEBUG: Creating missing user record...');
  
  try {
    const userData = {
      id: authUserId,
      email: email,
      tenant_id: tenantId,
      role_id: 4, // Student role
      full_name: email.split('@')[0],
      linked_student_id: studentId,
      created_at: new Date().toISOString()
    };
    
    const { data: newUser, error } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single();
    
    if (error) {
      return {
        success: false,
        error: `Failed to create user record: ${error.message}`
      };
    }
    
    console.log('✅ User record created:', newUser);
    
    return {
      success: true,
      data: newUser,
      message: `User record created successfully for ${email}`
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

export const runCompleteDebug = async () => {
  console.log('🚀 DEBUG: Running complete tenant system debug...');
  
  const results = {
    currentUser: await debugCurrentUser(),
    allTenants: await debugAllTenants(),
    allStudents: await debugAllStudents()
  };
  
  console.log('📊 DEBUG: Complete debug results:', results);
  
  // Generate summary recommendations
  const summary = [];
  
  if (!results.currentUser.success) {
    summary.push('❌ Current user has issues - check authentication');
  } else if (!results.currentUser.data.canAccessStudentFeatures) {
    summary.push('❌ User cannot access student features - needs proper setup');
  } else {
    summary.push('✅ User setup appears correct for student access');
  }
  
  summary.push(`Found ${results.allTenants.data?.length || 0} tenants`);
  summary.push(`Found ${results.allStudents.data?.length || 0} students`);
  
  console.log('📋 DEBUG: Summary:', summary);
  
  return {
    ...results,
    summary
  };
};
