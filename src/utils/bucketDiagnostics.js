import { supabase } from './supabase';

/**
 * Comprehensive bucket diagnostics utility
 * Tests both profiles and chat-files buckets
 */

export const runBucketDiagnostics = async () => {
  const results = {
    timestamp: new Date().toISOString(),
    profiles: {},
    chatFiles: {},
    summary: {
      profilesWorking: false,
      chatFilesWorking: false,
      recommendations: []
    }
  };

  console.log('🔍 Starting bucket diagnostics...');

  // Test profiles bucket
  try {
    console.log('📋 Testing profiles bucket...');
    
    // Check if bucket exists
    const { data: profilesBucket, error: profilesBucketError } = await supabase.storage.listBuckets();
    const profilesBucketExists = profilesBucket?.find(b => b.id === 'profiles');
    
    results.profiles.bucketExists = !!profilesBucketExists;
    results.profiles.bucketPublic = profilesBucketExists?.public || false;
    results.profiles.bucketError = profilesBucketError?.message || null;
    
    // Test upload to profiles bucket
    try {
      const testBlob = new Blob(['test'], { type: 'text/plain' });
      const testPath = `test_${Date.now()}.txt`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(testPath, testBlob);
        
      results.profiles.canUpload = !uploadError;
      results.profiles.uploadError = uploadError?.message || null;
      
      if (!uploadError) {
        // Test public URL generation
        const { data: { publicUrl } } = supabase.storage
          .from('profiles')
          .getPublicUrl(testPath);
          
        results.profiles.publicUrl = publicUrl;
        results.profiles.canGenerateUrl = !!publicUrl;
        
        // Test URL accessibility
        try {
          const urlResponse = await fetch(publicUrl, { method: 'HEAD' });
          results.profiles.urlAccessible = urlResponse.ok;
          results.profiles.urlStatusCode = urlResponse.status;
        } catch (urlError) {
          results.profiles.urlAccessible = false;
          results.profiles.urlError = urlError.message;
        }
        
        // Clean up test file
        try {
          await supabase.storage.from('profiles').remove([testPath]);
          results.profiles.canDelete = true;
        } catch (deleteError) {
          results.profiles.canDelete = false;
          results.profiles.deleteError = deleteError.message;
        }
      }
    } catch (uploadTestError) {
      results.profiles.canUpload = false;
      results.profiles.uploadError = uploadTestError.message;
    }
    
    results.summary.profilesWorking = results.profiles.bucketExists && 
                                     results.profiles.canUpload && 
                                     results.profiles.canGenerateUrl;
    
  } catch (profilesError) {
    results.profiles.error = profilesError.message;
    console.error('❌ Profiles bucket test failed:', profilesError);
  }

  // Test chat-files bucket
  try {
    console.log('💬 Testing chat-files bucket...');
    
    // Check if bucket exists
    const { data: chatFilesBucket, error: chatFilesBucketError } = await supabase.storage.listBuckets();
    const chatFilesBucketExists = chatFilesBucket?.find(b => b.id === 'chat-files');
    
    results.chatFiles.bucketExists = !!chatFilesBucketExists;
    results.chatFiles.bucketPublic = chatFilesBucketExists?.public || false;
    results.chatFiles.bucketError = chatFilesBucketError?.message || null;
    
    // Test upload to chat-files bucket
    try {
      const testBlob = new Blob(['test chat file'], { type: 'text/plain' });
      const testPath = `test_${Date.now()}.txt`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('chat-files')
        .upload(testPath, testBlob);
        
      results.chatFiles.canUpload = !uploadError;
      results.chatFiles.uploadError = uploadError?.message || null;
      
      if (!uploadError) {
        // Test public URL generation
        const { data: { publicUrl } } = supabase.storage
          .from('chat-files')
          .getPublicUrl(testPath);
          
        results.chatFiles.publicUrl = publicUrl;
        results.chatFiles.canGenerateUrl = !!publicUrl;
        
        // Test URL accessibility
        try {
          const urlResponse = await fetch(publicUrl, { method: 'HEAD' });
          results.chatFiles.urlAccessible = urlResponse.ok;
          results.chatFiles.urlStatusCode = urlResponse.status;
        } catch (urlError) {
          results.chatFiles.urlAccessible = false;
          results.chatFiles.urlError = urlError.message;
        }
        
        // Clean up test file
        try {
          await supabase.storage.from('chat-files').remove([testPath]);
          results.chatFiles.canDelete = true;
        } catch (deleteError) {
          results.chatFiles.canDelete = false;
          results.chatFiles.deleteError = deleteError.message;
        }
      }
    } catch (uploadTestError) {
      results.chatFiles.canUpload = false;
      results.chatFiles.uploadError = uploadTestError.message;
    }
    
    results.summary.chatFilesWorking = results.chatFiles.bucketExists && 
                                      results.chatFiles.canUpload && 
                                      results.chatFiles.canGenerateUrl;
    
  } catch (chatFilesError) {
    results.chatFiles.error = chatFilesError.message;
    console.error('❌ Chat-files bucket test failed:', chatFilesError);
  }

  // Generate recommendations
  if (!results.summary.profilesWorking) {
    if (!results.profiles.bucketExists) {
      results.summary.recommendations.push('❌ Profiles bucket does not exist - run setup_profile_storage.sql');
    } else if (!results.profiles.canUpload) {
      results.summary.recommendations.push('❌ Cannot upload to profiles bucket - check RLS policies');
    }
  } else {
    results.summary.recommendations.push('✅ Profiles bucket is working correctly');
  }

  if (!results.summary.chatFilesWorking) {
    if (!results.chatFiles.bucketExists) {
      results.summary.recommendations.push('❌ Chat-files bucket does not exist - run setup_chat_files_bucket_simple.sql');
    } else if (!results.chatFiles.canUpload) {
      results.summary.recommendations.push('❌ Cannot upload to chat-files bucket - check RLS policies');
    }
  } else {
    results.summary.recommendations.push('✅ Chat-files bucket is working correctly');
  }

  console.log('🔍 Bucket diagnostics completed:', results);
  return results;
};

