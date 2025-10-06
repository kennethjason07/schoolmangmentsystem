// Conditional imports for logo loading (only in React Native environment)
let loadSchoolLogoEnhanced, validateLogoData, loadLogoWithFallbacks, validateImageData, supabase;

try {
  // Only load these in React Native environment
  if (typeof global !== 'undefined' && global.expo) {
    const enhancedLoader = require('./enhancedLogoLoader');
    const robustLoader = require('./robustLogoLoader');
    const supabaseUtil = require('./supabase');
    
    loadSchoolLogoEnhanced = enhancedLoader.loadSchoolLogoEnhanced;
    validateLogoData = enhancedLoader.validateLogoData;
    loadLogoWithFallbacks = robustLoader.loadLogoWithFallbacks;
    validateImageData = robustLoader.validateImageData;
    supabase = supabaseUtil.supabase;
  }
} catch (error) {
  // Fallback when dependencies are not available
  console.log('Advanced logo loaders not available, using fallbacks');
}

/**
 * Generate a clean, professional receipt HTML template
 * Layout: Logo (mandatory from DB) -> School Name -> Address -> "FEE RECEIPT" with underline
 * -> Student details -> Payment details -> Amount (no highlighting)
 */
const generateUnifiedReceiptHTML = async (receiptData, schoolDetails, preloadedLogoUrl = null) => {
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
        
        // Try profiles bucket first (where new uploads go) - only if supabase is available
        try {
          if (!supabase) {
            throw new Error('Supabase not available in this environment');
          }
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
            if (!supabase) {
              throw new Error('Supabase not available in this environment');
            }
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
        // Fallback to enhanced loader - only if available
        try {
          if (!loadSchoolLogoEnhanced || !validateLogoData) {
            throw new Error('Enhanced logo loaders not available in this environment');
          }
          const logoData = await loadSchoolLogoEnhanced(schoolDetails.logo_url);
          const isValidLogo = validateLogoData(logoData) && isValidImageUrl(logoData);
          
          if (isValidLogo) {
            logoHTML = `<img src="${logoData}" class="school-logo" alt="School Logo" />`;
            console.log('✅ Unified - Enhanced logo loaded successfully');
          } else {
            console.log('🔄 Unified - Enhanced loader failed, trying robust loader');
            
            // Final fallback to robust loader - only if available
            if (!loadLogoWithFallbacks || !validateImageData) {
              throw new Error('Robust logo loaders not available in this environment');
            }
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
    const amountPaidNumber = parseFloat(receiptData.amount_paid || receiptData.amount || 0) || 0;
    const amountPaid = amountPaidNumber.toLocaleString('en-IN', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    const amountRemainingNumber = receiptData.amount_remaining != null ? parseFloat(receiptData.amount_remaining) : null;
    const amountRemaining = amountRemainingNumber != null ? amountRemainingNumber.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null;
    const cashierName = receiptData.cashier_name || receiptData.cashierName || null;
    const fatherName = receiptData.father_name || receiptData.fathers_name || receiptData.parent_name || null;
    const studentUID = receiptData.uid || receiptData.student_uid || null;
    
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
            @page { size: A4 portrait; margin: 15mm; }
            body { 
              font-family: 'Arial', sans-serif; 
              margin: 0; 
              padding: 0;
              color: #000; 
              background: #fff; 
              font-size: 14px;
              line-height: 1.3;
            }
            .receipt-container { 
              border: 2px solid #000; 
              border-radius: 10px;
              padding: 15px; 
              max-width: 100%; 
              margin: 10px;
              background: white;
            }
            
            /* Header Section - exactly like reference */
            .header-section {
              display: flex;
              align-items: flex-start;
              margin-bottom: 15px;
              border-bottom: 2px solid #000;
              padding-bottom: 10px;
            }
            .logo-section {
              width: 80px;
              margin-right: 15px;
              flex-shrink: 0;
            }
            .school-logo { 
              width: 80px; 
              height: 80px; 
              object-fit: contain;
              border-radius: 50%;
            }
            .school-logo-fallback {
              width: 80px;
              height: 80px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 30px;
              background: #f5f5f5;
              border: 2px solid #333;
              border-radius: 50%;
            }
            .school-info {
              flex-grow: 1;
              text-align: center;
            }
            .school-name { 
              font-size: 24px; 
              font-weight: bold; 
              margin: 0 0 5px 0;
              text-transform: uppercase;
              color: #000;
            }
            .school-address { 
              font-size: 12px;
              color: #000;
              margin: 2px 0;
            }
            .school-contact {
              font-size: 12px;
              color: #000;
              margin: 2px 0;
            }
            
            /* Student Information Grid - exactly like reference */
            .student-info {
              margin: 15px 0;
              font-size: 13px;
            }
            .student-row {
              display: flex;
              justify-content: space-between;
              margin: 8px 0;
              border-bottom: 1px solid #000;
              padding-bottom: 5px;
            }
            .student-row:last-child {
              border-bottom: none;
            }
            .student-left {
              display: flex;
              flex: 1;
            }
            .student-center {
              display: flex;
              flex: 1;
              justify-content: center;
            }
            .student-right {
              display: flex;
              flex: 1;
              justify-content: flex-end;
            }
            .info-label {
              font-weight: bold;
              margin-right: 5px;
              color: #000;
            }
            .info-value {
              color: #000;
            }
            
            /* Fee Table - exactly like reference */
            .fee-table-container {
              margin: 20px 0;
            }
            .fee-table {
              width: 100%;
              border-collapse: collapse;
              border: 2px solid #000;
            }
            .fee-table th {
              border: 1px solid #000;
              padding: 10px;
              text-align: center;
              font-weight: bold;
              background-color: #fff;
              font-size: 14px;
            }
            .fee-table td {
              border: 1px solid #000;
              padding: 10px;
              text-align: left;
              font-size: 13px;
            }
            .fee-table .amount-cell {
              text-align: center;
              font-weight: normal;
            }
            .total-row {
              font-weight: bold;
            }
            .total-row .particulars {
              text-align: center;
              font-weight: bold;
            }
            .total-row .amount-cell {
              text-align: center;
              font-weight: bold;
            }
            
            /* Bottom Summary - exactly like reference */
            .fee-summary {
              display: flex;
              justify-content: space-between;
              margin: 15px 0;
              font-size: 13px;
              font-weight: normal;
              border-top: 1px solid #000;
              border-bottom: 1px solid #000;
              padding: 10px 0;
            }
            .fee-summary-item {
              color: #000;
            }
            
            /* Footer Section - exactly like reference */
            .footer-section {
              margin-top: 15px;
              font-size: 12px;
              line-height: 1.4;
            }
            .footer-notes {
              margin-bottom: 10px;
            }
            .footer-notes div {
              margin: 3px 0;
            }
            .footer-details {
              margin-bottom: 15px;
            }
            .footer-details div {
              margin: 5px 0;
            }
            .signature-area {
              display: flex;
              justify-content: flex-end;
              margin-top: 30px;
            }
            .signature-box {
              text-align: right;
              width: 200px;
            }
            .signature-text {
              margin-bottom: 30px;
            }
            .signature-line {
              border-top: 1px solid #000;
              padding-top: 5px;
              font-weight: normal;
              text-align: center;
            }
            
            /* Print optimization */
            @media print {
              body { margin: 0; padding: 0; }
              .receipt-container { border: 2px solid #000; margin: 0; }
              @page { margin: 10mm; size: A4 portrait; }
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <!-- Header Section -->
            <div class="header-section">
              <div class="logo-section">
                ${logoHTML}
              </div>
              <div class="school-info">
                <div class="school-name">${schoolName}</div>
                <div class="school-address">${schoolAddress}</div>
                ${schoolDetails?.phone || schoolDetails?.email ? 
                  `<div class="school-contact">Contact: ${schoolDetails?.phone ? 'Contact No.: ' + schoolDetails.phone : ''}${schoolDetails?.phone && schoolDetails?.email ? ', ' : ''}${schoolDetails?.email ? 'Email:' + schoolDetails.email : ''}</div>` : 
                  ''}
              </div>
            </div>
            
            <!-- Student Information Grid -->
            <div class="student-info">
              <div class="student-row">
                <div class="student-left">
                  <span class="info-label">Student Name:</span>
                  <span class="info-value">${studentName}</span>
                </div>
                <div class="student-center">
                  <span class="info-label">UID:</span>
                  <span class="info-value">${studentUID || admissionNo}</span>
                </div>
                <div class="student-right">
                  <span class="info-label">Receipt No:</span>
                  <span class="info-value">${receiptNo}</span>
                </div>
              </div>
              
              <div class="student-row">
                <div class="student-left">
                  <span class="info-label">Fathers Name:</span>
                  <span class="info-value">${fatherName || 'N/A'}</span>
                </div>
                <div class="student-center">
                  <span class="info-label">Class:</span>
                  <span class="info-value">${className}</span>
                </div>
                <div class="student-right">
                  <span class="info-label">Year:</span>
                  <span class="info-value">${schoolDetails?.academic_year || '2024/25'}</span>
                </div>
              </div>
              
              <div class="student-row">
                <div class="student-left"></div>
                <div class="student-center"></div>
                <div class="student-right">
                  <span class="info-label">Date:</span>
                  <span class="info-value">${paymentDate}</span>
                </div>
              </div>
            </div>
            
            <!-- Fee Table -->
            <div class="fee-table-container">
              <table class="fee-table">
                <thead>
                  <tr>
                    <th style="width: 70%;">Particulars</th>
                    <th style="width: 30%;">Fees Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>${feeType}</td>
                    <td class="amount-cell">Rs. ${Number(amountPaidNumber).toLocaleString('en-IN', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</td>
                  </tr>
                  ${receiptData.fine_amount && parseFloat(receiptData.fine_amount) > 0 ? `
                  <tr>
                    <td>Fine</td>
                    <td class="amount-cell">Rs. ${Number(receiptData.fine_amount).toLocaleString('en-IN', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</td>
                  </tr>
                  ` : ''}
                  <tr class="total-row">
                    <td class="particulars">Total:</td>
                    <td class="amount-cell">Rs. ${(receiptData.fine_amount && parseFloat(receiptData.fine_amount) > 0) ? 
                      (parseFloat(receiptData.amount_paid || amountPaidNumber) + parseFloat(receiptData.fine_amount || 0)).toLocaleString('en-IN', {minimumFractionDigits: 0, maximumFractionDigits: 0}) : 
                      Number(amountPaidNumber).toLocaleString('en-IN', {minimumFractionDigits: 0, maximumFractionDigits: 0})
                    }</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <!-- Fee Summary -->
            <div class="fee-summary">
              <div class="fee-summary-item">
                Total fees paid : Rs. ${receiptData.total_paid_till_date ? 
                  Number(receiptData.total_paid_till_date).toLocaleString('en-IN', {minimumFractionDigits: 0, maximumFractionDigits: 0}) : 
                  Number(amountPaidNumber).toLocaleString('en-IN', {minimumFractionDigits: 0, maximumFractionDigits: 0})
                }
              </div>
              <div class="fee-summary-item">
                Total fees Due : Rs. ${amountRemaining !== null ? 
                  Number(amountRemainingNumber).toLocaleString('en-IN', {minimumFractionDigits: 0, maximumFractionDigits: 0}) : 
                  '0'
                }
              </div>
            </div>
            
            <!-- Footer Section -->
            <div class="footer-section">
              <div class="footer-notes">
                <div>In Words: Rupees ${receiptData.amount_in_words || (amountPaidNumber > 0 ? convertNumberToWords(amountPaidNumber) : 'Zero')} Only</div>
                <div>Note: Fees once deposited will not be refunded under any Circumstances</div>
              </div>
              
              <div class="footer-details">
                <div>Payment Mode: ${paymentMode}</div>
                <div>Cashier Name:${cashierName || 'System Generated'} &nbsp;&nbsp;&nbsp; Date : ${paymentDate}</div>
              </div>
              
              <div class="signature-area">
                <div class="signature-box">
                  <div class="signature-text">Received with thanks,</div>
                  <div class="signature-line">Cashier/Accountant</div>
                </div>
              </div>
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

/**
 * Convert number to words for receipt
 */
function convertNumberToWords(num) {
  if (num === 0) return 'Zero';
  
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const thousands = ['', 'Thousand', 'Lakh', 'Crore'];
  
  function convertHundreds(n) {
    let result = '';
    
    if (n >= 100) {
      result += ones[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    
    if (n >= 20) {
      result += tens[Math.floor(n / 10)] + ' ';
      n %= 10;
    } else if (n >= 10) {
      result += teens[n - 10] + ' ';
      n = 0;
    }
    
    if (n > 0) {
      result += ones[n] + ' ';
    }
    
    return result;
  }
  
  let result = '';
  let thousandCounter = 0;
  
  // Handle Indian numbering system (crores, lakhs, thousands)
  if (num >= 10000000) { // 1 crore
    result = convertHundreds(Math.floor(num / 10000000)) + 'Crore ';
    num %= 10000000;
  }
  
  if (num >= 100000) { // 1 lakh
    result += convertHundreds(Math.floor(num / 100000)) + 'Lakh ';
    num %= 100000;
  }
  
  if (num >= 1000) { // 1 thousand
    result += convertHundreds(Math.floor(num / 1000)) + 'Thousand ';
    num %= 1000;
  }
  
  if (num > 0) {
    result += convertHundreds(num);
  }
  
  return result.trim();
}

// Export functions for both ES6 and CommonJS
module.exports = {
  generateUnifiedReceiptHTML,
  convertNumberToWords
};
