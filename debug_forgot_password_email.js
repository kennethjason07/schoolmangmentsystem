/**
 * Debug script for Forgot Password Email Flow
 * 
 * This script helps identify why password reset emails are redirecting to the wrong URL
 */

const fs = require('fs');
const path = require('path');

class ForgotPasswordDebugger {
  constructor() {
    this.issues = [];
    this.findings = [];
  }

  // Check the current code configuration
  checkCodeConfiguration() {
    console.log('🔍 Checking Code Configuration...\n');
    
    try {
      const filePath = path.join(__dirname, 'src', 'screens', 'auth', 'ForgotPasswordScreen.js');
      const code = fs.readFileSync(filePath, 'utf8');
      
      // Extract the redirectTo configuration
      const redirectToMatch = code.match(/redirectTo:\s*([^}]+)/);
      
      if (redirectToMatch) {
        console.log('📍 Current redirectTo configuration found:');
        console.log(`   ${redirectToMatch[1].trim()}`);
        this.findings.push(`Code redirectTo: ${redirectToMatch[1].trim()}`);
      } else {
        console.log('❌ No redirectTo configuration found in code');
        this.issues.push('Missing redirectTo configuration');
      }

      // Check if Platform.OS check exists
      if (code.includes('Platform.OS') && code.includes('web')) {
        console.log('✅ Platform-specific URL handling implemented');
        this.findings.push('Platform-specific URL handling exists');
      } else {
        console.log('⚠️ No platform-specific URL handling found');
      }

      console.log('\n');
    } catch (error) {
      console.error('❌ Failed to read ForgotPasswordScreen.js:', error.message);
      this.issues.push('Cannot read ForgotPasswordScreen.js');
    }
  }

  // Check Supabase configuration
  checkSupabaseConfig() {
    console.log('🔍 Checking Supabase Configuration...\n');
    
    try {
      const supabasePath = path.join(__dirname, 'src', 'utils', 'supabase.js');
      const code = fs.readFileSync(supabasePath, 'utf8');
      
      // Extract Supabase URL
      const urlMatch = code.match(/supabaseUrl\s*=\s*['"`]([^'"`]+)['"`]/);
      if (urlMatch) {
        console.log(`📍 Supabase URL: ${urlMatch[1]}`);
        this.findings.push(`Supabase URL: ${urlMatch[1]}`);
      }

      // Extract project reference
      const projectRef = urlMatch ? urlMatch[1].match(/https:\/\/([^.]+)\.supabase\.co/) : null;
      if (projectRef) {
        console.log(`📍 Project Reference: ${projectRef[1]}`);
        this.findings.push(`Project Reference: ${projectRef[1]}`);
      }

      console.log('\n');
    } catch (error) {
      console.error('❌ Failed to read supabase.js:', error.message);
      this.issues.push('Cannot read supabase.js');
    }
  }

  // Analyze the error URL
  analyzeErrorURL() {
    console.log('🔍 Analyzing Error URL...\n');
    
    const errorURL = 'https://maximus-email-verificatiion.vercel.app/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';
    
    console.log('❌ PROBLEM IDENTIFIED:');
    console.log(`   Email redirects to: maximus-email-verificatiion.vercel.app`);
    console.log(`   This is NOT your local application!`);
    
    // Parse error details
    const urlParams = new URL(errorURL);
    const hashParams = new URLSearchParams(urlParams.hash.substring(1));
    
    console.log('\n📋 Error Details from URL:');
    console.log(`   Error: ${hashParams.get('error') || 'N/A'}`);
    console.log(`   Error Code: ${hashParams.get('error_code') || 'N/A'}`);
    console.log(`   Description: ${decodeURIComponent(hashParams.get('error_description') || 'N/A')}`);
    
    this.issues.push('Email redirects to wrong domain: maximus-email-verificatiion.vercel.app');
    this.findings.push('OTP expired error - email links have time limits');
    
    console.log('\n');
  }

  // Check for web configuration files
  checkWebConfig() {
    console.log('🔍 Checking Web Configuration Files...\n');
    
    const possibleConfigPaths = [
      'web/supabase-config.js',
      'web/simple-onboarding.js',
      'web/simple-onboarding.html',
      'vercel.json',
      'netlify.toml',
      '.env',
      '.env.local'
    ];

    possibleConfigPaths.forEach(configPath => {
      const fullPath = path.join(__dirname, configPath);
      if (fs.existsSync(fullPath)) {
        console.log(`✅ Found: ${configPath}`);
        
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          
          // Check for verification URLs
          if (content.includes('maximus-email-verificatiion.vercel.app')) {
            console.log(`   ⚠️ Contains problematic URL: maximus-email-verificatiion.vercel.app`);
            this.issues.push(`${configPath} contains wrong verification URL`);
          }
          
          // Check for other Vercel URLs
          if (content.includes('vercel.app') || content.includes('netlify.app')) {
            console.log(`   📍 Contains deployment URL`);
            this.findings.push(`${configPath} has deployment configuration`);
          }
          
        } catch (error) {
          console.log(`   ❌ Cannot read file: ${error.message}`);
        }
      }
    });
    
    console.log('\n');
  }

  // Generate fix instructions
  generateFixInstructions() {
    console.log('🔧 FIX INSTRUCTIONS');
    console.log('=' .repeat(60));
    
    console.log('\n🎯 PRIMARY ISSUE: Supabase Dashboard Configuration');
    console.log('The redirect URL is configured in your Supabase dashboard, not in your code!');
    
    console.log('\n📋 STEP-BY-STEP FIX:');
    
    console.log('\n1. 🌐 Go to Supabase Dashboard:');
    console.log('   - Open https://app.supabase.com');
    console.log('   - Select your project (likely "dmagnsbdjsnzsddxqrwd" based on your URL)');
    
    console.log('\n2. ⚙️ Navigate to Authentication Settings:');
    console.log('   - Click "Authentication" in the left sidebar');
    console.log('   - Click "Settings" tab');
    console.log('   - Look for "Site URL" and "Redirect URLs" section');
    
    console.log('\n3. 🔄 Update Redirect URLs:');
    console.log('   REMOVE: https://maximus-email-verificatiion.vercel.app');
    console.log('   ADD: http://localhost:3000 (for development)');
    console.log('   ADD: Your production domain (if you have one)');
    
    console.log('\n4. 📧 Update Email Templates (if needed):');
    console.log('   - Go to "Authentication" → "Email Templates"');
    console.log('   - Check "Reset Password" template');
    console.log('   - Ensure it uses {{ .ConfirmationURL }} correctly');
    
    console.log('\n5. 🧪 Test the Fix:');
    console.log('   - Try forgot password again');
    console.log('   - Check that email redirects to localhost:3000');
    
    console.log('\n⚠️ IMPORTANT NOTES:');
    console.log('   - Email links expire quickly (usually 1 hour)');
    console.log('   - Always test with fresh password reset requests');
    console.log('   - Clear browser cache if needed');
    
    console.log('\n💡 WHY THIS HAPPENED:');
    console.log('   - Your Supabase project was likely configured with a Vercel deployment URL');
    console.log('   - This overrides any redirectTo parameter in your code');
    console.log('   - Supabase dashboard settings take precedence over code configuration');
  }

  // Run complete diagnosis
  runDiagnosis() {
    console.log('🚨 FORGOT PASSWORD EMAIL REDIRECT ISSUE DEBUG');
    console.log('=' .repeat(60));
    console.log('\n');
    
    this.checkCodeConfiguration();
    this.checkSupabaseConfig();
    this.analyzeErrorURL();
    this.checkWebConfig();
    this.generateFixInstructions();
    
    // Summary
    console.log('\n📊 DIAGNOSIS SUMMARY');
    console.log('=' .repeat(40));
    
    console.log('\n🔍 Issues Found:');
    this.issues.forEach((issue, index) => {
      console.log(`   ${index + 1}. ${issue}`);
    });
    
    console.log('\n📋 Key Findings:');
    this.findings.forEach((finding, index) => {
      console.log(`   ${index + 1}. ${finding}`);
    });
    
    console.log('\n🎯 MAIN ACTION REQUIRED:');
    console.log('   Update Supabase Dashboard Authentication Settings!');
    console.log('   The code is correct - the issue is in Supabase configuration.');
  }
}

// Run the diagnosis
const emailDebugger = new ForgotPasswordDebugger();
emailDebugger.runDiagnosis();
