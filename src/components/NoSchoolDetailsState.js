import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const NoSchoolDetailsState = ({ onPress, showButton = true, compact = false }) => {
  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactContent}>
          <Ionicons name="business-outline" size={24} color="#999" />
          <View style={styles.compactTextContainer}>
            <Text style={styles.compactTitle}>No School Details</Text>
            <Text style={styles.compactSubtitle}>Add your institution details</Text>
          </View>
        </View>
        {showButton && onPress && (
          <TouchableOpacity style={styles.compactButton} onPress={onPress}>
            <Ionicons name="add" size={16} color="#2196F3" />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name="business-outline" size={48} color="#ccc" />
      </View>
      <Text style={styles.title}>No School Details Added</Text>
      <Text style={styles.subtitle}>
        Add your institution details to personalize your dashboard and display school information.
      </Text>
      {showButton && onPress && (
        <TouchableOpacity style={styles.button} onPress={onPress} activeOpacity={0.7}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.buttonText}>Add School Details</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginVertical: 10,
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Compact styles for dashboard headers
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
  },
  compactContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  compactTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  compactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  compactSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  compactButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default NoSchoolDetailsState;
