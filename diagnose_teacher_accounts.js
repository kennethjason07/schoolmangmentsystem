/**
 * 🔍 TEACHER ACCOUNT DIAGNOSTIC TOOL
 * 
 * This script helps identify and fix teacher account creation issues:
 * 1. Authentication table vs Users table discrepancy
 * 2. Teacher-User linking problems
 * 3. Missing tenant_id associations
 */

const { createClient } = require('@supabase/supabase-js');

// Your Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY1NDYxMSwiZXhwIjoyMDY4MjMwNjExfQ.OZnmr5e_hxbAKu-5WmTDGFXrLqTgLNpNwY3uNqRjJGY';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function diagnoseTeacherAccounts() {
  console.log('🔍 DIAGNOSING TEACHER ACCOUNT SYSTEM...\n');
  
  try {
    // Step 1: Check auth.users vs public.users discrepancy
    console.log('1. 🔐 Checking Auth vs Users Table Discrepancy...');
    
    const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Error fetching auth users:', authError);
      return;
    }
    
    const { data: dbUsers, error: dbError } = await supabase
      .from('users')
      .select('id, email, full_name, role_id, linked_teacher_id, tenant_id');
    
    if (dbError) {
      console.error('❌ Error fetching database users:', dbError);
      return;
    }
    
    // Find users in auth but not in users table
    const authOnlyUsers = authUsers.filter(authUser => 
      !dbUsers.find(dbUser => dbUser.id === authUser.id)
    );
    
    console.log(`📊 Auth Users: ${authUsers.length}, DB Users: ${dbUsers.length}`);
    console.log(`🚨 Users in auth but NOT in users table: ${authOnlyUsers.length}`);
    
    if (authOnlyUsers.length > 0) {
      console.log('\n❌ AUTH-ONLY USERS (PROBLEM ACCOUNTS):');
      authOnlyUsers.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.email} (ID: ${user.id})`);
        console.log(`      Created: ${user.created_at}`);
        console.log(`      Email Confirmed: ${user.email_confirmed_at ? 'Yes' : 'No'}`);
        console.log(`      Metadata: ${JSON.stringify(user.raw_user_meta_data || {})}`);
      });
    }
    
    // Step 2: Check teacher-user linking
    console.log('\n2. 🔗 Checking Teacher-User Linking...');
    
    const { data: teachers, error: teachersError } = await supabase
      .from('teachers')
      .select('id, name, tenant_id');
    
    if (teachersError) {
      console.error('❌ Error fetching teachers:', teachersError);
      return;
    }
    
    console.log(`📊 Total Teachers: ${teachers.length}`);
    
    const teachersWithAccounts = [];
    const teachersWithoutAccounts = [];
    const problemTeachers = [];
    
    for (const teacher of teachers) {
      const linkedUsers = dbUsers.filter(user => user.linked_teacher_id === teacher.id);
      
      if (linkedUsers.length === 0) {
        teachersWithoutAccounts.push(teacher);
      } else if (linkedUsers.length === 1) {
        teachersWithAccounts.push({ teacher, user: linkedUsers[0] });
      } else {
        problemTeachers.push({ teacher, users: linkedUsers });
      }
    }
    
    console.log(`✅ Teachers with proper accounts: ${teachersWithAccounts.length}`);
    console.log(`❌ Teachers without accounts: ${teachersWithoutAccounts.length}`);
    console.log(`🚨 Teachers with multiple accounts: ${problemTeachers.length}`);
    
    // Step 3: Check specific teacher (Bheem Rao Patil)
    console.log('\n3. 🎯 Checking Specific Teacher: Bheem Rao Patil...');
    
    const bheemTeacher = teachers.find(t => 
      t.name.toLowerCase().includes('bheem') && 
      t.name.toLowerCase().includes('rao') && 
      t.name.toLowerCase().includes('patil')
    );
    
    if (bheemTeacher) {
      console.log(`✅ Found Bheem Rao Patil:`, bheemTeacher);
      
      const bheemUsers = dbUsers.filter(user => user.linked_teacher_id === bheemTeacher.id);
      const bheemAuthUsers = authUsers.filter(authUser => 
        bheemUsers.find(dbUser => dbUser.id === authUser.id)
      );
      
      console.log(`📋 Database users linked to Bheem: ${bheemUsers.length}`);
      console.log(`📋 Auth users for Bheem: ${bheemAuthUsers.length}`);
      
      bheemUsers.forEach((user, index) => {
        console.log(`   DB User ${index + 1}:`, {
          id: user.id,
          email: user.email,
          role_id: user.role_id,
          tenant_id: user.tenant_id
        });
      });
      
      bheemAuthUsers.forEach((user, index) => {
        console.log(`   Auth User ${index + 1}:`, {
          id: user.id,
          email: user.email,
          email_confirmed: user.email_confirmed_at ? 'Yes' : 'No'
        });
      });
    } else {
      console.log('❌ Bheem Rao Patil not found in teachers table');
    }
    
    // Step 4: Check tenant consistency
    console.log('\n4. 🏢 Checking Tenant Consistency...');
    
    const tenantIssues = [];
    
    teachersWithAccounts.forEach(({ teacher, user }) => {
      if (teacher.tenant_id !== user.tenant_id) {
        tenantIssues.push({ teacher, user });
      }
    });
    
    if (tenantIssues.length > 0) {
      console.log(`🚨 Tenant mismatches found: ${tenantIssues.length}`);
      tenantIssues.forEach(({ teacher, user }, index) => {
        console.log(`   ${index + 1}. Teacher: ${teacher.name}`);
        console.log(`      Teacher tenant: ${teacher.tenant_id}`);
        console.log(`      User tenant: ${user.tenant_id}`);
      });
    } else {
      console.log('✅ No tenant mismatches found');
    }
    
    // Step 5: Recommendations
    console.log('\n' + '='.repeat(80));
    console.log('💡 DIAGNOSIS SUMMARY & RECOMMENDATIONS:');
    console.log('='.repeat(80));
    
    if (authOnlyUsers.length > 0) {
      console.log('\n🚨 ISSUE: Users exist in auth.users but not in public.users');
      console.log('✅ SOLUTION: These users need proper user profiles created');
      console.log('📝 ACTION: Run the fixed createTeacherAccount function to recreate');
    }
    
    if (teachersWithoutAccounts.length > 0) {
      console.log('\n🚨 ISSUE: Teachers without user accounts');
      console.log('✅ SOLUTION: Create user accounts for these teachers');
      console.log('📝 ACTION: Use the Create Account button in Teacher Account Management');
    }
    
    if (problemTeachers.length > 0) {
      console.log('\n🚨 ISSUE: Teachers with multiple user accounts');
      console.log('✅ SOLUTION: Remove duplicate accounts and keep only the active one');
    }
    
    if (tenantIssues.length > 0) {
      console.log('\n🚨 ISSUE: Tenant ID mismatches between teachers and users');
      console.log('✅ SOLUTION: Update user records to match teacher tenant_id');
    }
    
    console.log('\n🔧 NEXT STEPS:');
    console.log('1. Use the fixed createTeacherAccount function');
    console.log('2. Clean up orphaned auth users');
    console.log('3. Fix tenant ID mismatches');
    console.log('4. Test the account creation process');
    
  } catch (error) {
    console.error('💥 Diagnostic failed:', error);
  }
}

// Function to fix a specific teacher account
async function fixTeacherAccount(teacherName, email) {
  console.log(`🔧 FIXING TEACHER ACCOUNT: ${teacherName} (${email})...`);
  
  try {
    // Find the teacher
    const { data: teacher, error: teacherError } = await supabase
      .from('teachers')
      .select('*')
      .ilike('name', `%${teacherName}%`)
      .single();
    
    if (teacherError || !teacher) {
      console.error('❌ Teacher not found:', teacherError);
      return;
    }
    
    console.log('✅ Teacher found:', teacher);
    
    // Check if auth user exists
    const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();
    const authUser = authUsers.find(u => u.email === email);
    
    if (authUser) {
      console.log('✅ Auth user exists:', authUser.id);
      
      // Create user profile if missing
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();
      
      if (!existingUser) {
        console.log('🔧 Creating missing user profile...');
        
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({
            id: authUser.id,
            email: email,
            full_name: teacher.name,
            role_id: 2, // Teacher role
            linked_teacher_id: teacher.id,
            tenant_id: teacher.tenant_id
          })
          .select()
          .single();
        
        if (createError) {
          console.error('❌ Failed to create user profile:', createError);
        } else {
          console.log('✅ User profile created:', newUser);
        }
      } else {
        console.log('✅ User profile already exists');
      }
    } else {
      console.log('❌ No auth user found - account needs to be created from scratch');
    }
    
  } catch (error) {
    console.error('💥 Fix failed:', error);
  }
}

// Run the diagnostic
diagnoseTeacherAccounts()
  .then(() => {
    console.log('\n🏁 Teacher account diagnosis completed');
    
    // Uncomment to fix specific teacher:
    // return fixTeacherAccount('bheem rao patil', 'bheem@example.com');
  })
  .catch(error => {
    console.error('💥 Fatal error:', error);
  });