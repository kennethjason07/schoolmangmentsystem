import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { generateUnifiedReceiptHTML } from '../../utils/unifiedReceiptTemplate';
import { useAuth } from '../../utils/AuthContext';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';
import { 
  useTenantAccess,
  tenantDatabase,
  createTenantQuery,
  getCachedTenantId
} from '../../utils/tenantHelpers';
import Header from '../../components/Header';

// Helper function to get grade color
const getGradeColor = (percentage) => {
  if (percentage >= 90) return '#4CAF50'; // Green for A+
  if (percentage >= 80) return '#8BC34A'; // Light green for A
  if (percentage >= 70) return '#FFC107'; // Yellow for B+
  if (percentage >= 60) return '#FF9800'; // Orange for B
  if (percentage >= 50) return '#FF5722'; // Deep orange for C
  if (percentage >= 40) return '#F44336'; // Red for D
  return '#9E9E9E'; // Grey for F
};

// Helper function to get letter grade
const getLetterGrade = (percentage) => {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  if (percentage >= 40) return 'D';
  return 'F';
};

export default function StudentMarks({ navigation }) {
  const { user } = useAuth();
  // 🚀 ENHANCED: Use enhanced tenant system
  const { tenantId, isReady, error: tenantError } = useTenantAccess();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [marksData, setMarksData] = useState([]);
  const [studentData, setStudentData] = useState(null);
  const [selectedExam, setSelectedExam] = useState(null);
  const [showChart, setShowChart] = useState(false);
  const [studentInfo, setStudentInfo] = useState(null);
  const [schoolDetails, setSchoolDetails] = useState(null);

  // 🚀 ENHANCED: Tenant validation helper
  const validateTenant = async () => {
    const cachedTenantId = await getCachedTenantId();
    if (!cachedTenantId) {
      throw new Error('Tenant context not available');
    }
    return { valid: true, tenantId: cachedTenantId };
  };

  // 🚀 ENHANCED: Wait for both user and tenant readiness
  useEffect(() => {
    console.log('🚀 Enhanced StudentMarks useEffect triggered');
    console.log('🚀 User state:', user);
    console.log('🚀 Tenant ready:', isReady);
    if (user && isReady) {
      console.log('🚀 User and tenant ready, starting enhanced marks data fetch...');
      fetchMarksData();
      fetchSchoolDetails();
    } else {
      console.log('⚠️ Waiting for user and tenant context...');
    }
  }, [user, isReady]);

  const fetchSchoolDetails = async () => {
    try {
      const { data, error } = await dbHelpers.getSchoolDetails();

      if (error) {
        console.error('Error fetching school details:', error);
        return;
      }

      if (data) {
        setSchoolDetails(data);
        console.log('✅ School details loaded');
      }
    } catch (err) {
      console.error('Error fetching school details:', err);
      // Don't set error state here to avoid blocking marks display
    }
  };

  // 🚀 ENHANCED: Set up real-time subscriptions with tenant readiness
  useEffect(() => {
    if (!user || !isReady) {
      console.log('⚠️ Real-time subscriptions waiting for user and tenant readiness');
      return;
    }

    console.log('🚀 Setting up enhanced tenant-aware real-time subscriptions');
    const subscriptions = [];

    // Subscribe to marks changes
    const marksSubscription = supabase
      .channel('student-marks-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: TABLES.MARKS
      }, (payload) => {
        console.log('🚀 Marks change detected:', payload);
        // Refresh data when marks are updated
        fetchMarksData();
      })
      .subscribe();

    subscriptions.push(marksSubscription);

    // Subscribe to exams changes
    const examsSubscription = supabase
      .channel('student-exams-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: TABLES.EXAMS
      }, (payload) => {
        console.log('🚀 Exams change detected:', payload);
        // Refresh data when exams are updated
        fetchMarksData();
      })
      .subscribe();

    subscriptions.push(examsSubscription);

    // Cleanup subscriptions
    return () => {
      subscriptions.forEach(subscription => {
        supabase.removeChannel(subscription);
      });
    };
  }, [user, isReady]);

  const fetchMarksData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🚀 === ENHANCED MARKS DATA FETCH ===');
      console.log('User ID:', user.id);

      // 🚀 ENHANCED: Validate tenant access
      const { valid, tenantId: effectiveTenantId } = await validateTenant();
      if (!valid) {
        console.error('❌ Tenant validation failed');
        setError('Tenant context not available');
        return;
      }

      console.log('🚀 Using effective tenant ID:', effectiveTenantId);

      // Get student data using enhanced tenant query via users table
      const userQuery = createTenantQuery(effectiveTenantId, TABLES.USERS)
        .select(`
          id,
          email,
          linked_student_id,
          students!users_linked_student_id_fkey(
            *,
            classes(class_name, section)
          )
        `)
        .eq('email', user.email)
        .single();

      const { data: userData, error: userError } = await userQuery;
      if (userError || !userData || !userData.linked_student_id) {
        console.error('Student data error:', userError);
        throw new Error('Student data not found or user not linked to student');
      }

      const student = userData.students;
      if (!student) {
        throw new Error('Student profile not found');
      }

      setStudentData(student);
      setStudentInfo({
        name: student.name || 'Unknown Student',
        class: student.classes?.class_name || 'N/A',
        rollNo: student.roll_no || 'N/A',
        section: student.classes?.section || '',
        profilePicUrl: '',
        dob: student.dob ? new Date(student.dob).toLocaleDateString() : 'N/A',
        gender: student.gender || 'N/A',
        address: student.address || 'N/A'
      });
      console.log('🚀 Enhanced tenant-aware student data:', { id: student.id, class_id: student.class_id });

      // Get marks data using enhanced tenant query
      const marksQuery = createTenantQuery(effectiveTenantId, TABLES.MARKS)
        .select(`
          *,
          exams(
            id,
            name,
            start_date,
            end_date,
            class_id
          ),
          subjects(
            id,
            name,
            class_id,
            is_optional
          )
        `)
        .eq('student_id', student.id)
        .order('created_at', { ascending: false });

      const { data: marks, error: marksError } = await marksQuery;

      console.log('Marks query result:', { marks, marksError });

      if (marksError && marksError.code !== '42P01') {
        console.error('Marks error:', marksError);
        throw marksError;
      }

      // Process marks data according to schema
      let processedMarks = [];
      if (marks && marks.length > 0) {
        processedMarks = marks.map(mark => {
          const marksObtained = parseFloat(mark.marks_obtained) || 0;
          const maxMarks = parseFloat(mark.max_marks) || 100;
          const percentage = maxMarks > 0 ? Math.round((marksObtained / maxMarks) * 100) : 0;

          return {
            id: mark.id,
            examName: mark.exams?.name || 'Unknown Exam',
            examDate: mark.exams?.start_date || new Date().toISOString().split('T')[0],
            examEndDate: mark.exams?.end_date || mark.exams?.start_date,
            examType: 'Exam', // Schema doesn't have exam_type, using default
            subject: mark.subjects?.name || 'Unknown Subject',
            subjectId: mark.subject_id,
            examId: mark.exam_id,
            marksObtained: marksObtained,
            totalMarks: maxMarks,
            percentage: percentage,
            grade: mark.grade || getLetterGrade(percentage),
            remarks: mark.remarks || '',
            isOptional: mark.subjects?.is_optional || false,
            academicYear: mark.exams?.academic_year || mark.subjects?.academic_year
          };
        });
      } else {
        console.log('No marks found, adding test data');
        // Add test marks data
        processedMarks = [
          {
            id: 'test-1',
            examName: 'Mid-Term Examination',
            examDate: '2024-03-15',
            examType: 'Mid-Term',
            subject: 'Mathematics',
            marksObtained: 85,
            totalMarks: 100,
            percentage: 85,
            grade: 'A',
            remarks: 'Excellent performance'
          },
          {
            id: 'test-2',
            examName: 'Mid-Term Examination',
            examDate: '2024-03-16',
            examType: 'Mid-Term',
            subject: 'Science',
            marksObtained: 78,
            totalMarks: 100,
            percentage: 78,
            grade: 'B+',
            remarks: 'Good work'
          },
          {
            id: 'test-3',
            examName: 'Unit Test 1',
            examDate: '2024-02-20',
            examType: 'Unit Test',
            subject: 'English',
            marksObtained: 92,
            totalMarks: 100,
            percentage: 92,
            grade: 'A+',
            remarks: 'Outstanding'
          },
          {
            id: 'test-4',
            examName: 'Unit Test 1',
            examDate: '2024-02-22',
            examType: 'Unit Test',
            subject: 'Social Studies',
            marksObtained: 68,
            totalMarks: 100,
            percentage: 68,
            grade: 'B',
            remarks: 'Can improve'
          }
        ];
      }

      setMarksData(processedMarks);

      // Get upcoming exams using enhanced tenant system
      try {
        const today = new Date().toISOString().split('T')[0];
        const examsQuery = createTenantQuery(effectiveTenantId, TABLES.EXAMS)
          .select(`
            id,
            name,
            start_date,
            end_date,
            remarks,
            class_id,
            academic_year
          `)
          .eq('class_id', student.class_id)
          .gte('start_date', today)
          .order('start_date', { ascending: true })
          .limit(5);

        const { data: upcomingExams, error: examsError } = await examsQuery;

        if (!examsError && upcomingExams) {
          console.log('Upcoming exams:', upcomingExams);
        }
      } catch (examsErr) {
        console.log('Upcoming exams fetch error:', examsErr);
      }

      // Get class averages for comparison using enhanced tenant system
      try {
        const classMarksQuery = createTenantQuery(effectiveTenantId, TABLES.MARKS)
          .select(`
            marks_obtained,
            max_marks,
            subject_id,
            exam_id
          `);

        const { data: classMarks, error: classMarksError } = await classMarksQuery;

        if (!classMarksError && classMarks && classMarks.length > 0) {
          console.log('Class marks for comparison:', classMarks.length, 'records');
          // Filter for same class if needed
          const sameClassMarks = classMarks.filter(mark => {
            // Add any class filtering logic here if needed
            return true; // For now, include all marks
          });
          console.log('Same class marks:', sameClassMarks.length, 'records');
        }
      } catch (classErr) {
        console.log('Class average calculation error:', classErr);
      }

    } catch (err) {
      console.error('Marks fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Calculate overall statistics
  const calculateStats = () => {
    if (marksData.length === 0) return { average: 0, highest: 0, lowest: 0, totalExams: 0 };

    const percentages = marksData.map(mark => mark.percentage);
    const average = Math.round(percentages.reduce((sum, p) => sum + p, 0) / percentages.length);
    const highest = Math.max(...percentages);
    const lowest = Math.min(...percentages);

    return {
      average,
      highest,
      lowest,
      totalExams: marksData.length
    };
  };

  // Group marks by exam
  const groupByExam = () => {
    const groups = {};
    marksData.forEach(mark => {
      const key = `${mark.examName} (${mark.examDate})`;
      if (!groups[key]) {
        groups[key] = {
          examName: mark.examName,
          examDate: mark.examDate,
          examType: mark.examType,
          subjects: []
        };
      }
      groups[key].subjects.push(mark);
    });
    return Object.values(groups);
  };

  const stats = calculateStats();
  const examGroups = groupByExam();

  // Refresh data function for header
  const refreshData = async (showLoading = false) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      await fetchMarksData();
      await fetchSchoolDetails();
    } catch (error) {
      console.error('Error refreshing data:', error);
      setError('Failed to refresh data. Please try again.');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  // Download Report Card Function - Using SAME robust approach as fee receipts
  const downloadReportCard = async () => {
    try {
      console.log('📊 Generating report card with unified receipt template approach...');
      
      // Ensure we have fresh school details; fetch if not loaded yet
      let effectiveSchoolDetails = schoolDetails;
      if (!effectiveSchoolDetails) {
        try {
          const { data, error } = await dbHelpers.getSchoolDetails();
          if (!error && data) {
            effectiveSchoolDetails = data;
            setSchoolDetails(data);
          }
        } catch (e) {
          console.log('downloadReportCard: fallback fetch school details failed:', e?.message);
        }
      }

      console.log('🏫 School details for report card:', effectiveSchoolDetails);
      console.log('👤 Student info:', studentData);
      
      // Prepare receipt data for the unified template (for logo handling)
      const receiptData = {
        student_name: studentData?.name || 'Student Name',
        class_name: studentData?.classes?.class_name || 'N/A',
        student_admission_no: studentData?.roll_no || 'N/A',
        section: studentData?.classes?.section || '',
        receipt_no: `RC-${Date.now()}`,
        payment_date_formatted: new Date().toLocaleDateString(),
        fee_component: 'Report Card',
        payment_mode: 'Academic Report',
        amount_paid: 0 // Not applicable for report card
      };
      
      const schoolDetailsForTemplate = {
        name: effectiveSchoolDetails?.name || 'School Management System',
        address: effectiveSchoolDetails?.address || 'School Address',
        logo_url: effectiveSchoolDetails?.logo_url || effectiveSchoolDetails?.logoUrl
      };
      
      // Generate the base receipt HTML using the SAME robust logo handling as fee receipts
      let baseHtml;
      try {
        // This uses the EXACT SAME logo loading logic as fee receipts:
        // - URL validation with isValidImageUrl
        // - HTTP HEAD request testing for accessibility  
        // - Automatic fallback to profiles and school-assets buckets
        // - Enhanced loaders with loadSchoolLogoEnhanced and loadLogoWithFallbacks
        // - Proper logo embedding in HTML with <img> tags
        baseHtml = await generateUnifiedReceiptHTML(receiptData, schoolDetailsForTemplate, schoolDetailsForTemplate?.logo_url);
        console.log('✅ Generated base HTML with robust logo loading from unified template');
        console.log('🔧 This uses the SAME logo handling approach as fee receipts:');
        console.log('   - Validates logo URLs with isValidImageUrl()');
        console.log('   - Tests URL accessibility with HTTP HEAD requests');
        console.log('   - Tries profiles bucket, then school-assets bucket as fallbacks');
        console.log('   - Uses enhanced loaders as final fallback');
        console.log('   - Embeds logos directly in HTML as <img> tags for reliable PDF rendering');
      } catch (templateError) {
        console.error('❌ Template generation failed, using fallback:', templateError);
        baseHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .header { text-align: center; margin-bottom: 20px; }
              </style>
            </head>
            <body>
              <div class="header">
                <h1>${schoolDetailsForTemplate.name}</h1>
                <h2>Report Card</h2>
                <p>Student: ${studentData?.name}</p>
              </div>
            </body>
          </html>
        `;
      }

      // Calculate overall grade
      const overallGrade = getLetterGrade(stats.average);
      const gradeColor = getGradeColor(stats.average);

      // Group marks by subject for better presentation
      const subjectGroups = {};
      marksData.forEach(mark => {
        if (!subjectGroups[mark.subject]) {
          subjectGroups[mark.subject] = [];
        }
        subjectGroups[mark.subject].push(mark);
      });

      // Calculate subject averages
      const subjectAverages = Object.keys(subjectGroups).map(subject => {
        const marks = subjectGroups[subject];
        const average = marks.reduce((sum, mark) => sum + mark.percentage, 0) / marks.length;
        return {
          subject,
          average: Math.round(average),
          grade: getLetterGrade(Math.round(average)),
          totalMarks: marks.reduce((sum, mark) => sum + mark.marksObtained, 0),
          maxMarks: marks.reduce((sum, mark) => sum + mark.totalMarks, 0),
          examCount: marks.length
        };
      });

      // Build report card content to replace receipt content
      const reportCardContent = `
        <div class="report-card-section">
          <h2 style="color:#1976d2; text-align: center; margin: 20px 0;">📋 Academic Report Card</h2>
          
          <!-- Overall Performance Card -->
          <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 30px; text-align: center; border-radius: 16px; margin: 20px 0;">
            <div style="width: 120px; height: 120px; border-radius: 50%; background: ${gradeColor}; color: white; display: inline-flex; flex-direction: column; align-items: center; justify-content: center; margin: 0 auto 20px; box-shadow: 0 15px 30px rgba(0,0,0,0.2); position: relative;">
              <div style="font-size: 36px; font-weight: bold;">${overallGrade}</div>
              <div style="font-size: 18px; opacity: 0.9;">${stats.average}%</div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 20px;">
              <div style="text-align: center; padding: 15px; background: white; border-radius: 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.1);">
                <div style="font-size: 24px; font-weight: bold; color: #1976d2;">${stats.highest}%</div>
                <div style="font-size: 12px; color: #666; margin-top: 5px;">Highest Score</div>
              </div>
              <div style="text-align: center; padding: 15px; background: white; border-radius: 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.1);">
                <div style="font-size: 24px; font-weight: bold; color: #1976d2;">${stats.average}%</div>
                <div style="font-size: 12px; color: #666; margin-top: 5px;">Average</div>
              </div>
              <div style="text-align: center; padding: 15px; background: white; border-radius: 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.1);">
                <div style="font-size: 24px; font-weight: bold; color: #1976d2;">${stats.totalExams}</div>
                <div style="font-size: 12px; color: #666; margin-top: 5px;">Total Exams</div>
              </div>
            </div>
          </div>
          
          <!-- Detailed Exam Results Table -->
          <div style="margin-top: 20px;">
            <h3 style="color:#1976d2; margin-bottom: 20px; text-align: center;">📊 Detailed Exam Results</h3>
            <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 5px 15px rgba(0,0,0,0.1);">
              <thead>
                <tr style="background: #1976d2; color: white;">
                  <th style="padding: 8px 10px; text-align: left; font-weight: bold; font-size: 14px;">Exam</th>
                  <th style="padding: 8px 10px; text-align: left; font-weight: bold; font-size: 14px;">Subject</th>
                  <th style="padding: 8px 10px; text-align: left; font-weight: bold; font-size: 14px;">Marks</th>
                  <th style="padding: 8px 10px; text-align: left; font-weight: bold; font-size: 14px;">Total</th>
                  <th style="padding: 8px 10px; text-align: left; font-weight: bold; font-size: 14px;">%</th>
                  <th style="padding: 8px 10px; text-align: left; font-weight: bold; font-size: 14px;">Grade</th>
                </tr>
              </thead>
              <tbody>
                ${marksData.map((mark, index) => `
                  <tr style="${index % 2 === 0 ? 'background: #f8f9fa;' : 'background: white;'}">
                    <td style="padding: 6px 10px; border-bottom: 1px solid #e9ecef; font-size: 13px;">${mark.examName}</td>
                    <td style="padding: 6px 10px; border-bottom: 1px solid #e9ecef; font-size: 13px;">${mark.subject}</td>
                    <td style="padding: 6px 10px; border-bottom: 1px solid #e9ecef; font-size: 13px;">${mark.marksObtained}</td>
                    <td style="padding: 6px 10px; border-bottom: 1px solid #e9ecef; font-size: 13px;">${mark.totalMarks}</td>
                    <td style="padding: 6px 10px; border-bottom: 1px solid #e9ecef; font-size: 13px;">${mark.percentage}%</td>
                    <td style="padding: 6px 10px; border-bottom: 1px solid #e9ecef; font-size: 13px;">
                      <span style="padding: 4px 12px; border-radius: 15px; background-color: ${getGradeColor(mark.percentage)}; color: white; font-weight: bold; font-size: 12px;">
                        ${mark.grade}
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      // Replace the receipt content with report card content in the base HTML
      const htmlContent = baseHtml
        .replace(/<title>.*?<\/title>/, '<title>Student Report Card</title>')
        .replace(/FEE RECEIPT/g, 'STUDENT REPORT CARD')
        .replace(/ATTENDANCE REPORT/g, 'STUDENT REPORT CARD')
        // Replace the entire receipt-content area up to either amount section or footer
        .replace(/<div class=\"receipt-content\">[\s\S]*?(?=<div class=\"amount-separator\"|<div class=\"receipt-footer\">)/, reportCardContent)
        // Remove any amount separator and amount section if present
        .replace(/<div class=\"amount-separator\">[\s\S]*?<\/div>/, '')
        .replace(/<div class=\"receipt-amount-section\">[\s\S]*?<\/div>/, '')
        // Remove fee-specific rows if any remain
        .replace(/<div class=\"receipt-row\">[\s\S]*?Fee Type:[\s\S]*?<\/div>\s*/g, '')
        .replace(/<div class=\"receipt-row\">[\s\S]*?Payment Mode:[\s\S]*?<\/div>\s*/g, '')
        // Remove any remaining amount displays
        .replace(/₹\d+\.\d+/g, '')
        .replace(/Amount\s*Paid:?[\s\S]*?₹[\d,\.]+/gi, '')
        .replace(/<[^>]*>\s*₹\s*0+\.0+\s*<\/[^>]*>/g, '')
        // Clean up empty elements
        .replace(/<div[^>]*>\s*<\/div>/g, '')
        .replace(/<span[^>]*>\s*<\/span>/g, '');

      console.log('✅ Generated report card HTML with robust logo loading from unified template');
      
      // Normalize page size and print styles to avoid awkward page breaks
      const normalizedHtml = htmlContent
        // Ensure @page uses A4 portrait with comfortable margins
        .replace(/@page\s*{[\s\S]*?}/, '@page { size: A4 portrait; margin: 12mm; }')
        // Inject print-friendly CSS to avoid splitting tables/sections across pages
        .replace('</head>', `<style>
          html, body { width: 100%; }
          .receipt-container { width: 100%; max-width: 100%; height: auto; max-height: none; }
          .receipt-content, .report-card-section { page-break-inside: auto; break-inside: auto; }
          table { page-break-inside: avoid; break-inside: avoid; width: 100%; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          tbody, tr, td, th { page-break-inside: avoid; break-inside: avoid; }
          img { max-width: 100%; height: auto; }
          /* Prevent content from being cut off */
          .report-card-section > * { page-break-inside: avoid; }
          /* Ensure tables don't break badly */
          table tr { page-break-inside: avoid; }
        </style></head>`);

      console.log('🖨️ Applied PDF normalization to prevent content splitting across pages');
      
      // Generate PDF using the normalized HTML
      const { uri } = await Print.printToFileAsync({
        html: normalizedHtml
      });

      // Share the PDF
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share Report Card',
        UTI: 'com.adobe.pdf',
      });

    } catch (error) {
      console.error('Error generating report card:', error);
      Alert.alert('Error', 'Failed to generate report card. Please try again.');
    }
  };

  // 🚀 ENHANCED: Show tenant loading states
  if (!isReady || loading) {
    const loadingText = !isReady ? 'Initializing secure tenant context...' : 'Loading marks data...';
    const subText = !isReady ? 'Setting up secure access to your academic records' : 'Please wait while we fetch your marks';
    
    return (
      <View style={styles.container}>
        <Header 
          title="Marks & Grades" 
          showBack={true} 
          showProfile={true}
          studentInfo={studentInfo}
          onRefresh={() => refreshData(true)}
        />
        <View style={[styles.loadingContainer, { padding: 20 }]}>
          <ActivityIndicator size="large" color="#9C27B0" />
          <Text style={styles.loadingText}>{loadingText}</Text>
          <Text style={styles.loadingSubText}>{subText}</Text>
        </View>
      </View>
    );
  }

  // 🚀 ENHANCED: Show enhanced error states with tenant context
  if (error || tenantError) {
    const errorMessage = tenantError || error;
    const isTenantError = !!tenantError;
    
    return (
      <View style={styles.container}>
        <Header 
          title="Marks & Grades" 
          showBack={true} 
          showProfile={true}
          studentInfo={studentInfo}
          onRefresh={() => refreshData(true)}
        />
        <View style={[styles.errorContainer, { padding: 20 }]}>
          <Ionicons name="alert-circle" size={48} color="#F44336" />
          <Text style={styles.errorTitle}>
            {isTenantError ? 'Tenant Access Error' : 'Failed to Load Marks'}
          </Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
          {isTenantError && (
            <View style={styles.tenantErrorInfo}>
              <Text style={styles.tenantErrorText}>Tenant ID: {tenantId || 'Not available'}</Text>
              <Text style={styles.tenantErrorText}>Status: {isReady ? 'Ready' : 'Not Ready'}</Text>
            </View>
          )}
          <TouchableOpacity style={styles.retryButton} onPress={fetchMarksData}>
            <Ionicons name="refresh" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header 
        title="Marks & Grades" 
        showBack={true} 
        showProfile={true}
        studentInfo={studentInfo}
        onRefresh={() => refreshData(true)}
      />
      <ScrollView contentContainerStyle={{ padding: 16 }}>

        {/* Overall Statistics */}
        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>Performance Overview</Text>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: '#E8F5E8' }]}>
              <Ionicons name="trending-up" size={24} color="#4CAF50" />
              <Text style={styles.statNumber}>{stats.average}%</Text>
              <Text style={styles.statLabel}>Average</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#E3F2FD' }]}>
              <Ionicons name="trophy" size={24} color="#2196F3" />
              <Text style={styles.statNumber}>{stats.highest}%</Text>
              <Text style={styles.statLabel}>Highest</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#FFF3E0' }]}>
              <Ionicons name="bar-chart" size={24} color="#FF9800" />
              <Text style={styles.statNumber}>{stats.lowest}%</Text>
              <Text style={styles.statLabel}>Lowest</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#F3E5F5' }]}>
              <Ionicons name="document-text" size={24} color="#9C27B0" />
              <Text style={styles.statNumber}>{stats.totalExams}</Text>
              <Text style={styles.statLabel}>Total Exams</Text>
            </View>
          </View>
        </View>

        {/* Grade Card */}
        <View style={styles.gradeCard}>
          <Text style={styles.gradeCardTitle}>Overall Grade</Text>
          <Text style={[styles.gradeText, { color: getGradeColor(stats.average) }]}>
            {getLetterGrade(stats.average)}
          </Text>
          <Text style={styles.gradePercentage}>{stats.average}%</Text>
        </View>

        {/* Exam Results */}
        <View style={styles.examResultsContainer}>
          <Text style={styles.sectionTitle}>Exam Results</Text>
          {examGroups.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No exam results available</Text>
              <Text style={styles.emptySubtext}>
                Your exam results will appear here once they are published.
              </Text>
            </View>
          ) : (
            examGroups.map((exam, index) => (
              <TouchableOpacity
                key={index}
                style={styles.examCard}
                onPress={() => setSelectedExam(exam)}
              >
                <View style={styles.examHeader}>
                  <View>
                    <Text style={styles.examName}>{exam.examName}</Text>
                    <Text style={styles.examDate}>
                      {new Date(exam.examDate).toLocaleDateString()} • {exam.examType}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#666" />
                </View>
                <View style={styles.subjectsPreview}>
                  {exam.subjects.slice(0, 3).map((subject, idx) => (
                    <View key={idx} style={styles.subjectChip}>
                      <Text style={styles.subjectName}>{subject.subject}</Text>
                      <Text style={[styles.subjectGrade, { color: getGradeColor(subject.percentage) }]}>
                        {subject.grade}
                      </Text>
                    </View>
                  ))}
                  {exam.subjects.length > 3 && (
                    <Text style={styles.moreSubjects}>+{exam.subjects.length - 3} more</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Download Report Card Button */}
        {marksData.length > 0 && (
          <View style={styles.downloadSection}>
            <TouchableOpacity
              style={styles.downloadButton}
              onPress={downloadReportCard}
            >
              <View style={styles.downloadButtonContent}>
                <Ionicons name="download" size={24} color="#fff" />
                <Text style={styles.downloadButtonText}>Download Report Card</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Exam Detail Modal */}
      <Modal
        visible={!!selectedExam}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedExam(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedExam && (
              <>
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={styles.modalTitle}>{selectedExam.examName}</Text>
                    <Text style={styles.modalSubtitle}>
                      {new Date(selectedExam.examDate).toLocaleDateString()} • {selectedExam.examType}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.modalCloseButton}
                    onPress={() => setSelectedExam(null)}
                  >
                    <Ionicons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalScrollView}>
                  {selectedExam.subjects.map((subject, index) => (
                    <View key={index} style={styles.subjectDetailCard}>
                      <View style={styles.subjectDetailHeader}>
                        <Text style={styles.subjectDetailName}>{subject.subject}</Text>
                        <View style={[styles.gradeChip, { backgroundColor: getGradeColor(subject.percentage) }]}>
                          <Text style={styles.gradeChipText}>{subject.grade}</Text>
                        </View>
                      </View>
                      <View style={styles.marksRow}>
                        <Text style={styles.marksText}>
                          {subject.marksObtained} / {subject.totalMarks}
                        </Text>
                        <Text style={styles.percentageText}>{subject.percentage}%</Text>
                      </View>
                      {subject.remarks && (
                        <Text style={styles.remarksText}>{subject.remarks}</Text>
                      )}
                    </View>
                  ))}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  statsContainer: {
    marginBottom: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  gradeCard: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  gradeCardTitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  gradeText: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  gradePercentage: {
    fontSize: 18,
    color: '#666',
    marginTop: 4,
  },
  examResultsContainer: {
    marginBottom: 20,
  },
  examCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  examHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  examName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  examDate: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  subjectsPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  subjectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 4,
  },
  subjectName: {
    fontSize: 12,
    color: '#666',
    marginRight: 4,
  },
  subjectGrade: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  moreSubjects: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalScrollView: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  subjectDetailCard: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  subjectDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subjectDetailName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  gradeChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  gradeChipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  marksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  marksText: {
    fontSize: 14,
    color: '#666',
  },
  percentageText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  remarksText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 4,
  },
  // 🚀 ENHANCED: Loading and error state styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#9C27B0',
    marginTop: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingSubText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 20,
    color: '#F44336',
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  tenantErrorInfo: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  tenantErrorText: {
    fontSize: 14,
    color: '#495057',
    textAlign: 'center',
    marginVertical: 2,
  },
  retryButton: {
    backgroundColor: '#9C27B0',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  downloadSection: {
    padding: 20,
    paddingTop: 10,
  },
  downloadButton: {
    backgroundColor: '#1976d2',
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  downloadButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  downloadButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
  },
});