#!/usr/bin/env node

/**
 * Simple script to get Expo Push Token for testing
 * Run with: node get-push-token.js
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Getting Expo Push Token for VidyaSetu...\n');

try {
  // Read app.json to get project details
  const appJson = require('./app.json');
  const projectId = appJson.expo?.extra?.eas?.projectId;
  const packageName = appJson.expo?.android?.package;
  
  console.log('📱 Project Details:');
  console.log(`   Project ID: ${projectId}`);
  console.log(`   Package Name: ${packageName}`);
  console.log(`   App Name: ${appJson.expo?.name}`);
  
  if (!projectId) {
    console.error('❌ No project ID found in app.json');
    process.exit(1);
  }
  
  console.log('\n🔧 To get your Expo Push Token, you have these options:\n');
  
  console.log('1️⃣  INSTALL THE APK (Recommended):');
  console.log('   📱 Download: https://expo.dev/accounts/abhishek078622/projects/vidyasetu/builds/9398771a-a362-4d94-8ece-748f7300ec71');
  console.log('   📲 Install on physical Android device');
  console.log('   🚀 Open app → Login as Admin → Quick Actions → Test Push Notifications');
  console.log('   📋 Copy the token from the screen\n');
  
  console.log('2️⃣  USE EXPO DEVELOPMENT BUILD:');
  console.log('   💻 Run: npx expo start --dev-client');
  console.log('   📱 Open on physical device with Expo Go or development build');
  console.log('   🔍 Check console logs for push token\n');
  
  console.log('3️⃣  USE EXPO PUSH TOKEN TOOL:');
  console.log('   🌐 Visit: https://expo.dev/notifications');
  console.log('   📱 Enter your project details');
  console.log('   🎯 Generate test tokens\n');
  
  console.log('4️⃣  PROGRAMMATIC APPROACH:');
  console.log('   📝 Your token will look like: ExponentPushToken[AAAAAAAAAAAAAAAAAAAA]');
  console.log('   🔧 Use the TestPushNotifications screen in your app');
  console.log('   📊 Token will be displayed and logged to console\n');
  
  console.log('💡 QUICK START:');
  console.log('   1. Download and install the APK from the link above');
  console.log('   2. Open VidyaSetu app on your Android phone');
  console.log('   3. Login as Admin');
  console.log('   4. Go to Quick Actions → Test Push Notifications');
  console.log('   5. Your push token will be displayed immediately!\n');
  
  console.log('🏗️  Your Project Configuration:');
  console.log(`   ✅ Project ID: ${projectId}`);
  console.log(`   ✅ Package: ${packageName}`);
  console.log(`   ✅ Google Services: ./google-services.json`);
  console.log(`   ✅ Build Profile: preview (APK)`);
  
} catch (error) {
  console.error('❌ Error:', error.message);
}