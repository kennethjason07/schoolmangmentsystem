# Step-by-Step Supabase Storage Setup Guide

Follow these exact steps in your Supabase dashboard:

## Step 1: Create the Bucket

1. Go to your **Supabase Dashboard**
2. Click **Storage** in the left sidebar
3. Click **New bucket** button
4. Fill in:
   - **Name**: `profiles`
   - **Public bucket**: ✅ **MUST be checked**
   - **File size limit**: 50000000 (50MB)
   - **Allowed MIME types**: Leave empty or add: `image/jpeg,image/png,image/webp`
5. Click **Save**

## Step 2: Create Storage Policies

1. Still in **Storage**, click **Policies** tab
2. You should see "No policies created yet" for the profiles bucket
3. Click **New policy** button
4. Create **4 separate policies**:

### Policy 1: Allow Upload
- **Policy name**: `Allow authenticated uploads`
- **Allowed operation**: `INSERT`
- **Target roles**: `authenticated` 
- **Policy definition**:
```sql
bucket_id = 'profiles'
```
- Click **Save policy**

### Policy 2: Allow Read
- **Policy name**: `Allow public read`
- **Allowed operation**: `SELECT`
- **Target roles**: `public` (and `authenticated` if available)
- **Policy definition**:
```sql
bucket_id = 'profiles'
```
- Click **Save policy**

### Policy 3: Allow Update (Optional)
- **Policy name**: `Allow user updates`
- **Allowed operation**: `UPDATE`
- **Target roles**: `authenticated`
- **Policy definition**:
```sql
bucket_id = 'profiles' AND auth.uid()::text = split_part(name, '_', 1)
```
- Click **Save policy**

### Policy 4: Allow Delete (Optional)
- **Policy name**: `Allow user deletes`
- **Allowed operation**: `DELETE`
- **Target roles**: `authenticated`
- **Policy definition**:
```sql
bucket_id = 'profiles' AND auth.uid()::text = split_part(name, '_', 1)
```
- Click **Save policy**

## Step 3: Verify Setup

After creating all policies:
1. Go back to **Storage** → **Buckets**
2. You should see the `profiles` bucket with a 🌐 icon (indicating it's public)
3. Click on the bucket - it should be empty but accessible

## Step 4: Test Upload

Now try uploading a profile image in your app. If it still fails, check the exact error message and we can adjust the policies.

## Common Issues:

- **"Policy not found"**: Make sure the policy names match exactly
- **"Bucket not public"**: Ensure you checked "Public bucket" when creating
- **"INSERT not allowed"**: Double-check the INSERT policy exists and targets `authenticated` role
