import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, Modal, TextInput, Alert, ActivityIndicator, RefreshControl, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../utils/AuthContext';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';
import Header from '../../components/Header';
import ImageViewerModal from '../../components/ImageViewerModal';
import { 
  formatFileSize as formatAssignmentFileSize, 
  getAssignmentFileIcon,
  getAssignmentFileType 
} from '../../utils/assignmentFileUpload';

const statusColors = {
  submitted: '#FF9800',
  graded: '#4CAF50',
  returned: '#2196F3',
};

const statusLabels = {
  submitted: 'Submitted',
  graded: 'Graded',
  returned: 'Returned',
};

const gradeOptions = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F'];

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

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const ViewSubmissions = () => {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [teacherData, setTeacherData] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all'); // all, submitted, graded, returned
  const [filterType, setFilterType] = useState('all'); // all, assignment, homework
  const [searchText, setSearchText] = useState('');
  
  // Grading modal state
  const [isGradingModalVisible, setIsGradingModalVisible] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState('');
  const [feedback, setFeedback] = useState('');
  const [gradingSubmission, setGradingSubmission] = useState(null);
  
  // Image viewer modal state
  const [selectedImage, setSelectedImage] = useState(null);
  const [isImageModalVisible, setIsImageModalVisible] = useState(false);

  useEffect(() => {
    if (user) {
      fetchSubmissions();
    }
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [submissions, filterStatus, filterType, searchText]);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('=== FETCHING TEACHER SUBMISSIONS ===');
      console.log('User ID:', user.id);

      // Get teacher data
      const { data: teacher, error: teacherError } = await dbHelpers.getTeacherByUserId(user.id);
      if (teacherError || !teacher) {
        throw new Error('Teacher data not found');
      }

      console.log('Teacher data:', teacher);
      setTeacherData(teacher);

      // Get all assignment submissions for this teacher's assignments and homework
      let allSubmissions = [];

      // Method 1: Get submissions for assignments created by this teacher
      try {
        const { data: assignmentSubmissions, error: assignmentError } = await supabase
          .from('assignment_submissions')
          .select(`
            *,
            students!assignment_submissions_student_id_fkey(
              id,
              name,
              roll_no,
              classes(
                id,
                class_name,
                section
              )
            )
          `)
          .eq('assignment_type', 'assignment')
          .eq('tenant_id', teacher.tenant_id)
          .in('assignment_id', 
            // Subquery to get assignment IDs created by this teacher
            await supabase
              .from(TABLES.ASSIGNMENTS)
              .select('id')
              .eq('assigned_by', teacher.id)
              .eq('tenant_id', teacher.tenant_id)
              .then(({ data }) => data?.map(a => a.id) || [])
          )
          .order('submitted_at', { ascending: false });

        console.log('Assignment submissions:', assignmentSubmissions, assignmentError);

        if (!assignmentError && assignmentSubmissions) {
          // Get assignment details for each submission
          for (const submission of assignmentSubmissions) {
            const { data: assignmentData, error: aError } = await supabase
              .from(TABLES.ASSIGNMENTS)
              .select('title, description, due_date, subjects(name)')
              .eq('id', submission.assignment_id)
              .eq('tenant_id', teacher.tenant_id)
              .single();

            if (!aError && assignmentData) {
              allSubmissions.push({
                ...submission,
                assignmentTitle: assignmentData.title,
                assignmentDescription: assignmentData.description,
                assignmentDueDate: assignmentData.due_date,
                subjectName: assignmentData.subjects?.name || 'Unknown Subject',
                studentName: submission.students?.name || 'Unknown Student',
                studentRollNo: submission.students?.roll_no || 'N/A',
                className: submission.students?.classes ? 
                  `${submission.students.classes.class_name} ${submission.students.classes.section}` : 'Unknown Class'
              });
            }
          }
        }
      } catch (err) {
        console.error('Error fetching assignment submissions:', err);
      }

      // Method 2: Get submissions for homework created by this teacher
      try {
        const { data: homeworkSubmissions, error: homeworkError } = await supabase
          .from('assignment_submissions')
          .select(`
            *,
            students!assignment_submissions_student_id_fkey(
              id,
              name,
              roll_no,
              classes(
                id,
                class_name,
                section
              )
            )
          `)
          .eq('assignment_type', 'homework')
          .eq('tenant_id', teacher.tenant_id)
          .in('assignment_id', 
            // Subquery to get homework IDs created by this teacher
            await supabase
              .from(TABLES.HOMEWORKS)
              .select('id')
              .eq('teacher_id', teacher.id)
              .eq('tenant_id', teacher.tenant_id)
              .then(({ data }) => data?.map(h => h.id) || [])
          )
          .order('submitted_at', { ascending: false });

        console.log('Homework submissions:', homeworkSubmissions, homeworkError);

        if (!homeworkError && homeworkSubmissions) {
          // Get homework details for each submission
          for (const submission of homeworkSubmissions) {
            const { data: homeworkData, error: hError } = await supabase
              .from(TABLES.HOMEWORKS)
              .select('title, description, due_date, subjects(name)')
              .eq('id', submission.assignment_id)
              .eq('tenant_id', teacher.tenant_id)
              .single();

            if (!hError && homeworkData) {
              allSubmissions.push({
                ...submission,
                assignmentTitle: homeworkData.title,
                assignmentDescription: homeworkData.description,
                assignmentDueDate: homeworkData.due_date,
                subjectName: homeworkData.subjects?.name || 'Unknown Subject',
                studentName: submission.students?.name || 'Unknown Student',
                studentRollNo: submission.students?.roll_no || 'N/A',
                className: submission.students?.classes ? 
                  `${submission.students.classes.class_name} ${submission.students.classes.section}` : 'Unknown Class'
              });
            }
          }
        }
      } catch (err) {
        console.error('Error fetching homework submissions:', err);
      }

      // Sort all submissions by submitted date (newest first)
      allSubmissions.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));

      console.log('Final submissions list:', allSubmissions.length);
      setSubmissions(allSubmissions);

    } catch (err) {
      console.error('Submissions fetch error:', err);
      setError(err.message);
      setSubmissions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...submissions];

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(s => s.status === filterStatus);
    }

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(s => s.assignment_type === filterType);
    }

    // Filter by search text
    if (searchText.trim()) {
      const search = searchText.toLowerCase().trim();
      filtered = filtered.filter(s => 
        s.studentName?.toLowerCase().includes(search) ||
        s.assignmentTitle?.toLowerCase().includes(search) ||
        s.subjectName?.toLowerCase().includes(search) ||
        s.className?.toLowerCase().includes(search) ||
        s.studentRollNo?.toLowerCase().includes(search)
      );
    }

    setFilteredSubmissions(filtered);
  };

  const handleViewSubmission = (submission) => {
    setSelectedSubmission(submission);
  };

  const handleGradeSubmission = (submission) => {
    setGradingSubmission(submission);
    setSelectedGrade(submission.grade || '');
    setFeedback(submission.feedback || '');
    setIsGradingModalVisible(true);
  };

  const handleSaveGrade = async () => {
    if (!gradingSubmission || !selectedGrade.trim()) {
      Alert.alert('Error', 'Please select a grade');
      return;
    }

    try {
      setLoading(true);

      const updateData = {
        grade: selectedGrade,
        feedback: feedback.trim() || null,
        status: 'graded',
        graded_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('assignment_submissions')
        .update(updateData)
        .eq('id', gradingSubmission.id)
        .select()
        .single();

      if (error) throw error;

      // Update local state
      setSubmissions(prev => prev.map(s => 
        s.id === gradingSubmission.id 
          ? { ...s, ...updateData }
          : s
      ));

      Alert.alert('Success', 'Grade and feedback saved successfully!');
      setIsGradingModalVisible(false);
      setGradingSubmission(null);
      setSelectedGrade('');
      setFeedback('');

    } catch (err) {
      console.error('Error saving grade:', err);
      Alert.alert('Error', 'Failed to save grade: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchSubmissions();
  };

  const handleOpenFile = (file) => {
    console.log('Attempting to open file:', file);
    
    // Check for different possible URL properties in order of preference
    const fileUrl = file.file_url || file.url || file.localUri || file.uri;
    const fileStatus = file.status || 'unknown';
    const fileType = file.type || file.mimeType || '';
    
    // Validate the URL is a string and not empty
    if (fileUrl && typeof fileUrl === 'string' && fileUrl.trim() !== '') {
      // If it's a local URI (starts with file://), we can't open it from the teacher's device
      if (fileUrl.startsWith('file://') || fileStatus === 'local') {
        Alert.alert(
          '📱 Local File Detected', 
          `This file ("${file.name}") was stored locally on the student's device and cannot be accessed remotely.\n\n` +
          `File details:\n• Size: ${formatAssignmentFileSize(file.size)}\n• Type: ${getAssignmentFileType(file)}\n\n` +
          `To view this file, please ask the student to re-submit using cloud storage.`,
          [
            { text: 'OK', style: 'default' },
            { 
              text: 'Copy File Info', 
              onPress: () => {
                // In a real app, you might copy file details to clipboard
                console.log('File info copied:', file);
              }
            }
          ]
        );
        return;
      }
      
      // Check if it's an image file and can be displayed in modal
      const isImage = fileType.toLowerCase().includes('image') || 
                     file.name?.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i);
                     
      if (isImage && (fileStatus === 'uploaded' || fileUrl.includes('supabase'))) {
        // Open image in modal viewer
        console.log('✅ Opening image in modal:', fileUrl);
        setSelectedImage({
          imageUrl: fileUrl,
          imageName: file.name || 'Image'
        });
        setIsImageModalVisible(true);
        return;
      }
      
      // Check if it's a cloud URL (uploaded to Supabase storage)
      if (fileStatus === 'uploaded' || fileUrl.includes('supabase')) {
        console.log('✅ Opening cloud file:', fileUrl);
      }
      
      // Try to open the URL externally
      Linking.canOpenURL(fileUrl)
        .then((supported) => {
          if (supported) {
            Linking.openURL(fileUrl);
          } else {
            Alert.alert(
              'File Format Not Supported', 
              `Cannot open "${file.name}" (${file.type}). The file format may not be supported by your device.\n\nFile URL: ${fileUrl}`,
              [{ text: 'OK' }]
            );
          }
        })
        .catch((error) => {
          console.error('Error opening file:', error);
          Alert.alert(
            'Error Opening File', 
            `An error occurred while trying to open "${file.name}":\n${error.message}`,
            [{ text: 'OK' }]
          );
        });
    } else {
      Alert.alert(
        '❌ File URL Not Available', 
        `The file "${file.name}" is not accessible. This may happen if:\n\n` +
        `• The file was stored locally on the student's device\n` +
        `• The file upload to cloud storage failed\n` +
        `• The file has been moved or deleted from cloud storage\n` +
        `• The file URL was not properly saved\n\n` +
        `Please ask the student to re-submit this assignment with proper cloud storage.`,
        [{ text: 'OK' }]
      );
    }
  };

  const renderSubmissionCard = ({ item }) => {
    const isOverdue = item.assignmentDueDate && new Date(item.submitted_at) > new Date(item.assignmentDueDate);
    
    return (
      <TouchableOpacity 
        style={[styles.submissionCard, isOverdue && styles.overdueCard]} 
        activeOpacity={0.8} 
        onPress={() => handleViewSubmission(item)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleContainer}>
            <Text style={styles.assignmentTitle} numberOfLines={1}>{item.assignmentTitle}</Text>
            <Text style={styles.studentName}>{item.studentName} ({item.studentRollNo})</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColors[item.status] }]}>
            <Text style={styles.statusText}>{statusLabels[item.status]}</Text>
          </View>
        </View>
        
        <View style={styles.cardDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="book" size={14} color="#666" />
            <Text style={styles.detailText}>{item.subjectName}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="school" size={14} color="#666" />
            <Text style={styles.detailText}>{item.className}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="time" size={14} color="#666" />
            <Text style={styles.detailText}>Submitted: {formatDate(item.submitted_at)}</Text>
          </View>
          {isOverdue && (
            <View style={styles.detailRow}>
              <Ionicons name="warning" size={14} color="#f44336" />
              <Text style={[styles.detailText, { color: '#f44336' }]}>Late Submission</Text>
            </View>
          )}
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity 
            style={styles.viewButton} 
            onPress={() => handleViewSubmission(item)}
          >
            <Ionicons name="eye" size={16} color="#2196F3" />
            <Text style={styles.viewButtonText}>View</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.gradeButton, item.status === 'graded' && styles.gradedButton]} 
            onPress={() => handleGradeSubmission(item)}
          >
            <Ionicons name={item.status === 'graded' ? "checkmark-circle" : "create"} size={16} color="#fff" />
            <Text style={styles.gradeButtonText}>
              {item.status === 'graded' ? `Grade: ${item.grade}` : 'Grade'}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#1976d2" />
        <Text style={styles.loadingText}>Loading submissions...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <TouchableOpacity onPress={fetchSubmissions} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Assignment Submissions" showBack={true} showProfile={true} />
      
      {/* Search and Filter Section */}
      <View style={styles.searchFilterContainer}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by student, assignment, subject..."
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>
        
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {/* Status Filter */}
            {['all', 'submitted', 'graded', 'returned'].map((status) => (
              <TouchableOpacity
                key={status}
                style={[styles.filterChip, filterStatus === status && styles.activeFilterChip]}
                onPress={() => setFilterStatus(status)}
              >
                <Text style={[styles.filterChipText, filterStatus === status && styles.activeFilterChipText]}>
                  {status === 'all' ? 'All Status' : statusLabels[status]}
                </Text>
              </TouchableOpacity>
            ))}
            
            {/* Type Filter */}
            {['all', 'assignment', 'homework'].map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.filterChip, filterType === type && styles.activeFilterChip]}
                onPress={() => setFilterType(type)}
              >
                <Text style={[styles.filterChipText, filterType === type && styles.activeFilterChipText]}>
                  {type === 'all' ? 'All Types' : type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* Summary Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{submissions.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{submissions.filter(s => s.status === 'submitted').length}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{submissions.filter(s => s.status === 'graded').length}</Text>
          <Text style={styles.statLabel}>Graded</Text>
        </View>
      </View>

      {/* Submissions List */}
      {filteredSubmissions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>
            {submissions.length === 0 ? 'No submissions yet' : 'No submissions match your filters'}
          </Text>
          <Text style={styles.emptySubtext}>
            {submissions.length === 0 
              ? 'Students haven\'t submitted any assignments yet.'
              : 'Try adjusting your search or filter criteria.'
            }
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredSubmissions}
          renderItem={renderSubmissionCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1976d2']} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Submission Details Modal */}
      <Modal
        visible={!!selectedSubmission}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedSubmission(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedSubmission && (
              <>
                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  <View style={styles.modalTitleContainer}>
                    <Text style={styles.modalTitle}>{selectedSubmission.assignmentTitle}</Text>
                    <Text style={styles.modalSubtitle}>
                      by {selectedSubmission.studentName} ({selectedSubmission.studentRollNo})
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => setSelectedSubmission(null)}
                  >
                    <Ionicons name="close" size={24} color="#1976d2" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalScrollView}>
                  {/* Submission Info */}
                  <View style={styles.infoSection}>
                    <Text style={styles.sectionTitle}>Submission Details</Text>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Subject:</Text>
                      <Text style={styles.infoValue}>{selectedSubmission.subjectName}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Class:</Text>
                      <Text style={styles.infoValue}>{selectedSubmission.className}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Submitted:</Text>
                      <Text style={styles.infoValue}>{formatDate(selectedSubmission.submitted_at)}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Status:</Text>
                      <View style={[styles.statusBadge, { backgroundColor: statusColors[selectedSubmission.status] }]}>
                        <Text style={styles.statusText}>{statusLabels[selectedSubmission.status]}</Text>
                      </View>
                    </View>
                    {selectedSubmission.grade && (
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Grade:</Text>
                        <Text style={[styles.infoValue, styles.gradeText]}>{selectedSubmission.grade}</Text>
                      </View>
                    )}
                  </View>

                  {/* Submitted Files */}
                  <View style={styles.filesSection}>
                    <Text style={styles.sectionTitle}>Submitted Files</Text>
                    {selectedSubmission.submitted_files && selectedSubmission.submitted_files.length > 0 ? (
                      selectedSubmission.submitted_files.map((file, index) => (
                        <TouchableOpacity 
                          key={index} 
                          style={[
                            styles.fileItem,
                            file.status === 'local' && styles.localFileItem,
                            file.status === 'uploaded' && styles.cloudFileItem
                          ]}
                          onPress={() => handleOpenFile(file)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.fileIconContainer}>
                            <Ionicons 
                              name={getAssignmentFileIcon(file)} 
                              size={24} 
                              color={file.status === 'uploaded' ? '#4CAF50' : '#1976d2'} 
                            />
                            {file.status === 'uploaded' && (
                              <Ionicons 
                                name="cloud-done" 
                                size={12} 
                                color="#4CAF50" 
                                style={styles.statusIcon}
                              />
                            )}
                            {file.status === 'local' && (
                              <Ionicons 
                                name="phone-portrait" 
                                size={12} 
                                color="#FF9800" 
                                style={styles.statusIcon}
                              />
                            )}
                          </View>
                          <View style={styles.fileInfo}>
                            <View style={styles.fileNameRow}>
                              <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                              {file.status === 'uploaded' && (
                                <View style={styles.cloudBadge}>
                                  <Text style={styles.cloudBadgeText}>Cloud</Text>
                                </View>
                              )}
                              {file.status === 'local' && (
                                <View style={styles.localBadge}>
                                  <Text style={styles.localBadgeText}>Local</Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.fileSize}>
                              {formatAssignmentFileSize(file.size)} • {getAssignmentFileType(file)}
                              {file.status === 'uploaded' && ' • Accessible'}
                              {file.status === 'local' && ' • Not Accessible'}
                            </Text>
                          </View>
                          <Ionicons 
                            name={file.status === 'local' ? 'warning' : 'open-outline'} 
                            size={20} 
                            color={file.status === 'local' ? '#FF9800' : '#666'} 
                          />
                        </TouchableOpacity>
                      ))
                    ) : (
                      <Text style={styles.noFilesText}>No files submitted</Text>
                    )}
                  </View>

                  {/* Feedback Section */}
                  {selectedSubmission.feedback && (
                    <View style={styles.feedbackSection}>
                      <Text style={styles.sectionTitle}>Teacher Feedback</Text>
                      <Text style={styles.feedbackText}>{selectedSubmission.feedback}</Text>
                    </View>
                  )}
                </ScrollView>

                {/* Modal Actions */}
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.gradeModalButton}
                    onPress={() => {
                      setSelectedSubmission(null);
                      handleGradeSubmission(selectedSubmission);
                    }}
                  >
                    <Ionicons name="create" size={16} color="#fff" />
                    <Text style={styles.gradeModalButtonText}>
                      {selectedSubmission.status === 'graded' ? 'Update Grade' : 'Grade Submission'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Grading Modal */}
      <Modal
        visible={isGradingModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setIsGradingModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.gradingModalContent}>
            <Text style={styles.gradingModalTitle}>Grade Assignment</Text>
            {gradingSubmission && (
              <Text style={styles.gradingModalSubtitle}>
                {gradingSubmission.assignmentTitle} - {gradingSubmission.studentName}
              </Text>
            )}

            {/* Grade Selection */}
            <Text style={styles.gradingLabel}>Select Grade:</Text>
            <View style={styles.gradeOptions}>
              {gradeOptions.map((grade) => (
                <TouchableOpacity
                  key={grade}
                  style={[styles.gradeOption, selectedGrade === grade && styles.selectedGradeOption]}
                  onPress={() => setSelectedGrade(grade)}
                >
                  <Text style={[styles.gradeOptionText, selectedGrade === grade && styles.selectedGradeOptionText]}>
                    {grade}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Feedback Input */}
            <Text style={styles.gradingLabel}>Feedback (Optional):</Text>
            <TextInput
              style={styles.feedbackInput}
              multiline
              numberOfLines={4}
              placeholder="Enter feedback for the student..."
              value={feedback}
              onChangeText={setFeedback}
              textAlignVertical="top"
            />

            {/* Actions */}
            <View style={styles.gradingActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setIsGradingModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, !selectedGrade && styles.disabledButton]}
                onPress={handleSaveGrade}
                disabled={!selectedGrade}
              >
                <Text style={styles.saveButtonText}>Save Grade</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Image Viewer Modal */}
      <ImageViewerModal
        visible={isImageModalVisible}
        imageUrl={selectedImage?.imageUrl}
        imageName={selectedImage?.imageName}
        onClose={() => {
          setIsImageModalVisible(false);
          setSelectedImage(null);
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
  searchFilterContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 25,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: '#333',
  },
  filterContainer: {
    flexDirection: 'row',
  },
  filterChip: {
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  activeFilterChip: {
    backgroundColor: '#1976d2',
  },
  filterChipText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  activeFilterChipText: {
    color: '#fff',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  listContainer: {
    padding: 16,
  },
  submissionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  overdueCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  assignmentTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  studentName: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  cardDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#e3f2fd',
  },
  viewButtonText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  gradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
  },
  gradedButton: {
    backgroundColor: '#388e3c',
  },
  gradeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '92%',
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '500',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  modalScrollView: {
    maxHeight: 400,
  },
  infoSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    width: 80,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  gradeText: {
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  filesSection: {
    marginBottom: 20,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
  },
  localFileItem: {
    backgroundColor: '#fff3e0',
    borderWidth: 1,
    borderColor: '#ffb74d',
  },
  cloudFileItem: {
    backgroundColor: '#f3e5f5',
    borderWidth: 1,
    borderColor: '#81c784',
  },
  fileIconContainer: {
    position: 'relative',
  },
  statusIcon: {
    position: 'absolute',
    bottom: -2,
    right: -2,
  },
  fileInfo: {
    flex: 1,
    marginLeft: 12,
  },
  fileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  cloudBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  cloudBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
  localBadge: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  localBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
  fileSize: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  noFilesText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  feedbackSection: {
    marginBottom: 20,
  },
  feedbackText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
  },
  modalActions: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  gradeModalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
  },
  gradeModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },

  // Grading Modal Styles
  gradingModalContent: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  gradingModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  gradingModalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  gradingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 12,
  },
  gradeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  gradeOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    margin: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedGradeOption: {
    backgroundColor: '#e3f2fd',
    borderColor: '#1976d2',
  },
  gradeOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  selectedGradeOptionText: {
    color: '#1976d2',
  },
  feedbackInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    marginBottom: 20,
    minHeight: 100,
  },
  gradingActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    marginLeft: 8,
    backgroundColor: '#4CAF50',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default ViewSubmissions;
