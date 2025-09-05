@echo off
echo VidyaSetu - EAS Setup Script
echo ==============================

echo.
echo Step 1: Installing EAS CLI (if not already installed)
call npm list -g @expo/eas-cli >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing EAS CLI globally...
    call npm install -g @expo/eas-cli
) else (
    echo EAS CLI already installed
)

echo.
echo Step 2: Checking project health with expo-doctor
call npx expo-doctor

echo.
echo ==============================
echo NEXT STEPS (Manual):
echo ==============================
echo 1. Fix icon dimensions (see ICON_FIX_INSTRUCTIONS.md)
echo 2. Run: eas login
echo 3. Run: eas build:configure
echo 4. Update app.json with the project ID from step 3
echo 5. Run: eas build --platform android --profile production
echo.
echo See PLAYSTORE_DEPLOYMENT_GUIDE.md for complete instructions
echo.
pause
