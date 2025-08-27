import React from 'react';
import { Platform, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

const CrossPlatformDatePicker = ({
  value,
  onChange,
  mode = 'date',
  display = 'default',
  maximumDate,
  minimumDate,
  style,
  placeholder = 'Select Date',
  label,
  testID,
  disabled = false,
  showIcon = true,
  textStyle,
  containerStyle,
  ...props
}) => {
  // Format date for display
  const formatDate = (date) => {
    if (!date) return '';
    if (typeof date === 'string') return date;
    
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return '';
      
      if (mode === 'date') {
        return d.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      } else if (mode === 'time') {
        return d.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        });
      } else {
        return d.toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    } catch (error) {
      console.error('Date formatting error:', error);
      return '';
    }
  };

  // Convert date to HTML5 input format
  const formatDateForInput = (date) => {
    if (!date) return '';
    
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return '';
      
      if (mode === 'date') {
        return d.toISOString().split('T')[0]; // YYYY-MM-DD
      } else if (mode === 'time') {
        return d.toTimeString().slice(0, 5); // HH:MM
      } else {
        return d.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
      }
    } catch (error) {
      console.error('Date input formatting error:', error);
      return '';
    }
  };

  // Handle web input change
  const handleWebChange = (event) => {
    const inputValue = event.target.value;
    if (!inputValue) {
      onChange && onChange(null, null);
      return;
    }

    try {
      let newDate;
      if (mode === 'time') {
        // For time mode, create a date with today's date and the selected time
        const today = new Date();
        const [hours, minutes] = inputValue.split(':');
        newDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), parseInt(hours), parseInt(minutes));
      } else {
        newDate = new Date(inputValue);
      }
      
      if (!isNaN(newDate.getTime())) {
        // Simulate the mobile DateTimePicker event structure
        const syntheticEvent = {
          type: 'set',
          nativeEvent: { timestamp: newDate.getTime() }
        };
        onChange && onChange(syntheticEvent, newDate);
      }
    } catch (error) {
      console.error('Date parsing error:', error);
    }
  };

  // Web version using HTML5 input
  if (Platform.OS === 'web') {
    const inputType = mode === 'date' ? 'date' : mode === 'time' ? 'time' : 'datetime-local';
    
    return (
      <View style={[styles.webContainer, containerStyle]}>
        {label && <Text style={styles.label}>{label}</Text>}
        <View style={[styles.webInputContainer, style, disabled && styles.disabled]}>
          {showIcon && (
            <Ionicons 
              name={mode === 'time' ? 'time' : 'calendar'} 
              size={20} 
              color={disabled ? '#ccc' : '#666'} 
              style={styles.webIcon}
            />
          )}
          <input
            type={inputType}
            value={formatDateForInput(value)}
            onChange={handleWebChange}
            disabled={disabled}
            min={minimumDate ? formatDateForInput(minimumDate) : undefined}
            max={maximumDate ? formatDateForInput(maximumDate) : undefined}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: 16,
              color: disabled ? '#ccc' : '#333',
              backgroundColor: 'transparent',
              fontFamily: 'inherit',
              padding: '8px 4px',
              ...textStyle
            }}
            placeholder={placeholder}
            {...props}
          />
        </View>
      </View>
    );
  }

  // Mobile version using DateTimePicker
  // This should be used with a TouchableOpacity trigger
  return (
    <DateTimePicker
      testID={testID}
      value={value || new Date()}
      mode={mode}
      display={display}
      onChange={onChange}
      maximumDate={maximumDate}
      minimumDate={minimumDate}
      {...props}
    />
  );
};

// Helper component for mobile date picker button
export const DatePickerButton = ({
  value,
  onPress,
  placeholder = 'Select Date',
  style,
  textStyle,
  disabled = false,
  showIcon = true,
  mode = 'date',
  label,
  containerStyle
}) => {
  const formatDate = (date) => {
    if (!date) return placeholder;
    if (typeof date === 'string') return date;
    
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return placeholder;
      
      if (mode === 'date') {
        return d.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      } else if (mode === 'time') {
        return d.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        });
      } else {
        return d.toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    } catch (error) {
      return placeholder;
    }
  };

  return (
    <View style={[styles.mobileContainer, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity
        style={[styles.mobileButton, style, disabled && styles.disabled]}
        onPress={disabled ? undefined : onPress}
      >
        <Text style={[
          styles.mobileButtonText,
          !value && styles.placeholderText,
          textStyle,
          disabled && styles.disabledText
        ]}>
          {formatDate(value)}
        </Text>
        {showIcon && (
          <Ionicons 
            name={mode === 'time' ? 'time' : 'calendar'} 
            size={20} 
            color={disabled ? '#ccc' : '#666'} 
          />
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  webContainer: {
    marginBottom: 16,
  },
  mobileContainer: {
    marginBottom: 16,
  },
  webInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    minHeight: 48,
  },
  webIcon: {
    marginRight: 8,
  },
  mobileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 14,
    minHeight: 48,
  },
  mobileButtonText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  placeholderText: {
    color: '#999',
  },
  disabledText: {
    color: '#ccc',
  },
  disabled: {
    backgroundColor: '#f5f5f5',
    opacity: 0.6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
});

export default CrossPlatformDatePicker;
