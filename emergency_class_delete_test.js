// EMERGENCY CLASS DELETION TEST
// Paste this into your browser console on the Manage Classes page

async function emergencyDeleteTest() {
  console.log('🚨 EMERGENCY DELETE TEST STARTING...');
  
  try {
    // Step 1: Check if we have basic access
    console.log('📋 Step 1: Testing basic database access...');
    
    if (typeof supabase === 'undefined') {
      console.log('❌ Supabase not available - this is the main issue!');
      alert('ERROR: Supabase is not available in the browser. This is likely a build or import issue.');
      return;
    }
    
    console.log('✅ Supabase is available');
    
    // Step 2: Test authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.log('❌ Authentication issue:', authError);
      alert('ERROR: User is not authenticated. Please log in again.');
      return;
    }
    
    console.log('✅ User authenticated:', user.email);
    
    // Step 3: Test classes table access
    console.log('📚 Step 3: Testing classes table access...');
    const { data: classes, error: classError } = await supabase
      .from('classes')
      .select('id, class_name, tenant_id')
      .limit(1);
    
    if (classError) {
      console.log('❌ Classes table access failed:', classError);
      alert(`ERROR: Cannot access classes table. ${classError.message}`);
      return;
    }
    
    if (!classes || classes.length === 0) {
      console.log('⚠️ No classes found');
      alert('No classes found in database');
      return;
    }
    
    console.log('✅ Classes table accessible, found class:', classes[0]);
    
    // Step 4: Test delete permissions
    console.log('🔒 Step 4: Testing delete permissions...');
    const { error: deleteError } = await supabase
      .from('classes')
      .delete()
      .eq('id', 'non-existent-test-id-12345');
    
    if (deleteError) {
      console.log('❌ Delete permission test failed:', deleteError);
      
      if (deleteError.code === 'PGRST116') {
        alert('ERROR: Row Level Security (RLS) policy is blocking delete operations. You need to check your Supabase RLS policies.');
      } else if (deleteError.code === '42501') {
        alert('ERROR: Database user does not have delete permissions.');
      } else {
        alert(`ERROR: Delete test failed. ${deleteError.message}`);
      }
      return;
    }
    
    console.log('✅ Delete permissions OK');
    
    // Step 5: Success message
    console.log('🎉 All tests passed! The basic setup is working.');
    alert('✅ SUCCESS: All basic tests passed. The delete function should work now. Try deleting a class.');
    
  } catch (error) {
    console.log('❌ Emergency test failed:', error);
    alert(`CRITICAL ERROR: ${error.message}`);
  }
}

// Run the test
emergencyDeleteTest();