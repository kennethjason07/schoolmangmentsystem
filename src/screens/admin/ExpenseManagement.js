import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Platform,
  RefreshControl,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PieChart } from 'react-native-chart-kit';
import Header from '../../components/Header';
import StatCard from '../../components/StatCard';
import DateTimePicker from '@react-native-community/datetimepicker';
import CrossPlatformPieChart from '../../components/CrossPlatformPieChart';
import { supabase, dbHelpers } from '../../utils/supabase';
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns';

const { width } = Dimensions.get('window');

const ExpenseManagement = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  
  // Expense Data
  const [expenses, setExpenses] = useState([]);
  const [yearlyExpenses, setYearlyExpenses] = useState([]);
  const [expenseStats, setExpenseStats] = useState([]);
  const [yearlyExpenseStats, setYearlyExpenseStats] = useState([]);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [yearlyTotal, setYearlyTotal] = useState(0);
  const [budgetData, setBudgetData] = useState({});
  const [allExpenses, setAllExpenses] = useState([]); // Local state for all expenses
  
  // View Control
  const [activeTab, setActiveTab] = useState('monthly'); // 'monthly' or 'yearly'
  
  // Modal States
  const [isExpenseModalVisible, setIsExpenseModalVisible] = useState(false);
  const [isBudgetModalVisible, setIsBudgetModalVisible] = useState(false);
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [categoryInput, setCategoryInput] = useState({
    name: '',
    icon: 'briefcase',
    color: '#2196F3',
    monthly_budget: ''
  });
  const [editCategoryIndex, setEditCategoryIndex] = useState(null);
  const [expenseInput, setExpenseInput] = useState({
    title: '',
    amount: '',
    category: 'Staff Salaries',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    receipt_number: '',
    vendor: ''
  });
  const [budgetInputs, setBudgetInputs] = useState({});
  const [editExpenseIndex, setEditExpenseIndex] = useState(null);

  // Dynamic Expense Categories from database
  const [expenseCategories, setExpenseCategories] = useState([]);
  
  // Default category template for new categories
  const defaultCategoryIcons = [
    'people', 'flash', 'library', 'build', 'car', 'restaurant', 
    'calendar', 'desktop', 'megaphone', 'ellipsis-horizontal',
    'briefcase', 'school', 'medical', 'fitness', 'home',
    'airplane', 'cafe', 'business', 'hammer', 'shield'
  ];
  
  const defaultCategoryColors = [
    '#2196F3', '#FF9800', '#4CAF50', '#9C27B0', '#F44336',
    '#FF5722', '#607D8B', '#795548', '#E91E63', '#009688',
    '#3F51B5', '#FF5722', '#8BC34A', '#FFC107', '#673AB7',
    '#00BCD4', '#CDDC39', '#FF6F00', '#37474F', '#6D4C41'
  ];

  // Mock data for frontend development
  const mockExpenses = [
    // August 2025 data (current month for testing)
    {
      id: 101,
      title: 'Monthly Teacher Salaries - August',
      amount: 480000,
      category: 'Staff Salaries',
      description: 'Salary payment for all teaching staff',
      expense_date: '2025-08-01',
      receipt_number: 'SAL-2025-08-001',
      vendor: 'Payroll Department'
    },
    {
      id: 102,
      title: 'Electricity Bill - August',
      amount: 42000,
      category: 'Utilities',
      description: 'Monthly electricity consumption',
      expense_date: '2025-08-15',
      receipt_number: 'EB-AUG-2025',
      vendor: 'State Electricity Board'
    },
    {
      id: 103,
      title: 'New Classroom Furniture',
      amount: 95000,
      category: 'Supplies & Materials',
      description: 'Desks and chairs for grade 5',
      expense_date: '2025-08-12',
      receipt_number: 'FURN-2025-08-001',
      vendor: 'Education Furniture Co'
    },
    {
      id: 104,
      title: 'Air Conditioning Maintenance',
      amount: 35000,
      category: 'Infrastructure',
      description: 'Annual AC servicing and repairs',
      expense_date: '2025-08-10',
      receipt_number: 'AC-2025-08-001',
      vendor: 'Cool Breeze Services'
    },
    {
      id: 105,
      title: 'School Van Insurance',
      amount: 28000,
      category: 'Transportation',
      description: 'Annual insurance premium for school vehicles',
      expense_date: '2025-08-08',
      receipt_number: 'INS-2025-08-001',
      vendor: 'SafeGuard Insurance'
    },
    {
      id: 106,
      title: 'WiFi Router Upgrade',
      amount: 15000,
      category: 'Technology',
      description: 'New high-speed routers for campus',
      expense_date: '2025-08-05',
      receipt_number: 'TECH-2025-08-001',
      vendor: 'NetSpeed Solutions'
    },
    {
      id: 107,
      title: 'Independence Day Celebration',
      amount: 22000,
      category: 'Events & Activities',
      description: 'Decorations and refreshments for celebration',
      expense_date: '2025-08-14',
      receipt_number: 'EVENT-2025-08-001',
      vendor: 'Party Supplies Plus'
    },
    {
      id: 108,
      title: 'Kitchen Equipment Repair',
      amount: 18000,
      category: 'Food & Catering',
      description: 'Repair of industrial mixer and oven',
      expense_date: '2025-08-06',
      receipt_number: 'KITCHEN-2025-08-001',
      vendor: 'Commercial Kitchen Services'
    },
    {
      id: 109,
      title: 'School Brochure Printing',
      amount: 12000,
      category: 'Marketing',
      description: 'Admission brochures for new session',
      expense_date: '2025-08-03',
      receipt_number: 'PRINT-2025-08-001',
      vendor: 'Quality Print House'
    },
    {
      id: 110,
      title: 'Office Supplies',
      amount: 8000,
      category: 'Miscellaneous',
      description: 'Stationery and office consumables',
      expense_date: '2025-08-02',
      receipt_number: 'OFFICE-2025-08-001',
      vendor: 'Office Mart'
    },
    // Previous data for other months
    {
      id: 1,
      title: 'Monthly Teacher Salaries - December',
      amount: 450000,
      category: 'Staff Salaries',
      description: 'Salary payment for all teaching staff',
      expense_date: '2024-12-01',
      receipt_number: 'SAL-2024-12-001',
      vendor: 'Payroll Department'
    },
    {
      id: 2,
      title: 'Electricity Bill - November',
      amount: 35000,
      category: 'Utilities',
      description: 'Monthly electricity consumption',
      expense_date: '2024-11-28',
      receipt_number: 'EB-NOV-2024',
      vendor: 'State Electricity Board'
    },
    {
      id: 3,
      title: 'Science Lab Equipment',
      amount: 85000,
      category: 'Supplies & Materials',
      description: 'Microscopes and lab apparatus',
      expense_date: '2024-11-25',
      receipt_number: 'LAB-2024-11-001',
      vendor: 'Scientific Instruments Ltd'
    },
    {
      id: 4,
      title: 'Playground Maintenance',
      amount: 45000,
      category: 'Infrastructure',
      description: 'Repair and maintenance of playground equipment',
      expense_date: '2024-11-20',
      receipt_number: 'MAINT-2024-11-003',
      vendor: 'ABC Contractors'
    },
    {
      id: 5,
      title: 'School Bus Fuel',
      amount: 25000,
      category: 'Transportation',
      description: 'Monthly fuel expenses for school buses',
      expense_date: '2024-11-15',
      receipt_number: 'FUEL-NOV-2024',
      vendor: 'XYZ Petrol Pump'
    },
    {
      id: 6,
      title: 'Computer Lab Software',
      amount: 75000,
      category: 'Technology',
      description: 'Annual software licenses',
      expense_date: '2024-11-10',
      receipt_number: 'TECH-2024-11-002',
      vendor: 'Software Solutions Inc'
    },
    {
      id: 7,
      title: 'Sports Equipment',
      amount: 30000,
      category: 'Events & Activities',
      description: 'Football, basketball equipment',
      expense_date: '2024-11-05',
      receipt_number: 'SPORTS-2024-11-001',
      vendor: 'Sports World'
    },
    {
      id: 8,
      title: 'Cafeteria Supplies',
      amount: 40000,
      category: 'Food & Catering',
      description: 'Monthly food supplies',
      expense_date: '2024-11-03',
      receipt_number: 'CAFE-2024-11-001',
      vendor: 'Food Suppliers Ltd'
    }
  ];

  const loadExpenseData = async () => {
    try {
      console.log('🔍 ExpenseManagement: Starting data load...');
      setLoading(true);
      
      // Get date range for selected month
      const monthStart = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');
      console.log('📅 Date range:', { monthStart, monthEnd, selectedMonth });
      
      // Test database connection first
      console.log('🔗 Testing database connection...');
      try {
        const { data: testData, error: testError } = await supabase
          .from('school_expenses')
          .select('count')
          .limit(1);
        console.log('🔗 Database connection test:', { testData, testError });
      } catch (testErr) {
        console.error('❌ Database connection failed:', testErr);
      }
      
      // Check if tables exist
      console.log('📊 Checking if tables exist...');
      try {
        const { data: tableCheck, error: tableError } = await supabase
          .from('school_expenses')
          .select('id')
          .limit(1);
        console.log('📊 Table check result:', { tableCheck, tableError });
        
        if (tableError) {
          console.error('❌ Table does not exist or access denied:', tableError);
          Alert.alert('Database Error', 'The expense tables may not exist. Please run the SQL script in Supabase first.');
          return;
        }
      } catch (err) {
        console.error('❌ Error checking tables:', err);
      }
      
      // Fetch monthly expenses from database
      console.log('📥 Fetching monthly expenses...');
      const { data: monthlyExpenses, error: monthlyError } = await dbHelpers.getExpenses({
        startDate: monthStart,
        endDate: monthEnd
      });

      console.log('📥 Monthly expenses result:', {
        count: monthlyExpenses?.length || 0,
        data: monthlyExpenses,
        error: monthlyError
      });

      if (monthlyError) {
        console.error('❌ Error fetching monthly expenses:', monthlyError);
        Alert.alert('Error', `Failed to load expense data: ${monthlyError.message || monthlyError}`);
        return;
      }

      // If no data from database, temporarily use mock data for testing
      if (!monthlyExpenses || monthlyExpenses.length === 0) {
        console.log('⚠️ No data from database, falling back to mock data for testing...');
        
        // Filter mock data by selected month for demo purposes
        const filteredMockData = mockExpenses.filter(expense => {
          const expenseDate = new Date(expense.expense_date);
          const monthStartDate = startOfMonth(selectedMonth);
          const monthEndDate = endOfMonth(selectedMonth);
          return expenseDate >= monthStartDate && expenseDate <= monthEndDate;
        });
        
        console.log('📝 Using mock data:', filteredMockData.length, 'items for selected month');
        setExpenses(filteredMockData);
        
        // Also set mock totals
        const mockMonthlySum = filteredMockData.reduce((sum, expense) => sum + (expense.amount || 0), 0);
        setMonthlyTotal(mockMonthlySum);
        
        const mockYearlySum = mockExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
        setYearlyTotal(mockYearlySum);
        
        console.log('💰 Mock totals - Monthly:', mockMonthlySum, 'Yearly:', mockYearlySum);
      } else {
        setExpenses(monthlyExpenses || []);
        console.log('✅ Set expenses state:', monthlyExpenses?.length || 0, 'items');
      }

      // Calculate monthly total (but don't override if we already set it from mock data)
      const monthlySum = (monthlyExpenses || []).reduce((sum, expense) => sum + (expense.amount || 0), 0);
      if (monthlyExpenses && monthlyExpenses.length > 0) {
        setMonthlyTotal(monthlySum);
        console.log('💰 Monthly total from DB:', monthlySum);
      } else {
        console.log('💰 Skipping DB monthly total (using mock data total instead)');
      }

      // Get yearly expenses
      const currentYear = selectedMonth.getFullYear();
      const yearStart = `${currentYear}-01-01`;
      const yearEnd = `${currentYear}-12-31`;
      console.log('📅 Fetching yearly expenses for:', { yearStart, yearEnd });
      
      const { data: yearlyExpenses, error: yearlyError } = await dbHelpers.getExpenses({
        startDate: yearStart,
        endDate: yearEnd
      });

      if (yearlyError) {
        console.error('❌ Error fetching yearly expenses:', yearlyError);
      } else {
        const yearlySum = (yearlyExpenses || []).reduce((sum, expense) => sum + (expense.amount || 0), 0);
        setYearlyTotal(yearlySum);
        setYearlyExpenses(yearlyExpenses || []);
        console.log('📊 Yearly total:', yearlySum, 'from', yearlyExpenses?.length || 0, 'expenses');
        
        // If no yearly data from database, use mock data for yearly view
        if (!yearlyExpenses || yearlyExpenses.length === 0) {
          console.log('⚠️ No yearly data from database, using mock data for yearly view...');
          const yearlyMockData = mockExpenses.filter(expense => {
            const expenseDate = new Date(expense.expense_date);
            return expenseDate.getFullYear() === currentYear;
          });
          setYearlyExpenses(yearlyMockData);
          const mockYearlySum = yearlyMockData.reduce((sum, expense) => sum + (expense.amount || 0), 0);
          setYearlyTotal(mockYearlySum);
          console.log('📝 Using mock yearly data:', yearlyMockData.length, 'items, total:', mockYearlySum);
        }
      }

      // Determine which expenses data to use for calculations
      let expensesForCalculation = monthlyExpenses;
      let monthlyTotalForCalculation = monthlySum;
      
      // If we're using mock data, use the filtered mock data for calculations
      if (!monthlyExpenses || monthlyExpenses.length === 0) {
        const filteredMockData = mockExpenses.filter(expense => {
          const expenseDate = new Date(expense.expense_date);
          const monthStartDate = startOfMonth(selectedMonth);
          const monthEndDate = endOfMonth(selectedMonth);
          return expenseDate >= monthStartDate && expenseDate <= monthEndDate;
        });
        expensesForCalculation = filteredMockData;
        monthlyTotalForCalculation = filteredMockData.reduce((sum, expense) => sum + (expense.amount || 0), 0);
        console.log('📊 Using mock data for calculations:', expensesForCalculation.length, 'expenses, total:', monthlyTotalForCalculation);
      }

      // Wait for categories to be loaded before calculating breakdown
      if (expenseCategories.length === 0) {
        console.log('⏳ Categories not loaded yet, skipping calculation...');
        return;
      }

      // Calculate category-wise breakdown
      console.log('📊 Calculating category breakdown...');
      const categoryBreakdown = expenseCategories.map(category => {
        const categoryExpenses = (expensesForCalculation || []).filter(exp => exp.category === category.name);
        const categoryTotal = categoryExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
        
        // Use category's monthly_budget from database
        const categoryBudget = category.monthly_budget || 0;
        
        console.log(`📊 Category ${category.name}:`, {
          expenses: categoryExpenses.length,
          total: categoryTotal,
          budget: categoryBudget
        });
        
        return {
          name: category.name,
          amount: categoryTotal,
          budget: categoryBudget,
          color: category.color,
          icon: category.icon,
          count: categoryExpenses.length,
          percentage: monthlyTotalForCalculation > 0 ? ((categoryTotal / monthlyTotalForCalculation) * 100).toFixed(1) : 0,
          budgetUsage: categoryBudget > 0 ? ((categoryTotal / categoryBudget) * 100).toFixed(1) : 0
        };
      });

      setExpenseStats(categoryBreakdown);
      console.log('📊 Category stats set:', categoryBreakdown.length, 'categories');

      // Calculate budget data for pie chart
      const pieChartData = categoryBreakdown
        .filter(cat => cat.amount > 0)
        .map(cat => ({
          name: cat.name,
          population: cat.amount,
          color: cat.color,
          legendFontColor: '#333',
          legendFontSize: 12
        }));

      setBudgetData(pieChartData);
      console.log('📈 Pie chart data set:', pieChartData.length, 'categories with data');
      
      // Calculate yearly category breakdown
      console.log('📊 Calculating yearly category breakdown...');
      let yearlyExpensesForCalculation = yearlyExpenses || [];
      
      // If using mock data for yearly, filter mock expenses by year
      if (!yearlyExpenses || yearlyExpenses.length === 0) {
        yearlyExpensesForCalculation = mockExpenses.filter(expense => {
          const expenseDate = new Date(expense.expense_date);
          return expenseDate.getFullYear() === currentYear;
        });
      }
      
      const yearlyTotalForCalculation = yearlyExpensesForCalculation.reduce((sum, expense) => sum + (expense.amount || 0), 0);
      
      const yearlyCategoryBreakdown = expenseCategories.map(category => {
        const categoryExpenses = yearlyExpensesForCalculation.filter(exp => exp.category === category.name);
        const categoryTotal = categoryExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
        
        // Use annual budget = monthly budget * 12
        const categoryAnnualBudget = (category.monthly_budget || 0) * 12;
        
        console.log(`📊 Yearly Category ${category.name}:`, {
          expenses: categoryExpenses.length,
          total: categoryTotal,
          annualBudget: categoryAnnualBudget
        });
        
        return {
          name: category.name,
          amount: categoryTotal,
          budget: categoryAnnualBudget,
          color: category.color,
          icon: category.icon,
          count: categoryExpenses.length,
          percentage: yearlyTotalForCalculation > 0 ? ((categoryTotal / yearlyTotalForCalculation) * 100).toFixed(1) : 0,
          budgetUsage: categoryAnnualBudget > 0 ? ((categoryTotal / categoryAnnualBudget) * 100).toFixed(1) : 0
        };
      });
      
      setYearlyExpenseStats(yearlyCategoryBreakdown);
      console.log('📊 Yearly category stats set:', yearlyCategoryBreakdown.length, 'categories');
      console.log('✅ Data loading completed successfully!');

    } catch (error) {
      console.error('❌ Critical error loading expense data:', error);
      Alert.alert('Error', `Failed to load expense data: ${error.message || error}`);
    } finally {
      setLoading(false);
      console.log('🔄 Loading state set to false');
    }
  };

  useEffect(() => {
    loadExpenseData();
  }, [selectedMonth]);
  
  // Load categories on mount and when needed, but don't reload data
  useEffect(() => {
    const loadCategoriesOnMount = async () => {
      if (expenseCategories.length === 0) {
        console.log('🏷️ Loading categories on mount...');
        const { data: dbCategories, error: categoriesError } = await dbHelpers.getExpenseCategories();
        
        if (categoriesError) {
          console.error('❌ Error fetching categories on mount:', categoriesError);
        } else if (dbCategories && dbCategories.length > 0) {
          setExpenseCategories(dbCategories);
          console.log('✅ Categories loaded on mount:', dbCategories.length, 'categories');
        } else {
          console.log('⚠️ No categories found on mount, creating defaults...');
          await createDefaultCategories();
        }
      }
    };
    
    loadCategoriesOnMount();
  }, []); // Only run once on mount
  
  // Re-calculate expense stats when categories become available
  useEffect(() => {
    if (expenseCategories.length > 0 && (expenses.length > 0 || yearlyExpenses.length > 0)) {
      console.log('🔄 Categories loaded, recalculating expense stats...');
      loadExpenseData();
    }
  }, [expenseCategories.length]); // Only when categories count changes

  const onRefresh = async () => {
    setRefreshing(true);
    await loadExpenseData();
    setRefreshing(false);
  };

  const openAddExpenseModal = () => {
    setExpenseInput({
      title: '',
      amount: '',
      category: 'Staff Salaries',
      description: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      receipt_number: '',
      vendor: ''
    });
    setEditExpenseIndex(null);
    setIsExpenseModalVisible(true);
  };

  const openEditExpenseModal = (expense, index) => {
    setExpenseInput({
      title: expense.title,
      amount: expense.amount.toString(),
      category: expense.category,
      description: expense.description || '',
      date: expense.expense_date,
      receipt_number: expense.receipt_number || '',
      vendor: expense.vendor || ''
    });
    setEditExpenseIndex(index);
    setIsExpenseModalVisible(true);
  };

  const saveExpense = async () => {
    if (!expenseInput.title || !expenseInput.amount || !expenseInput.category) {
      Alert.alert('Error', 'Please fill in all required fields.');
      return;
    }

    try {
      // Remove fields that don't exist in simplified schema
      const expenseData = {
        title: expenseInput.title,
        amount: parseFloat(expenseInput.amount),
        category: expenseInput.category,
        description: expenseInput.description,
        expense_date: expenseInput.date
      };

      if (editExpenseIndex !== null) {
        // Update existing expense using helper function
        const { error } = await dbHelpers.updateExpense(expenses[editExpenseIndex].id, expenseData);

        if (error) throw error;
      } else {
        // Create new expense using helper function
        const { error } = await dbHelpers.createExpense(expenseData);

        if (error) throw error;
      }

      await loadExpenseData();
      setIsExpenseModalVisible(false);
      Alert.alert('Success', 'Expense saved successfully!');
    } catch (error) {
      console.error('Error saving expense:', error);
      Alert.alert('Error', 'Failed to save expense');
    }
  };

  const deleteExpense = (expenseId) => {
    Alert.alert(
      'Delete Expense',
      'Are you sure you want to delete this expense?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await dbHelpers.deleteExpense(expenseId);

              if (error) throw error;
              await loadExpenseData();
              Alert.alert('Success', 'Expense deleted successfully!');
            } catch (error) {
              console.error('Error deleting expense:', error);
              Alert.alert('Error', 'Failed to delete expense');
            }
          }
        }
      ]
    );
  };

  // Budget Management Functions
  const openBudgetModal = () => {
    // Initialize budget inputs with current values
    const initialBudgets = {};
    expenseCategories.forEach(category => {
      const currentCategory = expenseStats.find(stat => stat.name === category.name);
      initialBudgets[category.name] = (currentCategory?.budget || category.budget).toString();
    });
    setBudgetInputs(initialBudgets);
    setIsBudgetModalVisible(true);
  };

  const saveBudgets = async () => {
    try {
      const budgetUpdates = [];
      
      for (const [categoryName, budgetValue] of Object.entries(budgetInputs)) {
        const budget = parseFloat(budgetValue);
        if (isNaN(budget) || budget < 0) {
          Alert.alert('Error', `Invalid budget amount for ${categoryName}`);
          return;
        }
        
        budgetUpdates.push({
          name: categoryName,
          monthly_budget: budget
        });
      }
      
      // Update budgets in database using dbHelpers
      for (const update of budgetUpdates) {
        const { error } = await dbHelpers.updateExpenseCategory(update.name, {
          monthly_budget: update.monthly_budget
        });
        
        if (error) {
          console.error('Error updating budget for', update.name, error);
          Alert.alert('Error', `Failed to update budget for ${update.name}`);
          return;
        }
      }
      
      setIsBudgetModalVisible(false);
      await loadExpenseData(); // Refresh to show updated budgets
      Alert.alert('Success', 'Budgets updated successfully!');
    } catch (error) {
      console.error('Error saving budgets:', error);
      Alert.alert('Error', 'Failed to save budgets');
    }
  };
  
  // Create default categories if none exist
  const createDefaultCategories = async () => {
    const defaultCategories = [
      { name: 'Staff Salaries', icon: 'people', color: '#2196F3', monthly_budget: 500000 },
      { name: 'Utilities', icon: 'flash', color: '#FF9800', monthly_budget: 50000 },
      { name: 'Supplies & Materials', icon: 'library', color: '#4CAF50', monthly_budget: 100000 },
      { name: 'Infrastructure', icon: 'build', color: '#9C27B0', monthly_budget: 200000 },
      { name: 'Transportation', icon: 'car', color: '#F44336', monthly_budget: 75000 },
      { name: 'Food & Catering', icon: 'restaurant', color: '#FF5722', monthly_budget: 80000 },
      { name: 'Events & Activities', icon: 'calendar', color: '#607D8B', monthly_budget: 50000 },
      { name: 'Technology', icon: 'desktop', color: '#795548', monthly_budget: 100000 },
      { name: 'Marketing', icon: 'megaphone', color: '#E91E63', monthly_budget: 30000 },
      { name: 'Miscellaneous', icon: 'ellipsis-horizontal', color: '#009688', monthly_budget: 50000 }
    ];
    
    try {
      const createdCategories = [];
      for (const category of defaultCategories) {
        // First, try with all fields
        let { data, error } = await dbHelpers.createExpenseCategory(category);
        
        // If error due to missing columns, try with minimal fields
        if (error && error.message && error.message.includes('could not find')) {
          console.warn('Database missing some columns, trying with basic fields only:', error.message);
          const basicCategory = {
            name: category.name,
            monthly_budget: category.monthly_budget
          };
          
          const result = await dbHelpers.createExpenseCategory(basicCategory);
          data = result.data;
          error = result.error;
          
          // Add missing fields to local data for UI consistency
          if (data) {
            data.icon = category.icon;
            data.color = category.color;
          }
        }
        
        if (error) {
          console.error('Error creating default category:', category.name, error);
        } else if (data) {
          // Ensure all required UI fields are present
          const categoryWithDefaults = {
            ...data,
            icon: data.icon || category.icon || 'briefcase',
            color: data.color || category.color || '#2196F3',
            monthly_budget: data.monthly_budget || category.monthly_budget || 0
          };
          createdCategories.push(categoryWithDefaults);
        }
      }
      
      if (createdCategories.length > 0) {
        setExpenseCategories(createdCategories);
        console.log('✅ Created default categories:', createdCategories.length);
      } else {
        // Fallback: use mock categories if database creation fails
        console.warn('⚠️ Database category creation failed, using local categories for UI');
        setExpenseCategories(defaultCategories.map(cat => ({...cat, id: Date.now() + Math.random()})));
      }
    } catch (error) {
      console.error('Error creating default categories:', error);
      // Fallback: use mock categories if everything fails
      console.warn('⚠️ Using fallback local categories due to database error');
      setExpenseCategories(defaultCategories.map(cat => ({...cat, id: Date.now() + Math.random()})));
    }
  };
  
  // Category Management Functions
  const openAddCategoryModal = () => {
    setCategoryInput({
      name: '',
      icon: 'briefcase',
      color: '#2196F3',
      monthly_budget: ''
    });
    setEditCategoryIndex(null);
    setIsCategoryModalVisible(true);
  };
  
  const openEditCategoryModal = (category, index) => {
    setCategoryInput({
      name: category.name,
      icon: category.icon,
      color: category.color,
      monthly_budget: category.monthly_budget?.toString() || ''
    });
    setEditCategoryIndex(index);
    setIsCategoryModalVisible(true);
  };
  
  const saveCategory = async () => {
    if (!categoryInput.name) {
      Alert.alert('Error', 'Please enter a category name.');
      return;
    }
    
    const budget = parseFloat(categoryInput.monthly_budget);
    if (isNaN(budget) || budget < 0) {
      Alert.alert('Error', 'Please enter a valid monthly budget.');
      return;
    }
    
    try {
      const categoryData = {
        name: categoryInput.name,
        icon: categoryInput.icon,
        color: categoryInput.color,
        monthly_budget: budget
      };
      
      if (editCategoryIndex !== null) {
        // Update existing category
        const categoryToUpdate = expenseCategories[editCategoryIndex];
        const { error } = await dbHelpers.updateExpenseCategory(categoryToUpdate.name, categoryData);
        
        if (error) throw error;
        
        // Update local state
        const updatedCategories = [...expenseCategories];
        updatedCategories[editCategoryIndex] = { ...categoryToUpdate, ...categoryData };
        setExpenseCategories(updatedCategories);
      } else {
        // Create new category
        const { data, error } = await dbHelpers.createExpenseCategory(categoryData);
        
        if (error) throw error;
        
        // Add to local state
        setExpenseCategories([...expenseCategories, data]);
      }
      
      setIsCategoryModalVisible(false);
      Alert.alert('Success', 'Category saved successfully!');
    } catch (error) {
      console.error('Error saving category:', error);
      Alert.alert('Error', 'Failed to save category');
    }
  };
  
  const deleteCategory = (categoryName) => {
    Alert.alert(
      'Delete Category',
      'Are you sure you want to delete this category? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await dbHelpers.deleteExpenseCategory(categoryName);
              
              if (error) throw error;
              
              // Remove from local state
              setExpenseCategories(expenseCategories.filter(cat => cat.name !== categoryName));
              Alert.alert('Success', 'Category deleted successfully!');
            } catch (error) {
              console.error('Error deleting category:', error);
              Alert.alert('Error', 'Failed to delete category');
            }
          }
        }
      ]
    );
  };

  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16,
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Expense Management" navigation={navigation} showBack={true} />
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading expense data...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Expense Management" navigation={navigation} showBack={true} />
      
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2196F3']}
            tintColor="#2196F3"
          />
        }
      >
        {/* View Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'monthly' && styles.activeTab]}
            onPress={() => setActiveTab('monthly')}
          >
            <Text style={[styles.tabText, activeTab === 'monthly' && styles.activeTabText]}>
              Monthly View
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'yearly' && styles.activeTab]}
            onPress={() => setActiveTab('yearly')}
          >
            <Text style={[styles.tabText, activeTab === 'yearly' && styles.activeTabText]}>
              Yearly View
            </Text>
          </TouchableOpacity>
        </View>

        {/* Today's Date */}
        <View style={styles.dateContainer}>
          <Text style={styles.dateText}>
            {format(new Date(), 'EEEE, MMMM dd, yyyy')}
          </Text>
        </View>

        {/* Summary Stats */}
        <View style={styles.statsContainerVertical}>
          {activeTab === 'monthly' ? (
            <>
              <StatCard
                title="Monthly Total"
                value={`₹${(monthlyTotal / 100000).toFixed(1)}L`}
                icon="card"
                color="#F44336"
                subtitle={`${expenses.length} transactions`}
              />
              
              <StatCard
                title="Avg per Month"
                value={`₹${(yearlyTotal / 12 / 100000).toFixed(1)}L`}
                icon="trending-up"
                color="#2196F3"
                subtitle={`${format(selectedMonth, 'yyyy')} average`}
              />
            </>
          ) : (
            <>
              <StatCard
                title="Yearly Total"
                value={`₹${(yearlyTotal / 100000).toFixed(1)}L`}
                icon="trending-up"
                color="#2196F3"
                subtitle={`${yearlyExpenses.length} transactions`}
              />
              
              <StatCard
                title="Monthly Average"
                value={`₹${(yearlyTotal / 12 / 100000).toFixed(1)}L`}
                icon="analytics"
                color="#4CAF50"
                subtitle={`${format(selectedMonth, 'yyyy')} average`}
              />
            </>
          )}
        </View>


        {/* Category-wise Budget Analysis */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.budgetHeaderLeft}>
              <Text style={styles.sectionTitle}>
                {activeTab === 'monthly' ? 'Monthly Budget Analysis' : 'Yearly Budget Analysis'}
              </Text>
              <Text style={styles.sectionSubtitle}>
                {(activeTab === 'monthly' ? expenseStats : yearlyExpenseStats)
                  .filter(cat => cat.amount > 0).length} active categories
              </Text>
            </View>
            <View style={styles.budgetHeaderRight}>
              <TouchableOpacity 
                style={styles.manageBudgetButton} 
                onPress={openAddCategoryModal}
              >
                <Ionicons name="add" size={16} color="#4CAF50" />
                <Text style={[styles.manageBudgetText, {color: '#4CAF50'}]}>Add</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.manageBudgetButton} 
                onPress={openBudgetModal}
              >
                <Ionicons name="settings-outline" size={16} color="#2196F3" />
                <Text style={styles.manageBudgetText}>Manage</Text>
              </TouchableOpacity>
            </View>
          </View>
          
        <View style={styles.budgetCardsGrid}>
            {(activeTab === 'monthly' ? expenseStats : yearlyExpenseStats)
              .sort((a, b) => b.amount - a.amount) // Sort by amount descending
              .map((category, index) => {
                const isOverBudget = category.budgetUsage > 100;
                const isNearLimit = category.budgetUsage > 80;
                const remaining = Math.max(0, category.budget - category.amount);
                
                return (
                  <View key={index} style={[
                    styles.budgetCard,
                    isOverBudget && styles.budgetCardOverBudget,
                    isNearLimit && !isOverBudget && styles.budgetCardNearLimit
                  ]}>
                    <View style={styles.budgetCardHeader}>
                      <View style={[styles.categoryIcon, { backgroundColor: category.color }]}>
                        <Ionicons name={category.icon} size={18} color="#fff" />
                      </View>
                      
                      <View style={styles.cardActions}>
                        {isOverBudget && (
                          <View style={styles.warningBadge}>
                            <Ionicons name="warning" size={12} color="#fff" />
                          </View>
                        )}
                        
                        <TouchableOpacity 
                          onPress={() => openEditCategoryModal(
                            expenseCategories.find(cat => cat.name === category.name), 
                            expenseCategories.findIndex(cat => cat.name === category.name)
                          )}
                          style={styles.cardEditButton}
                        >
                          <Ionicons name="create-outline" size={14} color="#666" />
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                          onPress={() => deleteCategory(category.name)}
                          style={styles.cardDeleteButton}
                        >
                          <Ionicons name="trash-outline" size={14} color="#F44336" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    
                    <Text style={styles.categoryName} numberOfLines={2}>
                      {category.name}
                    </Text>
                    
                    <View style={styles.amountSection}>
                      <Text style={styles.categoryAmount}>
                        ₹{(category.amount / 1000).toFixed(0)}K
                      </Text>
                      <Text style={styles.categoryBudget}>
                        of ₹{(category.budget / 1000).toFixed(0)}K
                      </Text>
                    </View>
                    
                    <View style={styles.progressContainer}>
                      <View style={styles.progressBar}>
                        <View 
                          style={[
                            styles.progressFill, 
                            { 
                              width: `${Math.min(100, category.budgetUsage)}%`,
                              backgroundColor: isOverBudget 
                                ? '#F44336' 
                                : isNearLimit 
                                  ? '#FF9800' 
                                  : category.color
                            }
                          ]} 
                        />
                      </View>
                      
                      <View style={styles.budgetStats}>
                        <Text style={[
                          styles.budgetPercentage,
                          { 
                            color: isOverBudget 
                              ? '#F44336' 
                              : isNearLimit 
                                ? '#FF9800' 
                                : '#666' 
                          }
                        ]}>
                          {category.budgetUsage}%
                        </Text>
                        
                        {!isOverBudget && (
                          <Text style={styles.remainingAmount}>
                            ₹{(remaining / 1000).toFixed(0)}K left
                          </Text>
                        )}
                        
                        {isOverBudget && (
                          <Text style={styles.overBudgetAmount}>
                            ₹{((category.amount - category.budget) / 1000).toFixed(0)}K over
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
          </View>
        </View>

        {/* Recent Expenses */}
        <View style={[styles.section, styles.recentExpensesSection]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {activeTab === 'monthly' ? 'Monthly Expenses' : 'Yearly Expenses'}
            </Text>
            <TouchableOpacity style={styles.addButton} onPress={openAddExpenseModal}>
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.expensesList}>
            {(activeTab === 'monthly' ? expenses : yearlyExpenses).map((expense, index) => (
              <View key={expense.id} style={styles.expenseItem}>
                <View style={[
                  styles.expenseIcon, 
                  { backgroundColor: `${expenseCategories.find(cat => cat.name === expense.category)?.color || '#2196F3'}15` }
                ]}>
                  <Ionicons 
                    name={expenseCategories.find(cat => cat.name === expense.category)?.icon || 'receipt'} 
                    size={20} 
                    color={expenseCategories.find(cat => cat.name === expense.category)?.color || '#2196F3'} 
                  />
                </View>
                
                <View style={styles.expenseDetails}>
                  <Text style={styles.expenseTitle}>{expense.title}</Text>
                  <Text style={styles.expenseCategory}>{expense.category}</Text>
                  <Text style={styles.expenseDate}>
                    {format(new Date(expense.expense_date), 'MMM dd, yyyy')}
                  </Text>
                  {expense.vendor && (
                    <Text style={styles.expenseVendor}>Vendor: {expense.vendor}</Text>
                  )}
                </View>
                
                <View style={styles.expenseActions}>
                  <Text style={styles.expenseAmount}>₹{expense.amount?.toLocaleString()}</Text>
                  <View style={styles.actionButtons}>
                    <TouchableOpacity 
                      onPress={() => openEditExpenseModal(expense, index)}
                      style={styles.actionButton}
                    >
                      <Ionicons name="create-outline" size={18} color="#2196F3" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => deleteExpense(expense.id)}
                      style={styles.actionButton}
                    >
                      <Ionicons name="trash" size={18} color="#F44336" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>
          
          {(activeTab === 'monthly' ? expenses : yearlyExpenses).length === 0 && (
            <View style={styles.noDataContainer}>
              <Ionicons name="receipt-outline" size={48} color="#ccc" />
              <Text style={styles.noDataText}>
                No expenses recorded {activeTab === 'monthly' ? 'this month' : 'this year'}
              </Text>
              <TouchableOpacity style={styles.addFirstButton} onPress={openAddExpenseModal}>
                <Text style={styles.addFirstButtonText}>Add First Expense</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Month Picker Modal */}
      {showMonthPicker && Platform.OS !== 'web' && (
        <DateTimePicker
          value={selectedMonth}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowMonthPicker(false);
            if (selectedDate) {
              setSelectedMonth(selectedDate);
            }
          }}
        />
      )}

      {/* Add/Edit Expense Modal */}
      <Modal
        visible={isExpenseModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsExpenseModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <ScrollView style={styles.modalScrollView} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>
                {editExpenseIndex !== null ? 'Edit Expense' : 'Add New Expense'}
              </Text>

              <TextInput
                placeholder="Expense Title *"
                value={expenseInput.title}
                onChangeText={text => setExpenseInput({ ...expenseInput, title: text })}
                style={styles.input}
              />

              <TextInput
                placeholder="Amount *"
                value={expenseInput.amount}
                onChangeText={text => setExpenseInput({ ...expenseInput, amount: text })}
                style={styles.input}
                keyboardType="numeric"
              />

              {/* Category Picker */}
              <Text style={styles.inputLabel}>Category *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryPicker}>
                {expenseCategories.map((category, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.categoryOption,
                      expenseInput.category === category.name && styles.categoryOptionSelected
                    ]}
                    onPress={() => setExpenseInput({ ...expenseInput, category: category.name })}
                  >
                    <Ionicons 
                      name={category.icon} 
                      size={16} 
                      color={expenseInput.category === category.name ? '#fff' : category.color} 
                    />
                    <Text style={[
                      styles.categoryOptionText,
                      expenseInput.category === category.name && styles.categoryOptionTextSelected
                    ]}>
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TextInput
                placeholder="Description"
                value={expenseInput.description}
                onChangeText={text => setExpenseInput({ ...expenseInput, description: text })}
                style={[styles.input, styles.textArea]}
                multiline
                numberOfLines={3}
              />

              <TextInput
                placeholder="Receipt Number"
                value={expenseInput.receipt_number}
                onChangeText={text => setExpenseInput({ ...expenseInput, receipt_number: text })}
                style={styles.input}
              />

              <TextInput
                placeholder="Vendor/Supplier"
                value={expenseInput.vendor}
                onChangeText={text => setExpenseInput({ ...expenseInput, vendor: text })}
                style={styles.input}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  onPress={() => setIsExpenseModalVisible(false)} 
                  style={[styles.modalButton, styles.cancelButton]}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={saveExpense} 
                  style={[styles.modalButton, styles.saveButton]}
                >
                  <Text style={styles.saveButtonText}>
                    {editExpenseIndex !== null ? 'Update' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Budget Management Modal */}
      <Modal
        visible={isBudgetModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsBudgetModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <ScrollView style={styles.modalScrollView} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Manage Category Budgets</Text>
              
              <Text style={styles.budgetModalSubtitle}>
                Set monthly budget limits for each expense category
              </Text>

              <View style={styles.budgetInputsContainer}>
                {expenseCategories.map((category, index) => {
                  const currentCategory = expenseStats.find(stat => stat.name === category.name);
                  const currentSpend = currentCategory?.amount || 0;
                  const budgetUsage = budgetInputs[category.name] > 0 
                    ? ((currentSpend / parseFloat(budgetInputs[category.name] || '0')) * 100).toFixed(1)
                    : 0;

                  return (
                    <View key={index} style={styles.budgetInputItem}>
                      <View style={styles.budgetInputHeader}>
                        <View style={styles.budgetCategoryInfo}>
                          <View style={[styles.budgetCategoryIcon, { backgroundColor: category.color }]}>
                            <Ionicons name={category.icon} size={16} color="#fff" />
                          </View>
                          <View style={styles.budgetCategoryDetails}>
                            <Text style={styles.budgetCategoryName}>{category.name}</Text>
                            <Text style={styles.budgetCategorySpend}>
                              Current: ₹{(currentSpend / 1000).toFixed(0)}K ({budgetUsage}% used)
                            </Text>
                          </View>
                        </View>
                      </View>
                      
                      <View style={styles.budgetInputWrapper}>
                        <Text style={styles.budgetInputLabel}>Monthly Budget</Text>
                        <TextInput
                          placeholder="Enter budget amount"
                          value={budgetInputs[category.name] || ''}
                          onChangeText={value => setBudgetInputs({
                            ...budgetInputs,
                            [category.name]: value
                          })}
                          style={styles.budgetInput}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>
                  );
                })}
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  onPress={() => setIsBudgetModalVisible(false)} 
                  style={[styles.modalButton, styles.cancelButton]}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={saveBudgets} 
                  style={[styles.modalButton, styles.saveButton]}
                >
                  <Text style={styles.saveButtonText}>Save Budgets</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      {/* Add/Edit Category Modal */}
      <Modal
        visible={isCategoryModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsCategoryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <ScrollView style={styles.modalScrollView} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>
                {editCategoryIndex !== null ? 'Edit Category' : 'Add New Category'}
              </Text>

              <TextInput
                placeholder="Category Name *"
                value={categoryInput.name}
                onChangeText={text => setCategoryInput({ ...categoryInput, name: text })}
                style={styles.input}
              />

              <TextInput
                placeholder="Monthly Budget *"
                value={categoryInput.monthly_budget}
                onChangeText={text => setCategoryInput({ ...categoryInput, monthly_budget: text })}
                style={styles.input}
                keyboardType="numeric"
              />

              {/* Icon Picker */}
              <Text style={styles.inputLabel}>Choose Icon</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryPicker}>
                {defaultCategoryIcons.map((iconName, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.iconOption,
                      categoryInput.icon === iconName && styles.iconOptionSelected
                    ]}
                    onPress={() => setCategoryInput({ ...categoryInput, icon: iconName })}
                  >
                    <Ionicons 
                      name={iconName} 
                      size={20} 
                      color={categoryInput.icon === iconName ? '#fff' : '#666'} 
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Color Picker */}
              <Text style={styles.inputLabel}>Choose Color</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryPicker}>
                {defaultCategoryColors.map((colorValue, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.colorOption,
                      { backgroundColor: colorValue },
                      categoryInput.color === colorValue && styles.colorOptionSelected
                    ]}
                    onPress={() => setCategoryInput({ ...categoryInput, color: colorValue })}
                  >
                    {categoryInput.color === colorValue && (
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  onPress={() => setIsCategoryModalVisible(false)} 
                  style={[styles.modalButton, styles.cancelButton]}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={saveCategory} 
                  style={[styles.modalButton, styles.saveButton]}
                >
                  <Text style={styles.saveButtonText}>
                    {editCategoryIndex !== null ? 'Update' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8',
  },
  scrollView: {
    flex: 1,
    padding: 18,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  // Date Display Styles
  dateContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    alignItems: 'center',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statsContainerVertical: {
    marginBottom: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 22,
    marginBottom: 18,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  chartContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 4,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
  budgetCardsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  budgetCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 8,
    minHeight: 200,
  },
  budgetCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    width: '47%',
    minHeight: 180,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  budgetCardOverBudget: {
    borderColor: '#F44336',
    borderWidth: 2,
    backgroundColor: '#fff5f5',
  },
  budgetCardNearLimit: {
    borderColor: '#FF9800',
    borderWidth: 2,
    backgroundColor: '#fff8f0',
  },
  budgetCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F44336',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
    minHeight: 32,
  },
  amountSection: {
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  categoryBudget: {
    fontSize: 12,
    color: '#666',
  },
  progressContainer: {
    width: '100%',
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  budgetStats: {
    alignItems: 'center',
  },
  budgetPercentage: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  remainingAmount: {
    fontSize: 10,
    color: '#4CAF50',
    fontWeight: '500',
  },
  overBudgetAmount: {
    fontSize: 10,
    color: '#F44336',
    fontWeight: '600',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  expensesList: {
    marginTop: 8,
    paddingBottom: 20,
  },
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  expenseIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e3f2fd',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  expenseDetails: {
    flex: 1,
  },
  expenseTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  expenseCategory: {
    fontSize: 13,
    color: '#2196F3',
    marginBottom: 2,
  },
  expenseDate: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  expenseVendor: {
    fontSize: 12,
    color: '#666',
  },
  expenseActions: {
    alignItems: 'flex-end',
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  actionButtons: {
    flexDirection: 'row',
  },
  actionButton: {
    marginLeft: 8,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDataContainer: {
    alignItems: 'center',
    padding: 40,
  },
  noDataText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
  },
  addFirstButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 12,
  },
  addFirstButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '90%',
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  modalScrollView: {
    maxHeight: '100%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginHorizontal: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 15,
    backgroundColor: '#fafafa',
    marginHorizontal: 20,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  categoryPicker: {
    marginBottom: 16,
    marginHorizontal: 20,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  categoryOptionSelected: {
    backgroundColor: '#2196F3',
  },
  categoryOptionText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
  },
  categoryOptionTextSelected: {
    color: '#fff',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: '#2196F3',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  // Budget Management Styles
  budgetHeaderLeft: {
    flex: 1,
  },
  budgetHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  manageBudgetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
    minWidth: 80,
    flexShrink: 0,
  },
  manageBudgetText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  budgetModalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    marginHorizontal: 20,
    fontStyle: 'italic',
  },
  budgetInputsContainer: {
    paddingHorizontal: 20,
  },
  budgetInputItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  budgetInputHeader: {
    marginBottom: 12,
  },
  budgetCategoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  budgetCategoryIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  budgetCategoryDetails: {
    flex: 1,
  },
  budgetCategoryName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  budgetCategorySpend: {
    fontSize: 12,
    color: '#666',
  },
  budgetInputWrapper: {
    marginTop: 8,
  },
  budgetInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  budgetInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#333',
  },
  // Tab Switcher Styles
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTab: {
    backgroundColor: '#2196F3',
    elevation: 1,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  // Category Card Action Styles
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardEditButton: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  cardDeleteButton: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(244,67,54,0.1)',
  },
  
  // Category Modal Styles
  iconOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  iconOptionSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#1976D2',
  },
  colorOption: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: '#333',
    borderWidth: 3,
  },
  
  // Special style for Recent Expenses section
  recentExpensesSection: {
    marginBottom: 60,
  },
});

export default ExpenseManagement;
