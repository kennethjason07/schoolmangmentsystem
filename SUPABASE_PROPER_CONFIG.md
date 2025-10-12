# 🔧 SUPABASE PROPER CONFIGURATION

## 🚨 **THE PROBLEM:**
Setting Site URL directly to the reset password page causes Supabase to treat it as a login success, skipping the password reset form.

## ✅ **CORRECT CONFIGURATION:**

### **Step 1: Set Site URL**
1. Go to **Supabase Dashboard** → **Authentication** → **URL Configuration**
2. Set **Site URL** to: `http://localhost:3000`
3. **NOT** to the specific page - just the base domain

### **Step 2: Set Redirect URLs**
In **Additional Redirect URLs** section, add:
- `http://localhost:3000/web/reset-password.html`
- `http://localhost:3000`

### **Step 3: Update Email Template**
In **Authentication** → **Email Templates** → **Reset Password**:
- The `{{ .ConfirmationURL }}` will automatically append the correct path
- It will redirect to: `http://localhost:3000/web/reset-password.html#access_token=...`

## 🎯 **Why This Works:**
- **Site URL** = Base domain for your app
- **Redirect URLs** = Allowed destinations after authentication
- **Token Flow** = User clicks email → Gets redirected with auth token → Reset password page extracts token

## ⚠️ **IMPORTANT:**
The reset password page must handle the authentication token from the URL hash to work properly.