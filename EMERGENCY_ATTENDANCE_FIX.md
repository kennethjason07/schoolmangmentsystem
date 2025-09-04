# EMERGENCY ATTENDANCE FIX

## Problem
You're getting error `42P10` because the database constraint doesn't match the code's `onConflict` specification.

## Immediate Solution (Choose One)

### Option 1: Quick Code Fix (Fastest - Use This First)

Update the `TakeAttendance.js` file to match the current database constraint:

**File:** `src/screens/teacher/TakeAttendance.js`
**Line:** Around line 267

**Change this:**
```javascript
.upsert(attendanceRecords, {
  onConflict: 'student_id,date,tenant_id',
  ignoreDuplicates: false
});
```

**To this:**
```javascript
.upsert(attendanceRecords, {
  onConflict: 'student_id,date',
  ignoreDuplicates: false
});
```

**AND remove tenant_id from the records:**
Around line 259, change:
```javascript
const attendanceRecords = explicitlyMarkedStudents.map(student => ({
  student_id: student.id,
  class_id: selectedClass,
  date: selectedDate,
  status: attendanceMark[student.id],
  marked_by: user.id,
  tenant_id: teacherInfo.tenant_id // Remove this line
}));
```

**To:**
```javascript
const attendanceRecords = explicitlyMarkedStudents.map(student => ({
  student_id: student.id,
  class_id: selectedClass,
  date: selectedDate,
  status: attendanceMark[student.id],
  marked_by: user.id
  // tenant_id removed - not needed yet
}));
```

### Option 2: Database Migration (Better Long-term Solution)

If you have access to your database, run this SQL:

```sql
-- First, check current constraint
SELECT constraint_name FROM information_schema.table_constraints 
WHERE table_name = 'student_attendance' AND constraint_type = 'UNIQUE';

-- If you see 'unique_attendance_per_day', run this migration:

BEGIN;

-- Add tenant_id column if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'student_attendance' AND column_name = 'tenant_id'
    ) THEN
        -- Get first tenant ID as default
        DECLARE default_tenant_id UUID;
        BEGIN
            SELECT id INTO default_tenant_id FROM tenants LIMIT 1;
            
            -- Add column with default value
            ALTER TABLE student_attendance ADD COLUMN tenant_id UUID;
            
            -- Update existing records
            UPDATE student_attendance SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
            
            -- Make it NOT NULL
            ALTER TABLE student_attendance ALTER COLUMN tenant_id SET NOT NULL;
            
            -- Add foreign key
            ALTER TABLE student_attendance 
            ADD CONSTRAINT student_attendance_tenant_id_fkey 
            FOREIGN KEY (tenant_id) REFERENCES tenants(id);
        END;
    END IF;
END $$;

-- Update the unique constraint
DROP CONSTRAINT IF EXISTS unique_attendance_per_day;
ALTER TABLE student_attendance 
ADD CONSTRAINT unique_attendance_per_day_tenant 
UNIQUE (student_id, date, tenant_id);

COMMIT;
```

## Recommended Steps

1. **Try Option 1 First** (Quick code fix):
   - Update the JavaScript code as shown above
   - Test attendance submission
   - This should fix the immediate error

2. **Later, implement Option 2** for proper tenant support:
   - Run the database migration
   - Update the code back to include `tenant_id`
   - This gives you proper multi-tenant support

## Files to Update for Option 1

### File 1: `src/screens/teacher/TakeAttendance.js`

Find these two sections and make the changes:

**Section 1 - Around line 259:**
```javascript
// BEFORE:
tenant_id: teacherInfo.tenant_id // Include tenant_id for multi-tenant support

// AFTER: (remove this line completely)
```

**Section 2 - Around line 267:**
```javascript
// BEFORE:
onConflict: 'student_id,date,tenant_id',

// AFTER:
onConflict: 'student_id,date',
```

## Testing

After making the changes:

1. Save the file
2. Restart your development server
3. Go to Teacher Login → Take Attendance
4. Select a class and date
5. Mark some students present/absent
6. Click "Submit Attendance"
7. Should work without the error!

## Why This Happens

The error occurs because:
- Your database has constraint: `UNIQUE (student_id, date)`
- Your code tries to use: `UNIQUE (student_id, date, tenant_id)`
- PostgreSQL can't find a constraint that matches the code's specification

The fix aligns the code with your current database structure.
