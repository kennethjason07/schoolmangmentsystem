import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Dimensions,
  Platform,
  FlatList,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import Header from '../../components/Header';
import { supabase } from '../../utils/supabase';
import ReportCardModal from '../../components/ReportCardModal';
import { useTenantAccess } from '../../utils/tenantHelpers';
import { useAuth } from '../../utils/AuthContext';

const isWeb = Platform.OS === 'web';

const ReportCardGeneration = ({ navigation }) => {
  // Tenant and auth context
  const { user } = useAuth();
  const { 
    tenantId, 
    isReady, 
    isLoading: tenantLoading, 
    tenant, 
    tenantName, 
    error: tenantError 
  } = useTenantAccess();
  
  // Dynamic responsive state that updates on resize
  const [dimensions, setDimensions] = useState(() => {
    const { width, height } = Dimensions.get('window');
    return { width, height };
  });
  
  const isTablet = dimensions.width >= 768;
  const getResponsiveWidth = () => {
    if (isWeb && dimensions.width > 1200) return Math.min(dimensions.width * 0.8, 1200);
    if (isTablet) return dimensions.width * 0.9;
    return dimensions.width;
  };
  const responsiveWidth = getResponsiveWidth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [classes, setClasses] = useState([]);
  const [exams, setExams] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [reportCardVisible, setReportCardVisible] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [scrollY] = useState(new Animated.Value(0));
  const scrollViewRef = useRef(null);

  // Listen for dimension changes on web
  useEffect(() => {
    if (isWeb) {
      const subscription = Dimensions.addEventListener('change', ({ window }) => {
        setDimensions({ width: window.width, height: window.height });
      });
      return () => subscription?.remove();
    }
  }, []);

  useEffect(() => {
    console.log('🏢 ReportCardGeneration: Tenant context changed:', {
      tenantId: tenantId || 'NULL',
      isReady,
      tenantLoading,
      userEmail: user?.email || 'NULL'
    });
    
    // Only load data when tenant and user are available
    if (tenantId && user && isReady && !tenantLoading) {
      console.log('🚀 ReportCardGeneration: Loading initial data with tenant:', tenantId);
      loadInitialData();
    } else if (tenantError) {
      console.error('❌ ReportCardGeneration: Tenant error:', tenantError);
      Alert.alert('Error', tenantError);
    }
  }, [tenantId, user, isReady, tenantLoading, tenantError]);

  useEffect(() => {
    if (selectedClass && selectedExam) {
      loadStudents();
    }
  }, [selectedClass, selectedExam]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadClasses(), loadExams()]);
    } catch (error) {
      console.error('Error loading initial data:', error);
      Alert.alert('Error', 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadClasses = async () => {
    try {
      console.log('🏢 ReportCardGeneration: Loading classes for tenant:', tenantId);
      
      if (!tenantId) {
        console.warn('🏢 ReportCardGeneration: No tenantId available for classes');
        setClasses([]);
        return;
      }
      
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('class_name', { ascending: true });

      if (error) {
        console.error('❌ ReportCardGeneration: Error loading classes:', error);
        throw error;
      }
      
      console.log('✅ ReportCardGeneration: Loaded', data?.length || 0, 'classes for tenant');
      setClasses(data || []);
    } catch (error) {
      console.error('Error loading classes:', error);
      throw error;
    }
  };

  const loadExams = async () => {
    try {
      console.log('📋 ReportCardGeneration: Loading exams for tenant:', tenantId);
      
      if (!tenantId) {
        console.warn('📋 ReportCardGeneration: No tenantId available for exams');
        setExams([]);
        return;
      }
      
      const { data, error } = await supabase
        .from('exams')
        .select(`
          id,
          name,
          class_id,
          academic_year,
          start_date,
          end_date,
          remarks,
          max_marks,
          created_at,
          tenant_id,
          classes:class_id (
            id,
            class_name,
            section
          )
        `)
        .eq('tenant_id', tenantId)
        .order('start_date', { ascending: false });

      if (error) {
        console.error('❌ ReportCardGeneration: Error loading exams:', error);
        throw error;
      }
      
      console.log('✅ ReportCardGeneration: Loaded', data?.length || 0, 'exams for tenant');
      setExams(data || []);
    } catch (error) {
      console.error('Error loading exams:', error);
      throw error;
    }
  };

  const loadStudents = async () => {
    try {
      console.log('👨‍🎓 ReportCardGeneration: Loading students for class:', selectedClass, 'tenant:', tenantId);
      
      if (!tenantId) {
        console.warn('👨‍🎓 ReportCardGeneration: No tenantId available for students');
        setStudents([]);
        return;
      }
      
      if (!selectedClass) {
        console.warn('👨‍🎓 ReportCardGeneration: No class selected for students');
        setStudents([]);
        return;
      }
      
      const { data, error } = await supabase
        .from('students')
        .select(`
          *,
          classes:class_id (
            id,
            class_name,
            section
          ),
          parents:parent_id (
            name,
            phone,
            email
          )
        `)
        .eq('class_id', selectedClass)
        .eq('tenant_id', tenantId)
        .order('roll_no', { ascending: true });

      if (error) {
        console.error('❌ ReportCardGeneration: Error loading students:', error);
        throw error;
      }
      
      console.log('✅ ReportCardGeneration: Loaded', data?.length || 0, 'students for class');
      setStudents(data || []);
    } catch (error) {
      console.error('Error loading students:', error);
      Alert.alert('Error', 'Failed to load students. Please try again.');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadInitialData();
    if (selectedClass && selectedExam) {
      await loadStudents();
    }
    setRefreshing(false);
  };

  const getFilteredExams = () => {
    if (!selectedClass) return [];
    
    // Filter exams by class_id, ensuring proper type comparison
    const filteredExams = exams.filter(exam => {
      // Handle both string and number types for IDs
      const examClassId = exam.class_id?.toString();
      const selectedClassId = selectedClass?.toString();
      
      return examClassId === selectedClassId;
    });
    
    return filteredExams;
  };

  const handleStudentPress = (student) => {
    setSelectedStudent(student);
    setReportCardVisible(true);
  };

  const closeReportCard = () => {
    setReportCardVisible(false);
    setSelectedStudent(null);
  };

  const getClassDisplay = (classData) => {
    return `${classData.class_name} - ${classData.section}`;
  };

  const getSelectedClassDisplay = () => {
    const classData = classes.find(c => c.id === selectedClass);
    return classData ? getClassDisplay(classData) : 'Select Class';
  };

  const getSelectedExamDisplay = () => {
    const examData = exams.find(e => e.id === selectedExam);
    return examData ? examData.name : 'Select Exam';
  };

  // Scroll management functions
  const handleScroll = useCallback((event) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    scrollY.setValue(currentScrollY);
    setShowScrollToTop(currentScrollY > 300);
  }, [scrollY]);

  const scrollToTop = useCallback(() => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  const scrollToStudents = useCallback(() => {
    if (selectedClass && selectedExam && students.length > 0) {
      // Approximate scroll position to students section
      scrollViewRef.current?.scrollTo({ y: 500, animated: true });
    }
  }, [selectedClass, selectedExam, students.length]);

  const renderStudent = useCallback(({ item: student, index }) => (
    <TouchableOpacity
      style={[
        styles.studentCard,
        isTablet && styles.studentCardTablet,
        index % 2 === 0 && isTablet ? styles.studentCardLeft : isTablet ? styles.studentCardRight : {}
      ]}
      onPress={() => handleStudentPress(student)}
      activeOpacity={0.7}
    >
      <View style={styles.studentInfo}>
        <View style={styles.studentHeader}>
          <Text style={styles.studentName} numberOfLines={1}>{student.name}</Text>
          <Text style={styles.rollNumber}>#{student.roll_no || 'N/A'}</Text>
        </View>
        <Text style={styles.studentDetails} numberOfLines={1}>
          Adm: {student.admission_no}
        </Text>
        <Text style={styles.studentDetails} numberOfLines={1}>
          Parent: {student.parents?.name || 'N/A'}
        </Text>
      </View>
      <View style={styles.viewReportButton}>
        <Ionicons name="document-text-outline" size={18} color="#1976d2" />
        <Text style={styles.viewReportText}>View Report</Text>
      </View>
    </TouchableOpacity>
  ), [isTablet, handleStudentPress]);

  const getItemLayout = useCallback((data, index) => ({
    length: isTablet ? 130 : 90,
    offset: (isTablet ? 130 : 90) * index,
    index,
  }), [isTablet]);

  const keyExtractor = useCallback((item) => item.id.toString(), []);

  // Create styles as a function to use current dimensions
  const styles = StyleSheet.create({
    // 🎯 CRITICAL: Main container with fixed viewport height
    container: {
      flex: 1,
      backgroundColor: '#f8f9fa',
      ...(Platform.OS === 'web' && {
        height: '100vh',           // ✅ CRITICAL: Fixed viewport height
        maxHeight: '100vh',        // ✅ CRITICAL: Prevent expansion
        overflow: 'hidden',        // ✅ CRITICAL: Hide overflow on main container
        position: 'relative',      // ✅ CRITICAL: For absolute positioning
      }),
    },
    
    // 🎯 CRITICAL: Scrollable area with calculated height
    scrollableContainer: {
      flex: 1,
      ...(Platform.OS === 'web' && {
        height: 'calc(100vh - 140px)',      // ✅ CRITICAL: Account for header + filters bar
        maxHeight: 'calc(100vh - 140px)',   // ✅ CRITICAL: Prevent expansion
        overflow: 'hidden',                 // ✅ CRITICAL: Control overflow
      }),
    },
    
    // 🎯 CRITICAL: ScrollView with explicit overflow
    scrollView: {
      flex: 1,
      ...(Platform.OS === 'web' && {
        height: '100%',                    // ✅ CRITICAL: Full height
        maxHeight: '100%',                 // ✅ CRITICAL: Prevent expansion
        overflowY: 'scroll',              // ✅ CRITICAL: Enable vertical scroll
        overflowX: 'hidden',              // ✅ CRITICAL: Disable horizontal scroll
        WebkitOverflowScrolling: 'touch', // ✅ GOOD: Smooth iOS scrolling
        scrollBehavior: 'smooth',         // ✅ GOOD: Smooth animations
        scrollbarWidth: 'thin',           // ✅ GOOD: Thin scrollbars
        scrollbarColor: '#1976d2 #f8f9fa', // ✅ GOOD: Custom scrollbar colors
      }),
    },
    
    // 🎯 CRITICAL: Content container properties
    scrollContent: {
      flexGrow: 1,                    // ✅ CRITICAL: Allow content to grow
      paddingHorizontal: isWeb ? Math.max(16, (dimensions.width - responsiveWidth) / 2) : 16,
      paddingBottom: 100,             // ✅ IMPORTANT: Extra bottom padding
    },
    
    // New Compact Filters Bar Styles
    filtersBar: {
      backgroundColor: 'white',
      paddingVertical: 12,
      paddingHorizontal: isWeb ? Math.max(16, (dimensions.width - responsiveWidth) / 2) : 16,
      borderBottomWidth: 1,
      borderBottomColor: '#e0e4e7',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    filterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    filterItemCompact: {
      flex: 1,
    },
    compactLabel: {
      fontSize: 12,
      fontWeight: '500',
      color: '#666',
      marginBottom: 4,
    },
    compactPickerContainer: {
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 6,
      backgroundColor: '#f8f9fa',
      minHeight: 40,
    },
    compactPicker: {
      height: 40,
      fontSize: 14,
    },
    quickStatsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: '#f0f0f0',
    },
    quickStat: {
      alignItems: 'center',
    },
    quickStatValue: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#1976d2',
    },
    quickStatLabel: {
      fontSize: 11,
      color: '#666',
    },
    scrollToStudentsBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: '#e3f2fd',
      borderRadius: 16,
    },
    scrollToStudentsText: {
      fontSize: 12,
      color: '#1976d2',
      marginLeft: 4,
      fontWeight: '500',
    },
    
    // 🎯 GOOD TO HAVE: Bottom spacing for better scroll experience
    bottomSpacing: {
      height: 100,                    // ✅ IMPORTANT: Extra space at bottom
    },
    
    // Updated main content styles (kept for backward compatibility)
    mainContent: {
      flex: 1,
    },
    webContentContainer: {
      alignSelf: 'center',
      width: responsiveWidth,
    },
    
    // Selection Summary Styles
    selectionSummary: {
      backgroundColor: 'white',
      marginVertical: 12,
      padding: 16,
      borderRadius: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    summaryRow: {
      flexDirection: 'row',
      gap: 24,
    },
    summaryItem: {
      flex: 1,
    },
    summaryItemLabel: {
      fontSize: 12,
      color: '#666',
      fontWeight: '500',
      marginBottom: 2,
    },
    summaryItemValue: {
      fontSize: 14,
      color: '#333',
      fontWeight: '600',
    },
    
    // Students List Container Styles
    studentsListContainer: {
      backgroundColor: 'white',
      marginVertical: 8,
      borderRadius: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
      paddingVertical: 16,
    },
    studentsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      marginBottom: 12,
    },
    studentsHeaderTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: '#333',
      marginLeft: 8,
    },
    
    // FlatList and Row Styles
    flatListContent: {
      paddingHorizontal: 16,
    },
    studentsRow: {
      justifyContent: 'space-between',
    },
    itemSeparator: {
      height: 8,
    },
    
    // Updated Student Card Styles
    studentCard: {
      backgroundColor: '#f8f9fa',
      borderRadius: 12,
      padding: 16,
      marginHorizontal: isTablet ? 4 : 0,
      borderWidth: 1,
      borderColor: '#e9ecef',
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.02,
      shadowRadius: 2,
      elevation: 1,
    },
    studentCardTablet: {
      flex: 1,
      marginHorizontal: 4,
    },
    studentCardLeft: {
      marginRight: 4,
    },
    studentCardRight: {
      marginLeft: 4,
    },
    studentInfo: {
      flex: 1,
    },
    studentHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    studentName: {
      fontSize: 16,
      fontWeight: '600',
      color: '#333',
      flex: 1,
    },
    rollNumber: {
      fontSize: 12,
      fontWeight: '500',
      color: '#1976d2',
      backgroundColor: '#e3f2fd',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    studentDetails: {
      fontSize: 12,
      color: '#666',
      marginBottom: 1,
    },
    viewReportButton: {
      alignItems: 'center',
      paddingLeft: 12,
      minWidth: 70,
    },
    viewReportText: {
      fontSize: 11,
      color: '#1976d2',
      marginTop: 2,
      fontWeight: '500',
      textAlign: 'center',
    },
    
    // Scroll to Top Button (Web optimized)
    scrollToTopButton: {
      position: 'absolute',
      bottom: 20,
      right: 20,
      zIndex: 1000,
    },
    scrollToTopButtonInner: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: '#1976d2',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 8,
      ...(Platform.OS === 'web' && {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }),
    },
    
    // Common Styles
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#f8f9fa',
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
      color: '#666',
      textAlign: 'center',
    },
    noDataContainer: {
      alignItems: 'center',
      paddingVertical: 40,
      paddingHorizontal: 20,
    },
    noDataText: {
      fontSize: 16,
      fontWeight: '500',
      color: '#666',
      marginTop: 12,
      textAlign: 'center',
    },
    noDataSubtext: {
      fontSize: 14,
      color: '#999',
      textAlign: 'center',
      marginTop: 4,
      lineHeight: 20,
    },
    helpSection: {
      marginTop: 20,
    },
    helpCard: {
      backgroundColor: '#e3f2fd',
      padding: 20,
      borderRadius: 12,
      alignItems: 'center',
    },
    helpTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: '#1976d2',
      marginTop: 8,
      marginBottom: 12,
    },
    helpText: {
      fontSize: 14,
      color: '#1976d2',
      textAlign: 'left',
      lineHeight: 22,
    },
    pickerDisabled: {
      backgroundColor: '#f0f0f0',
      borderColor: '#ccc',
      opacity: 0.6,
    },
  });

  // Loading state - include tenant loading
  const isLoading = loading || tenantLoading || !isReady;
  
  // Return the JSX here since styles are now created inside
  if (isLoading) {
    return (
      <View style={styles.container}>
        <Header title="Report Card Generation" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>
            {tenantLoading ? 'Loading tenant context...' : 'Loading data...'}
          </Text>
          {tenantName && (
            <Text style={[styles.loadingText, { fontSize: 14, marginTop: 8 }]}>
              Tenant: {tenantName}
            </Text>
          )}
        </View>
      </View>
    );
  }
  
  // Handle tenant error state
  if (tenantError && !tenantId) {
    return (
      <View style={styles.container}>
        <Header title="Report Card Generation" showBack={true} />
        <View style={styles.loadingContainer}>
          <Ionicons name="alert-circle" size={48} color="#dc3545" />
          <Text style={[styles.loadingText, { color: '#dc3545' }]}>Tenant Error</Text>
          <Text style={[styles.loadingText, { fontSize: 14 }]}>{tenantError}</Text>
          <TouchableOpacity
            style={{
              backgroundColor: '#1976d2',
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 8,
              marginTop: 16
            }}
            onPress={() => navigation.goBack()}
          >
            <Text style={{ color: 'white', fontWeight: '600' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Report Card Generation" showBack={true} />
      
      {/* Compact Filters Bar */}
      <View style={styles.filtersBar}>
        <View style={styles.filterRow}>
          <View style={styles.filterItemCompact}>
            <Text style={styles.compactLabel}>Class:</Text>
            <View style={styles.compactPickerContainer}>
              <Picker
                selectedValue={selectedClass}
                style={styles.compactPicker}
                onValueChange={(value) => {
                  setSelectedClass(value);
                  setSelectedExam('');
                  setStudents([]);
                }}
              >
                <Picker.Item label="Select Class" value="" />
                {classes.map(cls => (
                  <Picker.Item
                    key={cls.id}
                    label={getClassDisplay(cls)}
                    value={cls.id}
                  />
                ))}
              </Picker>
            </View>
          </View>
          
          <View style={styles.filterItemCompact}>
            <Text style={styles.compactLabel}>Exam:</Text>
            <View style={[styles.compactPickerContainer, !selectedClass && styles.pickerDisabled]}>
              <Picker
                selectedValue={selectedExam}
                style={styles.compactPicker}
                onValueChange={setSelectedExam}
                enabled={!!selectedClass}
              >
                <Picker.Item 
                  label={!selectedClass ? "Select class first" : "Select Exam"} 
                  value="" 
                />
                {getFilteredExams().map(exam => (
                  <Picker.Item
                    key={exam.id}
                    label={exam.name}
                    value={exam.id}
                  />
                ))}
              </Picker>
            </View>
          </View>
        </View>
        
        {selectedClass && selectedExam && (
          <View style={styles.quickStatsRow}>
            <View style={styles.quickStat}>
              <Text style={styles.quickStatValue}>{students.length}</Text>
              <Text style={styles.quickStatLabel}>Students</Text>
            </View>
            <TouchableOpacity
              style={styles.scrollToStudentsBtn}
              onPress={scrollToStudents}
            >
              <Ionicons name="arrow-down" size={16} color="#1976d2" />
              <Text style={styles.scrollToStudentsText}>View Students</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      
      {/* Main Content Container - Defines scrollable area */}
      <View style={styles.scrollableContainer}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              colors={['#1976d2']}
              progressBackgroundColor="#fff"
            />
          }
          showsVerticalScrollIndicator={true}
          scrollEventThrottle={16}
          onScroll={handleScroll}
        >
        {/* Selection Summary - Compact version for main content */}
        {selectedClass && selectedExam && (
          <View style={styles.selectionSummary}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryItemLabel}>Class:</Text>
                <Text style={styles.summaryItemValue}>{getSelectedClassDisplay()}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryItemLabel}>Exam:</Text>
                <Text style={styles.summaryItemValue}>{getSelectedExamDisplay()}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Students List with FlatList */}
        {selectedClass && selectedExam && (
          <View style={styles.studentsListContainer}>
            <View style={styles.studentsHeader}>
              <Ionicons name="people" size={20} color="#1976d2" />
              <Text style={styles.studentsHeaderTitle}>
                Students ({students.length})
              </Text>
            </View>
            
            <FlatList
              data={students}
              renderItem={renderStudent}
              keyExtractor={keyExtractor}
              getItemLayout={getItemLayout}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              numColumns={isTablet ? 2 : 1}
              key={`${isTablet}-${dimensions.width}`}
              columnWrapperStyle={isTablet ? styles.studentsRow : null}
              contentContainerStyle={styles.flatListContent}
              ListEmptyComponent={
                <View style={styles.noDataContainer}>
                  <Ionicons name="people-outline" size={48} color="#ccc" />
                  <Text style={styles.noDataText}>No students found</Text>
                  <Text style={styles.noDataSubtext}>
                    No students are enrolled in the selected class
                  </Text>
                </View>
              }
              ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
              updateCellsBatchingPeriod={50}
              initialNumToRender={8}
              windowSize={10}
            />
          </View>
        )}

        {/* Help Section */}
        {!selectedClass || !selectedExam ? (
          <View style={styles.helpSection}>
            <View style={styles.helpCard}>
              <Ionicons name="information-circle" size={24} color="#2196F3" />
              <Text style={styles.helpTitle}>How to Generate Report Cards</Text>
              <Text style={styles.helpText}>
                1. Select a class and section from the dropdown{'\n'}
                2. Choose an exam for which you want to generate report cards{'\n'}
                3. Click on any student to view their detailed report card{'\n'}
                4. Use the download button to save the report card as PDF
              </Text>
            </View>
          </View>
        ) : null}
        
        {/* Bottom spacing for better scrolling */}
        <View style={styles.bottomSpacing} />
        </ScrollView>
      </View>

      {/* Scroll to top button - Web specific */}
      {Platform.OS === 'web' && showScrollToTop && (
        <Animated.View style={[
          styles.scrollToTopButton,
          {
            opacity: scrollY.interpolate({
              inputRange: [300, 400],
              outputRange: [0, 1],
              extrapolate: 'clamp',
            })
          }
        ]}>
          <TouchableOpacity
            style={styles.scrollToTopButtonInner}
            onPress={scrollToTop}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-up" size={20} color="white" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Report Card Modal */}
      {selectedStudent && (
        <ReportCardModal
          visible={reportCardVisible}
          student={selectedStudent}
          examId={selectedExam}
          onClose={closeReportCard}
        />
      )}
    </View>
  );
};

export default ReportCardGeneration;
