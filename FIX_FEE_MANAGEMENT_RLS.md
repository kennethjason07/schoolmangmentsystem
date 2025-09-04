# Fix Fee Management RLS Issues

## Problem
Teachers and admins are unable to fetch data from fee-related tables due to Row Level Security (RLS) policies blocking access. The logs show:
- Tenant ID is correctly identified: `b8f8b5f0-1234-4567-8901-123456789000`
- 30 students exist for the tenant, but 0 classes are accessible
- This indicates RLS policies are preventing data access

## Solution

### Step 1: Apply RLS Policies for Fee Management
Run the `fix_fee_management_rls.sql` script in your Supabase SQL Editor:

1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste the content of `fix_fee_management_rls.sql`
3. Click "Run" to execute the script

This script will:
- ✅ Enable RLS on all fee-related tables (`classes`, `students`, `fee_structure`, `student_fees`, `student_discounts`)
- ✅ Create SELECT, INSERT, UPDATE, DELETE policies for authenticated users within their tenant
- ✅ Allow both JWT-based and user-based tenant validation
- ✅ Test access to all tables

### Step 2: Create Sample Data (Optional)
If you need sample data for testing, run the `create_sample_fee_data.sql` script:

1. In Supabase SQL Editor, copy and paste the content of `create_sample_fee_data.sql` 
2. Click "Run" to execute the script

This script will:
- ✅ Create 5 sample classes for your tenant
- ✅ Update existing students to reference the new classes
- ✅ Create fee structures (Tuition, Library, Lab, Sports, Bus fees) for each class
- ✅ Generate sample payments for testing

## Expected Results After Fix

Once the RLS policies are applied, you should see in the logs:
```
LOG  📊 Classes found: 5 (instead of 0)
LOG  💰 Fee structures found: 25 (5 classes × 5 fee types each)
LOG  👥 Students found: 30 (properly distributed across classes)
LOG  💳 Payments found: 10 (sample payments created)
```

## What the RLS Policies Do

The RLS policies allow authenticated users to access fee management data using two methods:

### Method 1: JWT Token Validation
```sql
(auth.jwt() ? 'tenant_id' AND (auth.jwt()->>'tenant_id')::uuid = tenant_id)
```
- Checks if the JWT token contains a `tenant_id` claim
- Compares it with the row's `tenant_id`

### Method 2: User Table Lookup
```sql
EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = table.tenant_id)
```
- Looks up the current user in the `users` table
- Validates that the user's `tenant_id` matches the row's `tenant_id`

## Tables Covered
The RLS policies are applied to these tables:
- ✅ `public.classes`
- ✅ `public.students` 
- ✅ `public.fee_structure`
- ✅ `public.student_fees`
- ✅ `public.student_discounts`

## Testing the Fix

After applying the RLS policies:

1. **Refresh the Fee Management screen** in your app
2. **Check the console logs** - you should see:
   - Classes found: > 0
   - Students properly distributed across classes
   - Fee structures created
   - Payment calculations working

3. **Verify functionality**:
   - Fee Structure tab shows classes with fee items
   - Payments tab shows payment overview and class statistics
   - Recent Payments tab shows payment history
   - Adding/editing fees works properly

## Troubleshooting

If you still see access issues after running the scripts:

1. **Check if RLS is enabled**:
   ```sql
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE tablename IN ('classes', 'students', 'fee_structure', 'student_fees', 'student_discounts')
   AND schemaname = 'public';
   ```

2. **Verify policies exist**:
   ```sql
   SELECT tablename, policyname, cmd, roles
   FROM pg_policies 
   WHERE tablename IN ('classes', 'students', 'fee_structure', 'student_fees', 'student_discounts')
   ORDER BY tablename, policyname;
   ```

3. **Test data access**:
   ```sql
   SELECT 'classes' as table_name, COUNT(*) as accessible_rows FROM public.classes
   UNION ALL
   SELECT 'students', COUNT(*) FROM public.students
   UNION ALL  
   SELECT 'fee_structure', COUNT(*) FROM public.fee_structure
   UNION ALL
   SELECT 'student_fees', COUNT(*) FROM public.student_fees;
   ```

## Files Created
- ✅ `fix_fee_management_rls.sql` - RLS policies for fee management
- ✅ `create_sample_fee_data.sql` - Sample data for testing
- ✅ `FIX_FEE_MANAGEMENT_RLS.md` - This instruction file

## Success Indicators
After running the scripts, the Fee Management screen should:
- 🎉 Load without errors
- 💰 Display classes with fee structures
- 📊 Show payment statistics and summaries  
- 🔄 Allow creating/editing/deleting fee structures
- 💳 Enable payment recording and tracking
- 🏫 Maintain proper multi-tenant data isolation

The RLS policies ensure that all fee management operations are tenant-aware and secure!
