// Simple syntax check for TeacherDashboard.js
const fs = require('fs');
const path = require('path');

try {
  const filePath = path.join(__dirname, 'src', 'screens', 'teacher', 'TeacherDashboard.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Try to parse the file as JavaScript to check for syntax errors
  const acorn = require('acorn');
  const jsx = require('acorn-jsx');
  
  const parser = acorn.Parser.extend(jsx());
  
  try {
    parser.parse(content, {
      ecmaVersion: 2020,
      sourceType: 'module',
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: true
    });
    console.log('✅ TeacherDashboard.js syntax is valid!');
  } catch (parseError) {
    console.error('❌ Syntax error found:');
    console.error(`Line ${parseError.loc.line}: ${parseError.message}`);
  }
} catch (error) {
  console.error('Error reading file:', error.message);
}