// Debug script to test logo loading
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yqmzlhzajznytpjjsjwy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxbXpsaHphanpueXRwampzand5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNjU1Mzk4NywiZXhwIjoyMDQyMTI5OTg3fQ.VG3jZQMJSR43PCLUA2qHqoBjT3_FY7TT2NhwdRAcI4Y'; // service role key

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugLogo() {
  console.log('🔍 Starting logo debug test...');
  
  // Step 1: Check school_details table
  console.log('📊 Checking school_details table...');
  try {
    const { data: schoolData, error: schoolError } = await supabase
      .from('school_details')
      .select('*')
      .limit(1);
    
    if (schoolError) {
      console.error('❌ Error fetching school data:', schoolError);
    } else {
      console.log('✅ School data found:', schoolData);
      if (schoolData && schoolData.length > 0) {
        console.log('📋 School name:', schoolData[0].name);
        console.log('🔗 Logo URL:', schoolData[0].logo_url);
        console.log('🏢 Full school record:', JSON.stringify(schoolData[0], null, 2));
      } else {
        console.log('⚠️ No school data records found');
      }
    }
  } catch (error) {
    console.error('❌ Exception in school data fetch:', error);
  }
  
  // Step 2: Check available storage buckets
  console.log('\n🗂️ Checking available storage buckets...');
  try {
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    
    if (bucketError) {
      console.error('❌ Error fetching buckets:', bucketError);
    } else {
      console.log('✅ Available buckets:');
      buckets?.forEach(bucket => {
        console.log(`  - ${bucket.id} (public: ${bucket.public})`);
      });
    }
  } catch (error) {
    console.error('❌ Exception in bucket listing:', error);
  }
  
  // Step 3: Check profiles bucket contents
  console.log('\n📁 Checking profiles bucket contents...');
  try {
    const { data: files, error: filesError } = await supabase.storage
      .from('profiles')
      .list('', { limit: 10 });
    
    if (filesError) {
      console.error('❌ Error listing profiles bucket:', filesError);
    } else {
      console.log('✅ Files in profiles bucket:');
      files?.forEach(file => {
        console.log(`  - ${file.name} (${file.metadata?.size || 'unknown size'})`);
      });
    }
  } catch (error) {
    console.error('❌ Exception in profiles bucket listing:', error);
  }
  
  // Step 4: Test generating a public URL for any image file found
  console.log('\n🌐 Testing public URL generation...');
  try {
    const { data: files } = await supabase.storage.from('profiles').list('');
    const imageFile = files?.find(file => 
      file.name.includes('.jpg') || file.name.includes('.png') || file.name.includes('.jpeg')
    );
    
    if (imageFile) {
      console.log(`🖼️ Found image file: ${imageFile.name}`);
      const { data: { publicUrl } } = supabase.storage
        .from('profiles')
        .getPublicUrl(imageFile.name);
      
      console.log('🔗 Generated public URL:', publicUrl);
      
      // Test if URL is accessible
      try {
        const response = await fetch(publicUrl, { method: 'HEAD' });
        console.log(`🌐 URL accessibility: ${response.ok ? '✅ Accessible' : '❌ Not accessible'} (${response.status})`);
      } catch (fetchError) {
        console.log('❌ URL fetch error:', fetchError.message);
      }
    } else {
      console.log('⚠️ No image files found in profiles bucket');
    }
  } catch (error) {
    console.error('❌ Exception in URL generation test:', error);
  }
  
  console.log('\n🏁 Logo debug test completed');
}

// Run the debug test
debugLogo().catch(console.error);
