# 🧹 Storage Cleanup Instructions

## Delete the student-photos Storage Bucket

### Step 1: Delete Bucket Contents
1. Go to your **Supabase Dashboard**
2. Navigate to **Storage** in the left sidebar
3. Click on the **student-photos** bucket (if it exists)
4. **Delete all files** in the bucket (if any exist)

### Step 2: Delete Storage Policies
1. While in the storage section, click on the **student-photos** bucket
2. Go to the **Policies** tab
3. **Delete all policies** related to student-photos:
   - `Allow authenticated upload`
   - `Allow public view` 
   - `Allow authenticated update`
   - `Allow authenticated delete`
   - Any other policies you created

### Step 3: Delete the Bucket
1. Go back to **Storage** main page
2. Find the **student-photos** bucket
3. Click the **⋮** (three dots) menu next to it
4. Select **Delete bucket**
5. Confirm deletion

## Alternative: SQL Cleanup (if needed)
If you have trouble deleting through the UI, you can also run this SQL:

```sql
-- Delete storage objects (if any exist)
DELETE FROM storage.objects WHERE bucket_id = 'student-photos';

-- Delete storage policies
DELETE FROM storage.policies WHERE bucket_id = 'student-photos';

-- Delete the bucket
DELETE FROM storage.buckets WHERE id = 'student-photos';
```

## Verification
After cleanup, verify that:
- ✅ No **student-photos** bucket exists in Storage
- ✅ No related storage policies exist
- ✅ Database cleanup script has been run
- ✅ Old PhotoUpload files have been deleted

---

**You're now ready for a fresh start! 🎉**