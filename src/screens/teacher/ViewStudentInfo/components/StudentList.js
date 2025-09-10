import React from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  StyleSheet,
  RefreshControl,
  Modal,
  Platform,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const isTablet = width >= 768;

const StudentList = ({
  filteredStudents,
  openModal,
  selectedStudent,
  modalVisible,
  closeModal,
  refreshing,
  onRefresh,
  searchQuery,
  scrollSettings
}) => {
  return (
    <View style={styles.listContainer}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        {...scrollSettings}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#FF9800']}
            progressBackgroundColor="#fff"
            tintColor="#FF9800"
            titleColor="#1976d2"
            title="Pull to refresh student data"
          />
        }
      >
        {/* Content wrapper with padding for better scrolling */}
        <View style={styles.contentWrapper}>
          {/* Students List */}
          {filteredStudents.length === 0 ? (
            <View style={styles.noDataContainer}>
              <Ionicons name="people-outline" size={48} color="#ccc" />
              <Text style={styles.noDataText}>No students found</Text>
              <Text style={styles.noDataSubtext}>
                {searchQuery ? 'Try adjusting your search' : 'No students assigned to your classes'}
              </Text>
            </View>
          ) : (
            <View style={styles.studentListWrapper}>
              {filteredStudents.map((student, index) => (
                <TouchableOpacity
                  key={student.id}
                  style={[
                    styles.studentCard,
                    isWeb && styles.studentCardWeb,
                    index === filteredStudents.length - 1 && styles.lastStudentCard
                  ]}
                  onPress={() => openModal(student)}
                  activeOpacity={0.8}
                >
                  <View style={styles.studentHeader}>
                    <View style={styles.studentInfo}>
                      <View style={styles.studentNameRow}>
                        <Text style={styles.studentName}>{student.name}</Text>
                        {student.gender && (
                          <View style={[
                            styles.genderBadge, 
                            { backgroundColor: student.gender === 'Male' ? '#2196F3' : '#E91E63' }
                          ]}>
                            <Text style={styles.genderText}>
                              {student.gender === 'Male' ? 'M' : 'F'}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.studentDetails}>
                        Roll: {student.roll_no} | {student.classSection}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#666" />
                  </View>
                  
                  <View style={styles.studentStats}>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>Admission No</Text>
                      <Text style={styles.statValue}>{student.admission_no || 'N/A'}</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>Parent</Text>
                      <Text style={styles.statValue}>{student.parents?.name || 'N/A'}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
              
              {/* Add some bottom padding for better scrolling */}
              <View style={styles.bottomPadding} />
            </View>
          )}
        </View>
      </ScrollView>

      {/* Student Detail Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
        presentationStyle={isWeb ? "overFullScreen" : "pageSheet"}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isWeb && styles.modalContentWeb]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Student Details</Text>
              <TouchableOpacity 
                onPress={closeModal}
                style={styles.closeButton}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={24} color="#1976d2" />
              </TouchableOpacity>
            </View>
            
            {selectedStudent && (
              <ScrollView 
                style={styles.modalBody} 
                showsVerticalScrollIndicator={isWeb}
                contentContainerStyle={styles.modalScrollContent}
              >
                {/* Personal Information Section */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailTitle}>Personal Information</Text>
                  
                  <View style={styles.detailGrid}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Name:</Text>
                      <Text style={styles.detailValue}>{selectedStudent.name}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Roll No:</Text>
                      <Text style={styles.detailValue}>{selectedStudent.roll_no}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Class:</Text>
                      <Text style={styles.detailValue}>{selectedStudent.classSection}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Admission No:</Text>
                      <Text style={styles.detailValue}>{selectedStudent.admission_no || 'N/A'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Date of Birth:</Text>
                      <Text style={styles.detailValue}>{selectedStudent.dob || 'N/A'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Gender:</Text>
                      <Text style={styles.detailValue}>{selectedStudent.gender || 'N/A'}</Text>
                    </View>
                  </View>
                </View>

                {/* Parent Information Section */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailTitle}>Parent Information</Text>
                  
                  {selectedStudent.parents ? (
                    <View style={styles.parentSection}>
                      <View style={styles.parentHeader}>
                        <Ionicons 
                          name={selectedStudent.parents.relation === 'Father' ? 'man' : 
                                selectedStudent.parents.relation === 'Mother' ? 'woman' : 'person'} 
                          size={20} 
                          color="#1976d2" 
                        />
                        <Text style={styles.parentRelationTitle}>
                          {selectedStudent.parents.relation || 'Parent'}
                        </Text>
                      </View>
                      
                      <View style={styles.detailGrid}>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Name:</Text>
                          <Text style={styles.detailValue}>{selectedStudent.parents.name || 'N/A'}</Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Phone:</Text>
                          <Text style={styles.detailValue}>{selectedStudent.parents.phone || 'N/A'}</Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Email:</Text>
                          <Text style={styles.detailValue}>{selectedStudent.parents.email || 'N/A'}</Text>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.noParentInfo}>
                      <Ionicons name="people-outline" size={48} color="#ccc" />
                      <Text style={styles.noParentText}>No parent information available</Text>
                    </View>
                  )}
                </View>

                {/* Address Section */}
                {selectedStudent.address && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailTitle}>Address</Text>
                    <Text style={styles.addressText}>{selectedStudent.address}</Text>
                  </View>
                )}

                {/* Add some bottom padding for modal scrolling */}
                <View style={styles.modalBottomPadding} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  listContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa'
  },
  scrollView: {
    flex: 1
  },
  scrollViewContent: {
    flexGrow: 1,
    ...(isWeb && {
      minHeight: '100%'
    })
  },
  contentWrapper: {
    paddingHorizontal: 16,
    paddingTop: 8
  },

  // No Data Styles
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  noDataText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8
  },
  noDataSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingHorizontal: 40
  },

  // Student List Styles
  studentListWrapper: {
    paddingBottom: 20
  },
  studentCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0'
  },
  studentCardWeb: {
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
    borderColor: '#e8e8e8'
  },
  lastStudentCard: {
    marginBottom: 32
  },
  studentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  studentInfo: {
    flex: 1
  },
  studentNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6
  },
  studentName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1
  },
  genderBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8
  },
  genderText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff'
  },
  studentDetails: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500'
  },
  studentStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0'
  },
  statItem: {
    flex: 1,
    alignItems: 'center'
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
    fontWeight: '500'
  },
  statValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    textAlign: 'center'
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.85,
    paddingBottom: isWeb ? 20 : 0
  },
  modalContentWeb: {
    maxWidth: Math.min(600, width * 0.9),
    alignSelf: 'center',
    borderRadius: 20,
    marginTop: 50,
    marginBottom: 50,
    maxHeight: height * 0.8
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1976d2'
  },
  closeButton: {
    padding: 4
  },
  modalBody: {
    flex: 1
  },
  modalScrollContent: {
    paddingBottom: 20
  },

  // Detail Section Styles
  detailSection: {
    margin: 20,
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8'
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 16,
    textAlign: 'center'
  },
  detailGrid: {
    gap: 12
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0'
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
    flex: 1
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right'
  },

  // Parent Section Styles
  parentSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e8e8e8'
  },
  parentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  parentRelationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976d2',
    marginLeft: 8
  },
  noParentInfo: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#fff',
    borderRadius: 12
  },
  noParentText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
    textAlign: 'center'
  },

  // Address Styles
  addressText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e8e8e8'
  },

  // Padding Styles
  bottomPadding: {
    height: 40
  },
  modalBottomPadding: {
    height: 20
  }
});

export default StudentList;
