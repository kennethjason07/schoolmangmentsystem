# 🌐 Web Version - Class Deletion Debug Guide

Since you're using the web version, here's how to debug the class deletion issue:

## 🔍 **Step 1: Open Browser Developer Tools**

1. **Open your web app** in the browser
2. **Press F12** or right-click and select "Inspect"
3. **Go to the Console tab**
4. Navigate to the **Manage Classes** screen

## 🧪 **Step 2: Test the Debug Button**

1. Look for the **red "🧪 Test Delete" button** next to each Delete button
2. **Click the test button** for any class
3. **Check both**:
   - The alert dialog that appears
   - The console messages (they start with 🧪, 🏢, ✅, or ❌)

## 🗑️ **Step 3: Test Regular Delete**

1. **Click the regular "Delete" button**
2. **Watch the console** for messages starting with:
   - 🔍 Delete button pressed
   - 🗑️ handleDeleteClass called
   - 🗑️ User confirmed deletion

## 📊 **What to Check:**

### **A. Does the delete confirmation dialog appear?**
- ✅ YES → The function is being called, issue is in the deletion process
- ❌ NO → There's a JavaScript error preventing the function from running

### **B. Console Error Messages:**
Look for these specific patterns:

```
❌ Access denied: row-level security
→ SOLUTION: RLS policy issue in Supabase

❌ Permission denied
→ SOLUTION: Database user permissions issue

❌ No tenant ID found
→ SOLUTION: Tenant context not properly initialized

❌ Failed to delete [table_name]
→ SOLUTION: Specific table has constraints or permissions issue
```

## 🔧 **Manual Console Tests**

Paste these commands in your browser console (while on Manage Classes screen):

### Test 1: Check if functions are available
```javascript
console.log('Function availability:', {
  handleDeleteClass: typeof handleDeleteClass,
  supabase: typeof supabase,
  tenantId: window.tenantId || 'not found',
  user: window.user || 'not found'
});
```

### Test 2: Check tenant context
```javascript
// This will show current tenant state
console.log('Current component state (if accessible):', {
  tenantReady: window.tenantReady || 'unknown',
  tenantLoading: window.tenantLoading || 'unknown'
});
```

### Test 3: Direct Supabase test (if supabase is available globally)
```javascript
if (typeof supabase !== 'undefined') {
  supabase.from('classes').select('id, class_name').limit(1)
    .then(result => console.log('✅ Supabase connection test:', result))
    .catch(error => console.log('❌ Supabase connection error:', error));
} else {
  console.log('❌ Supabase not available globally');
}
```

## 🚨 **Common Web-Specific Issues:**

### **Issue 1: React Hot Reload Problems**
- **Symptom**: Functions not updating after code changes
- **Solution**: Hard refresh the page (Ctrl+F5)

### **Issue 2: Build Cache Issues**
- **Symptom**: Old code still running
- **Solution**: Clear browser cache or restart the development server

### **Issue 3: Console Errors Blocking Execution**
- **Symptom**: Silent failures, no logs appear
- **Solution**: Check for JavaScript errors in console (red error messages)

### **Issue 4: Network Issues**
- **Symptom**: Requests failing silently
- **Solution**: Check the Network tab in developer tools

## 📋 **Troubleshooting Checklist:**

- [ ] Developer console is open and visible
- [ ] No JavaScript errors showing in console (red messages)
- [ ] Test button is visible and clickable
- [ ] Clicking test button shows an alert dialog
- [ ] Console shows debug messages when buttons are clicked
- [ ] Network tab shows requests being made to Supabase

## 🔄 **If Nothing Works:**

Try this emergency reset:

1. **Stop your development server** (Ctrl+C in terminal)
2. **Clear cache**: Delete node_modules/.cache if it exists
3. **Restart**: `npm start` or `yarn start`
4. **Hard refresh browser**: Ctrl+F5

## 📞 **Report Back With:**

Please tell me:

1. **What does the 🧪 Test Delete button show in the alert?**
2. **What console messages appear when you click delete?**
3. **Any red error messages in the console?**
4. **Does the delete confirmation dialog appear at all?**

This will help me identify the exact issue!