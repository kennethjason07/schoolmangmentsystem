const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database table names
const TABLES = {
  USERS: 'users',
  PARENTS: 'parents',
  STUDENTS: 'students'
};

async function testParentAccountStatusDetection() {
  console.log('🔍 Testing parent account status detection logic...\n');

  try {
    // Get the student we linked in our previous test
    const testStudentId = '84d2c479-58d8-4790-b0e6-a33d6dc7a9a4'; // Mohammed Aman
    const testParentEmail = 'zoomcomputerbhalki@gmail.com'; // Syed Gouse Mohiuddin Alvi
    
    console.log('📊 Testing with:');
    console.log('   Student ID:', testStudentId);
    console.log('   Parent Email:', testParentEmail);
    console.log('');

    // Get student info
    const { data: student, error: studentError } = await supabase
      .from(TABLES.STUDENTS)
      .select('id, name, tenant_id')
      .eq('id', testStudentId)
      .single();

    if (studentError) {
      console.error('❌ Error getting student:', studentError);
      return;
    }

    console.log('✅ Student found:', student.name);

    // Get parent records for this student
    const { data: parentRecords, error: parentRecordsError } = await supabase
      .from(TABLES.PARENTS)
      .select('id, name, relation, phone, email, student_id')
      .eq('student_id', testStudentId);

    if (parentRecordsError) {
      console.error('❌ Error getting parent records:', parentRecordsError);
      return;
    }

    console.log('📋 Parent records found:', parentRecords?.length || 0);
    parentRecords?.forEach((record, index) => {
      console.log(`   ${index + 1}. ${record.name} (${record.email}) - ${record.relation}`);
    });

    // Get existing parent accounts
    const { data: existingAccounts, error: accountsError } = await supabase
      .from(TABLES.USERS)
      .select('id, email, linked_parent_of, role_id, full_name')
      .not('linked_parent_of', 'is', null)
      .eq('tenant_id', student.tenant_id);

    if (accountsError) {
      console.error('❌ Error getting existing accounts:', accountsError);
      return;
    }

    console.log('\n👥 Existing parent accounts found:', existingAccounts?.length || 0);
    existingAccounts?.forEach((account, index) => {
      console.log(`   ${index + 1}. ${account.full_name} (${account.email}) - linked to: ${account.linked_parent_of}`);
    });

    // Apply the new logic
    console.log('\n🧮 Applying new detection logic:');

    const studentParentRecords = parentRecords?.filter(parent => 
      parent.student_id === student.id && 
      parent.name &&
      parent.name.trim() !== '' &&
      parent.name.toLowerCase() !== 'justus parent' &&
      parent.name.toLowerCase() !== 'n/a' &&
      !parent.name.toLowerCase().includes('placeholder') &&
      !parent.name.toLowerCase().includes('test') &&
      !parent.name.toLowerCase().includes('sample')
    ) || [];

    console.log('   📝 Valid parent records:', studentParentRecords.length);

    // Check direct parent account link
    const directParentAccount = existingAccounts?.find(account => account.linked_parent_of === student.id);
    console.log('   🔗 Direct parent account (linked_parent_of):', directParentAccount ? `${directParentAccount.full_name} (${directParentAccount.email})` : 'None');

    // Check indirect parent account link
    const indirectParentAccounts = existingAccounts?.filter(account => 
      studentParentRecords.some(parentRecord => 
        parentRecord.email && 
        parentRecord.email.toLowerCase() === account.email.toLowerCase()
      )
    ) || [];
    
    console.log('   🔗 Indirect parent accounts (via parent records):', indirectParentAccounts.length);
    indirectParentAccounts.forEach((account, index) => {
      console.log(`      ${index + 1}. ${account.full_name} (${account.email})`);
    });

    const hasParentAccount = !!(directParentAccount || indirectParentAccounts.length > 0);
    const parentAccountInfo = directParentAccount || indirectParentAccounts[0];
    const hasParentRecord = studentParentRecords.length > 0;

    let parentStatus = 'none';
    if (hasParentAccount && hasParentRecord) parentStatus = 'complete';
    else if (hasParentAccount && !hasParentRecord) parentStatus = 'account_only';
    else if (!hasParentAccount && hasParentRecord) parentStatus = 'record_only';

    console.log('\n🎯 RESULTS:');
    console.log('   hasParentAccount:', hasParentAccount);
    console.log('   hasParentRecord:', hasParentRecord);
    console.log('   parentStatus:', parentStatus);
    console.log('   parentAccountInfo:', parentAccountInfo ? `${parentAccountInfo.full_name} (${parentAccountInfo.email})` : 'None');

    console.log('\n✅ Expected behavior:');
    console.log('   - If student was successfully linked via "Link Existing"');
    console.log('   - parentStatus should be "complete" (has both account and record)');
    console.log('   - UI should show "Complete Setup" + "Link Another Parent"');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }

  process.exit(0);
}

testParentAccountStatusDetection();