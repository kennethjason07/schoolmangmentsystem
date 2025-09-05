# VidyaSetu - Play Store Deployment Guide

## Project Status
✅ **Project Type**: Expo Managed Workflow  
✅ **Code Quality**: No merge conflicts or syntax errors detected  
✅ **Build Configuration**: EAS Build setup complete  
✅ **Expo Configuration**: All expo-doctor checks passing  
⚠️ **Icons**: Need to be resized to square dimensions  

## Issues to Fix Before Deployment

### 1. Icon Dimensions (ONLY REMAINING ISSUE)
**Problem**: Current icons are 1056x992 pixels (not square)  
**Required**: Icons must be square (1024x1024 recommended)

**Files to update**:
- `assets/icon.png` - App icon (1024x1024 px)
- `assets/adaptive-icon.png` - Android adaptive icon (1024x1024 px)
- `assets/splash-icon.png` - Splash screen image

**How to fix**:
1. Use image editing software (Photoshop, GIMP, Canva, etc.)
2. Resize/crop icons to 1024x1024 pixels
3. Maintain aspect ratio and ensure icon looks good when square

### 2. EAS Project ID
**Update required**: In `app.json`, replace `"your-project-id-here"` with actual EAS project ID (this will be done automatically during `eas build:configure`)

## Deployment Steps

### Step 1: Install EAS CLI
```bash
npm install -g @expo/eas-cli
```

### Step 2: Login to Expo Account
```bash
eas login
```

### Step 3: Configure EAS Project
```bash
eas build:configure
```
This will:
- Create/update your EAS project
- Generate a project ID for app.json
- Set up build profiles

### Step 4: Update app.json with Project ID
Replace `"your-project-id-here"` in app.json with the actual project ID from step 3.

### Step 5: Create Keystore for Android Signing
```bash
eas credentials
```
Choose:
- Android
- Production
- Generate new keystore

**IMPORTANT**: Save the generated keystore credentials securely!

### Step 6: Build Production AAB
```bash
eas build --platform android --profile production
```

This creates an Android App Bundle (.aab) file ready for Play Store upload.

### Step 7: Download the Build
- Go to https://expo.dev/builds
- Download the .aab file when build completes

## Play Store Console Setup

### 1. Create Play Console Account
- Visit https://play.google.com/console/
- Pay one-time $25 registration fee
- Complete developer account setup

### 2. Create New App
1. Click "Create app"
2. Fill in app details:
- **Name**: "VidyaSetu - School Management"
   - **Default language**: English (or your preferred language)
   - **App type**: App
   - **Category**: Education

### 3. Upload App Bundle
1. Go to "Release" → "Production"
2. Click "Create new release"
3. Upload the .aab file
4. Fill in release notes

### 4. Complete App Information

#### Store Listing
- **App name**: VidyaSetu - School Management
- **Short description**: Comprehensive school management system
- **Full description**: 
```
VidyaSetu is a comprehensive school management system designed for students, parents, and administrators.

Features:
• Student attendance tracking
• Fee management and payment tracking
• Homework and assignment management
• Event calendar and notifications
• Parent-teacher communication
• Student progress reports
• Administrative tools

Perfect for schools looking to digitize their management processes and improve communication between students, parents, and staff.
```

#### Graphics Requirements
You'll need to create:
- **App icon**: 512x512 px (high-res version of your app icon)
- **Feature graphic**: 1024x500 px
- **Phone screenshots**: At least 2, up to 8 (1080x1920 px or similar)
- **7-inch tablet screenshots**: At least 1 (1200x1920 px)
- **10-inch tablet screenshots**: At least 1 (1920x1200 px)

#### Content Rating
1. Complete content rating questionnaire
2. For school management app, likely rating will be "Everyone" or "Everyone 10+"

#### Privacy Policy
Create a privacy policy URL explaining:
- What data you collect
- How you use the data
- Data security measures
- Contact information

### 5. Testing Track (Recommended)
Before production release:
1. Create "Internal testing" track
2. Add test users (your email addresses)
3. Upload same .aab file to internal testing
4. Test thoroughly on real devices

## Required Assets Checklist

### Icons (Fix Required)
- [ ] app icon (1024x1024 px) - Currently 1056x992 ❌
- [ ] adaptive icon (1024x1024 px) - Currently 1056x992 ❌
- [ ] splash screen icon (recommended: square)

### Play Store Graphics (Create New)
- [ ] High-res app icon (512x512 px)
- [ ] Feature graphic (1024x500 px)
- [ ] Phone screenshots (at least 2)
- [ ] Tablet screenshots (at least 1 each for 7" and 10")

## Build Commands Reference

### Development Build (for testing)
```bash
eas build --platform android --profile development
```

### Preview Build (APK for testing)
```bash
eas build --platform android --profile preview
```

### Production Build (AAB for Play Store)
```bash
eas build --platform android --profile production
```

## Important Notes

1. **Package Name**: Set to `com.vidyasetu.app` - this cannot be changed after upload
2. **Version Management**: Increment `versionCode` in app.json for each new release
3. **Permissions**: Configured for camera, storage, and network access
4. **Target SDK**: Set to Android 34 (latest requirement)
5. **Bundle Format**: Using AAB (Android App Bundle) as required by Play Store

## Troubleshooting

### Common Issues
1. **Build Fails**: Check expo-doctor output and fix all warnings
2. **Icon Errors**: Ensure all icons are exactly square dimensions
3. **Permission Issues**: Review Android permissions in app.json
4. **Upload Fails**: Verify AAB file is signed correctly

### Getting Help
- Expo Documentation: https://docs.expo.dev/
- EAS Build Docs: https://docs.expo.dev/build/introduction/
- Play Console Help: https://support.google.com/googleplay/android-developer/

## Estimated Timeline
- Icon fixes: 1-2 hours
- EAS setup and build: 2-3 hours
- Play Console setup: 3-4 hours
- Review process: 1-7 days (Google's review time)

## Next Steps
1. Fix icon dimensions (critical)
2. Set up EAS account and project
3. Generate production build
4. Create Play Console account
5. Prepare store listing materials
6. Submit for review

---
**Contact**: If you need help with any step, the Expo community and documentation are excellent resources.
