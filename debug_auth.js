// Add this to your app to debug authentication
// You can run this in your UploadHomework.js component

import { supabase } from './src/utils/supabase';

// Add this function to check auth status
export const debugAuthStatus = async () => {
  try {
    console.log('🔍 Checking authentication status...');
    
    // Check current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('❌ Session error:', sessionError);
      return;
    }
    
    if (!session) {
      console.error('❌ No active session found');
      return;
    }
    
    console.log('✅ Session found:', {
      userId: session.user.id,
      email: session.user.email,
      role: session.user.role,
      isAnonymous: session.user.is_anonymous
    });
    
    // Test storage access
    console.log('🧪 Testing storage access...');
    
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Cannot list buckets:', bucketsError);
    } else {
      console.log('✅ Available buckets:', buckets.map(b => b.name));
      
      const homeworkBucket = buckets.find(b => b.id === 'homework-files');
      if (homeworkBucket) {
        console.log('✅ homework-files bucket found:', {
          id: homeworkBucket.id,
          name: homeworkBucket.name,
          public: homeworkBucket.public
        });
      } else {
        console.error('❌ homework-files bucket NOT found');
      }
    }
    
    // Test homework-files bucket specifically
    try {
      const { data: files, error: listError } = await supabase.storage
        .from('homework-files')
        .list('', { limit: 1 });
        
      if (listError) {
        console.error('❌ Cannot access homework-files bucket:', listError);
      } else {
        console.log('✅ homework-files bucket is accessible');
      }
    } catch (e) {
      console.error('❌ Exception accessing homework-files:', e);
    }
    
  } catch (error) {
    console.error('❌ Debug auth failed:', error);
  }
};

// Call this function in your app before uploading
// debugAuthStatus();
