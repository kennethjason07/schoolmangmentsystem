/**
 * Debug utility to test ManageTeachers tenant functionality
 * Tests that the email-based tenant system works for teachers data
 */

import { getCurrentUserTenantByEmail } from './getTenantByEmail';
import { supabase, TABLES } from './supabase';

export const testManageTeachersTenant = async () => {
  console.log('🧪 TEACHERS TEST: Starting manage teachers tenant test...');
  
  try {
    // Step 1: Get tenant via email
    console.log('🧪 TEACHERS TEST: Step 1 - Getting tenant via email...');
    const tenantResult = await getCurrentUserTenantByEmail();
    
    if (!tenantResult.success) {
      console.error('🧪 TEACHERS TEST: ❌ Failed to get tenant via email:', tenantResult.error);
      return {
        success: false,
        error: `Tenant lookup failed: ${tenantResult.error}`
      };
    }
    
    const { tenantId, tenant } = tenantResult.data;
    console.log('🧪 TEACHERS TEST: ✅ Tenant found:', {
      id: tenantId,
      name: tenant.name,
      status: tenant.status
    });
    
    // Step 2: Test teachers query with tenant filter
    console.log('🧪 TEACHERS TEST: Step 2 - Testing teachers query...');
    const { data: teachers, error: teachersError } = await supabase
      .from(TABLES.TEACHERS)
      .select(`
        *,
        users(
          id,
          full_name,
          email,
          phone,
          profile_url
        )
      `)
      .eq('tenant_id', tenantId)
      .limit(5);
    
    if (teachersError) {
      console.error('🧪 TEACHERS TEST: ❌ Teachers query failed:', teachersError);
      return {
        success: false,
        error: `Teachers query failed: ${teachersError.message}`
      };
    }
    
    console.log('🧪 TEACHERS TEST: ✅ Teachers query successful:', {
      count: teachers?.length || 0,
      teachers: teachers?.map(t => ({ id: t.id, name: t.name, tenant_id: t.tenant_id })) || []
    });
    
    // Step 3: Test classes query with tenant filter
    console.log('🧪 TEACHERS TEST: Step 3 - Testing classes query...');
    const { data: classes, error: classesError } = await supabase
      .from(TABLES.CLASSES)
      .select('*')
      .eq('tenant_id', tenantId)
      .limit(5);
    
    if (classesError) {
      console.error('🧪 TEACHERS TEST: ❌ Classes query failed:', classesError);
      return {
        success: false,
        error: `Classes query failed: ${classesError.message}`
      };
    }
    
    console.log('🧪 TEACHERS TEST: ✅ Classes query successful:', {
      count: classes?.length || 0,
      classes: classes?.map(c => ({ id: c.id, class_name: c.class_name, section: c.section })) || []
    });
    
    // Step 4: Test subjects query with tenant filter
    console.log('🧪 TEACHERS TEST: Step 4 - Testing subjects query...');
    const { data: subjects, error: subjectsError } = await supabase
      .from(TABLES.SUBJECTS)
      .select('*')
      .eq('tenant_id', tenantId)
      .limit(5);
    
    if (subjectsError) {
      console.error('🧪 TEACHERS TEST: ❌ Subjects query failed:', subjectsError);
      return {
        success: false,
        error: `Subjects query failed: ${subjectsError.message}`
      };
    }
    
    console.log('🧪 TEACHERS TEST: ✅ Subjects query successful:', {
      count: subjects?.length || 0,
      subjects: subjects?.map(s => ({ id: s.id, name: s.name, class_id: s.class_id })) || []
    });
    
    // Step 5: Test teacher-subject assignments query
    console.log('🧪 TEACHERS TEST: Step 5 - Testing teacher-subject assignments...');
    const { data: assignments, error: assignmentsError } = await supabase
      .from(TABLES.TEACHER_SUBJECTS)
      .select(`
        *,
        subjects(id, name, class_id)
      `)
      .eq('tenant_id', tenantId)
      .limit(5);
    
    if (assignmentsError) {
      console.error('🧪 TEACHERS TEST: ❌ Teacher-subject assignments query failed:', assignmentsError);
      return {
        success: false,
        error: `Assignments query failed: ${assignmentsError.message}`
      };
    }
    
    console.log('🧪 TEACHERS TEST: ✅ Teacher-subject assignments query successful:', {
      count: assignments?.length || 0,
      assignments: assignments?.map(a => ({ 
        id: a.id, 
        teacher_id: a.teacher_id, 
        subject_id: a.subject_id,
        subject_name: a.subjects?.name 
      })) || []
    });
    
    console.log('🧪 TEACHERS TEST: 🎉 All tests passed successfully!');
    
    return {
      success: true,
      data: {
        tenant: {
          id: tenantId,
          name: tenant.name,
          status: tenant.status
        },
        counts: {
          teachers: teachers?.length || 0,
          classes: classes?.length || 0,
          subjects: subjects?.length || 0,
          assignments: assignments?.length || 0
        },
        sampleData: {
          teachers: teachers?.slice(0, 2).map(t => ({ id: t.id, name: t.name })) || [],
          classes: classes?.slice(0, 2).map(c => ({ id: c.id, name: `${c.class_name} ${c.section}` })) || [],
          subjects: subjects?.slice(0, 2).map(s => ({ id: s.id, name: s.name })) || []
        }
      }
    };
    
  } catch (error) {
    console.error('🧪 TEACHERS TEST: Unexpected error:', error);
    return {
      success: false,
      error: `Unexpected error: ${error.message}`
    };
  }
};

export const runManageTeachersTest = async () => {
  const result = await testManageTeachersTenant();
  
  if (result.success) {
    console.log('🎉 MANAGE TEACHERS TEST PASSED:', result.data);
  } else {
    console.error('❌ MANAGE TEACHERS TEST FAILED:', result.error);
  }
  
  return result;
};
