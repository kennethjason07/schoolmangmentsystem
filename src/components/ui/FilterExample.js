import React, { useState } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { FilterBar, FilterSection, Card } from './index';
import Colors from '../../constants/Colors';
import Theme from '../../constants/Theme';

const FilterExample = () => {
  const [selectedClass, setSelectedClass] = useState('All');
  const [selectedDateRange, setSelectedDateRange] = useState('today');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Sample data - replace with your actual data
  const classOptions = [
    { label: 'All Classes', value: 'All' },
    { label: 'Class 1-A', value: '1A' },
    { label: 'Class 1-B', value: '1B' },
    { label: 'Class 2-A', value: '2A' },
    { label: 'Class 2-B', value: '2B' },
    { label: 'Class 3-A', value: '3A' },
    { label: 'Class 3-B', value: '3B' },
  ];

  const dateRangeOptions = [
    { label: 'Today', value: 'today' },
    { label: 'This Week', value: 'week' },
    { label: 'This Month', value: 'month' },
    { label: 'Last Month', value: 'lastMonth' },
    { label: 'Custom Range', value: 'custom' },
  ];

  const statusOptions = [
    { label: 'All Status', value: 'all' },
    { label: 'Present', value: 'present' },
    { label: 'Absent', value: 'absent' },
    { label: 'Late', value: 'late' },
  ];

  const handleFilterChange = (filterKey, value, option) => {
    console.log('Filter changed:', filterKey, value, option);
    
    switch (filterKey) {
      case 'class':
        setSelectedClass(value);
        break;
      case 'dateRange':
        setSelectedDateRange(value);
        break;
      case 'status':
        setSelectedStatus(value);
        break;
    }
  };

  // Example 1: Compact horizontal scrollable filter bar
  const compactFilters = [
    {
      key: 'class',
      label: 'Class',
      value: selectedClass,
      displayValue: classOptions.find(opt => opt.value === selectedClass)?.label || 'All Classes',
      icon: 'school',
      options: classOptions,
      searchable: true,
    },
    {
      key: 'dateRange', 
      label: 'Period',
      value: selectedDateRange,
      displayValue: dateRangeOptions.find(opt => opt.value === selectedDateRange)?.label || 'Today',
      icon: 'calendar',
      options: dateRangeOptions,
    },
    {
      key: 'status',
      label: 'Status',
      value: selectedStatus,
      displayValue: statusOptions.find(opt => opt.value === selectedStatus)?.label || 'All',
      icon: 'checkmark-circle',
      options: statusOptions,
      isActive: selectedStatus !== 'all',
    },
  ];

  // Example 2: Organized filter sections
  const attendanceFilters = [
    {
      key: 'class',
      label: 'Class',
      value: selectedClass,
      displayValue: classOptions.find(opt => opt.value === selectedClass)?.label || 'All Classes',
      icon: 'school',
      options: classOptions,
      searchable: true,
    },
    {
      key: 'status',
      label: 'Status',
      value: selectedStatus,
      displayValue: statusOptions.find(opt => opt.value === selectedStatus)?.label || 'All',
      icon: 'checkmark-circle',
      options: statusOptions,
      isActive: selectedStatus !== 'all',
    },
  ];

  const timeFilters = [
    {
      key: 'dateRange',
      label: 'Period',
      value: selectedDateRange,
      displayValue: dateRangeOptions.find(opt => opt.value === selectedDateRange)?.label || 'Today',
      icon: 'calendar',
      options: dateRangeOptions,
    },
  ];

  return (
    <ScrollView style={styles.container}>
      {/* Example 1: Single Compact Filter Bar */}
      <Card style={styles.section}>
        <FilterBar
          filters={compactFilters}
          onFilterChange={handleFilterChange}
          variant="compact"
          scrollable={true}
        />
      </Card>

      {/* Example 2: Organized Filter Sections */}
      <View style={styles.section}>
        <FilterSection
          title="Attendance Filters"
          filters={attendanceFilters}
          onFilterChange={handleFilterChange}
          variant="default"
          collapsible={true}
        />

        <FilterSection
          title="Time Period"
          filters={timeFilters}
          onFilterChange={handleFilterChange}
          variant="compact"
          collapsible={true}
          defaultCollapsed={false}
        />
      </View>

      {/* Example 3: Replace Old Bulky Filters */}
      <Card style={styles.section}>
        {/* OLD WAY (commented out - this is what you want to replace):
        
        <View style={oldStyles.filtersSection}>
          <Text style={oldStyles.sectionTitle}>Filters</Text>
          
          <View style={oldStyles.filterRow}>
            <View style={oldStyles.filterItem}>
              <Text style={oldStyles.filterLabel}>Class</Text>
              <View style={oldStyles.pickerContainer}>
                <Picker
                  selectedValue={selectedClass}
                  onValueChange={setSelectedClass}
                  style={oldStyles.picker} // This was taking 50px height!
                >
                  {classOptions.map((option) => (
                    <Picker.Item key={option.value} label={option.label} value={option.value} />
                  ))}
                </Picker>
              </View>
            </View>
            
            <View style={oldStyles.filterItem}>
              <Text style={oldStyles.filterLabel}>Date Range</Text>
              <View style={oldStyles.pickerContainer}>
                <Picker
                  selectedValue={selectedDateRange}
                  onValueChange={setSelectedDateRange}
                  style={oldStyles.picker} // Another 50px height!
                >
                  {dateRangeOptions.map((option) => (
                    <Picker.Item key={option.value} label={option.label} value={option.value} />
                  ))}
                </Picker>
              </View>
            </View>
          </View>
        </View>
        
        */}

        {/* NEW WAY - Much more compact! */}
        <FilterBar
          filters={compactFilters}
          onFilterChange={handleFilterChange}
          variant="default" // Only 36px height per chip vs 50px + padding per picker!
          scrollable={true}
        />
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  section: {
    margin: Theme.Spacing.base,
  },
});

// These are the old bulky styles you can replace:
const oldStyles = StyleSheet.create({
  filtersSection: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16, // 16px padding
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16, // 16px margin
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12, // 12px margin
  },
  filterItem: {
    flex: 1,
    marginHorizontal: 4, // 8px total horizontal margin
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8, // 8px margin
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  picker: {
    height: 50, // BULKY! 50px height per picker
    color: '#333',
  },
  // Total height per filter row: 16 + 18 + 16 + 14 + 8 + 50 + 12 = 134px
  // New filter chips: just 36px + minimal margins = ~45px total
  // Space saved: ~89px per filter section!
});

export default FilterExample;
