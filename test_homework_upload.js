/**
 * Test script to verify homework file upload functionality
 * Run this in a React Native environment or Node.js with proper imports
 */

import { uploadHomeworkFile, uploadMultipleHomeworkFiles, deleteHomeworkFile } from './src/utils/homeworkFileUpload.js';

// Test file object (simulated)
const testFile = {
  name: 'test-homework.pdf',
  size: 1024 * 500, // 500KB
  mimeType: 'application/pdf',
  uri: 'file:///path/to/test/file.pdf', // Replace with actual test file path
  type: 'application/pdf'
};

const testFiles = [
  {
    id: '1',
    name: 'homework-instructions.pdf',
    size: 1024 * 800,
    mimeType: 'application/pdf',
    uri: 'file:///path/to/test/instructions.pdf',
    type: 'application/pdf'
  },
  {
    id: '2', 
    name: 'sample-image.jpg',
    size: 1024 * 300,
    mimeType: 'image/jpeg',
    uri: 'file:///path/to/test/image.jpg',
    type: 'image/jpeg'
  }
];

/**
 * Test single file upload
 */
async function testSingleUpload() {
  console.log('🧪 Testing single file upload...');
  
  const result = await uploadHomeworkFile(
    testFile,
    'teacher_123', // Replace with actual teacher ID
    'class_456',   // Replace with actual class ID
    'subject_789', // Replace with actual subject ID
    {
      title: 'Test Homework Assignment',
      description: 'This is a test homework assignment',
      due_date: '2024-01-30'
    }
  );
  
  if (result.success) {
    console.log('✅ Single upload successful:', result);
    return result;
  } else {
    console.error('❌ Single upload failed:', result.error);
    return null;
  }
}

/**
 * Test multiple file upload
 */
async function testMultipleUpload() {
  console.log('🧪 Testing multiple file upload...');
  
  const result = await uploadMultipleHomeworkFiles(
    testFiles,
    'teacher_123', // Replace with actual teacher ID  
    'class_456',   // Replace with actual class ID
    'subject_789', // Replace with actual subject ID
    {
      title: 'Test Multiple Files Homework',
      description: 'Testing multiple file upload',
      due_date: '2024-02-01'
    }
  );
  
  console.log('📊 Multiple upload result:', result);
  
  if (result.success) {
    console.log(`✅ Successfully uploaded ${result.successfulUploads} out of ${result.totalFiles} files`);
    return result;
  } else {
    console.log(`⚠️ Upload completed with ${result.failedUploads} failures out of ${result.totalFiles} files`);
    return result;
  }
}

/**
 * Test file deletion
 */
async function testFileDeletion(filePath) {
  console.log('🧪 Testing file deletion...');
  
  const result = await deleteHomeworkFile(filePath);
  
  if (result.success) {
    console.log('✅ File deletion successful');
  } else {
    console.error('❌ File deletion failed:', result.error);
  }
  
  return result;
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('🚀 Starting homework file upload tests...\n');
  
  // Test 1: Single file upload
  const singleResult = await testSingleUpload();
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 2: Multiple file upload
  const multipleResult = await testMultipleUpload();
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 3: File deletion (if we have a file path from upload)
  if (singleResult && singleResult.filePath) {
    await testFileDeletion(singleResult.filePath);
  }
  
  console.log('\n🏁 Tests completed!');
  
  // Summary
  console.log('\n📋 Test Summary:');
  console.log(`- Single upload: ${singleResult ? '✅ Passed' : '❌ Failed'}`);
  console.log(`- Multiple upload: ${multipleResult?.successfulUploads > 0 ? '✅ Passed' : '❌ Failed'}`);
  console.log(`- File deletion: ${singleResult ? '✅ Tested' : '⏭️ Skipped'}`);
}

/**
 * Quick bucket test (just check if we can connect to Supabase)
 */
async function testBucketConnection() {
  console.log('🔗 Testing Supabase storage connection...');
  
  try {
    // This will test if we can access the storage bucket
    const testResult = await uploadHomeworkFile(
      {
        name: 'connection-test.txt',
        size: 10,
        mimeType: 'text/plain',
        uri: 'data:text/plain;base64,SGVsbG8gV29ybGQ=', // "Hello World" in base64
        type: 'text/plain'
      },
      'test_teacher',
      'test_class', 
      'test_subject',
      { title: 'Connection Test' }
    );
    
    if (testResult.success) {
      console.log('✅ Supabase storage connection working!');
      
      // Clean up test file
      if (testResult.filePath) {
        await deleteHomeworkFile(testResult.filePath);
        console.log('🧹 Cleaned up test file');
      }
    } else {
      console.error('❌ Supabase storage connection failed:', testResult.error);
    }
  } catch (error) {
    console.error('❌ Connection test error:', error);
  }
}

// Export functions for manual testing
export {
  testSingleUpload,
  testMultipleUpload,
  testFileDeletion,
  testBucketConnection,
  runTests
};

// If running directly, execute all tests
if (require.main === module) {
  runTests();
}
