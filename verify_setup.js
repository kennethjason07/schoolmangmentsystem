/**
 * Face Recognition Setup Verification
 * Simple test to verify all components are ready
 */

const path = require('path');
const fs = require('fs');

// Load environment variables
require('dotenv').config();

function verifyFaceRecognitionSetup() {
  console.log('🔍 Verifying Face Recognition Setup');
  console.log('==================================');

  let allTestsPassed = true;

  // Test 1: Environment Variables
  console.log('\n1️⃣  Environment Variables');
  const requiredEnvVars = [
    'REACT_APP_FACE_RECOGNITION_PROVIDER',
    'REACT_APP_FACE_ENCRYPTION_KEY',
    'REACT_APP_FACE_TEMPLATES_BUCKET',
    'REACT_APP_FACE_EVENTS_BUCKET'
  ];

  requiredEnvVars.forEach(envVar => {
    if (!process.env[envVar]) {
      console.log(`❌ Missing: ${envVar}`);
      allTestsPassed = false;
    } else {
      const value = envVar.includes('KEY') ? '***HIDDEN***' : process.env[envVar];
      console.log(`✅ ${envVar}: ${value}`);
    }
  });

  // Test 2: Dependencies
  console.log('\n2️⃣  NPM Dependencies');
  const requiredPackages = ['face-api.js', 'crypto-js', 'dotenv'];
  
  requiredPackages.forEach(pkg => {
    try {
      require(pkg);
      console.log(`✅ ${pkg}: Installed`);
    } catch (error) {
      console.log(`❌ ${pkg}: Missing`);
      allTestsPassed = false;
    }
  });

  // Test 3: Face Recognition Models
  console.log('\n3️⃣  Face Recognition Models');
  const modelsDir = path.join(__dirname, 'public', 'models', 'face-recognition');
  
  if (!fs.existsSync(modelsDir)) {
    console.log('❌ Models directory missing');
    allTestsPassed = false;
  } else {
    const requiredModels = [
      'tiny_face_detector_model-weights_manifest.json',
      'tiny_face_detector_model-shard1',
      'face_landmark_68_model-weights_manifest.json',
      'face_landmark_68_model-shard1',
      'face_recognition_model-weights_manifest.json',
      'face_recognition_model-shard1',
      'face_recognition_model-shard2'
    ];

    let modelsFound = 0;
    requiredModels.forEach(model => {
      const modelPath = path.join(modelsDir, model);
      if (fs.existsSync(modelPath)) {
        const stats = fs.statSync(modelPath);
        console.log(`✅ ${model} (${Math.round(stats.size / 1024)}KB)`);
        modelsFound++;
      } else {
        console.log(`❌ Missing: ${model}`);
        allTestsPassed = false;
      }
    });

    console.log(`   Found ${modelsFound}/${requiredModels.length} models`);
  }

  // Test 4: Database Files
  console.log('\n4️⃣  Database Migration Files');
  const dbFiles = [
    'database/migrations/add_facial_recognition_system_fixed.sql',
    'database/setup_facial_recognition_storage.sql'
  ];

  dbFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      console.log(`✅ ${file}`);
    } else {
      console.log(`❌ Missing: ${file}`);
      allTestsPassed = false;
    }
  });

  // Test 5: Service Files
  console.log('\n5️⃣  Service Files');
  const serviceFiles = [
    'src/services/FaceRecognitionService.js'
  ];

  serviceFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      console.log(`✅ ${file}`);
    } else {
      console.log(`❌ Missing: ${file}`);
      allTestsPassed = false;
    }
  });

  // Summary
  console.log('\n📊 Verification Results');
  console.log('======================');
  
  if (allTestsPassed) {
    console.log('🎉 ALL TESTS PASSED! Your facial recognition system is ready.');
    console.log('\n✅ Completed Steps:');
    console.log('   • Database migration ready');
    console.log('   • Dependencies installed');  
    console.log('   • Environment variables configured');
    console.log('   • Face recognition models downloaded');
    console.log('   • Service files created');
    
    console.log('\n🎯 Remaining Steps:');
    console.log('   1. Run setup_facial_recognition_storage.sql in Supabase');
    console.log('   2. Test in browser environment');
    console.log('   3. Integrate UI components');
    
    return true;
  } else {
    console.log('❌ SOME TESTS FAILED. Please fix the issues above.');
    return false;
  }
}

// Additional utility functions
function showConfiguration() {
  console.log('\n⚙️  Current Configuration:');
  console.log(`   Provider: ${process.env.REACT_APP_FACE_RECOGNITION_PROVIDER || 'offline'}`);
  console.log(`   Default Confidence: ${process.env.REACT_APP_FACE_DEFAULT_CONFIDENCE || '0.8'}`);
  console.log(`   High Accuracy: ${process.env.REACT_APP_FACE_HIGH_ACCURACY_THRESHOLD || '0.9'}`);
  console.log(`   Templates Bucket: ${process.env.REACT_APP_FACE_TEMPLATES_BUCKET || 'facial-templates'}`);
  console.log(`   Events Bucket: ${process.env.REACT_APP_FACE_EVENTS_BUCKET || 'facial-events'}`);
  console.log(`   Models Path: ${process.env.REACT_APP_FACE_MODELS_PATH || '/models/face-recognition'}`);
  console.log(`   Debug Mode: ${process.env.REACT_APP_FACE_ENABLE_DEBUG_MODE || 'true'}`);
}

function showNextSteps() {
  console.log('\n📋 Next Implementation Steps:');
  console.log('=============================');
  console.log('1. 🗄️  Supabase Storage Setup:');
  console.log('   • Go to your Supabase SQL Editor');
  console.log('   • Run: database/setup_facial_recognition_storage.sql');
  
  console.log('\n2. 🧪 Test in Browser:');
  console.log('   • Start your development server');
  console.log('   • Open browser console');
  console.log('   • Test FaceRecognitionService initialization');
  
  console.log('\n3. 🎨 UI Integration:');
  console.log('   • Add camera components to attendance screens');
  console.log('   • Follow FACIAL_RECOGNITION_UI_INTEGRATION.md guide');
  
  console.log('\n4. 📱 Testing Flow:');
  console.log('   • Test face enrollment for students/teachers');
  console.log('   • Test face recognition during attendance');
  console.log('   • Verify fallback to manual entry');
  
  console.log('\n5. 🚀 Production:');
  console.log('   • Generate secure encryption key');
  console.log('   • Configure confidence thresholds');
  console.log('   • Set up cleanup schedules');
}

// Run verification
if (require.main === module) {
  const success = verifyFaceRecognitionSetup();
  
  if (success) {
    showConfiguration();
    showNextSteps();
  }
  
  process.exit(success ? 0 : 1);
}

module.exports = { verifyFaceRecognitionSetup };