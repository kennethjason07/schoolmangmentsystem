import { supabase } from './supabase.js';

// Tenant Migration Utility Functions
export const tenantMigration = {
  
  /**
   * Check existing data structure and relationships
   */
  async analyzeExistingData() {
    try {
      console.log('🔍 Analyzing existing data structure...');
      
      const results = {};
      
      // Check users table
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, email, full_name, role_id, linked_student_id, linked_teacher_id, linked_parent_of, tenant_id')
        .limit(10);
      
      results.users = {
        count: users?.length || 0,
        sample: users || [],
        error: usersError,
        hasTenantsAssigned: users?.some(u => u.tenant_id) || false
      };
      
      // Check students table
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('id, name, class_id, tenant_id')
        .limit(10);
      
      results.students = {
        count: students?.length || 0,
        sample: students || [],
        error: studentsError,
        hasTenantsAssigned: students?.some(s => s.tenant_id) || false
      };
      
      // Check teachers table
      const { data: teachers, error: teachersError } = await supabase
        .from('teachers')
        .select('id, name, tenant_id')
        .limit(10);
      
      results.teachers = {
        count: teachers?.length || 0,
        sample: teachers || [],
        error: teachersError,
        hasTenantsAssigned: teachers?.some(t => t.tenant_id) || false
      };
      
      // Check classes table
      const { data: classes, error: classesError } = await supabase
        .from('classes')
        .select('id, class_name, section, tenant_id')
        .limit(10);
      
      results.classes = {
        count: classes?.length || 0,
        sample: classes || [],
        error: classesError,
        hasTenantsAssigned: classes?.some(c => c.tenant_id) || false
      };
      
      // Check parents table
      const { data: parents, error: parentsError } = await supabase
        .from('parents')
        .select('id, name, student_id, tenant_id')
        .limit(10);
      
      results.parents = {
        count: parents?.length || 0,
        sample: parents || [],
        error: parentsError,
        hasTenantsAssigned: parents?.some(p => p.tenant_id) || false
      };
      
      // Check if tenants table exists and has data
      const { data: tenants, error: tenantsError } = await supabase
        .from('tenants')
        .select('id, name, domain')
        .limit(5);
      
      results.tenants = {
        count: tenants?.length || 0,
        sample: tenants || [],
        error: tenantsError
      };
      
      console.log('📊 Data analysis complete:', results);
      return { success: true, data: results };
      
    } catch (error) {
      console.error('❌ Error analyzing data:', error);
      return { success: false, error };
    }
  },

  /**
   * Create a default tenant for existing data
   */
  async createDefaultTenant(tenantInfo = {}) {
    try {
      console.log('🏢 Creating default tenant...');
      
      const defaultTenant = {
        name: tenantInfo.name || 'Default School',
        domain: tenantInfo.domain || 'default.school.local',
        settings: {
          created_by_migration: true,
          migration_date: new Date().toISOString()
        },
        is_active: true,
        ...tenantInfo
      };
      
      const { data, error } = await supabase
        .from('tenants')
        .insert(defaultTenant)
        .select()
        .single();
      
      if (error) {
        console.error('❌ Error creating default tenant:', error);
        return { success: false, error };
      }
      
      console.log('✅ Default tenant created:', data);
      return { success: true, tenant: data };
      
    } catch (error) {
      console.error('❌ Error in createDefaultTenant:', error);
      return { success: false, error };
    }
  },

  /**
   * Migrate existing data to use tenant_id
   */
  async migrateExistingData(tenantId, options = {}) {
    try {
      console.log('🔄 Starting data migration to tenant:', tenantId);
      
      const {
        batchSize = 100,
        dryRun = false
      } = options;
      
      const migrationResults = {
        users: 0,
        students: 0,
        teachers: 0,
        classes: 0,
        parents: 0,
        errors: []
      };
      
      // Migrate users table
      console.log('📝 Migrating users...');
      try {
        const { data: usersToMigrate } = await supabase
          .from('users')
          .select('id')
          .is('tenant_id', null)
          .limit(batchSize);
        
        if (usersToMigrate && usersToMigrate.length > 0) {
          if (!dryRun) {
            const { error: usersError } = await supabase
              .from('users')
              .update({ tenant_id: tenantId })
              .is('tenant_id', null);
            
            if (usersError) throw usersError;
          }
          migrationResults.users = usersToMigrate.length;
          console.log(`✅ Migrated ${usersToMigrate.length} users`);
        }
      } catch (error) {
        console.error('❌ Error migrating users:', error);
        migrationResults.errors.push({ table: 'users', error });
      }
      
      // Migrate students table
      console.log('📝 Migrating students...');
      try {
        const { data: studentsToMigrate } = await supabase
          .from('students')
          .select('id')
          .is('tenant_id', null)
          .limit(batchSize);
        
        if (studentsToMigrate && studentsToMigrate.length > 0) {
          if (!dryRun) {
            const { error: studentsError } = await supabase
              .from('students')
              .update({ tenant_id: tenantId })
              .is('tenant_id', null);
            
            if (studentsError) throw studentsError;
          }
          migrationResults.students = studentsToMigrate.length;
          console.log(`✅ Migrated ${studentsToMigrate.length} students`);
        }
      } catch (error) {
        console.error('❌ Error migrating students:', error);
        migrationResults.errors.push({ table: 'students', error });
      }
      
      // Migrate teachers table
      console.log('📝 Migrating teachers...');
      try {
        const { data: teachersToMigrate } = await supabase
          .from('teachers')
          .select('id')
          .is('tenant_id', null)
          .limit(batchSize);
        
        if (teachersToMigrate && teachersToMigrate.length > 0) {
          if (!dryRun) {
            const { error: teachersError } = await supabase
              .from('teachers')
              .update({ tenant_id: tenantId })
              .is('tenant_id', null);
            
            if (teachersError) throw teachersError;
          }
          migrationResults.teachers = teachersToMigrate.length;
          console.log(`✅ Migrated ${teachersToMigrate.length} teachers`);
        }
      } catch (error) {
        console.error('❌ Error migrating teachers:', error);
        migrationResults.errors.push({ table: 'teachers', error });
      }
      
      // Migrate classes table
      console.log('📝 Migrating classes...');
      try {
        const { data: classesToMigrate } = await supabase
          .from('classes')
          .select('id')
          .is('tenant_id', null)
          .limit(batchSize);
        
        if (classesToMigrate && classesToMigrate.length > 0) {
          if (!dryRun) {
            const { error: classesError } = await supabase
              .from('classes')
              .update({ tenant_id: tenantId })
              .is('tenant_id', null);
            
            if (classesError) throw classesError;
          }
          migrationResults.classes = classesToMigrate.length;
          console.log(`✅ Migrated ${classesToMigrate.length} classes`);
        }
      } catch (error) {
        console.error('❌ Error migrating classes:', error);
        migrationResults.errors.push({ table: 'classes', error });
      }
      
      // Migrate parents table
      console.log('📝 Migrating parents...');
      try {
        const { data: parentsToMigrate } = await supabase
          .from('parents')
          .select('id')
          .is('tenant_id', null)
          .limit(batchSize);
        
        if (parentsToMigrate && parentsToMigrate.length > 0) {
          if (!dryRun) {
            const { error: parentsError } = await supabase
              .from('parents')
              .update({ tenant_id: tenantId })
              .is('tenant_id', null);
            
            if (parentsError) throw parentsError;
          }
          migrationResults.parents = parentsToMigrate.length;
          console.log(`✅ Migrated ${parentsToMigrate.length} parents`);
        }
      } catch (error) {
        console.error('❌ Error migrating parents:', error);
        migrationResults.errors.push({ table: 'parents', error });
      }
      
      // TODO: Add migration for other tables like:
      // - student_attendance
      // - teacher_attendance  
      // - student_fees
      // - exams, marks
      // - homeworks
      // - notifications
      // - tasks
      // - school_details
      // - school_expenses
      // - student_discounts
      
      console.log('✅ Migration completed:', migrationResults);
      return { success: true, results: migrationResults };
      
    } catch (error) {
      console.error('❌ Error in migrateExistingData:', error);
      return { success: false, error };
    }
  },

  /**
   * Update auth user metadata with tenant_id
   */
  async updateAuthUserMetadata(tenantId, userEmails = []) {
    try {
      console.log('👤 Updating auth user metadata with tenant_id...');
      
      // Note: This requires admin privileges or RPC function
      // Since we can't directly update auth.users metadata from client,
      // we'll create an RPC function for this
      
      const { data, error } = await supabase.rpc('update_user_tenant_metadata', {
        tenant_id: tenantId,
        user_emails: userEmails.length > 0 ? userEmails : null
      });
      
      if (error) {
        console.error('❌ Error updating user metadata:', error);
        return { success: false, error };
      }
      
      console.log('✅ User metadata updated:', data);
      return { success: true, data };
      
    } catch (error) {
      console.error('❌ Error in updateAuthUserMetadata:', error);
      return { success: false, error };
    }
  },

  /**
   * Complete migration workflow
   */
  async runCompleteMigration(tenantInfo = {}, options = {}) {
    try {
      console.log('🚀 Starting complete tenant migration...');
      
      const { dryRun = false } = options;
      
      // Step 1: Analyze existing data
      console.log('\n📊 Step 1: Analyzing existing data...');
      const analysisResult = await this.analyzeExistingData();
      if (!analysisResult.success) {
        return { success: false, error: 'Data analysis failed', details: analysisResult.error };
      }
      
      // Step 2: Create default tenant if none exists
      console.log('\n🏢 Step 2: Creating default tenant...');
      let defaultTenant;
      if (analysisResult.data.tenants.count === 0) {
        const tenantResult = await this.createDefaultTenant(tenantInfo);
        if (!tenantResult.success) {
          return { success: false, error: 'Failed to create default tenant', details: tenantResult.error };
        }
        defaultTenant = tenantResult.tenant;
      } else {
        defaultTenant = analysisResult.data.tenants.sample[0];
        console.log('✅ Using existing tenant:', defaultTenant.name);
      }
      
      // Step 3: Migrate existing data
      console.log('\n🔄 Step 3: Migrating existing data...');
      const migrationResult = await this.migrateExistingData(defaultTenant.id, { dryRun });
      if (!migrationResult.success) {
        return { success: false, error: 'Data migration failed', details: migrationResult.error };
      }
      
      // Step 4: Update auth user metadata (if possible)
      console.log('\n👤 Step 4: Updating auth metadata...');
      try {
        await this.updateAuthUserMetadata(defaultTenant.id);
      } catch (error) {
        console.warn('⚠️ Could not update auth metadata automatically:', error.message);
        console.log('💡 You may need to update auth user metadata manually or via admin panel');
      }
      
      console.log('\n✅ Complete migration finished successfully!');
      return {
        success: true,
        tenant: defaultTenant,
        analysis: analysisResult.data,
        migration: migrationResult.results
      };
      
    } catch (error) {
      console.error('❌ Error in runCompleteMigration:', error);
      return { success: false, error };
    }
  },

  /**
   * Verify migration success
   */
  async verifyMigration(tenantId) {
    try {
      console.log('🔍 Verifying migration results...');
      
      const verification = {};
      
      // Check users
      const { data: users } = await supabase
        .from('users')
        .select('id, tenant_id')
        .eq('tenant_id', tenantId);
      verification.users = users?.length || 0;
      
      // Check students
      const { data: students } = await supabase
        .from('students')
        .select('id, tenant_id')
        .eq('tenant_id', tenantId);
      verification.students = students?.length || 0;
      
      // Check teachers
      const { data: teachers } = await supabase
        .from('teachers')
        .select('id, tenant_id')
        .eq('tenant_id', tenantId);
      verification.teachers = teachers?.length || 0;
      
      // Check classes
      const { data: classes } = await supabase
        .from('classes')
        .select('id, tenant_id')
        .eq('tenant_id', tenantId);
      verification.classes = classes?.length || 0;
      
      // Check parents
      const { data: parents } = await supabase
        .from('parents')
        .select('id, tenant_id')
        .eq('tenant_id', tenantId);
      verification.parents = parents?.length || 0;
      
      console.log('📊 Migration verification:', verification);
      return { success: true, verification };
      
    } catch (error) {
      console.error('❌ Error verifying migration:', error);
      return { success: false, error };
    }
  }
};

