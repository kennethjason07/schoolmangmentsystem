#!/usr/bin/env node

/**
 * Simple HTTP Server for Testing Password Reset Flow
 * 
 * This server serves the web files so you can test the complete
 * password reset flow with proper URLs and redirection.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const WEB_DIR = __dirname; // Current directory (web folder)

// MIME type mapping
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain'
};

// Create HTTP server
const server = http.createServer((req, res) => {
  try {
    const parsedUrl = url.parse(req.url, true);
    let pathname = parsedUrl.pathname;

    console.log(`🌐 ${req.method} ${pathname}`);

    // Handle root path
    if (pathname === '/') {
      pathname = '/index.html';
    }

    // Security: prevent directory traversal
    if (pathname.includes('..')) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden: Directory traversal not allowed');
      return;
    }

    // Construct file path
    const filePath = path.join(WEB_DIR, pathname);
    const ext = path.extname(pathname).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    // Check if file exists
    fs.access(filePath, fs.constants.F_OK, (err) => {
      if (err) {
        console.log(`❌ File not found: ${filePath}`);
        
        // If it's an HTML request, serve index.html for SPA behavior
        if (ext === '.html' || ext === '') {
          const indexPath = path.join(WEB_DIR, 'index.html');
          fs.readFile(indexPath, (err, content) => {
            if (err) {
              res.writeHead(404, { 'Content-Type': 'text/plain' });
              res.end('404 - File not found');
            } else {
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(content);
            }
          });
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 - File not found');
        }
        return;
      }

      // Read and serve the file
      fs.readFile(filePath, (err, content) => {
        if (err) {
          console.log(`💥 Error reading file: ${err.message}`);
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('500 - Internal Server Error');
          return;
        }

        // Set CORS headers for development
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
        
        console.log(`✅ Served: ${pathname} (${contentType})`);
      });
    });

  } catch (error) {
    console.error('💥 Server error:', error);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('500 - Internal Server Error');
  }
});

// Handle server errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`❌ Port ${PORT} is already in use. Try stopping other servers or use a different port.`);
    process.exit(1);
  } else {
    console.error('💥 Server error:', err);
  }
});

// Start server
server.listen(PORT, () => {
  console.log('\n🚀 Password Reset Test Server Started!');
  console.log('=' .repeat(50));
  console.log(`📍 Server running at: http://localhost:${PORT}`);
  console.log(`📂 Serving files from: ${WEB_DIR}`);
  console.log('\n🧪 Testing URLs:');
  console.log(`   Landing Page: http://localhost:${PORT}`);
  console.log(`   Reset Page:   http://localhost:${PORT}/reset-password.html`);
  console.log('\n📧 How to test complete flow:');
  console.log('   1. Start your React Native app (expo start)');
  console.log('   2. Go to "Forgot Password" in the app');
  console.log('   3. Enter a registered email address');
  console.log('   4. Check email for reset link');
  console.log('   5. Click the link to test with real tokens');
  console.log('\n💡 Press Ctrl+C to stop the server');
  console.log('=' .repeat(50));
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down server gracefully...');
  server.close(() => {
    console.log('✅ Server stopped');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n\n👋 Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server stopped');
    process.exit(0);
  });
});