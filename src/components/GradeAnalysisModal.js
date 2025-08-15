import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const GradeAnalysisModal = ({ visible, onClose, stats, onCopyAnalysis }) => {
  if (!stats || !stats.gradeDistribution) {
    return null;
  }

  const totalStudents = stats.gradeDistribution.reduce((sum, grade) => sum + grade.population, 0);

  const getGradeColor = (gradeName) => {
    if (gradeName.includes('A')) return '#4CAF50';
    if (gradeName.includes('B')) return '#8BC34A';
    if (gradeName.includes('C')) return '#FF9800';
    if (gradeName.includes('D')) return '#FF5722';
    return '#f44336';
  };

  const getGradeIcon = (gradeName) => {
    if (gradeName.includes('A')) return 'trophy';
    if (gradeName.includes('B')) return 'ribbon';
    if (gradeName.includes('C')) return 'medal';
    if (gradeName.includes('D')) return 'warning';
    return 'alert-circle';
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View style={styles.fullScreenContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Ionicons name="bar-chart" size={24} color="#2196F3" />
              <Text style={styles.title}>Grade Distribution Analysis</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Performance Summary */}
            <View style={styles.summarySection}>
              <Text style={styles.sectionTitle}>📊 Performance Overview</Text>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryCard}>
                  <Text style={[styles.summaryValue, { color: '#2196F3' }]}>
                    {totalStudents}
                  </Text>
                  <Text style={styles.summaryLabel}>Total Students</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>
                    {stats.averagePercentage}%
                  </Text>
                  <Text style={styles.summaryLabel}>Average Performance</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={[styles.summaryValue, { color: '#FF9800' }]}>
                    {stats.highestScore}%
                  </Text>
                  <Text style={styles.summaryLabel}>Highest Score</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={[styles.summaryValue, { color: '#f44336' }]}>
                    {stats.lowestScore}%
                  </Text>
                  <Text style={styles.summaryLabel}>Lowest Score</Text>
                </View>
              </View>
            </View>

            {/* Grade Distribution */}
            <View style={styles.gradeSection}>
              <Text style={styles.sectionTitle}>🎯 Grade Distribution</Text>
              <View style={styles.gradeGrid}>
                {stats.gradeDistribution.map((grade, index) => {
                  const percentage = totalStudents > 0 ? Math.round((grade.population / totalStudents) * 100) : 0;
                  const color = getGradeColor(grade.name);
                  const icon = getGradeIcon(grade.name);

                  return (
                    <View key={index} style={[styles.gradeCard, { borderColor: color }]}>
                      <View style={[styles.gradeIconContainer, { backgroundColor: color }]}>
                        <Ionicons name={icon} size={20} color="#fff" />
                      </View>
                      <View style={styles.gradeInfo}>
                        <Text style={[styles.gradeName, { color }]}>{grade.name}</Text>
                        <Text style={styles.gradeCount}>{grade.population} students</Text>
                        <Text style={styles.gradePercentage}>{percentage}% of total</Text>
                      </View>
                      <View style={styles.gradeVisual}>
                        <View style={styles.progressBarContainer}>
                          <View 
                            style={[
                              styles.progressBar, 
                              { width: `${percentage}%`, backgroundColor: color }
                            ]} 
                          />
                        </View>
                        <Text style={[styles.percentageText, { color }]}>{percentage}%</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Performance Insights */}
            <View style={styles.insightsSection}>
              <Text style={styles.sectionTitle}>💡 Performance Insights</Text>
              <View style={styles.insightsList}>
                <View style={styles.insightCard}>
                  <Ionicons name="trending-up" size={20} color="#4CAF50" />
                  <View style={styles.insightContent}>
                    <Text style={styles.insightTitle}>Excellent Performance</Text>
                    <Text style={styles.insightText}>
                      {stats.gradeDistribution.find(g => g.name.includes('A'))?.population || 0} students achieved Grade A
                    </Text>
                  </View>
                </View>

                <View style={styles.insightCard}>
                  <Ionicons name="analytics" size={20} color="#2196F3" />
                  <View style={styles.insightContent}>
                    <Text style={styles.insightTitle}>Class Average</Text>
                    <Text style={styles.insightText}>
                      Overall class performance is {stats.averagePercentage}%
                    </Text>
                  </View>
                </View>

                <View style={[styles.insightCard, styles.lastInsightCard]}>
                  <Ionicons name="school" size={20} color="#FF9800" />
                  <View style={styles.insightContent}>
                    <Text style={styles.insightTitle}>Score Range</Text>
                    <Text style={styles.insightText}>
                      Scores range from {stats.lowestScore}% to {stats.highestScore}%
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.copyButton]}
              onPress={onCopyAnalysis}
            >
              <Ionicons name="copy" size={16} color="#2196F3" />
              <Text style={styles.copyButtonText}>Copy Analysis</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.closeActionButton]}
              onPress={onClose}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    marginTop: 20,
    marginBottom: 20,
    borderRadius: 15,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        paddingTop: StatusBar.currentHeight || 50,
      },
      android: {
        paddingTop: StatusBar.currentHeight || 25,
      },
    }),
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginLeft: 10,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  summarySection: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  summaryCard: {
    width: '48%',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },
  gradeSection: {
    marginBottom: 25,
  },
  gradeGrid: {
    gap: 12,
  },
  gradeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 12,
    borderWidth: 2,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 4,
  },
  gradeIconContainer: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  gradeInfo: {
    flex: 1,
  },
  gradeName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 3,
  },
  gradeCount: {
    fontSize: 15,
    color: '#333',
    marginBottom: 3,
  },
  gradePercentage: {
    fontSize: 13,
    color: '#666',
  },
  gradeVisual: {
    alignItems: 'flex-end',
    minWidth: 80,
  },
  progressBarContainer: {
    width: 60,
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    marginBottom: 5,
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  percentageText: {
    fontSize: 14,
    fontWeight: '600',
  },
  insightsSection: {
    marginBottom: 20,
  },
  insightsList: {
    gap: 12,
  },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  insightContent: {
    marginLeft: 12,
    flex: 1,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 3,
  },
  insightText: {
    fontSize: 14,
    color: '#666',
  },
  actions: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 20,
    gap: 15,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  copyButton: {
    backgroundColor: '#e3f2fd',
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  copyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2196F3',
    marginLeft: 8,
  },
  closeActionButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  closeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  lastInsightCard: {
    marginBottom: 25,
  },
});

export default GradeAnalysisModal;
