import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import ResponsiveCalendar from './ResponsiveCalendar';

const CalendarDemo = () => {
  const [selectedDate1, setSelectedDate1] = useState('');
  const [selectedDate2, setSelectedDate2] = useState('');
  const [selectedDate3, setSelectedDate3] = useState('');
  const [showCalendar1, setShowCalendar1] = useState(false);
  const [showCalendar2, setShowCalendar2] = useState(false);
  const [showCalendar3, setShowCalendar3] = useState(false);

  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return 'No date selected';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { 
        weekday: 'long',
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📅 Responsive Calendar Demo</Text>
        <Text style={styles.subtitle}>
          {Platform.OS === 'web' ? 
            'Web version with custom calendar interface' : 
            'Mobile version with native date picker'
          }
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎂 Date of Birth</Text>
        <Text style={styles.description}>
          Select your date of birth (restricted to past dates)
        </Text>
        <Text style={styles.highlight}>
          💡 Click on the month or year in the calendar header for easy selection!
        </Text>
        
        <ResponsiveCalendar
          value={selectedDate1}
          onDateChange={(date) => {
            const formattedDate = date.toISOString().split('T')[0];
            setSelectedDate1(formattedDate);
          }}
          maximumDate={new Date()} // No future dates
          minimumDate={new Date(new Date().getFullYear() - 100, 0, 1)} // 100 years ago
          placeholder="Select your date of birth"
          visible={showCalendar1}
          onClose={() => setShowCalendar1(false)}
        />
        
        <View style={styles.resultContainer}>
          <Text style={styles.resultLabel}>Selected:</Text>
          <Text style={styles.resultText}>{formatDisplayDate(selectedDate1)}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎯 Event Date</Text>
        <Text style={styles.description}>
          Select a future event date (restricted to future dates)
        </Text>
        
        <ResponsiveCalendar
          value={selectedDate2}
          onDateChange={(date) => {
            const formattedDate = date.toISOString().split('T')[0];
            setSelectedDate2(formattedDate);
          }}
          minimumDate={new Date()} // No past dates
          maximumDate={new Date(new Date().getFullYear() + 5, 11, 31)} // 5 years ahead
          placeholder="Select event date"
          visible={showCalendar2}
          onClose={() => setShowCalendar2(false)}
        />
        
        <View style={styles.resultContainer}>
          <Text style={styles.resultLabel}>Selected:</Text>
          <Text style={styles.resultText}>{formatDisplayDate(selectedDate2)}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📅 Any Date</Text>
        <Text style={styles.description}>
          Select any date with no restrictions
        </Text>
        
        <ResponsiveCalendar
          value={selectedDate3}
          onDateChange={(date) => {
            const formattedDate = date.toISOString().split('T')[0];
            setSelectedDate3(formattedDate);
          }}
          placeholder="Select any date"
          visible={showCalendar3}
          onClose={() => setShowCalendar3(false)}
        />
        
        <View style={styles.resultContainer}>
          <Text style={styles.resultLabel}>Selected:</Text>
          <Text style={styles.resultText}>{formatDisplayDate(selectedDate3)}</Text>
        </View>
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>✨ Features</Text>
        <View style={styles.featureList}>
          <Text style={styles.featureItem}>📱 Responsive design for web and mobile</Text>
          <Text style={styles.featureItem}>🚫 Date restrictions (min/max)</Text>
          <Text style={styles.featureItem}>🗓️ Easy month/year selection dropdowns</Text>
          <Text style={styles.featureItem}>⏰ Quick year jumping for birth dates</Text>
          <Text style={styles.featureItem}>📍 Today highlighting</Text>
          <Text style={styles.featureItem}>⚡ Fast date selection</Text>
          <Text style={styles.featureItem}>🎨 Clean, modern interface</Text>
          <Text style={styles.featureItem}>🔄 Smart year range based on restrictions</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    paddingVertical: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
      },
      default: {
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
    }),
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
      },
      default: {
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
    }),
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  resultContainer: {
    marginTop: 15,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  resultLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resultText: {
    fontSize: 16,
    color: '#333',
    marginTop: 4,
    fontWeight: '500',
  },
  infoSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 30,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
      },
      default: {
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
    }),
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  featureList: {
    paddingLeft: 10,
  },
  featureItem: {
    fontSize: 16,
    color: '#444',
    marginBottom: 8,
    lineHeight: 24,
  },
  highlight: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginBottom: 15,
    textAlign: 'center',
  },
});

export default CalendarDemo;