export const formatBucketDiagnosticResults = (results) => {
  const lines = [
    `🔍 BUCKET DIAGNOSTICS REPORT`,
    `Timestamp: ${results.timestamp}`,
    ``,
    `📋 PROFILES BUCKET:`,
    `  Exists: ${results.profiles.bucketExists ? '✅' : '❌'}`,
    `  Public: ${results.profiles.bucketPublic ? '✅' : '❌'}`,
    `  Can Upload: ${results.profiles.canUpload ? '✅' : '❌'}`,
    `  Can Generate URL: ${results.profiles.canGenerateUrl ? '✅' : '❌'}`,
    `  URL Accessible: ${results.profiles.urlAccessible ? '✅' : '❌'}`,
  ];

  if (results.profiles.uploadError) {
    lines.push(`  Upload Error: ${results.profiles.uploadError}`);
  }
  if (results.profiles.urlError) {
    lines.push(`  URL Error: ${results.profiles.urlError}`);
  }

  lines.push(
    ``,
    `💬 CHAT-FILES BUCKET:`,
    `  Exists: ${results.chatFiles.bucketExists ? '✅' : '❌'}`,
    `  Public: ${results.chatFiles.bucketPublic ? '✅' : '❌'}`,
    `  Can Upload: ${results.chatFiles.canUpload ? '✅' : '❌'}`,
    `  Can Generate URL: ${results.chatFiles.canGenerateUrl ? '✅' : '❌'}`,
    `  URL Accessible: ${results.chatFiles.urlAccessible ? '✅' : '❌'}`,
  );

  if (results.chatFiles.uploadError) {
    lines.push(`  Upload Error: ${results.chatFiles.uploadError}`);
  }
  if (results.chatFiles.urlError) {
    lines.push(`  URL Error: ${results.chatFiles.urlError}`);
  }

  lines.push(
    ``,
    `📋 SUMMARY:`,
    `  Profiles Working: ${results.summary.profilesWorking ? '✅' : '❌'}`,
    `  Chat-Files Working: ${results.summary.chatFilesWorking ? '✅' : '❌'}`,
    ``,
    `🛠️ RECOMMENDATIONS:`
  );

  results.summary.recommendations.forEach(rec => {
    lines.push(`  ${rec}`);
  });

  return lines.join('\n');
};
