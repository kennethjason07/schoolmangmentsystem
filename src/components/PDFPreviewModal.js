import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const PDFPreviewModal = ({ 
  visible, 
  onClose, 
  data, 
  stats, 
  title = "PDF Preview",
  onDownload 
}) => {
  const [loading, setLoading] = React.useState(false);
  
  const handleDownload = async () => {
    if (onDownload) {
      setLoading(true);
      await onDownload();
      setLoading(false);
    }
  };
  
  const renderPreviewContent = () => {
    if (!data || !stats) return null;
    
    const currentDate = new Date().toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return (
      <ScrollView style={styles.contentScrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.documentHeader}>
          <Text style={styles.schoolName}>ABC School</Text>
          <Text style={styles.reportTitle}>Academic Performance Report</Text>
          <Text style={styles.reportDate}>Generated on {currentDate}</Text>
        </View>

        {/* Performance Summary */}
        <View style={styles.summarySection}>
          <View style={styles.sectionHeaderInline}>
            <Ionicons name="bar-chart" size={18} color="#2196F3" />
            <Text style={styles.sectionTitleInline}>Performance Overview</Text>
          </View>
          
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={[styles.summaryValue, { color: '#2196F3' }]}>{stats.totalStudents}</Text>
              <Text style={styles.summaryLabel}>Total Students</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>{stats.averagePercentage}%</Text>
              <Text style={styles.summaryLabel}>Average</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={[styles.summaryValue, { color: '#FF9800' }]}>{stats.highestScore}%</Text>
              <Text style={styles.summaryLabel}>Highest</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={[styles.summaryValue, { color: '#f44336' }]}>{stats.lowestScore}%</Text>
              <Text style={styles.summaryLabel}>Lowest</Text>
            </View>
          </View>
        </View>

        {/* Grade Distribution */}
        <View style={styles.gradeSection}>
          <View style={styles.sectionHeaderInline}>
            <Ionicons name="pie-chart" size={18} color="#2196F3" />
            <Text style={styles.sectionTitleInline}>Grade Distribution</Text>
          </View>
          
          <View style={styles.gradeGrid}>
            {stats.gradeDistribution.map((grade, index) => {
              const totalStudents = stats.gradeDistribution.reduce((sum, g) => sum + g.population, 0);
              const percentage = totalStudents > 0 ? Math.round((grade.population / totalStudents) * 100) : 0;
              
              const gradeColors = {
                'A+': '#4CAF50', 'A': '#8BC34A', 'B': '#FF9800', 
                'C': '#FF5722', 'D': '#f44336', 'F': '#757575'
              };
              
              const color = gradeColors[grade.name] || '#757575';
              
              return (
                <View key={index} style={[styles.gradeCard, { borderColor: color }]}>
                  <Text style={[styles.gradeName, { color }]}>{grade.name}</Text>
                  <Text style={styles.gradeCount}>{grade.population}</Text>
                  <Text style={styles.gradePercentage}>{percentage}%</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Subject Performance */}
        {stats.subjectPerformance && stats.subjectPerformance.length > 0 && (
          <View style={styles.subjectSection}>
            <View style={styles.sectionHeaderInline}>
              <Ionicons name="book" size={18} color="#2196F3" />
              <Text style={styles.sectionTitleInline}>Subject Performance</Text>
            </View>
            
            {stats.subjectPerformance.slice(0, 5).map((subject, index) => {
              const performanceColor = subject.percentage >= 90 ? '#4CAF50' : 
                                      subject.percentage >= 80 ? '#8BC34A' : 
                                      subject.percentage >= 70 ? '#FF9800' : 
                                      subject.percentage >= 60 ? '#FF5722' : '#f44336';
              
              return (
                <View key={index} style={styles.subjectItem}>
                  <Text style={styles.subjectName}>{subject.subject}</Text>
                  <Text style={[styles.subjectPerformance, { color: performanceColor }]}>
                    {subject.percentage}%
                  </Text>
                </View>
              );
            })}
            {stats.subjectPerformance.length > 5 && (
              <Text style={styles.moreText}>+ {stats.subjectPerformance.length - 5} more subjects</Text>
            )}
          </View>
        )}

        {/* Top Performers */}
        {stats.topPerformers && stats.topPerformers.length > 0 && (
          <View style={styles.performersSection}>
            <View style={styles.sectionHeaderInline}>
              <Ionicons name="trophy" size={18} color="#2196F3" />
              <Text style={styles.sectionTitleInline}>Top Performers</Text>
            </View>
            
            {stats.topPerformers.slice(0, 3).map((performer, index) => {
              const scoreColor = performer.percentage >= 90 ? '#4CAF50' : 
                                performer.percentage >= 80 ? '#8BC34A' : 
                                performer.percentage >= 70 ? '#FF9800' : '#f44336';
              
              return (
                <View key={index} style={styles.performerItem}>
                  <View style={styles.performerRank}>
                    <Text style={styles.rankText}>{index + 1}</Text>
                  </View>
                  <View style={styles.performerInfo}>
                    <Text style={styles.performerName}>{performer.name}</Text>
                    <Text style={styles.performerDetails}>#{performer.admissionNo}</Text>
                  </View>
                  <Text style={[styles.performerScore, { color: scoreColor }]}>{performer.percentage}%</Text>
                </View>
              );
            })}
            {stats.topPerformers.length > 3 && (
              <Text style={styles.moreText}>+ {stats.topPerformers.length - 3} more students</Text>
            )}
          </View>
        )}
        
        <View style={styles.footerPreview}>
          <Text style={styles.footerText}>📄 This is a preview of your PDF report</Text>
          <Text style={styles.footerSubText}>The actual PDF will contain all data and enhanced formatting</Text>
        </View>
      </ScrollView>
    );
  };
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Ionicons name="document-text" size={24} color="#2196F3" />
              <Text style={styles.title}>{title}</Text>
            </View>
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={onClose}
              disabled={loading}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Preview Content */}
          <View style={styles.previewContainer}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>📄 Document Preview</Text>
              <Text style={styles.previewSubtitle}>
                This is how your PDF report will look
              </Text>
            </View>
            
            <View style={styles.webviewContainer}>
              {data && stats ? (
                renderPreviewContent()
              ) : (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#2196F3" />
                  <Text style={styles.loadingText}>Preparing preview...</Text>
                </View>
              )}
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={loading}
            >
              <Ionicons name="close-circle" size={16} color="#666" />
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.generateButton]}
              onPress={handleDownload}
              disabled={loading}
            >
              {loading ? (
                <>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.generateButtonText}>Downloading...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="download" size={16} color="#fff" />
                  <Text style={styles.generateButtonText}>Download PDF</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Info Banner */}
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle" size={16} color="#2196F3" />
            <Text style={styles.infoText}>
              The actual PDF may appear slightly different due to formatting optimizations
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '95%',
    height: '90%',
    maxWidth: 600,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginLeft: 10,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  previewContainer: {
    flex: 1,
    padding: 20,
    paddingBottom: 10,
  },
  previewHeader: {
    marginBottom: 15,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  previewSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  webviewContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f9f9f9',
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 15,
    paddingBottom: 10,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginLeft: 8,
  },
  generateButton: {
    backgroundColor: '#2196F3',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  generateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    padding: 12,
    margin: 20,
    marginTop: 0,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  infoText: {
    fontSize: 12,
    color: '#1976D2',
    marginLeft: 8,
    flex: 1,
  },
  // Preview content styles
  contentScrollView: {
    flex: 1,
    padding: 15,
  },
  documentHeader: {
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: '#2196F3',
  },
  schoolName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 5,
  },
  reportTitle: {
    fontSize: 16,
    color: '#1976D2',
    marginBottom: 3,
  },
  reportDate: {
    fontSize: 12,
    color: '#666',
  },
  summarySection: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  sectionHeaderInline: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitleInline: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2196F3',
    marginLeft: 5,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  summaryCard: {
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
    minWidth: 65,
    margin: 3,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  summaryLabel: {
    fontSize: 9,
    color: '#666',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  gradeSection: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  gradeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  gradeCard: {
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    minWidth: 50,
    margin: 3,
    borderWidth: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  gradeName: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  gradeCount: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
    color: '#333',
  },
  gradePercentage: {
    fontSize: 9,
    color: '#666',
  },
  subjectSection: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  subjectItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  subjectName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  subjectPerformance: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  performersSection: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  performerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  performerRank: {
    backgroundColor: '#2196F3',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  rankText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  performerInfo: {
    flex: 1,
  },
  performerName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
  },
  performerDetails: {
    fontSize: 10,
    color: '#666',
    marginTop: 1,
  },
  performerScore: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  moreText: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  footerPreview: {
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: 'bold',
    marginBottom: 3,
  },
  footerSubText: {
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
  },
});

export default PDFPreviewModal;
