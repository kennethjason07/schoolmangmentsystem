import { supabase } from './supabase';

/**
 * Diagnostic utilities for Supabase Storage
 */

/**
 * Check if the chat-files bucket exists and is accessible
 * @returns {Object} - Diagnostic results
 */
export const checkChatFilesBucket = async () => {
  console.log('🔍 Running chat-files bucket diagnostics...');
  
  const results = {
    bucketExists: false,
    bucketAccessible: false,
    publicAccess: false,
    error: null,
    details: []
  };

  try {
    // 1. Check if bucket exists by listing buckets
    console.log('📋 Checking if bucket exists...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Error listing buckets:', bucketsError);
      console.log('⚠️ ListBuckets failed, trying direct bucket access...');
      results.details.push(`⚠️ Cannot list buckets (${bucketsError.message}), trying direct access...`);
      
      // Try direct bucket access instead
      const { data: files, error: listError } = await supabase.storage
        .from('chat-files')
        .list('', { limit: 1 });
        
      if (!listError) {
        results.bucketExists = true;
        results.details.push(`✅ Bucket 'chat-files' exists (verified via direct access)`);
        results.details.push(`📊 Bucket is accessible for file operations`);
      } else {
        results.error = `Cannot access bucket: ${listError.message}`;
        results.details.push(`❌ Bucket access failed: ${listError.message}`);
        return results;
      }
    } else {
      console.log('📋 Available buckets:', buckets.map(b => b.name));
      
      const chatFilesBucket = buckets.find(bucket => bucket.name === 'chat-files');
      if (chatFilesBucket) {
        results.bucketExists = true;
        results.publicAccess = chatFilesBucket.public;
        results.details.push(`✅ Bucket 'chat-files' exists`);
        results.details.push(`📊 Public access: ${chatFilesBucket.public ? 'Yes' : 'No'}`);
      } else {
        results.details.push(`❌ Bucket 'chat-files' does not exist in bucket list`);
        
        // Try direct access as fallback
        console.log('🔍 Bucket not in list, trying direct access...');
        const { data: files, error: listError } = await supabase.storage
          .from('chat-files')
          .list('', { limit: 1 });
          
        if (!listError) {
          results.bucketExists = true;
          results.details.push(`✅ Bucket 'chat-files' exists (found via direct access)`);
        } else {
          results.details.push(`❌ Bucket 'chat-files' not accessible: ${listError.message}`);
          return results;
        }
      }
    }

    // 2. Test bucket accessibility by trying to list files
    console.log('🔍 Testing bucket accessibility...');
    const { data: files, error: listError } = await supabase.storage
      .from('chat-files')
      .list('', {
        limit: 1,
        offset: 0
      });

    if (listError) {
      console.error('❌ Error accessing bucket:', listError);
      results.details.push(`❌ Cannot access bucket: ${listError.message}`);
      results.error = listError.message;
    } else {
      results.bucketAccessible = true;
      results.details.push(`✅ Bucket is accessible`);
      results.details.push(`📁 Files in bucket: ${files ? files.length : 0}`);
    }

    // 3. Test upload capability with a small test file
    console.log('📤 Testing upload capability...');
    const testContent = new Blob(['test'], { type: 'text/plain' });
    const testFileName = `test/diagnostic_${Date.now()}.txt`;
    
    console.log('🔍 Upload details:', {
      fileName: testFileName,
      contentType: testContent.type,
      contentSize: testContent.size
    });
    
    console.log('🔧 Supabase client info:', {
      url: supabase.supabaseUrl?.substring(0, 50) + '...',
      hasKey: !!supabase.supabaseKey,
      storageUrl: supabase.supabaseUrl ? `${supabase.supabaseUrl}/storage/v1` : 'Unknown'
    });
    
    // Check current auth status
    const { data: { user: currentUser }, error: authCheckError } = await supabase.auth.getUser();
    console.log('🔐 Current auth status:', {
      isAuthenticated: !!currentUser,
      userId: currentUser?.id?.substring(0, 8) + '...',
      authError: authCheckError?.message
    });
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('chat-files')
      .upload(testFileName, testContent, {
        contentType: 'text/plain',
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('❌ Upload test failed:', uploadError);
      console.error('❌ Full upload error:', JSON.stringify(uploadError, null, 2));
      results.details.push(`❌ Upload test failed: ${uploadError.message}`);
      results.details.push(`❌ Error details: ${JSON.stringify(uploadError)}`);
      if (!results.error) results.error = uploadError.message;
      
      // Try alternative upload method
      console.log('🔄 Trying alternative upload method...');
      try {
        const altFileName = `test/alt_diagnostic_${Date.now()}.txt`;
        const { data: altUploadData, error: altUploadError } = await supabase.storage
          .from('chat-files')
          .upload(altFileName, testContent, {
            upsert: true
          });
          
        if (!altUploadError) {
          results.details.push(`✅ Alternative upload method worked!`);
          // Clean up alternative test file
          await supabase.storage.from('chat-files').remove([altFileName]);
        } else {
          results.details.push(`❌ Alternative upload also failed: ${altUploadError.message}`);
        }
      } catch (altError) {
        results.details.push(`❌ Alternative upload exception: ${altError.message}`);
      }
    } else {
      console.log('✅ Upload successful:', uploadData);
      results.details.push(`✅ Upload test successful`);
      
      // Clean up test file
      const { error: deleteError } = await supabase.storage
        .from('chat-files')
        .remove([testFileName]);
      
      if (deleteError) {
        results.details.push(`⚠️ Test file cleanup failed: ${deleteError.message}`);
      } else {
        results.details.push(`🧹 Test file cleaned up`);
      }
    }

  } catch (error) {
    console.error('💥 Unexpected error during diagnostics:', error);
    results.error = error.message;
    results.details.push(`💥 Unexpected error: ${error.message}`);
  }

  return results;
};

