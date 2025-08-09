# Supabase Storage Setup via Dashboard (Alternative Method)

If you can't run SQL scripts due to permission issues, you can set up storage through the Supabase dashboard:

## Method 1: Create Bucket via Dashboard

1. **Go to your Supabase Dashboard**
   - Navigate to Storage → Buckets
   - Click "New bucket"

2. **Create the 'profiles' bucket**:
   - Name: `profiles`
   - Public bucket: ✅ **Check this box**
   - File size limit: 50 MB
   - Allowed MIME types: `image/jpeg,image/png,image/webp,image/gif`

3. **Set up RLS Policies**:
   - Go to Storage → Policies
   - Click "New policy" for the `profiles` bucket
   - Create these 4 policies:

### Policy 1: Upload (INSERT)
- **Name**: "Enable upload for authenticated users"
- **Operation**: INSERT
- **Target roles**: authenticated
- **Policy definition**:
```sql
bucket_id = 'profiles'
```

### Policy 2: Read (SELECT) 
- **Name**: "Enable read for all users"
- **Operation**: SELECT
- **Target roles**: public, authenticated
- **Policy definition**:
```sql
bucket_id = 'profiles'
```

### Policy 3: Update
- **Name**: "Enable update for users based on user_id"
- **Operation**: UPDATE
- **Target roles**: authenticated
- **Policy definition**:
```sql
bucket_id = 'profiles' AND auth.uid()::text = split_part(name, '_', 1)
```

### Policy 4: Delete
- **Name**: "Enable delete for users based on user_id" 
- **Operation**: DELETE
- **Target roles**: authenticated
- **Policy definition**:
```sql
bucket_id = 'profiles' AND auth.uid()::text = split_part(name, '_', 1)
```

## Method 2: Disable RLS Temporarily

If the policies still don't work, you can temporarily disable RLS for testing:

1. Go to Storage → Settings
2. Find "Row Level Security" setting
3. Turn it OFF temporarily
4. Test your upload functionality
5. Turn it back ON after confirming it works

## Verify Setup

After setup, verify by:
1. Testing profile image upload in your app
2. Checking if files appear in Storage → profiles bucket
3. Confirming the public URL works
