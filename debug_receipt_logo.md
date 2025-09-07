# Debug Receipt Logo Issue

## Current Receipt Logo Flow:
1. `fetchSchoolData()` loads school details from `school_details` table
2. `generateReceiptHTML()` calls `getSchoolLogoBase64(schoolData.logo_url)`
3. `getSchoolLogoBase64()` processes the logo URL and returns base64

## Potential Issues:
1. **schoolData might be null or incomplete**
2. **logo_url might be empty or invalid**
3. **getSchoolLogoBase64 might be failing silently**
4. **Logo file might not be accessible**

## Debug Steps:
1. Check if schoolData is loaded properly
2. Check if logo_url exists and is valid
3. Add debug logs to getSchoolLogoBase64
4. Check if the logo file is accessible from the URL

## Current Code Location:
- Receipt generation: `/src/screens/parent/FeePayment.js` lines 1531-1538
- Logo utility: `/src/utils/logoUtils.js`
- School data fetch: `/src/screens/parent/FeePayment.js` lines 53-71
