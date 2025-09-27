/**
 * Log Replacement Script
 * 
 * This script replaces console.log statements with categorized logger calls
 * to reduce console noise and provide better log management
 */

const fs = require('fs');
const path = require('path');

// Directories to process
const DIRECTORIES = [
  './src/utils',
  './src/components',
  './src/screens',
  './src/context'
];

// File extensions to process
const EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx'];

// Mapping of log patterns to logger categories
const LOG_PATTERNS = [
  // Authentication logs
  {
    patterns: [
      /LOG\s+🔐/,
      /LOG\s+👤/,
      /LOG\s+📧/,
      /LOG\s+🎯/,
      /LOG\s+🏷️/,
      /console\.log\(['"`].*\[AUTH\].*['"`]/,
      /console\.log\(['"`].*auth.*['"`]/i,
      /console\.log\(['"`].*login.*['"`]/i,
      /console\.log\(['"`].*user.*['"`]/i
    ],
    replacement: 'logger.auth',
    import: 'auth'
  },
  
  // Tenant logs
  {
    patterns: [
      /LOG\s+🏢/,
      /LOG\s+🚀.*Tenant/,
      /console\.log\(['"`].*\[TENANT\].*['"`]/,
      /console\.log\(['"`].*tenant.*['"`]/i
    ],
    replacement: 'logger.tenant',
    import: 'tenant'
  },
  
  // API logs
  {
    patterns: [
      /LOG\s+🔄/,
      /LOG\s+📱/,
      /LOG\s+📊/,
      /console\.log\(['"`].*\[API\].*['"`]/,
      /console\.log\(['"`].*fetching.*['"`]/i,
      /console\.log\(['"`].*query.*['"`]/i
    ],
    replacement: 'logger.api',
    import: 'api'
  },
  
  // Component logs
  {
    patterns: [
      /LOG\s+🧩/,
      /LOG\s+🏗️/,
      /console\.log\(['"`].*\[COMPONENT\].*['"`]/,
      /console\.log\(['"`].*component.*['"`]/i,
      /console\.log\(['"`].*render.*['"`]/i
    ],
    replacement: 'logger.component',
    import: 'component'
  },
  
  // Real-time logs
  {
    patterns: [
      /LOG\s+⚡/,
      /LOG\s+💬/,
      /console\.log\(['"`].*\[REALTIME\].*['"`]/,
      /console\.log\(['"`].*subscription.*['"`]/i,
      /console\.log\(['"`].*real-time.*['"`]/i
    ],
    replacement: 'logger.realtime',
    import: 'realtime'
  },
  
  // Cache logs
  {
    patterns: [
      /LOG\s+📦/,
      /console\.log\(['"`].*\[CACHE\].*['"`]/,
      /console\.log\(['"`].*cache.*['"`]/i
    ],
    replacement: 'logger.cache',
    import: 'cache'
  },
  
  // Error logs
  {
    patterns: [
      /LOG\s+❌/,
      /console\.error/,
      /console\.log\(['"`].*error.*['"`]/i
    ],
    replacement: 'logger.error',
    import: 'error'
  },
  
  // Warning logs
  {
    patterns: [
      /LOG\s+⚠️/,
      /console\.warn/,
      /console\.log\(['"`].*warning.*['"`]/i
    ],
    replacement: 'logger.warn',
    import: 'warn'
  },
  
  // Success logs
  {
    patterns: [
      /LOG\s+✅/,
      /console\.log\(['"`].*success.*['"`]/i
    ],
    replacement: 'logger.success',
    import: 'success'
  },
  
  // Debug logs
  {
    patterns: [
      /LOG\s+🔍/,
      /console\.log\(['"`].*\[DEBUG\].*['"`]/,
      /console\.log\(['"`].*debug.*['"`]/i
    ],
    replacement: 'logger.debug',
    import: 'debug'
  }
];

/**
 * Get all files recursively from a directory
 */
function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);
  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function(file) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      const ext = path.extname(file);
      if (EXTENSIONS.includes(ext)) {
        arrayOfFiles.push(fullPath);
      }
    }
  });

  return arrayOfFiles;
}

/**
 * Process a single file to replace logs
 */
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let modifiedContent = content;
    let hasChanges = false;
    const usedImports = new Set();

    // Apply log pattern replacements
    LOG_PATTERNS.forEach(({ patterns, replacement, import: importName }) => {
      patterns.forEach(pattern => {
        if (pattern.test(modifiedContent)) {
          // Simple replacement - you might need to adjust this logic
          // based on your specific log formats
          const lines = modifiedContent.split('\n');
          const newLines = lines.map(line => {
            if (pattern.test(line)) {
              hasChanges = true;
              usedImports.add(importName);
              
              // Extract the message and data from console.log
              const logMatch = line.match(/console\.(log|error|warn)\((.*)\)/);
              if (logMatch) {
                const logContent = logMatch[2];
                return line.replace(/console\.(log|error|warn)\((.*)\)/, `${replacement}(${logContent})`);
              }
              
              // Handle LOG statements
              const logStatement = line.match(/LOG\s+(.*)/);
              if (logStatement) {
                return line.replace(/LOG\s+(.*)/, `${replacement}('${logStatement[1]}')`);
              }
            }
            return line;
          });
          
          modifiedContent = newLines.join('\n');
        }
      });
    });

    // Add logger import if changes were made
    if (hasChanges && usedImports.size > 0) {
      const imports = Array.from(usedImports).join(', ');
      const importStatement = `import { ${imports} } from '../utils/logger';\n`;
      
      // Find existing imports or add at the top
      const importRegex = /^import.*from.*['"`];?\s*$/gm;
      const existingImports = modifiedContent.match(importRegex);
      
      if (existingImports && existingImports.length > 0) {
        // Add after last import
        const lastImport = existingImports[existingImports.length - 1];
        modifiedContent = modifiedContent.replace(lastImport, lastImport + '\n' + importStatement);
      } else {
        // Add at the beginning
        modifiedContent = importStatement + '\n' + modifiedContent;
      }

      fs.writeFileSync(filePath, modifiedContent);
      console.log(`✅ Updated: ${filePath} (${usedImports.size} logger types)`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Main execution
 */
function main() {
  console.log('🚀 Starting log replacement script...\n');
  
  let totalFiles = 0;
  let modifiedFiles = 0;

  DIRECTORIES.forEach(directory => {
    if (fs.existsSync(directory)) {
      console.log(`📁 Processing directory: ${directory}`);
      const files = getAllFiles(directory);
      
      files.forEach(filePath => {
        totalFiles++;
        if (processFile(filePath)) {
          modifiedFiles++;
        }
      });
    } else {
      console.log(`⚠️  Directory not found: ${directory}`);
    }
  });

  console.log(`\n📊 Summary:`);
  console.log(`   Total files processed: ${totalFiles}`);
  console.log(`   Files modified: ${modifiedFiles}`);
  console.log(`   Files unchanged: ${totalFiles - modifiedFiles}`);
  
  if (modifiedFiles > 0) {
    console.log(`\n✅ Log replacement completed!`);
    console.log(`\n📝 Next steps:`);
    console.log(`   1. Review the changes in your files`);
    console.log(`   2. Adjust the logger configuration in src/utils/logger.js`);
    console.log(`   3. Test your application to ensure logs work as expected`);
  } else {
    console.log(`\n🎯 No files needed modification.`);
  }
}

// Run the script
main();