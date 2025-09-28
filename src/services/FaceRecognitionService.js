/**
 * Facial Recognition Service - React Native Compatible
 * Provides facial recognition capabilities for React Native apps
 * Uses stub implementation for development, can be extended with real providers
 */

import { supabase } from '../utils/supabase';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { File } from 'expo-file-system';
import { decode as atob } from 'base-64';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Simple JSON encoding for React Native compatibility
// In production, replace with proper encryption library

// Configuration constants
const CONFIG = {
  // Provider selection: 'offline', 'aws', 'azure', 'google'
  PROVIDER: process.env.EXPO_PUBLIC_FACE_PROVIDER || process.env.REACT_APP_FACE_RECOGNITION_PROVIDER || 'offline',
  
  // Encryption settings
  ENCRYPTION_KEY: process.env.EXPO_PUBLIC_FACE_ENCRYPTION_KEY || process.env.REACT_APP_FACE_ENCRYPTION_KEY || 'default-key-change-in-production',
  
  // Recognition thresholds
  DEFAULT_CONFIDENCE_THRESHOLD: 0.8,
  HIGH_ACCURACY_THRESHOLD: 0.9,
  
  // Storage buckets
  FACE_TEMPLATES_BUCKET: 'facial-templates',
  FACE_EVENTS_BUCKET: 'facial-events',
  
  // Image processing settings
  MAX_IMAGE_SIZE: 2 * 1024 * 1024, // 2MB
  SUPPORTED_FORMATS: ['image/jpeg', 'image/png', 'image/webp'],
  TARGET_IMAGE_SIZE: { width: 300, height: 300 },
  
  // Offline processing (using face-api.js or similar)
  OFFLINE_MODEL_PATH: '/models/face-recognition',
  
  // Performance settings
  MAX_RECOGNITION_TIME: 10000, // 10 seconds timeout
};

// Azure Face API configuration (client-side, Expo-friendly)
const AZURE = {
  ENDPOINT: process.env.EXPO_PUBLIC_AZURE_FACE_ENDPOINT || process.env.REACT_APP_AZURE_FACE_ENDPOINT,
  KEY: process.env.EXPO_PUBLIC_AZURE_FACE_KEY || process.env.REACT_APP_AZURE_FACE_KEY,
  IDENTIFY_CONFIDENCE: 0.6,
};

const PROVIDER_OVERRIDE_KEY = 'face_provider_override';

const azureHeadersJson = AZURE.KEY ? {
  'Ocp-Apim-Subscription-Key': AZURE.KEY,
  'Content-Type': 'application/json',
} : null;

