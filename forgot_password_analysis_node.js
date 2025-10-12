/**
 * Forgot Password Functionality Analysis Script (Node.js compatible)
 * 
 * This script analyzes the forgot password implementation to identify
 * potential issues and verify functionality.
 */

const fs = require('fs');
const path = require('path');

class ForgotPasswordAnalyzer {
  constructor() {
    this.testResults = {
      emailValidation: [],
      codeAnalysis: [],
      issues: [],
      recommendations: []
    };
  }

  // Test email validation regex
  testEmailValidation() {
    console.log('🔍 Testing Email Validation Logic...\n');
    
    const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
    
    const testCases = [
      { email: '', expected: false, description: 'Empty email' },
      { email: 'test@example.com', expected: true, description: 'Valid email' },
      { email: 'invalid-email', expected: false, description: 'Invalid format' },
      { email: 'user@domain', expected: false, description: 'Missing TLD' },
      { email: 'user.name+tag@example.com', expected: true, description: 'Complex valid email' },
      { email: 'user@sub.domain.com', expected: true, description: 'Subdomain email' },
      { email: 'user@.com', expected: false, description: 'Invalid domain' },
      { email: 'user@domain.', expected: false, description: 'Incomplete TLD' }
    ];

    testCases.forEach(testCase => {
      const result = emailRegex.test(testCase.email);
      const status = result === testCase.expected ? '✅ PASS' : '❌ FAIL';
      
      console.log(`${status} ${testCase.description}: "${testCase.email}"`);
      
      this.testResults.emailValidation.push({
        email: testCase.email,
        expected: testCase.expected,
        actual: result,
        passed: result === testCase.expected,
        description: testCase.description
      });

      if (result !== testCase.expected) {
        this.testResults.issues.push(`Email validation failed for: ${testCase.description}`);
      }
    });

    console.log('\n');
  }

  // Analyze the ForgotPasswordScreen code
  analyzeForgotPasswordScreenCode() {
    console.log('🔍 Analyzing ForgotPasswordScreen Code...\n');
    
    try {
      const filePath = path.join(__dirname, 'src', 'screens', 'auth', 'ForgotPasswordScreen.js');
      const code = fs.readFileSync(filePath, 'utf8');
      
      console.log('✅ Successfully loaded ForgotPasswordScreen.js');
      
      // Check for critical issues
      const issues = [];
      const recommendations = [];

      // Issue 1: Check for window.location.origin usage
      if (code.includes('window.location.origin') && !code.includes('Platform.OS')) {
        console.log('❌ CRITICAL ISSUE: window.location.origin used in React Native context');
        console.log('   Line: redirectTo: `${window.location.origin}/auth/reset-password`');
        issues.push('window.location.origin used in React Native - will crash on mobile');
        recommendations.push('Use Platform.OS to conditionally set redirectTo URL');
      } else if (code.includes('Platform.OS') && code.includes('window.location.origin')) {
        console.log('✅ Good: Platform-specific redirectTo URL implemented');
      }

      // Issue 2: Check email validation
      if (code.includes('emailRegex')) {
        console.log('✅ Good: Email validation regex found');
        if (code.includes('[a-zA-Z0-9.!#$%&\'*+\/=?^_`{|}~-]')) {
          console.log('✅ Excellent: Enhanced email validation regex supports complex formats');
        }
      } else {
        console.log('⚠️ Email validation pattern might be missing');
      }

      // Issue 3: Check error handling
      if (code.includes('try {') && code.includes('catch (error)')) {
        console.log('✅ Good: Error handling implemented');
      } else {
        console.log('⚠️ Error handling might be incomplete');
      }

      // Issue 4: Check email existence validation
      if (code.includes('checkEmailExists')) {
        console.log('⚠️ SECURITY CONCERN: Email existence check could enable enumeration attacks');
        recommendations.push('Consider removing email existence check to prevent enumeration');
      }

      // Issue 5: Check loading states
      if (code.includes('isLoading') && code.includes('setIsLoading')) {
        console.log('✅ Good: Loading states implemented');
      }

      // Issue 6: Check navigation
      if (code.includes('navigation.goBack()')) {
        console.log('✅ Good: Navigation back functionality implemented');
      }

      this.testResults.issues.push(...issues);
      this.testResults.recommendations.push(...recommendations);
      this.testResults.codeAnalysis.push('Code analysis completed');

    } catch (error) {
      console.error('❌ Failed to analyze ForgotPasswordScreen code:', error.message);
      this.testResults.issues.push('Could not analyze ForgotPasswordScreen code: ' + error.message);
    }

    console.log('\n');
  }

  // Analyze LoginScreen integration
  analyzeLoginScreenIntegration() {
    console.log('🔍 Analyzing LoginScreen Integration...\n');
    
    try {
      const filePath = path.join(__dirname, 'src', 'screens', 'auth', 'LoginScreen.js');
      const code = fs.readFileSync(filePath, 'utf8');
      
      console.log('✅ Successfully loaded LoginScreen.js');
      
      // Check for forgot password navigation
      if (code.includes("navigation.navigate('ForgotPassword')")) {
        console.log('✅ Good: Forgot password navigation implemented');
        console.log('✅ Good: Accessible from login screen');
      } else {
        console.log('❌ ISSUE: Forgot password navigation not found or incorrect');
        this.testResults.issues.push('Forgot password navigation not properly implemented');
      }

      // Check for forgot password button/link
      if (code.includes('Forgot Password')) {
        console.log('✅ Good: Forgot password UI element found');
      } else {
        console.log('⚠️ Forgot password UI element might be missing or differently named');
      }

    } catch (error) {
      console.error('❌ Failed to analyze LoginScreen:', error.message);
      this.testResults.issues.push('Could not analyze LoginScreen integration: ' + error.message);
    }

    console.log('\n');
  }

