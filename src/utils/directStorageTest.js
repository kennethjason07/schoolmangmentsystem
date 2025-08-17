import { supabase } from './supabase';

/**
 * Direct storage test that bypasses all our app logic
 * This helps isolate if the issue is in our code or Supabase itself
 */
export const runDirectStorageTest = async () => {
  console.log('🧪 Running direct storage test...');
  
  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    success: false,
    error: null
  };

  try {
    // Test 1: Simple text upload
    console.log('📝 Test 1: Simple text upload');
    const textBlob = new Blob(['Direct test content'], { type: 'text/plain' });
    const textFileName = `direct-test-${Date.now()}.txt`;
    
    const textUpload = await supabase.storage
      .from('chat-files')
      .upload(textFileName, textBlob);
    
    results.tests.push({
      name: 'Simple Text Upload',
      success: !textUpload.error,
      error: textUpload.error?.message || null,
      data: textUpload.data || null
    });

    // Test 2: Upload with options
    if (textUpload.error) {
      console.log('📝 Test 2: Upload with minimal options');
      const optionsFileName = `direct-options-test-${Date.now()}.txt`;
      
      const optionsUpload = await supabase.storage
        .from('chat-files')
        .upload(optionsFileName, textBlob, {
          upsert: false
        });
      
      results.tests.push({
        name: 'Upload with Options',
        success: !optionsUpload.error,
        error: optionsUpload.error?.message || null,
        data: optionsUpload.data || null
      });
    }

    // Test 3: Check storage client configuration
    console.log('🔧 Test 3: Storage client configuration');
    const storageConfig = {
      hasSupabaseClient: !!supabase,
      hasStorageMethod: !!supabase.storage,
      hasFromMethod: !!supabase.storage?.from,
      url: supabase.supabaseUrl?.substring(0, 50) + '...',
      storageEndpoint: supabase.supabaseUrl ? `${supabase.supabaseUrl}/storage/v1` : 'Unknown'
    };
    
    results.tests.push({
      name: 'Storage Client Configuration',
      success: storageConfig.hasSupabaseClient && storageConfig.hasStorageMethod && storageConfig.hasFromMethod,
      error: null,
      data: storageConfig
    });

    // Test 4: Auth token check
    console.log('🔑 Test 4: Auth token verification');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    results.tests.push({
      name: 'Auth Token Check',
      success: !!session?.access_token && !sessionError,
      error: sessionError?.message || (!session?.access_token ? 'No access token found' : null),
      data: {
        hasSession: !!session,
        hasAccessToken: !!session?.access_token,
        tokenLength: session?.access_token?.length || 0,
        userId: session?.user?.id?.substring(0, 8) + '...' || 'No user'
      }
    });

    // Test 5: Manual fetch to storage endpoint (bypass Supabase client)
    console.log('🌐 Test 5: Direct HTTP test to storage endpoint');
    try {
      const storageUrl = `${supabase.supabaseUrl}/storage/v1/object/chat-files/http-test-${Date.now()}.txt`;
      const accessToken = session?.access_token;
      
      if (accessToken) {
        const formData = new FormData();
        formData.append('', new Blob(['HTTP direct test'], { type: 'text/plain' }), 'http-test.txt');
        
        const httpResponse = await fetch(storageUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
          body: formData
        });

        const httpResponseData = await httpResponse.text();
        
        results.tests.push({
          name: 'Direct HTTP Storage Test',
          success: httpResponse.ok,
          error: httpResponse.ok ? null : `HTTP ${httpResponse.status}: ${httpResponseData}`,
          data: {
            status: httpResponse.status,
            statusText: httpResponse.statusText,
            response: httpResponseData.substring(0, 200)
          }
        });
      } else {
        results.tests.push({
          name: 'Direct HTTP Storage Test',
          success: false,
          error: 'No access token available for HTTP test',
          data: null
        });
      }
    } catch (httpError) {
      results.tests.push({
        name: 'Direct HTTP Storage Test',
        success: false,
        error: `HTTP test failed: ${httpError.message}`,
        data: null
      });
    }

    // Determine overall success
    results.success = results.tests.some(test => test.success);
    
    if (!results.success) {
      results.error = 'All storage tests failed';
    }

    console.log('🧪 Direct storage test completed:', results);
    return results;

  } catch (error) {
    console.error('💥 Direct storage test failed:', error);
    results.error = error.message;
    return results;
  }
};
