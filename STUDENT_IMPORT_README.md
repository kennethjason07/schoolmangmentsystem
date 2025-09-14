# Student Data Import Guide

## Overview
This guide helps you import student data from your Excel file "STUDENT LIST 2025 -26 Global.xlsx" into your database with the correct tenant_id: `9abe534f-1a12-474c-a387-f8795ad3ab5a`.

## Files Created
1. **`import_students_supabase.py`** - Main import script for Supabase
2. **`import_students.py`** - Alternative script for local PostgreSQL
3. **`examine_excel.py`** - Utility to examine Excel file structure

## Quick Start (Supabase)

### Step 1: Verify Credentials File
The script automatically reads from `credentials.txt`. Make sure it contains:

```
project url: https://your-project.supabase.co
anon key: your-anon-key-here
```

**Your credentials.txt is already configured with:**
- Project URL: https://dmagnsbdjsnzsddxqrwd.supabase.co
- Anon key: (loaded from file)

✅ **No manual configuration needed!**

### Step 2: Run the Import
```bash
python import_students_supabase.py
```

### Step 3: Confirm Import
The script will show:
- Configuration summary
- Ask for confirmation
- Process all ~700 student records
- Assign them to tenant_id: `9abe534f-1a12-474c-a387-f8795ad3ab5a`
- Create default classes if needed
- Verify the import

## What the Script Does

### Data Processing
- Reads the Excel file and skips the header row
- Maps columns correctly:
  - Student Name → `name`
  - Father Name → stored in `remarks`
  - Mobile/Alternate Mobile → stored in `remarks`
  - Gender → `gender` (converts M/F to Male/Female)
  - Date of Birth → `dob`
  - Address → `address`
  - Religion → `religion`
  - Caste → `caste` (maps to allowed values: BC, SC, ST, OC, Other)

### Database Operations
- Creates unique UUIDs for each student
- Assigns the specified tenant_id to all records
- Sets academic_year to "2025-26"
- Creates a default class if none exist
- Handles missing data gracefully
- Imports in batches of 50 students

### Data Validation
- Ensures required fields are populated
- Truncates long text to fit database constraints
- Converts dates to proper format
- Maps gender and caste values to allowed options
- Generates admission numbers for missing ones

## Expected Results

After successful import, you should have:
- ~700 student records in your `students` table
- All records with tenant_id: `9abe534f-1a12-474c-a387-f8795ad3ab5a`
- Academic year set to "2025-26"
- Default class created if no classes existed
- Parent contact information stored in remarks field

## Troubleshooting

### Common Issues

1. **"Credentials Loading Failed" Error**
   - Solution: Ensure credentials.txt exists and has the correct format
   - Check that the file contains both 'project url:' and 'anon key:' lines

2. **"Permission Denied" Error**
   - Solution: Check your Supabase RLS policies allow inserts for authenticated users

3. **"Column doesn't exist" Error**
   - Solution: Verify your database schema matches the expected structure

4. **Excel File Not Found**
   - Solution: Ensure "STUDENT LIST 2025 -26 Global.xlsx" is in the same directory

### Verification Steps

After import, verify the data:

```sql
-- Count total students for your tenant
SELECT COUNT(*) FROM students WHERE tenant_id = '9abe534f-1a12-474c-a387-f8795ad3ab5a';

-- Check sample records
SELECT name, admission_no, gender, dob, address 
FROM students 
WHERE tenant_id = '9abe534f-1a12-474c-a387-f8795ad3ab5a' 
LIMIT 10;

-- Check if classes were created
SELECT id, class_name, section 
FROM classes 
WHERE tenant_id = '9abe534f-1a12-474c-a387-f8795ad3ab5a';
```

## Alternative: Local PostgreSQL

If you're using a local PostgreSQL database instead of Supabase:

1. Use `import_students.py` instead
2. Update the database configuration:
   ```python
   DB_CONFIG = {
       'host': 'your-host',
       'database': 'your-database',
       'user': 'your-username',
       'password': 'your-password',
       'port': '5432'
   }
   ```
3. Run: `python import_students.py`

## Support

If you encounter issues:
1. Check the console output for specific error messages
2. Verify your database schema matches expectations
3. Ensure your Supabase credentials are correct
4. Check RLS policies allow data insertion

The script provides detailed logging to help diagnose any issues.

## Next Steps

After successful import:
1. Verify the data in your application
2. Create parent records if needed (using mobile numbers from remarks)
3. Assign students to appropriate classes
4. Set up any additional student relationships
