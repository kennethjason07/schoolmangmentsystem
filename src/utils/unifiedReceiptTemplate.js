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

    // Utility to build robust logo HTML with fallback sibling (avoids brittle quoting)
    const buildLogo = (src, note) => {
      return `<div class="logo-wrapper">
        <img src="${src}" class="school-logo" alt="School Logo" crossorigin="anonymous" referrerpolicy="no-referrer"
             onload="console.log('${note}')"
             onerror="this.style.display='none'; var f=this.nextElementSibling; if(f){f.style.display='flex';}" />
        <div class="school-logo-fallback" style="display:none">🏫</div>
      </div>`;
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
    
    // If we have a preloaded logo URL (from admin dashboard), use it directly with enhanced validation
    if (preloadedLogoUrl && isValidImageUrl(preloadedLogoUrl)) {
      console.log('✅ Using preloaded logo URL for print/PDF:', preloadedLogoUrl);
      // For print/PDF contexts, we add additional attributes to ensure the image loads properly
      logoHTML = buildLogo(preloadedLogoUrl, 'Logo loaded successfully');
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
              logoHTML = buildLogo(schoolDetails.logo_url, 'Logo loaded successfully from direct URL');
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
                logoHTML = buildLogo(profilesLogoData.publicUrl, 'Logo loaded successfully from profiles bucket');
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
                  logoHTML = buildLogo(assetsLogoData.publicUrl, 'Logo loaded successfully from school-assets bucket');
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
            logoHTML = buildLogo(logoData, 'Logo loaded successfully from enhanced loader');
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
              logoHTML = buildLogo(fallbackLogoData, 'Logo loaded successfully from fallback loader');
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
    
    // Ensure we always have some logo content - fallback to emoji if logoHTML is empty
    if (!logoHTML || logoHTML.trim() === '') {
      console.log('🚨 Logo HTML is empty, using emergency fallback');
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
            @page { size: A4 portrait; margin: 10mm; }
            html, body {
              margin: 0;
              padding: 0;
              background: #fff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              font-family: 'Arial', sans-serif;
            }
            
            /* Two-column page for printing */
            .page {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10mm;
              box-sizing: border-box;
            }
            .receipt-container { 
              border: 2px solid #000; 
              border-radius: 10px;
              padding: 15px; 
              max-width: 100%; 
              margin: 0;
              background: white;
              box-sizing: border-box;
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
            
            /* Hide buttons in all contexts - both screen and print */
            /* Target React Native TouchableOpacity buttons that get converted to web */
            div[role="button"], 
            [data-focusable="true"],
            /* Target common button patterns */
            .receipt-container button,
            .receipt-container .button,
            .receipt-container [role="button"],
            .receipt-container input[type="button"],
            .receipt-container input[type="submit"],
            /* Target specific admin button classes */
            .receiptActionButtons,
            .receiptPrintButton,
            .receiptDownloadButton,
            /* Target TouchableOpacity elements that might have these characteristics */
            div[style*="cursor: pointer"],
            div[style*="user-select: none"],
            /* Hide any element with these specific background colors (from admin styles) */
            div[style*="background-color: rgb(76, 175, 80)"], /* Green print button */
            div[style*="background-color: rgb(33, 150, 243)"], /* Blue download button */
            /* Target elements with specific text content */
            div:has(> div:contains("Print")),
            div:has(> div:contains("Download")),
            /* Additional patterns for action buttons */
            .action-buttons,
            .modal-actions,
            .receipt-actions {
              display: none !important;
              visibility: hidden !important;
              opacity: 0 !important;
              height: 0 !important;
              overflow: hidden !important;
            }
            
            /* Print optimization - Hide UI elements and optimize for printing */
            @media print {
              /* Hide ALL buttons and interactive elements during print */
              *, *::before, *::after {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              
              /* Hide any element that looks like a button or interactive UI */
              button, .button, [role="button"],
              .print-button, .share-button, .download-button,
              .action-button, .close-button, .modal-button,
              .btn, .btn-primary, .btn-secondary,
              .header-actions, .modal-header, .modal-footer,
              .toolbar, .navigation, .nav,
              .floating-action-button, .fab,
              input[type="button"], input[type="submit"],
              .no-print,
              /* Additional button patterns commonly used */
              [class*="button"], [class*="btn"], [id*="button"], [id*="btn"],
              .touchable, .pressable, .clickable,
              /* React Native Web classes that might be buttons */
              ._1mqqh, ._19bac, ._1k2vh, ._11jp7, ._1146k,
              /* Common button container classes */
              .actions, .button-group, .control-buttons,
              /* Make sure we catch any missed interactive elements */
              [onclick], [ontouchstart], [role="menuitem"],
              .interactive, .clickable-element {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                height: 0 !important;
                width: 0 !important;
                padding: 0 !important;
                margin: 0 !important;
                border: none !important;
              }
              
              /* Optimize body and container for print */
              body { 
                margin: 0 !important; 
                padding: 0 !important;
                background: white !important;
                color: black !important;
              }
              
              .receipt-container { 
                border: 2px solid #000 !important; 
                margin: 0 !important;
                padding: 15px !important;
                background: white !important;
                box-shadow: none !important;
                border-radius: 0 !important;
              }
              
              /* Ensure logo displays properly in print */
              .school-logo {
                width: 80px !important;
                height: 80px !important;
                object-fit: contain !important;
                border-radius: 50% !important;
                display: block !important;
                margin: 0 auto !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              
              .school-logo-fallback {
                width: 80px !important;
                height: 80px !important;
                align-items: center !important;
                justify-content: center !important;
                font-size: 30px !important;
                background: #f5f5f5 !important;
                border: 2px solid #333 !important;
                border-radius: 50% !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              
              /* Ensure all text elements are black for printing */
              .school-name, .school-address, .school-contact,
              .info-label, .info-value,
              .fee-table th, .fee-table td,
              .fee-summary-item,
              .footer-notes div, .footer-details div,
              .signature-text, .signature-line {
                color: black !important;
              }
              
              /* Ensure borders are visible in print */
              .header-section,
              .student-row,
              .fee-table, .fee-table th, .fee-table td,
              .fee-summary,
              .signature-line {
                border-color: black !important;
              }
              
              /* Page setup */
              @page { 
                margin: 10mm !important; 
                size: A4 portrait !important;
              }
              
              /* Force background colors and borders to print */
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            }
          </style>
        </head>
        <body>
          <script>
            // Ultra-aggressive button hiding with comprehensive debugging
            function hideButtonElements() {
              console.log('🚫 Starting aggressive button removal...');
              var hiddenCount = 0;
              
              // PHASE 1: Hide by role attributes
              var buttonRoles = document.querySelectorAll('[role="button"], [role="menuitem"], [tabindex="0"]');
              console.log('Found ' + buttonRoles.length + ' elements with button roles');
              buttonRoles.forEach(function(el) {
                el.style.display = 'none !important';
                el.style.visibility = 'hidden !important';
                el.style.opacity = '0 !important';
                el.style.height = '0 !important';
                el.style.width = '0 !important';
                el.style.overflow = 'hidden !important';
                hiddenCount++;
              });
              
              // PHASE 2: Hide by class names (more comprehensive)
              var buttonClasses = [
                'receiptActionButtons', 'receiptPrintButton', 'receiptDownloadButton',
                'action-buttons', 'modal-actions', 'receipt-actions',
                'print-button', 'download-button', 'btn', 'button',
                'TouchableOpacity', 'RCTTouchableOpacity', 'css-view',
                'rn-button', 'react-native-button'
              ];
              var classBasedCount = 0;
              buttonClasses.forEach(function(className) {
                var elements = document.getElementsByClassName(className);
                classBasedCount += elements.length;
                Array.from(elements).forEach(function(el) {
                  el.style.display = 'none !important';
                  el.style.visibility = 'hidden !important';
                  el.style.opacity = '0 !important';
                  el.style.height = '0 !important';
                  el.style.width = '0 !important';
                  el.style.overflow = 'hidden !important';
                  hiddenCount++;
                });
              });
              console.log('Hidden ' + classBasedCount + ' elements by class names');
              
              // PHASE 3: Hide ALL elements containing specific text (ultra aggressive)
              var allElements = document.querySelectorAll('*');
              console.log('Scanning ' + allElements.length + ' total elements for button text...');
              var textBasedCount = 0;
              allElements.forEach(function(element) {
                if (element.textContent) {
                  var text = element.textContent.trim().toLowerCase();
                  var buttonTexts = ['print', 'download', 'share', 'export', 'save', 'pdf'];
                  
                  if (buttonTexts.some(function(btnText) { return text === btnText; })) {
                    // Hide the element and all its ancestors up to 3 levels
                    var current = element;
                    for (var i = 0; i < 4 && current; i++) {
                      current.style.display = 'none !important';
                      current.style.visibility = 'hidden !important';
                      current.style.opacity = '0 !important';
                      current.style.height = '0 !important';
                      current.style.width = '0 !important';
                      current.style.overflow = 'hidden !important';
                      current = current.parentElement;
                      textBasedCount++;
                    }
                    hiddenCount++;
                  }
                }
              });
              console.log('Hidden ' + textBasedCount + ' elements by text content');
              
              // PHASE 4: Hide by computed styles (background colors, cursors)
              var styleBasedCount = 0;
              allElements.forEach(function(element) {
                if (element.tagName === 'DIV' || element.tagName === 'BUTTON') {
                  var style = window.getComputedStyle(element);
                  var bgColor = style.backgroundColor;
                  
                  // Check for common button colors
                  var buttonColors = [
                    'rgb(76, 175, 80)', 'rgb(33, 150, 243)', 'rgb(255, 152, 0)',
                    'rgb(244, 67, 54)', 'rgb(156, 39, 176)', 'rgb(0, 150, 136)'
                  ];
                  
                  if (buttonColors.includes(bgColor) || 
                      style.cursor === 'pointer' || 
                      (style.borderRadius && parseInt(style.borderRadius) > 0 && 
                       (style.padding || style.backgroundColor !== 'rgba(0, 0, 0, 0)'))) {
                    element.style.display = 'none !important';
                    element.style.visibility = 'hidden !important';
                    element.style.opacity = '0 !important';
                    element.style.height = '0 !important';
                    element.style.width = '0 !important';
                    element.style.overflow = 'hidden !important';
                    styleBasedCount++;
                    hiddenCount++;
                  }
                }
              });
              console.log('Hidden ' + styleBasedCount + ' elements by styles');
              
              // PHASE 5: Hide actual HTML button elements
              var htmlButtons = document.querySelectorAll('button, input[type="button"], input[type="submit"], a[role="button"]');
              console.log('Found ' + htmlButtons.length + ' HTML button elements');
              htmlButtons.forEach(function(btn) {
                btn.style.display = 'none !important';
                btn.style.visibility = 'hidden !important';
                btn.style.opacity = '0 !important';
                btn.style.height = '0 !important';
                btn.style.width = '0 !important';
                btn.style.overflow = 'hidden !important';
                hiddenCount++;
              });
              
              // PHASE 6: Hide positioned elements that look like floating action buttons
              var positionBasedCount = 0;
              allElements.forEach(function(element) {
                var style = window.getComputedStyle(element);
                if ((style.position === 'fixed' || style.position === 'absolute') && 
                    (style.bottom === '0px' || parseInt(style.bottom) < 100) &&
                    (style.right === '0px' || parseInt(style.right) < 100 || 
                     style.left === '0px' || parseInt(style.left) < 100)) {
                  element.style.display = 'none !important';
                  element.style.visibility = 'hidden !important';
                  element.style.opacity = '0 !important';
                  element.style.height = '0 !important';
                  element.style.width = '0 !important';
                  element.style.overflow = 'hidden !important';
                  positionBasedCount++;
                  hiddenCount++;
                }
              });
              console.log('Hidden ' + positionBasedCount + ' positioned elements');
              
              // PHASE 7: Nuclear option - hide any remaining clickable elements
              var clickableCount = 0;
              allElements.forEach(function(element) {
                if (element.onclick || element.getAttribute('onclick') || 
                    element.getAttribute('data-testid') || 
                    element.className.includes('touchable') ||
                    element.className.includes('pressable') ||
                    element.className.includes('clickable')) {
                  element.style.display = 'none !important';
                  element.style.visibility = 'hidden !important';
                  element.style.opacity = '0 !important';
                  element.style.height = '0 !important';
                  element.style.width = '0 !important';
                  element.style.overflow = 'hidden !important';
                  clickableCount++;
                  hiddenCount++;
                }
              });
              console.log('Hidden ' + clickableCount + ' clickable elements');
              
              console.log('🎯 TOTAL HIDDEN: ' + hiddenCount + ' button-like elements removed');
              
              // Debug: List remaining visible elements that might be buttons
              var remainingElements = document.querySelectorAll('*');
              var suspiciousElements = [];
              remainingElements.forEach(function(element) {
                var style = window.getComputedStyle(element);
                if (style.display !== 'none' && element.textContent) {
                  var text = element.textContent.trim().toLowerCase();
                  if (text === 'print' || text === 'download' || text === 'share') {
                    suspiciousElements.push({
                      tag: element.tagName,
                      text: element.textContent.trim(),
                      class: element.className,
                      id: element.id,
                      styles: {
                        display: style.display,
                        position: style.position,
                        backgroundColor: style.backgroundColor
                      }
                    });
                  }
                }
              });
              
              if (suspiciousElements.length > 0) {
                console.warn('⚠️ REMAINING SUSPICIOUS ELEMENTS:', suspiciousElements);
              } else {
                console.log('✅ No remaining button-like elements detected');
              }
            }
            
            // Run the button hiding function multiple times with different strategies
            console.log('🚀 Button hiding script loaded');
            
            // Immediate execution
            hideButtonElements();
            
            // After DOM content loaded
            document.addEventListener('DOMContentLoaded', function() {
              console.log('📄 DOM loaded - running button removal');
              setTimeout(hideButtonElements, 10);
            });
            
            // Multiple delayed executions to catch dynamically added content
            setTimeout(function() {
              console.log('⏰ 100ms delay - running button removal');
              hideButtonElements();
            }, 100);
            
            setTimeout(function() {
              console.log('⏰ 500ms delay - running button removal');
              hideButtonElements();
            }, 500);
            
            setTimeout(function() {
              console.log('⏰ 1000ms delay - final button removal');
              hideButtonElements();
            }, 1000);
            
            // Monitor for new elements being added
            if (typeof MutationObserver !== 'undefined') {
              var observer = new MutationObserver(function(mutations) {
                var shouldRun = false;
                mutations.forEach(function(mutation) {
                  if (mutation.addedNodes.length > 0) {
                    shouldRun = true;
                  }
                });
                if (shouldRun) {
                  console.log('🔄 DOM mutation detected - running button removal');
                  setTimeout(hideButtonElements, 10);
                }
              });
              
              observer.observe(document.body, {
                childList: true,
                subtree: true
              });
              
              console.log('👁️ Mutation observer active');
            }
          </script>
          <div class="page">
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
                  Total fees paid: Rs. ${receiptData.total_paid_till_date ? 
                    Number(receiptData.total_paid_till_date).toLocaleString('en-IN', {minimumFractionDigits: 0, maximumFractionDigits: 0}) : 
                    Number(amountPaidNumber).toLocaleString('en-IN', {minimumFractionDigits: 0, maximumFractionDigits: 0})
                  }
                </div>
                <div class="fee-summary-item">
                  Total fees Due: Rs. ${amountRemaining !== null ? 
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
                  Total fees paid: Rs. ${receiptData.total_paid_till_date ? 
                    Number(receiptData.total_paid_till_date).toLocaleString('en-IN', {minimumFractionDigits: 0, maximumFractionDigits: 0}) : 
                    Number(amountPaidNumber).toLocaleString('en-IN', {minimumFractionDigits: 0, maximumFractionDigits: 0})
                  }
                </div>
                <div class="fee-summary-item">
                  Total fees Due: Rs. ${amountRemaining !== null ? 
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