/**
 * Check network connectivity to Supabase
 * @returns {Object} - Network diagnostic results
 */
export const checkNetworkConnectivity = async () => {
  console.log('🌐 Checking network connectivity to Supabase...');
  
  const results = {
    supabaseReachable: false,
    authWorking: false,
    databaseWorking: false,
    error: null,
    details: []
  };

  try {
    // 1. Test basic connectivity by checking auth status
    console.log('🔐 Testing auth connectivity...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      results.details.push(`❌ Auth error: ${authError.message}`);
    } else {
      results.authWorking = true;
      results.details.push(`✅ Auth service working`);
      results.details.push(`👤 Current user: ${user ? user.email : 'Not logged in'}`);
    }

    // 2. Test database connectivity
    console.log('💾 Testing database connectivity...');
    const { data: testData, error: dbError } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (dbError) {
      results.details.push(`❌ Database error: ${dbError.message}`);
      results.error = dbError.message;
    } else {
      results.databaseWorking = true;
      results.supabaseReachable = true;
      results.details.push(`✅ Database service working`);
    }

  } catch (error) {
    console.error('💥 Network connectivity error:', error);
    results.error = error.message;
    results.details.push(`💥 Network error: ${error.message}`);
  }

  return results;
};

/**
 * Run complete diagnostics
 * @returns {Object} - Complete diagnostic results
 */
export const runCompleteDiagnostics = async () => {
  console.log('🚀 Running complete storage diagnostics...');
  
  const results = {
    timestamp: new Date().toISOString(),
    network: await checkNetworkConnectivity(),
    bucket: null
  };

  // Only check bucket if network is working
  if (results.network.supabaseReachable) {
    results.bucket = await checkChatFilesBucket();
  } else {
    results.bucket = {
      bucketExists: false,
      bucketAccessible: false,
      publicAccess: false,
      error: 'Cannot check bucket - network connectivity issues',
      details: ['❌ Skipped bucket check due to network issues']
    };
  }

  // Generate summary
  results.summary = {
    overallHealth: results.network.supabaseReachable && results.bucket.bucketAccessible,
    criticalIssues: [],
    recommendations: []
  };

  if (!results.network.supabaseReachable) {
    results.summary.criticalIssues.push('Network connectivity to Supabase failed');
    results.summary.recommendations.push('Check internet connection and Supabase URL/keys');
  }

  if (!results.bucket.bucketExists) {
    results.summary.criticalIssues.push('chat-files bucket does not exist');
    results.summary.recommendations.push('Create the chat-files bucket in Supabase Storage');
  }

  if (results.bucket.bucketExists && !results.bucket.bucketAccessible) {
    results.summary.criticalIssues.push('chat-files bucket is not accessible');
    results.summary.recommendations.push('Check bucket permissions and RLS policies');
  }

  console.log('📊 Diagnostics complete:', results.summary);
  return results;
};
