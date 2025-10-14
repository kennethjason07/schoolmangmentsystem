const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database table names
const TABLES = {
  USERS: 'users',
  ROLES: 'roles',
  PARENTS: 'parents',
  STUDENTS: 'students',
  CLASSES: 'classes'
};

// Test functions from supabase.js
async function testSearchParentAccounts(searchTerm = '') {
  console.log('🔍 Testing searchParentAccounts function...');
  
  try {
    // Get all parent role IDs since there might be multiple for different tenants
    const { data: parentRoles, error: roleError } = await supabase
      .from(TABLES.ROLES)
      .select('id')
      .eq('role_name', 'Parent');
    
    if (roleError || !parentRoles || parentRoles.length === 0) {
      console.error('❌ No parent roles found:', roleError);
      return { data: null, error: new Error('Parent role not found') };
    }
    
    const parentRoleIds = parentRoles.map(role => role.id);
    console.log('✅ Found parent role IDs:', parentRoleIds);
    
    // Build query to find parent users
    let query = supabase
      .from(TABLES.USERS)
      .select('id, email, full_name, phone')
      .in('role_id', parentRoleIds);
    
    // Add search filter if search term is provided
    if (searchTerm && searchTerm.trim()) {
      const trimmedTerm = searchTerm.trim();
      query = query.or(`email.ilike.%${trimmedTerm}%,full_name.ilike.%${trimmedTerm}%`);
    }
    
    const { data: parentUsers, error: userError } = await query;
    
    if (userError) {
      console.error('❌ Error searching parent accounts:', userError);
      return { data: null, error: userError };
    }
    
    console.log(`✅ Found ${parentUsers?.length || 0} parent users`);
    
    // For each parent, get their associated students
    const parentsWithStudents = await Promise.all(
      (parentUsers || []).map(async (parent) => {
        console.log(`🔍 Getting students for parent: ${parent.email}`);
        
        const { data: parentRecords, error: recordError } = await supabase
          .from(TABLES.PARENTS)
          .select(`
            id, relation, student_id,
            students!parents_student_id_fkey(id, name, admission_no, class_id, classes(class_name, section))
          `)
          .eq('email', parent.email);
        
        console.log(`📊 Parent ${parent.email} has ${parentRecords?.length || 0} student record(s)`);
        
        return {
          ...parent,
          linkedStudents: recordError ? [] : (parentRecords || []).map(record => ({
            ...record.students,
            relation: record.relation
          }))
        };
      })
    );
    
    console.log('✅ searchParentAccounts completed successfully');
    return { data: parentsWithStudents, error: null };
  } catch (error) {
    console.error('❌ Error in searchParentAccounts:', error);
    return { data: null, error };
  }
}

async function testGetParentRoleId() {
  console.log('🔍 Testing getParentRoleId function...');
  
  try {
    // Get all parent roles and use the first one found
    const { data: parentRoles, error: roleError } = await supabase
      .from(TABLES.ROLES)
      .select('id')
      .eq('role_name', 'Parent')
      .limit(1);
    
    if (roleError || !parentRoles || parentRoles.length === 0) {
      console.error('❌ Parent role not found:', roleError);
      return null;
    }
    
    console.log('✅ Parent role ID:', parentRoles[0].id);
    return parentRoles[0].id;
  } catch (error) {
    console.error('❌ Error getting parent role ID:', error);
    return null;
  }
}

