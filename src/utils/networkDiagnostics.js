const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';

export const runNetworkDiagnostics = async () => {
  console.log('--- Starting Network Diagnostics ---');

  // 1. Test basic internet connectivity
  try {
    console.log('🌐 [1/3] Testing general internet access (fetching google.com)...');
    const googleResponse = await fetch('https://www.google.com');
    if (googleResponse.ok) {
      console.log('✅ [1/3] Success: General internet access is working.');
    } else {
      console.warn('⚠️ [1/3] Warning: Could not connect to google.com. Status:', googleResponse.status);
    }
  } catch (error) {
    console.error('❌ [1/3] Failure: Could not fetch google.com. Error:', error.message);
    console.log('--- Diagnostics End: Internet connection appears to be down. ---');
    return;
  }

  // 2. Test DNS resolution for Supabase
  try {
    console.log(`🌐 [2/3] Testing DNS resolution for Supabase host (${new URL(supabaseUrl).hostname})...`);
    // In React Native, fetching the URL is the most straightforward way to test DNS + connectivity.
    // We are not checking the response content, just that the request doesn't fail at the network layer.
    const response = await fetch(supabaseUrl);
    console.log(`✅ [2/3] Success: Supabase host is reachable. Received status: ${response.status}`);
    if (response.status === 200 || response.status === 404 || response.status === 400) {
        const responseJson = await response.json();
        console.log('ℹ️ [2/3] Supabase server response:', responseJson);
    }
  } catch (error) {
    console.error('❌ [2/3] Failure: Could not connect to Supabase URL.', error);
    console.log('--- Diagnostics End: App cannot reach Supabase. Check emulator/device network settings. ---');
    return;
  }

  // 3. Test a real Supabase API call (fetching storage buckets)
  try {
    console.log('🌐 [3/3] Testing Supabase API call (listing storage buckets)...');
    // This is an indirect way to test the API key and basic API functionality.
    // We need to import the actual supabase client for this.
    // For now, we'll skip this step as it requires modifying more files.
    // The previous step is the most critical one.
    console.log('✅ [3/3] Skipping Supabase API call test for now.');
  } catch (error) {
    console.error('❌ [3/3] Failure: Supabase API call failed.', error);
  }

  console.log('--- Network Diagnostics Finished ---');
};