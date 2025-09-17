import * as FileSystem from 'expo-file-system';

/**
 * Robust Logo Loading Utility
 * Implements multiple methods to ensure logo loading never fails
 */

/**
 * Convert image URL to base64 with multiple retry attempts
 */
const convertImageToBase64 = async (imageUrl, retryCount = 3) => {
  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      console.log(`🖼️ Attempting to convert image to base64 (attempt ${attempt}):`, imageUrl);
      
      // Method 1: Direct fetch and convert
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
      
      // Convert blob to base64
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result;
          console.log('✅ Successfully converted image to base64');
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      
    } catch (error) {
      console.log(`❌ Attempt ${attempt} failed:`, error.message);
      if (attempt === retryCount) {
        throw error;
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
};

/**
 * Download and cache image locally using Expo FileSystem
 */
const downloadAndCacheImage = async (imageUrl) => {
  try {
    const filename = `logo_${Date.now()}.png`;
    const localUri = `${FileSystem.cacheDirectory}${filename}`;
    
    console.log('📥 Downloading image to local cache:', localUri);
    
    const downloadResult = await FileSystem.downloadAsync(imageUrl, localUri);
    
    if (downloadResult.status === 200) {
      // Convert to base64
      const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Determine MIME type from URL or default to PNG
      const mimeType = imageUrl.toLowerCase().includes('.jpg') || imageUrl.toLowerCase().includes('.jpeg') 
        ? 'image/jpeg' 
        : 'image/png';
      
      const dataUri = `data:${mimeType};base64,${base64}`;
      
      console.log('✅ Successfully cached and converted image');
      return dataUri;
    }
    
    throw new Error(`Download failed with status: ${downloadResult.status}`);
  } catch (error) {
    console.log('❌ Cache method failed:', error.message);
    throw error;
  }
};

/**
 * Create a simple placeholder logo as base64
 */
const createPlaceholderLogo = () => {
  // Simple SVG placeholder converted to base64
  const svgPlaceholder = `
    <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#f0f0f0" stroke="#ccc" stroke-width="2"/>
      <circle cx="50" cy="35" r="15" fill="#666"/>
      <rect x="25" y="60" width="50" height="8" fill="#666"/>
      <rect x="30" y="75" width="40" height="6" fill="#999"/>
    </svg>
  `;
  
  const base64Svg = btoa(svgPlaceholder);
  return `data:image/svg+xml;base64,${base64Svg}`;
};

/**
 * Load logo with multiple fallback methods
 * This function will try everything possible to get a logo image
 */
export const loadLogoWithFallbacks = async (logoUrl) => {
  console.log('🔍 Starting logo loading process...');
  console.log('🔗 Input logo URL:', logoUrl);
  console.log('🔗 Logo URL type:', typeof logoUrl);
  console.log('🔗 Logo URL length:', logoUrl?.length || 0);
  
  if (!logoUrl || logoUrl.trim() === '') {
    console.log('⚠️ No logo URL provided, using placeholder');
    return createPlaceholderLogo();
  }

  // Enhanced URL preprocessing
  let processedUrl = logoUrl.trim();
  
  // If it's a relative path or filename, try to construct full URLs
  if (!processedUrl.startsWith('http://') && !processedUrl.startsWith('https://') && !processedUrl.startsWith('data:')) {
    console.log('🔧 URL appears to be relative/filename, attempting to construct full URL');
    
    // Common storage patterns - use actual Supabase URL if available
    const supabaseUrl = global.EXPO_PUBLIC_SUPABASE_URL || 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
    const possibleUrls = [
      `${supabaseUrl}/storage/v1/object/public/profiles/${processedUrl}`,
      `${supabaseUrl}/storage/v1/object/public/school-assets/${processedUrl}`,
      processedUrl // Keep original as fallback
    ];
    
    console.log('🔗 Possible URLs to try:', possibleUrls);
    
    // Try each constructed URL
    for (const testUrl of possibleUrls) {
      console.log('🔄 Testing constructed URL:', testUrl);
      try {
        const result = await convertImageToBase64(testUrl, 1);
        if (result) {
          console.log('✅ Successfully loaded from constructed URL:', testUrl);
          return result;
        }
      } catch (error) {
        console.log('❌ Constructed URL failed:', testUrl, error.message);
      }
    }
    
    processedUrl = possibleUrls[0]; // Use first constructed URL for remaining attempts
  }
  
  console.log('📋 Final processed URL for loading:', processedUrl);

  const methods = [
    {
      name: 'Direct Base64 Conversion (Enhanced)',
      method: () => convertImageToBase64(processedUrl, 3)
    },
    {
      name: 'Download and Cache',
      method: () => downloadAndCacheImage(processedUrl)
    },
    {
      name: 'Direct URL with Cache Buster',
      method: () => convertImageToBase64(`${processedUrl}${processedUrl.includes('?') ? '&' : '?'}t=${Date.now()}`, 2)
    },
    {
      name: 'CORS Proxy Attempt',
      method: () => convertImageToBase64(`https://cors-anywhere.herokuapp.com/${processedUrl}`, 1)
    },
    {
      name: 'HTTPS Variant (if HTTP)',
      method: () => processedUrl.startsWith('http://') 
        ? convertImageToBase64(processedUrl.replace('http://', 'https://'), 2)
        : Promise.reject(new Error('Not HTTP URL'))
    },
    {
      name: 'HTTP Variant (if HTTPS)',
      method: () => processedUrl.startsWith('https://') 
        ? convertImageToBase64(processedUrl.replace('https://', 'http://'), 2)
        : Promise.reject(new Error('Not HTTPS URL'))
    }
  ];

  // Try each method in sequence
  for (const { name, method } of methods) {
    try {
      console.log(`🔄 Trying ${name}...`);
      const result = await method();
      if (result && result.length > 100) { // Ensure we have actual content
        console.log(`✅ ${name} succeeded! Result length:`, result.length);
        return result;
      } else {
        console.log(`⚠️ ${name} returned empty result`);
      }
    } catch (error) {
      console.log(`❌ ${name} failed:`, error.message);
      continue;
    }
  }

  // If all methods fail, return placeholder
  console.log('⚠️ All logo loading methods failed, using placeholder');
  console.log('🔍 Failed URL summary:', {
    originalUrl: logoUrl,
    processedUrl,
    urlType: typeof logoUrl,
    urlLength: logoUrl?.length
  });
  return createPlaceholderLogo();
};

/**
 * Validate if the loaded image is actually valid
 */
export const validateImageData = (imageData) => {
  if (!imageData || typeof imageData !== 'string') {
    return false;
  }
  
  // Check if it's a valid data URI - more comprehensive regex
  const dataUriRegex = /^data:image\/(png|jpg|jpeg|gif|webp|svg\+xml);base64,/i;
  const isValidDataUri = dataUriRegex.test(imageData);
  
  // Also check minimum length for base64 data (should have actual content)
  const hasContent = imageData.length > 100; // Minimum reasonable size for an image
  
  console.log('🗼 Logo validation:', {
    hasData: !!imageData,
    isString: typeof imageData === 'string',
    isValidFormat: isValidDataUri,
    hasContent,
    dataLength: imageData.length,
    preview: imageData.substring(0, 50) + '...'
  });
  
  return isValidDataUri && hasContent;
};

/**
 * Get optimized image for printing (smaller size)
 */
export const getOptimizedLogoForPrint = async (logoUrl, maxWidth = 150) => {
  try {
    const logoData = await loadLogoWithFallbacks(logoUrl);
    
    // For printing, we might want to ensure it's not too large
    // This is a simple implementation - in production you might want to resize
    
    return logoData;
  } catch (error) {
    console.error('❌ Failed to get optimized logo:', error);
    return createPlaceholderLogo();
  }
};