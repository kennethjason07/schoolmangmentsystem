import React from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  StyleSheet,
  Platform,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const isTablet = width >= 768;

const StudentListHeader = ({
  teacherStats,
  students,
  searchQuery,
  setSearchQuery,
  selectedClass,
  setSelectedClass,
  classes,
  filteredStudents,
  handleExportPDF,
  scrollSettings
}) => {
  return (
    <View style={styles.headerContainer}>
      {/* Teacher Role Summary */}
      {students.length > 0 && (
        <View style={styles.summarySection}>
          <Text style={styles.summaryTitle}>Your Students</Text>
          <View style={styles.summaryCards}>
            <View style={styles.summaryCard}>
              <View style={[styles.summaryIcon, { backgroundColor: '#4CAF50' }]}>
                <Ionicons name="school" size={20} color="#fff" />
              </View>
              <Text style={styles.summaryNumber}>
                {teacherStats.classTeacherCount}
              </Text>
              <Text style={styles.summaryLabel}>Class Teacher</Text>
            </View>
            <View style={styles.summaryCard}>
              <View style={[styles.summaryIcon, { backgroundColor: '#2196F3' }]}>
                <Ionicons name="book" size={20} color="#fff" />
              </View>
              <Text style={styles.summaryNumber}>
                {teacherStats.subjectTeacherCount}
              </Text>
              <Text style={styles.summaryLabel}>Subject Teacher</Text>
            </View>
            <View style={styles.summaryCard}>
              <View style={[styles.summaryIcon, { backgroundColor: '#FF9800' }]}>
                <Ionicons name="people" size={20} color="#fff" />
              </View>
              <Text style={styles.summaryNumber}>{teacherStats.totalStudents}</Text>
              <Text style={styles.summaryLabel}>Total Students</Text>
            </View>
          </View>
        </View>
      )}

      {/* Search and Filter */}
      <View style={styles.searchSection}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search students..."
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
        
        <View style={styles.filterContainer}>
          <Text style={styles.filterLabel}>Class:</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={isWeb ? true : false}
            style={styles.filterScrollView}
            contentContainerStyle={styles.filterScrollContent}
          >
            {classes.map(cls => (
              <TouchableOpacity
                key={cls}
                style={[
                  styles.filterButton,
                  selectedClass === cls && styles.selectedFilterButton
                ]}
                onPress={() => setSelectedClass(cls)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.filterButtonText,
                  selectedClass === cls && styles.selectedFilterButtonText
                ]}>
                  {cls}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* Export Section */}
      {filteredStudents.length > 0 && (
        <View style={styles.exportSection}>
          <TouchableOpacity
            style={styles.modernExportButton}
            onPress={handleExportPDF}
            activeOpacity={0.8}
          >
            <View style={styles.exportIconContainer}>
              <Ionicons name="document-text" size={24} color="#fff" />
            </View>
            <View style={styles.exportTextContainer}>
              <Text style={styles.exportTitle}>Export PDF Report</Text>
              <Text style={styles.exportSubtitle}>
                Download {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''} data
              </Text>
            </View>
            <View style={styles.exportArrowContainer}>
              <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.8)" />
            </View>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: '#f8f9fa'
  },

  // Summary Section Styles
  summarySection: {
    margin: 16,
    marginBottom: 12,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 16,
    textAlign: 'center'
  },
  summaryCards: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center'
  },
  summaryCard: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 8
  },
  summaryIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500'
  },

  // Search Section Styles
  searchSection: {
    marginHorizontal: 16,
    marginBottom: 12
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  searchIcon: {
    marginRight: 12
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 0
  },
  filterContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12
  },
  filterScrollView: {
    flexGrow: 0
  },
  filterScrollContent: {
    paddingRight: 16
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minWidth: 60,
    alignItems: 'center'
  },
  selectedFilterButton: {
    backgroundColor: '#1976d2',
    borderColor: '#1976d2'
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500'
  },
  selectedFilterButtonText: {
    color: '#fff',
    fontWeight: '600'
  },

  // Export Section Styles
  exportSection: {
    marginHorizontal: 16,
    marginBottom: 12
  },
  modernExportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1976d2',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6
  },
  exportIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16
  },
  exportTextContainer: {
    flex: 1
  },
  exportTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4
  },
  exportSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)'
  },
  exportArrowContainer: {
    marginLeft: 8
  }
});

export default StudentListHeader;
