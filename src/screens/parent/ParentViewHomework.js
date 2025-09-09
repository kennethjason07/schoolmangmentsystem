import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, Modal, Pressable, Linking, Platform, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../utils/AuthContext';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';
import { 
  validateTenantAccess, 
  createTenantQuery, 
  validateDataTenancy,
  TENANT_ERROR_MESSAGES 
} from '../../utils/tenantValidation';
import { useTenantContext } from '../../contexts/TenantContext';
import Header from '../../components/Header';
import ImageViewerModal from '../../components/ImageViewerModal';
import { useSelectedStudent } from '../../contexts/SelectedStudentContext';

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

const ParentViewHomework = ({ navigation }) => {
  const { user, loading: authLoading } = useAuth();
  const { tenantId, currentTenant, validateCurrentTenantAccess, executeSafeTenantQuery, loading: tenantLoading, retryTenantLoading, debugTenantLoading } = useTenantContext();
  const { selectedStudent } = useSelectedStudent();
  
  // Enhanced tenant debugging following EMAIL_BASED_TENANT_SYSTEM.md
  const DEBUG_MODE = process.env.NODE_ENV === 'development';
  
  if (DEBUG_MODE) {
    console.log('🏢 [PARENT HOMEWORK TENANT DEBUG]:', {
      tenantId: tenantId || 'NO TENANT',
      tenantName: currentTenant?.name || 'NO TENANT NAME',
      tenantStatus: currentTenant?.status || 'UNKNOWN',
      tenantLoading: tenantLoading || false,
      userEmail: user?.email || 'NO USER',
      selectedStudent: selectedStudent?.name || 'None',
      authLoading: authLoading || false,
      timestamp: new Date().toISOString()
    });
    
    // Add global test functions for development debugging
    if (typeof window !== 'undefined') {
      window.debugParentHomeworkTenantContext = () => {
        console.log('🏢 [HOMEWORK TENANT DEBUG] Current tenant context state:', {
          tenantId: tenantId || 'NOT SET',
          currentTenant: currentTenant ? { id: currentTenant.id, name: currentTenant.name } : 'NOT SET',
          tenantLoading: tenantLoading,
          user: user ? { id: user.id, email: user.email } : 'NOT SET',
          selectedStudent: selectedStudent ? { id: selectedStudent.id, name: selectedStudent.name } : 'NOT SET',
          authLoading: authLoading
        });
        return {
          tenantId,
          currentTenant: currentTenant ? { id: currentTenant.id, name: currentTenant.name } : null,
          tenantLoading,
          user: user ? { id: user.id, email: user.email } : null,
          isReady: !tenantLoading && !authLoading && !!tenantId && !!user
        };
      };
      
      window.retryTenantLoading = async () => {
        console.log('🔄 [MANUAL TENANT RETRY] Starting manual tenant retry...');
        if (retryTenantLoading) {
          await retryTenantLoading();
          console.log('🔄 [MANUAL TENANT RETRY] Completed');
        } else {
          console.log('❌ [MANUAL TENANT RETRY] Function not available');
        }
      };
      
      window.debugTenantLoading = async () => {
        console.log('📝 [DEBUG TENANT LOADING] Starting enhanced debug...');
        if (debugTenantLoading) {
          const result = await debugTenantLoading();
          console.log('📝 [DEBUG TENANT LOADING] Result:', result);
          return result;
        } else {
          console.log('❌ [DEBUG TENANT LOADING] Function not available');
        }
      };
      
      console.log('🧪 [DEV TOOLS] Added global functions:');
      console.log('   • window.debugParentHomeworkTenantContext() - Debug current tenant context state');
      console.log('   • window.retryTenantLoading() - Manually retry tenant loading');
      console.log('   • window.debugTenantLoading() - Run enhanced tenant loading debug');
    }
  }
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Image viewer modal state
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState('');
  const [selectedImageName, setSelectedImageName] = useState('');

  useEffect(() => {
    if (authLoading || tenantLoading) {
      return; // Wait for auth and tenant to finish loading
    }
    
    // Enhanced tenant-aware loading check
    if (!tenantId || !currentTenant) {
      console.log('🔄 [TENANT-AWARE] useEffect: Tenant not ready yet, skipping homework fetch');
      return;
    }
    
    if (user && (selectedStudent || user.linked_parent_of)) {
      fetchHomework();
    }

    // Real-time subscriptions for both assignments and homeworks
    const assignmentsSub = supabase
      .channel('parent-assignments')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.ASSIGNMENTS }, fetchHomework)
      .subscribe();

    const homeworksSub = supabase
      .channel('parent-homeworks')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.HOMEWORKS }, fetchHomework)
      .subscribe();

    return () => {
      assignmentsSub.unsubscribe();
      homeworksSub.unsubscribe();
    };
  }, [authLoading, tenantLoading, tenantId, currentTenant, user, selectedStudent]);

  const fetchHomework = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Enhanced tenant validation following EMAIL_BASED_TENANT_SYSTEM.md
      
      // Check if tenant is still loading
      if (tenantLoading) {
        console.log('🔄 [TENANT-AWARE] Tenant context is loading, delaying homework fetch...');
        return;
      }
      
      // If tenant context is not loaded, try to resolve tenant directly by email
      let resolvedTenantId = tenantId;
      let resolvedTenant = currentTenant;
      
      if (!tenantId || !currentTenant) {
        console.log('🔍 [TENANT-AWARE] Tenant context not loaded, attempting direct email-based tenant resolution...');
        
        if (!user || !user.email) {
          console.error('❌ [TENANT-AWARE] Cannot resolve tenant: No authenticated user');
          setError('Authentication required. Please log in again.');
          setLoading(false);
          return;
        }
        
        try {
          // Direct tenant lookup using email
          console.log('📧 [TENANT-AWARE] Looking up tenant for email:', user.email);
          const { getTenantIdByEmail } = await import('../../utils/getTenantByEmail');
          const emailTenantResult = await getTenantIdByEmail(user.email);
          
          if (emailTenantResult.success) {
            resolvedTenantId = emailTenantResult.data.tenant.id;
            resolvedTenant = emailTenantResult.data.tenant;
            console.log('✅ [TENANT-AWARE] Successfully resolved tenant via email:', {
              tenantId: resolvedTenantId,
              tenantName: resolvedTenant.name,
              userEmail: user.email
            });
          } else {
            console.error('❌ [TENANT-AWARE] Email-based tenant resolution failed:', emailTenantResult.error);
            setError(emailTenantResult.error || 'Unable to determine your school. Please contact administrator.');
            setLoading(false);
            return;
          }
        } catch (emailLookupError) {
          console.error('❌ [TENANT-AWARE] Error during email-based tenant lookup:', emailLookupError);
          setError('Unable to load school information. Please try again.');
          setLoading(false);
          return;
        }
      }

      console.log('=== [TENANT-AWARE] PARENT FETCHING ASSIGNMENTS ===');
      console.log('🏢 Resolved Tenant:', resolvedTenant.name, '(ID:', resolvedTenantId, ')');
      console.log('Parent User ID:', user.id);
      console.log('Selected Student:', selectedStudent);

      // Get student data - use selected student if available, otherwise get from parent link
      let studentData = null;
      
      if (selectedStudent) {
        // Use the selected student from context
        console.log('Using selected student from context:', selectedStudent.id);
        studentData = selectedStudent;
      } else if (user.linked_parent_of) {
        // Get student from direct link
        console.log('Using linked_parent_of student:', user.linked_parent_of);
        const { data: linkedStudent, error: studentError } = await supabase
          .from(TABLES.STUDENTS)
          .select(`
            *,
            classes(id, class_name, section)
          `)
          .eq('id', user.linked_parent_of)
          .single();

        if (studentError || !linkedStudent) {
          throw new Error('Student data not found for parent');
        }
        studentData = linkedStudent;
      } else {
        // Try to find student via parent relationship tables
        console.log('Finding student via parent relationship...');
        const { data: parentRelationships, error: relationError } = await supabase
          .from('parent_student_relationships')
          .select(`
            student_id,
            students!parent_student_relationships_student_id_fkey(
              *,
              classes(id, class_name, section)
            )
          `)
          .eq('parent_id', user.id)
          .limit(1);

        if (relationError || !parentRelationships || parentRelationships.length === 0) {
          throw new Error('No student found for this parent account');
        }
        
        studentData = parentRelationships[0].students;
      }

      if (!studentData) {
        throw new Error('Student profile not found');
      }
      
      // Validate that student belongs to resolved tenant
      if (studentData.tenant_id && studentData.tenant_id !== resolvedTenantId) {
        console.error('❌ [TENANT-AWARE] Student belongs to different tenant:', {
          studentTenant: studentData.tenant_id,
          resolvedTenant: resolvedTenantId
        });
        throw new Error(TENANT_ERROR_MESSAGES.WRONG_TENANT_DATA);
      }

      console.log('📚 [TENANT-AWARE] Student data for homework fetch:', { id: studentData.id, class_id: studentData.class_id, name: studentData.name, tenant_id: studentData.tenant_id });

      let allAssignments = [];

      // Get assignments from assignments table using tenant-aware query
      try {
        console.log('🔍 [TENANT-AWARE] Fetching assignments for class ID:', studentData.class_id);
        
        
        // Use direct tenant-aware query with resolved tenant ID
        const tenantAssignmentQuery = createTenantQuery(resolvedTenantId, TABLES.ASSIGNMENTS);
        const { data: assignmentsData, error: assignmentsError } = await tenantAssignmentQuery
          .select(`
            *,
            subjects(name),
            teachers(name)
          `)
          .eq('class_id', studentData.class_id)
          .order('due_date', { ascending: true });

        console.log('📚 [TENANT-AWARE] Assignments query result for parent:', { data: assignmentsData?.length || 0, error: assignmentsError });

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

      // Get homeworks from homeworks table using tenant-aware query
      try {
        console.log('🔍 [TENANT-AWARE] Fetching homeworks for class ID:', studentData.class_id, 'student ID:', studentData.id);
        
        
        // Use direct tenant-aware query (bypassing complex TenantAwareQueryBuilder for OR queries)
        console.log('🔧 [TENANT-AWARE] Using direct tenant query for homeworks...');
        const { data: homeworksData, error: homeworksError } = await supabase
          .from(TABLES.HOMEWORKS)
          .select(`
            *,
            subjects(name),
            teachers(name)
          `)
          .eq('tenant_id', resolvedTenantId)
          .or(`class_id.eq.${studentData.class_id},assigned_students.cs.{${studentData.id}}`)
          .order('due_date', { ascending: true });
        
        console.log('🔧 [TENANT-AWARE] Direct homework query completed:', {
          tenantId: resolvedTenantId,
          classId: studentData.class_id,
          studentId: studentData.id,
          results: homeworksData?.length || 0,
          error: homeworksError?.message || 'none'
        });

        console.log('📝 [TENANT-AWARE] Homeworks query result for parent:', { data: homeworksData?.length || 0, error: homeworksError });

        if (homeworksError) {
          if (homeworksError.code === '42P01') {
            console.log('Homeworks table does not exist');
          } else {
            console.error('Homeworks error:', homeworksError);
          }
        } else if (homeworksData) {
          console.log('📚 Processing homeworks data for parent:', homeworksData.length, 'homeworks found');
          
          const processedHomeworks = homeworksData.map((homework, homeworkIndex) => {
            console.log(`📝 Processing homework ${homeworkIndex + 1} for parent:`, {
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

      // Get existing submissions for this student using tenant-aware query
      try {
        console.log('🔍 [TENANT-AWARE] Fetching submissions for student ID:', studentData.id);
        
        // Use direct tenant-aware query for submissions with resolved tenant ID
        const tenantSubmissionQuery = createTenantQuery(resolvedTenantId, 'assignment_submissions');
        const { data: submissionsData, error: submissionsError } = await tenantSubmissionQuery
          .select('*')
          .eq('student_id', studentData.id);

        console.log('💬 [TENANT-AWARE] Submissions query result for parent:', { data: submissionsData?.length || 0, error: submissionsError });

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
        console.log('No assignments found in database for parent view');
      }

      console.log('Final assignments list for parent view:', allAssignments.length);
      setAssignments(allAssignments);

    } catch (err) {
      console.error('Parent homework fetch error:', err);
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

  // When opening modal
  const openAssignmentModal = (assignment) => {
    setSelectedAssignment(assignment);
  };

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

  if (loading || tenantLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}> 
        <ActivityIndicator size="large" color="#FF9800" />
        <Text style={{ marginTop: 10, color: '#FF9800' }}>Loading homework...</Text>
        {DEBUG_MODE && (
          <View style={styles.debugContainer}>
            <Text style={styles.debugLabel}>DEBUG INFO:</Text>
            <Text style={styles.debugText}>Auth Loading: {authLoading ? 'Yes' : 'No'}</Text>
            <Text style={styles.debugText}>Tenant Loading: {tenantLoading ? 'Yes' : 'No'}</Text>
            <Text style={styles.debugText}>Tenant ID: {tenantId || 'Not Set'}</Text>
            <Text style={styles.debugText}>User: {user?.email || 'Not Set'}</Text>
            <Text style={styles.debugText}>Student: {selectedStudent?.name || 'Not Set'}</Text>
          </View>
        )}
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}> 
        <Text style={{ color: '#d32f2f', fontSize: 16, marginBottom: 12, textAlign: 'center' }}>Error: {error}</Text>
        <TouchableOpacity onPress={fetchHomework} style={{ backgroundColor: '#FF9800', padding: 12, borderRadius: 8 }}>
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>Retry</Text>
        </TouchableOpacity>
        {DEBUG_MODE && (
          <View style={styles.debugContainer}>
            <Text style={styles.debugLabel}>TENANT DEBUG INFO:</Text>
            <Text style={styles.debugText}>Auth Loading: {authLoading ? 'Yes' : 'No'}</Text>
            <Text style={styles.debugText}>Tenant Loading: {tenantLoading ? 'Yes' : 'No'}</Text>
            <Text style={styles.debugText}>Tenant ID: {tenantId || 'Not Set'}</Text>
            <Text style={styles.debugText}>Tenant Name: {currentTenant?.name || 'Not Set'}</Text>
            <Text style={styles.debugText}>User: {user?.email || 'Not Set'}</Text>
            <Text style={styles.debugText}>Student: {selectedStudent?.name || 'Not Set'}</Text>
            <Text style={styles.debugText}>Error Type: {error?.includes('tenant') ? 'Tenant-related' : 'Other'}</Text>
          </View>
        )}
      </View>
    );
  }

  const studentName = selectedStudent?.name || 'Your Child';

  return (
    <View style={styles.container}>
      <Header 
        title="Homework & Assignments" 
        showBack={true} 
        showProfile={true}
        subtitle={`for ${studentName}`}
      />
      <ScrollView style={styles.scrollContainer}>
        {assignments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="library-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No homework assigned</Text>
            <Text style={styles.emptySubtext}>
              No homework or assignments have been assigned to {studentName} yet.
            </Text>
          </View>
        ) : (
          grouped.map(([subject, assignments]) => (
            <View key={subject} style={styles.subjectGroup}>
              <Text style={styles.subjectTitle}>{subject}</Text>
              {assignments.map(assignment => (
                <TouchableOpacity 
                  key={assignment.id} 
                  style={styles.assignmentCard} 
                  activeOpacity={0.85} 
                  onPress={() => openAssignmentModal(assignment)}
                >
                  <View style={styles.assignmentHeader}>
                    <Text style={styles.assignmentTitle}>{assignment.title}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusColors[assignment.status] }]}>
                      <Text style={styles.statusText}>{statusLabels[assignment.status]}</Text>
                    </View>
                  </View>
                  <Text style={styles.assignmentMeta}>
                    Assigned by: {assignment.assignedBy}
                  </Text>
                  <Text style={styles.dueDate}>
                    Due: {assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString('en-US', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    }) : 'No due date'}
                  </Text>
                  {assignment.files.length > 0 && (
                    <View style={styles.filesIndicator}>
                      <Ionicons name="attach" size={16} color="#666" />
                      <Text style={styles.filesText}>{assignment.files.length} file(s) attached</Text>
                    </View>
                  )}
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
        onRequestClose={() => setSelectedAssignment(null)}
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
                    onPress={() => setSelectedAssignment(null)}
                  >
                    <Ionicons name="close" size={24} color="#FF9800" />
                  </TouchableOpacity>
                </View>

                <View style={[styles.statusBadge, { backgroundColor: statusColors[selectedAssignment.status], alignSelf: 'flex-start', marginBottom: 8 }]}> 
                  <Text style={styles.statusText}>{statusLabels[selectedAssignment.status]}</Text>
                </View>

                <Text style={styles.modalLabel}>Assigned by:</Text>
                <Text style={styles.modalValue}>{selectedAssignment.assignedBy}</Text>

                <Text style={styles.modalLabel}>Due Date:</Text>
                <Text style={styles.modalValue}>
                  {selectedAssignment.dueDate ? new Date(selectedAssignment.dueDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }) : 'No due date'}
                </Text>

                <Text style={styles.modalLabel}>Description:</Text>
                <Text style={styles.modalValue}>{selectedAssignment.description || 'No description provided'}</Text>

                {selectedAssignment.instructions && (
                  <>
                    <Text style={styles.modalLabel}>Instructions:</Text>
                    <Text style={styles.modalValue}>{selectedAssignment.instructions}</Text>
                  </>
                )}

                {/* Assignment resources section */}
                <Text style={styles.modalLabel}>Assignment Resources:</Text>
                {selectedAssignment.files.length > 0 ? (
                  <View style={{ marginBottom: 8 }}>
                    {selectedAssignment.files.map((file) => {
                      return (
                        <Pressable 
                          key={file.id || file.name} 
                          onPress={() => handleTeacherFilePress(file)} 
                          style={styles.fileItem}
                        >
                          <Ionicons 
                            name={isImageFile(file.name, file.type || file.mimeType) ? "image" : "document-text"} 
                            size={18} 
                            color="#FF9800" 
                            style={{ marginRight: 6 }} 
                          />
                          <Text style={styles.fileLink}>{file.name}</Text>
                          {isImageFile(file.name, file.type || file.mimeType) && (
                            <Ionicons name="eye" size={14} color="#FF9800" style={{ marginLeft: 4 }} />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={{ color: '#888', fontStyle: 'italic', marginBottom: 8 }}>No files provided by teacher.</Text>
                )}

                {/* Student submission section - VIEW ONLY FOR PARENTS */}
                <Text style={styles.modalLabel}>Student's Submission:</Text>
                {selectedAssignment.uploadedFiles && selectedAssignment.uploadedFiles.length > 0 ? (
                  <View style={{ marginBottom: 8 }}>
                    {selectedAssignment.uploadedFiles.map((file, index) => (
                      <Pressable 
                        key={file.id || index} 
                        onPress={() => handleStudentFilePress(file)}
                        style={styles.submissionFileItem}
                      >
                        <Ionicons name={getFileIcon(file.type)} size={22} color="#FF9800" style={{ marginRight: 10 }} />
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                            <Text style={{ color: '#333', fontWeight: 'bold', flex: 1 }}>{file.name}</Text>
                            {isImageFile(file.name, file.type || file.mimeType) && (
                              <Ionicons name="eye" size={14} color="#FF9800" style={{ marginLeft: 4 }} />
                            )}
                            {file.status === 'uploaded' && (
                              <Ionicons name="cloud-done" size={16} color="#4CAF50" style={{ marginLeft: 4 }} />
                            )}
                          </View>
                          <Text style={{ color: '#888', fontSize: 12 }}>
                            {formatFileSize(file.size)}
                            {selectedAssignment.submittedAt && ` • Submitted on ${new Date(selectedAssignment.submittedAt).toLocaleDateString()}`}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <Text style={{ color: '#888', fontStyle: 'italic', marginBottom: 8 }}>
                    {selectedAssignment.status === 'not_submitted' 
                      ? 'Not submitted yet.' 
                      : 'No files uploaded.'}
                  </Text>
                )}

                {/* Feedback/Grade section */}
                <View style={{ marginTop: 18 }}>
                  <Text style={styles.modalLabel}>Teacher Feedback & Grade:</Text>
                  {selectedAssignment.status === 'graded' ? (
                    <View style={{ backgroundColor: '#e8f5e9', borderRadius: 8, padding: 10, marginTop: 6 }}>
                      <Text style={{ color: '#388e3c', fontWeight: 'bold', fontSize: 16 }}>
                        Grade: {getFeedbackAndGrade(selectedAssignment)?.grade}
                      </Text>
                      <Text style={{ color: '#333', marginTop: 4 }}>
                        {getFeedbackAndGrade(selectedAssignment)?.feedback}
                      </Text>
                    </View>
                  ) : (
                    <Text style={{ color: '#888', fontStyle: 'italic', marginTop: 6 }}>
                      No feedback or grade yet.
                    </Text>
                  )}
                </View>

                {/* Contact teacher button */}
                <TouchableOpacity 
                  style={styles.contactTeacherButton}
                  onPress={() => {
                    setSelectedAssignment(null);
                    navigation.navigate('ParentTabs', { screen: 'Chat' });
                  }}
                >
                  <Ionicons name="chatbubbles" size={18} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.contactTeacherText}>Contact Teacher</Text>
                </TouchableOpacity>
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
    color: '#FF9800',
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
    shadowColor: '#FF9800',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: '#ffeaa7',
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
  assignmentMeta: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    fontWeight: '500',
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
    color: '#FF9800',
    marginBottom: 4,
    fontWeight: '600',
  },
  filesIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  filesText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
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
    shadowColor: '#FF9800',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    maxHeight: '90%',
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
    color: '#FF9800',
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
  fileItem: {
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 4,
    padding: 8,
    backgroundColor: '#fff3e0',
    borderRadius: 8,
  },
  fileLink: {
    color: '#FF9800',
    textDecorationLine: 'underline',
    fontSize: 15,
    fontWeight: '500',
  },
  submissionFileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    backgroundColor: '#f4f6fa',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  contactTeacherButton: {
    marginTop: 20,
    backgroundColor: '#FF9800',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    shadowColor: '#FF9800',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  contactTeacherText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 0.2,
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
  
  // Debug styles for tenant information
  debugContainer: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    maxWidth: '90%',
  },
  debugLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FF9800',
    marginBottom: 4,
    textAlign: 'center',
  },
  debugText: {
    fontSize: 10,
    color: '#666',
    marginBottom: 2,
    fontFamily: 'monospace',
  },
});

export default ParentViewHomework;
