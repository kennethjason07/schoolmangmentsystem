#!/usr/bin/env node

// Debug script to check school details and logo setup
// Run with: node debug-school-logo.js

import { createClient } from '@supabase/supabase-js';

// Your Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugSchoolLogo() {
  console.log('🔍 SCHOOL LOGO DEBUG SCRIPT');
  console.log('=' * 50);

  try {
    // 1. Check if school_details table exists and has data
    console.log('\n📋 Step 1: Checking school_details table...');
    const { data: schoolDetails, error: schoolError } = await supabase
      .from('school_details')
      .select('*');

    if (schoolError) {
      console.error('❌ Error querying school_details:', schoolError);
      return;
    }

    console.log('✅ School details query successful');
    console.log('📊 Records found:', schoolDetails?.length || 0);
    
    if (schoolDetails && schoolDetails.length > 0) {
      schoolDetails.forEach((school, index) => {
        console.log(`\n🏫 School ${index + 1}:`);
        console.log('  - ID:', school.id);
        console.log('  - Name:', school.name);
        console.log('  - Logo URL:', school.logo_url || 'NULL');
        console.log('  - Address:', school.address || 'NULL');
        console.log('  - Phone:', school.phone || 'NULL');
        console.log('  - Email:', school.email || 'NULL');
      });

      // 2. Check storage buckets
      console.log('\n📁 Step 2: Checking storage buckets...');
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      
      if (bucketsError) {
        console.error('❌ Error listing buckets:', bucketsError);
      } else {
        console.log('✅ Storage buckets:', buckets.map(b => b.name));
        
        // Check if school-assets bucket exists
        const schoolAssetsBucket = buckets.find(b => b.name === 'school-assets');
        if (schoolAssetsBucket) {
          console.log('✅ school-assets bucket found');
          
          // 3. List files in school-assets bucket
          console.log('\n📂 Step 3: Listing files in school-assets bucket...');
          const { data: files, error: filesError } = await supabase.storage
            .from('school-assets')
            .list('', { limit: 100 });
          
          if (filesError) {
            console.error('❌ Error listing files:', filesError);
          } else {
            console.log('📄 Files in school-assets:', files?.length || 0);
            files?.forEach((file, index) => {
              console.log(`  ${index + 1}. ${file.name} (${file.metadata?.size || 'unknown size'})`);
            });
          }
        } else {
          console.log('❌ school-assets bucket NOT found');
          console.log('💡 You need to create the school-assets bucket in Supabase Storage');
        }
      }

      // 4. Test logo URL generation
      const firstSchool = schoolDetails[0];
      if (firstSchool?.logo_url) {
        console.log('\n🔗 Step 4: Testing logo URL generation...');
        console.log('Logo path from DB:', firstSchool.logo_url);
        
        const { data: publicUrlData } = supabase.storage
          .from('school-assets')
          .getPublicUrl(firstSchool.logo_url);
        
        console.log('Generated public URL:', publicUrlData.publicUrl);
        
        // Test if URL is accessible
        try {
          console.log('\n🌐 Step 5: Testing URL accessibility...');
          const response = await fetch(publicUrlData.publicUrl, { method: 'HEAD' });
          console.log('URL Status:', response.status);
          console.log('URL OK:', response.ok);
          console.log('Content-Type:', response.headers.get('content-type'));
          
          if (!response.ok) {
            console.log('❌ Logo URL is not accessible');
            console.log('💡 Possible reasons:');
            console.log('   - File does not exist in storage');
            console.log('   - Bucket is not public');
            console.log('   - RLS policies are blocking access');
          } else {
            console.log('✅ Logo URL is accessible!');
          }
        } catch (fetchError) {
          console.error('❌ Error testing URL accessibility:', fetchError.message);
        }
      } else {
        console.log('\n⚠️  No logo_url found in school details');
      }

    } else {
      console.log('\n⚠️  No school details found in database');
      console.log('💡 You need to insert school details first');
      console.log('\nSample insert query:');
      console.log(`INSERT INTO school_details (name, logo_url, address, phone, email) 
VALUES (
  'Your School Name',
  'logo.png',
  'School Address',
  'Phone Number',
  'Email Address'
);`);
    }

    // 6. Provide recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('=' * 50);
    
    if (!schoolDetails || schoolDetails.length === 0) {
      console.log('1. Create school details record in the database');
      console.log('2. Create school-assets storage bucket');
      console.log('3. Upload logo file to storage');
      console.log('4. Update logo_url in school_details');
    } else if (!schoolDetails[0]?.logo_url) {
      console.log('1. Upload logo file to school-assets bucket');
      console.log('2. Update school_details with logo filename');
    } else {
      console.log('1. Check if storage bucket policies allow public access');
      console.log('2. Verify logo file exists in storage');
      console.log('3. Check RLS policies on storage objects');
    }

  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

// Run the debug script
debugSchoolLogo().then(() => {
  console.log('\n🏁 Debug script completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
