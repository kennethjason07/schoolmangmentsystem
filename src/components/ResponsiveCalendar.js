import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform, Dimensions, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Get screen dimensions for responsive design
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const ResponsiveCalendar = ({ 
  value, 
  onDateChange, 
  minimumDate, 
  maximumDate, 
  placeholder = "Select Date",
  mode = "date", // "date", "datetime", "time"
  visible,
  onClose
}) => {
  const [selectedDate, setSelectedDate] = useState(value ? new Date(value) : new Date());
  const [currentMonth, setCurrentMonth] = useState(value ? new Date(value) : new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // Update selectedDate when value prop changes
  useEffect(() => {
    if (value) {
      const newDate = new Date(value);
      setSelectedDate(newDate);
      setCurrentMonth(new Date(newDate.getFullYear(), newDate.getMonth(), 1));
    }
  }, [value]);

  // Handle visibility from parent component
  useEffect(() => {
    if (visible !== undefined) {
      setShowCalendar(visible);
    }
  }, [visible]);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const formatDate = (date) => {
    if (!date) return placeholder;
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const isDateDisabled = (date) => {
    if (minimumDate && date < minimumDate) return true;
    if (maximumDate && date > maximumDate) return true;
    return false;
  };

  const isSameDay = (date1, date2) => {
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
  };

  const isToday = (date) => {
    return isSameDay(date, new Date());
  };

  const navigateMonth = (direction) => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(currentMonth.getMonth() + direction);
    setCurrentMonth(newMonth);
  };

  const generateYearRange = () => {
    const currentYear = new Date().getFullYear();
    const minYear = minimumDate ? minimumDate.getFullYear() : currentYear - 100;
    const maxYear = maximumDate ? maximumDate.getFullYear() : currentYear + 10;
    const years = [];
    for (let year = maxYear; year >= minYear; year--) {
      years.push(year);
    }
    return years;
  };

  const onYearSelect = (year) => {
    const newMonth = new Date(year, currentMonth.getMonth(), 1);
    setCurrentMonth(newMonth);
    setShowYearPicker(false);
  };

  const onMonthSelect = (monthIndex) => {
    const newMonth = new Date(currentMonth.getFullYear(), monthIndex, 1);
    setCurrentMonth(newMonth);
    setShowMonthPicker(false);
  };

  const onDatePress = (day) => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    
    if (isDateDisabled(newDate)) return;
    
    setSelectedDate(newDate);
    onDateChange && onDateChange(newDate);
    handleClose();
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      setShowCalendar(false);
    }
  };

  const handleOpen = () => {
    if (visible !== undefined) {
      // Controlled by parent - trigger parent to open
      // The parent should manage the visibility
      return;
    }
    setShowCalendar(true);
  };

  const renderCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const days = [];

    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(
        <View key={`empty-${i}`} style={styles.dayCell} />
      );
    }

    // Actual days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const isSelected = selectedDate && isSameDay(date, selectedDate);
      const isCurrentDay = isToday(date);
      const disabled = isDateDisabled(date);

      days.push(
        <TouchableOpacity
          key={day}
          style={[
            styles.dayCell,
            isSelected && styles.selectedDay,
            isCurrentDay && !isSelected && styles.todayDay,
            disabled && styles.disabledDay
          ]}
          onPress={() => onDatePress(day)}
          disabled={disabled}
        >
          <Text style={[
            styles.dayText,
            isSelected && styles.selectedDayText,
            isCurrentDay && !isSelected && styles.todayDayText,
            disabled && styles.disabledDayText
          ]}>
            {day}
          </Text>
        </TouchableOpacity>
      );
    }

    return days;
  };

  const renderYearPicker = () => {
    const years = generateYearRange();
    const currentYear = currentMonth.getFullYear();
    
    return (
      <Modal
        visible={showYearPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowYearPicker(false)}
      >
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Year</Text>
              <TouchableOpacity
                onPress={() => setShowYearPicker(false)}
                style={styles.pickerCloseButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerScrollView}>
              {years.map((year) => (
                <TouchableOpacity
                  key={year}
                  style={[
                    styles.pickerItem,
                    year === currentYear && styles.pickerItemSelected
                  ]}
                  onPress={() => onYearSelect(year)}
                >
                  <Text style={[
                    styles.pickerItemText,
                    year === currentYear && styles.pickerItemTextSelected
                  ]}>
                    {year}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const renderMonthPicker = () => {
    const currentMonthIndex = currentMonth.getMonth();
    
    return (
      <Modal
        visible={showMonthPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMonthPicker(false)}
      >
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Month</Text>
              <TouchableOpacity
                onPress={() => setShowMonthPicker(false)}
                style={styles.pickerCloseButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerScrollView}>
              {months.map((month, index) => (
                <TouchableOpacity
                  key={month}
                  style={[
                    styles.pickerItem,
                    index === currentMonthIndex && styles.pickerItemSelected
                  ]}
                  onPress={() => onMonthSelect(index)}
                >
                  <Text style={[
                    styles.pickerItemText,
                    index === currentMonthIndex && styles.pickerItemTextSelected
                  ]}>
                    {month}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const renderCalendar = () => (
    <View style={styles.calendarContainer}>
      {/* Calendar Header */}
      <View style={styles.calendarHeader}>
        <TouchableOpacity 
          style={styles.navButton} 
          onPress={() => navigateMonth(-1)}
        >
          <Ionicons name="chevron-back" size={24} color="#2196F3" />
        </TouchableOpacity>
        
        <View style={styles.monthYearContainer}>
          <TouchableOpacity 
            style={styles.monthYearButton}
            onPress={() => setShowMonthPicker(true)}
          >
            <Text style={styles.monthYearText}>
              {months[currentMonth.getMonth()]}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#2196F3" style={styles.dropdownIcon} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.monthYearButton}
            onPress={() => setShowYearPicker(true)}
          >
            <Text style={styles.monthYearText}>
              {currentMonth.getFullYear()}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#2196F3" style={styles.dropdownIcon} />
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity 
          style={styles.navButton} 
          onPress={() => navigateMonth(1)}
        >
          <Ionicons name="chevron-forward" size={24} color="#2196F3" />
        </TouchableOpacity>
      </View>

      {/* Week Days Header */}
      <View style={styles.weekDaysContainer}>
        {weekDays.map((day) => (
          <View key={day} style={styles.weekDayCell}>
            <Text style={styles.weekDayText}>{day}</Text>
          </View>
        ))}
      </View>

      {/* Calendar Grid */}
      <View style={styles.calendarGrid}>
        {renderCalendarDays()}
      </View>

      {/* Action Buttons */}
      <View style={styles.calendarActions}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.todayButton]} 
          onPress={() => {
            const today = new Date();
            if (!isDateDisabled(today)) {
              setSelectedDate(today);
              setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
              onDateChange && onDateChange(today);
              handleClose();
            }
          }}
        >
          <Text style={styles.todayButtonText}>Today</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.cancelButton]} 
          onPress={handleClose}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.confirmButton]} 
          onPress={() => {
            onDateChange && onDateChange(selectedDate);
            handleClose();
          }}
        >
          <Text style={styles.confirmButtonText}>Confirm</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // For web, show calendar inline or in modal based on screen size
  if (Platform.OS === 'web') {
    const isSmallScreen = screenWidth < 768;

    if (visible !== undefined) {
      // Controlled by parent - always show in modal
      return (
        <Modal
          visible={showCalendar}
          transparent={true}
          animationType="fade"
          onRequestClose={handleClose}
        >
          <View style={styles.webModalOverlay}>
            <View style={[
              styles.webModalContent,
              isSmallScreen && styles.webModalContentSmall
            ]}>
              {renderCalendar()}
              {renderYearPicker()}
              {renderMonthPicker()}
            </View>
          </View>
        </Modal>
      );
    }

    // Self-managed visibility
    return (
      <View style={styles.webContainer}>
        <TouchableOpacity
          style={styles.webDateInput}
          onPress={handleOpen}
        >
          <Text style={[
            styles.webDateText,
            !selectedDate && styles.webPlaceholderText
          ]}>
            {formatDate(selectedDate)}
          </Text>
          <Ionicons name="calendar-outline" size={20} color="#666" />
        </TouchableOpacity>

        <Modal
          visible={showCalendar}
          transparent={true}
          animationType="fade"
          onRequestClose={handleClose}
        >
          <View style={styles.webModalOverlay}>
            <View style={[
              styles.webModalContent,
              isSmallScreen && styles.webModalContentSmall
            ]}>
              {renderCalendar()}
              {renderYearPicker()}
              {renderMonthPicker()}
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // For mobile, return the date input (mobile will use native date picker)
  return (
    <TouchableOpacity
      style={styles.mobileContainer}
      onPress={handleOpen}
    >
      <Text style={[
        styles.mobileDateText,
        !selectedDate && styles.mobilePlaceholderText
      ]}>
        {formatDate(selectedDate)}
      </Text>
      <Ionicons name="calendar-outline" size={20} color="#666" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // Web Container
  webContainer: {
    width: '100%',
  },
  webDateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    minHeight: 48,
  },
  webDateText: {
    fontSize: 16,
    color: '#333',
  },
  webPlaceholderText: {
    color: '#999',
  },

  // Mobile Container
  mobileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    minHeight: 48,
  },
  mobileDateText: {
    fontSize: 16,
    color: '#333',
  },
  mobilePlaceholderText: {
    color: '#999',
  },

  // Web Modal
  webModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  webModalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 0,
    maxWidth: 400,
    width: '100%',
    maxHeight: '80%',
    ...Platform.select({
      web: {
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
      },
    }),
  },
  webModalContentSmall: {
    maxWidth: '95%',
    margin: 10,
  },

  // Calendar Container
  calendarContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },

  // Calendar Header
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  navButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        ':hover': {
          backgroundColor: '#f0f0f0',
        },
      },
    }),
  },
  monthYearContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  monthYearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        ':hover': {
          backgroundColor: '#f5f5f5',
        },
      },
    }),
  },
  monthYearText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginRight: 4,
  },
  dropdownIcon: {
    marginLeft: 4,
  },

  // Week Days
  weekDaysContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    paddingVertical: 12,
  },
  weekDayCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
  },

  // Calendar Grid
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  dayCell: {
    width: `${100/7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  dayText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  selectedDay: {
    backgroundColor: '#2196F3',
    borderRadius: 20,
  },
  selectedDayText: {
    color: '#fff',
    fontWeight: '600',
  },
  todayDay: {
    backgroundColor: '#e3f2fd',
    borderRadius: 20,
  },
  todayDayText: {
    color: '#2196F3',
    fontWeight: '600',
  },
  disabledDay: {
    opacity: 0.3,
  },
  disabledDayText: {
    color: '#ccc',
  },

  // Action Buttons
  calendarActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#f8f9fa',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  todayButton: {
    backgroundColor: '#6c757d',
  },
  todayButtonText: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 14,
  },
  cancelButton: {
    backgroundColor: '#6c757d',
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 14,
  },
  confirmButton: {
    backgroundColor: '#2196F3',
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },

  // Year/Month Picker Styles
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: 280,
    maxHeight: 400,
    ...Platform.select({
      web: {
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
      },
    }),
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    backgroundColor: '#f8f9fa',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  pickerCloseButton: {
    padding: 4,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  pickerScrollView: {
    maxHeight: 300,
  },
  pickerItem: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        ':hover': {
          backgroundColor: '#f8f9fa',
        },
      },
    }),
  },
  pickerItemSelected: {
    backgroundColor: '#e3f2fd',
  },
  pickerItemText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  pickerItemTextSelected: {
    color: '#2196F3',
    fontWeight: '600',
  },
});

export default ResponsiveCalendar;
