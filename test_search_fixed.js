const { createClient } = require('@supabase/supabase-js');

// Your Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Mock the TABLES object
const TABLES = {
  USERS: 'users',
  PARENTS: 'parents',
  ROLES: 'roles'
};

// Updated searchParentAccounts function (matching the fixed version)
async function searchParentAccounts(searchTerm) {
  try {
    console.log('🔍 searchParentAccounts: Searching for:', searchTerm);
    
    // Get all parent role IDs since there might be multiple for different tenants
    const { data: parentRoles, error: roleError } = await supabase
      .from(TABLES.ROLES)
      .select('id')
      .eq('role_name', 'Parent');
    
    if (roleError || !parentRoles || parentRoles.length === 0) {
      console.error('❌ No parent roles found:', roleError);
      throw new Error('Parent role not found');
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
      throw userError;
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

async function testSearchFixed() {
  console.log('🧪 TESTING FIXED SEARCH PARENT ACCOUNTS FUNCTION...\n');

  try {
    // Test 1: Search with empty term (should return all parents)
    console.log('='.repeat(60));
    console.log('TEST 1: Searching with empty term (should return all parents)');
    console.log('='.repeat(60));
    const result1 = await searchParentAccounts('');
    
    // Test 2: Search with a common email domain
    console.log('\n' + '='.repeat(60));
    console.log('TEST 2: Searching with gmail.com');
    console.log('='.repeat(60));
    const result2 = await searchParentAccounts('gmail.com');
    
    // Test 3: Search with name pattern
    console.log('\n' + '='.repeat(60));
    console.log('TEST 3: Searching with "parent"');
    console.log('='.repeat(60));
    const result3 = await searchParentAccounts('parent');
    
    // Test 4: Search with exact email
    console.log('\n' + '='.repeat(60));
    console.log('TEST 4: Searching with exact email');
    console.log('='.repeat(60));
    const result4 = await searchParentAccounts('arshadpatel1431@gmail.com');

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 SUMMARY');
    console.log('='.repeat(60));
    console.log('Test 1 (empty):', result1.error ? `FAILED: ${result1.error.message}` : `PASSED (${result1.data?.length} results)`);
    console.log('Test 2 (gmail.com):', result2.error ? `FAILED: ${result2.error.message}` : `PASSED (${result2.data?.length} results)`);
    console.log('Test 3 (parent):', result3.error ? `FAILED: ${result3.error.message}` : `PASSED (${result3.data?.length} results)`);
    console.log('Test 4 (exact email):', result4.error ? `FAILED: ${result4.error.message}` : `PASSED (${result4.data?.length} results)`);

    // Check if we have ANY results
    const successfulResults = [result1, result2, result3, result4].filter(r => !r.error && r.data && r.data.length > 0);
    
    if (successfulResults.length > 0) {
      console.log('\n✅ EXCELLENT! The fixed searchParentAccounts function IS working!');
      console.log('   Sample results from successful tests:');
      successfulResults.forEach((result, index) => {
        console.log(`   Test result ${index + 1}:`);
        result.data.forEach((parent, i) => {
          console.log(`      ${i + 1}. ${parent.full_name} (${parent.email})`);
          console.log(`         Linked Students: ${parent.linkedStudents.length}`);
          parent.linkedStudents.forEach((student, j) => {
            console.log(`           - ${student.name} (${student.relation})`);
          });
        });
      });
      
      console.log('\n🎉 The LinkExistingParent screen should now work!');
    } else {
      console.log('\n❌ All tests failed - there might be a deeper issue with the data or RLS policies');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
if (require.main === module) {
  testSearchFixed().then(() => {
    console.log('\n🏁 Test complete');
    process.exit(0);
  }).catch(err => {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  });
}

module.exports = { testSearchFixed };