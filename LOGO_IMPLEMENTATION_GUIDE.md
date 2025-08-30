# VidyaSethu Logo Implementation Guide 🎨

## 📁 Required Logo Files

Place your VidyaSethu logo files in the `assets` folder with these names:

### **Main Logo Files Needed:**
```
assets/
├── logo.png              (Main logo - 512x512px recommended)
├── logo-white.png         (White version for dark backgrounds)  
├── logo-small.png         (Small version - 64x64px)
├── icon.png              (App icon - 1024x1024px)
├── adaptive-icon.png     (Android adaptive icon)
├── favicon.png           (Web favicon - 32x32px)
└── splash-icon.png       (Splash screen logo)
```

### **Logo Size Recommendations:**
- **Main Logo**: 512x512px (PNG with transparent background)
- **White Logo**: 512x512px (White version for dark backgrounds)
- **Small Logo**: 64x64px (For headers and small spaces)
- **App Icon**: 1024x1024px (Square, no transparency for app stores)
- **Favicon**: 32x32px (For web browser tabs)

## 📱 Implementation Locations

### **1. Login Screen**
- File: `src/screens/auth/LoginScreen.js`
- Current: Ionicons school icon
- Replace with: Your logo image

### **2. Loading Screen**  
- File: `src/screens/LoadingScreen.js`
- Current: Ionicons school icon
- Replace with: Your logo image

### **3. App Configuration**
- File: `app.json`
- Icons for app stores and splash screens

### **4. Headers (Optional)**
- Various dashboard headers
- Can use small logo version

## 🔧 Code Implementation

### **Method 1: Direct Image Import (Recommended)**
```javascript
// Import your logo at the top of the file
import logo from '../../assets/logo.png';
import logoWhite from '../../assets/logo-white.png';

// Use in your component
<Image 
  source={logo} 
  style={{ width: 80, height: 80 }} 
  resizeMode="contain"
/>
```

### **Method 2: Require Method**
```javascript
// Use require() directly
<Image 
  source={require('../../assets/logo.png')} 
  style={{ width: 80, height: 80 }} 
  resizeMode="contain"
/>
```

## 🎯 Quick Implementation Steps

1. **Add your logo files** to the `assets` folder
2. **Update Login Screen** to use your logo
3. **Update Loading Screen** to use your logo  
4. **Update app.json** with new icon paths
5. **Test on both light and dark themes**

## 📏 Logo Design Tips

### **For Best Results:**
- Use **PNG format** with transparent background
- **Square aspect ratio** works best
- **Simple, clear design** that works at small sizes
- **High contrast** colors for readability
- **Consistent branding** across all variations

### **Color Schemes:**
- **Primary Logo**: Your brand colors
- **White Version**: For dark backgrounds (gradients, headers)
- **Monochrome**: For favicon and simple contexts

## 🚀 After Adding Your Logo

The logo will appear in:
- ✅ Login screen (main branding)
- ✅ Loading screen (app startup)
- ✅ App icon (home screen, app stores)
- ✅ Browser tab (favicon)
- ✅ Splash screen (app launch)

## 🎨 Brand Consistency

Make sure your logo:
- Matches the VidyaSethu color scheme
- Works with the gradient backgrounds
- Is legible at all sizes
- Represents "Bridge of Knowledge" concept

---

**Ready to add your VidyaSethu logo? Just follow the steps above!** 🎉
