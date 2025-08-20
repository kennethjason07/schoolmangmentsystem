import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, Modal, Pressable, Linking, Platform, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../utils/AuthContext';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';
import Header from '../../components/Header';
import ImageViewerModal from '../../components/ImageViewerModal';
import { 
  uploadAssignmentFile, 
  formatFileSize as formatAssignmentFileSize, 
  getAssignmentFileIcon,
  isSupportedFileType 
} from '../../utils/assignmentFileUpload';

const statusColors = {
  not_submitted: '#F44336',
  submitted: '#FF9800',
  graded: '#4CAF50',
};

const statusLabels = {
  not_submitted: 'Not Submitted',
  submitted: 'Submitted',
  graded: 'Graded',
};

const formatFileSize = (bytes) => {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
const getFileIcon = (fileType) => {
  if (fileType?.includes('pdf')) return 'document-text';
  if (fileType?.includes('image')) return 'image';
  if (fileType?.includes('word')) return 'document';
  return 'document-outline';
};

// Helper function to get proper URL from bucket storage
const getFileUrlFromBucket = (filePathOrUrl, fileName, bucketName = 'homework-files') => {
  try {
    if (!filePathOrUrl) {
      console.log('⚠️ No file path or URL provided for:', fileName);
      return null;
    }

    // If it's already a full URL (from teacher uploads), return it directly
    if (filePathOrUrl.startsWith('http://') || filePathOrUrl.startsWith('https://')) {
      console.log('✅ File already has full URL:', filePathOrUrl);
      return filePathOrUrl;
    }

    // If it's a Supabase storage path that starts with bucket name, extract the actual path
    let actualPath = filePathOrUrl;
    if (filePathOrUrl.startsWith(`${bucketName}/`)) {
      actualPath = filePathOrUrl.substring(`${bucketName}/`.length);
      console.log('🔧 Extracted path from bucket prefix:', actualPath);
    }

    // Generate public URL from storage bucket
    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(actualPath);
    
    if (publicUrl) {
      console.log('✅ Generated public URL for', fileName, ':', publicUrl);
      return publicUrl;
    } else {
      console.log('❌ Failed to generate public URL for:', fileName);
      return null;
    }
  } catch (error) {
    console.error('❌ Error generating URL for', fileName, ':', error);
    return null;
  }
};

const ViewAssignments = () => {
  const { user, loading: authLoading } = useAuth(); // Destructure loading state
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  // Image viewer modal state
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState('');
  const [selectedImageName, setSelectedImageName] = useState('');

  useEffect(() => {
    if (authLoading) {
      return; // Wait for auth to finish loading
    }
    if (user) {
      fetchAssignments();
    }

    // Real-time subscriptions for both assignments and homeworks
    const assignmentsSub = supabase
      .channel('student-assignments')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.ASSIGNMENTS }, fetchAssignments)
      .subscribe();

    const homeworksSub = supabase
      .channel('student-homeworks')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.HOMEWORKS }, fetchAssignments)
      .subscribe();

    return () => {
      assignmentsSub.unsubscribe();
      homeworksSub.unsubscribe();
    };
  }, [authLoading, user]); // Re-run when authLoading or user changes

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('=== FETCHING ASSIGNMENTS ===');
      console.log('User ID:', user.id);

      // Get student data using the helper function
      const { data: studentUserData, error: studentError } = await dbHelpers.getStudentByUserId(user.id);
      if (studentError || !studentUserData) {
        throw new Error('Student data not found');
      }

      // Get student details from the linked student
      const student = studentUserData.students;
      if (!student) {
        throw new Error('Student profile not found');
      }

      console.log('Student data:', { id: student.id, class_id: student.class_id });

      let allAssignments = [];

      // Get assignments from assignments table
      try {
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from(TABLES.ASSIGNMENTS)
          .select(`
            *,
            subjects(name),
            teachers(name)
          `)
          .eq('class_id', student.class_id)
          .order('due_date', { ascending: true });

        console.log('Assignments query result:', { assignmentsData, assignmentsError });

        if (assignmentsError) {
          if (assignmentsError.code === '42P01') {
            console.log('Assignments table does not exist');
          } else {
            console.error('Assignments error:', assignmentsError);
          }
        } else if (assignmentsData) {
          const processedAssignments = assignmentsData.map(assignment => ({
            id: assignment.id,
            type: 'assignment',
            subject: assignment.subjects?.name || 'Unknown Subject',
            title: assignment.title,
            description: assignment.description,
            instructions: assignment.description, // Use description as instructions
            dueDate: assignment.due_date,
            assignedDate: assignment.assigned_date,
            academicYear: assignment.academic_year,
            assignedBy: assignment.teachers?.name || 'Teacher',
            files: assignment.file_url ? [{
              id: assignment.id,
              name: 'Assignment File',
              url: getFileUrlFromBucket(assignment.file_url, 'Assignment File'),
              type: 'assignment_file'
            }].filter(file => file.url) : [],
            status: 'not_submitted', // Default status
            submissionId: null,
            uploadedFiles: [],
            grade: null,
            feedback: null,
          }));
          allAssignments = [...allAssignments, ...processedAssignments];
        }
      } catch (err) {
        console.error('Error fetching assignments:', err);
      }

      // Get homeworks from homeworks table
      try {
        const { data: homeworksData, error: homeworksError } = await supabase
          .from(TABLES.HOMEWORKS)
          .select(`
            *,
            subjects(name),
            teachers(name)
          `)
          .or(`class_id.eq.${student.class_id},assigned_students.cs.{${student.id}}`)
          .order('due_date', { ascending: true });

        console.log('Homeworks query result:', { homeworksData, homeworksError });

        if (homeworksError) {
          if (homeworksError.code === '42P01') {
            console.log('Homeworks table does not exist');
          } else {
            console.error('Homeworks error:', homeworksError);
          }
        } else if (homeworksData) {
          console.log('📚 Processing homeworks data:', homeworksData.length, 'homeworks found');
          
          const processedHomeworks = homeworksData.map((homework, homeworkIndex) => {
            console.log(`📝 Processing homework ${homeworkIndex + 1}:`, {
              id: homework.id,
              title: homework.title,
              files: homework.files
            });
            
            let processedFiles = [];
            if (homework.files && Array.isArray(homework.files)) {
              console.log(`📁 Found ${homework.files.length} files for homework "${homework.title}"`);
              
              processedFiles = homework.files
                .map((file, index) => {
                  console.log(`📄 Processing file ${index + 1}:`, {
                    original_file: file,
                    file_name: file.file_name,
                    file_url: file.file_url,
                    name: file.name,
                    url: file.url
                  });
                  
                  const fileName = file.file_name || file.name || `File ${index + 1}`;
                  const fileUrl = file.file_url || file.url;
                  const processedUrl = getFileUrlFromBucket(fileUrl, fileName);
                  
                  console.log(`🔗 File URL processing result:`, {
                    fileName,
                    originalUrl: fileUrl,
                    processedUrl
                  });
                  
                  return {
                    id: `${homework.id}-${index}`,
                    name: fileName,
                    url: processedUrl,
                    type: 'homework_file'
                  };
                })
                .filter(file => {
                  const hasUrl = !!file.url;
                  if (!hasUrl) {
                    console.log(`⚠️ Filtering out file "${file.name}" - no valid URL`);
                  }
                  return hasUrl;
                });
            } else {
              console.log(`📁 No files found for homework "${homework.title}"`);
            }
            
            console.log(`✅ Final processed files for "${homework.title}":`, processedFiles.length, 'files');
            
            return {
              id: homework.id,
              type: 'homework',
              subject: homework.subjects?.name || 'Unknown Subject',
              title: homework.title,
              description: homework.description,
              instructions: homework.instructions,
              dueDate: homework.due_date,
              assignedDate: homework.created_at?.split('T')[0],
              academicYear: new Date().getFullYear().toString(), // Default to current year
              assignedBy: homework.teachers?.name || 'Teacher',
              files: processedFiles,
              status: 'not_submitted', // Default status
              submissionId: null,
              uploadedFiles: [],
              grade: null,
              feedback: null,
            };
          });
          allAssignments = [...allAssignments, ...processedHomeworks];
        }
      } catch (err) {
        console.error('Error fetching homeworks:', err);
      }

      // Get existing submissions for this student
      try {
        const { data: submissionsData, error: submissionsError } = await supabase
          .from('assignment_submissions')
          .select('*')
          .eq('student_id', student.id);

        console.log('Submissions query result:', { submissionsData, submissionsError });

        if (submissionsError && submissionsError.code !== '42P01') {
          console.error('Submissions error:', submissionsError);
        } else if (submissionsData) {
          // Update assignments with submission status
          allAssignments = allAssignments.map(assignment => {
            const submission = submissionsData.find(s =>
              s.assignment_id === assignment.id && s.assignment_type === assignment.type
            );

            if (submission) {
              return {
                ...assignment,
                status: submission.grade ? 'graded' : 'submitted',
                submissionId: submission.id,
                uploadedFiles: submission.submitted_files || [],
                grade: submission.grade,
                feedback: submission.feedback,
                submittedAt: submission.submitted_at
              };
            }
            return assignment;
          });
        }
      } catch (err) {
        console.log('Error fetching submissions (table may not exist):', err);
      }

      // Sort all assignments by due date
      allAssignments.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
      });

      // Log if no assignments found
      if (allAssignments.length === 0) {
        console.log('No assignments found in database');
      }

      console.log('Final assignments list with submissions:', allAssignments.length);
      setAssignments(allAssignments);

    } catch (err) {
      console.error('Assignments fetch error:', err);
      setError(err.message);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  // Group assignments by subject
  const groupBySubject = (assignments) => {
    const groups = {};
    assignments.forEach(a => {
      if (!groups[a.subject]) groups[a.subject] = [];
      groups[a.subject].push(a);
    });
    return Object.entries(groups);
  };
  const grouped = groupBySubject(assignments);

  // When opening modal, set uploadedFiles to submission's files if any
  const openAssignmentModal = (assignment) => {
    setSelectedAssignment(assignment);
    setUploadedFiles(assignment.uploadedFiles || []);
    setIsEditing(assignment.status === 'not_submitted');
  };

  // Handler to mark as submitted
  const handleMarkAsSubmitted = async () => {
    if (!selectedAssignment) return;
    try {
      setLoading(true);

      console.log('=== SUBMITTING ASSIGNMENT ===');
      console.log('Assignment ID:', selectedAssignment.id);
      console.log('Assignment Type:', selectedAssignment.type);
      console.log('Files to submit:', uploadedFiles.length);

      // Get student data
      const { data: studentUserData, error: studentError } = await dbHelpers.getStudentByUserId(user.id);
      if (studentError || !studentUserData) {
        throw new Error('Student data not found');
      }

      const student = studentUserData.students;
      if (!student) {
        throw new Error('Student profile not found');
      }

      // Create submission record in a submissions table (we'll create this)
      const submissionData = {
        assignment_id: selectedAssignment.id,
        assignment_type: selectedAssignment.type, // 'assignment' or 'homework'
        student_id: student.id,
        submitted_files: uploadedFiles.map(file => ({
          name: file.name,
          size: file.size,
          type: file.type,
          file_url: file.file_url || null, // Cloud URL if uploaded
          file_path: file.file_path || null, // Cloud path if uploaded
          uploadTime: file.uploadTime,
          status: file.status, // 'uploaded' or 'local'
          // Keep local URI as fallback
          localUri: file.uri
        })),
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        academic_year: selectedAssignment.academicYear || new Date().getFullYear().toString()
      };

      console.log('Submission data:', submissionData);

      // Try to create submission record
      try {
        const { data: submissionResult, error: submissionError } = await supabase
          .from('assignment_submissions')
          .insert(submissionData)
          .select()
          .single();

        if (submissionError) {
          console.error('Submission error:', submissionError);
          // If table doesn't exist, provide better error message
          if (submissionError.code === '42P01') {
            throw new Error('Submissions table not found. Please contact administrator to set up the database properly.');
          } else {
            throw submissionError;
          }
        } else {
          console.log('Submission created successfully:', submissionResult);
        }
      } catch (err) {
        console.log('Submission table error, continuing with local tracking:', err);
      }

      // Update local state to reflect submission
      setAssignments(prev => prev.map(assignment =>
        assignment.id === selectedAssignment.id
          ? {
              ...assignment,
              status: 'submitted',
              uploadedFiles: uploadedFiles,
              submissionId: 'local-' + Date.now()
            }
          : assignment
      ));

      // Show success message
      Alert.alert('Success', 'Assignment submitted successfully!');

      setSelectedAssignment(null);
      setUploadedFiles([]);
      setIsEditing(false);

    } catch (err) {
      console.error('Submit assignment error:', err);
      Alert.alert('Error', 'Failed to submit assignment: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handler to enable editing (re-upload)
  const handleEditFiles = () => {
    setIsEditing(true);
  };

  // File upload (documents) with Supabase storage integration
  const handleFileUpload = async () => {
    try {
      console.log('=== FILE UPLOAD STARTED ===');
      setUploading(true);

      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        console.log('Selected file:', { name: file.name, size: file.size, type: file.mimeType });

        // Check if file type is supported
        if (!isSupportedFileType(file.mimeType)) {
          Alert.alert(
            'Unsupported File Type', 
            `File type "${file.mimeType}" is not supported. Please select a different file.`
          );
          return;
        }

        // Get student data for upload
        const { data: studentUserData, error: studentError } = await dbHelpers.getStudentByUserId(user.id);
        if (studentError || !studentUserData) {
          throw new Error('Student data not found');
        }

        const student = studentUserData.students;
        if (!student) {
          throw new Error('Student profile not found');
        }

        // Upload file to Supabase Storage
        console.log('🔄 Uploading file to Supabase Storage...');
        const uploadResult = await uploadAssignmentFile(
          file, 
          student.id, 
          selectedAssignment.id, 
          selectedAssignment.type
        );

        if (uploadResult.success) {
          // File uploaded successfully to cloud storage
          const newFile = {
            id: Date.now().toString(),
            name: file.name,
            size: file.size || 0,
            type: file.mimeType || 'application/octet-stream',
            uri: file.uri, // Keep local URI as backup
            file_url: uploadResult.publicUrl, // Cloud URL
            file_path: uploadResult.filePath, // Cloud path
            uploadTime: new Date().toISOString(),
            status: 'uploaded', // Successfully uploaded to cloud
          };

          setUploadedFiles(prev => [...prev, newFile]);
          Alert.alert('Success', `File "${file.name}" uploaded to cloud storage successfully!`);
          console.log('✅ File uploaded to cloud and added to list:', newFile);
        } else {
          // Upload failed, store locally as fallback
          console.log('❌ Cloud upload failed, storing locally:', uploadResult.error);
          
          const newFile = {
            id: Date.now().toString(),
            name: file.name,
            size: file.size || 0,
            type: file.mimeType || 'application/octet-stream',
            uri: file.uri,
            uploadTime: new Date().toISOString(),
            status: 'local', // Stored locally due to upload failure
            error: uploadResult.error
          };

          setUploadedFiles(prev => [...prev, newFile]);
          Alert.alert(
            'Upload Warning', 
            `File "${file.name}" selected but could not be uploaded to cloud storage. It will be stored locally.\n\nError: ${uploadResult.error}`
          );
          console.log('⚠️ File stored locally due to upload failure:', newFile);
        }
      }
    } catch (error) {
      console.error('File upload error:', error);
      Alert.alert('Error', 'Failed to select file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // Helper function for future Supabase Storage integration
  const uploadFileToSupabase = async (file) => {
    try {
      // This would be implemented when Supabase Storage is set up
      console.log('TODO: Upload file to Supabase Storage:', file.name);

      // Example implementation:
      // const fileExt = file.name.split('.').pop();
      // const fileName = `${Date.now()}.${fileExt}`;
      // const filePath = `assignments/${user.id}/${fileName}`;

      // const { data, error } = await supabase.storage
      //   .from('assignment-files')
      //   .upload(filePath, file);

      // if (error) throw error;

      // const { data: { publicUrl } } = supabase.storage
      //   .from('assignment-files')
      //   .getPublicUrl(filePath);

      // return { success: true, url: publicUrl };

      return { success: false, error: 'Storage not configured' };
    } catch (error) {
      console.error('Supabase upload error:', error);
      return { success: false, error: error.message };
    }
  };

  // Image upload
  const handleImageUpload = async () => {
    try {
      setUploading(true);
      
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Please grant permission to access your photo library.');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'Images',
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        allowsMultipleSelection: false,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const image = result.assets[0];
        
        // Create file object compatible with DocumentPicker format
        const file = {
          name: `image_${Date.now()}.jpg`,
          size: image.fileSize || 0,
          mimeType: 'image/jpeg',
          uri: image.uri,
        };

        console.log('Selected image:', { name: file.name, size: file.size, type: file.mimeType });

        // Get student data for upload
        const { data: studentUserData, error: studentError } = await dbHelpers.getStudentByUserId(user.id);
        if (studentError || !studentUserData) {
          throw new Error('Student data not found');
        }

        const student = studentUserData.students;
        if (!student) {
          throw new Error('Student profile not found');
        }

        // Upload image to Supabase Storage
        console.log('🔄 Uploading image to Supabase Storage...');
        const uploadResult = await uploadAssignmentFile(
          file, 
          student.id, 
          selectedAssignment.id, 
          selectedAssignment.type
        );

        if (uploadResult.success) {
          // Image uploaded successfully to cloud storage
          const newFile = {
            id: Date.now().toString(),
            name: file.name,
            size: file.size || 0,
            type: file.mimeType || 'image/jpeg',
            uri: image.uri, // Keep local URI as backup
            file_url: uploadResult.publicUrl, // Cloud URL
            file_path: uploadResult.filePath, // Cloud path
            uploadTime: new Date().toISOString(),
            status: 'uploaded', // Successfully uploaded to cloud
          };

          setUploadedFiles(prev => [...prev, newFile]);
          Alert.alert('Success', `Image "${file.name}" uploaded to cloud storage successfully!`);
          console.log('✅ Image uploaded to cloud and added to list:', newFile);
        } else {
          // Upload failed, store locally as fallback
          console.log('❌ Cloud image upload failed, storing locally:', uploadResult.error);
          
          const newFile = {
            id: Date.now().toString(),
            name: file.name,
            size: file.size || 0,
            type: file.mimeType || 'image/jpeg',
            uri: image.uri,
            uploadTime: new Date().toISOString(),
            status: 'local', // Stored locally due to upload failure
            error: uploadResult.error
          };

          setUploadedFiles(prev => [...prev, newFile]);
          Alert.alert(
            'Upload Warning', 
            `Image "${file.name}" selected but could not be uploaded to cloud storage. It will be stored locally.\n\nError: ${uploadResult.error}`
          );
          console.log('⚠️ Image stored locally due to upload failure:', newFile);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to upload image. Please try again.');
      console.error('Image upload error:', error);
    } finally {
      setUploading(false);
    }
  };

  // File removal
  const handleRemoveFile = (id) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== id));
  };

  // Get teacher files (resources)
  const getTeacherFiles = (assignment) => assignment.files || [];

  // Get feedback/grade
  const getFeedbackAndGrade = (assignment) => {
    if (assignment.status === 'graded') {
      return {
        grade: assignment.grade || 'A',
        feedback: assignment.feedback || 'Excellent work! Keep it up.',
      };
    }
    return null;
  };

  // Helper function to check if file is an image
  const isImageFile = (fileName, mimeType) => {
    if (mimeType && mimeType.startsWith('image/')) {
      return true;
    }
    
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
    const lowerFileName = fileName?.toLowerCase() || '';
    return imageExtensions.some(ext => lowerFileName.endsWith(ext));
  };

  // Handler for opening teacher files - use ImageViewerModal for images, Linking for others
  const handleTeacherFilePress = (file) => {
    const fileUrl = file.url || file.file_url;
    
    if (!fileUrl || typeof fileUrl !== 'string' || fileUrl.trim() === '') {
      Alert.alert(
        'File Not Available',
        `The file "${file.name}" is not available. The teacher may need to re-upload it.`
      );
      return;
    }

    // Check if it's an image
    if (isImageFile(file.name, file.type || file.mimeType)) {
      // Open in ImageViewerModal
      setSelectedImageUrl(fileUrl);
      setSelectedImageName(file.name);
      setImageViewerVisible(true);
    } else {
      // Open in external browser/app
      Linking.canOpenURL(fileUrl)
        .then((supported) => {
          if (supported) {
            Linking.openURL(fileUrl);
          } else {
            Alert.alert('Cannot Open File', `Unable to open "${file.name}". The file format may not be supported.`);
          }
        })
        .catch((error) => {
          console.error('Error opening teacher file:', error);
          Alert.alert('Error', `Failed to open "${file.name}": ${error.message}`);
        });
    }
  };

  // Handler for opening student uploaded files - use ImageViewerModal for images, Linking for others
  const handleStudentFilePress = (file) => {
    const fileUrl = file.file_url || file.url || file.uri;
    
    if (!fileUrl || typeof fileUrl !== 'string' || fileUrl.trim() === '') {
      Alert.alert(
        'File Not Available',
        `The file "${file.name}" is not available.`
      );
      return;
    }

    // Check if it's an image
    if (isImageFile(file.name, file.type || file.mimeType)) {
      // Open in ImageViewerModal
      setSelectedImageUrl(fileUrl);
      setSelectedImageName(file.name);
      setImageViewerVisible(true);
    } else {
      // For non-images, try to open in external browser/app
      Linking.canOpenURL(fileUrl)
        .then((supported) => {
          if (supported) {
            Linking.openURL(fileUrl);
          } else {
            Alert.alert('Cannot Open File', `Unable to open "${file.name}". The file format may not be supported.`);
          }
        })
        .catch((error) => {
          console.error('Error opening student file:', error);
          Alert.alert('Error', `Failed to open "${file.name}": ${error.message}`);
        });
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}> 
        <ActivityIndicator size="large" color="#1976d2" />
      </View>
    );
  }
  if (error) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}> 
        <Text style={{ color: '#d32f2f', fontSize: 16, marginBottom: 12, textAlign: 'center' }}>Error: {error}</Text>
        <TouchableOpacity onPress={fetchAssignments} style={{ backgroundColor: '#1976d2', padding: 12, borderRadius: 8 }}>
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Assignments" showBack={true} showProfile={true} />
      <ScrollView style={styles.scrollContainer}>
        {assignments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No assignments assigned</Text>
            <Text style={styles.emptySubtext}>
              Your teachers haven't assigned any homework or assignments yet.
            </Text>
          </View>
        ) : (
          grouped.map(([subject, assignments]) => (
            <View key={subject} style={styles.subjectGroup}>
              <Text style={styles.subjectTitle}>{subject}</Text>
              {assignments.map(assignment => (
                <TouchableOpacity key={assignment.id} style={styles.assignmentCard} activeOpacity={0.85} onPress={() => openAssignmentModal(assignment)}>
                  <View style={styles.assignmentHeader}>
                    <Text style={styles.assignmentTitle}>{assignment.title}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusColors[assignment.status] }]}>
                      <Text style={styles.statusText}>{statusLabels[assignment.status]}</Text>
                    </View>
                  </View>
                  <Text style={styles.dueDate}>Due: {assignment.dueDate}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}
      </ScrollView>
      {/* Assignment Details Modal */}
      <Modal
        visible={!!selectedAssignment}
        animationType="slide"
        transparent
        onRequestClose={() => { setSelectedAssignment(null); setUploadedFiles([]); setIsEditing(false); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedAssignment && (
              <>
                {/* Modal Header with Close Button */}
                <View style={styles.modalHeader}>
                  <View style={styles.modalTitleContainer}>
                    <Text style={styles.modalTitle}>{selectedAssignment.title}</Text>
                    <Text style={styles.modalSubject}>{selectedAssignment.subject}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={() => { setSelectedAssignment(null); setUploadedFiles([]); setIsEditing(false); }}
                  >
                    <Ionicons name="close" size={24} color="#1976d2" />
                  </TouchableOpacity>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusColors[selectedAssignment.status], alignSelf: 'flex-start', marginBottom: 8 }]}> 
                  <Text style={styles.statusText}>{statusLabels[selectedAssignment.status]}</Text>
                </View>
                <Text style={styles.modalLabel}>Due Date:</Text>
                <Text style={styles.modalValue}>{selectedAssignment.dueDate}</Text>
                <Text style={styles.modalLabel}>Description:</Text>
                <Text style={styles.modalValue}>{selectedAssignment.description}</Text>
                {/* Assignment resources section */}
                <Text style={styles.modalLabel}>Assignment Resources:</Text>
                {getTeacherFiles(selectedAssignment).length > 0 ? (
                  <View style={{ marginBottom: 8 }}>
                    {getTeacherFiles(selectedAssignment).map((file) => {
                      return (
                        <Pressable 
                          key={file.id || file.name} 
                          onPress={() => handleTeacherFilePress(file)} 
                          style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}
                        >
                          <Ionicons 
                            name={isImageFile(file.name, file.type || file.mimeType) ? "image" : "document-text"} 
                            size={18} 
                            color="#1976d2" 
                            style={{ marginRight: 6 }} 
                          />
                          <Text style={styles.fileLink}>{file.name}</Text>
                          {isImageFile(file.name, file.type || file.mimeType) && (
                            <Ionicons name="eye" size={14} color="#1976d2" style={{ marginLeft: 4 }} />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={{ color: '#888', fontStyle: 'italic', marginBottom: 8 }}>No files provided by teacher.</Text>
                )}
                {/* Upload section - always visible */}
                <View style={{ marginTop: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={styles.modalLabel}>Your Submission:</Text>
                    {selectedAssignment.status === 'submitted' && !isEditing && (
                      <TouchableOpacity onPress={handleEditFiles} style={{ marginLeft: 8 }}>
                        <Ionicons name="pencil" size={18} color="#2196F3" />
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                    <TouchableOpacity
                      style={[styles.uploadButton, { opacity: (isEditing && !uploading) ? 1 : 0.5 }]}
                      onPress={handleFileUpload}
                      disabled={!isEditing || uploading}
                    >
                      <Ionicons 
                        name={uploading ? "hourglass" : "document-text"} 
                        size={18} 
                        color="#fff" 
                        style={{ marginRight: 6 }} 
                      />
                      <Text style={styles.uploadButtonText}>
                        {uploading ? 'Uploading...' : 'Upload File'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.uploadButton, { backgroundColor: '#FF9800', marginLeft: 8, opacity: (isEditing && !uploading) ? 1 : 0.5 }]}
                      onPress={handleImageUpload}
                      disabled={!isEditing || uploading}
                    >
                      <Ionicons 
                        name={uploading ? "hourglass" : "image"} 
                        size={18} 
                        color="#fff" 
                        style={{ marginRight: 6 }} 
                      />
                      <Text style={styles.uploadButtonText}>
                        {uploading ? 'Uploading...' : 'Upload Image'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {/* Divider and label for uploaded files/images */}
                  <View style={{ borderBottomWidth: 1, borderBottomColor: '#e0e0e0', marginBottom: 8 }} />
                  <Text style={{ color: '#1976d2', fontWeight: 'bold', marginBottom: 6 }}>Uploaded Files & Images</Text>
                  {uploadedFiles.length > 0 ? (
                    <View style={{ marginBottom: 8 }}>
                      {uploadedFiles.map((file) => (
                        <Pressable 
                          key={file.id || file.name} 
                          onPress={() => handleStudentFilePress(file)}
                          style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, backgroundColor: '#f4f6fa', borderRadius: 8, padding: 8 }}
                        >
                          <Ionicons name={getAssignmentFileIcon(file)} size={22} color="#1976d2" style={{ marginRight: 10 }} />
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                              <Text style={{ color: '#333', fontWeight: 'bold', flex: 1 }}>{file.name}</Text>
                              {isImageFile(file.name, file.type || file.mimeType) && (
                                <Ionicons name="eye" size={14} color="#1976d2" style={{ marginLeft: 4 }} />
                              )}
                              {file.status === 'uploaded' && (
                                <Ionicons name="cloud-done" size={16} color="#4CAF50" style={{ marginLeft: 4 }} />
                              )}
                              {file.status === 'local' && (
                                <Ionicons name="phone-portrait" size={16} color="#FF9800" style={{ marginLeft: 4 }} />
                              )}
                            </View>
                            <Text style={{ color: '#888', fontSize: 12 }}>
                              {formatAssignmentFileSize(file.size)}
                              {file.status === 'uploaded' && ' • Cloud Storage'}
                              {file.status === 'local' && ' • Local Only'}
                            </Text>
                          </View>
                          {isEditing && (
                            <TouchableOpacity onPress={() => handleRemoveFile(file.id)}>
                              <Ionicons name="close-circle" size={20} color="#F44336" />
                            </TouchableOpacity>
                          )}
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <Text style={{ color: '#888', fontStyle: 'italic', marginBottom: 8 }}>No files or images uploaded yet.</Text>
                  )}
                </View>
                {/* Submission status and submit button */}
                {isEditing ? (
                  <TouchableOpacity style={styles.submitButton} onPress={handleMarkAsSubmitted} disabled={uploadedFiles.length === 0}>
                    <Text style={styles.submitButtonText}>{uploadedFiles.length === 0 ? 'Upload File(s) to Submit' : 'Submit Assignment'}</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={{ marginTop: 12, alignItems: 'center' }}>
                    <Text style={{ color: '#4CAF50', fontWeight: 'bold', fontSize: 16 }}>Submitted</Text>
                  </View>
                )}
                {/* Feedback/Grade section */}
                <View style={{ marginTop: 18 }}>
                  <Text style={styles.modalLabel}>Teacher Feedback & Grade:</Text>
                  {selectedAssignment.status === 'graded' ? (
                    <View style={{ backgroundColor: '#e8f5e9', borderRadius: 8, padding: 10, marginTop: 6 }}>
                      <Text style={{ color: '#388e3c', fontWeight: 'bold', fontSize: 16 }}>Grade: {getFeedbackAndGrade(selectedAssignment)?.grade}</Text>
                      <Text style={{ color: '#333', marginTop: 4 }}>{getFeedbackAndGrade(selectedAssignment)?.feedback}</Text>
                    </View>
                  ) : (
                    <Text style={{ color: '#888', fontStyle: 'italic', marginTop: 6 }}>No feedback or grade yet.</Text>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Image Viewer Modal */}
      <ImageViewerModal
        visible={imageViewerVisible}
        imageUrl={selectedImageUrl}
        imageName={selectedImageName}
        onClose={() => {
          setImageViewerVisible(false);
          setSelectedImageUrl('');
          setSelectedImageName('');
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  scrollContainer: {
    padding: 16,
  },
  header: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1976d2',
    marginTop: 40,
    marginBottom: 18,
    letterSpacing: 0.5,
  },
  subjectGroup: {
    marginBottom: 28,
  },
  subjectTitle: {
    fontSize: 19,
    fontWeight: 'bold',
    color: '#388e3c',
    marginBottom: 10,
    letterSpacing: 0.2,
    paddingLeft: 4,
  },
  assignmentCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    elevation: 3,
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: '#e3eaf2',
    flexDirection: 'column',
  },
  assignmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  assignmentTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#222',
    flex: 1,
    letterSpacing: 0.1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginLeft: 10,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  statusText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 0.2,
  },
  dueDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
    marginTop: 2,
    fontWeight: '500',
  },
  detailsButton: {
    alignSelf: 'flex-end',
    backgroundColor: '#1976d2',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 10,
    marginTop: 6,
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.10,
    shadowRadius: 2,
  },
  detailsButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 0.2,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '92%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    elevation: 6,
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitleContainer: {
    flex: 1,
    marginRight: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  modalSubject: {
    fontSize: 16,
    color: '#388e3c',
    marginBottom: 10,
    fontWeight: 'bold',
  },
  modalLabel: {
    fontWeight: 'bold',
    color: '#555',
    marginTop: 10,
    fontSize: 15,
  },
  modalValue: {
    color: '#333',
    marginBottom: 4,
    fontSize: 15,
  },
  fileLink: {
    color: '#2196F3',
    textDecorationLine: 'underline',
    marginBottom: 4,
    fontSize: 15,
  },
  closeButton: {
    marginTop: 18,
    backgroundColor: '#1976d2',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.10,
    shadowRadius: 2,
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 0.2,
  },
  submitButton: {
    marginTop: 16,
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.10,
    shadowRadius: 2,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 0.2,
  },
  uploadButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
    backgroundColor: '#2196F3',
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  uploadButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 0.1,
  },
  closeBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
  },

  // Empty State Styles
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 16,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default ViewAssignments; 