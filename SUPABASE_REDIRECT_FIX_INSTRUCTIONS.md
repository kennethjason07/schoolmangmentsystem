# 🔧 Fix Supabase Redirect URL - Step by Step Instructions

## 🚨 **URGENT FIX REQUIRED**

Your forgot password emails are currently redirecting to:
❌ **Wrong:** `https://maximus-email-verificatiion.vercel.app/`
✅ **Should be:** Your local application URL

---

## 📋 **STEP-BY-STEP FIX:**

### **Step 1: Access Supabase Dashboard**
1. Open your browser and go to: **https://app.supabase.com**
2. Sign in with your account
3. Select your project: **`dmagnsbdjsnzsddxqrwd`** (School Management System project)

### **Step 2: Navigate to Authentication Settings**
1. In the left sidebar, click **"Authentication"**
2. Click the **"Settings"** tab (not URL Configuration)
3. Scroll down to find the **"Site URL"** and **"Redirect URLs"** section

### **Step 3: Update Site URL**
1. Look for **"Site URL"** field
2. Change it from: `https://maximus-email-verificatiion.vercel.app`
3. Change it to: `http://localhost:3000` (for development)
4. Click **"Save"**

### **Step 4: Update Redirect URLs**
1. Look for **"Additional Redirect URLs"** section
2. **REMOVE:** `https://maximus-email-verificatiion.vercel.app`
3. **ADD:** `http://localhost:3000/web/reset-password.html`
4. **ADD:** `http://localhost:3000`
5. Click **"Save"**

### **Step 5: Update Email Templates (Important!)**
1. Still in Authentication settings, click **"Email Templates"** tab
2. Click on **"Reset Password"** template
3. Make sure the template contains: `{{ .ConfirmationURL }}`
4. The subject should be something like: "Reset Your Password"
5. The body should contain a link like: `<a href="{{ .ConfirmationURL }}">Reset Password</a>`
6. Click **"Save"**

### **Step 6: Test the Fix**
1. Go to your React Native app's forgot password screen
2. Enter a valid email address
3. Click "Send Reset Link"
4. Check your email inbox (and spam folder)
5. Click the reset link in the email
6. It should now open your local reset password page: `http://localhost:3000/web/reset-password.html`

---

## 🎯 **WHAT EACH URL SHOULD BE:**

### **For Development:**
- Site URL: `http://localhost:3000`
- Redirect URLs: 
  - `http://localhost:3000`
  - `http://localhost:3000/web/reset-password.html`

### **For Production (when you deploy):**
- Site URL: `https://yourdomain.com`
- Redirect URLs: 
  - `https://yourdomain.com`
  - `https://yourdomain.com/web/reset-password.html`

---

## ⚠️ **IMPORTANT NOTES:**

1. **Email Link Expiration:** Password reset links expire after 1 hour by default
2. **Test with Fresh Links:** Always request a new password reset for testing
3. **Clear Browser Cache:** Clear cache if you experience issues
4. **Check Spam Folder:** Sometimes reset emails go to spam

---

## 🔍 **HOW TO VERIFY IT'S WORKING:**

### Before Fix:
- Email redirects to: `https://maximus-email-verificatiion.vercel.app/#error=...`
- Shows "Email link is invalid or has expired"
- Wrong page with different styling

### After Fix:
- Email redirects to: `http://localhost:3000/web/reset-password.html`
- Shows your custom reset password form
- Matches your app's branding and colors
- Allows user to set new password
- Shows success animation and redirects to login

---

## 🚫 **WHY THIS HAPPENED:**

Your Supabase project was configured with a Vercel deployment URL for email verification. This setting **overrides** any `redirectTo` parameter in your code. Supabase dashboard settings always take precedence over code configuration.

---

## 📞 **NEED HELP?**

If you encounter any issues:

1. **Double-check the URLs** - Make sure there are no typos
2. **Wait a few minutes** - Supabase settings sometimes take time to propagate
3. **Try incognito mode** - To avoid browser cache issues
4. **Check browser console** - For any JavaScript errors

---

## ✅ **VERIFICATION CHECKLIST:**

- [ ] Logged into Supabase dashboard
- [ ] Found the correct project (dmagnsbdjsnzsddxqrwd)
- [ ] Updated Site URL to localhost:3000
- [ ] Added redirect URLs for reset-password.html
- [ ] Removed the Vercel URL from redirect URLs
- [ ] Saved all changes
- [ ] Tested with a fresh password reset request
- [ ] Email now redirects to local reset password page
- [ ] Reset password form works correctly
- [ ] Success page shows and redirects to login

---

**🎉 Once completed, your forgot password flow will work perfectly!**