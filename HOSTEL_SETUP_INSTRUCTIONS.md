# 🚀 Quick Setup Instructions

## ❌ Current Issue
Your app is showing these errors because the hostel database tables don't exist yet:
```
ERROR: relation "public.hostels" does not exist
ERROR: relation "public.hostel_applications" does not exist
ERROR: relation "public.hostel_allocations" does not exist
ERROR: relation "public.hostel_maintenance_logs" does not exist
```

## ✅ How to Fix

### Step 1: Create the Database Tables

**Option A: Using Supabase Dashboard (Recommended)**

1. Open your **Supabase project dashboard**
2. Go to **SQL Editor** (in the left sidebar)
3. Create a **new query**
4. **Copy and paste** the entire content from this file:
   ```
   database/hostel_schema.sql
   ```
5. **Click "Run"** to execute the SQL

**Option B: Using Supabase CLI (Alternative)**
```bash
# If you have Supabase CLI installed
supabase db push
```

### Step 2: Verify Tables Were Created

In Supabase Dashboard → **Table Editor**, you should now see these new tables:
- ✅ `hostels`
- ✅ `hostel_blocks` 
- ✅ `hostel_rooms`
- ✅ `hostel_beds`
- ✅ `hostel_applications`
- ✅ `hostel_allocations`
- ✅ `hostel_bed_history`
- ✅ `hostel_waitlist`
- ✅ `hostel_maintenance_logs`
- ✅ `hostel_fees`

### Step 3: Add Sample Data (Optional)

If you want to test with sample data:

1. Go back to **SQL Editor**
2. Run this file:
   ```
   database/hostel_sample_data.sql
   ```

### Step 4: Test the App

1. **Restart your app:**
   ```bash
   npx expo start
   ```

2. **Login as admin**

3. **Click "Hostel Management"** in the admin dashboard

## 🎯 What You'll See After Setup

- **📊 Overview Stats**: Total hostels, capacity, occupied, available beds
- **📝 Applications**: Pending, approved, waitlisted applications  
- **⚡ Quick Actions**: Add hostel, view applications
- **🏢 Hostels List**: Your hostel buildings
- **📝 Recent Applications**: Student applications for review
- **🛏️ Current Allocations**: Active bed assignments
- **🔧 Maintenance Issues**: Facility maintenance requests

## 🆘 Need Help?

If you're still having issues:

1. **Check the browser console** for detailed error messages
2. **Verify your Supabase connection** is working
3. **Ensure the SQL script ran successfully** without errors
4. **Check that all tables were created** in Table Editor

## 📁 File Locations

- Database Schema: `database/hostel_schema.sql`
- Sample Data: `database/hostel_sample_data.sql`
- Setup Guide: `database/HOSTEL_SETUP_GUIDE.md`
- This File: `HOSTEL_SETUP_INSTRUCTIONS.md`

---

**Once you run the SQL schema, the errors will disappear and the hostel management system will work perfectly!** 🎉