async function azureFetchJson(path, body) {
  if (!AZURE.ENDPOINT || !AZURE.KEY) throw new Error('Azure Face API not configured');
  const res = await fetch(`${AZURE.ENDPOINT}${path}`, {
    method: 'POST',
    headers: azureHeadersJson,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Azure error ${res.status}: ${txt}`);
  }
  return res.json();
}

function sanitizePersonGroupId(id) {
  // Lowercase and keep alphanumerics and dashes/underscores (Azure requirement)
  return String(id || '').toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 64);
}

async function ensurePersonGroup(tenantId) {
  const groupId = sanitizePersonGroupId(tenantId);
  try {
    await fetch(`${AZURE.ENDPOINT}/face/v1.0/persongroups/${groupId}`, {
      method: 'PUT',
      headers: azureHeadersJson,
      body: JSON.stringify({ name: groupId })
    });
  } catch (e) {
    // ignore create errors if already exists
  }
  return groupId;
}

async function listPersons(groupId) {
  const res = await fetch(`${AZURE.ENDPOINT}/face/v1.0/persongroups/${groupId}/persons`, {
    method: 'GET',
    headers: { 'Ocp-Apim-Subscription-Key': AZURE.KEY },
  });
  if (!res.ok) return [];
  return res.json();
}

async function ensurePerson(groupId, personId, displayName) {
  const persons = await listPersons(groupId);
  const existing = (persons || []).find(p => p.userData === String(personId));
  if (existing) return existing.personId;
  const created = await azureFetchJson(`/face/v1.0/persongroups/${groupId}/persons`, {
    name: displayName || `person_${personId}`,
    userData: String(personId),
  });
  return created.personId;
}

async function trainPersonGroup(groupId) {
  await fetch(`${AZURE.ENDPOINT}/face/v1.0/persongroups/${groupId}/train`, {
    method: 'POST',
    headers: { 'Ocp-Apim-Subscription-Key': AZURE.KEY },
  });
}

function extractStoragePathFromUrl(url, bucket) {
  if (!url) return '';
  if (url.includes('/storage/v1/object/public/')) {
    const parts = url.split('/');
    const idx = parts.findIndex(p => p === bucket);
    if (idx !== -1) return parts.slice(idx + 1).join('/');
  } else if (url.includes(`${bucket}/`)) {
    const i = url.indexOf(`${bucket}/`);
    return url.substring(i + bucket.length + 1);
  } else if (url.startsWith('https://mock-storage.local/')) {
    return url.replace('https://mock-storage.local/', '');
  } else if (!url.startsWith('http')) {
    return url; // already a path
  }
  return '';
}

async function getSignedUrlFor(bucket, filePath, expiresSec = 300) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(filePath, expiresSec);
  if (error || !data?.signedUrl) throw new Error('Failed to create signed URL');
  return data.signedUrl;
}

class FaceRecognitionService {
  constructor() {
    this.provider = null;
    this.providerName = null; // effective provider name after env/override resolution
    this.isInitialized = false;
    this.modelLoaded = false;
    this.azureCfg = null; // { ENDPOINT, KEY, IDENTIFY_CONFIDENCE }
  }

  /**
   * Initialize the face recognition service
   */
  async initialize() {
    try {
      // Resolve provider from env, allow dev override from storage
      let effectiveProvider = CONFIG.PROVIDER || 'offline';
      try {
        const override = await this.getProviderOverride();
        if (override) {
          console.log(`[FaceRecognition] Using provider override: ${override}`);
          effectiveProvider = override;
        }
      } catch (e) {
        // ignore override errors
      }

      // Auto-select Azure if credentials are present and no explicit override was set
      const azureCredsPresent = !!(AZURE.ENDPOINT && AZURE.KEY);
      if (effectiveProvider !== 'azure') {
        const override = await this.getProviderOverride();
        if (!override && azureCredsPresent) {
          console.warn('[FaceRecognition] Azure credentials detected - switching provider to azure');
          effectiveProvider = 'azure';
        }
      }

      this.providerName = effectiveProvider;
      console.log(`Initializing Face Recognition Service with provider: ${effectiveProvider}`);
      
      switch (effectiveProvider) {
        case 'offline':
          await this.initializeOfflineProvider();
          break;
        case 'aws':
          await this.initializeAWSProvider();
          break;
        case 'azure':
          await this.initializeAzureProvider();
          break;
        case 'google':
          await this.initializeGoogleProvider();
          break;
        default:
          throw new Error(`Unsupported provider: ${effectiveProvider}`);
      }
      
      this.isInitialized = true;
      console.log('Face Recognition Service initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Face Recognition Service:', error);
      return false;
    }
  }

  /**
   * Initialize offline face recognition - React Native compatible
   */
  async initializeOfflineProvider() {
    try {
      console.log('Initializing React Native compatible face recognition...');
      
      // For React Native, we'll use the stub implementation for development
      // In production, this would be replaced with a React Native compatible ML library
      // such as @react-native-ml-kit/face-detection or similar
      
      if (Platform.OS === 'web') {
        // Web platform could potentially use face-api.js
        console.warn('Web platform detected, using stub implementation');
      }
      
      // Always use stub for React Native compatibility
      this.provider = 'stub';
      this.modelLoaded = true;
      console.log('React Native compatible face recognition initialized');
    } catch (error) {
      console.error('Failed to initialize offline provider:', error);
      this.provider = 'stub';
      console.warn('Falling back to stub implementation');
    }
  }

  /**
   * Initialize AWS Rekognition
   */
  async initializeAWSProvider() {
    // Implementation for AWS Rekognition
    // Requires AWS SDK configuration
    throw new Error('AWS provider not implemented yet. Use offline provider for now.');
  }

  /**
   * Initialize Azure Face API
   */
  async initializeAzureProvider() {
    try {
      const cfg = await this.resolveAzureConfig();
      if (!cfg || !cfg.ENDPOINT || !cfg.KEY) {
        throw new Error('Azure Face API not configured: set EXPO_PUBLIC_AZURE_FACE_ENDPOINT and EXPO_PUBLIC_AZURE_FACE_KEY');
      }
      this.azureCfg = cfg;
      this.provider = 'azure';
      this.modelLoaded = true;
      console.log('Azure Face API provider initialized');
    } catch (e) {
      console.error('Failed to initialize Azure provider:', e);
      throw e;
    }
  }

  /**
   * Initialize Google Cloud Vision API
   */
  async initializeGoogleProvider() {
    // Implementation for Google Cloud Vision
    throw new Error('Google provider not implemented yet. Use offline provider for now.');
  }

  /**
   * Enroll a new face template for a person
   */
  async enrollFace({
    personId,
    personType, // 'student' or 'teacher'
    imageFile,
    templateName = 'primary',
    confidenceThreshold = CONFIG.DEFAULT_CONFIDENCE_THRESHOLD,
    enrolledBy,
    tenantId
  }) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    let enrollmentResult = null;

    try {
      // Validate inputs
      this.validateImage(imageFile);
      
      // Process image and extract face encoding (may be null for Azure path)
      let { faceEncoding, processedImageUrl, faceDetected } = await this.processFaceImage(
        imageFile, 
        'enrollment',
        tenantId
      );

      if (!faceDetected) {
        throw new Error('No face detected in the provided image');
      }

      let azurePersonId = null;
      let encryptedEncoding;

      if (this.provider === 'azure') {
        try {
          // Resolve config to ensure we have endpoint/key at runtime
          if (!this.azureCfg) {
            const cfg = await this.resolveAzureConfig();
            if (!cfg || !cfg.ENDPOINT || !cfg.KEY) {
              throw new Error('Azure Face API not configured at runtime');
            }
            this.azureCfg = cfg;
          }

          // For Azure, create person and add face using the stored image URL
          const groupId = await this.ensurePersonGroupInternal(tenantId);
          azurePersonId = await this.ensurePersonInternal(groupId, personId, `person_${personId}`);

          // We need a signed URL for the stored image to let Azure fetch it
          const bucket = CONFIG.FACE_TEMPLATES_BUCKET;
          const storagePath = extractStoragePathFromUrl(processedImageUrl, bucket);
          if (!storagePath) throw new Error('Could not derive storage path for enrollment image');
          const signedUrl = await getSignedUrlFor(bucket, storagePath, 300);

          // Add face to Azure person
          await this.azureFetchJson(`/face/v1.0/persongroups/${sanitizePersonGroupId(tenantId)}/persons/${azurePersonId}/persistedFaces`, {
            url: signedUrl
          });

          // Train the group
          await this.trainPersonGroupInternal(sanitizePersonGroupId(tenantId));

          // For Azure path, we don't rely on local encodings
          encryptedEncoding = this.encryptFaceData([]);
        } catch (azureErr) {
          // If Azure unsupported (no Identification/Verification approval), gracefully fallback
          if (this.isAzureUnsupportedFeature(azureErr)) {
            console.warn('⚠️ Azure UnsupportedFeature during enrollment. Falling back to offline template storage.');
            // Generate a stub/offline encoding so recognition can work locally
            const fallbackEncoding = this.generateStubEncoding();
            encryptedEncoding = this.encryptFaceData(fallbackEncoding);
            azurePersonId = null; // will remain null until Azure is approved
          } else {
            throw azureErr;
          }
        }
      }

      // If not Azure or if we didn't set encryptedEncoding above, use offline encoding
      if (!encryptedEncoding) {
        if (!faceEncoding || !Array.isArray(faceEncoding)) {
          // ensure we have some encoding even if provider didn't generate one
          faceEncoding = this.generateStubEncoding();
        }
        encryptedEncoding = this.encryptFaceData(faceEncoding);
      }

      // Store face template in database
      const { data: template, error } = await supabase
        .from('facial_templates')
        .insert({
          person_id: personId,
          person_type: personType,
          template_name: templateName,
          face_encoding: encryptedEncoding,
          face_image_url: processedImageUrl,
          confidence_threshold: confidenceThreshold,
          enrolled_by: enrolledBy,
          tenant_id: tenantId,
          azure_person_id: azurePersonId
        })
        .select()
        .single();

      if (error) throw error;

      // Log enrollment event
      await this.logRecognitionEvent({
        eventType: 'enrollment',
        personId,
        personType,
        recognitionDuration: Date.now() - startTime,
        performedBy: enrolledBy,
        tenantId,
        inputImageUrl: processedImageUrl,
      });

      enrollmentResult = {
        success: true,
        templateId: template.id,
        message: azurePersonId ? 'Face enrollment completed successfully' : 'Face enrolled (offline mode). Azure identification not enabled on this resource.',
        faceDetected: true,
        fallback: azurePersonId ? undefined : { used: true, reason: 'azure_unsupported_feature' }
      };

    } catch (error) {
      console.error('Face enrollment failed:', error);
      
      // Log failed enrollment
      await this.logRecognitionEvent({
        eventType: 'enrollment',
        personId,
        personType,
        recognitionDuration: Date.now() - startTime,
        performedBy: enrolledBy,
        tenantId,
        errorMessage: error.message,
      });

      enrollmentResult = {
        success: false,
        error: error.message,
        faceDetected: error.message !== 'No face detected in the provided image',
      };
    }

    return enrollmentResult;
  }

  /**
   * Recognize a face for attendance verification
   */
  async recognizeFace({
    imageFile,
    personType = null, // 'student', 'teacher', or null for both
    recognitionMethod = 'camera',
    performedBy,
    tenantId,
    deviceInfo = {},
    locationInfo = {}
  }) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    let recognitionResult = null;

    try {
      // Validate inputs
      this.validateImage(imageFile);

      // Process input image
      const { faceEncoding, processedImageUrl, faceDetected } = await this.processFaceImage(
        imageFile,
        'recognition',
        tenantId
      );

      let matchResult = { matched: false, confidence: 0 };
      let recognitionDuration = 0;

      if (this.provider === 'azure') {
        try {
          // Resolve config to ensure we have endpoint/key at runtime
          if (!this.azureCfg) {
            const cfg = await this.resolveAzureConfig();
            if (!cfg || !cfg.ENDPOINT || !cfg.KEY) {
              throw new Error('Azure Face API not configured at runtime');
            }
            this.azureCfg = cfg;
          }

          // Azure: detect + identify
          const bucket = CONFIG.FACE_EVENTS_BUCKET;
          const storagePath = extractStoragePathFromUrl(processedImageUrl, bucket);
          const signedUrl = await getSignedUrlFor(bucket, storagePath, 300);

          const detect = await this.azureFetchJson('/face/v1.0/detect?returnFaceId=true', { url: signedUrl });
          if (!detect?.length) {
            throw new Error('No face detected in the provided image');
          }
          const faceId = detect[0].faceId;

          const groupId = sanitizePersonGroupId(tenantId);
          const identify = await this.azureFetchJson('/face/v1.0/identify', {
            personGroupId: groupId,
            faceIds: [faceId],
            maxNumOfCandidatesReturned: 1,
            confidenceThreshold: (this.azureCfg && this.azureCfg.IDENTIFY_CONFIDENCE) || AZURE.IDENTIFY_CONFIDENCE,
          });
          const candidates = identify?.[0]?.candidates || [];
          if (candidates.length) {
            const best = candidates[0];
            // Map azure_person_id back to local person_id/person_type
            const { data: templates } = await supabase
              .from('facial_templates')
              .select('*')
              .eq('tenant_id', tenantId)
              .eq('azure_person_id', best.personId)
              .eq('is_active', true)
              .limit(1);
            if (templates && templates.length) {
              matchResult = {
                matched: true,
                template: templates[0],
                confidence: best.confidence,
                bestConfidence: best.confidence,
              };
            }
          }
          recognitionDuration = Date.now() - startTime;
        } catch (azureErr) {
          if (this.isAzureUnsupportedFeature(azureErr)) {
            console.warn('⚠️ Azure UnsupportedFeature during recognition. Falling back to offline matching.');
            // Fallback to offline path below
          } else {
            throw azureErr;
          }
        }
      } else {
        // Offline/stub path: local compare with stored encodings
        if (!faceDetected) {
          throw new Error('No face detected in the provided image');
        }
        // Get active templates for comparison
        const templates = await this.getActiveTemplates(tenantId, personType);
        if (templates.length === 0) {
          throw new Error('No enrolled face templates found for comparison');
        }
        matchResult = await this.compareWithTemplates(faceEncoding, templates);
        recognitionDuration = Date.now() - startTime;
      }

      if (matchResult.matched) {
        // Successful recognition
        await this.logRecognitionEvent({
          eventType: 'recognition_success',
          personId: matchResult.template.person_id,
          personType: matchResult.template.person_type,
          matchedTemplateId: matchResult.template.id,
          confidenceScore: matchResult.confidence,
          recognitionDuration,
          performedBy,
          tenantId,
          inputImageUrl: processedImageUrl,
          recognitionMethod,
          deviceInfo,
          locationInfo,
        });

        recognitionResult = {
          success: true,
          matched: true,
          person: {
            id: matchResult.template.person_id,
            type: matchResult.template.person_type,
          },
          confidence: matchResult.confidence,
          recognitionDuration,
          template: matchResult.template,
        };

      } else {
        // No match found
        await this.logRecognitionEvent({
          eventType: 'recognition_failure',
          recognitionDuration,
          performedBy,
          tenantId,
          inputImageUrl: processedImageUrl,
          recognitionMethod,
          errorMessage: 'No matching face template found',
          deviceInfo,
          locationInfo,
        });

        recognitionResult = {
          success: true,
          matched: false,
          confidence: matchResult.bestConfidence || 0,
          recognitionDuration,
          message: 'No matching face found in enrolled templates',
        };
      }

    } catch (error) {
      console.error('Face recognition failed:', error);

      // Log failed recognition attempt
      await this.logRecognitionEvent({
        eventType: 'recognition_failure',
        recognitionDuration: Date.now() - startTime,
        performedBy,
        tenantId,
        recognitionMethod,
        errorMessage: error.message,
        deviceInfo,
        locationInfo,
      });

      recognitionResult = {
        success: false,
        error: error.message,
        recognitionDuration: Date.now() - startTime,
        faceDetected: error.message !== 'No face detected in the provided image',
      };
    }

    return recognitionResult;
  }

  /**
   * Process face image and extract encoding
   */
  async processFaceImage(imageFile, purpose, tenantId) {
    try {
      // Convert to appropriate format and size
      const processedImage = await this.preprocessImage(imageFile);
      
      // Upload processed image to Supabase storage
      const imageUrl = await this.uploadImageToStorage(processedImage, purpose, tenantId);

      // Extract face encoding based on provider
      let faceEncoding = null;
      let faceDetected = false;

      switch (this.provider) {
        case 'azure':
          // Azure path does detection later via API; assume face present for now (will validate later)
          faceDetected = true;
          break;
        case 'offline':
          const result = await this.extractFaceEncodingOffline(processedImage);
          faceEncoding = result.encoding;
          faceDetected = result.detected;
          break;
        case 'stub':
          // Stub implementation for development
          faceEncoding = this.generateStubEncoding();
          faceDetected = true;
          break;
        default:
          throw new Error(`Face processing not implemented for provider: ${this.provider}`);
      }

      return {
        faceEncoding,
        processedImageUrl: imageUrl,
        faceDetected,
      };

    } catch (error) {
      console.error('Image processing failed:', error);
      throw new Error(`Image processing failed: ${error.message}`);
    }
  }

  /**
   * Extract face encoding using offline processing (face-api.js)
   */
  async extractFaceEncodingOffline(imageFile) {
    try {
      if (!this.modelLoaded) {
        throw new Error('Offline models not loaded');
      }

      // Create image element for processing
      const img = await this.createImageElement(imageFile);
      
      // Detect faces with landmarks and descriptors
      const detections = await this.faceapi
        .detectAllFaces(img, new this.faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (detections.length === 0) {
        return { detected: false, encoding: null };
      }

      if (detections.length > 1) {
        console.warn('Multiple faces detected, using the first one');
      }

      // Get the face descriptor (encoding)
      const faceDescriptor = detections[0].descriptor;
      
      return {
        detected: true,
        encoding: Array.from(faceDescriptor), // Convert Float32Array to regular array
      };

    } catch (error) {
      console.error('Offline face encoding failed:', error);
      return { detected: false, encoding: null };
    }
  }

  /**
   * Compare face encoding with enrolled templates
   */
  async compareWithTemplates(inputEncoding, templates) {
    let bestMatchAboveThreshold = null;
    let bestConfidenceAboveThreshold = 0;

    // Track absolute best regardless of threshold (for stub provider fallback)
    let absoluteBestMatch = null;
    let absoluteBestConfidence = 0;

    for (const template of templates) {
      try {
        // Decrypt template encoding
        const templateEncoding = this.decryptFaceData(template.face_encoding);
        
        // Calculate similarity (using Euclidean distance)
        const confidence = this.calculateSimilarity(inputEncoding, templateEncoding);

        // Absolute best tracking
        if (confidence > absoluteBestConfidence) {
          absoluteBestConfidence = confidence;
          absoluteBestMatch = template;
        }
        
        // Thresholded best tracking
        if (confidence > bestConfidenceAboveThreshold && confidence >= (template.confidence_threshold || 0)) {
          bestMatchAboveThreshold = template;
          bestConfidenceAboveThreshold = confidence;
        }
      } catch (error) {
        console.error(`Error comparing with template ${template.id}:`, error);
      }
    }

    // In stub provider, fall back to absolute best match ignoring threshold to enable demo/testing
    if (this.provider === 'stub' && !bestMatchAboveThreshold && absoluteBestMatch) {
      return {
        matched: true,
        template: absoluteBestMatch,
        confidence: absoluteBestConfidence,
        bestConfidence: absoluteBestConfidence,
      };
    }

    return {
      matched: bestMatchAboveThreshold !== null,
      template: bestMatchAboveThreshold,
      confidence: bestConfidenceAboveThreshold,
      bestConfidence: absoluteBestConfidence,
    };
  }

  /**
   * Calculate similarity between two face encodings
   */
  calculateSimilarity(encoding1, encoding2) {
    if (!encoding1 || !encoding2 || encoding1.length !== encoding2.length) {
      return 0;
    }

    // Calculate Euclidean distance
    let distance = 0;
    for (let i = 0; i < encoding1.length; i++) {
      distance += Math.pow(encoding1[i] - encoding2[i], 2);
    }
    distance = Math.sqrt(distance);

    // Convert distance to confidence (0-1, where 1 is perfect match)
    // Face-api.js typical distance threshold is around 0.6
    const maxDistance = 1.0;
    const confidence = Math.max(0, 1 - (distance / maxDistance));
    
    return confidence;
  }

  /**
   * Clean up corrupted face data in database
   */
  async cleanupCorruptedFaceData(tenantId) {
    try {
      console.log('🧹 Cleaning up corrupted face data...');
      
      // Get all templates
      const { data: templates, error } = await supabase
        .from('facial_templates')
        .select('id, face_encoding')
        .eq('tenant_id', tenantId);
      
      if (error) {
        console.error('Error fetching templates for cleanup:', error);
        return;
      }
      
      let cleanedCount = 0;
      for (const template of templates || []) {
        try {
          // Try to decode the face data
          this.decryptFaceData(template.face_encoding);
        } catch (error) {
          // If it fails, update with clean empty array
          console.log(`Cleaning corrupted template ${template.id}`);
          
          await supabase
            .from('facial_templates')
            .update({ face_encoding: '[]' })
            .eq('id', template.id);
            
          cleanedCount++;
        }
      }
      
      console.log(`✅ Cleaned up ${cleanedCount} corrupted face templates`);
      return cleanedCount;
      
    } catch (error) {
      console.error('Error during cleanup:', error);
      return 0;
    }
  }

  /**
   * Get active face templates for comparison
   */
  async getActiveTemplates(tenantId, personType = null) {
    let query = supabase
      .from('facial_templates')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    if (personType) {
      query = query.eq('person_type', personType);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('Failed to fetch templates:', error);
      return [];
    }

    // Filter out templates with corrupted face data
    const validTemplates = [];
    for (const template of data || []) {
      try {
        // Test if face_encoding can be decoded
        const decoded = this.decryptFaceData(template.face_encoding);
        if (decoded && Array.isArray(decoded)) {
          validTemplates.push(template);
        }
      } catch (error) {
        console.warn(`Skipping corrupted template ${template.id}:`, error.message);
        // Optionally clean up corrupted template in background
        this.cleanupSingleTemplate(template.id);
      }
    }

    console.log(`📊 Found ${validTemplates.length} valid templates out of ${(data || []).length} total`);
    return validTemplates;
  }

  /**
   * Clean up a single corrupted template
   */
  async cleanupSingleTemplate(templateId) {
    try {
      await supabase
        .from('facial_templates')
        .update({ face_encoding: '[]' })
        .eq('id', templateId);
      console.log(`🔧 Auto-cleaned corrupted template ${templateId}`);
    } catch (error) {
      console.error(`Failed to clean template ${templateId}:`, error);
    }
  }

  /**
   * Log recognition event for audit trail
   */
  async logRecognitionEvent({
    eventType,
    personId = null,
    personType = null,
    matchedTemplateId = null,
    confidenceScore = null,
    recognitionDuration,
    performedBy,
    tenantId,
    inputImageUrl = null,
    recognitionMethod = 'camera',
    errorMessage = null,
    deviceInfo = {},
    locationInfo = {}
  }) {
    try {
      const { error } = await supabase
        .from('facial_recognition_events')
        .insert({
          event_type: eventType,
          person_id: personId,
          person_type: personType,
          matched_template_id: matchedTemplateId,
          confidence_score: confidenceScore,
          recognition_method: recognitionMethod,
          input_image_url: inputImageUrl,
          recognition_duration_ms: recognitionDuration,
          device_info: deviceInfo,
          location_info: locationInfo,
          error_message: errorMessage,
          performed_by: performedBy,
          tenant_id: tenantId,
          ip_address: null, // Set to null for React Native compatibility
          user_agent: this.getUserAgent(),
          session_id: this.generateSessionId(),
        });

      if (error) {
        console.error('Failed to log recognition event:', error);
      }
    } catch (error) {
      console.error('Error logging recognition event:', error);
    }
  }

  /**
   * Utility functions
   */

  validateImage(imageFile) {
    if (!imageFile) {
      throw new Error('Image file is required');
    }

    if (!CONFIG.SUPPORTED_FORMATS.includes(imageFile.type)) {
      throw new Error(`Unsupported image format. Supported: ${CONFIG.SUPPORTED_FORMATS.join(', ')}`);
    }

    if (imageFile.size > CONFIG.MAX_IMAGE_SIZE) {
      throw new Error(`Image size too large. Maximum: ${CONFIG.MAX_IMAGE_SIZE / (1024 * 1024)}MB`);
    }
  }

  async preprocessImage(imageFile) {
    try {
      // In React Native, we'll return the original file for now
      // In a real implementation, you would use react-native-image-resizer
      // or similar library to resize the image
      console.log('Preprocessing image for React Native...');
      
      // For development purposes, return a mock processed image
      // In production, implement proper image resizing using RN libraries
      return imageFile;
    } catch (error) {
      console.error('Image preprocessing failed:', error);
      throw error;
    }
  }

  async createImageElement(imageFile) {
    try {
      // In React Native, we would use react-native-fast-image or similar
      // For now, return a mock image element
      console.log('Creating image element for React Native...');
      
      // Return imageFile for React Native compatibility
      return imageFile;
    } catch (error) {
      console.error('Failed to create image element:', error);
      throw error;
    }
  }

  async uploadImageToStorage(imageFile, purpose, tenantId) {
    try {
      const bucket = purpose === 'enrollment' ? CONFIG.FACE_TEMPLATES_BUCKET : CONFIG.FACE_EVENTS_BUCKET;

      // Ensure user is authenticated and get tenant_id from JWT for folder scoping
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.error('❌ Authentication check failed:', authError);
        throw new Error('Authentication required: Please ensure you are logged in before uploading.');
      }

      const jwtTenantId =
        (user.user_metadata && user.user_metadata.tenant_id) ||
        (user.app_metadata && user.app_metadata.tenant_id) ||
        user.tenant_id ||
        null;

      const folderTenantId = jwtTenantId || tenantId || user.id;
      if (tenantId && jwtTenantId && tenantId !== jwtTenantId) {
        console.warn('⚠️ Tenant mismatch between parameter and JWT:', { tenantIdParam: tenantId, jwtTenantId });
      }
      if (!jwtTenantId && !tenantId) {
        console.warn('⚠️ No tenant_id found in JWT or params; falling back to user.id for folder scoping:', user.id);
      }

      const fileName = `${folderTenantId}/${purpose}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;

      console.log(`📤 Uploading image to ${bucket}/${fileName}`);
      console.log('📤 Image file info:', {
        uri: imageFile.uri,
        type: imageFile.type,
        size: imageFile.size,
        platform: Platform.OS,
        tenantIdParam: tenantId,
        jwtTenantId: jwtTenantId
      });
      
      // Development mode: Skip actual upload and return mock URL for testing
      if (__DEV__ && process.env.REACT_APP_FACE_STUB_MODE_FOR_TESTING === 'true') {
        console.log('🎨 Development mode: Skipping actual upload, using mock URL');
        const mockUrl = `https://mock-storage.local/${fileName}`;
        return mockUrl;
      }

      // Handle React Native file upload to Supabase storage
      let uploadData;
      let contentType = imageFile.type || 'image/jpeg';
      
      if (Platform.OS === 'web') {
        // Web environment - use File object directly
        uploadData = imageFile;
      } else {
        // React Native environment - use Expo FileSystem v54 File API
        console.log('📤 Using Expo FileSystem v54 File API to read file:', imageFile.uri);
        console.log('📤 File details:', {
          uri: imageFile.uri,
          type: contentType,
          size: imageFile.size
        });
        
        try {
          const fileObj = new File(imageFile.uri);
          if (!fileObj.exists) {
            throw new Error(`File not found at URI: ${imageFile.uri}`);
          }
          const base64Data = await fileObj.base64();
          if (!base64Data || typeof base64Data !== 'string') {
            throw new Error('Invalid base64 data from File.base64()');
          }
          // Convert base64 to binary data for upload
          const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          uploadData = bytes;
          console.log('📤 Successfully converted file to binary data, size:', bytes.length);
        } catch (fileSystemError) {
          console.error('❌ FileSystem read failed:', fileSystemError);
          throw new Error(`Failed to read image file: ${fileSystemError.message}`);
        }
      }

      console.log('📤 Attempting upload to Supabase storage...');
      
      // Authentication already verified above
      console.log('✅ User authenticated and tenant resolved');
      
      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileName, uploadData, {
          cacheControl: '3600',
          upsert: false,
          contentType: contentType
        });

      if (error) {
        console.error('❌ Supabase storage upload error:', error);
        console.error('❌ Error details:', {
          message: error.message,
          statusCode: error.statusCode,
          error: error.error
        });
        
        // Provide more specific error messages
        if ((error.statusCode && String(error.statusCode) === '403') || error.message.includes('row-level security')) {
          throw new Error('Upload failed: Permission denied by RLS (403). Ensure bucket policies exist and tenant_id in JWT matches the first folder.');
        } else if (error.message.includes('not allowed')) {
          throw new Error('Upload failed: Permission denied. Check storage bucket policies.');
        } else if (error.message.includes('Bucket not found')) {
          throw new Error('Upload failed: Storage bucket not found. Contact administrator.');
        } else {
          throw new Error(`Storage upload failed: ${error.message}`);
        }
      }

      console.log(`✅ Successfully uploaded to storage:`, data.path);

      // Get the public URL (even though bucket is private, we need the path for internal reference)
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      // For private buckets, we'll store the path and use signed URLs when needed
      const storagePath = data.path;
      console.log(`📁 File stored at: ${storagePath}`);
      
      return publicUrl; // This will be used for internal reference
    } catch (error) {
      console.error('❌ Image upload failed:', error);
      
      // Log additional debug information
      if (imageFile) {
        console.error('❌ Failed image file details:', {
          uri: imageFile.uri,
          type: imageFile.type,
          size: imageFile.size
        });
      }
      
      throw new Error(`Image upload failed: ${error.message}`);
    }
  }

  encryptFaceData(data) {
    try {
      // Ensure data is properly formatted before encoding
      if (data === null || data === undefined) {
        return JSON.stringify([]);
      }
      
      // Convert to array if it's not already
      const arrayData = Array.isArray(data) ? data : [data];
      
      // Simple JSON string encoding for React Native development
      // In production, use proper encryption like react-native-crypto-js or similar
      return JSON.stringify(arrayData);
    } catch (error) {
      console.error('Face data encoding failed:', error);
      // Return empty array as fallback for face encodings
      return '[]';
    }
  }

  decryptFaceData(encryptedData) {
    try {
      // Handle null, undefined, or empty string
      if (!encryptedData || encryptedData.trim() === '') {
        console.warn('Empty or null encrypted data, returning empty array');
        return [];
      }
      
      let dataToProcess = encryptedData.trim();
      
      // Check if data is hex-encoded (contains \x sequences)
      if (dataToProcess.includes('\\x')) {
        try {
          console.log('🔍 Detected hex-encoded data, converting to string...');
          console.log('Original data length:', dataToProcess.length);
          
          // First pass: Convert \\x sequences to characters
          let firstPass = dataToProcess.replace(/\\x([0-9a-fA-F]{2})/g, (match, hex) => {
            const charCode = parseInt(hex, 16);
            return String.fromCharCode(charCode);
          });
          
          console.log('✅ First hex decode pass completed');
          console.log('After first pass length:', firstPass.length);
          
          // Check if we now have a hex-encoded string (double encoding)
          const hexPattern = /^[0-9a-fA-F,\[\]\-\.]+$/;
          const cleanedForTest = firstPass.replace(/[\s\[\],\-\.]/g, '');
          console.log('🔎 Testing for double encoding...');
          console.log('🔎 Cleaned string for pattern test:', cleanedForTest.substring(0, 50));
          console.log('🔎 Pattern test result:', hexPattern.test(cleanedForTest));
          
          if (hexPattern.test(cleanedForTest)) {
            console.log('🔄 Detected double hex encoding, performing second decode...');
            
            // Second pass: decode hex pairs to characters for the JSON content
            let secondPass = '[';
            let i = 1; // Skip the opening bracket from firstPass
            
            while (i < firstPass.length - 1) { // Process until closing bracket
              const char = firstPass[i];
              if (char === ']') {
                secondPass += ']';
                break;
              } else if (char === ',' || char === '-' || char === '.') {
                secondPass += char;
                i++;
              } else {
                // Try to read hex pairs and convert to characters
                let hexPair = '';
                while (i < firstPass.length && /[0-9a-fA-F]/.test(firstPass[i])) {
                  hexPair += firstPass[i];
                  i++;
                  if (hexPair.length === 2) {
                    try {
                      const decoded = String.fromCharCode(parseInt(hexPair, 16));
                      secondPass += decoded;
                      hexPair = '';
                    } catch (e) {
                      // If conversion fails, keep the original hex
                      secondPass += hexPair;
                      hexPair = '';
                    }
                  }
                }
                if (hexPair.length > 0) {
                  secondPass += hexPair; // Add remaining hex chars
                }
              }
            }
            
            console.log('✅ Second hex decode pass completed');
            console.log('After second pass length:', secondPass.length);
            dataToProcess = secondPass;
          } else {
            // Single encoding, use first pass result
            console.log('🎯 Single encoding detected, using first pass result');
            dataToProcess = firstPass;
          }
          
        } catch (hexError) {
          console.error('❌ Hex decoding failed:', hexError);
          console.error('Error details:', hexError.message);
          // Continue with original data
        }
      }
      
      // Clean up the data - remove any extra characters that might cause issues
      const cleanData = dataToProcess.trim();
      
      console.log('📦 Final data before JSON parse:');
      console.log('📦 Length:', cleanData.length);
      console.log('📦 First 100 chars:', cleanData.substring(0, 100));
      console.log('📦 Last 10 chars:', cleanData.substring(cleanData.length - 10));
      
      // Try to parse as JSON
      const parsed = JSON.parse(cleanData);
      
      // Ensure result is an array
      return Array.isArray(parsed) ? parsed : [parsed];
      
    } catch (error) {
      console.error('Face data decoding failed:', error);
      console.error('Problematic data length:', encryptedData?.length);
      console.error('Problematic data preview:', encryptedData?.substring(0, 200) + '...');
      
      // Try to handle common malformed JSON cases
      if (typeof encryptedData === 'string') {
        // If it looks like it might be an array but malformed, try to fix it
        if (encryptedData.startsWith('[') || encryptedData.startsWith('{') || 
            encryptedData.includes('\\x5b') || encryptedData.includes('\\x7b') || encryptedData.includes('\\x')) {
          try {
            // Try complete hex decoding first
            let cleaned = encryptedData;
            
            // If contains hex sequences, use the same double decoding logic
            if (cleaned.includes('\\x')) {
              console.log('🔄 Fallback hex decoding...');
              
              // First pass
              let firstPass = cleaned.replace(/\\x([0-9a-fA-F]{2})/g, (match, hex) => {
                return String.fromCharCode(parseInt(hex, 16));
              });
              
              // Check for double encoding
              const hexPattern = /^[0-9a-fA-F,\[\]\-\.]+$/;
              if (hexPattern.test(firstPass.replace(/[\s\[\],\-\.]/g, ''))) {
                console.log('🔄 Fallback double decoding...');
                let secondPass = '[';
                let i = 1;
                
                while (i < firstPass.length - 1) {
                  const char = firstPass[i];
                  if (char === ']') {
                    secondPass += ']';
                    break;
                  } else if (char === ',' || char === '-' || char === '.') {
                    secondPass += char;
                    i++;
                  } else {
                    let hexPair = '';
                    while (i < firstPass.length && /[0-9a-fA-F]/.test(firstPass[i])) {
                      hexPair += firstPass[i];
                      i++;
                      if (hexPair.length === 2) {
                        try {
                          secondPass += String.fromCharCode(parseInt(hexPair, 16));
                          hexPair = '';
                        } catch (e) {
                          secondPass += hexPair;
                          hexPair = '';
                        }
                      }
                    }
                    if (hexPair.length > 0) {
                      secondPass += hexPair;
                    }
                  }
                }
                cleaned = secondPass;
              } else {
                cleaned = firstPass;
              }
              
              console.log('🔄 Fallback hex decoded, first 100 chars:', cleaned.substring(0, 100));
            }
            
            // Additional cleanup
            cleaned = cleaned.replace(/[\r\n]/g, '').trim();
            
            return JSON.parse(cleaned);
          } catch (secondError) {
            console.error('Second parsing attempt failed:', secondError);
          }
        }
      }
      
      // Final fallback - return empty array
      console.warn('Using fallback empty array for face encoding');
      return [];
    }
  }

  generateStubEncoding() {
    // Generate a fake encoding for development/testing
    const encoding = [];
    for (let i = 0; i < 128; i++) {
      encoding.push(Math.random() * 2 - 1); // Random values between -1 and 1
    }
    return encoding;
  }

  async getClientIP() {
    try {
      // In React Native, IP address detection is complex and requires network calls
      // For development, return null to avoid database type errors
      return null;
    } catch {
      return null;
    }
  }

  generateSessionId() {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  getUserAgent() {
    // React Native compatible user agent
    if (Platform.OS === 'ios') {
      return 'ReactNative/iOS';
    } else if (Platform.OS === 'android') {
      return 'ReactNative/Android';
    } else if (Platform.OS === 'web') {
      return typeof navigator !== 'undefined' ? navigator.userAgent : 'ReactNative/Web';
    }
    return 'ReactNative/Unknown';
  }

  /**
   * Get recognition statistics
   */
  async getRecognitionStats(tenantId, days = 30) {
    const { data, error } = await supabase
      .from('facial_recognition_stats')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      console.error('Failed to fetch recognition stats:', error);
      return null;
    }

    return data;
  }

  /**
   * Provider/config diagnostics and helpers
   */
  isAzureUnsupportedFeature(error) {
    const msg = (error && error.message) ? String(error.message) : '';
    return msg.includes('UnsupportedFeature') || msg.includes('Please apply for access') || msg.includes('aka.ms/facerecognition') || msg.includes('403');
  }

  async getProviderOverride() {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(PROVIDER_OVERRIDE_KEY);
      }
      return await AsyncStorage.getItem(PROVIDER_OVERRIDE_KEY);
    } catch {
      return null;
    }
  }

  async setProviderOverride(providerName) {
    try {
      if (!providerName) return;
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(PROVIDER_OVERRIDE_KEY, providerName);
      } else {
        await AsyncStorage.setItem(PROVIDER_OVERRIDE_KEY, providerName);
      }
      // Force re-init on next call
      this.isInitialized = false;
      console.log(`[FaceRecognition] Provider override set to: ${providerName}`);
    } catch (e) {
      console.warn('Failed to set provider override:', e?.message);
    }
  }

  async clearProviderOverride() {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(PROVIDER_OVERRIDE_KEY);
      } else {
        await AsyncStorage.removeItem(PROVIDER_OVERRIDE_KEY);
      }
      this.isInitialized = false;
      console.log('[FaceRecognition] Provider override cleared');
    } catch (e) {
      console.warn('Failed to clear provider override:', e?.message);
    }
  }

  async getConfigStatus(tenantId = null) {
    const providerRequested = CONFIG.PROVIDER || 'offline';
    const override = await this.getProviderOverride();
    const providerResolved = override || providerRequested;

    // Resolve azure from multiple sources
    let endpoint = AZURE.ENDPOINT;
    let key = AZURE.KEY;
    const extra = Constants?.expoConfig?.extra || {};
    endpoint = endpoint || extra.azureFaceEndpoint || extra.EXPO_PUBLIC_AZURE_FACE_ENDPOINT || extra.REACT_APP_AZURE_FACE_ENDPOINT || null;
    key = key || extra.azureFaceKey || extra.EXPO_PUBLIC_AZURE_FACE_KEY || extra.REACT_APP_AZURE_FACE_KEY || null;
    try {
      const storedEndpoint = await AsyncStorage.getItem('azure_face_endpoint');
      const storedKey = await AsyncStorage.getItem('azure_face_key');
      endpoint = endpoint || storedEndpoint;
      key = key || storedKey;
    } catch {}

    const azureConfigured = !!(endpoint && key);
    let endpointHost = null;
    try {
      if (endpoint) endpointHost = new URL(endpoint).host;
    } catch {}
    return {
      providerRequested,
      providerOverride: override || null,
      providerResolved,
      azure: {
        configured: azureConfigured,
        endpointHost,
      }
    };
  }

  async ensureAzurePersonGroup(tenantId) {
    if (!tenantId) throw new Error('tenantId required');
    if (!this.azureCfg) {
      const cfg = await this.resolveAzureConfig();
      if (!cfg || !cfg.ENDPOINT || !cfg.KEY) throw new Error('Azure Face API not configured');
      this.azureCfg = cfg;
    }
    const groupId = await this.ensurePersonGroupInternal(tenantId);
    return { success: true, groupId };
  }

  // ===== Runtime config setters/getters for Azure (dev/admin use) =====
  async setAzureRuntimeConfig({ endpoint, key }) {
    if (!endpoint || !key) throw new Error('Endpoint and key are required');
    await AsyncStorage.setItem('azure_face_endpoint', endpoint.replace(/\/$/, ''));
    await AsyncStorage.setItem('azure_face_key', key);
    this.azureCfg = null; // force re-resolve
    await this.setProviderOverride('azure');
    await this.initialize();
    return { success: true };
  }

  async getAzureRuntimeConfig() {
    const endpoint = await AsyncStorage.getItem('azure_face_endpoint');
    const key = await AsyncStorage.getItem('azure_face_key');
    return {
      endpoint,
      keyPresent: !!key,
    };
  }

  /**
   * Delete face template
   */
  async deleteFaceTemplate(templateId, tenantId) {
    const { error } = await supabase
      .from('facial_templates')
      .update({ is_active: false })
      .eq('id', templateId)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(`Failed to delete face template: ${error.message}`);
    }

    return { success: true };
  }

  /**
   * Mark attendance using facial recognition
   */
  async markAttendanceWithFaceRecognition({
    recognitionResult,
    date,
    status = 'Present',
    markedBy,
    tenantId,
    classId = null, // For students
    backupVerification = null,
    verificationNotes = null
  }) {
    if (!recognitionResult.success || !recognitionResult.matched) {
      throw new Error('Facial recognition must be successful to mark attendance');
    }

    const attendanceData = {
      date,
      status,
      verification_method: 'facial_recognition',
      recognition_event_id: recognitionResult.eventId,
      recognition_confidence: recognitionResult.confidence,
      recognition_duration_ms: recognitionResult.recognitionDuration,
      backup_verification: backupVerification,
      verification_notes: verificationNotes,
      marked_by: markedBy,
      tenant_id: tenantId,
    };

    let result;
    if (recognitionResult.person.type === 'student') {
      attendanceData.student_id = recognitionResult.person.id;
      attendanceData.class_id = classId;

      const { data, error } = await supabase
        .from('student_attendance')
        .insert(attendanceData)
        .select()
        .single();

      if (error) throw error;
      result = data;

    } else if (recognitionResult.person.type === 'teacher') {
      attendanceData.teacher_id = recognitionResult.person.id;

      const { data, error } = await supabase
        .from('teacher_attendance')
        .insert(attendanceData)
        .select()
        .single();

      if (error) throw error;
      result = data;

    } else {
      throw new Error(`Invalid person type: ${recognitionResult.person.type}`);
    }

    return {
      success: true,
      attendance: result,
      recognitionConfidence: recognitionResult.confidence,
    };
  }
  // ===== Azure dynamic config helpers =====
  async resolveAzureConfig() {
    try {
      // 1) Environment variables (compile-time)
      let endpoint = process.env.EXPO_PUBLIC_AZURE_FACE_ENDPOINT || process.env.REACT_APP_AZURE_FACE_ENDPOINT || null;
      let key = process.env.EXPO_PUBLIC_AZURE_FACE_KEY || process.env.REACT_APP_AZURE_FACE_KEY || null;

      // 2) Expo extra (app.json -> expo.extra)
      const extra = Constants?.expoConfig?.extra || {};
      endpoint = endpoint || extra.azureFaceEndpoint || extra.EXPO_PUBLIC_AZURE_FACE_ENDPOINT || extra.REACT_APP_AZURE_FACE_ENDPOINT || null;
      key = key || extra.azureFaceKey || extra.EXPO_PUBLIC_AZURE_FACE_KEY || extra.REACT_APP_AZURE_FACE_KEY || null;

      // 3) AsyncStorage overrides (dev/admin set at runtime)
      const storedEndpoint = await AsyncStorage.getItem('azure_face_endpoint');
      const storedKey = await AsyncStorage.getItem('azure_face_key');
      endpoint = endpoint || storedEndpoint;
      key = key || storedKey;

      if (!endpoint || !key) {
        return null;
      }

      return {
        ENDPOINT: endpoint.replace(/\/$/, ''),
        KEY: key,
        IDENTIFY_CONFIDENCE: AZURE.IDENTIFY_CONFIDENCE,
      };
    } catch (e) {
      console.warn('Failed to resolve Azure config:', e?.message);
      return null;
    }
  }

  azureHeadersJson() {
    if (!this.azureCfg?.KEY) throw new Error('Azure key missing');
    return {
      'Ocp-Apim-Subscription-Key': this.azureCfg.KEY,
      'Content-Type': 'application/json',
    };
  }

  async azureFetchJson(path, body) {
    if (!this.azureCfg?.ENDPOINT) throw new Error('Azure endpoint missing');
    const res = await fetch(`${this.azureCfg.ENDPOINT}${path}`, {
      method: 'POST',
      headers: this.azureHeadersJson(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Azure error ${res.status}: ${txt}`);
    }
    return res.json();
  }

  async listPersonsInternal(groupId) {
    if (!this.azureCfg?.ENDPOINT) throw new Error('Azure endpoint missing');
    const res = await fetch(`${this.azureCfg.ENDPOINT}/face/v1.0/persongroups/${groupId}/persons`, {
      method: 'GET',
      headers: { 'Ocp-Apim-Subscription-Key': this.azureCfg.KEY },
    });
    if (!res.ok) return [];
    return res.json();
  }

  async ensurePersonGroupInternal(tenantId) {
    const groupId = sanitizePersonGroupId(tenantId);
    try {
      await fetch(`${this.azureCfg.ENDPOINT}/face/v1.0/persongroups/${groupId}`, {
        method: 'PUT',
        headers: this.azureHeadersJson(),
        body: JSON.stringify({ name: groupId })
      });
    } catch (e) {
      // ignore create errors if already exists
    }
    return groupId;
  }

  async ensurePersonInternal(groupId, personId, displayName) {
    const persons = await this.listPersonsInternal(groupId);
    const existing = (persons || []).find(p => p.userData === String(personId));
    if (existing) return existing.personId;
    const created = await this.azureFetchJson(`/face/v1.0/persongroups/${groupId}/persons`, {
      name: displayName || `person_${personId}`,
      userData: String(personId),
    });
    return created.personId;
  }

  async trainPersonGroupInternal(groupId) {
    await fetch(`${this.azureCfg.ENDPOINT}/face/v1.0/persongroups/${groupId}/train`, {
      method: 'POST',
      headers: { 'Ocp-Apim-Subscription-Key': this.azureCfg.KEY },
    });
  }
}

// Export singleton instance
export default new FaceRecognitionService();
