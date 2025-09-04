const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = 'https://tbvkstucyjhohvbdqenq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRidmtzdHVjeWpob2h2YmRxZW5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA1MDI1NjEsImV4cCI6MjA0NjA3ODU2MX0.iGCMgqZGtJ4lfKOqy3z8Rlr_Ww-p1H4PKOBvEPhNBUk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugTeachersIssue() {
  console.log('🔍 Starting Teachers Debug...\n');

  try {
    // 1. Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('❌ Auth Error:', authError);
      return;
    }
    
    if (!user) {
      console.log('❌ No authenticated user found');
      return;
    }
    
    console.log('✅ Authenticated user:', user.email);
    console.log('   User ID:', user.id);

    // 2. Check user's tenant
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (userError) {
      console.error('❌ Error fetching user data:', userError);
      return;
    }

    console.log('\n📋 User Data:');
    console.log('   Tenant ID:', userData.tenant_id);
    console.log('   Full Name:', userData.full_name);
    console.log('   Role:', userData.role);

    if (!userData.tenant_id) {
      console.log('❌ User has no tenant_id assigned');
      return;
    }

    // 3. Check tenant exists
    const { data: tenantData, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', userData.tenant_id)
      .single();

    if (tenantError) {
      console.error('❌ Error fetching tenant data:', tenantError);
      return;
    }

    console.log('\n🏢 Tenant Data:');
    console.log('   Tenant ID:', tenantData.id);
    console.log('   Tenant Name:', tenantData.name);
    console.log('   Subdomain:', tenantData.subdomain);
    console.log('   Status:', tenantData.status);

    // 4. Check total teachers in database
    const { count: totalTeachers, error: totalError } = await supabase
      .from('teachers')
      .select('*', { count: 'exact', head: true });

    if (totalError) {
      console.error('❌ Error counting total teachers:', totalError);
    } else {
      console.log('\n📊 Database Stats:');
      console.log('   Total Teachers (all tenants):', totalTeachers);
    }

    // 5. Check teachers for this specific tenant
    const { data: tenantTeachers, error: tenantTeachersError } = await supabase
      .from('teachers')
      .select('*')
      .eq('tenant_id', userData.tenant_id);

    if (tenantTeachersError) {
      console.error('❌ Error fetching teachers for tenant:', tenantTeachersError);
      return;
    }

    console.log('\n👨‍🏫 Teachers for your tenant:');
    console.log('   Count:', tenantTeachers?.length || 0);
    
    if (tenantTeachers && tenantTeachers.length > 0) {
      console.log('   Teachers:');
      tenantTeachers.forEach((teacher, index) => {
        console.log(`     ${index + 1}. ${teacher.name} (ID: ${teacher.id})`);
      });
    }

    // 6. Check classes for this tenant
    const { data: tenantClasses, error: classesError } = await supabase
      .from('classes')
      .select('*')
      .eq('tenant_id', userData.tenant_id);

    if (classesError) {
      console.error('❌ Error fetching classes:', classesError);
    } else {
      console.log('\n📚 Classes for your tenant:');
      console.log('   Count:', tenantClasses?.length || 0);
      if (tenantClasses && tenantClasses.length > 0) {
        tenantClasses.forEach((cls, index) => {
          console.log(`     ${index + 1}. ${cls.class_name} (${cls.section || 'No Section'})`);
        });
      }
    }

    // 7. Check subjects for this tenant
    const { data: tenantSubjects, error: subjectsError } = await supabase
      .from('subjects')
      .select('*')
      .eq('tenant_id', userData.tenant_id);

    if (subjectsError) {
      console.error('❌ Error fetching subjects:', subjectsError);
    } else {
      console.log('\n📖 Subjects for your tenant:');
      console.log('   Count:', tenantSubjects?.length || 0);
      if (tenantSubjects && tenantSubjects.length > 0) {
        tenantSubjects.forEach((subject, index) => {
          console.log(`     ${index + 1}. ${subject.name}`);
        });
      }
    }

    // 8. Test RLS by trying to query without tenant filter
    console.log('\n🔒 Testing RLS (should return empty or error):');
    const { data: rlsTest, error: rlsError } = await supabase
      .from('teachers')
      .select('count', { count: 'exact', head: true });

    if (rlsError) {
      console.log('   ✅ RLS is working (got error):', rlsError.message);
    } else {
      console.log('   ⚠️ RLS might not be working properly. Got count:', rlsTest);
    }

    // 9. Recommendations
    console.log('\n💡 Recommendations:');
    
    if (!tenantTeachers || tenantTeachers.length === 0) {
      console.log('   • No teachers found for your tenant');
      console.log('   • You need to create teachers for your tenant');
      console.log('   • Use the "Add Teacher" button in the Manage Teachers screen');
    }

    if (!tenantClasses || tenantClasses.length === 0) {
      console.log('   • No classes found for your tenant');
      console.log('   • Create classes first in "Manage Classes" screen');
    }

    if (!tenantSubjects || tenantSubjects.length === 0) {
      console.log('   • No subjects found for your tenant');
      console.log('   • Create subjects in "Subjects & Timetable" screen');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the debug function
debugTeachersIssue().then(() => {
  console.log('\n✅ Debug complete!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Debug failed:', error);
  process.exit(1);
});
