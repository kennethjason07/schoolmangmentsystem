import { supabase, authHelpers, dbHelpers, tenantHelpers } from './supabase.js';
import { tenantMigration } from './tenantMigration.js';

/**
 * Test utility to verify tenant migration success
 */
export const migrationTest = {
  
  /**
   * Test basic authentication flow
   */
  async testAuthFlow(email, password) {
    try {
      console.log('🔐 Testing auth flow for:', email);
      
      // Step 1: Sign in
      const { data: authResult, error: authError } = await authHelpers.signIn(email, password);
      if (authError) {
        console.error('❌ Auth failed:', authError.message);
        return { success: false, error: authError };
      }
      
      console.log('✅ Auth successful');
      
      // Step 2: Check tenant context
      const tenantId = await tenantHelpers.getCurrentTenantId();
      if (!tenantId) {
        console.warn('⚠️ No tenant ID found in user metadata');
        return { success: false, error: 'No tenant context' };
      }
      
      console.log('✅ Tenant context found:', tenantId);
      
      // Step 3: Test data access
      const { data: userData, error: userError } = await dbHelpers.getUserByEmail(email);
      if (userError) {
        console.error('❌ Failed to get user data:', userError.message);
        return { success: false, error: userError };
      }
      
      console.log('✅ User data accessible');
      
      // Step 4: Test tenant-filtered queries
      const { data: classes, error: classesError } = await dbHelpers.getClasses();
      const { data: students, error: studentsError } = await dbHelpers.read('students', {}, { selectClause: 'id, name' });
      const { data: teachers, error: teachersError } = await dbHelpers.read('teachers', {}, { selectClause: 'id, name' });
      
      console.log('📊 Data accessible:');
      console.log('- Classes:', classes?.length || 0);
      console.log('- Students:', students?.length || 0);  
      console.log('- Teachers:', teachers?.length || 0);
      
      return {
        success: true,
        user: authResult.user,
        tenantId,
        userData,
        dataAccess: {
          classes: classes?.length || 0,
          students: students?.length || 0,
          teachers: teachers?.length || 0
        }
      };
      
    } catch (error) {
      console.error('❌ Test failed:', error);
      return { success: false, error };
    }
  },
  
  /**
   * Verify migration results
   */
  async verifyMigrationSuccess() {
    try {
      console.log('🔍 Verifying migration success...');
      
      // Check if tenants exist
      const { data: tenants, error: tenantsError } = await supabase
        .from('tenants')
        .select('id, name, domain');
        
      if (tenantsError || !tenants || tenants.length === 0) {
        return { success: false, error: 'No tenants found' };
      }
      
      const defaultTenant = tenants.find(t => t.domain === 'default.school.local');
      if (!defaultTenant) {
        return { success: false, error: 'Default tenant not found' };
      }
      
      console.log('✅ Default tenant found:', defaultTenant.name);
      
      // Check data migration
      const verification = await tenantMigration.verifyMigration(defaultTenant.id);
      if (!verification.success) {
        return { success: false, error: 'Data verification failed', details: verification.error };
      }
      
      console.log('📊 Migration verification:', verification.verification);
      
      // Check auth user metadata (sample)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (session?.user) {
        const userTenantId = session.user.app_metadata?.tenant_id;
        if (userTenantId) {
          console.log('✅ Current user has tenant metadata:', userTenantId);
        } else {
          console.warn('⚠️ Current user missing tenant metadata');
        }
      }
      
      return {
        success: true,
        defaultTenant,
        verification: verification.verification,
        totalTenants: tenants.length
      };
      
    } catch (error) {
      console.error('❌ Verification failed:', error);
      return { success: false, error };
    }
  },
  
  /**
   * Test student data access
   */
  async testStudentDataAccess(studentEmail, password) {
    try {
      console.log('👨‍🎓 Testing student data access...');
      
      const authResult = await this.testAuthFlow(studentEmail, password);
      if (!authResult.success) {
        return authResult;
      }
      
      // Get student-specific data
      const { data: studentData, error: studentError } = await dbHelpers.getStudentByUserId(authResult.user.id);
      if (studentError) {
        console.error('❌ Failed to get student data:', studentError.message);
        return { success: false, error: studentError };
      }
      
      console.log('✅ Student data accessible:', studentData?.students?.name);
      
      // Test attendance access
      if (studentData?.students?.id) {
        const { data: attendance, error: attendanceError } = await dbHelpers.getStudentAttendance(studentData.students.id);
        console.log('📅 Attendance records:', attendance?.length || 0);
      }
      
      return {
        ...authResult,
        studentSpecific: {
          studentData: studentData?.students,
          classData: studentData?.students?.classes
        }
      };
      
    } catch (error) {
      console.error('❌ Student test failed:', error);
      return { success: false, error };
    }
  },
  
  /**
   * Test teacher data access
   */
  async testTeacherDataAccess(teacherEmail, password) {
    try {
      console.log('👨‍🏫 Testing teacher data access...');
      
      const authResult = await this.testAuthFlow(teacherEmail, password);
      if (!authResult.success) {
        return authResult;
      }
      
      // Get teacher-specific data
      const { data: teacherData, error: teacherError } = await dbHelpers.getTeacherByUserId(authResult.user.id);
      if (teacherError) {
        console.warn('⚠️ Teacher data not found (this might be normal):', teacherError.message);
      } else {
        console.log('✅ Teacher data accessible:', teacherData?.name);
      }
      
      return {
        ...authResult,
        teacherSpecific: {
          teacherData: teacherData
        }
      };
      
    } catch (error) {
      console.error('❌ Teacher test failed:', error);
      return { success: false, error };
    }
  },
  
  /**
   * Test parent data access
   */
  async testParentDataAccess(parentEmail, password) {
    try {
      console.log('👨‍👩‍👧‍👦 Testing parent data access...');
      
      const authResult = await this.testAuthFlow(parentEmail, password);
      if (!authResult.success) {
        return authResult;
      }
      
      // Get parent-specific data
      const { data: parentData, error: parentError } = await dbHelpers.getParentByUserId(authResult.user.id);
      if (parentError) {
        console.warn('⚠️ Parent data not found (this might be normal):', parentError.message);
      } else {
        console.log('✅ Parent data accessible - linked to student:', parentData?.students?.name);
      }
      
      return {
        ...authResult,
        parentSpecific: {
          linkedStudent: parentData?.students
        }
      };
      
    } catch (error) {
      console.error('❌ Parent test failed:', error);
      return { success: false, error };
    }
  },
  
  /**
   * Run comprehensive migration tests
   */
  async runComprehensiveTests(testAccounts = []) {
    try {
      console.log('🚀 Running comprehensive migration tests...');
      
      const results = {
        migrationVerification: null,
        authTests: []
      };
      
      // Step 1: Verify migration
      console.log('\n📊 Step 1: Verifying migration...');
      results.migrationVerification = await this.verifyMigrationSuccess();
      
      if (!results.migrationVerification.success) {
        console.error('❌ Migration verification failed');
        return { success: false, results };
      }
      
      // Step 2: Test auth flows for provided accounts
      if (testAccounts && testAccounts.length > 0) {
        console.log('\n🔐 Step 2: Testing auth flows...');
        
        for (const account of testAccounts) {
          const { email, password, role } = account;
          console.log(`\nTesting ${role} account: ${email}`);
          
          let testResult;
          switch (role) {
            case 'student':
              testResult = await this.testStudentDataAccess(email, password);
              break;
            case 'teacher':
              testResult = await this.testTeacherDataAccess(email, password);
              break;
            case 'parent':
              testResult = await this.testParentDataAccess(email, password);
              break;
            default:
              testResult = await this.testAuthFlow(email, password);
          }
          
          results.authTests.push({
            email,
            role,
            result: testResult
          });
        }
      }
      
      console.log('\n✅ Comprehensive tests completed!');
      return { success: true, results };
      
    } catch (error) {
      console.error('❌ Comprehensive tests failed:', error);
      return { success: false, error, results: {} };
    }
  },
  
  /**
   * Quick migration status check
   */
  async quickStatusCheck() {
    try {
      console.log('⚡ Quick migration status check...');
      
      // Check tenants
      const { data: tenants, error: tenantsError } = await supabase
        .from('tenants')
        .select('id, name, domain, created_at')
        .limit(5);
        
      // Check sample data with tenant_id
      const { data: usersWithTenant, error: usersError } = await supabase
        .from('users')
        .select('id, email, tenant_id')
        .not('tenant_id', 'is', null)
        .limit(5);
        
      const { data: studentsWithTenant, error: studentsError } = await supabase
        .from('students')
        .select('id, name, tenant_id')
        .not('tenant_id', 'is', null)
        .limit(5);
      
      const status = {
        tenants: {
          count: tenants?.length || 0,
          sample: tenants || [],
          error: tenantsError
        },
        usersWithTenant: {
          count: usersWithTenant?.length || 0,
          error: usersError
        },
        studentsWithTenant: {
          count: studentsWithTenant?.length || 0,
          error: studentsError
        },
        migrationComplete: tenants?.length > 0 && usersWithTenant?.length > 0
      };
      
      console.log('📊 Migration Status:');
      console.log('- Tenants:', status.tenants.count);
      console.log('- Users with tenant:', status.usersWithTenant.count);
      console.log('- Students with tenant:', status.studentsWithTenant.count);
      console.log('- Migration complete:', status.migrationComplete ? '✅' : '❌');
      
      return { success: true, status };
      
    } catch (error) {
      console.error('❌ Status check failed:', error);
      return { success: false, error };
    }
  }
};

export default migrationTest;
