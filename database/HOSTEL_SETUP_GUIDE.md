# Hostel Management System Setup Guide

## 🏠 Overview

This guide will help you set up the complete hostel management system for your school management application.

## 📋 Prerequisites

- Your existing school management system is working
- You have access to your Supabase database
- Admin users can log into the system

## 🚀 Setup Steps

### 1. Create Database Schema

Run the following SQL file in your Supabase SQL Editor or database client:

```sql
-- Execute this file first
database/hostel_schema.sql
```

This will create:
- ✅ All hostel-related tables (hostels, blocks, rooms, beds, applications, etc.)
- ✅ Row-level security policies for tenant isolation
- ✅ Database views for reporting
- ✅ Triggers for automatic occupancy updates
- ✅ Warden role for all tenants

### 2. Add Sample Data (Optional)

If you want to test the system with sample data, run:

```sql
-- Execute this file after the schema
database/hostel_sample_data.sql
```

**Note:** Edit the tenant name in the sample data file if your school is not named "Default School"

### 3. Test the Application

1. **Start your app:**
   ```bash
   npx expo start
   ```

2. **Login as Admin:**
   - Use your existing admin credentials

3. **Navigate to Hostel Management:**
   - Look for the new "Hostel" tab in the admin interface
   - Or use "Hostel Management" from Quick Actions

## 🎯 Features Available

### Admin Dashboard Integration
- **New Hostel Tab:** Dedicated hostel management section
- **Quick Actions:** Direct access to hostel management
- **Unified Dashboard:** All hostel functions in one place

### Hostel Management Features
- **📊 Statistics:** View occupancy, applications, and maintenance
- **🏢 Manage Hostels:** Add/edit hostel buildings
- **📝 Applications:** Review and approve student applications
- **🛏️ Bed Allocations:** Track current room and bed assignments
- **🔧 Maintenance:** Monitor facility issues and repairs

### Stat Cards Display
1. **Total Hostels** - Number of hostel buildings
2. **Total Capacity** - Total available beds
3. **Occupied** - Currently occupied beds
4. **Available** - Available beds
5. **Pending Applications** - Applications waiting for review
6. **Approved Applications** - Approved applications
7. **Waitlisted Applications** - Students on waiting list
8. **Maintenance Issues** - Active maintenance requests

## 🔧 Troubleshooting

### Common Issues

**1. Database Connection Errors**
- Ensure your Supabase connection is working
- Check if the schema was applied correctly

**2. Permission Errors**
- Verify Row Level Security policies are working
- Check that the admin user has proper tenant access

**3. Empty Data**
- Run the sample data script if you want test data
- Ensure the tenant name matches in the sample data script

**4. Navigation Issues**
- Clear app cache and restart
- Check that all imports are correct

## 📈 Next Steps

After setup, you can:

1. **Add Real Hostels:** Use the "Add Hostel" feature
2. **Configure Blocks and Rooms:** Set up your actual facility structure
3. **Student Applications:** Students can apply for hostel accommodation
4. **Manage Allocations:** Assign beds to approved students
5. **Track Maintenance:** Log and resolve facility issues

## 🆘 Support

If you encounter any issues:

1. Check the browser console for error messages
2. Verify the database schema was created correctly
3. Ensure all required tables exist
4. Check that the tenant context is properly set

## 📱 Mobile Testing

The hostel management system is fully responsive and works on:
- ✅ Web browsers
- ✅ Mobile devices (iOS/Android via Expo)
- ✅ Desktop applications

## 🔐 Security

The system includes:
- ✅ Multi-tenant row-level security
- ✅ Admin role-based access control  
- ✅ Secure API endpoints
- ✅ Tenant isolation for all data

---

**🎉 Congratulations!** Your hostel management system is now integrated with your school management application.