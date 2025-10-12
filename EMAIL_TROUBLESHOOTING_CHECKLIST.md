# 📧 PASSWORD RESET EMAIL TROUBLESHOOTING CHECKLIST

## 🚨 **CRITICAL: Do These Steps FIRST!**

### ✅ **Step 1: Check Spam/Junk Folder**
- Open your email client (Gmail, Outlook, Yahoo, etc.)
- Go to **Spam**, **Junk**, or **Promotions** folder
- Look for emails from `noreply@mail.supabase.co` or similar
- If found, mark as "Not Spam" / "Not Junk"

### ⏰ **Step 2: Wait for Email Delivery**
- Emails can take **1-10 minutes** to arrive
- Supabase free tier has delivery delays
- Try waiting at least **5 minutes** before troubleshooting further

### 📧 **Step 3: Try Different Email Address**
- Test with a **Gmail** or **Outlook** email
- Some email providers block automated emails
- Use a personal email you regularly check

## 🔧 **SUPABASE CONFIGURATION FIXES**

### 🌐 **Fix 1: Update Site URL**
1. Go to: https://app.supabase.com/project/dmagnsbdjsnzsddxqrwd
2. Click **Authentication** → **Settings**
3. Set **Site URL** to: `http://localhost:3000`
4. Add to **Additional Redirect URLs**:
   - `http://localhost:3000/web/reset-password.html`
   - `http://localhost:3000`

### 📨 **Fix 2: Check Email Templates**
1. Go to **Authentication** → **Email Templates**
2. Click **"Reset Password"** template
3. Ensure it's **enabled** and has proper content
4. Verify the `{{ .ConfirmationURL }}` is present

### 🔧 **Fix 3: SMTP Configuration**
**Option A: Use Supabase Default (Recommended for testing)**
- Leave SMTP settings blank/default
- Supabase will use their email service

**Option B: Configure Custom SMTP**
- Set up your own email provider (Gmail, SendGrid, etc.)
- Configure SMTP settings in Supabase dashboard

## 🧪 **TESTING STEPS**

### Test 1: Run Debug Script with Your Email
```bash
node debug_email_issues.js your-actual-email@gmail.com
```

### Test 2: Try the App Flow
1. Open your React Native app
2. Go to "Forgot Password" screen
3. Enter a **registered email address**
4. Check both inbox AND spam folder

### Test 3: Test with Different Email Providers
- Gmail: `yourname@gmail.com`
- Outlook: `yourname@outlook.com`
- Yahoo: `yourname@yahoo.com`

## 🎯 **MOST LIKELY CAUSES (In Order)**

1. **📧 Email in Spam Folder** (80% of cases)
   - Solution: Check spam folder first!

2. **❌ Email Address Not Registered**
   - Your app checks if user exists before sending email
   - Make sure you've registered/signed up with that email first

3. **⏰ Email Delivery Delay**
   - Free tier Supabase has slower email delivery
   - Wait 5-10 minutes

4. **🚫 Email Provider Blocking**
   - Some corporate/school emails block automated emails
   - Try personal Gmail/Outlook

5. **🔧 Wrong Supabase Configuration**
   - Site URL pointing to wrong domain
   - Email templates disabled

## ✅ **SUCCESS CHECKLIST**

- [ ] Checked spam/junk folder thoroughly
- [ ] Waited at least 5 minutes for delivery
- [ ] Tested with Gmail/Outlook email
- [ ] Verified email is registered in your app
- [ ] Updated Supabase Site URL to localhost:3000
- [ ] Confirmed email templates are enabled
- [ ] Tested from the actual app (not just script)

## 🆘 **If Still Not Working**

1. **Check Supabase Logs:**
   - Go to Supabase Dashboard → Logs
   - Look for email-related errors

2. **Try Manual Email Send:**
   ```bash
   # Test with your actual email
   node debug_email_issues.js youremail@gmail.com
   ```

3. **Verify User Registration:**
   - Make sure you've actually registered with that email
   - Check your app's user management

4. **Contact Supabase Support:**
   - If emails are being sent but never arrive
   - Provide your project ID: `dmagnsbdjsnzsddxqrwd`

## 💡 **Why This Happens**

- **Free Tier Limitations**: Supabase free tier has email delivery limitations
- **Spam Filters**: Automated emails often get flagged as spam
- **Email Provider Policies**: Some providers block bulk/automated emails
- **Configuration Issues**: Wrong redirect URLs or disabled templates