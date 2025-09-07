import { supabase } from './supabase';
import { getSchoolLogoBase64 } from './logoUtils';

/**
 * Test utility to diagnose logo loading issues
 */
export const runLogoTests = async () => {
  console.log('🔍 === LOGO DIAGNOSTIC TESTS ===');
  
  try {
    // Test 1: Check school_details table
    console.log('📊 Test 1: Checking school_details table...');
    const { data: schoolData, error: schoolError } = await supabase
      .from('school_details')
      .select('*')
      .limit(1);
    
    if (schoolError) {
      console.error('❌ Error fetching school data:', schoolError);
      return;
    }
    
    if (!schoolData || schoolData.length === 0) {
      console.log('⚠️ No school data found');
      return;
    }
    
    const school = schoolData[0];
    console.log('✅ School found:', school.name);
    console.log('🔗 Logo URL:', school.logo_url);
    console.log('📏 Logo URL length:', school.logo_url?.length || 0);
    
    if (!school.logo_url) {
      console.log('❌ No logo URL found in database');
      return;
    }
    
    // Test 2: Check storage buckets
    console.log('\n📂 Test 2: Checking storage buckets...');
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    
    if (bucketError) {
      console.error('❌ Error listing buckets:', bucketError);
    } else {
      console.log('✅ Available buckets:');
      buckets.forEach(bucket => {
        console.log(`  - ${bucket.id} (public: ${bucket.public})`);
      });
    }
    
    // Test 3: Check profiles bucket contents
    console.log('\n📁 Test 3: Checking profiles bucket contents...');
    const { data: files, error: filesError } = await supabase.storage
      .from('profiles')
      .list('', { limit: 20 });
    
    if (filesError) {
      console.error('❌ Error listing profiles bucket:', filesError);
    } else {
      console.log('✅ Files in profiles bucket:');
      files.forEach((file, index) => {
        const isImage = file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i);
        const isMatch = school.logo_url.includes(file.name) || file.name.includes(school.logo_url);
        console.log(`  ${index + 1}. ${file.name} ${isImage ? '🖼️' : ''} ${isMatch ? '👈 MATCH!' : ''}`);
      });
    }
    
    // Test 4: Generate public URL
    console.log('\n🌐 Test 4: Testing public URL generation...');
    let urlToTest;
    
    if (school.logo_url.startsWith('http')) {
      urlToTest = school.logo_url;
      console.log('🔗 Using direct URL:', urlToTest);
    } else {
      console.log('🔧 Generating public URL for:', school.logo_url);
      const { data: publicUrlData } = supabase.storage
        .from('profiles')
        .getPublicUrl(school.logo_url);
      
      urlToTest = publicUrlData.publicUrl;
      console.log('🔗 Generated URL:', urlToTest);
    }
    
    // Test 5: Test URL accessibility
    console.log('\n🌐 Test 5: Testing URL accessibility...');
    try {
      const response = await fetch(urlToTest, { method: 'HEAD' });
      console.log(`📡 Response: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        console.log('✅ Logo URL is accessible!');
        console.log('📋 Headers:');
        for (const [key, value] of response.headers.entries()) {
          if (key.includes('content') || key.includes('cache')) {
            console.log(`  ${key}: ${value}`);
          }
        }
        
        // Test 6: Try to load as base64
        console.log('\n🔄 Test 6: Testing base64 conversion...');
        try {
          const logoBase64 = await getSchoolLogoBase64(school.logo_url);
          if (logoBase64) {
            console.log('✅ Logo successfully converted to base64!');
            console.log('📏 Base64 length:', logoBase64.length);
            console.log('🎯 Base64 preview:', logoBase64.substring(0, 50) + '...');
          } else {
            console.log('❌ Failed to convert logo to base64');
          }
        } catch (base64Error) {
          console.error('❌ Base64 conversion error:', base64Error.message);
        }
        
      } else {
        console.log('❌ Logo URL is not accessible');
      }
    } catch (fetchError) {
      console.error('❌ URL fetch failed:', fetchError.message);
    }
    
    console.log('\n🏁 Logo diagnostic tests completed');
    
  } catch (error) {
    console.error('❌ Logo tests failed:', error);
  }
};

/**
 * Quick test function that can be called from console
 */
export const testLogo = () => {
  runLogoTests().catch(console.error);
};
