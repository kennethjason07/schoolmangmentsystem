import * as FileSystem from 'expo-file-system';
import { supabase } from './supabase';

/**
 * Fetches school logo from storage and converts it to base64 for use in HTML receipts
 * @param {string} logoUrl - The logo URL from school_details.logo_url
 * @returns {Promise<string|null>} - Base64 data URL or null if failed
 */
export const getSchoolLogoBase64 = async (logoUrl) => {
  try {
    if (!logoUrl) {
      console.log('📷 No logo URL provided');
      return null;
    }

    console.log('📷 Loading school logo for receipt:', logoUrl);

    // Check if the logoUrl is already a full URL (from storage bucket)
    let fullLogoUrl = logoUrl;
    
    // If it's just a filename, construct the full URL from the storage bucket
    if (!logoUrl.startsWith('http')) {
      console.log('📷 Logo URL is a filename, constructing full URL from storage...');
      
      // Try profiles bucket first (as that's what the upload currently uses)
      const { data: publicUrlData } = supabase.storage
        .from('profiles')
        .getPublicUrl(logoUrl);
        
      if (publicUrlData?.publicUrl) {
        fullLogoUrl = publicUrlData.publicUrl;
        console.log('📷 Generated public URL from profiles bucket:', fullLogoUrl);
      } else {
        // Fallback to school-assets bucket
        const { data: schoolAssetsUrlData } = supabase.storage
          .from('school-assets')
          .getPublicUrl(logoUrl);
          
        if (schoolAssetsUrlData?.publicUrl) {
          fullLogoUrl = schoolAssetsUrlData.publicUrl;
          console.log('📷 Generated public URL from school-assets bucket:', fullLogoUrl);
        } else {
          console.log('❌ Failed to generate public URL from both buckets');
          return null;
        }
      }
    }

    // Test if the URL is accessible before proceeding
    try {
      const testResponse = await fetch(fullLogoUrl, { method: 'HEAD' });
      if (!testResponse.ok) {
        console.log('❌ Logo URL is not accessible:', testResponse.status);
        return null;
      }
    } catch (testError) {
      console.log('❌ Logo accessibility test failed:', testError.message);
      return null;
    }

    // Download the image to temporary file for React Native compatibility
    const tempFileName = `temp_logo_${Date.now()}.jpg`;
    const tempFileUri = FileSystem.cacheDirectory + tempFileName;
    
    console.log('📥 Downloading logo to temporary file:', tempFileUri);
    
    const downloadResult = await FileSystem.downloadAsync(fullLogoUrl, tempFileUri);
    
    if (downloadResult.status !== 200) {
      console.log('❌ Failed to download logo:', downloadResult.status);
      return null;
    }

    // Convert to base64
    console.log('🔄 Converting logo to base64...');
    const base64String = await FileSystem.readAsStringAsync(downloadResult.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Clean up temporary file
    try {
      await FileSystem.deleteAsync(downloadResult.uri);
    } catch (deleteError) {
      console.warn('⚠️ Failed to delete temporary logo file:', deleteError);
    }

    // Determine MIME type based on URL
    let mimeType = 'image/jpeg'; // default
    const urlLower = fullLogoUrl.toLowerCase();
    if (urlLower.includes('.png')) {
      mimeType = 'image/png';
    } else if (urlLower.includes('.gif')) {
      mimeType = 'image/gif';
    } else if (urlLower.includes('.webp')) {
      mimeType = 'image/webp';
    } else if (urlLower.includes('.svg')) {
      mimeType = 'image/svg+xml';
    }

    const dataUrl = `data:${mimeType};base64,${base64String}`;
    console.log('✅ Logo converted to base64 successfully, MIME type:', mimeType);
    
    return dataUrl;

  } catch (error) {
    console.error('❌ Error loading school logo for receipt:', error);
    return null;
  }
};

/**
 * Gets the optimized logo HTML for receipt headers
 * @param {string} logoBase64 - Base64 data URL of the logo
 * @param {Object} options - Styling options
 * @returns {string} - HTML string for the logo
 */
export const getLogoHTML = (logoBase64, options = {}) => {
  if (!logoBase64) return '';
  
  const {
    width = '80px',
    height = '80px',
    borderRadius = '8px',
    margin = '0 auto 15px auto',
    objectFit = 'contain'
  } = options;
  
  return `<img src="${logoBase64}" alt="School Logo" style="width: ${width}; height: ${height}; margin: ${margin}; border-radius: ${borderRadius}; object-fit: ${objectFit}; display: block;" />`;
};

/**
 * Gets the standard CSS styles for receipt headers with logo
 * @returns {string} - CSS string for receipt header styling
 */
export const getReceiptHeaderCSS = () => {
  return `
    .receipt-header {
      text-align: center;
      border-bottom: 2px solid #2196F3;
      padding-bottom: 20px;
      margin-bottom: 30px;
      position: relative;
    }
    .school-logo {
      width: 80px;
      height: 80px;
      margin: 0 auto 15px auto;
      border-radius: 8px;
      object-fit: contain;
      display: block;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .school-name {
      font-size: 24px;
      font-weight: bold;
      color: #2196F3;
      margin-bottom: 8px;
      line-height: 1.2;
    }
    .school-info {
      font-size: 12px;
      color: #666;
      margin: 4px 0;
      line-height: 1.4;
    }
    .receipt-title {
      font-size: 20px;
      font-weight: bold;
      color: #333;
      margin: 15px 0 10px 0;
      letter-spacing: 1px;
    }
    .receipt-number {
      font-size: 14px;
      color: #2196F3;
      font-weight: bold;
      margin-top: 8px;
    }
  `;
};
