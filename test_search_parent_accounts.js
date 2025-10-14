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

// Mock the searchParentAccounts function from dbHelpers
async function searchParentAccounts(searchTerm) {
  try {
    console.log('🔍 Searching for parent accounts with term:', searchTerm);
    
    // Step 1: Get parent role ID first
    console.log('📋 Step 1: Getting parent role ID...');
    const { data: parentRole, error: roleError } = await supabase
      .from(TABLES.ROLES)
      .select('id')
      .eq('role_name', 'Parent')
      .single();
    
    if (roleError) {
      console.error('❌ Error getting parent role:', roleError);
      throw new Error('Parent role not found');
    }
    
    const parentRoleId = parentRole.id;
    console.log('✅ Parent role ID:', parentRoleId);
    
    // Step 2: Search for parent users
    console.log('📋 Step 2: Searching parent users...');
    const { data: parentUsers, error: userError } = await supabase
      .from(TABLES.USERS)
      .select('id, email, full_name, phone')
      .eq('role_id', parentRoleId)
      .or(`email.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%`);
    
    console.log('📊 Search result:', { 
      found: parentUsers?.length || 0, 
      error: userError?.message,
      users: parentUsers?.map(u => ({ email: u.email, name: u.full_name }))
    });
    
    if (userError) {
      console.error('❌ Error searching parent accounts:', userError);
      throw userError;
    }
    
    // Step 3: For each parent, get their associated students
    console.log('📋 Step 3: Getting associated students for each parent...');
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
        
        console.log(`📊 Parent ${parent.email} records:`, {
          found: parentRecords?.length || 0,
          error: recordError?.message,
          records: parentRecords?.map(r => ({ 
            studentName: r.students?.name, 
            relation: r.relation 
          }))
        });
        
        return {
          ...parent,
          linkedStudents: recordError ? [] : (parentRecords || []).map(record => ({
            ...record.students,
            relation: record.relation
          }))
        };
      })
    );
    
    console.log('✅ Final result:', parentsWithStudents.map(p => ({
      email: p.email,
      name: p.full_name,
      linkedStudentsCount: p.linkedStudents.length
    })));
    
    return { data: parentsWithStudents, error: null };
  } catch (error) {
    console.error('❌ Error in searchParentAccounts:', error);
    return { data: null, error };
  }
}

async function testSearchParentAccounts() {
  console.log('🧪 TESTING SEARCH PARENT ACCOUNTS FUNCTION...\n');

  try {
    // Test 1: Search with a common term
    console.log('='.repeat(60));
    console.log('TEST 1: Searching with empty term (should return all parents)');
    console.log('='.repeat(60));
    const result1 = await searchParentAccounts('');
    
    // Test 2: Search with a specific email
    console.log('\n' + '='.repeat(60));
    console.log('TEST 2: Searching with specific email');
    console.log('='.repeat(60));
    const result2 = await searchParentAccounts('gmail.com');
    
    // Test 3: Search with a name
    console.log('\n' + '='.repeat(60));
    console.log('TEST 3: Searching with name pattern');
    console.log('='.repeat(60));
    const result3 = await searchParentAccounts('parent');
    
    // Test 4: Search with exact email if we know one
    console.log('\n' + '='.repeat(60));
    console.log('TEST 4: Searching with exact email');
    console.log('='.repeat(60));
    const result4 = await searchParentAccounts('arshadpatel1431@gmail.com');

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 SUMMARY');
    console.log('='.repeat(60));
    console.log('Test 1 (empty):', result1.error ? 'FAILED' : `PASSED (${result1.data?.length} results)`);
    console.log('Test 2 (gmail.com):', result2.error ? 'FAILED' : `PASSED (${result2.data?.length} results)`);
    console.log('Test 3 (parent):', result3.error ? 'FAILED' : `PASSED (${result3.data?.length} results)`);
    console.log('Test 4 (exact email):', result4.error ? 'FAILED' : `PASSED (${result4.data?.length} results)`);

    // Check if we have ANY results
    const anyResults = [result1, result2, result3, result4].some(r => !r.error && r.data && r.data.length > 0);
    
    if (anyResults) {
      console.log('\n✅ GOOD NEWS: The searchParentAccounts function IS working!');
      console.log('   The issue might be in how the LinkExistingParent screen is calling it.');
    } else {
      console.log('\n❌ ISSUE FOUND: searchParentAccounts is not returning any results');
      console.log('   This could be due to:');
      console.log('   1. RLS (Row Level Security) policies blocking access');
      console.log('   2. No parent accounts exist in the expected format');
      console.log('   3. Role ID mismatch');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
if (require.main === module) {
  testSearchParentAccounts().then(() => {
    console.log('\n🏁 Test complete');
    process.exit(0);
  }).catch(err => {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  });
}

module.exports = { testSearchParentAccounts, searchParentAccounts };