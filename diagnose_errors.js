const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

console.log('🔍 Comprehensive Error Diagnosis for Face Enrollment System');
console.log('='.repeat(60));

// Check 1: Environment Variables
console.log('\n1. 🔧 Environment Variables Check');
try {
  require('dotenv').config();
  
  const requiredEnvVars = [
    'REACT_APP_FACE_RECOGNITION_PROVIDER',
    'REACT_APP_FACE_ENCRYPTION_KEY', 
    'REACT_APP_FACE_STUB_MODE_FOR_TESTING'
  ];
  
  requiredEnvVars.forEach(envVar => {
    const value = process.env[envVar];
    if (value) {
      console.log(`✅ ${envVar}: ${envVar.includes('KEY') ? '[HIDDEN]' : value}`);
    } else {
      console.log(`❌ ${envVar}: Missing`);
    }
  });
} catch (error) {
  console.log('❌ Environment variables check failed:', error.message);
}

// Check 2: File Dependencies
console.log('\n2. 📁 File Dependencies Check');
const requiredFiles = [
  'src/services/FaceRecognitionService.js',
  'src/screens/admin/FaceEnrollmentScreen.js',
  'src/components/FacialRecognition/CameraCapture.js',
  'src/utils/AuthContext.js',
  'src/utils/getTenantByEmail.js',
  'src/utils/supabase.js',
  'database/fix_storage_policies.sql'
];

requiredFiles.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${filePath}: Exists`);
  } else {
    console.log(`❌ ${filePath}: Missing`);
  }
});

// Check 3: Package Dependencies
console.log('\n3. 📦 Package Dependencies Check');
async function checkDependencies() {
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    const requiredPackages = [
      '@supabase/supabase-js',
      'expo-file-system',
      'expo-image-picker',
      '@react-native-async-storage/async-storage',
      'react-native-safe-area-context',
      '@expo/vector-icons'
    ];
    
    requiredPackages.forEach(pkg => {
      if (dependencies[pkg]) {
        console.log(`✅ ${pkg}: ${dependencies[pkg]}`);
      } else {
        console.log(`❌ ${pkg}: Missing`);
      }
    });
  } catch (error) {
    console.log('❌ Package check failed:', error.message);
  }
}

// Check 4: Supabase Connection
console.log('\n4. 🌐 Supabase Connection Check');
async function checkSupabaseConnection() {
  try {
    const supabase = createClient(
      'https://dmagnsbdjsnzsddxqrwd.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8'
    );
    
    // Test database connection
    const { data, error } = await supabase.from('facial_templates').select('id').limit(1);
    if (error) {
      console.log(`❌ Database connection: ${error.message}`);
    } else {
      console.log('✅ Database connection: Working');
    }
    
    // Test storage connection  
    const { data: buckets, error: storageError } = await supabase.storage.listBuckets();
    if (storageError) {
      console.log(`❌ Storage connection: ${storageError.message}`);
    } else {
      console.log('✅ Storage connection: Working');
      
      // Check for facial recognition buckets
      const facialTemplates = buckets?.find(b => b.name === 'facial-templates');
      const facialEvents = buckets?.find(b => b.name === 'facial-events');
      
      console.log(`${facialTemplates ? '✅' : '❌'} facial-templates bucket: ${facialTemplates ? 'Exists' : 'Missing'}`);
      console.log(`${facialEvents ? '✅' : '❌'} facial-events bucket: ${facialEvents ? 'Exists' : 'Missing'}`);
    }
    
  } catch (error) {
    console.log('❌ Supabase check failed:', error.message);
  }
}

// Check 5: Code Syntax Issues
console.log('\n5. 🔍 Code Syntax Issues Check');
function checkCodeSyntax() {
  const filesToCheck = [
    'src/services/FaceRecognitionService.js',
    'src/screens/admin/FaceEnrollmentScreen.js'
  ];
  
  filesToCheck.forEach(filePath => {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Check for common issues
      const issues = [];
      
      if (content.includes('as any')) {
        issues.push('TypeScript "as any" syntax in JS file');
      }
      
      if (content.includes('import ') && !content.includes('export ')) {
        // This is normal for React components
      }
      
      // Check for unmatched brackets
      const openBraces = (content.match(/{/g) || []).length;
      const closeBraces = (content.match(/}/g) || []).length;
      if (openBraces !== closeBraces) {
        issues.push(`Unmatched braces: ${openBraces} open, ${closeBraces} close`);
      }
      
      if (issues.length === 0) {
        console.log(`✅ ${filePath}: No syntax issues found`);
      } else {
        console.log(`❌ ${filePath}: ${issues.join(', ')}`);
      }
      
    } catch (error) {
      console.log(`❌ ${filePath}: Cannot read file - ${error.message}`);
    }
  });
}

// Check 6: Metro Bundle Issues
console.log('\n6. 📱 React Native Metro Bundle Check');
function checkMetroConfig() {
  if (fs.existsSync('metro.config.js')) {
    console.log('✅ metro.config.js: Exists');
    try {
      const content = fs.readFileSync('metro.config.js', 'utf8');
      if (content.includes('expo')) {
        console.log('✅ Metro config: Using Expo preset');
      } else {
        console.log('⚠️ Metro config: Custom configuration detected');
      }
    } catch (error) {
      console.log('❌ Metro config: Cannot read file');
    }
  } else {
    console.log('❌ metro.config.js: Missing');
  }
}

// Run all checks
async function runDiagnosis() {
  await checkDependencies();
  await checkSupabaseConnection();
  checkCodeSyntax();
  checkMetroConfig();
  
  console.log('\n📋 Summary and Recommendations');
  console.log('='.repeat(40));
  console.log('If you found any ❌ errors above, please fix them before testing.');
  console.log('\nCommon solutions:');
  console.log('• Missing packages: Run "npm install [package-name]"');
  console.log('• Missing buckets: Run database/fix_storage_policies.sql in Supabase');
  console.log('• Syntax errors: Check the specific files mentioned');
  console.log('• Environment issues: Check .env file configuration');
  console.log('\n✅ If all checks passed, your face enrollment system should work!');
}

runDiagnosis().catch(console.error);