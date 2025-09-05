# Icon Fix Instructions

## Current Issue
Your app icons are 1056x992 pixels, but they need to be square (1024x1024 px) for Play Store submission.

## Files to Fix
1. `assets/icon.png` - Main app icon
2. `assets/adaptive-icon.png` - Android adaptive icon
3. `assets/splash-icon.png` - Splash screen icon (optional but recommended)

## Method 1: Using Online Tools (Easiest)

### Canva (Free)
1. Go to https://www.canva.com/
2. Create account (free)
3. Click "Custom size" → 1024 x 1024 pixels
4. Upload your current icon
5. Resize and position to fit square canvas
6. Download as PNG

### Figma (Free)
1. Go to https://www.figma.com/
2. Create account (free)
3. Create new design file
4. Set frame to 1024 x 1024
5. Import your icon and resize
6. Export as PNG

## Method 2: Using Free Desktop Software

### GIMP (Free)
1. Download GIMP: https://www.gimp.org/
2. Open your icon file
3. Image → Scale Image → 1024x1024 pixels
4. If icon becomes distorted, use Image → Canvas Size instead
5. Export as PNG

### Paint.NET (Windows, Free)
1. Download from https://www.getpaint.net/
2. Open icon file
3. Image → Resize → 1024x1024 pixels
4. Save as PNG

## Method 3: PowerShell Script (Advanced)
If you have ImageMagick installed:
```powershell
# Install ImageMagick first: https://imagemagick.org/script/download.php#windows
magick assets/icon.png -resize 1024x1024 -background white -gravity center -extent 1024x1024 assets/icon_fixed.png
magick assets/adaptive-icon.png -resize 1024x1024 -background white -gravity center -extent 1024x1024 assets/adaptive-icon_fixed.png
```

## Quick Verification
After fixing, you can verify the dimensions by:
1. Right-click the image file
2. Properties → Details tab
3. Check that Width and Height are both 1024

## What to Do After Fixing
1. Replace the original files with your fixed versions
2. Run `npx expo-doctor` again to verify no more icon errors
3. Proceed with the EAS build process

## Tips for Best Results
- Keep the icon content centered when making it square
- Ensure the icon is still recognizable at small sizes
- Use a transparent or white background for adaptive icons
- Test how the icon looks on different Android launchers
