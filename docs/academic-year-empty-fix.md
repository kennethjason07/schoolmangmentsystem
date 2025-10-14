# Academic Year Empty Value Fix

## Issue Description
The fee receipt generation system was showing `2024/25` as a fallback value when students had no academic year set in their database record. The client requested that when a student's `academic_year` column is `null` or empty, the receipt should show empty/blank instead of any fallback value.

## Root Cause
The system had fallback logic that would display:
1. Student's academic year (if available)
2. School's academic year (if student's not available) 
3. Current calculated academic year (if neither available)

This caused `2024/25` to appear even when students had no academic year data.

## Solution Implemented

### Before (with fallbacks):
```javascript
${receiptData.student_academic_year || schoolDetails?.academic_year || getCurrentAcademicYear()}
```

### After (no fallbacks):
```javascript
${receiptData.student_academic_year || ''}
```

## Files Modified

### 1. `src/utils/unifiedReceiptTemplate.js`
- **Lines 930 & 1050**: Removed fallback chain, now shows empty when no student academic year
- **Change**: `${receiptData.student_academic_year || schoolDetails?.academic_year || getCurrentAcademicYear()}` → `${receiptData.student_academic_year || ''}`

### 2. `src/utils/cleanPrintReceipt.js`
- **Line 384**: Removed fallback to school academic year and current year
- **Change**: `${receiptData.student_academic_year || schoolDetails?.academic_year || new Date().getFullYear()}` → `${receiptData.student_academic_year || ''}`

### 3. `src/components/UPIQRModal.js`
- **Line 464**: Removed fallback to current academic year
- **Line 512**: Removed fallback when passing academic year to receipt generator
- **Line 524**: Removed fallback in academicYear parameter

### 4. `src/screens/student/FeePayment.js`
- **Line 144**: Removed fallback in empty fee data state
- **Line 523**: Simplified fallback chain to only use student or fee structure data
- **Line 599**: Prioritize student academic year over school academic year

### 5. `src/screens/parent/FeePayment.js`
- **Line 156**: Removed fallback in empty fee data state  
- **Line 504**: Simplified fallback chain to only use student or fee structure data
- **Line 579**: Prioritize student academic year over school academic year

## New Behavior

| Student Academic Year | Receipt Display |
|----------------------|----------------|
| `"2025-26"`          | `2025-26`      |
| `"2024-25"`          | `2024-25`      |
| `null`               | *(empty)*      |
| `undefined`          | *(empty)*      |
| `""`                 | *(empty)*      |

## Database Schema
The fix relies on the existing `students` table structure:
```sql
CREATE TABLE public.students (
  ...
  academic_year text NOT NULL,
  ...
);
```

**Note**: Even though the column is marked `NOT NULL`, it can still contain empty strings or be effectively null through application logic.

## Testing
Updated `test_academic_year_fix.js` to verify:
- Empty academic years display as blank
- No fallback to current year occurs
- Student-specific academic years are preserved
- System handles null/undefined values gracefully

## Impact
- ✅ Receipts now show empty academic year when student has none set
- ✅ No more unwanted `2024/25` fallback values
- ✅ Student-specific academic years still display correctly
- ✅ System respects database state accurately

## Migration Notes
- No database migration required
- Existing students with academic years will continue to show them
- Students without academic years will now show blank instead of fallback values
- School administrators can populate academic years as needed