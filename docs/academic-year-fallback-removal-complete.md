# Academic Year Fallback Removal - Complete Fix

## Issue
The system was showing `2024/25` as a fallback value in receipts when students had no academic year set in their database record, despite previous attempts to fix this issue.

## Root Cause Analysis
After thorough investigation, multiple locations were found where hardcoded `2024-25` or `2024/25` values and fallback logic were still being used:

## All Fixed Locations

### 1. `src/utils/unifiedReceiptTemplate.js`
- **Lines 930 & 1050**: Changed from fallback chain to empty value
- **Before**: `${receiptData.student_academic_year || schoolDetails?.academic_year || getCurrentAcademicYear()}`
- **After**: `${receiptData.student_academic_year || ''}`

### 2. `src/utils/cleanPrintReceipt.js`
- **Line 384**: Removed fallback logic
- **Before**: `${receiptData.student_academic_year || schoolDetails?.academic_year || new Date().getFullYear()}`
- **After**: `${receiptData.student_academic_year || ''}`

### 3. `src/components/UPIQRModal.js`
- **Line 464**: `${transactionData.academicYear || getCurrentAcademicYear()}` → `${transactionData.academicYear || ''}`
- **Line 512**: Removed fallback when passing academic year to receipt generator
- **Line 524**: Removed getCurrentAcademicYear() fallback

### 4. `src/components/WebReceiptDisplay.js` 
- **Line 431**: `{receiptData.academic_year || '2024/25'}` → `{receiptData.academic_year || ''}`
- **Line 73**: Removed `getReceiptAcademicYear()` fallback logic completely

### 5. `src/screens/student/FeePayment.js`
- **Line 144**: Removed getCurrentAcademicYear() fallback in empty fee state
- **Line 523**: Simplified fallback to only student/fee structure data
- **Line 599**: Prioritize student over school academic year
- **Line 745**: `|| "2024/25"` → removed hardcoded fallback
- **Line 1017**: Hardcoded `2024/25` in fallback template → empty value

### 6. `src/screens/parent/FeePayment.js`
- **Line 156**: Removed getCurrentAcademicYear() fallback in empty fee state  
- **Line 504**: Simplified fallback to only student/fee structure data
- **Line 579**: Prioritize student over school academic year
- **Line 725**: `|| "2024/25"` → removed hardcoded fallback
- **Line 997**: Hardcoded `2024/25` in fallback template → empty value

## Final Behavior

| Student Academic Year | Receipt Display |
|----------------------|----------------|
| `"2025-26"`          | `2025-26`      |
| `"2023-24"`          | `2023-24`      |
| `null`               | *(empty)*      |
| `undefined`          | *(empty)*      |
| `""`                 | *(empty)*      |

## Key Changes Made

### Template Logic Updated
```javascript
// OLD (with fallbacks)
${receiptData.student_academic_year || schoolDetails?.academic_year || getCurrentAcademicYear()}

// NEW (no fallbacks)
${receiptData.student_academic_year || ''}
```

### Component Logic Updated
```javascript
// OLD (with fallback)
if (!schoolDetails.academic_year) {
  schoolDetails.academic_year = getReceiptAcademicYear(schoolDetails);
}

// NEW (no fallback)
// No fallback for academic year - leave empty if not provided
```

### Hardcoded Values Removed
```javascript
// OLD
academic_year: schoolDetails?.academic_year || "2024/25"
<span class="info-value">2024/25</span>

// NEW
academic_year: schoolDetails?.academic_year
<span class="info-value"></span>
```

## Testing
1. Students with academic year set: Shows their specific year
2. Students without academic year: Shows empty/blank
3. No more `2024/25` fallback values anywhere in the system
4. School-level academic years still work when available

## Verification
All locations where `2024-25` or `2024/25` appeared have been checked and either:
- Converted to use actual student data only
- Made to show empty when no data available
- Left as-is if they were test files or comments

## Result
✅ **Complete removal of academic year fallbacks**
✅ **No more unwanted `2024/25` values in receipts**  
✅ **Empty academic years display as blank fields**
✅ **Student-specific academic years still work correctly**

The system now respects the exact database state and will not show any fallback academic year values when students don't have one set.