async function testLinkParentToAdditionalStudent(parentEmail, studentId, relation = 'Guardian') {
  console.log('🔗 Testing linkParentToAdditionalStudent function...');
  console.log('🔗 Parameters:', { parentEmail, studentId, relation });
  
  try {
    const parentRoleId = await testGetParentRoleId();
    if (!parentRoleId) {
      throw new Error('Parent role not found');
    }
    
    console.log('🔗 Step 1: Finding parent user with email:', parentEmail);
    
    // 1. Find the existing parent user account
    const { data: existingParentUser, error: userError } = await supabase
      .from(TABLES.USERS)
      .select('id, email, full_name, phone, role_id, linked_parent_of, tenant_id')
      .eq('email', parentEmail)
      .eq('role_id', parentRoleId)
      .single();
    
    console.log('🔗 Step 1 Result:', { existingParentUser, userError });
    
    if (userError) {
      console.error('❌ Error finding parent user:', userError);
      throw new Error(`Parent account with email ${parentEmail} not found`);
    }
    
    console.log('✅ Step 2: Found existing parent user:', existingParentUser.full_name);
    
    // 2. Check if this student is already linked to this parent
    const { data: existingParentRecord, error: existingError } = await supabase
      .from(TABLES.PARENTS)
      .select('id')
      .eq('email', parentEmail)
      .eq('student_id', studentId)
      .maybeSingle();
    
    if (existingParentRecord) {
      throw new Error('This student is already linked to this parent account');
    }
    
    // Check if student exists
    const { data: currentStudent, error: currentStudentError } = await supabase
      .from(TABLES.STUDENTS)
      .select('parent_id, name, tenant_id')
      .eq('id', studentId)
      .single();
    
    if (currentStudentError) {
      console.error('❌ Error getting current student:', currentStudentError);
      throw new Error('Student not found');
    }
    
    console.log('✅ Step 3: Student found:', currentStudent.name, '- Tenant:', currentStudent.tenant_id);
    
    // 🔧 Validate tenant compatibility
    if (existingParentUser.tenant_id !== currentStudent.tenant_id) {
      console.error('❌ Tenant mismatch:', {
        parentTenant: existingParentUser.tenant_id,
        studentTenant: currentStudent.tenant_id
      });
      throw new Error(`Cannot link parent and student from different tenants. Parent tenant: ${existingParentUser.tenant_id}, Student tenant: ${currentStudent.tenant_id}`);
    }
    
    console.log('✅ Step 3.5: Tenant validation passed - both in tenant:', currentStudent.tenant_id);
    
    // 3. Create new parent record linking this parent to the additional student
    console.log('🔗 Step 4: Creating parent record for additional student');
    const parentRecordData = {
      name: existingParentUser.full_name,
      relation: relation,
      phone: existingParentUser.phone || '',
      email: existingParentUser.email,
      student_id: studentId,
      tenant_id: currentStudent.tenant_id  // 🔧 Include tenant_id
    };
    
    console.log('🔗 Parent record data:', parentRecordData);
    
    const { data: newParentRecord, error: parentRecordError } = await supabase
      .from(TABLES.PARENTS)
      .insert(parentRecordData)
      .select()
      .single();
    
    if (parentRecordError) {
      console.error('❌ Error creating parent record:', parentRecordError);
      throw parentRecordError;
    }
    
    console.log('✅ Step 5: Parent record created:', newParentRecord);
    
    // 4. Set the student's parent_id to link back to the parent record
    console.log('🔗 Step 6: Setting student parent_id');
    const { error: studentUpdateError } = await supabase
      .from(TABLES.STUDENTS)
      .update({ parent_id: newParentRecord.id })
      .eq('id', studentId);
    
    if (studentUpdateError) {
      console.error('❌ Error updating student parent_id:', studentUpdateError);
      console.log('⚠️ Warning: Parent record created but student parent_id not updated');
    } else {
      console.log('✅ Student parent_id updated successfully');
    }
    
    // 5. Set linked_parent_of if not already set
    if (!existingParentUser.linked_parent_of) {
      console.log('🔗 Step 7: Setting primary linked_parent_of');
      const { error: userUpdateError } = await supabase
        .from(TABLES.USERS)
        .update({ linked_parent_of: studentId })
        .eq('id', existingParentUser.id);
      
      if (userUpdateError) {
        console.error('❌ Error setting linked_parent_of:', userUpdateError);
      } else {
        console.log('✅ Primary linked_parent_of set successfully');
      }
    }
    
    console.log('✅ Success! Parent linked to additional student');
    
    return {
      data: {
        parentUser: existingParentUser,
        parentRecord: newParentRecord,
        student: currentStudent
      },
      error: null
    };
  } catch (error) {
    console.error('❌ Error in linkParentToAdditionalStudent:', error);
    return { data: null, error };
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting Link Existing Parent Tests...\n');
  
  try {
    // Test 1: Search for parent accounts
    console.log('=== TEST 1: Search Parent Accounts ===');
    const searchResult = await testSearchParentAccounts();
    
    if (searchResult.error) {
      console.error('❌ Search test failed:', searchResult.error);
    } else {
      console.log('✅ Search test passed. Found', searchResult.data?.length || 0, 'parent accounts');
      
      // Show first few results
      if (searchResult.data && searchResult.data.length > 0) {
        console.log('📋 First few results:');
        searchResult.data.slice(0, 3).forEach((parent, index) => {
          console.log(`  ${index + 1}. ${parent.full_name} (${parent.email}) - ${parent.linkedStudents?.length || 0} students`);
        });
      }
    }
    
    console.log('\n=== TEST 2: Test with Specific Search Term ===');
    const specificSearchResult = await testSearchParentAccounts('parent');
    
    if (specificSearchResult.error) {
      console.error('❌ Specific search test failed:', specificSearchResult.error);
    } else {
      console.log('✅ Specific search test passed. Found', specificSearchResult.data?.length || 0, 'parent accounts with "parent" in name or email');
    }
    
    // Test 3: Link parent to student (you'll need to provide actual IDs)
    console.log('\n=== TEST 3: Link Parent to Student ===');
    console.log('⚠️ Skipping link test - requires actual parent email and student ID');
    console.log('   To test linking, uncomment the lines below and provide real values:');
    console.log('   // const linkResult = await testLinkParentToAdditionalStudent("parent@example.com", "student-id-here");');
    
    // Test with actual data from the database (same tenant)
    console.log('🔗 Testing with real data (same tenant)...');
    const parentEmail = 'zoomcomputerbhalki@gmail.com'; // Parent: Syed Gouse Mohiuddin Alvi
    const studentId = '84d2c479-58d8-4790-b0e6-a33d6dc7a9a4'; // Student: Mohammed Aman (same tenant)
    
    console.log(`Attempting to link parent ${parentEmail} to student ${studentId}`);
    const linkResult = await testLinkParentToAdditionalStudent(parentEmail, studentId, 'Guardian');
    
    if (linkResult.error) {
      console.error('❌ Link test failed:', linkResult.error);
    } else {
      console.log('✅ Link test passed:', linkResult.data);
    }
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
  
  console.log('\n🏁 Tests completed!');
  process.exit(0);
}

// Run the tests
runTests();