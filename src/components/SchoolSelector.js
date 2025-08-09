import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSchool } from '../contexts/SchoolContext';
import Colors from '../constants/Colors';

const SchoolSelector = ({ style }) => {
  const {
    selectedSchool,
    userSchools,
    switchSchool,
    loading
  } = useSchool();

  const [modalVisible, setModalVisible] = useState(false);
  const [switching, setSwitching] = useState(false);

  const handleSchoolSwitch = async (schoolId) => {
    if (schoolId === selectedSchool?.id) {
      setModalVisible(false);
      return;
    }

    try {
      setSwitching(true);
      await switchSchool(schoolId);
      setModalVisible(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to switch school. Please try again.');
    } finally {
      setSwitching(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, style]}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }

  if (!selectedSchool || userSchools.length === 0) {
    return null;
  }

  // Don't show selector if user only has access to one school
  if (userSchools.length === 1) {
    return (
      <View style={[styles.container, styles.singleSchool, style]}>
        <Ionicons name="school" size={16} color={Colors.primary} />
        <Text style={styles.schoolName} numberOfLines={1}>
          {selectedSchool.name}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={styles.selector}
        onPress={() => setModalVisible(true)}
        disabled={switching}
      >
        <View style={styles.selectedSchool}>
          <Ionicons name="school" size={16} color={Colors.primary} />
          <Text style={styles.schoolName} numberOfLines={1}>
            {selectedSchool.name}
          </Text>
          {selectedSchool.school_code && (
            <Text style={styles.schoolCode}>({selectedSchool.school_code})</Text>
          )}
        </View>
        {switching ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : (
          <Ionicons name="chevron-down" size={16} color={Colors.text} />
        )}
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select School</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={userSchools}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.schoolOption,
                    item.id === selectedSchool?.id && styles.selectedOption
                  ]}
                  onPress={() => handleSchoolSwitch(item.id)}
                  disabled={switching}
                >
                  <View style={styles.schoolInfo}>
                    <View style={styles.schoolNameContainer}>
                      <Text style={styles.schoolOptionName}>
                        {item.name}
                      </Text>
                      {item.school_code && (
                        <Text style={styles.schoolOptionCode}>
                          {item.school_code}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.roleText}>
                      {item.role_in_school}
                    </Text>
                    {item.is_primary_school && (
                      <Text style={styles.primaryText}>Primary</Text>
                    )}
                  </View>
                  {item.id === selectedSchool?.id && (
                    <Ionicons name="checkmark" size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  singleSchool: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.lightGray,
    borderRadius: 8,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.lightGray,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  selectedSchool: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  schoolName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginLeft: 8,
    flex: 1,
  },
  schoolCode: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  closeButton: {
    padding: 4,
  },
  schoolOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  selectedOption: {
    backgroundColor: Colors.primary + '10',
  },
  schoolInfo: {
    flex: 1,
  },
  schoolNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  schoolOptionName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
  },
  schoolOptionCode: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginLeft: 8,
  },
  roleText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  primaryText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500',
  },
});

export default SchoolSelector;
