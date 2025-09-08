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
import CrossPlatformDatePicker, { DatePickerButton } from '../../components/CrossPlatformDatePicker';
import CrossPlatformPieChart from '../../components/CrossPlatformPieChart';
import { supabase, dbHelpers } from '../../utils/supabase';
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { useTenant } from '../../contexts/TenantContext';
import { validateTenantAccess, createTenantQuery, validateDataTenancy, TENANT_ERROR_MESSAGES } from '../../utils/tenantValidation';
import { useAuth } from '../../utils/AuthContext';

const { width } = Dimensions.get('window');

const ExpenseManagement = ({ navigation }) => {
  const { tenantId, tenantName, currentTenant } = useTenant();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showExpenseDatePicker, setShowExpenseDatePicker] = useState(false);
  
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
    date: format(new Date(), 'yyyy-MM-dd')
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


  const loadExpenseData = async () => {
    try {
      // 🛡️ Validate tenant access first
      const validation = await validateTenantAccess(tenantId, user?.id, 'ExpenseManagement - loadExpenseData');
      if (!validation.isValid) {
        console.error('❌ ExpenseManagement loadExpenseData: Tenant validation failed:', validation.error);
        Alert.alert('Access Denied', validation.error);
        setLoading(false);
        return;
      }
      
      console.log('🔍 ExpenseManagement: Starting data load...');
      setLoading(true);
      
      // Get date range for selected month
      const monthStart = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');
      console.log('📅 Date range:', { monthStart, monthEnd, selectedMonth });
      
      // Test database connection with tenant-aware query
      console.log('🔗 Testing database connection with tenant validation...');
      try {
        const { data: testData, error: testError } = await createTenantQuery(tenantId, 'school_expenses')
          .select('count')
          .limit(1)
          .execute();
        console.log('🔗 Database connection test:', { testData, testError });
        
        if (testError) {
          console.error('❌ Table does not exist or access denied:', testError);
          Alert.alert('Database Error', 'The expense tables may not exist or you do not have access. Please contact administrator.');
          return;
        }
      } catch (testErr) {
        console.error('❌ Database connection failed:', testErr);
        Alert.alert('Database Error', 'Failed to connect to expense database. Please contact administrator.');
        return;
      }
      
      // Fetch monthly expenses from database
      console.log('📥 Fetching monthly expenses...');
      const { data: monthlyExpenses, error: monthlyError } = await dbHelpers.getExpenses({
        startDate: monthStart,
        endDate: monthEnd,
        tenantId: tenantId
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

      // 🛡️ Validate expense data belongs to correct tenant
      if (monthlyExpenses && monthlyExpenses.length > 0) {
        const expensesValid = validateDataTenancy(monthlyExpenses, tenantId, 'ExpenseManagement - Monthly Expenses');
        if (!expensesValid) {
          Alert.alert('Data Security Alert', 'Expense data validation failed. Please contact administrator.');
          setExpenses([]);
          setMonthlyTotal(0);
          return;
        }
      }
      
      // Set expenses from database (empty array if no data)
      setExpenses(monthlyExpenses || []);
      console.log('✅ Set expenses state:', monthlyExpenses?.length || 0, 'items');

      // Calculate monthly total from database data
      const monthlySum = (monthlyExpenses || []).reduce((sum, expense) => sum + (expense.amount || 0), 0);
      setMonthlyTotal(monthlySum);
      console.log('💰 Monthly total from DB:', monthlySum);

      // Get yearly expenses
      const currentYear = selectedMonth.getFullYear();
      const yearStart = `${currentYear}-01-01`;
      const yearEnd = `${currentYear}-12-31`;
      console.log('📅 Fetching yearly expenses for:', { yearStart, yearEnd });
      
      const { data: yearlyExpenses, error: yearlyError } = await dbHelpers.getExpenses({
        startDate: yearStart,
        endDate: yearEnd,
        tenantId: tenantId
      });

      if (yearlyError) {
        console.error('❌ Error fetching yearly expenses:', yearlyError);
        setYearlyExpenses([]);
        setYearlyTotal(0);
      } else {
        // 🛡️ Validate yearly expense data belongs to correct tenant
        if (yearlyExpenses && yearlyExpenses.length > 0) {
          const yearlyExpensesValid = validateDataTenancy(yearlyExpenses, tenantId, 'ExpenseManagement - Yearly Expenses');
          if (!yearlyExpensesValid) {
            Alert.alert('Data Security Alert', 'Yearly expense data validation failed. Please contact administrator.');
            setYearlyExpenses([]);
            setYearlyTotal(0);
            return;
          }
        }
        
        const yearlySum = (yearlyExpenses || []).reduce((sum, expense) => sum + (expense.amount || 0), 0);
        setYearlyTotal(yearlySum);
        setYearlyExpenses(yearlyExpenses || []);
        console.log('📊 Yearly total:', yearlySum, 'from', yearlyExpenses?.length || 0, 'expenses');
      }

      // Wait for categories to be loaded before calculating breakdown
      if (expenseCategories.length === 0) {
        console.log('⏳ Categories not loaded yet, skipping calculation...');
        return;
      }

      // Calculate category-wise breakdown for monthly data
      console.log('📊 Calculating monthly category breakdown...');
      const monthlyTotalForCalculation = monthlySum;
      const categoryBreakdown = expenseCategories.map(category => {
        const categoryExpenses = (monthlyExpenses || []).filter(exp => exp.category === category.name);
        const categoryTotal = categoryExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
        
        // Use category's monthly_budget from database
        const categoryBudget = category.monthly_budget || 0;
        
        console.log(`📊 Monthly Category ${category.name}:`, {
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
      console.log('📊 Monthly category stats set:', categoryBreakdown.length, 'categories');

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
      const yearlyTotalForCalculation = (yearlyExpenses || []).reduce((sum, expense) => sum + (expense.amount || 0), 0);
      
      const yearlyCategoryBreakdown = expenseCategories.map(category => {
        const categoryExpenses = (yearlyExpenses || []).filter(exp => exp.category === category.name);
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
        const { data: dbCategories, error: categoriesError } = await dbHelpers.getExpenseCategories(tenantId);
        
        if (categoriesError) {
          console.error('❌ Error fetching categories on mount:', categoriesError);
        } else if (dbCategories && dbCategories.length > 0) {
          // Add default UI fields for categories loaded from database
          const defaultCategoryMappings = {
            'Staff Salaries': { icon: 'people', color: '#2196F3' },
            'Utilities': { icon: 'flash', color: '#FF9800' },
            'Supplies & Materials': { icon: 'library', color: '#4CAF50' },
            'Infrastructure': { icon: 'build', color: '#9C27B0' },
            'Transportation': { icon: 'car', color: '#F44336' },
            'Food & Catering': { icon: 'restaurant', color: '#FF5722' },
            'Events & Activities': { icon: 'calendar', color: '#607D8B' },
            'Technology': { icon: 'desktop', color: '#795548' },
            'Marketing': { icon: 'megaphone', color: '#E91E63' },
            'Miscellaneous': { icon: 'ellipsis-horizontal', color: '#009688' }
          };
          
          const categoriesWithUIFields = dbCategories.map(category => ({
            ...category,
            icon: category.icon || defaultCategoryMappings[category.name]?.icon || 'briefcase',
            color: category.color || defaultCategoryMappings[category.name]?.color || '#2196F3'
          }));
          
          setExpenseCategories(categoriesWithUIFields);
          console.log('✅ Categories loaded on mount:', categoriesWithUIFields.length, 'categories');
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
      date: format(new Date(), 'yyyy-MM-dd')
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
      date: expense.expense_date
    });
    setEditExpenseIndex(index);
    setIsExpenseModalVisible(true);
  };

  const saveExpense = async () => {
    // 🛡️ Validate tenant access first
    const validation = await validateTenantAccess(tenantId, user?.id, 'ExpenseManagement - saveExpense');
    if (!validation.isValid) {
      Alert.alert('Access Denied', validation.error);
      return;
    }

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

      let expenseId = null;
      
      if (editExpenseIndex !== null) {
        // Update existing expense using helper function
        expenseId = expenses[editExpenseIndex].id;
        const { error } = await dbHelpers.updateExpense(expenseId, expenseData, tenantId);

        if (error) throw error;
      } else {
        // Create new expense using helper function
        const { data, error } = await dbHelpers.createExpense(expenseData, tenantId);

        if (error) throw error;
        expenseId = data?.id;
      }

      // Verify the operation completed before refreshing
      if (expenseId) {
        console.log('🔄 Verifying expense operation completed for ID:', expenseId);
        
        // Brief delay to allow database consistency
        await new Promise(resolve => setTimeout(resolve, 300));
        
        try {
          // Verify the expense exists in the database using tenant-aware query
          const { data: verifyData, error: verifyError } = await createTenantQuery(tenantId, 'school_expenses')
            .select('id, title, amount')
            .eq('id', expenseId)
            .single()
            .execute();

          if (verifyError || !verifyData) {
            console.warn('⚠️ Expense verification failed, waiting longer...', verifyError);
            // Wait a bit longer and try refresh anyway
            await new Promise(resolve => setTimeout(resolve, 500));
          } else {
            console.log('✅ Expense operation verified successfully:', verifyData);
          }
        } catch (verifyErr) {
          console.warn('⚠️ Expense verification error, continuing with refresh:', verifyErr);
        }
      }

      // Now refresh the data
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
              // 🛡️ Validate tenant access first
              const validation = await validateTenantAccess(tenantId, user?.id, 'ExpenseManagement - deleteExpense');
              if (!validation.isValid) {
                Alert.alert('Access Denied', validation.error);
                return;
              }

              const { error } = await dbHelpers.deleteExpense(expenseId, tenantId);

              if (error) throw error;
              
              // Verify the deletion completed before refreshing
              console.log('🔄 Verifying expense deletion for ID:', expenseId);
              
              // Brief delay to allow database consistency
              await new Promise(resolve => setTimeout(resolve, 300));
              
              try {
                // Verify the expense no longer exists in the database using tenant-aware query
                const { data: verifyData, error: verifyError } = await createTenantQuery(tenantId, 'school_expenses')
                  .select('id')
                  .eq('id', expenseId)
                  .single()
                  .execute();

                if (!verifyError && verifyData) {
                  console.warn('⚠️ Expense still exists after deletion, waiting longer...');
                  // Wait a bit longer and try refresh anyway
                  await new Promise(resolve => setTimeout(resolve, 500));
                } else {
                  console.log('✅ Expense deletion verified successfully');
                }
              } catch (verifyErr) {
                console.warn('⚠️ Expense deletion verification error, continuing with refresh:', verifyErr);
              }
              
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
      // 🛡️ Validate tenant access first
      const validation = await validateTenantAccess(tenantId, user?.id, 'ExpenseManagement - saveBudgets');
      if (!validation.isValid) {
        Alert.alert('Access Denied', validation.error);
        return;
      }

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
        }, tenantId);
        
        if (error) {
          console.error('Error updating budget for', update.name, error);
          Alert.alert('Error', `Failed to update budget for ${update.name}`);
          return;
        }
      }
      
      // Verify budget updates completed before refreshing
      console.log('🔄 Verifying budget updates completed...');
      
      // Brief delay to allow database consistency
      await new Promise(resolve => setTimeout(resolve, 300));
      
      try {
        // Verify at least one budget update is reflected in the database
        if (budgetUpdates.length > 0) {
          const firstUpdate = budgetUpdates[0];
          const { data: verifyData, error: verifyError } = await supabase
            .from('school_expense_categories')
            .select('name, monthly_budget')
            .eq('name', firstUpdate.name)
            .eq('tenant_id', tenantId)
            .single();

          if (verifyError || !verifyData || verifyData.monthly_budget !== firstUpdate.monthly_budget) {
            console.warn('⚠️ Budget verification failed, waiting longer...', verifyError);
            await new Promise(resolve => setTimeout(resolve, 500));
          } else {
            console.log('✅ Budget updates verified successfully:', verifyData);
          }
        }
      } catch (verifyErr) {
        console.warn('⚠️ Budget verification error, continuing with refresh:', verifyErr);
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
        // Create category with only the columns that exist in the database
        const basicCategory = {
          name: category.name,
          monthly_budget: category.monthly_budget
        };
        
        const { data, error } = await dbHelpers.createExpenseCategory(basicCategory, tenantId);
        
        if (error) {
          console.error('Error creating default category:', category.name, error);
        } else if (data) {
          // Add UI-only fields that don't exist in database for local state
          const categoryWithUIFields = {
            ...data,
            icon: category.icon,
            color: category.color
          };
          createdCategories.push(categoryWithUIFields);
        }
      }
      
      if (createdCategories.length > 0) {
        setExpenseCategories(createdCategories);
        console.log('✅ Created default categories:', createdCategories.length);
      } else {
        // Fallback: use local categories for UI if database creation fails
        console.warn('⚠️ Database category creation failed, using local categories for UI');
        setExpenseCategories(defaultCategories.map(cat => ({...cat, id: Date.now() + Math.random()})));
      }
    } catch (error) {
      console.error('Error creating default categories:', error);
      // Fallback: use local categories for UI if everything fails
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
      // Only include fields that exist in the database schema
      const databaseCategoryData = {
        name: categoryInput.name,
        monthly_budget: budget
      };
      
      if (editCategoryIndex !== null) {
        // Update existing category
        const categoryToUpdate = expenseCategories[editCategoryIndex];
        const { error } = await dbHelpers.updateExpenseCategory(categoryToUpdate.name, databaseCategoryData, tenantId);
        
        if (error) throw error;
        
        // Update local state with all UI fields
        const updatedCategories = [...expenseCategories];
        updatedCategories[editCategoryIndex] = { 
          ...categoryToUpdate, 
          ...databaseCategoryData,
          icon: categoryInput.icon,
          color: categoryInput.color
        };
        setExpenseCategories(updatedCategories);
      } else {
        // Create new category
        const { data, error } = await dbHelpers.createExpenseCategory(databaseCategoryData, tenantId);
        
        if (error) throw error;
        
        // Add to local state with UI fields
        const categoryWithUIFields = {
          ...data,
          icon: categoryInput.icon,
          color: categoryInput.color
        };
        setExpenseCategories([...expenseCategories, categoryWithUIFields]);
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
              const { error } = await dbHelpers.deleteExpenseCategory(categoryName, tenantId);
              
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
      
      <View style={styles.scrollWrapper}>
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={Platform.OS === 'web'}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#2196F3']}
              tintColor="#2196F3"
            />
          }
          keyboardShouldPersistTaps="handled"
          bounces={Platform.OS !== 'web'}
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
      </View>

      {/* Month Picker Modal - Only show on mobile platforms */}
      {Platform.OS !== 'web' && showMonthPicker && (
        <CrossPlatformDatePicker
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

      {/* Expense Date Picker Modal - Only show on mobile platforms */}
      {Platform.OS !== 'web' && showExpenseDatePicker && (
        <CrossPlatformDatePicker
          value={new Date(expenseInput.date)}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowExpenseDatePicker(false);
            if (selectedDate) {
              setExpenseInput({ 
                ...expenseInput, 
                date: format(selectedDate, 'yyyy-MM-dd') 
              });
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
              <Text style={styles.inputLabel}>Category</Text>
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

              {/* Date Picker */}
              <Text style={styles.inputLabel}>Expense Date *</Text>
              {Platform.OS === 'web' ? (
                <CrossPlatformDatePicker
                  label="Expense Date"
                  value={new Date(expenseInput.date)}
                  onChange={(event, selectedDate) => {
                    if (selectedDate) {
                      setExpenseInput({ 
                        ...expenseInput, 
                        date: format(selectedDate, 'yyyy-MM-dd') 
                      });
                    }
                  }}
                  mode="date"
                  placeholder="Select Expense Date"
                  containerStyle={{ marginBottom: 16 }}
                />
              ) : (
                <DatePickerButton
                  label="Expense Date"
                  value={new Date(expenseInput.date)}
                  onPress={() => setShowExpenseDatePicker(true)}
                  placeholder="Select Expense Date"
                  mode="date"
                  style={styles.datePickerButton}
                  displayFormat={(date) => format(date, 'MMM dd, yyyy')}
                />
              )}

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
  scrollWrapper: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      height: 'calc(100vh - 160px)',
      maxHeight: 'calc(100vh - 160px)',
      minHeight: '400px',
      overflow: 'hidden',
    })
  },
  scrollContainer: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      overflowY: 'auto'
    })
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 300,
    flexGrow: 1,
    ...(Platform.OS === 'web' && {
      paddingBottom: 600
    })
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
  
  // Date Picker Button Styles
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    backgroundColor: '#fafafa',
    marginHorizontal: 20,
  },
  datePickerText: {
    fontSize: 15,
    color: '#333',
    marginLeft: 8,
  },
});

export default ExpenseManagement;
