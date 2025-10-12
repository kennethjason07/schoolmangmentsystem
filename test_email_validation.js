// Test the improved email validation regex
const improvedEmailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

const testCases = [
  { email: '', expected: false, description: 'Empty email' },
  { email: 'test@example.com', expected: true, description: 'Valid email' },
  { email: 'invalid-email', expected: false, description: 'Invalid format' },
  { email: 'user@domain', expected: false, description: 'Missing TLD' },
  { email: 'user.name+tag@example.com', expected: true, description: 'Complex valid email' },
  { email: 'user@sub.domain.com', expected: true, description: 'Subdomain email' },
  { email: 'user@.com', expected: false, description: 'Invalid domain' },
  { email: 'user@domain.', expected: false, description: 'Incomplete TLD' },
  { email: 'test.email+tag@long.subdomain.example.com', expected: true, description: 'Complex subdomain email' },
  { email: 'user_name@domain.co.uk', expected: true, description: 'Underscore and country domain' }
];

console.log('🧪 Testing Improved Email Validation Regex\n');

let passed = 0;
let total = testCases.length;

testCases.forEach(testCase => {
  const result = improvedEmailRegex.test(testCase.email);
  const status = result === testCase.expected ? '✅ PASS' : '❌ FAIL';
  
  console.log(`${status} ${testCase.description}: "${testCase.email}"`);
  
  if (result === testCase.expected) {
    passed++;
  }
});

console.log(`\n📊 Results: ${passed}/${total} tests passed`);

if (passed === total) {
  console.log('🎉 All email validation tests passed!');
} else {
  console.log(`⚠️ ${total - passed} tests failed - email validation needs improvement`);
}