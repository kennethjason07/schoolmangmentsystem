import * as FileSystem from 'expo-file-system';
import { supabase } from './supabase';

/**
 * Enhanced Logo Loader with Supabase Integration
 * Handles database URLs, storage bucket URLs, and fallbacks
 */

/**
 * Get Supabase configuration for URL construction
 */
const getSupabaseConfig = () => {
  try {
    // Get the actual Supabase URL from the imported client
    const supabaseUrl = supabase.supabaseUrl || supabase.supabaseAuthUrl?.replace('/auth/v1', '') || process.env.EXPO_PUBLIC_SUPABASE_URL;
    const storageUrl = `${supabaseUrl}/storage/v1/object/public`;
    
    console.log('📊 Enhanced - Supabase config:', { 
      supabaseUrl, 
      storageUrl,
      hasSupabaseClient: !!supabase 
    });
    return { supabaseUrl, storageUrl };
  } catch (error) {
    console.error('❌ Error getting Supabase config:', error);
    return { supabaseUrl: 'fallback', storageUrl: 'fallback' };
  }
};

/**
 * Convert image URL to base64 with enhanced error handling
 */
const convertImageToBase64 = async (imageUrl, retryCount = 2) => {
  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      console.log(`🖼️ Converting image to base64 (attempt ${attempt}/${retryCount}):`, imageUrl);
      
      // Test URL accessibility first
      const testResponse = await fetch(imageUrl, { method: 'HEAD' });
      if (!testResponse.ok) {
        throw new Error(`URL not accessible: ${testResponse.status} ${testResponse.statusText}`);
      }
      
      // Fetch the image
      const response = await fetch(imageUrl, {
        method: 'GET',
        headers: {
          'Accept': 'image/*',
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      
      // Convert blob to base64 using FileReader
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      
      if (base64 && base64.length > 100) {
        console.log('✅ Successfully converted image to base64, size:', base64.length);
        return base64;
      }
      
      throw new Error('Base64 conversion resulted in empty data');
      
    } catch (error) {
      console.log(`❌ Conversion attempt ${attempt} failed:`, error.message);
      if (attempt === retryCount) {
        throw error;
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
};

/**
 * Try to construct proper Supabase URLs from various input formats
 */
const constructSupabaseUrls = (logoUrl) => {
  const { storageUrl } = getSupabaseConfig();
  const urls = [];
  
  // If already a full HTTP/HTTPS URL, use as-is
  if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
    urls.push(logoUrl);
    return urls;
  }
  
  // If it's already a data URL, return as-is
  if (logoUrl.startsWith('data:')) {
    return [logoUrl];
  }
  
  // Clean the filename
  const cleanFilename = logoUrl.replace(/^[\/\\]+/, ''); // Remove leading slashes
  
  // Try different bucket combinations
  const buckets = ['profiles', 'school-assets', 'logos', 'images'];
  
  for (const bucket of buckets) {
    urls.push(`${storageUrl}/${bucket}/${cleanFilename}`);
  }
  
  console.log('🔗 Constructed Supabase URLs:', urls);
  return urls;
};

/**
 * Use Supabase client to get proper public URL
 */
const getSupabasePublicUrl = async (logoUrl) => {
  try {
    console.log('🔧 Attempting Supabase public URL generation for:', logoUrl);
    
    // Clean filename for bucket operations
    const cleanFilename = logoUrl.replace(/^[\/\\]+/, '');
    
    const buckets = ['profiles', 'school-assets', 'logos', 'images'];
    
    for (const bucket of buckets) {
      try {
        const { data } = supabase.storage.from(bucket).getPublicUrl(cleanFilename);
        
        if (data?.publicUrl) {
          console.log(`✅ Generated public URL from ${bucket} bucket:`, data.publicUrl);
          
          // Test if the URL is accessible
          try {
            const testResponse = await fetch(data.publicUrl, { method: 'HEAD' });
            if (testResponse.ok) {
              return data.publicUrl;
            }
          } catch (testError) {
            console.log(`❌ Public URL not accessible for ${bucket}:`, testError.message);
          }
        }
      } catch (bucketError) {
        console.log(`❌ Bucket ${bucket} failed:`, bucketError.message);
      }
    }
    
    return null;
  } catch (error) {
    console.error('❌ Supabase public URL generation failed:', error);
    return null;
  }
};

/**
 * Create a professional placeholder logo
 */
const createPlaceholderLogo = () => {
  const svgPlaceholder = `
    <svg width="80" height="80" xmlns="http://www.w3.org/2000/svg">
      <rect width="80" height="80" fill="#f8f9fa" stroke="#dee2e6" stroke-width="2" rx="8"/>
      <circle cx="40" cy="25" r="8" fill="#6c757d"/>
      <rect x="25" y="40" width="30" height="4" fill="#6c757d" rx="2"/>
      <rect x="28" y="50" width="24" height="3" fill="#adb5bd" rx="1"/>
      <text x="40" y="68" text-anchor="middle" font-family="Arial" font-size="8" fill="#6c757d">LOGO</text>
    </svg>
  `;
  
  const base64Svg = btoa(svgPlaceholder);
  return `data:image/svg+xml;base64,${base64Svg}`;
};

/**
 * Enhanced logo loading with comprehensive fallback strategy
 */
export const loadSchoolLogoEnhanced = async (logoUrl) => {
  console.log('🚀 Starting enhanced logo loading...');
  console.log('📝 Input details:', {
    logoUrl,
    type: typeof logoUrl,
    length: logoUrl?.length || 0,
    isEmpty: !logoUrl || logoUrl.trim() === ''
  });
  
  // Handle empty or invalid input
  if (!logoUrl || typeof logoUrl !== 'string' || logoUrl.trim() === '') {
    console.log('⚠️ Invalid or empty logo URL, using placeholder');
    return createPlaceholderLogo();
  }
  
  const trimmedUrl = logoUrl.trim();
  
  // If already a data URL, validate and return
  if (trimmedUrl.startsWith('data:')) {
    console.log('📊 Input is already a data URL, validating...');
    if (trimmedUrl.length > 100) {
      console.log('✅ Data URL appears valid');
      return trimmedUrl;
    } else {
      console.log('❌ Data URL too short, using placeholder');
      return createPlaceholderLogo();
    }
  }
  
  // Strategy 1: Try Supabase public URL generation
  try {
    console.log('🎯 Strategy 1: Supabase public URL generation');
    const publicUrl = await getSupabasePublicUrl(trimmedUrl);
    if (publicUrl) {
      const result = await convertImageToBase64(publicUrl, 2);
      if (result) {
        console.log('✅ Strategy 1 successful!');
        return result;
      }
    }
  } catch (error) {
    console.log('❌ Strategy 1 failed:', error.message);
  }
  
  // Strategy 2: Try constructed URLs
  try {
    console.log('🎯 Strategy 2: Constructed URL attempts');
    const constructedUrls = constructSupabaseUrls(trimmedUrl);
    
    for (const url of constructedUrls) {
      try {
        console.log('🔄 Trying constructed URL:', url);
        const result = await convertImageToBase64(url, 1);
        if (result) {
          console.log('✅ Strategy 2 successful with URL:', url);
          return result;
        }
      } catch (error) {
        console.log('❌ Constructed URL failed:', url, error.message);
      }
    }
  } catch (error) {
    console.log('❌ Strategy 2 failed:', error.message);
  }
  
  // Strategy 3: Direct URL attempt (if it looks like a full URL)
  if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
    try {
      console.log('🎯 Strategy 3: Direct URL attempt');
      const result = await convertImageToBase64(trimmedUrl, 2);
      if (result) {
        console.log('✅ Strategy 3 successful!');
        return result;
      }
    } catch (error) {
      console.log('❌ Strategy 3 failed:', error.message);
    }
  }
  
  // All strategies failed
  console.log('❌ All logo loading strategies failed');
  console.log('📊 Final summary:', {
    originalUrl: logoUrl,
    trimmedUrl,
    strategies: ['Supabase public URL', 'Constructed URLs', 'Direct URL']
  });
  
  return createPlaceholderLogo();
};

/**
 * Validate if loaded data is a proper image
 */
export const validateLogoData = (logoData) => {
  if (!logoData || typeof logoData !== 'string') {
    return false;
  }
  
  // Check for valid data URI format
  const dataUriRegex = /^data:image\/(png|jpg|jpeg|gif|webp|svg\+xml);base64,/i;
  const isValidDataUri = dataUriRegex.test(logoData);
  
  // Check for reasonable content length
  const hasContent = logoData.length > 100;
  
  const result = isValidDataUri && hasContent;
  
  console.log('🔍 Logo validation result:', {
    hasData: !!logoData,
    isString: typeof logoData === 'string',
    isValidFormat: isValidDataUri,
    hasContent,
    dataLength: logoData.length,
    isValid: result
  });
  
  return result;
};