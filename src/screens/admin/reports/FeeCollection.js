import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Dimensions,
  FlatList,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import Header from '../../../components/Header';
import ExportModal from '../../../components/ExportModal';
import { supabase, TABLES } from '../../../utils/supabase';
import { exportFeeData, EXPORT_FORMATS } from '../../../utils/exportUtils';
import { getCurrentUserTenantByEmail } from '../../../utils/getTenantByEmail';
import { PieChart, BarChart } from 'react-native-chart-kit';
import CrossPlatformDatePicker, { DatePickerButton } from '../../../components/CrossPlatformDatePicker';

const { width: screenWidth } = Dimensions.get('window');

const FeeCollection = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feeData, setFeeData] = useState([]);
  const [feeStructureData, setFeeStructureData] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  
  // Filter states
  const [selectedClass, setSelectedClass] = useState('All');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('2024-25');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState('All');
  const [selectedDateRange, setSelectedDateRange] = useState('thisMonth');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Statistics
  const [stats, setStats] = useState({
    totalCollected: 0,
    totalOutstanding: 0,
    totalExpected: 0,
    collectionRate: 0,
    monthlyCollection: [],
    paymentModeDistribution: [],
    classWiseCollection: [],
    recentPayments: [],
  });

  const academicYears = ['2024-25', '2023-24', '2022-23'];
  const paymentStatuses = ['All', 'Paid', 'Pending', 'Partial'];
  const dateRangeOptions = [
    { key: 'today', label: 'Today' },
    { key: 'thisWeek', label: 'This Week' },
    { key: 'thisMonth', label: 'This Month' },
    { key: 'thisYear', label: 'This Year' },
    { key: 'custom', label: 'Custom Range' },
  ];

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!loading) {
      loadFeeData();
    }
  }, [selectedClass, selectedAcademicYear, selectedPaymentStatus, selectedDateRange, startDate, endDate]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadClasses(),
        loadStudents(),
        loadFeeStructure(),
      ]);
      await loadFeeData();
    } catch (error) {
      console.error('Error loading initial data:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadClasses = async () => {
    try {
      // Get current tenant for proper filtering
      const tenantResult = await getCurrentUserTenantByEmail();
      
      if (!tenantResult.success) {
        throw new Error(`Failed to get tenant: ${tenantResult.error}`);
      }
      
      const tenantId = tenantResult.data.tenant.id;
      
      const { data, error } = await supabase
        .from(TABLES.CLASSES)
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('academic_year', selectedAcademicYear)
        .order('class_name');

      if (error) throw error;
      setClasses(data || []);
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  };

  const loadStudents = async () => {
    try {
      // Get current tenant for proper filtering
      const tenantResult = await getCurrentUserTenantByEmail();
      
      if (!tenantResult.success) {
        throw new Error(`Failed to get tenant: ${tenantResult.error}`);
      }
      
      const tenantId = tenantResult.data.tenant.id;
      
      let query = supabase
        .from(TABLES.STUDENTS)
        .select(`
          *,
          classes(id, class_name, section)
        `)
        .eq('tenant_id', tenantId)
        .eq('academic_year', selectedAcademicYear);

      if (selectedClass !== 'All') {
        query = query.eq('class_id', selectedClass);
      }

      const { data, error } = await query;
      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Error loading students:', error);
    }
  };

  const loadFeeStructure = async () => {
    try {
      // Get current tenant for proper filtering
      const tenantResult = await getCurrentUserTenantByEmail();
      
      if (!tenantResult.success) {
        throw new Error(`Failed to get tenant: ${tenantResult.error}`);
      }
      
      const tenantId = tenantResult.data.tenant.id;
      
      let query = supabase
        .from(TABLES.FEE_STRUCTURE)
        .select(`
          *,
          classes(id, class_name, section),
          students(id, name, admission_no)
        `)
        .eq('tenant_id', tenantId)
        .eq('academic_year', selectedAcademicYear);

      if (selectedClass !== 'All') {
        query = query.eq('class_id', selectedClass);
      }

      const { data, error } = await query;
      if (error) throw error;
      setFeeStructureData(data || []);
    } catch (error) {
      console.error('Error loading fee structure:', error);
    }
  };

  const getDateRange = () => {
    const today = new Date();
    let start, end;

    switch (selectedDateRange) {
      case 'today':
        start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        break;
      case 'thisWeek':
        // Calculate start of week (Sunday)
        const dayOfWeek = today.getDay();
        start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOfWeek);
        end = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOfWeek + 6);
        break;
      case 'thisMonth':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case 'thisYear':
        start = new Date(today.getFullYear(), 0, 1);
        end = new Date(today.getFullYear(), 11, 31);
        break;
      case 'custom':
        start = startDate;
        end = endDate;
        break;
      default:
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    }

    // Ensure we have valid dates
    if (!start || isNaN(start.getTime())) {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
    }
    if (!end || isNaN(end.getTime())) {
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    }

    return { start, end };
  };

  const loadFeeData = async () => {
    try {
      const { start, end } = getDateRange();

      // Ensure dates are valid
      if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) {
        console.error('Invalid date range:', { start, end });
        return;
      }

      // Get current tenant for proper filtering
      const tenantResult = await getCurrentUserTenantByEmail();
      
      if (!tenantResult.success) {
        throw new Error(`Failed to get tenant: ${tenantResult.error}`);
      }
      
      const tenantId = tenantResult.data.tenant.id;

      let query = supabase
        .from(TABLES.STUDENT_FEES)
        .select(`
          *,
          students(id, name, admission_no, class_id, classes(id, class_name, section))
        `)
        .eq('tenant_id', tenantId)
        .eq('academic_year', selectedAcademicYear)
        .gte('payment_date', start.toISOString().split('T')[0])
        .lte('payment_date', end.toISOString().split('T')[0])
        .order('payment_date', { ascending: false });

      // Apply class filter
      if (selectedClass !== 'All') {
        query = query.eq('students.class_id', selectedClass);
      }

      const { data, error } = await query;
      if (error) throw error;

      setFeeData(data || []);
      calculateStatistics(data || []);
    } catch (error) {
      console.error('Error loading fee data:', error);
    }
  };

  const calculateStatistics = (data) => {
    // Calculate total collected
    const totalCollected = data.reduce((sum, fee) => sum + (parseFloat(fee.amount_paid) || 0), 0);

    // Calculate expected amount from fee structure
    const totalExpected = feeStructureData.reduce((sum, structure) => sum + (parseFloat(structure.amount) || 0), 0);

    // Calculate outstanding
    const totalOutstanding = totalExpected - totalCollected;

    // Calculate collection rate
    const collectionRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;

    // Calculate monthly collection for chart
    const monthlyData = {};
    data.forEach(fee => {
      const month = new Date(fee.payment_date).toLocaleDateString('en-IN', { month: 'short' });
      monthlyData[month] = (monthlyData[month] || 0) + parseFloat(fee.amount_paid);
    });

    const monthlyCollection = Object.entries(monthlyData)
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => new Date(`1 ${a.month} 2024`) - new Date(`1 ${b.month} 2024`));

    // Calculate payment mode distribution
    const paymentModes = {};
    data.forEach(fee => {
      const mode = fee.payment_mode || 'Unknown';
      paymentModes[mode] = (paymentModes[mode] || 0) + 1;
    });

    const paymentModeDistribution = Object.entries(paymentModes).map(([mode, count]) => ({
      name: mode,
      population: count,
      color: getPaymentModeColor(mode),
      legendFontColor: '#333',
      legendFontSize: 12,
    }));

    // Calculate class-wise collection
    const classData = {};
    data.forEach(fee => {
      const className = `${fee.students?.classes?.class_name} ${fee.students?.classes?.section}`;
      if (!classData[className]) {
        classData[className] = { collected: 0, count: 0 };
      }
      classData[className].collected += parseFloat(fee.amount_paid) || 0;
      classData[className].count++;
    });

    const classWiseCollection = Object.entries(classData)
      .map(([className, stats]) => ({
        className,
        collected: stats.collected,
        count: stats.count,
        average: Math.round(stats.collected / stats.count)
      }))
      .sort((a, b) => b.collected - a.collected);

    setStats({
      totalCollected,
      totalOutstanding,
      totalExpected,
      collectionRate,
      monthlyCollection,
      paymentModeDistribution,
      classWiseCollection,
      recentPayments: data.slice(0, 10),
    });
  };

  const getPaymentModeColor = (mode) => {
    const colors = {
      'Cash': '#4CAF50',
      'Card': '#2196F3',
      'Online': '#9C27B0',
      'UPI': '#FF9800',
      'Unknown': '#666'
    };
    return colors[mode] || '#666';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFeeData();
    setRefreshing(false);
  };

  const handleDateChange = (event, selectedDate, type) => {
    if (type === 'start') {
      setShowStartDatePicker(false);
      if (selectedDate) {
        setStartDate(selectedDate);
      }
    } else {
      setShowEndDatePicker(false);
      if (selectedDate) {
        setEndDate(selectedDate);
      }
    }
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const handleExport = async (format) => {
    try {
      const success = await exportFeeData(feeData, stats, format);
      return success;
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Export Error', 'Failed to export fee collection report.');
      return false;
    }
  };

  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'Paid': return '#4CAF50';
      case 'Pending': return '#f44336';
      case 'Partial': return '#FF9800';
      default: return '#666';
    }
  };

  const renderPaymentRecord = ({ item }) => (
    <View style={styles.paymentCard}>
      <View style={styles.studentInfo}>
        <View style={styles.avatarContainer}>
          <Ionicons name="person" size={20} color="#2196F3" />
        </View>
        <View style={styles.studentDetails}>
          <Text style={styles.studentName}>{item.students?.name}</Text>
          <Text style={styles.studentId}>#{item.students?.admission_no}</Text>
          <Text style={styles.feeComponent}>{item.fee_component}</Text>
        </View>
      </View>
      <View style={styles.paymentInfo}>
        <Text style={styles.amountText}>{formatCurrency(item.amount_paid)}</Text>
        <View style={[styles.paymentModeBadge, { backgroundColor: getPaymentModeColor(item.payment_mode) }]}>
          <Text style={styles.paymentModeText}>{item.payment_mode}</Text>
        </View>
        <Text style={styles.dateText}>{formatDate(new Date(item.payment_date))}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Fee Collection" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading fee data...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Fee Collection" showBack={true} />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Filters Section */}
        <View style={styles.filtersSection}>
          <Text style={styles.sectionTitle}>Filters</Text>

          <View style={styles.filterRow}>
            <View style={styles.filterItem}>
              <Text style={styles.filterLabel}>Academic Year</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedAcademicYear}
                  onValueChange={setSelectedAcademicYear}
                  style={styles.picker}
                >
                  {academicYears.map((year) => (
                    <Picker.Item key={year} label={year} value={year} />
                  ))}
                </Picker>
              </View>
            </View>

            <View style={styles.filterItem}>
              <Text style={styles.filterLabel}>Class</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedClass}
                  onValueChange={setSelectedClass}
                  style={styles.picker}
                >
                  <Picker.Item label="All Classes" value="All" />
                  {classes.map((cls) => (
                    <Picker.Item
                      key={cls.id}
                      label={`${cls.class_name} ${cls.section}`}
                      value={cls.id}
                    />
                  ))}
                </Picker>
              </View>
            </View>
          </View>

          <View style={styles.filterRow}>
            <View style={styles.filterItem}>
              <Text style={styles.filterLabel}>Payment Status</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedPaymentStatus}
                  onValueChange={setSelectedPaymentStatus}
                  style={styles.picker}
                >
                  {paymentStatuses.map((status) => (
                    <Picker.Item key={status} label={status} value={status} />
                  ))}
                </Picker>
              </View>
            </View>

            <View style={styles.filterItem}>
              <Text style={styles.filterLabel}>Date Range</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedDateRange}
                  onValueChange={setSelectedDateRange}
                  style={styles.picker}
                >
                  {dateRangeOptions.map((option) => (
                    <Picker.Item
                      key={option.key}
                      label={option.label}
                      value={option.key}
                    />
                  ))}
                </Picker>
              </View>
            </View>
          </View>

          {selectedDateRange === 'custom' && (
            <View style={styles.customDateRow}>
              {Platform.OS === 'web' ? (
                <>
                  <View style={styles.dateInputWrapper}>
                    <CrossPlatformDatePicker
                      label="Start Date"
                      value={startDate}
                      onChange={(event, date) => handleDateChange(event, date, 'start')}
                      mode="date"
                      placeholder="Select Start Date"
                      containerStyle={{ flex: 1, marginRight: 8 }}
                    />
                  </View>
                  <View style={styles.dateInputWrapper}>
                    <CrossPlatformDatePicker
                      label="End Date"
                      value={endDate}
                      onChange={(event, date) => handleDateChange(event, date, 'end')}
                      mode="date"
                      placeholder="Select End Date"
                      containerStyle={{ flex: 1, marginLeft: 8 }}
                    />
                  </View>
                </>
              ) : (
                <>
                  <DatePickerButton
                    label="Start Date"
                    value={startDate}
                    onPress={() => setShowStartDatePicker(true)}
                    placeholder="Select Start Date"
                    mode="date"
                    style={styles.dateButton}
                    containerStyle={{ flex: 1, marginRight: 8 }}
                    displayFormat={(date) => `Start: ${formatDate(date)}`}
                  />
                  <DatePickerButton
                    label="End Date"
                    value={endDate}
                    onPress={() => setShowEndDatePicker(true)}
                    placeholder="Select End Date"
                    mode="date"
                    style={styles.dateButton}
                    containerStyle={{ flex: 1, marginLeft: 8 }}
                    displayFormat={(date) => `End: ${formatDate(date)}`}
                  />
                </>
              )}
            </View>
          )}
        </View>

        {/* Statistics Cards */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Collection Overview</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#4CAF50' }]}>
                <Ionicons name="checkmark-circle" size={24} color="#fff" />
              </View>
              <Text style={styles.statValue}>{formatCurrency(stats.totalCollected)}</Text>
              <Text style={styles.statLabel}>Collected</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#f44336' }]}>
                <Ionicons name="time" size={24} color="#fff" />
              </View>
              <Text style={styles.statValue}>{formatCurrency(stats.totalOutstanding)}</Text>
              <Text style={styles.statLabel}>Outstanding</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#2196F3' }]}>
                <Ionicons name="calculator" size={24} color="#fff" />
              </View>
              <Text style={styles.statValue}>{formatCurrency(stats.totalExpected)}</Text>
              <Text style={styles.statLabel}>Expected</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#FF9800' }]}>
                <Ionicons name="trending-up" size={24} color="#fff" />
              </View>
              <Text style={styles.statValue}>{stats.collectionRate}%</Text>
              <Text style={styles.statLabel}>Collection Rate</Text>
            </View>
          </View>
        </View>

        {/* Monthly Collection Chart */}
        {stats.monthlyCollection.length > 0 && (
          <View style={styles.chartSection}>
            <Text style={styles.sectionTitle}>Monthly Collection Trend</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart
                data={{
                  labels: stats.monthlyCollection.map(item => item.month),
                  datasets: [{
                    data: stats.monthlyCollection.map(item => item.amount),
                  }]
                }}
                width={Math.max(screenWidth - 40, stats.monthlyCollection.length * 80)}
                height={220}
                chartConfig={{
                  backgroundColor: '#fff',
                  backgroundGradientFrom: '#fff',
                  backgroundGradientTo: '#fff',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  style: { borderRadius: 16 },
                  barPercentage: 0.7,
                }}
                style={styles.chart}
                showValuesOnTopOfBars={true}
              />
            </ScrollView>
          </View>
        )}

        {/* Payment Mode Distribution */}
        {stats.paymentModeDistribution.length > 0 && (
          <View style={styles.chartSection}>
            <Text style={styles.sectionTitle}>Payment Mode Distribution</Text>
            <PieChart
              data={stats.paymentModeDistribution}
              width={screenWidth - 32}
              height={220}
              chartConfig={{
                backgroundColor: '#fff',
                backgroundGradientFrom: '#fff',
                backgroundGradientTo: '#fff',
                color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              }}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="15"
              center={[10, 10]}
              absolute
            />
          </View>
        )}

        {/* Class-wise Collection */}
        {stats.classWiseCollection.length > 0 && (
          <View style={styles.classSection}>
            <Text style={styles.sectionTitle}>Class-wise Collection</Text>
            {stats.classWiseCollection.map((item, index) => (
              <View key={index} style={styles.classCard}>
                <View style={styles.classInfo}>
                  <Text style={styles.className}>{item.className}</Text>
                  <Text style={styles.classStats}>
                    {item.count} payments • Avg: {formatCurrency(item.average)}
                  </Text>
                </View>
                <View style={styles.collectionAmount}>
                  <Text style={styles.amountText}>{formatCurrency(item.collected)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Recent Payments */}
        <View style={styles.paymentsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Payments</Text>
            <TouchableOpacity
              style={styles.exportButton}
              onPress={() => setShowExportModal(true)}
            >
              <Ionicons name="download" size={16} color="#2196F3" />
              <Text style={styles.exportText}>Export</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={stats.recentPayments}
            keyExtractor={(item) => `${item.id}`}
            renderItem={renderPaymentRecord}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="card-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No payment records found</Text>
                <Text style={styles.emptySubtext}>
                  Try adjusting your filters or date range
                </Text>
              </View>
            }
          />
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="add-circle" size={20} color="#4CAF50" />
              <Text style={styles.actionButtonText}>Record Payment</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="document-text" size={20} color="#2196F3" />
              <Text style={styles.actionButtonText}>Generate Report</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="mail" size={20} color="#FF9800" />
              <Text style={styles.actionButtonText}>Send Reminders</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Date Pickers - Only show on mobile platforms */}
      {Platform.OS !== 'web' && showStartDatePicker && (
        <CrossPlatformDatePicker
          value={startDate}
          mode="date"
          display="default"
          onChange={(event, date) => handleDateChange(event, date, 'start')}
        />
      )}

      {Platform.OS !== 'web' && showEndDatePicker && (
        <CrossPlatformDatePicker
          value={endDate}
          mode="date"
          display="default"
          onChange={(event, date) => handleDateChange(event, date, 'end')}
        />
      )}

      {/* Export Modal */}
      <ExportModal
        visible={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        title="Export Fee Collection Report"
        availableFormats={[EXPORT_FORMATS.CSV, EXPORT_FORMATS.JSON, EXPORT_FORMATS.CLIPBOARD]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100, // Bottom padding for the entire ScrollView to prevent home button overlap
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },

  // Search Section
  searchSection: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: '#333',
  },

  // Filters Section
  filtersSection: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
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
    marginBottom: 16,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  filterItem: {
    flex: 1,
    marginHorizontal: 4,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  picker: {
    height: 50,
    color: '#333',
  },
  customDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  dateButtonText: {
    fontSize: 14,
    color: '#333',
  },

  // Statistics Section
  statsSection: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },

  // Chart Section
  chartSection: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },

  // Class Section
  classSection: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  classCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  classInfo: {
    flex: 1,
  },
  className: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  classStats: {
    fontSize: 12,
    color: '#666',
  },
  collectionAmount: {
    alignItems: 'flex-end',
  },
  // Payments Section
  paymentsSection: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#2196F3',
    borderRadius: 6,
  },
  exportText: {
    fontSize: 12,
    color: '#2196F3',
    marginLeft: 4,
  },

  // Payment Record Card
  paymentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginVertical: 4,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  studentDetails: {
    flex: 1,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  studentId: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  feeComponent: {
    fontSize: 12,
    color: '#2196F3',
  },
  paymentInfo: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 4,
  },
  paymentModeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginBottom: 4,
  },
  paymentModeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '500',
  },
  dateText: {
    fontSize: 10,
    color: '#666',
  },

  // Actions Section
  actionsSection: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    marginBottom: 30,
  },
  actionButtons: {
    flexDirection: 'column',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderWidth: 2,
    borderRadius: 12,
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionButtonText: {
    fontSize: 12,
    color: '#333',
    marginLeft: 8,
    fontWeight: '500',
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});

export default FeeCollection;
