# 🔧 Complete Supabase Configuration Guide

## 🎯 **HTML File Location:**
- **File:** `reset-password.html`
- **Path:** `C:\Maximus\schoolmangmentsystem\web\reset-password.html`
- **URL:** `http://localhost:3000/web/reset-password.html`

---

## 📋 **Step-by-Step Supabase Update:**

### **Step 1: Access Supabase Dashboard**
1. Open your web browser
2. Go to: **https://app.supabase.com**
3. Sign in with your Supabase account
4. You'll see your projects dashboard

### **Step 2: Select Your Project**
1. Look for your project named similar to: **"School Management System"** or **"dmagnsbdjsnzsddxqrwd"**
2. Click on your project to open it
3. You should see the project dashboard with various options in the left sidebar

### **Step 3: Navigate to Authentication Settings**
1. In the **left sidebar**, click **"Authentication"**
2. You'll see several tabs at the top
3. Click the **"Settings"** tab (not "Users" or "Policies")
4. Scroll down to find the configuration sections

### **Step 4: Find Site URL Configuration**
1. Look for a section called **"Site URL"** or **"General Settings"**
2. You should see a field labeled **"Site URL"**
3. This field currently contains: `https://maximus-email-verificatiion.vercel.app`

### **Step 5: Update Site URL**
1. **Clear the existing URL:** Remove `https://maximus-email-verificatiion.vercel.app`
2. **Enter new URL:** Type `http://localhost:3000`
3. **Click "Save"** or **"Update"** button

### **Step 6: Find Redirect URLs Section**
1. Look for **"Additional Redirect URLs"** or **"Redirect URLs"** section
2. This section allows multiple URLs for redirecting after authentication

### **Step 7: Update Redirect URLs**
1. **Remove existing URL:** Delete `https://maximus-email-verificatiion.vercel.app` if it's there
2. **Add new URLs:** Add these two URLs:
   - `http://localhost:3000`
   - `http://localhost:3000/web/reset-password.html`
3. **Click "Save"** after adding each URL

### **Step 8: Check Email Templates (Important!)**
1. Still in Authentication settings, look for **"Email Templates"** tab
2. Click on **"Email Templates"** tab
3. Click on **"Reset Password"** template
4. Make sure the template contains: `{{ .ConfirmationURL }}`
5. The template should redirect users to the reset link correctly
6. **Click "Save"** if you make any changes

### **Step 9: Test the Configuration**
1. Go to your React Native app
2. Navigate to the forgot password screen
3. Enter a valid email address (your own email for testing)
4. Click **"Send Reset Link"**
5. Check your email inbox (and spam folder)

### **Step 10: Verify Email Redirect**
1. Open the password reset email
2. Click the reset link in the email
3. **Expected Result:** Should open `http://localhost:3000/web/reset-password.html`
4. **Wrong Result:** Still opens the Vercel email verification page

---

## 🖼️ **What You Should See:**

### **In Supabase Dashboard:**
- **Authentication → Settings**
- **Site URL:** `http://localhost:3000`
- **Additional Redirect URLs:**
  - `http://localhost:3000`
  - `http://localhost:3000/web/reset-password.html`

### **After Email Link Click:**
- **URL:** `http://localhost:3000/web/reset-password.html`
- **Page:** Beautiful reset password form with MAXIMUS branding
- **Features:** Password strength meter, show/hide toggles, animations

---

## ⚠️ **Troubleshooting:**

### **If Email Still Redirects to Vercel:**
1. **Wait 2-3 minutes** - Supabase settings take time to propagate
2. **Clear browser cache** - Old settings might be cached
3. **Try incognito mode** - To avoid browser cache issues
4. **Request a new reset email** - Old links use old settings

### **If You Can't Find Settings:**
1. Make sure you're in the **correct project**
2. Look for **"Auth"** instead of "Authentication"
3. Check if settings are under **"Configuration"** tab
4. Try refreshing the Supabase dashboard page

### **If Save Button Doesn't Work:**
1. Make sure URLs are properly formatted: `http://localhost:3000`
2. Don't include trailing slashes
3. Use `http://` not `https://` for localhost
4. Try adding URLs one at a time

---

## 🎉 **Success Indicators:**

### **Configuration Success:**
- ✅ Site URL shows: `http://localhost:3000`
- ✅ Redirect URLs include your local HTML file
- ✅ Settings saved without errors

### **Function Success:**
- ✅ Email reset link opens your custom page
- ✅ Reset password form appears with MAXIMUS branding
- ✅ Password can be updated successfully
- ✅ Success animation plays and redirects to login

---

## 🔄 **For Production Later:**

When you deploy your app to production, update these URLs:
- **Site URL:** `https://yourdomain.com`
- **Redirect URLs:** 
  - `https://yourdomain.com`
  - `https://yourdomain.com/web/reset-password.html`

---

## 📞 **Need Help?**

If you encounter issues:
1. Double-check all URLs for typos
2. Make sure you're editing the correct project
3. Wait a few minutes after saving settings
4. Try the reset process with a fresh email request

**Remember:** The HTML file is already created and ready at `web/reset-password.html`. You just need to update the Supabase settings to redirect there instead of the Vercel page!