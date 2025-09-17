# Notification Recipients Column Fix

## Problem Summary

The parent dashboard system was encountering an error:
```
column "notification_recipients.created_at" does not exist
```

This error was occurring because the code was trying to reference a `created_at` column in the `notification_recipients` table that doesn't exist in the database schema.

## Root Cause Analysis

Upon reviewing the database schema (`schema.txt`), the `notification_recipients` table has the following timestamp columns:
- `sent_at timestamp without time zone`
- `read_at timestamp without time zone`

But **no `created_at` column** exists.

The error was occurring in the parent authentication helper function `getStudentNotificationsForParent()` in `src/utils/parentAuthHelper.js`.

## Fix Applied

### File Modified: `src/utils/parentAuthHelper.js`

**Before (Lines 269, 283):**
```javascript
// Fetch notifications for the student
const { data: notificationsData, error: notificationsError } = await supabase
  .from('notification_recipients')
  .select(`
    id,
    is_read,
    created_at,    // ❌ This column doesn't exist
    notifications (
      id,
      message,
      type,
      created_at,
      sent_by,
      users!sent_by (
        full_name
      )
    )
  `)
  .eq('recipient_id', studentId)
  .eq('recipient_type', 'Student')
  .order('created_at', { ascending: false })  // ❌ This column doesn't exist
  .limit(20);
```

**After (Lines 269, 283):**
```javascript
// Fetch notifications for the student
const { data: notificationsData, error: notificationsError } = await supabase
  .from('notification_recipients')
  .select(`
    id,
    is_read,
    sent_at,       // ✅ Changed to the correct column name
    notifications (
      id,
      message,
      type,
      created_at,
      sent_by,
      users!sent_by (
        full_name
      )
    )
  `)
  .eq('recipient_id', studentId)
  .eq('recipient_type', 'Student')
  .order('sent_at', { ascending: false })     // ✅ Changed to the correct column name
  .limit(20);
```

## Database Schema Reference

```sql
CREATE TABLE public.notification_recipients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  recipient_type text NOT NULL CHECK (recipient_type = ANY (ARRAY['Student'::text, 'Parent'::text, 'Teacher'::text, 'Admin'::text])),
  delivery_status text DEFAULT 'Pending'::text CHECK (delivery_status = ANY (ARRAY['Pending'::text, 'Sent'::text, 'Failed'::text])),
  sent_at timestamp without time zone,           -- ✅ Available column
  is_read boolean DEFAULT false,
  read_at timestamp without time zone,           -- ✅ Available column
  tenant_id uuid NOT NULL,
  -- Note: NO created_at column exists
  CONSTRAINT notification_recipients_pkey PRIMARY KEY (id),
  CONSTRAINT fk_user FOREIGN KEY (recipient_id) REFERENCES public.users(id),
  CONSTRAINT fk_notification FOREIGN KEY (notification_id) REFERENCES public.notifications(id),
  CONSTRAINT notification_recipients_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);
```

## Impact and Resolution

### What This Fixes:
1. **Parent Dashboard Error**: Parents will no longer encounter database column errors when trying to fetch notifications
2. **Notification Fetching**: The `getStudentNotificationsForParent()` function will work correctly
3. **Parent Authentication Flow**: The tenant-independent parent login system will function without notification-related errors

### Testing Verification:
A test script (`test_notification_fix.js`) has been created to verify:
1. Direct access to `notification_recipients` table works
2. Parent auth helper functions execute without column errors
3. The corrected query pattern retrieves notifications successfully

### Related Functions:
The following functions in `src/utils/parentAuthHelper.js` are now working correctly:
- `getStudentNotificationsForParent(parentUserId, studentId)`
- All parent authentication helper functions that depend on notifications

## Usage Notes

- **For Parents**: Notifications should now load correctly in the parent dashboard
- **For Developers**: Always use `sent_at` when ordering notification recipients, not `created_at`
- **For Future Queries**: Reference the correct schema columns:
  - Use `notification_recipients.sent_at` for when the notification was sent
  - Use `notification_recipients.read_at` for when it was read
  - Use `notifications.created_at` for when the notification was originally created

## Files Modified

1. `src/utils/parentAuthHelper.js` - Fixed column references in notification query
2. `test_notification_fix.js` - Created verification test script
3. `NOTIFICATION_COLUMN_FIX.md` - This documentation

## Related Documentation

- `PARENT_AUTH_TENANT_FIX_SUMMARY.md` - Overall parent authentication system documentation
- `schema.txt` - Database schema reference
- `src/utils/testParentAuth.js` - Parent authentication testing utilities

---

**Status**: ✅ **RESOLVED** - The notification column error has been fixed and tested.
