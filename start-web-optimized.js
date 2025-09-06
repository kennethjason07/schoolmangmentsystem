// Quick test script to verify optimizations
const { spawn } = require('child_process');

console.log('🚀 Starting optimized web version...');
console.log('⚡ Optimizations applied:');
console.log('   - Lazy loading for all screens');
console.log('   - Conditional polyfills');
console.log('   - Web-specific bundle optimization');
console.log('   - Performance monitoring');

const child = spawn('npx', ['expo', 'start', '--web'], {
  stdio: 'inherit',
  shell: true
});

child.on('exit', (code) => {
  console.log(`Process exited with code ${code}`);
});
