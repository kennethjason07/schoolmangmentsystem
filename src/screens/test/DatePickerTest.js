import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, ScrollView, Alert } from 'react-native';
import CrossPlatformDatePicker, { DatePickerButton } from '../../components/CrossPlatformDatePicker';
import Header from '../../components/Header';

const DatePickerTest = ({ navigation }) => {
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [birthDate, setBirthDate] = useState(null);
  const [appointmentTime, setAppointmentTime] = useState(new Date());
  const [showMobilePicker, setShowMobilePicker] = useState(false);
  const [pickerType, setPickerType] = useState('start');

  const handleDateChange = (type, event, date) => {
    console.log(`Date changed for ${type}:`, { event, date });
    
    if (Platform.OS !== 'web') {
      setShowMobilePicker(false);
    }
    
    if (date) {
      switch (type) {
        case 'start':
          setStartDate(date);
          break;
        case 'end':
          setEndDate(date);
          break;
        case 'birth':
          setBirthDate(date);
          break;
        case 'appointment':
          setAppointmentTime(date);
          break;
      }
    }
  };

  const formatDate = (date) => {
    if (!date) return 'Not selected';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (date) => {
    if (!date) return 'Not selected';
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateTime = (date) => {
    if (!date) return 'Not selected';
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const showResults = () => {
    Alert.alert('Selected Dates', 
      `Start Date: ${formatDate(startDate)}\n` +
      `End Date: ${formatDate(endDate)}\n` +
      `Birth Date: ${formatDate(birthDate)}\n` +
      `Appointment: ${formatTime(appointmentTime)}`
    );
  };

  return (
    <View style={styles.container}>
      <Header 
        title="Date Picker Test" 
        showBack={true} 
        onBack={() => navigation.goBack()} 
      />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            CrossPlatformDatePicker Test ({Platform.OS})
          </Text>
          <Text style={styles.description}>
            This screen tests the CrossPlatformDatePicker component which uses native HTML5 date inputs on web and DateTimePicker on mobile.
          </Text>
        </View>

        {/* Web Version - Direct Integration */}
        {Platform.OS === 'web' && (
          <View style={styles.section}>
            <Text style={styles.subtitle}>Web Version (HTML5 Inputs)</Text>
            
            <CrossPlatformDatePicker
              label="Start Date"
              value={startDate}
              onChange={(event, date) => handleDateChange('start', event, date)}
              mode="date"
              placeholder="Select Start Date"
              containerStyle={styles.datePickerContainer}
            />
            
            <CrossPlatformDatePicker
              label="End Date"
              value={endDate}
              onChange={(event, date) => handleDateChange('end', event, date)}
              mode="date"
              placeholder="Select End Date"
              containerStyle={styles.datePickerContainer}
            />
            
            <CrossPlatformDatePicker
              label="Birth Date (Optional)"
              value={birthDate}
              onChange={(event, date) => handleDateChange('birth', event, date)}
              mode="date"
              placeholder="Select Birth Date"
              maximumDate={new Date()}
              minimumDate={new Date(1900, 0, 1)}
              containerStyle={styles.datePickerContainer}
            />
            
            <CrossPlatformDatePicker
              label="Appointment Time"
              value={appointmentTime}
              onChange={(event, date) => handleDateChange('appointment', event, date)}
              mode="time"
              placeholder="Select Time"
              containerStyle={styles.datePickerContainer}
            />
          </View>
        )}

        {/* Mobile Version - Button Triggers */}
        {Platform.OS !== 'web' && (
          <View style={styles.section}>
            <Text style={styles.subtitle}>Mobile Version (DateTimePicker)</Text>
            
            <DatePickerButton
              label="Start Date"
              value={startDate}
              onPress={() => {
                setPickerType('start');
                setShowMobilePicker(true);
              }}
              placeholder="Select Start Date"
              mode="date"
              containerStyle={styles.datePickerContainer}
            />
            
            <DatePickerButton
              label="End Date"
              value={endDate}
              onPress={() => {
                setPickerType('end');
                setShowMobilePicker(true);
              }}
              placeholder="Select End Date"
              mode="date"
              containerStyle={styles.datePickerContainer}
            />
            
            <DatePickerButton
              label="Birth Date (Optional)"
              value={birthDate}
              onPress={() => {
                setPickerType('birth');
                setShowMobilePicker(true);
              }}
              placeholder="Select Birth Date"
              mode="date"
              containerStyle={styles.datePickerContainer}
            />
            
            <DatePickerButton
              label="Appointment Time"
              value={appointmentTime}
              onPress={() => {
                setPickerType('appointment');
                setShowMobilePicker(true);
              }}
              placeholder="Select Time"
              mode="time"
              containerStyle={styles.datePickerContainer}
            />
          </View>
        )}

        {/* Results Section */}
        <View style={styles.section}>
          <Text style={styles.subtitle}>Current Values</Text>
          <View style={styles.resultsContainer}>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Start Date:</Text>
              <Text style={styles.resultValue}>{formatDate(startDate)}</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>End Date:</Text>
              <Text style={styles.resultValue}>{formatDate(endDate)}</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Birth Date:</Text>
              <Text style={styles.resultValue}>{formatDate(birthDate)}</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Appointment:</Text>
              <Text style={styles.resultValue}>{formatDateTime(appointmentTime)}</Text>
            </View>
          </View>
        </View>

        {/* Mobile Date Picker */}
        {Platform.OS !== 'web' && showMobilePicker && (
          <CrossPlatformDatePicker
            value={
              pickerType === 'start' ? startDate :
              pickerType === 'end' ? endDate :
              pickerType === 'birth' ? (birthDate || new Date()) :
              appointmentTime
            }
            mode={pickerType === 'appointment' ? 'time' : 'date'}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, date) => handleDateChange(pickerType, event, date)}
            maximumDate={pickerType === 'birth' ? new Date() : new Date(2030, 11, 31)}
            minimumDate={pickerType === 'birth' ? new Date(1900, 0, 1) : new Date(2020, 0, 1)}
          />
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  datePickerContainer: {
    marginBottom: 8,
  },
  resultsContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  resultLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  resultValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '400',
  },
});

export default DatePickerTest;
