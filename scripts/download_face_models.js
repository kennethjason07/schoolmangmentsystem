/**
 * Face Recognition Models Downloader
 * Downloads required face-api.js models for offline face recognition
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Models directory
const MODELS_DIR = path.join(__dirname, '..', 'public', 'models', 'face-recognition');

// Face-api.js models to download
const MODELS = [
  // Tiny Face Detector
  {
    name: 'tiny_face_detector_model-weights_manifest.json',
    url: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/tiny_face_detector_model-weights_manifest.json'
  },
  {
    name: 'tiny_face_detector_model-shard1',
    url: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/tiny_face_detector_model-shard1'
  },
  
  // Face Landmark Detection
  {
    name: 'face_landmark_68_model-weights_manifest.json',
    url: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_landmark_68_model-weights_manifest.json'
  },
  {
    name: 'face_landmark_68_model-shard1',
    url: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_landmark_68_model-shard1'
  },
  
  // Face Recognition
  {
    name: 'face_recognition_model-weights_manifest.json',
    url: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_recognition_model-weights_manifest.json'
  },
  {
    name: 'face_recognition_model-shard1',
    url: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_recognition_model-shard1'
  },
  {
    name: 'face_recognition_model-shard2',
    url: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_recognition_model-shard2'
  },
  
  // Face Expression Recognition (optional but recommended)
  {
    name: 'face_expression_model-weights_manifest.json',
    url: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_expression_model-weights_manifest.json'
  },
  {
    name: 'face_expression_model-shard1',
    url: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_expression_model-shard1'
  }
];

/**
 * Download a file from URL
 */
function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading: ${path.basename(filepath)}`);
    
    const file = fs.createWriteStream(filepath);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`✅ Downloaded: ${path.basename(filepath)}`);
        resolve();
      });
      
      file.on('error', (err) => {
        fs.unlink(filepath, () => {}); // Delete partial file
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Check if models directory exists
 */
function ensureModelsDirectory() {
  if (!fs.existsSync(MODELS_DIR)) {
    console.log(`Creating models directory: ${MODELS_DIR}`);
    fs.mkdirSync(MODELS_DIR, { recursive: true });
  }
}

/**
 * Check if model already exists
 */
function modelExists(modelPath) {
  return fs.existsSync(modelPath) && fs.statSync(modelPath).size > 0;
}

/**
 * Main download function
 */
async function downloadModels() {
  console.log('🤖 Face Recognition Models Downloader');
  console.log('=====================================');
  
  try {
    ensureModelsDirectory();
    
    let downloaded = 0;
    let skipped = 0;
    
    for (const model of MODELS) {
      const filepath = path.join(MODELS_DIR, model.name);
      
      if (modelExists(filepath)) {
        console.log(`⏭️  Skipped: ${model.name} (already exists)`);
        skipped++;
        continue;
      }
      
      try {
        await downloadFile(model.url, filepath);
        downloaded++;
        
        // Small delay to be nice to the server
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`❌ Failed to download ${model.name}:`, error.message);
        throw error;
      }
    }
    
    console.log('\n📊 Download Summary:');
    console.log(`✅ Downloaded: ${downloaded} models`);
    console.log(`⏭️  Skipped: ${skipped} models (already existed)`);
    console.log(`📁 Location: ${MODELS_DIR}`);
    
    if (downloaded > 0) {
      console.log('\n🎉 Face recognition models downloaded successfully!');
      console.log('Your facial recognition system is now ready for offline use.');
    } else {
      console.log('\n✅ All models are already present.');
    }
    
    // Verify models
    console.log('\n🔍 Verifying downloaded models...');
    const missingModels = MODELS.filter(model => 
      !modelExists(path.join(MODELS_DIR, model.name))
    );
    
    if (missingModels.length === 0) {
      console.log('✅ All required models are present and valid!');
    } else {
      console.log('❌ Missing models:');
      missingModels.forEach(model => console.log(`   - ${model.name}`));
      throw new Error('Some models are missing or corrupted');
    }
    
  } catch (error) {
    console.error('\n❌ Download failed:', error.message);
    console.log('\n💡 Manual Download Instructions:');
    console.log('If automatic download fails, you can manually download from:');
    console.log('https://github.com/justadudewhohacks/face-api.js/tree/master/weights');
    console.log(`And place them in: ${MODELS_DIR}`);
    process.exit(1);
  }
}

/**
 * Create a simple model info file
 */
function createModelInfo() {
  const infoPath = path.join(MODELS_DIR, 'MODEL_INFO.md');
  const info = `# Face Recognition Models

This directory contains the face-api.js models for offline face recognition.

## Models Included:

1. **tiny_face_detector_model** - Fast face detection
2. **face_landmark_68_model** - 68-point facial landmark detection
3. **face_recognition_model** - Face descriptor extraction for recognition
4. **face_expression_model** - Facial expression recognition (optional)

## Source:
Downloaded from: https://github.com/justadudewhohacks/face-api.js/tree/master/weights

## Usage:
These models are loaded by the FaceRecognitionService for offline processing.

## Size:
Total size: ~15-20MB

Generated: ${new Date().toISOString()}
`;

  fs.writeFileSync(infoPath, info);
  console.log(`📝 Created model info file: ${infoPath}`);
}

// Run the downloader
if (require.main === module) {
  downloadModels()
    .then(() => {
      createModelInfo();
      console.log('\n🚀 Ready to use facial recognition!');
    })
    .catch((error) => {
      console.error('Download process failed:', error);
      process.exit(1);
    });
}

module.exports = { downloadModels, MODELS_DIR };