  // Check navigation configuration
  checkNavigationConfiguration() {
    console.log('🔍 Checking Navigation Configuration...\n');
    
    try {
      const navigatorPath = path.join(__dirname, 'src', 'navigation', 'AppNavigator.js');
      
      if (fs.existsSync(navigatorPath)) {
        const code = fs.readFileSync(navigatorPath, 'utf8');
        
        if (code.includes('ForgotPassword')) {
          console.log('✅ Good: ForgotPassword screen registered in navigation');
        } else {
          console.log('❌ ISSUE: ForgotPassword screen not found in navigation');
          this.testResults.issues.push('ForgotPassword screen not registered in navigation');
        }
      } else {
        console.log('⚠️ Navigation file not found at expected location');
        this.testResults.recommendations.push('Verify navigation configuration includes ForgotPassword screen');
      }
    } catch (error) {
      console.error('❌ Failed to check navigation:', error.message);
    }

    console.log('\n');
  }

  // Check for reset password handling
  checkResetPasswordHandling() {
    console.log('🔍 Checking Reset Password Handling...\n');
    
    console.log('⚠️ IMPORTANT: Check if /auth/reset-password route exists');
    console.log('📝 This route should handle password reset tokens from email');
    console.log('📝 Currently redirectTo uses: ${window.location.origin}/auth/reset-password');
    
    this.testResults.recommendations.push('Implement /auth/reset-password route to handle tokens');
    this.testResults.recommendations.push('Test email delivery in Supabase dashboard');
    
    console.log('\n');
  }

  // Run all analyses
  runAnalysis() {
    console.log('🚀 Starting Forgot Password Functionality Analysis...\n');
    console.log('=' .repeat(60));
    
    this.testEmailValidation();
    this.analyzeForgotPasswordScreenCode();
    this.analyzeLoginScreenIntegration();
    this.checkNavigationConfiguration();
    this.checkResetPasswordHandling();
    
    this.generateReport();
  }

  // Generate comprehensive report
  generateReport() {
    console.log('📊 COMPREHENSIVE ANALYSIS REPORT');
    console.log('=' .repeat(60));

    // Email Validation Results
    console.log('\n📧 EMAIL VALIDATION RESULTS:');
    const validationPassed = this.testResults.emailValidation.filter(t => t.passed).length;
    const validationTotal = this.testResults.emailValidation.length;
    console.log(`✅ Passed: ${validationPassed}/${validationTotal}`);
    
    if (validationPassed < validationTotal) {
      console.log('❌ Failed validation tests:');
      this.testResults.emailValidation
        .filter(t => !t.passed)
        .forEach(t => console.log(`   - ${t.description}: ${t.email}`));
    }

    // Issues Found
    console.log('\n❌ CRITICAL ISSUES IDENTIFIED:');
    if (this.testResults.issues.length === 0) {
      console.log('✅ No critical issues found!');
    } else {
      this.testResults.issues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue}`);
      });
    }

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    this.testResults.recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`);
    });

    // Specific Fix for Critical Issue
    if (this.testResults.issues.some(issue => issue.includes('window.location.origin'))) {
      console.log('\n🔧 IMMEDIATE FIX REQUIRED:');
      console.log('Replace line 71 in ForgotPasswordScreen.js:');
      console.log('❌ CURRENT: redirectTo: `${window.location.origin}/auth/reset-password`');
      console.log('✅ FIXED:   redirectTo: Platform.OS === \'web\' ? `${window.location.origin}/auth/reset-password` : \'myapp://reset-password\'');
    }

    // Overall Assessment
    console.log('\n🎯 OVERALL ASSESSMENT:');
    const criticalIssues = this.testResults.issues.filter(issue => 
      issue.includes('window.location.origin') || 
      issue.includes('navigation not properly implemented')
    ).length;

    if (criticalIssues === 0) {
      console.log('✅ FUNCTIONAL: The forgot password feature should work correctly');
      console.log('⚠️ MINOR ISSUES: Some improvements recommended');
    } else {
      console.log('❌ CRITICAL ISSUES FOUND: Feature will likely fail');
      console.log('🔧 IMMEDIATE ACTION REQUIRED');
      
      if (this.testResults.issues.some(issue => issue.includes('window.location.origin'))) {
        console.log('💥 CRASH RISK: Mobile app will crash when accessing forgot password');
      }
    }

    // Next Steps
    console.log('\n📋 NEXT STEPS TO VERIFY:');
    console.log('1. Fix the window.location.origin issue first');
    console.log('2. Check Supabase dashboard email settings');
    console.log('3. Verify email templates are configured');
    console.log('4. Test with a valid email address');
    console.log('5. Implement the reset password confirmation screen');

    console.log('\n' + '=' .repeat(60));
    console.log('Analysis completed! Priority: Fix critical issues first.');
  }
}

// Run the analysis
const analyzer = new ForgotPasswordAnalyzer();
analyzer.runAnalysis();