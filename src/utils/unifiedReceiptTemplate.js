import { loadSchoolLogoEnhanced, validateLogoData } from './enhancedLogoLoader';
import { loadLogoWithFallbacks, validateImageData } from './robustLogoLoader';
import { supabase } from './supabase';

/**
 * Generate a clean, professional receipt HTML template
 * Layout: Logo (mandatory from DB) -> School Name -> Address -> "FEE RECEIPT" with underline
 * -> Student details -> Payment details -> Amount (no highlighting)
 */
export const generateUnifiedReceiptHTML = async (receiptData, schoolDetails, preloadedLogoUrl = null) => {
  try {
    console.log('📧 Generating unified receipt HTML...');
    console.log('📊 Receipt data:', receiptData);
    console.log('🏫 School details:', schoolDetails);
    
    // Function to validate logo URL (same logic as LogoDisplay component)
    const isValidImageUrl = (url) => {
      if (!url) return false;
      
      // Check for local file paths that won't work across sessions
      if (url.startsWith('file://')) {
        console.log('🚫 Local file path detected, not accessible:', url);
        return false;
      }
      
      // Check for other invalid patterns
      if (url.includes('ExperienceData') || url.includes('ImagePicker')) {
        console.log('🚫 Temporary image picker path detected:', url);
        return false;
      }
      
      // Must be a valid HTTP/HTTPS URL
      return url.startsWith('http://') || url.startsWith('https://');
    };

    // Load logo with consistent validation - prioritize preloaded logo
    let logoHTML = '';
    console.log('🏢 Unified - School details for logo loading:', {
      hasSchoolDetails: !!schoolDetails,
      schoolName: schoolDetails?.name || 'NO NAME',
      logoUrl: schoolDetails?.logo_url || 'NO LOGO URL',
      logoUrlType: typeof schoolDetails?.logo_url,
      logoUrlLength: schoolDetails?.logo_url?.length || 0,
      allKeys: Object.keys(schoolDetails || {})
    });
    console.log('🎯 Unified - Preloaded logo URL provided:', preloadedLogoUrl);
    
    // If we have a preloaded logo URL (from admin dashboard), use it directly
    if (preloadedLogoUrl && isValidImageUrl(preloadedLogoUrl)) {
      console.log('✅ Using preloaded logo URL:', preloadedLogoUrl);
      logoHTML = `<img src="${preloadedLogoUrl}" class="school-logo" alt="School Logo" />`;
    } else if (schoolDetails?.logo_url) {
      console.log('🔍 Unified - Attempting to load logo from:', schoolDetails.logo_url);
      console.log('🔍 Unified - Logo URL type:', typeof schoolDetails.logo_url);
      console.log('🔍 Unified - Logo URL length:', schoolDetails.logo_url?.length);
      
      try {
        // Check if logo_url is already a full URL (most common case now)
        if (isValidImageUrl(schoolDetails.logo_url)) {
          console.log('🌐 Unified - Logo URL is already a full URL, testing accessibility:', schoolDetails.logo_url);
          try {
            const testResponse = await fetch(schoolDetails.logo_url, { method: 'HEAD' });
            if (testResponse.ok) {
              logoHTML = `<img src="${schoolDetails.logo_url}" class="school-logo" alt="School Logo" />`;
              console.log('✅ Unified - Direct logo URL loaded successfully:', schoolDetails.logo_url);
            } else {
              console.log('🔄 Unified - Direct logo URL not accessible, extracting filename for bucket lookup');
              throw new Error('Direct URL not accessible');
            }
          } catch (urlTestError) {
            console.log('🔄 Unified - URL test failed, extracting filename for bucket lookup');
            throw new Error('URL test failed');
          }
        } else {
          // If not a full URL, treat as filename and try both buckets
          console.log('🔄 Unified - Not a full URL, treating as filename for bucket lookup');
          throw new Error('Not a full URL');
        }
      } catch (directError) {
        console.log('🔄 Unified - Direct URL approach failed, trying bucket lookup:', directError.message);
        
        // Extract filename from URL if it's a full URL, or use as-is if it's just a filename
        let filename = schoolDetails.logo_url;
        if (schoolDetails.logo_url.includes('/')) {
          filename = schoolDetails.logo_url.split('/').pop().split('?')[0];
          console.log('📄 Unified - Extracted filename from URL:', filename);
        }
        
        // Try profiles bucket first (where new uploads go)
        try {
          console.log('🔍 Unified - Trying profiles bucket with filename:', filename);
          const { data: profilesLogoData } = await supabase.storage
            .from('profiles')
            .getPublicUrl(filename);
            
          console.log('🌐 Unified - Profiles bucket public URL result:', profilesLogoData);
          
          if (profilesLogoData?.publicUrl && isValidImageUrl(profilesLogoData.publicUrl)) {
            try {
              const testResponse = await fetch(profilesLogoData.publicUrl, { method: 'HEAD' });
              if (testResponse.ok) {
                logoHTML = `<img src="${profilesLogoData.publicUrl}" class="school-logo" alt="School Logo" />`;
                console.log('✅ Unified - Profiles bucket URL loaded successfully:', profilesLogoData.publicUrl);
              } else {
                throw new Error('Profiles bucket URL not accessible');
              }
            } catch (profilesTestError) {
              throw new Error('Profiles bucket URL test failed');
            }
          } else {
            throw new Error('No valid profiles bucket URL generated');
          }
        } catch (profilesError) {
          console.log('🔄 Unified - Profiles bucket failed, trying school-assets bucket:', profilesError.message);
          
          // Fallback to school-assets bucket
          try {
            const { data: assetsLogoData } = await supabase.storage
              .from('school-assets')
              .getPublicUrl(filename);
              
            console.log('🌐 Unified - School-assets bucket public URL result:', assetsLogoData);
            
            if (assetsLogoData?.publicUrl && isValidImageUrl(assetsLogoData.publicUrl)) {
              try {
                const testResponse = await fetch(assetsLogoData.publicUrl, { method: 'HEAD' });
                if (testResponse.ok) {
                  logoHTML = `<img src="${assetsLogoData.publicUrl}" class="school-logo" alt="School Logo" />`;
                  console.log('✅ Unified - School-assets bucket URL loaded successfully:', assetsLogoData.publicUrl);
                } else {
                  throw new Error('School-assets bucket URL not accessible');
                }
              } catch (assetsTestError) {
                throw new Error('School-assets bucket URL test failed');
              }
            } else {
              throw new Error('No valid school-assets bucket URL generated');
            }
          } catch (assetsError) {
            console.log('🔄 Unified - Both bucket approaches failed, trying fallback loaders:', assetsError.message);
            throw new Error('All bucket approaches failed');
          }
        }
      }
      
      // If we reach here, all bucket approaches failed, try enhanced loaders
      console.log('🔄 Unified - All direct approaches failed, trying enhanced loader...');
      
      if (!logoHTML) {
        // Fallback to enhanced loader
        try {
          const logoData = await loadSchoolLogoEnhanced(schoolDetails.logo_url);
          const isValidLogo = validateLogoData(logoData) && isValidImageUrl(logoData);
          
          if (isValidLogo) {
            logoHTML = `<img src="${logoData}" class="school-logo" alt="School Logo" />`;
            console.log('✅ Unified - Enhanced logo loaded successfully');
          } else {
            console.log('🔄 Unified - Enhanced loader failed, trying robust loader');
            
            // Final fallback to robust loader
            const fallbackLogoData = await loadLogoWithFallbacks(schoolDetails.logo_url);
            const isFallbackValid = validateImageData(fallbackLogoData) && isValidImageUrl(fallbackLogoData);
            
            if (isFallbackValid) {
              logoHTML = `<img src="${fallbackLogoData}" class="school-logo" alt="School Logo" />`;
              console.log('✅ Unified - Fallback logo loaded successfully');
            } else {
              console.log('❌ Unified - All logo loaders failed, using school icon placeholder (same as dashboard)');
              // Use school icon fallback (same as LogoDisplay component) instead of book emoji
              logoHTML = `<div class="school-logo-fallback">🏦</div>`;
            }
          }
        } catch (enhancedError) {
          console.error('❌ Unified - All logo loading failed:', enhancedError);
          // Use school icon fallback (same as LogoDisplay component)
          logoHTML = `<div class="school-logo-fallback">🏦</div>`;
        }
      }
    } else {
      console.log('⚠️ No logo URL found in school details');
      console.log('📋 Available school details keys:', Object.keys(schoolDetails || {}));
      // Use school icon fallback (same as LogoDisplay component)
      logoHTML = `<div class="school-logo-fallback">🏫</div>`;
    }
    
    // Clean data extraction with fallbacks
    const schoolName = schoolDetails?.name || 'School Name';
    const schoolAddress = schoolDetails?.address || 'School Address';
    const studentName = receiptData.student_name || receiptData.studentName || 'Student Name';
    const admissionNo = receiptData.student_admission_no || receiptData.admissionNo || 'N/A';
    const className = receiptData.class_name || receiptData.className || 'N/A';
    const feeType = receiptData.fee_component || receiptData.feeName || 'Fee Type';
    const paymentDate = receiptData.payment_date_formatted || receiptData.paymentDate || 'N/A';
    const receiptNo = receiptData.receipt_no || receiptData.receipt_number || receiptData.receiptNumber || 'N/A';
    const paymentMode = receiptData.payment_mode || receiptData.paymentMethod || 'N/A';
    const amountPaid = parseFloat(receiptData.amount_paid || receiptData.amount || 0).toLocaleString('en-IN', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    
    console.log('📝 Processed receipt data:', {
      schoolName, schoolAddress, studentName, admissionNo, className,
      feeType, paymentDate, receiptNo, paymentMode, amountPaid
    });
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Fee Receipt - ${receiptNo}</title>
          <style>
            @page {
              size: A4 landscape;
              margin: 10mm;
            }
            
            body {
              font-family: 'Arial', sans-serif;
              margin: 0;
              padding: 0;
              color: #333;
              line-height: 1.2;
              background: #fff;
              font-size: 12px;
            }
            
            .receipt-container {
              max-width: 100%;
              margin: 0 auto;
              background: white;
              border: 2px solid #000;
              padding: 15px;
              box-sizing: border-box;
              height: auto;
              max-height: none;
            }
            
            /* Header Section - Logo Left of School Name */
            .receipt-header {
              margin-bottom: 15px;
              padding-bottom: 10px;
              border-bottom: 2px solid #000;
            }
            
            .header-top {
              display: flex;
              align-items: center;
              justify-content: center;
              margin-bottom: 10px;
            }
            
            .school-logo {
              width: 60px;
              height: 60px;
              object-fit: contain;
              margin-right: 15px;
              border-radius: 6px;
              flex-shrink: 0;
            }
            
            .school-logo-fallback {
              width: 60px;
              height: 60px;
              margin-right: 15px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 30px;
              background: #f5f5f5;
              border: 2px dashed #ccc;
              border-radius: 6px;
              flex-shrink: 0;
            }
            
            .school-info {
              text-align: center;
            }
            
            .school-name {
              font-size: 20px;
              font-weight: bold;
              color: #000;
              margin: 0 0 5px 0;
              text-transform: uppercase;
              line-height: 1.1;
            }
            
            .school-address {
              font-size: 12px;
              color: #666;
              margin: 0;
              line-height: 1.2;
            }
            
            .receipt-title {
              font-size: 18px;
              font-weight: bold;
              color: #000;
              margin: 10px 0 5px 0;
              text-decoration: underline;
              text-decoration-thickness: 2px;
              text-underline-offset: 3px;
              text-align: center;
            }
            
            /* Content Section - Single Column */
            .receipt-content {
              margin: 12px 0;
            }
            
            .receipt-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 3px 0;
              margin-bottom: 2px;
            }
            
            .receipt-label {
              font-weight: 600;
              color: #333;
              font-size: 13px;
            }
            
            .receipt-value {
              font-weight: 500;
              color: #333;
              font-size: 13px;
            }
            
            /* Separator Line */
            .amount-separator {
              height: 2px;
              background: #333;
              margin: 12px 0;
            }
            
            /* Amount Section */
            .receipt-amount-section {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin: 12px 0;
              padding: 4px 0;
            }
            
            .receipt-amount-label {
              font-size: 13px;
              font-weight: 600;
              color: #333;
            }
            
            .receipt-amount {
              font-size: 18px;
              font-weight: bold;
              color: #333;
            }
            
            /* Footer */
            .receipt-footer {
              margin-top: 15px;
              text-align: center;
              font-size: 10px;
              color: #666;
              border-top: 1px solid #ddd;
              padding-top: 8px;
            }
            
            @media print {
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              
              .receipt-container {
                border: 2px solid #000 !important;
                box-shadow: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <!-- Header -->
            <div class="receipt-header">
              <div class="header-top">
                ${logoHTML}
                <div class="school-info">
                  <div class="school-name">${schoolName}</div>
                  <div class="school-address">${schoolAddress}</div>
                </div>
              </div>
              <div class="receipt-title">FEE RECEIPT</div>
            </div>
            
            <!-- Content - Single Column -->
            <div class="receipt-content">
              <div class="receipt-row">
                <span class="receipt-label">Student Name:</span>
                <span class="receipt-value">${studentName}</span>
              </div>
              <div class="receipt-row">
                <span class="receipt-label">Admission No:</span>
                <span class="receipt-value">${admissionNo}</span>
              </div>
              <div class="receipt-row">
                <span class="receipt-label">Class:</span>
                <span class="receipt-value">${className}</span>
              </div>
              <div class="receipt-row">
                <span class="receipt-label">Fee Type:</span>
                <span class="receipt-value">${feeType}</span>
              </div>
              <div class="receipt-row">
                <span class="receipt-label">Date:</span>
                <span class="receipt-value">${paymentDate}</span>
              </div>
              <div class="receipt-row">
                <span class="receipt-label">Receipt No:</span>
                <span class="receipt-value">${receiptNo}</span>
              </div>
              <div class="receipt-row">
                <span class="receipt-label">Payment Mode:</span>
                <span class="receipt-value">${paymentMode}</span>
              </div>
            </div>
            
            <!-- Separator Line Above Amount -->
            <div class="amount-separator"></div>
            
            <!-- Amount Section -->
            <div class="receipt-amount-section">
              <div class="receipt-amount-label">Amount Paid:</div>
              <div class="receipt-amount">₹${amountPaid}</div>
            </div>
            
            <!-- Footer -->
            <div class="receipt-footer">
              This is a computer generated receipt.
            </div>
          </div>
        </body>
      </html>
    `;
    
  } catch (error) {
    console.error('❌ Error generating unified receipt HTML:', error);
    throw error;
  }
};