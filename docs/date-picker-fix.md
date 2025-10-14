# Date Picker Timezone Issue Fix

## Problem Description

The date picker in the edit student popup was showing dates one day earlier than selected. For example, when a user selected "6", the date picker would show "5" (the previous day).

## Root Cause

This issue was caused by timezone conversion when using JavaScript's `toISOString()` method to format dates. The `toISOString()` method converts dates to UTC timezone, which can cause dates to shift by several hours or even a full day depending on the user's local timezone.

### Example of the Problem:
```javascript
// User selects June 6, 2024
const selectedDate = new Date(2024, 5, 6, 12, 0, 0); // June 6, 2024 12:00 PM local time

// Old problematic code:
const formattedDate = selectedDate.toISOString().split('T')[0];
// Result: "2024-06-05" (if user is in a timezone ahead of UTC)
```

## The Solution

We implemented timezone-safe date handling by:

1. **Created utility functions** (`src/utils/dateUtils.js`) for consistent date formatting
2. **Updated date pickers** to use local time instead of UTC
3. **Fixed both mobile and web date pickers** to handle dates consistently

### Key Changes:

#### 1. Date Utility Functions
```javascript
// src/utils/dateUtils.js
export const formatDateToYYYYMMDD = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
```

#### 2. Updated Date Picker Handler
```javascript
// Before (problematic):
const formattedDate = selectedDate.toISOString().split('T')[0];

// After (fixed):
const formattedDate = formatDateToYYYYMMDD(selectedDate);
```

#### 3. Safe Date Parsing
```javascript
// Before (problematic):
value={form.dob ? new Date(form.dob) : new Date()}

// After (fixed):
value={form.dob ? (parseYYYYMMDDToDate(form.dob) || new Date()) : new Date()}
```

## Files Modified

1. **`src/screens/admin/ManageStudents.js`**
   - Updated `handleDateChange` function
   - Updated ResponsiveCalendar onDateChange callback
   - Fixed DateTimePicker value initialization
   - Added timezone-safe date handling

2. **`src/utils/dateUtils.js`** (New file)
   - `formatDateToYYYYMMDD()` - Convert Date to YYYY-MM-DD string
   - `parseYYYYMMDDToDate()` - Parse YYYY-MM-DD string to Date
   - `formatDateForDisplay()` - Format for display (DD/MM/YYYY)
   - `calculateAge()` - Calculate age from date of birth
   - Other utility functions

3. **`src/utils/dateUtils.test.js`** (New file)
   - Test suite to verify the fix works correctly

## Benefits

1. **Cross-timezone compatibility** - Works correctly regardless of user's timezone
2. **Consistent behavior** - Same results on web and mobile platforms
3. **Reusable utilities** - Can be used throughout the application
4. **Proper testing** - Includes test suite to verify functionality

## How to Verify the Fix

1. Open the edit student popup
2. Select any date (e.g., "6th of any month")
3. Verify that the selected date appears correctly as "6" and not "5"
4. Test on both web and mobile platforms
5. Test with different timezones (if possible)

## Usage in Other Parts of the Application

Other date pickers throughout the application should be updated to use these utility functions:

```javascript
import { formatDateToYYYYMMDD, parseYYYYMMDDToDate } from '../utils/dateUtils';

// When formatting dates for storage:
const formattedDate = formatDateToYYYYMMDD(selectedDate);

// When parsing stored dates for display:
const dateObject = parseYYYYMMDDToDate(storedDateString);
```

## Technical Notes

- The fix uses local timezone methods (`getFullYear()`, `getMonth()`, `getDate()`) instead of UTC methods
- Date strings are consistently stored in YYYY-MM-DD format
- The `parseYYYYMMDDToDate()` function manually constructs Date objects to avoid timezone parsing issues
- All date operations maintain timezone consistency

This fix ensures that date selection works correctly for users in all timezones and provides a consistent experience across web and mobile platforms.