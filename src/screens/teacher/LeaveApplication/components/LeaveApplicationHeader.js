import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const isTablet = width >= 768;

const LeaveApplicationHeader = ({
  onApplyPress,
  scrollSettings
}) => {
  return (
    <View style={styles.headerContainer}>
      {/* Apply Leave Button */}
      <View style={styles.actionSection}>
        <TouchableOpacity
          style={[
            styles.applyButton,
            isWeb && styles.applyButtonWeb
          ]}
          onPress={onApplyPress}
          activeOpacity={0.8}
        >
          <View style={styles.applyButtonIconContainer}>
            <Ionicons name="add-circle" size={24} color="#FFFFFF" />
          </View>
          <View style={styles.applyButtonTextContainer}>
            <Text style={styles.applyButtonText}>Apply for Leave</Text>
            <Text style={styles.applyButtonSubtext}>Submit a new leave request</Text>
          </View>
          <View style={styles.applyButtonArrow}>
            <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.8)" />
          </View>
        </TouchableOpacity>
      </View>

      {/* Section Title */}
      <View style={styles.sectionTitleContainer}>
        <View style={styles.titleIconContainer}>
          <Ionicons name="document-text" size={20} color="#1976d2" />
        </View>
        <Text style={styles.sectionTitle}>My Leave Applications</Text>
        <View style={styles.titleDivider} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: '#F5F5F5',
    paddingBottom: 8
  },

  // Action Section Styles
  actionSection: {
    marginHorizontal: 16,
    marginVertical: 12
  },
  applyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6
  },
  applyButtonWeb: {
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8
  },
  applyButtonIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16
  },
  applyButtonTextContainer: {
    flex: 1
  },
  applyButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 2
  },
  applyButtonSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)'
  },
  applyButtonArrow: {
    marginLeft: 8
  },

  // Section Title Styles
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12
  },
  titleIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1
  },
  titleDivider: {
    height: 2,
    backgroundColor: '#1976d2',
    width: 30,
    borderRadius: 1,
    marginLeft: 8
  }
});

export default LeaveApplicationHeader;