// Helper function to create necessary RPC functions for migration
export const createMigrationRPCs = () => {
  return `
-- RPC function to update auth user metadata with tenant_id
CREATE OR REPLACE FUNCTION update_user_tenant_metadata(
  tenant_id UUID,
  user_emails TEXT[] DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INTEGER := 0;
  user_record RECORD;
BEGIN
  -- Update all users if no specific emails provided
  IF user_emails IS NULL THEN
    -- Update app_metadata for all auth users to include tenant_id
    UPDATE auth.users 
    SET app_metadata = COALESCE(app_metadata, '{}'::jsonb) || jsonb_build_object('tenant_id', tenant_id::text)
    WHERE app_metadata->>'tenant_id' IS NULL;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
  ELSE
    -- Update specific users by email
    FOR user_record IN 
      SELECT id FROM auth.users WHERE email = ANY(user_emails)
    LOOP
      UPDATE auth.users 
      SET app_metadata = COALESCE(app_metadata, '{}'::jsonb) || jsonb_build_object('tenant_id', tenant_id::text)
      WHERE id = user_record.id;
      
      updated_count := updated_count + 1;
    END LOOP;
  END IF;

  RETURN json_build_object('updated_count', updated_count, 'tenant_id', tenant_id);
END;
$$;

-- RPC function to set tenant context (if not already exists)
CREATE OR REPLACE FUNCTION set_tenant_context(tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- Set the tenant context for RLS policies
  PERFORM set_config('app.current_tenant_id', tenant_id::text, true);
END;
$$;
`;
};

export default tenantMigration;
