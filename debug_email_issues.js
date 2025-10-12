/**
 * 🔧 PASSWORD RESET EMAIL TROUBLESHOOTING SCRIPT
 * 
 * This script helps diagnose why password reset emails aren't being received
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration (from your project)
const SUPABASE_URL = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

class EmailTroubleshooter {
  constructor() {
    this.issues = [];
    this.solutions = [];
    this.testEmail = 'test@example.com'; // Change this to your test email
  }

  // 1. Test Supabase connection
  async testSupabaseConnection() {
    console.log('🔍 1. Testing Supabase Connection...\n');
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('count')
        .limit(1);
      
      if (error && error.code !== 'PGRST116') {
        console.log('❌ Supabase connection failed:', error.message);
        this.issues.push('Supabase connection issue');
        return false;
      }
      
      console.log('✅ Supabase connection successful');
      return true;
    } catch (error) {
      console.log('❌ Connection error:', error.message);
      this.issues.push('Network or configuration error');
      return false;
    }
  }

  // 2. Check authentication settings
  async checkAuthSettings() {
    console.log('\n🔍 2. Checking Authentication Configuration...\n');
    
    console.log('📋 Your Supabase Project Details:');
    console.log(`   Project URL: ${SUPABASE_URL}`);
    console.log(`   Project ID: dmagnsbdjsnzsddxqrwd`);
    
    console.log('\n🔧 Required Supabase Dashboard Checks:');
    console.log('   1. Go to: https://app.supabase.com/project/dmagnsbdjsnzsddxqrwd');
    console.log('   2. Navigate to Authentication > Settings');
    console.log('   3. Check these configurations:');
    
    console.log('\n   📧 SMTP Configuration:');
    console.log('   ❓ Is custom SMTP configured?');
    console.log('   ❓ Or are you using Supabase\'s default email service?');
    
    console.log('\n   🌐 Site URL Configuration:');
    console.log('   ❓ What is set as the Site URL?');
    console.log('   ❓ Are redirect URLs properly configured?');
    
    this.solutions.push('Check Supabase Authentication > Settings');
  }

  // 3. Test email sending
  async testEmailSending(testEmail) {
    console.log(`\n🔍 3. Testing Password Reset Email to: ${testEmail}...\n`);
    
    try {
      console.log('📧 Attempting to send password reset email...');
      
      const { data, error } = await supabase.auth.resetPasswordForEmail(testEmail, {
        redirectTo: 'http://localhost:3000/web/reset-password.html'
      });
      
      if (error) {
        console.log('❌ Email send failed:', error.message);
        console.log('   Error details:', JSON.stringify(error, null, 2));
        
        // Analyze specific error types
        if (error.message.includes('rate limit')) {
          this.issues.push('Rate limit exceeded - too many requests');
          this.solutions.push('Wait 60 seconds and try again');
        } else if (error.message.includes('invalid email')) {
          this.issues.push('Email address validation failed');
          this.solutions.push('Check email format and ensure it exists in your user table');
        } else if (error.message.includes('SMTP')) {
          this.issues.push('SMTP configuration issue');
          this.solutions.push('Check SMTP settings in Supabase dashboard');
        } else {
          this.issues.push(`Email send error: ${error.message}`);
        }
        
        return false;
      }
      
      console.log('✅ Password reset request sent successfully!');
      console.log('📬 If configured correctly, email should arrive within 1-5 minutes');
      
      return true;
    } catch (error) {
      console.log('💥 Unexpected error:', error.message);
      this.issues.push(`Unexpected error: ${error.message}`);
      return false;
    }
  }

  // 4. Check common email issues
  checkCommonIssues() {
    console.log('\n🔍 4. Common Email Delivery Issues...\n');
    
    const commonIssues = [
      {
        issue: '📧 Email in Spam/Junk Folder',
        solution: 'Check spam folder and mark Supabase emails as "Not Spam"'
      },
      {
        issue: '⏰ Email Delivery Delay',
        solution: 'Emails can take 1-10 minutes to arrive, especially for free tiers'
      },
      {
        issue: '🚫 Email Provider Blocking',
        solution: 'Some email providers block automated emails - try different email'
      },
      {
        issue: '📍 Wrong Email Address',
        solution: 'Ensure the email exists in your users table'
      },
      {
        issue: '🔧 SMTP Not Configured',
        solution: 'Configure custom SMTP in Supabase or use default service'
      },
      {
        issue: '🌐 Wrong Redirect URL',
        solution: 'Check Site URL and Redirect URLs in Supabase dashboard'
      },
      {
        issue: '🚨 Rate Limiting',
        solution: 'Supabase limits password reset emails to prevent abuse'
      }
    ];

    commonIssues.forEach((item, index) => {
      console.log(`${index + 1}. ${item.issue}`);
      console.log(`   Solution: ${item.solution}\n`);
    });
  }

  // 5. Check user exists
  async checkUserExists(email) {
    console.log(`\n🔍 5. Checking if user exists: ${email}...\n`);
    
    try {
      // Check if user exists in auth.users (this requires elevated permissions)
      console.log('🔐 Note: Cannot directly check auth.users table with anon key');
      console.log('   This is normal - Supabase restricts access for security');
      
      // Alternative: Check if user exists in your custom users table
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, email')
          .eq('email', email)
          .single();
        
        if (error && error.code === 'PGRST116') {
          console.log('❌ User not found in users table');
          console.log('   Make sure the email address is registered');
          this.issues.push('User not found in database');
          this.solutions.push('Register the user first or use a registered email');
          return false;
        } else if (error) {
          console.log('⚠️  Could not check users table:', error.message);
          console.log('   This might be normal if your table structure is different');
        } else {
          console.log('✅ User found in users table');
          console.log(`   User ID: ${data.id}`);
          return true;
        }
      } catch (error) {
        console.log('⚠️  Users table check failed:', error.message);
        console.log('   This is often normal - focus on auth system instead');
      }
      
      return true; // Assume user exists if we can't verify
    } catch (error) {
      console.log('💥 Error checking user:', error.message);
      return false;
    }
  }

  // 6. Generate troubleshooting steps
  generateTroubleshootingSteps() {
    console.log('\n🔧 STEP-BY-STEP TROUBLESHOOTING GUIDE');
    console.log('=' .repeat(50));
    
    console.log('\n🚨 IMMEDIATE ACTIONS:');
    console.log('1. Check your spam/junk folder first!');
    console.log('2. Wait 5-10 minutes for email delivery');
    console.log('3. Try a different email address');
    
    console.log('\n🔧 SUPABASE DASHBOARD CHECKS:');
    console.log('1. Go to: https://app.supabase.com/project/dmagnsbdjsnzsddxqrwd');
    console.log('2. Click Authentication > Settings');
    console.log('3. Verify these settings:');
    console.log('   • Site URL: Should be http://localhost:3000 for development');
    console.log('   • Additional Redirect URLs: Include your reset password page URL');
    console.log('   • SMTP Configuration: Check if custom SMTP is set up');
    
    console.log('\n📧 EMAIL TEMPLATE CHECK:');
    console.log('1. Go to Authentication > Email Templates');
    console.log('2. Click "Reset Password" template');
    console.log('3. Ensure the template is enabled and properly configured');
    
    console.log('\n🧪 MANUAL TESTING:');
    console.log('1. Try with a Gmail or Outlook email');
    console.log('2. Use an email that you know exists in your system');
    console.log('3. Check both inbox and spam folders');
    
    if (this.issues.length > 0) {
      console.log('\n❌ IDENTIFIED ISSUES:');
      this.issues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue}`);
      });
    }
    
    if (this.solutions.length > 0) {
      console.log('\n✅ RECOMMENDED SOLUTIONS:');
      this.solutions.forEach((solution, index) => {
        console.log(`${index + 1}. ${solution}`);
      });
    }
  }

  // Run complete diagnosis
  async runDiagnosis(testEmail = null) {
    const emailToTest = testEmail || this.testEmail;
    
    console.log('🚨 PASSWORD RESET EMAIL TROUBLESHOOTING');
    console.log('=' .repeat(50));
    console.log(`Testing with email: ${emailToTest}\n`);
    
    // Run all tests
    const connectionOK = await this.testSupabaseConnection();
    if (!connectionOK) {
      console.log('❌ Cannot proceed - fix Supabase connection first');
      return;
    }
    
    await this.checkAuthSettings();
    await this.checkUserExists(emailToTest);
    await this.testEmailSending(emailToTest);
    this.checkCommonIssues();
    this.generateTroubleshootingSteps();
    
    console.log('\n🎯 MOST LIKELY CAUSES:');
    console.log('1. Email in spam folder (CHECK FIRST!)');
    console.log('2. SMTP not configured in Supabase');
    console.log('3. User email not registered in system');
    console.log('4. Rate limiting (too many attempts)');
    console.log('5. Email provider blocking automated emails');
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  const testEmail = args[0] || 'test@example.com';
  
  console.log('🔍 Starting email troubleshooting...\n');
  console.log(`📧 Test email: ${testEmail}`);
  console.log('💡 Usage: node debug_email_issues.js your-email@domain.com\n');
  
  const troubleshooter = new EmailTroubleshooter();
  await troubleshooter.runDiagnosis(testEmail);
  
  console.log('\n✅ Diagnosis complete!');
  console.log('👆 Follow the troubleshooting steps above');
}

// Run the diagnosis
if (require.main === module) {
  main().catch(console.error);
}

module.exports = EmailTroubleshooter;