import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, TextInput, Button, Alert, ScrollView, ActivityIndicator, RefreshControl, Platform, Dimensions } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Header from '../../components/Header';
import CrossPlatformDatePicker, { DatePickerButton } from '../../components/CrossPlatformDatePicker';
import { format } from 'date-fns';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';
import { useTenant } from '../../contexts/TenantContext';
import { tenantDatabase, initializeTenantHelpers, getCachedTenantId } from '../../utils/tenantHelpers';
import { getCurrentUserTenantByEmail } from '../../utils/getTenantByEmail';
import { useAuth } from '../../utils/AuthContext';


// Helper to calculate duration in minutes
function getDuration(start, end) {
  if (!start || !end || typeof start !== 'string' || typeof end !== 'string') return 0;
  try {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0;
    return (eh * 60 + em) - (sh * 60 + sm);
  } catch (error) {
    console.error('Error calculating duration:', error);
    return 0;
  }
}

// Helper to format time (24h to 12h)
function formatTime(t) {
  if (!t || typeof t !== 'string') return '';
  try {
    let [h, m] = t.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return t; // Return original if parsing fails
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
  } catch (error) {
    console.error('Error formatting time:', error);
    return t; // Return original string if error
  }
}

const SubjectsTimetable = ({ route }) => {
  const { classId } = route?.params || {};
  const { 
    tenantId, 
    isReady, 
    loading: tenantLoading, 
    currentTenant: tenant, 
    tenantName, 
    error: tenantError,
    initializeTenant: initializeTenantContext
  } = useTenant();
  const { user } = useAuth();
  
  // 🔍 DEBUG: Log tenant info on component load
  console.log('🏢 SubjectsTimetable - Enhanced Tenant Debug:', {
    tenantId,
    tenantName,
    isReady,
    tenantLoading,
    tenantError: tenantError?.message || 'none',
    tenant: tenant ? 'SET' : 'NULL',
    classId
  });
  const [tab, setTab] = useState(classId ? 'timetable' : 'subjects');
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editSubject, setEditSubject] = useState(null);
  const [subjectForm, setSubjectForm] = useState({ name: '', teacherId: '' });
  const [selectedClass, setSelectedClass] = useState(classId || null);
  const [timetables, setTimetables] = useState({});
  const [periodModal, setPeriodModal] = useState({ visible: false, day: '', period: null });
  const [periodForm, setPeriodForm] = useState({ type: 'subject', subjectId: '', label: '', startTime: '', endTime: '', room: '' });
  const [showTimePicker, setShowTimePicker] = useState({ visible: false, field: '', value: new Date() });
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [copyDayModal, setCopyDayModal] = useState({ visible: false });
  const [periodSettingsModal, setPeriodSettingsModal] = useState({ visible: false });
  const [periodSettings, setPeriodSettings] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedDayData, setCopiedDayData] = useState(null);
  const [copiedSourceDay, setCopiedSourceDay] = useState('');
  const [screenData, setScreenData] = useState(Dimensions.get('window'));
  const [subjectModalError, setSubjectModalError] = useState(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Enhanced tenant system - simplified validation
  const isTenantReady = () => {
    // First check the context-based tenant
    if (isReady && !tenantLoading && !tenantError && tenantId) {
      return true;
    }
    
    // Fallback: check if tenant helpers have been initialized directly
    const cachedTenantId = getCachedTenantId();
    if (cachedTenantId && user) {
      console.log('🚀 SubjectsTimetable: Using cached tenant ID fallback:', cachedTenantId);
      return true;
    }
    
    return false;
  };
  
  // Initialize tenant helpers when tenantId is available
  React.useEffect(() => {
    if (tenantId && isReady) {
      console.log('🚀 SubjectsTimetable: Initializing tenant helpers with ID:', tenantId);
      initializeTenantHelpers(tenantId);
    } else {
      console.log('⚠️ SubjectsTimetable: Tenant helpers not ready yet:', {
        tenantId: tenantId || 'NULL',
        isReady,
        tenantLoading,
        tenantError: tenantError?.message || 'none'
      });
    }
  }, [tenantId, isReady, tenantLoading, tenantError]);
  
  // Immediate tenant initialization check on component mount
  React.useEffect(() => {
    const checkAndInitializeTenant = async () => {
      console.log('🚀 SubjectsTimetable: Component mounted, checking tenant status...');
      
      if (user && !isReady && !tenantLoading && !tenantError) {
        console.log('🔄 SubjectsTimetable: User authenticated but tenant not ready, forcing initialization...');
        
        try {
          // Try both context initialization and manual helpers initialization
          if (initializeTenantContext) {
            const contextResult = await initializeTenantContext();
            console.log('🏢 SubjectsTimetable: Context init result:', contextResult);
            
            if (contextResult?.success && contextResult?.tenantId) {
              initializeTenantHelpers(contextResult.tenantId);
              return;
            }
          }
          
          // Fallback to direct tenant lookup
          const directResult = await getCurrentUserTenantByEmail();
          console.log('📧 SubjectsTimetable: Direct lookup result:', directResult.success);
          
          if (directResult.success) {
            initializeTenantHelpers(directResult.data.tenantId);
          }
          
        } catch (error) {
          console.error('❌ SubjectsTimetable: Mount-time tenant init failed:', error);
        }
      }
    };
    
    // Run after a short delay to allow context to settle
    const timer = setTimeout(checkAndInitializeTenant, 500);
    return () => clearTimeout(timer);
  }, [user, isReady, tenantLoading, tenantError, initializeTenantContext]);
  
  // Fallback effect: If tenant is not ready after initial load, try manual initialization
  React.useEffect(() => {
    const timer = setTimeout(async () => {
      if (!isReady && !tenantLoading && user && !tenantError) {
        console.log('⚠️ SubjectsTimetable: Tenant not ready after 3s, attempting manual initialization...');
        try {
          const result = await getCurrentUserTenantByEmail();
          if (result.success) {
            console.log('✅ SubjectsTimetable: Manual tenant lookup successful:', result.data.tenantId);
            initializeTenantHelpers(result.data.tenantId);
            
            // Force a component re-render to check if tenant helpers are now working
            setRefreshCounter(prev => prev + 1);
          } else {
            console.error('❌ SubjectsTimetable: Manual tenant lookup failed:', result.error);
            setError(`Failed to initialize tenant: ${result.error}`);
          }
        } catch (error) {
          console.error('❌ SubjectsTimetable: Exception during manual tenant init:', error);
          setError(`Failed to initialize tenant: ${error.message}`);
        }
      }
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [isReady, tenantLoading, user, tenantError]);
  
  // Immediate effect: Check tenant context every 2 seconds and provide status
  React.useEffect(() => {
    const statusInterval = setInterval(() => {
      console.log('🔍 SubjectsTimetable: Tenant Status Check:', {
        isReady,
        tenantId,
        tenantLoading,
        tenantError: tenantError?.message || 'none',
        tenant: tenant ? 'SET' : 'NULL',
        user: user ? user.email : 'NULL'
      });
      
      // If we have a user but no tenant context, something is wrong
      if (user && !isReady && !tenantLoading && !tenantError) {
        console.log('🚨 SubjectsTimetable: CRITICAL - User authenticated but tenant context not ready!');
        
        // Try to trigger tenant context initialization
        if (initializeTenantContext) {
          console.log('🚀 SubjectsTimetable: Attempting to trigger tenant context initialization...');
          initializeTenantContext().then(result => {
            console.log('📄 SubjectsTimetable: Tenant context initialization result:', result);
            if (result?.success && result?.tenantId) {
              initializeTenantHelpers(result.tenantId);
              setRefreshCounter(prev => prev + 1);
            }
          }).catch(error => {
            console.error('❌ SubjectsTimetable: Tenant context initialization failed:', error);
          });
        }
      }
    }, 2000);
    
    return () => clearInterval(statusInterval);
  }, [isReady, tenantId, tenantLoading, tenantError, tenant, user]);

  // Add screen dimension change listener
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenData(window);
    });

    return () => subscription?.remove();
  }, []);

  // Track component lifecycle for debugging
  useEffect(() => {
    console.log('🎆 SubjectsTimetable: Component mounted');
    return () => {
      console.log('📍 SubjectsTimetable: Component unmounting');
    };
  }, []);

  // Track navigation events on web
  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleBeforeUnload = (e) => {
        console.log('⚠️ Web: Page is about to unload/refresh!');
        e.preventDefault();
        e.returnValue = '';
      };
      
      const handleUnload = () => {
        console.log('📍 Web: Page unloaded/refreshed!');
      };
      
      window.addEventListener('beforeunload', handleBeforeUnload);
      window.addEventListener('unload', handleUnload);
      
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        window.removeEventListener('unload', handleUnload);
      };
    }
  }, []);

  // Set current day on component mount
  useEffect(() => {
    const getCurrentDay = () => {
      const today = new Date();
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const currentDayName = dayNames[today.getDay()];
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      
      // If it's Sunday, default to Monday since school timetables don't include Sunday
      if (currentDayName === 'Sunday') {
        setSelectedDay('Monday');
      } else if (days.includes(currentDayName)) {
        setSelectedDay(currentDayName);
      }
    };
    
    getCurrentDay();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const startTime = performance.now();
      let timeoutId;
      
      try {
        console.log('🚀 SubjectsTimetable: Starting optimized data load...');
        setLoading(true);
        setError(null);
        
        // ⏰ Set timeout protection
        timeoutId = setTimeout(() => {
          console.warn('⚠️ SubjectsTimetable: Load timeout (10s)');
          throw new Error('Loading timeout - please check your connection');
        }, 10000);
        
        // 🔍 Enhanced tenant readiness check with detailed debugging
        const tenantReadyStatus = isTenantReady();
        const cachedTenantId = getCachedTenantId();
        
        console.log('🔍 SubjectsTimetable: Detailed tenant status:', {
          tenantReadyStatus,
          contextTenantId: tenantId,
          cachedTenantId,
          isReady,
          tenantLoading,
          tenantError: tenantError?.message || 'none',
          user: user?.email || 'none'
        });
        
        if (!tenantReadyStatus) {
          console.log('🔄 SubjectsTimetable: Tenant context not ready, waiting...');
          setLoading(false);
          return;
        }
        
        const effectiveTenantId = tenantId || cachedTenantId;
        console.log('🚀 SubjectsTimetable.fetchData: Using effective tenant_id:', effectiveTenantId);
        
        console.log('🚀 SubjectsTimetable.fetchData: Starting with tenant_id:', tenantId);
        
        // 🏃‍♂️ Fast parallel data fetching
        console.log('📊 SubjectsTimetable: Fetching data in parallel...');
        
        // 🚀 Use enhanced tenant database helpers for parallel data fetching
        const [classesResult, teachersResult, subjectsResult] = await Promise.all([
          tenantDatabase.read('classes', {}, '*'),
          tenantDatabase.read('teachers', {}, '*'),
          tenantDatabase.read('subjects', {}, `
            *,
            teacher_subjects(
              teachers(id, name)
            ),
            classes(
              id,
              class_name,
              section
            )
          `)
        ]);
        
        if (classesResult.error) throw classesResult.error;
        if (teachersResult.error) throw teachersResult.error;
        if (subjectsResult.error) throw subjectsResult.error;
        
        clearTimeout(timeoutId);
        
        // ✅ Set data immediately
        const classData = classesResult.data || [];
        const teacherData = teachersResult.data || [];
        const subjectData = subjectsResult.data || [];
        
        setClasses(classData);
        setTeachers(teacherData);
        setSubjects(subjectData);
        
        console.log(`✅ SubjectsTimetable: Loaded ${classData.length} classes, ${teacherData.length} teachers, ${subjectData.length} subjects`);
        
        const defaultClassId = classId || classData?.[0]?.id || null;
        setSelectedClass(defaultClassId);

        // 📊 Performance: Fetch period settings
        console.log('⏰ SubjectsTimetable: Fetching period settings...');
        try {
          console.log('🔍 About to query PERIOD_SETTINGS table...');
          const { data: periodData, error: periodError } = await supabase
            .from(TABLES.PERIOD_SETTINGS)
            .select('*')
            .eq('tenant_id', effectiveTenantId)
            .single();
          
          console.log('📊 Period settings query completed:', {
            hasData: !!periodData,
            hasError: !!periodError,
            errorCode: periodError?.code,
            errorMessage: periodError?.message
          });
          
          if (periodError) {
            console.warn('⚠️ Period settings error:', (periodError.message || 'Unknown error'));
            // Use default if error
            setPeriods(Array.from({ length: 8 }, (_, i) => i + 1));
          } else {
            console.log('✅ Processing period data:', periodData);
            const calculatedPeriods = Array.from({ 
              length: periodData?.number_of_periods || 8 
            }, (_, i) => i + 1);
            setPeriods(calculatedPeriods);
            console.log('✅ Periods configured:', calculatedPeriods.length);
          }
        } catch (periodSettingsError) {
          console.error('❌ Error in period settings section:', periodSettingsError);
          console.error('❌ Error stack:', periodSettingsError.stack);
          // Use default periods as fallback
          setPeriods(Array.from({ length: 8 }, (_, i) => i + 1));
        }

        // 📊 Performance: Fetch timetable data if class is selected
        if (defaultClassId) {
          console.log('🗓️ SubjectsTimetable: Loading timetable for class:', defaultClassId);
          const timetableStart = Date.now();
          
          // 🚀 Use enhanced tenant database for timetable data
          const { data: timetableData, error: timetableError } = await tenantDatabase.read(
            'timetable_entries',
            { class_id: defaultClassId },
            `*, subjects(id, name)`
          );
          
          if (timetableError) throw timetableError;
          
          // Process timetable data
          const grouped = {
            Monday: [],
            Tuesday: [],
            Wednesday: [],
            Thursday: [],
            Friday: [],
            Saturday: [],
            Sunday: []
          };

          timetableData?.forEach(period => {
            const dayName = period?.day_of_week;
            if (dayName && grouped[dayName]) {
              grouped[dayName].push({
                id: period.id,
                type: 'subject',
                subjectId: period.subject_id,
                subject: period.subjects || null,
                startTime: period.start_time,
                endTime: period.end_time,
                label: period.subjects?.name || 'Unknown Subject'
              });
            }
          });

          // Sort periods by start time for each day
          Object.keys(grouped).forEach(day => {
            grouped[day].sort((a, b) => {
              const timeA = a.startTime || '00:00';
              const timeB = b.startTime || '00:00';
              return timeA.localeCompare(timeB);
            });
          });

          setTimetables(prev => ({ ...prev, [defaultClassId]: grouped }));
          console.log(`📅 Timetable loaded: ${timetableData?.length || 0} entries in ${Date.now() - timetableStart}ms`);
          console.log('🔎 Timetable data summary by day:', Object.entries(grouped).map(([day, periods]) => `${day}: ${periods.length} periods`).join(', '));
          
          // Force UI refresh after loading timetable
          setRefreshCounter(prev => prev + 1);
        } else {
          console.log('ℹ️ No default class selected, skipping timetable fetch');
        }
        
        const totalTime = performance.now() - startTime;
        console.log(`✅ SubjectsTimetable: All data loaded in ${totalTime.toFixed(2)}ms for tenant:`, tenantId);
        
      } catch (err) {
        clearTimeout(timeoutId);
        console.error('❌ SubjectsTimetable.fetchData: Error loading data for tenant:', tenantId, err);
        setError('Failed to load timetable data: ' + (err.message || 'Unknown error'));
      } finally {
        setLoading(false);
      }
    };
    
    // Always run on component mount - tenant validation happens inside fetchData
    fetchData();
  }, [isReady, tenantId, tenantError]);

  // 🚀 Optimized timetable fetching for class selection changes
  const fetchTimetableForClass = async (classId) => {
    // 🔍 Enhanced tenant system check
    if (!isTenantReady()) {
      console.error('❌ fetchTimetableForClass: Tenant context not ready');
      return;
    }
    
    console.log('🔍 fetchTimetableForClass - using tenantId:', tenantId, 'for classId:', classId);
    const fetchStart = Date.now();
    
    try {
      console.log('🔍 fetchTimetableForClass: Starting Supabase query...');
      
      // Fetch timetable with strict tenant filtering (simplified query first)
      console.log('📎 fetchTimetableForClass: Attempting simplified query first...');
      
      // 🚀 Use enhanced tenant database helper
      const { data: timetableData, error: timetableError } = await tenantDatabase.read(
        'timetable_entries',
        { class_id: classId },
        '*'
      );
      
      console.log('📄 fetchTimetableForClass: Query completed', {
        dataCount: timetableData?.length || 0,
        hasError: !!timetableError,
        errorMessage: timetableError?.message
      });
      
      if (timetableError) {
        console.error('❌ fetchTimetableForClass: Supabase error:', timetableError);
        throw timetableError;
      }

      try {
        // Group timetable by day
        const grouped = {
          Monday: [],
          Tuesday: [],
          Wednesday: [],
          Thursday: [],
          Friday: [],
          Saturday: [],
          Sunday: []
        };

        console.log('📊 fetchTimetableForClass: Processing', timetableData?.length || 0, 'timetable entries');
        
        if (timetableData && Array.isArray(timetableData)) {
          timetableData.forEach((period, index) => {
            try {
              const dayName = period?.day_of_week;
              console.log(`🗓️ Period ${index + 1}:`, {
                day: dayName,
                startTime: period?.start_time,
                endTime: period?.end_time,
                subjectId: period?.subject_id,
                fullPeriod: period
              });
              
              if (dayName && grouped[dayName]) {
                // Find subject name from the subjects array (since we're not joining)
                const subject = subjects.find(s => s.id === period.subject_id);
                
                grouped[dayName].push({
                  id: period.id,
                  type: 'subject',
                  subjectId: period.subject_id,
                  subject: subject ? { id: subject.id, name: subject.name } : null,
                  startTime: period.start_time,
                  endTime: period.end_time,
                  label: subject?.name || 'Unknown Subject'
                });
              } else {
                console.warn('⚠️ Unknown or missing day name:', dayName, 'for period:', period);
              }
            } catch (periodError) {
              console.error('❌ Error processing period', index + 1, ':', periodError, 'Period data:', period);
            }
          });
        } else {
          console.log('ℹ️ No timetable data or data is not an array');
        }

        // Sort periods by start time for each day
        try {
          Object.keys(grouped).forEach(day => {
            grouped[day].sort((a, b) => {
              const timeA = a.startTime || '00:00';
              const timeB = b.startTime || '00:00';
              return timeA.localeCompare(timeB);
            });
          });
          console.log('✅ Sorting completed successfully');
        } catch (sortError) {
          console.error('❌ Error during sorting:', sortError);
          // Continue without sorting if there's an error
        }

        setTimetables(prev => {
          const newState = { ...prev, [classId]: grouped };
          console.log('🔄 fetchTimetableForClass: Updated timetables state for class:', classId);
          console.log('🔄 fetchTimetableForClass: Current timetables keys:', Object.keys(newState));
          console.log('🔄 fetchTimetableForClass: New grouped data summary:', Object.entries(grouped).map(([day, periods]) => `${day}: ${periods.length}`).join(', '));
          return newState;
        });
        
        // Force UI refresh to ensure pickers show updated data
        setRefreshCounter(prev => prev + 1);
        
        const fetchTime = Date.now() - fetchStart;
        console.log(`📅 Timetable updated for class ${classId}: ${timetableData?.length || 0} entries in ${fetchTime}ms`);
        
      } catch (processingError) {
        console.error('❌ Error during timetable processing:', processingError);
        throw processingError;
      }
      
    } catch (err) {
      console.error('❌ Error in fetchTimetableForClass:', {
        error: err,
        message: err.message,
        stack: err.stack,
        classId: classId,
        tenant_id: tenantId
      });
      setError('Failed to load timetable for selected class: ' + (err.message || 'Unknown error'));
    }
  };

  const getDayName = (dayNumber) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayNumber] || 'Monday';
  };

  useEffect(() => {
    // When selectedClass changes, fetch timetable for that class
    const fetchClassData = async () => {
      if (!selectedClass) return;
      await fetchTimetableForClass(selectedClass);
    };
    fetchClassData();
  }, [selectedClass]);

  // Subject CRUD
  const openAddSubject = () => {
    setEditSubject(null);
    setSubjectForm({ name: '', code: '', teacherId: '', classId: '' });
    setSubjectModalError(null);
    setModalVisible(true);
  };
  const openEditSubject = (subject) => {
    setEditSubject(subject);
    // Get teacher ID from the junction table relationship
    const teacherId = subject.teacher_subjects?.[0]?.teachers?.id || '';
    setSubjectForm({
      name: subject.name,
      teacherId: teacherId,
      classId: subject.class_id || ''
    });
    setSubjectModalError(null);
    setModalVisible(true);
  };

  const handleSaveSubject = async () => {
    if (!subjectForm.name) {
      Alert.alert('Error', 'Please enter subject name');
      return;
    }

    try {
      setLoading(true);
      console.log('💾 SubjectsTimetable.handleSaveSubject: Starting save operation...');
      
      // 🔍 Enhanced tenant system check
      if (!isTenantReady()) {
        setLoading(false);
        return;
      }

      // Validate that a class is selected in the form
      if (!subjectForm.classId) {
        Alert.alert('Error', 'Please select a class');
        setLoading(false);
        return;
      }

      // Check for duplicate subject in the same class (only for new subjects)
      if (!editSubject) {
        // 🚀 Use enhanced tenant database helper
        const { data: existingSubjects, error: checkError } = await tenantDatabase.read(
          'subjects',
          { 
            class_id: subjectForm.classId,
            name: subjectForm.name.trim() // Note: enhanced system will handle ilike internally if needed
          },
          'id, name'
        );

        if (checkError) {
          console.error('Error checking for duplicate subjects:', checkError);
          Alert.alert('Error', 'Failed to validate subject. Please try again.');
          setLoading(false);
          return;
        }

        if (existingSubjects && existingSubjects.length > 0) {
          const selectedClass = classes.find(c => c.id === subjectForm.classId);
          const className = selectedClass ? `${selectedClass.class_name} ${selectedClass.section}` : 'this class';
          setSubjectModalError(`The subject "${subjectForm.name}" already exists for ${className}. Please choose a different name or select a different class.`);
          setLoading(false);
          return;
        }
      } else {
        // For editing, check if the new name conflicts with other subjects in the same class
        // 🚀 Use enhanced tenant database helper for duplicate check
        const { data: allSubjectsInClass, error: checkError } = await tenantDatabase.read(
          'subjects',
          { class_id: subjectForm.classId },
          'id, name'
        );
        
        // Filter out current subject and check for name conflicts
        const existingSubjects = allSubjectsInClass?.filter(s => 
          s.id !== editSubject.id && 
          s.name.toLowerCase().trim() === subjectForm.name.toLowerCase().trim()
        ) || [];

        if (checkError) {
          console.error('Error checking for duplicate subjects:', checkError);
          Alert.alert('Error', 'Failed to validate subject. Please try again.');
          setLoading(false);
          return;
        }

        if (existingSubjects && existingSubjects.length > 0) {
          const selectedClass = classes.find(c => c.id === subjectForm.classId);
          const className = selectedClass ? `${selectedClass.class_name} ${selectedClass.section}` : 'this class';
          setSubjectModalError(`The subject "${subjectForm.name}" already exists for ${className}. Please choose a different name.`);
          setLoading(false);
          return;
        }
      }

      // Get current academic year
      const currentYear = new Date().getFullYear();
      const academicYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;

      const subjectData = {
        name: subjectForm.name,
        class_id: subjectForm.classId,
        academic_year: academicYear,
        is_optional: false, // Default to false, can be made configurable later
        // tenant_id automatically added by enhanced tenant system
      };

      if (editSubject) {
        // 🚀 Update subject using enhanced tenant system
        const { data, error } = await tenantDatabase.update(
          'subjects',
          editSubject.id,
          subjectData
        );

        if (error) throw error;

        // Handle teacher assignment through junction table
        if (subjectForm.teacherId) {
          // 🚀 Remove existing teacher assignments using enhanced tenant system
          await tenantDatabase.delete(
            'teacher_subjects',
            { subject_id: editSubject.id }
          );

          // 🚀 Add new teacher assignment using enhanced tenant system
          await tenantDatabase.create('teacher_subjects', {
            teacher_id: subjectForm.teacherId,
            subject_id: editSubject.id,
          });
        }

        // Refresh subjects list
        await refreshSubjects();
      } else {
        // 🚀 Create new subject using enhanced tenant system
        const { data, error } = await tenantDatabase.create(
          'subjects',
          subjectData
        );

        if (error) throw error;

        // 🚀 Handle teacher assignment using enhanced tenant system
        if (subjectForm.teacherId && data) {
          await tenantDatabase.create('teacher_subjects', {
            teacher_id: subjectForm.teacherId,
            subject_id: data.id,
          });
        }

        // Refresh subjects list
        await refreshSubjects();
      }

      setModalVisible(false);
      Alert.alert('Success', `Subject ${editSubject ? 'updated' : 'created'} successfully`);
    } catch (error) {
      console.error('Error saving subject:', error);
      Alert.alert('Error', 'Failed to save subject');
    } finally {
      setLoading(false);
    }
  };

  const refreshSubjects = async () => {
    try {
      console.log('🔄 SubjectsTimetable.refreshSubjects: Starting refresh...');
      // 🔍 Enhanced tenant system check
      if (!isTenantReady()) {
        console.error('❌ refreshSubjects: Tenant context not ready');
        return;
      }
      
      // 🚀 Use enhanced tenant database for subjects
      const { data: subjectData, error: subjectError } = await tenantDatabase.read(
        'subjects',
        {},
        `
          *,
          teacher_subjects(
            teachers(id, name)
          ),
          classes(
            id,
            class_name,
            section
          )
        `
      );
        
      if (subjectError) {
        console.error('❌ refreshSubjects: Database error:', subjectError);
        throw subjectError;
      }
      
      setSubjects(subjectData || []);
      console.log(`✅ refreshSubjects: Loaded ${subjectData?.length || 0} subjects`);
      
    } catch (error) {
      console.error('❌ refreshSubjects: Error refreshing subjects:', error);
    }
  };

  const handleDeleteSubject = async (id) => {
    Alert.alert('Delete Subject', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          setLoading(true);
          console.log('🗑️ SubjectsTimetable.handleDeleteSubject: Starting delete operation for:', id);
          
          // 🔍 Enhanced tenant system check
          if (!isTenantReady()) {
            console.log('⚠️ handleDeleteSubject: Tenant context not ready');
            Alert.alert('Error', 'Tenant context not ready. Please try again.');
            setLoading(false);
            return;
          }
          
          console.log('🅿️ handleDeleteSubject: Using enhanced tenant system with ID:', tenantId);
          
          // 🚀 Use enhanced tenant database for delete
          const { error } = await tenantDatabase.delete('subjects', id);

          if (error) {
            console.error('❌ handleDeleteSubject: Delete error:', error);
            throw error;
          }
          
          console.log('✅ handleDeleteSubject: Subject deleted successfully');

          setSubjects(subjects.filter(s => s.id !== id));
          Alert.alert('Success', 'Subject deleted successfully');
          
        } catch (error) {
          console.error('❌ handleDeleteSubject: Error deleting subject:', error);
          const errorMessage = error.message || 'Failed to delete subject';
          Alert.alert('Error', errorMessage);
        } finally {
          setLoading(false);
        }
      }},
    ]);
  };

  // Timetable helpers
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const getSubjectName = (subjectId) => {
    const subj = subjects.find(s => s.id === subjectId);
    return subj ? subj.name : '-';
  };
  const getTeacherName = (teacherId) => {
    const t = teachers.find(t => t.id === teacherId);
    return t ? t.name : '-';
  };

  const getSubjectTeacher = (subject) => {
    if (subject.teacher_subjects && subject.teacher_subjects.length > 0) {
      const teacher = subject.teacher_subjects[0].teachers;
      return teacher ? teacher.name : '-';
    }
    return '-';
  };
  const handleAssignSubject = async (day, period, subjectId) => {
    setTimetables(prev => {
      const classTT = { ...prev[selectedClass] };
      const dayTT = classTT[day] ? [...classTT[day]] : [];
      const idx = dayTT.findIndex(p => p.period === period);
      if (idx >= 0) {
        dayTT[idx].subjectId = subjectId;
      } else {
        dayTT.push({ period, subjectId });
      }
      classTT[day] = dayTT;
      return { ...prev, [selectedClass]: classTT };
    });
  };

  // Open add/edit period modal
  const openAddPeriod = (day) => {
    setPeriodForm({
      type: 'subject',
      subjectId: subjects[0]?.id || '',
      label: '',
      startTime: '',
      endTime: '',
      room: ''
    });
    setPeriodModal({ visible: true, day, period: null });
  };
  const openEditPeriod = (day, period) => {
    setPeriodForm({
      type: period.type,
      subjectId: period.subjectId || '',
      label: period.label || '',
      startTime: period.startTime,
      endTime: period.endTime,
      room: period.room || ''
    });
    setPeriodModal({ visible: true, day, period });
  };
  const handleSavePeriod = async () => {
    const { type, subjectId, label, startTime, endTime } = periodForm;
    if (!startTime || !endTime || (type === 'subject' && !subjectId) || (type === 'break' && !label)) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    try {
      setLoading(true);
      console.log('💾 SubjectsTimetable.handleSavePeriod: Starting save operation...');
      
      // 🔍 Enhanced tenant system check
      if (!isTenantReady()) {
        setLoading(false);
        return;
      }

      // Validate that a subject is selected (current schema only supports subjects, not breaks)
      if (!subjectId) {
        Alert.alert('Error', 'Please select a subject. The current system only supports subject periods.');
        setLoading(false);
        return;
      }

      // Get current academic year
      const currentYear = new Date().getFullYear();
      const academicYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;

      // Generate period number based on start time
      const periodNumber = Math.floor((parseInt(startTime.split(':')[0]) - 8) * 2) + 1;

      // 🔍 Get teacher for the selected subject with tenant filtering
      console.log('👨‍🏫 handleSavePeriod: Finding teacher for subject:', subjectId);
      let teacherId = null;
      // 🚀 Use enhanced tenant database for teacher lookup
      const { data: teacherSubject, error: teacherError } = await tenantDatabase.read(
        'teacher_subjects',
        { subject_id: subjectId },
        'teacher_id'
      );

      if (teacherError) {
        console.log('⚠️ No teacher assigned to this subject yet:', teacherError.message);
      } else {
        teacherId = teacherSubject?.teacher_id;
        console.log('✅ Found teacher ID:', teacherId, 'for subject:', subjectId);
      }

      // If no teacher is assigned to the subject, we need to assign one
      if (!teacherId) {
        Alert.alert(
          'No Teacher Assigned',
          'This subject has no teacher assigned. Please assign a teacher to this subject first, or select a different subject.',
          [{ text: 'OK' }]
        );
        setLoading(false);
        return;
      }

      // 💻 Prepare timetable data without tenant_id (added automatically)
      const timetableData = {
        class_id: selectedClass,
        subject_id: subjectId,
        teacher_id: teacherId,
        day_of_week: periodModal.day, // Use day name directly (Monday, Tuesday, etc.)
        period_number: periodNumber,
        start_time: startTime,
        end_time: endTime,
        academic_year: academicYear
        // tenant_id added automatically by enhanced tenant system
      };
      
      console.log('💾 handleSavePeriod: Timetable data prepared:', {
        ...timetableData,
        tenant_id: '[REDACTED]',
        debug_info: {
          selectedClass,
          periodModal_day: periodModal.day,
          classId,
          subjectCount: subjects.length,
          teacherCount: teachers.length
        }
      });

      if (periodModal.period) {
        // 🔄 Edit existing period with enhanced tenant validation
        console.log('🔄 handleSavePeriod: Updating existing period:', periodModal.period.id);
        
        // 🚀 Use enhanced tenant database for update
        const { data, error } = await tenantDatabase.update(
          'timetable_entries',
          periodModal.period.id,
          timetableData
        );
        
        if (error) {
          console.error('❌ handleSavePeriod: Update error:', error);
          throw error;
        }
        
        if (!data || data.length === 0) {
          throw new Error('Period not found or access denied. Please refresh and try again.');
        }
        
        console.log('✅ handleSavePeriod: Period updated successfully');

        // Immediately update local state for quick UI feedback
        const subject = subjects.find(s => s.id === data[0].subject_id);
        const updatedPeriod = {
          id: data[0].id,
          type: 'subject',
          subjectId: data[0].subject_id,
          subject: { id: data[0].subject_id, name: subject?.name || 'Unknown Subject' },
          startTime: data[0].start_time,
          endTime: data[0].end_time,
          label: subject?.name || 'Unknown Subject'
        };
        
        console.log('🔄 handleSavePeriod: Updating existing period in UI:', updatedPeriod);
        
        setTimetables(prev => {
          const classTT = { ...prev[selectedClass] };
          const dayTT = classTT[periodModal.day] ? [...classTT[periodModal.day]] : [];
          const idx = dayTT.findIndex(p => p.id === periodModal.period.id);
          console.log('🔄 handleSavePeriod: Found period at index:', idx, 'in', dayTT.length, 'periods');
          if (idx >= 0) {
            dayTT[idx] = updatedPeriod;
            console.log('🔄 handleSavePeriod: Updated period at index', idx);
          } else {
            console.warn('⚠️ handleSavePeriod: Could not find period to update, adding as new');
            dayTT.push(updatedPeriod);
            dayTT.sort((a, b) => a.startTime.localeCompare(b.startTime));
          }
          classTT[periodModal.day] = dayTT;
          console.log('🔄 handleSavePeriod: Updated day timetable for', periodModal.day, ':', dayTT.length, 'periods');
          return { ...prev, [selectedClass]: classTT };
        });
      } else {
        // ➕ Add new period with tenant validation
        console.log('➕ handleSavePeriod: Creating new period');
        
        // 🚀 Use enhanced tenant database for create
        const { data, error } = await tenantDatabase.create(
          'timetable_entries',
          timetableData
        );
        
        if (error) {
          console.error('❌ handleSavePeriod: Insert error:', error);
          throw error;
        }
        
        if (!data || data.length === 0) {
          throw new Error('Failed to create period. Please try again.');
        }
        
        console.log('✅ handleSavePeriod: Period created successfully');

        // Immediately update local state for quick UI feedback
        const subject = subjects.find(s => s.id === data[0].subject_id);
        const newPeriod = {
          id: data[0].id,
          type: 'subject',
          subjectId: data[0].subject_id,
          subject: { id: data[0].subject_id, name: subject?.name || 'Unknown Subject' },
          startTime: data[0].start_time,
          endTime: data[0].end_time,
          label: subject?.name || 'Unknown Subject'
        };
        
        console.log('🔄 handleSavePeriod: Adding new period to UI:', newPeriod);
        
        setTimetables(prev => {
          const classTT = { ...prev[selectedClass] };
          const dayTT = classTT[periodModal.day] ? [...classTT[periodModal.day]] : [];
          dayTT.push(newPeriod);
          // Sort by start time
          dayTT.sort((a, b) => a.startTime.localeCompare(b.startTime));
          classTT[periodModal.day] = dayTT;
          console.log('🔄 handleSavePeriod: Updated day timetable for', periodModal.day, ':', dayTT.length, 'periods');
          return { ...prev, [selectedClass]: classTT };
        });
      }

      const operationType = periodModal.period ? 'updated' : 'added';
      console.log(`✅ handleSavePeriod: Period ${operationType} successfully`);
      
      // 🔄 Log final state to verify the update worked
      console.log('🔄 handleSavePeriod: Verifying final timetable state...');
      console.log('🔄 handleSavePeriod: selectedClass:', selectedClass);
      console.log('🔄 handleSavePeriod: periodModal.day:', periodModal.day);
      console.log('🔄 handleSavePeriod: selectedDay (current UI day):', selectedDay);
      
      setTimetables(prev => {
        console.log('🔄 handleSavePeriod: All timetable keys:', Object.keys(prev));
        const currentState = prev[selectedClass] || {};
        console.log('🔄 handleSavePeriod: Days in current class:', Object.keys(currentState));
        const dayPeriods = currentState[periodModal.day] || [];
        console.log('🔄 handleSavePeriod: Current state for', periodModal.day, ':', dayPeriods.length, 'periods');
        console.log('🔄 handleSavePeriod: Period details:', dayPeriods.map(p => ({ 
          id: p.id, 
          label: p.label || p.subject?.name, 
          startTime: p.startTime 
        })));
        
        // Also log what the UI should be seeing
        if (selectedDay === periodModal.day) {
          console.log('🔄 handleSavePeriod: UI should show these periods (selectedDay matches):', dayPeriods.length);
        } else {
          console.log('🔄 handleSavePeriod: UI is showing different day. UI day:', selectedDay, 'Updated day:', periodModal.day);
          const uiDayPeriods = currentState[selectedDay] || [];
          console.log('🔄 handleSavePeriod: UI day periods:', uiDayPeriods.length);
        }
        
        return prev; // Return without changes, just for logging
      });
      
      // Force UI refresh by incrementing refresh counter
      setRefreshCounter(prev => prev + 1);
      
      // Close modal and show success message with a small delay to ensure UI updates
      setTimeout(() => {
        setPeriodModal({ visible: false, day: '', period: null });
        Alert.alert('Success', `Period ${operationType} successfully`);
      }, 200);
      
    } catch (error) {
      console.error('❌ handleSavePeriod: Error saving period:', error);
      const errorMessage = error.message || 'Failed to save period';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePeriod = async (day, id) => {
    Alert.alert('Delete Period', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          setLoading(true);
          console.log('🗑️ SubjectsTimetable.handleDeletePeriod: Starting delete operation for:', id);
          
          // 🔍 Enhanced tenant system check
          if (!isTenantReady()) {
            Alert.alert('Error', 'Tenant context not ready. Please try again.');
            setLoading(false);
            return;
          }
          
          console.log('🏷️ handleDeletePeriod: Using tenant ID:', tenantId);
          
          // 🚀 Use enhanced tenant database for delete
          const { error } = await tenantDatabase.delete('timetable_entries', id);
          
          if (error) {
            console.error('❌ handleDeletePeriod: Delete error:', error);
            throw error;
          }
          
          console.log('✅ handleDeletePeriod: Period deleted successfully');

          // 🔄 Refresh timetable data from database to ensure consistency
          console.log('🔄 handleDeletePeriod: Refreshing timetable data to ensure consistency...');
          await fetchTimetableForClass(selectedClass);

          Alert.alert('Success', 'Period deleted successfully');
        } catch (error) {
          console.error('❌ handleDeletePeriod: Error deleting period:', error);
          const errorMessage = error.message || 'Failed to delete period';
          Alert.alert('Error', errorMessage);
        } finally {
          setLoading(false);
        }
      }},
    ]);
  };

  const getDayNumber = (dayName) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days.indexOf(dayName);
  };

  // Helper to handle time picker
  const openTimePicker = (field, initial) => {
    let h = 9, m = 0;
    if (initial && typeof initial === 'string') {
      try {
        const parts = initial.split(':').map(Number);
        if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          h = parts[0];
          m = parts[1];
        }
      } catch (error) {
        console.error('Error parsing initial time:', error);
      }
    }
    const date = new Date();
    date.setHours(h);
    date.setMinutes(m);
    setShowTimePicker({ visible: true, field, value: date });
  };
  const onTimePicked = (event, selectedDate) => {
    if (event.type === 'dismissed') {
      setShowTimePicker({ ...showTimePicker, visible: false });
      return;
    }
    const date = selectedDate || showTimePicker.value;
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    setPeriodForm(f => ({ ...f, [showTimePicker.field]: `${h}:${m}` }));
    setShowTimePicker({ ...showTimePicker, visible: false });
  };

  // Helper to get day name from date
  function getDayNameFromDate(date) {
    return days[date.getDay() === 0 ? 6 : date.getDay() - 1]; // 0=Sunday, 1=Monday...
  }

  // Fetch period settings from database
  const fetchPeriodSettings = async () => {
    try {
      console.log('🔄 SubjectsTimetable.fetchPeriodSettings: Starting...');
      const currentYear = new Date().getFullYear();
      const academicYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;

      // 🔍 Enhanced tenant system check
      if (!isTenantReady()) {
        console.warn('Could not determine tenantId from context for period settings; using defaults');
        setPeriodSettings(getDefaultPeriods());
        return;
      }

      const { data: periodData, error: periodError } = await supabase
        .from('period_settings')
        .select('*')
        .eq('academic_year', academicYear)
        .eq('period_type', 'class')
        .eq('is_active', true)
        .eq('tenant_id', tenantId)
        .order('start_time');
      
      if (periodError) {
        console.error('Error fetching period settings:', periodError);
        // Use default periods if fetch fails
        setPeriodSettings(getDefaultPeriods());
      } else if (periodData && periodData.length > 0) {
        // Transform database data to component format
        const transformedPeriods = periodData.map(period => ({
          id: period.id,
          number: period.period_number,
          startTime: period.start_time,
          endTime: period.end_time,
          duration: period.duration_minutes,
          name: period.period_name
        }));
        setPeriodSettings(transformedPeriods);
      } else {
        // No periods in database, use defaults and save them
        const defaultPeriods = getDefaultPeriods();
        setPeriodSettings(defaultPeriods);
        await savePeriodSettingsToDatabase(defaultPeriods, academicYear);
      }
    } catch (error) {
      console.error('Error in fetchPeriodSettings:', error);
      setPeriodSettings(getDefaultPeriods());
    }
  };

  // Get default period structure
  const getDefaultPeriods = () => {
    return [
      { number: 1, startTime: '08:00', endTime: '08:45', duration: 45, name: 'Period 1' },
      { number: 2, startTime: '08:45', endTime: '09:30', duration: 45, name: 'Period 2' },
      { number: 3, startTime: '09:45', endTime: '10:30', duration: 45, name: 'Period 3' },
      { number: 4, startTime: '10:30', endTime: '11:15', duration: 45, name: 'Period 4' },
      { number: 5, startTime: '11:30', endTime: '12:15', duration: 45, name: 'Period 5' },
      { number: 6, startTime: '12:15', endTime: '13:00', duration: 45, name: 'Period 6' },
      { number: 7, startTime: '14:00', endTime: '14:45', duration: 45, name: 'Period 7' },
      { number: 8, startTime: '14:45', endTime: '15:30', duration: 45, name: 'Period 8' },
      { number: 9, startTime: '15:45', endTime: '16:30', duration: 45, name: 'Period 9' },
      { number: 10, startTime: '16:30', endTime: '17:15', duration: 45, name: 'Period 10' },
    ];
  };

  // Helper to get time slots (now uses database data)
  const getTimeSlots = () => {
    return periodSettings.length > 0 ? periodSettings : getDefaultPeriods();
  };

  // Helper to get subjects for the selected class
  const getClassSubjects = () => {
    return subjects.filter(subject => subject.class_id === selectedClass);
  };

  // Handler for subject change in period slots
  const handleSubjectChange = async (day, slot, subjectId) => {
    if (!subjectId) {
      // Remove subject from this slot if empty
      const existingPeriod = timetables[selectedClass]?.[day]?.find(
        p => p.startTime === slot.startTime
      );
      if (existingPeriod) {
        await removePeriod(day, existingPeriod.id);
      }
      return;
    }

    try {
      // Only show loading on native platforms to prevent web re-renders
      if (Platform.OS !== 'web') {
        setLoading(true);
      }
      console.log('🔄 handleSubjectChange: Starting subject assignment for', { day, slot: slot.number, subjectId });
      
      // 🔍 Enhanced tenant system check
      if (!isTenantReady()) {
        Alert.alert('Error', 'Tenant context not ready. Please try again.');
        setLoading(false);
        return;
      }
      
      // Get teacher for the selected subject with tenant filtering
      console.log('👨‍🏫 handleSubjectChange: Finding teacher for subject:', subjectId);
      let teacherId = null;
      // 🚀 Use enhanced tenant database for teacher lookup
      const { data: teacherSubjects, error: teacherError } = await tenantDatabase.read(
        'teacher_subjects',
        { subject_id: subjectId },
        'teacher_id'
      );
      
      const teacherSubject = teacherSubjects?.[0];

      if (teacherError) {
        console.log('⚠️ No teacher assigned to this subject yet:', teacherError.message);
      } else {
        teacherId = teacherSubject?.teacher_id;
        console.log('✅ Found teacher ID:', teacherId, 'for subject:', subjectId);
      }

      // If no teacher is assigned to the subject, show error and return
      if (!teacherId) {
        Alert.alert(
          'No Teacher Assigned',
          'This subject has no teacher assigned. Please assign a teacher to this subject first, or select a different subject.',
          [{ text: 'OK' }]
        );
        // Reset loading state before returning
        if (Platform.OS !== 'web') {
          setLoading(false);
        }
        return;
      }

      // Get current academic year
      const currentYear = new Date().getFullYear();
      const academicYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;

      const timetableData = {
        class_id: selectedClass,
        subject_id: subjectId,
        teacher_id: teacherId,
        day_of_week: day, // Use day name directly (Monday, Tuesday, etc.)
        period_number: slot.number,
        start_time: slot.startTime,
        end_time: slot.endTime,
        academic_year: academicYear,
        // tenant_id will be added automatically by enhanced tenant system
      };
      
      console.log('💾 handleSubjectChange: Timetable data prepared:', {
        ...timetableData,
        tenant_id: '[REDACTED]'
      });

      // Check if period already exists for this slot (by start time and by slot number)
      const existingPeriodByTime = timetables[selectedClass]?.[day]?.find(
        p => p.startTime === slot.startTime
      );

      // 🚀 Use enhanced tenant database to check for existing period
      const { data: existingPeriodData, error: checkError } = await tenantDatabase.read(
        'timetable_entries',
        {
          class_id: selectedClass,
          day_of_week: day,
          period_number: slot.number
        },
        'id, subject_id, subjects(id, name)'
      );
      
      const existingPeriodBySlot = existingPeriodData?.[0];

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('❌ Error checking existing period:', checkError);
        throw checkError;
      }

      let dbResult;
      const existingPeriod = existingPeriodByTime || existingPeriodBySlot;
      
      if (existingPeriod) {
        // Update existing period
        console.log('🔄 handleSubjectChange: Updating existing period:', existingPeriod.id || 'local-only');
        
        const updateId = existingPeriod.id || existingPeriodBySlot?.id;
        if (updateId) {
          // 🚀 Use enhanced tenant database for update
          const { data, error } = await tenantDatabase.update(
            'timetable_entries',
            updateId,
            timetableData
          );
        
          if (error) {
            console.error('❌ handleSubjectChange: Update error:', error);
            throw error;
          }
          dbResult = data[0];
        } else {
          throw new Error('Could not find period ID to update');
        }
      } else {
        // 🚀 Create new period using enhanced tenant database
        console.log('➕ handleSubjectChange: Creating new period');
        
        const { data, error } = await tenantDatabase.create(
          'timetable_entries',
          timetableData
        );
        
        if (error) {
          console.error('❌ handleSubjectChange: Insert error:', error);
          throw error;
        }
        
        if (!data || data.length === 0) {
          throw new Error('Failed to create period. Please try again.');
        }
        
        dbResult = data[0];
      }
      
      console.log('✅ handleSubjectChange: Database operation successful');

      // Update local state immediately for better UX
      const subject = subjects.find(s => s.id === dbResult.subject_id) || dbResult.subjects;
      const updatedPeriod = {
        id: dbResult.id,
        type: 'subject',
        subjectId: dbResult.subject_id,
        subject: subject,
        startTime: dbResult.start_time,
        endTime: dbResult.end_time,
        label: subject?.name || 'Unknown Subject'
      };
      
      console.log('🔄 handleSubjectChange: Updating local state for', day, 'with period:', updatedPeriod.label);
      
      setTimetables(prev => {
        const classTT = { ...prev[selectedClass] } || {};
        const dayTT = classTT[day] ? [...classTT[day]] : [];
        
        console.log('🔄 handleSubjectChange: Before update - dayTT:', dayTT.map(p => ({ startTime: p.startTime, subjectId: p.subjectId, label: p.label })));
        
        // Remove any existing period for this time slot
        const filteredDayTT = dayTT.filter(p => p.startTime !== slot.startTime);
        
        // Add the updated period
        filteredDayTT.push(updatedPeriod);
        
        // Sort by start time
        filteredDayTT.sort((a, b) => a.startTime.localeCompare(b.startTime));
        
        classTT[day] = filteredDayTT;
        console.log('🔄 handleSubjectChange: After update - filteredDayTT:', filteredDayTT.map(p => ({ startTime: p.startTime, subjectId: p.subjectId, label: p.label })));
        
        const newState = { ...prev, [selectedClass]: classTT };
        console.log('🔄 handleSubjectChange: Final state for', selectedClass, day, ':', newState[selectedClass][day]?.length, 'periods');
        
        return newState;
      });
      
      // Force UI refresh - needed for both platforms
      setRefreshCounter(prev => prev + 1);
      
      console.log('✅ handleSubjectChange: Subject assignment completed successfully');
      
    } catch (error) {
      console.error('❌ handleSubjectChange: Error updating period:', error);
      Alert.alert('Error', 'Failed to update period: ' + (error.message || 'Unknown error'));
    } finally {
      // Only update loading state on native platforms
      if (Platform.OS !== 'web') {
        setLoading(false);
      }
    }
  };

  // Web-specific wrapper for handleSubjectChange to prevent page refresh
  const safeHandleSubjectChange = async (day, slot, subjectId) => {
    console.log('📝 SafeHandleSubjectChange: Starting with:', { 
      platform: Platform.OS,
      day, 
      slotTime: slot.startTime, 
      subjectId,
      tenantReady: isTenantReady(),
      tenantId: tenantId
    });
    
    try {
      await handleSubjectChange(day, slot, subjectId);
      console.log('✅ SafeHandleSubjectChange: Successfully completed');
    } catch (error) {
      console.error('🚨 SafeHandleSubjectChange: Caught error:', error);
      console.error('🚨 SafeHandleSubjectChange: Error stack:', error.stack);
      
      // Prevent any unhandled promise rejection that could cause page refresh
      if (Platform.OS === 'web') {
        console.error('🚨 Web Platform: Showing error alert instead of throwing');
        Alert.alert('Error', 'Failed to update timetable: ' + (error.message || 'Unknown error'));
      } else {
        throw error; // Re-throw on native platforms
      }
    }
  };

  // Handler to remove a period
  const removePeriod = async (day, periodId) => {
    try {
      setLoading(true);
      console.log('🗑️ removePeriod: Starting delete operation for period:', periodId, 'on', day);
      
      // 🔍 Enhanced tenant system check
      if (!isTenantReady()) {
        Alert.alert('Error', 'Tenant context not ready. Please try again.');
        return;
      }
      
      // 🚀 Use enhanced tenant database for delete
      const { error } = await tenantDatabase.delete('timetable_entries', periodId);
      
      if (error) {
        console.error('❌ removePeriod: Delete error:', error);
        throw error;
      }
      
      console.log('✅ removePeriod: Period deleted successfully');

      // Update local state immediately
      setTimetables(prev => {
        const classTT = { ...prev[selectedClass] };
        const dayTT = classTT[day] ? [...classTT[day]] : [];
        const updatedDayTT = dayTT.filter(p => p.id !== periodId);
        classTT[day] = updatedDayTT;
        console.log('🔄 removePeriod: Updated local state for', day, ':', updatedDayTT.length, 'periods remaining');
        return { ...prev, [selectedClass]: classTT };
      });
      
      // Force UI refresh (skip on web to prevent re-render)
      if (Platform.OS !== 'web') {
        setRefreshCounter(prev => prev + 1);
      }
      
    } catch (error) {
      console.error('❌ removePeriod: Error removing period:', error);
      Alert.alert('Error', 'Failed to remove period: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  // Handler to clear all periods for the selected day
  const clearDay = async () => {
    Alert.alert(
      'Clear Day Timetable',
      `Are you sure you want to clear all periods for ${selectedDay}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const dayPeriods = timetables[selectedClass]?.[selectedDay] || [];
              
              // Delete all periods for this day
              for (const period of dayPeriods) {
                await dbHelpers.deleteTimetableEntry(period.id);
              }

              // Update local state
              setTimetables(prev => {
                const classTT = { ...prev[selectedClass] };
                classTT[selectedDay] = [];
                return { ...prev, [selectedClass]: classTT };
              });

              Alert.alert('Success', `${selectedDay} timetable cleared successfully`);
            } catch (error) {
              console.error('Error clearing day:', error);
              Alert.alert('Error', 'Failed to clear day timetable');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // Handler to save the timetable (refresh data to ensure consistency)
  const saveDayTimetable = async () => {
    try {
      setLoading(true);
      console.log('💾 saveDayTimetable: Refreshing timetable data to ensure consistency...');
      
      // Refresh timetable data from database
      await fetchTimetableForClass(selectedClass);
      
      // Force UI refresh (skip on web to prevent re-render)
      if (Platform.OS !== 'web') {
        setRefreshCounter(prev => prev + 1);
      }
      
      console.log('✅ saveDayTimetable: Timetable data refreshed successfully');
      Alert.alert('Success', 'Timetable refreshed successfully! All changes are now synchronized.');
    } catch (error) {
      console.error('❌ saveDayTimetable: Error refreshing timetable:', error);
      Alert.alert('Error', 'Failed to refresh timetable: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  // Handler to copy day timetable
  const copyDayTimetable = (dayToCopy) => {
    const dayData = timetables[selectedClass]?.[dayToCopy] || [];
    if (dayData.length === 0) {
      Alert.alert('No Data', `No periods found for ${dayToCopy} to copy.`);
      return;
    }
    
    // Store the copied data (deep copy to avoid reference issues)
    const copiedData = dayData.map(period => ({
      subjectId: period.subjectId,
      subject: period.subject,
      startTime: period.startTime,
      endTime: period.endTime,
      label: period.label,
      room: period.room,
      type: period.type || 'subject'
    }));
    
    setCopiedDayData(copiedData);
    setCopiedSourceDay(dayToCopy);
    setCopyDayModal({ visible: false });
    
    Alert.alert('Success', `${dayToCopy} timetable copied! You can now paste it to another day.`);
  };

  // Handler to paste copied day timetable
  const pasteDayTimetable = async () => {
    if (!copiedDayData || copiedDayData.length === 0) {
      Alert.alert('No Data', 'No timetable data copied. Please copy a day first.');
      return;
    }

    Alert.alert(
      'Paste Timetable',
      `This will replace all periods in ${selectedDay} with periods from ${copiedSourceDay}. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Paste',
          style: 'default',
          onPress: async () => {
            try {
              setLoading(true);
              
              // First, clear existing periods for the current day
              const existingPeriods = timetables[selectedClass]?.[selectedDay] || [];
              for (const period of existingPeriods) {
                await dbHelpers.deleteTimetableEntry(period.id);
              }

              // Get current academic year
              const currentYear = new Date().getFullYear();
              const academicYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;

              // Create new periods from copied data
              for (const copiedPeriod of copiedDayData) {
                // Get teacher for the subject
                let teacherId = null;
                // 🔍 Enhanced tenant system check
                if (!isTenantReady()) {
                  throw new Error('Tenant context not ready');
                }
                
                // 🚀 Use enhanced tenant database for teacher lookup
                const { data: teacherSubjects, error: teacherError } = await tenantDatabase.read(
                  'teacher_subjects',
                  { subject_id: copiedPeriod.subjectId },
                  'teacher_id'
                );

                if (!teacherError && teacherSubjects?.[0]) {
                  teacherId = teacherSubjects[0].teacher_id;
                }

                // Generate period number based on start time
                const periodNumber = Math.floor((parseInt(copiedPeriod.startTime.split(':')[0]) - 8) * 2) + 1;

                const timetableData = {
                  class_id: selectedClass,
                  subject_id: copiedPeriod.subjectId,
                  teacher_id: teacherId,
                  day_of_week: selectedDay,
                  period_number: periodNumber,
                  start_time: copiedPeriod.startTime,
                  end_time: copiedPeriod.endTime,
                  academic_year: academicYear,
                  // tenant_id will be added automatically by enhanced tenant system
                };

                // 🚀 Use enhanced tenant database for insert
                await tenantDatabase.create('timetable_entries', timetableData);
              }

              // Refresh the timetable data to update UI
              await fetchTimetableForClass(selectedClass);
              
              Alert.alert('Success', `${copiedSourceDay} timetable pasted to ${selectedDay} successfully!`);
              
              // Force a small delay to ensure state update is complete
              setTimeout(() => {
                // This ensures the UI re-renders with the updated data
                setSelectedDay(selectedDay);
              }, 100);
            } catch (error) {
              console.error('Error pasting timetable:', error);
              Alert.alert('Error', 'Failed to paste timetable: ' + (error.message || 'Unknown error'));
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // Handler to open copy day modal
  const openCopyDayModal = () => {
    setCopyDayModal({ visible: true });
  };

  // Handler to open period settings modal
  const openPeriodSettingsModal = async () => {
    // Refresh period settings before opening modal
    await fetchPeriodSettings();
    setPeriodSettingsModal({ visible: true });
  };

  // Handler to add new period slot
  const addPeriodSlot = () => {
    const newPeriod = {
      number: periodSettings.length + 1,
      startTime: '09:00',
      endTime: '09:45',
      duration: 45,
      name: `Period ${periodSettings.length + 1}`
    };
    setPeriodSettings([...periodSettings, newPeriod]);
  };

  // Handler to remove period slot
  const removePeriodSlot = (index) => {
    const updated = periodSettings.filter((_, i) => i !== index);
    // Renumber periods
    const renumbered = updated.map((period, i) => ({ ...period, number: i + 1 }));
    setPeriodSettings(renumbered);
  };

  // Handler to update period slot
  const updatePeriodSlot = (index, field, value) => {
    const updated = [...periodSettings];
    updated[index] = { ...updated[index], [field]: value };
    
    // Calculate duration if start or end time changed
    if (field === 'startTime' || field === 'endTime') {
      const { startTime, endTime } = updated[index];
      updated[index].duration = getDuration(startTime, endTime);
    }
    
    setPeriodSettings(updated);
  };

  // Save period settings to database
  const savePeriodSettingsToDatabase = async (periods, academicYear) => {
    try {
      // 🔍 Enhanced tenant system check
      if (!isTenantReady()) {
        throw new Error('Tenant context not ready');
      }
      
      console.log('🔍 Saving period settings for tenant:', tenantId, 'academic year:', academicYear);
      
      // First, delete existing periods for this academic year and tenant
      const { error: deleteError } = await supabase
        .from('period_settings')
        .delete()
        .eq('academic_year', academicYear)
        .eq('tenant_id', tenantId);
        
      if (deleteError) {
        console.error('❌ Error deleting existing period settings:', deleteError);
        throw deleteError;
      }
      
      console.log('✅ Deleted existing period settings for tenant:', tenantId);

      // Insert new period settings with tenant_id
      // Note: duration_minutes is a generated column, so we don't include it
      const periodsToInsert = periods.map(period => ({
        period_number: period.number,
        start_time: period.startTime,
        end_time: period.endTime,
        period_name: period.name || `Period ${period.number}`,
        period_type: 'class',
        academic_year: academicYear,
        tenant_id: tenantId,
        is_active: true
        // duration_minutes will be calculated automatically by the database
      }));
      
      console.log('📄 Inserting', periodsToInsert.length, 'period settings for tenant:', tenantId);

      const { error: insertError } = await supabase
        .from('period_settings')
        .insert(periodsToInsert);

      if (insertError) {
        console.error('❌ Insert error:', insertError);
        
        // Handle specific error types with safe message checking
        if (insertError.code === '23505' && (insertError.message || '').includes('period_settings_unique_period')) {
          console.error('❌ Unique constraint violation - period settings may exist for different tenant');
          throw new Error('Period settings conflict detected. Please run the database fix script to resolve constraint issues.');
        } else if (insertError.code === '428C9' && (insertError.message || '').includes('generated column')) {
          console.error('❌ Generated column error - trying to insert into computed column');
          throw new Error('Database schema issue with generated columns. Please contact support.');
        }
        
        throw insertError;
      }
      
      console.log('✅ Successfully inserted period settings for tenant:', tenantId);
      return true;
    } catch (error) {
      console.error('❌ Error saving period settings to database:', error);
      throw error;
    }
  };

  // Handler to save period settings
  const savePeriodSettings = async () => {
    try {
      setLoading(true);
      const currentYear = new Date().getFullYear();
      const academicYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
      
      await savePeriodSettingsToDatabase(periodSettings, academicYear);
      
      setPeriodSettingsModal({ visible: false });
      Alert.alert('Success', 'Period settings saved successfully!');
      
      // Refresh period settings to get updated data with IDs
      await fetchPeriodSettings();
    } catch (error) {
      console.error('Error saving period settings:', error);
      Alert.alert('Error', 'Failed to save period settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Pull-to-refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Fetch classes
      const { data: classData, error: classError } = await dbHelpers.getClasses();
      if (!classError) {
        setClasses(classData || []);
      }

      // Fetch teachers
      const { data: teacherData, error: teacherError } = await dbHelpers.getTeachers();
      if (!teacherError) {
        setTeachers(teacherData || []);
      }

      // Refresh subjects
      await refreshSubjects();

      // Refresh period settings
      await fetchPeriodSettings();

      // Refresh timetable for the selected class
      if (selectedClass) {
        await fetchTimetableForClass(selectedClass);
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Helper function for responsive styles
  const getResponsiveStyles = () => {
    const { width, height } = screenData;
    const isTablet = width >= 768;
    const isLandscape = width > height;
    const isMobile = width < 768;
    const isWeb = Platform.OS === 'web';

    return {
      isTablet,
      isLandscape,
      isMobile,
      isWeb,
      contentPadding: isTablet ? 24 : 16,
      modalWidth: isTablet ? '70%' : '90%',
      maxHeight: isWeb ? '75vh' : height * 0.75,
      gridColumns: isTablet && isLandscape ? 2 : 1,
    };
  };

  if (loading || tenantLoading) {
    return (
      <View style={styles.container}>
        <Header title="Subjects & Timetable" showBack={true} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <ActivityIndicator size="large" color="#2196F3" style={{ marginBottom: 16 }} />
          <Text style={{ textAlign: 'center', color: '#666' }}>
            {tenantLoading ? 'Initializing school context...' : 'Loading timetable data...'}
          </Text>
          {!isReady && !tenantLoading && (
            <Text style={{ textAlign: 'center', color: '#999', marginTop: 8, fontSize: 12 }}>
              Tenant Status: {tenantId ? 'ID Available' : 'Waiting for tenant ID'}
            </Text>
          )}
        </View>
      </View>
    );
  }

  if (error || tenantError) {
    const errorMessage = error || tenantError?.message || tenantError;
    return (
      <View style={styles.container}>
        <Header title="Subjects & Timetable" showBack={true} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ color: 'red', marginBottom: 16, textAlign: 'center' }}>
            {errorMessage}
          </Text>
          <TouchableOpacity 
            onPress={() => {
              setError(null);
              setLoading(true);
              // Trigger a refresh
              const fetchData = async () => {
                try {
                  if (!isTenantReady()) {
                    // Try manual tenant initialization
                    const result = await getCurrentUserTenantByEmail();
                    if (result.success) {
                      initializeTenantHelpers(result.data.tenantId);
                    }
                  }
                } catch (retryError) {
                  console.error('Retry failed:', retryError);
                } finally {
                  setLoading(false);
                }
              };
              fetchData();
            }}
            style={{
              backgroundColor: '#2196F3',
              padding: 12,
              borderRadius: 6
            }}
          >
            <Text style={{ color: 'white' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Subjects & Timetable" showBack={true} />
      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tab, tab === 'subjects' && styles.activeTab]} onPress={() => setTab('subjects')}>
          <Text style={styles.tabText}>Subjects</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'timetable' && styles.activeTab]} onPress={() => setTab('timetable')}>
          <Text style={styles.tabText}>Timetable</Text>
        </TouchableOpacity>
      </View>
      {tab === 'subjects' ? (
        <View style={styles.scrollWrapper}>
          <ScrollView 
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={Platform.OS === 'web'}
            keyboardShouldPersistTaps="handled"
            bounces={Platform.OS !== 'web'}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={onRefresh} 
                colors={['#4CAF50']}
                tintColor="#4CAF50"
              />
            }
          >
          <View style={styles.subjectsSection}>
            {subjects.map((item) => (
              <View key={item.id} style={styles.subjectRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.subjectName}>{item.name}</Text>
                  <Text style={styles.subjectClass}>Class: {item.classes ? `${item.classes.class_name} - ${item.classes.section}` : 'No Class Assigned'}</Text>
                  <Text style={styles.subjectTeacher}>Teacher: {getSubjectTeacher(item)}</Text>
                </View>
                <TouchableOpacity onPress={() => openEditSubject(item)} style={styles.actionBtn}>
                  <Ionicons name="pencil" size={20} color="#1976d2" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteSubject(item.id)} style={styles.actionBtn}>
                  <Ionicons name="trash" size={20} color="#d32f2f" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
          <Modal visible={modalVisible} animationType="slide" transparent>
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { width: getResponsiveStyles().modalWidth }]}>
                <Text style={styles.modalTitle}>{editSubject ? 'Edit Subject' : 'Add Subject'}</Text>
                <TextInput
                  placeholder="Subject Name"
                  value={subjectForm.name}
                  onChangeText={text => {
                    setSubjectForm(f => ({ ...f, name: text }));
                    setSubjectModalError(null); // Clear error when user types
                  }}
                  style={styles.input}
                />

                <Text style={styles.modalLabel}>Select Class:</Text>
                <View style={styles.modalPickerWrapper}>
                  <Picker
                    selectedValue={subjectForm.classId}
                    style={styles.modalPicker}
                    onValueChange={itemValue => {
                      setSubjectForm(f => ({ ...f, classId: itemValue }));
                      setSubjectModalError(null); // Clear error when user selects a class
                    }}
                    itemStyle={styles.modalPickerItem}
                  >
                    <Picker.Item label="-- Select a Class --" value="" />
                    {classes.map(c => (
                      <Picker.Item 
                        key={c.id} 
                        label={`${c.class_name} - ${c.section}`} 
                        value={c.id} 
                      />
                    ))}
                  </Picker>
                </View>

                <Text style={styles.modalLabel}>Assign Teacher (Optional):</Text>
                <View style={styles.modalPickerWrapper}>
                  <Picker
                    selectedValue={subjectForm.teacherId}
                    style={styles.modalPicker}
                    onValueChange={itemValue => setSubjectForm(f => ({ ...f, teacherId: itemValue }))}
                    itemStyle={styles.modalPickerItem}
                  >
                    <Picker.Item label="-- Select a Teacher --" value="" />
                    {teachers.map(t => (
                      <Picker.Item key={t.id} label={t.name} value={t.id} />
                    ))}
                  </Picker>
                </View>
                
                {/* Error message display */}
                {subjectModalError && (
                  <View style={styles.errorMessageContainer}>
                    <Text style={styles.errorMessageText}>{subjectModalError}</Text>
                  </View>
                )}
                
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
                  <Button title="Cancel" onPress={() => setModalVisible(false)} />
                  <Button title="Save" onPress={handleSaveSubject} />
                </View>
              </View>
            </View>
          </Modal>
          </ScrollView>
          {/* Sticky Floating Add Button */}
          <TouchableOpacity style={styles.fab} onPress={openAddSubject}>
            <Text style={styles.fabIcon}>+</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.scrollWrapper}>
          <ScrollView 
            style={styles.scrollContainer} 
            contentContainerStyle={styles.timetableScrollContent}
            showsVerticalScrollIndicator={Platform.OS === 'web'}
            keyboardShouldPersistTaps="handled"
            bounces={Platform.OS !== 'web'}
            refreshControl={Platform.OS !== 'web' ? (
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={onRefresh} 
                colors={['#4CAF50']}
                tintColor="#4CAF50"
              />
            ) : undefined}
          >
          {/* Class Selector */}
          <View style={styles.classSelector}>
            <View style={styles.selectorHeader}>
              <Ionicons name="school" size={20} color="#2196F3" />
              <Text style={styles.selectorLabel}>Select Class</Text>
            </View>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={selectedClass}
                style={styles.classPicker}
                onValueChange={setSelectedClass}
              >
                {classes.map(c => (
                  <Picker.Item 
                    key={c.id} 
                    label={`${c.class_name} - ${c.section}`} 
                    value={c.id} 
                  />
                ))}
              </Picker>
              <Ionicons name="chevron-down" size={20} color="#666" style={styles.pickerIcon} />
            </View>
          </View>

          {/* Day Selector Tabs */}
          <View style={styles.dayTabsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayTabs}>
              {days.map((day, index) => {
                const isSelected = selectedDay === day;
                const dayPeriods = timetables[selectedClass]?.[day] || [];
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dayTab, isSelected && styles.selectedDayTab]}
                    onPress={() => setSelectedDay(day)}
                  >
                    <Text style={[styles.dayTabText, isSelected && styles.selectedDayTabText]}>
                      {day.substring(0, 3)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Period Entry List - Remove nested ScrollView */}
          <View style={styles.periodsContainer}>
            <View style={styles.periodsHeader}>
              <Text style={styles.periodsTitle}>Periods for {selectedDay}</Text>
              <View style={styles.headerActions}>
                <TouchableOpacity 
                  style={styles.copyDayButton}
                  onPress={() => openCopyDayModal()}
                >
                  <Ionicons name="copy" size={16} color="#2196F3" />
                  <Text style={styles.copyDayText}>Copy Day</Text>
                </TouchableOpacity>
                {copiedDayData && copiedDayData.length > 0 && (
                  <TouchableOpacity 
                    style={styles.pasteDayButton}
                    onPress={() => pasteDayTimetable()}
                  >
                    <Ionicons name="clipboard" size={16} color="#4CAF50" />
                    <Text style={styles.pasteDayText}>Paste</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            
            {/* Period Settings Button - Below header */}
            <TouchableOpacity 
              style={styles.settingsButtonLarge}
              onPress={() => openPeriodSettingsModal()}
            >
              <Ionicons name="settings" size={18} color="#2196F3" />
              <Text style={styles.settingsTextLarge}>Configure Period Timings</Text>
              <Ionicons name="chevron-right" size={16} color="#2196F3" />
            </TouchableOpacity>

            {/* Pre-defined time slots */}
            {getTimeSlots().map((slot, index) => {
              const existingPeriod = timetables[selectedClass]?.[selectedDay]?.find(
                p => p.startTime === slot.startTime
              );
              
              // Debug logging for existingPeriod calculation
              if (Platform.OS === 'web') {
                console.log(`🔍 Slot ${slot.number} (${slot.startTime}):`, {
                  existingPeriod: existingPeriod ? {
                    id: existingPeriod.id,
                    subjectId: existingPeriod.subjectId,
                    label: existingPeriod.label
                  } : null,
                  dayPeriods: timetables[selectedClass]?.[selectedDay]?.length || 0,
                  refreshCounter
                });
              }
              return (
                <View key={`period-${selectedClass}-${selectedDay}-${slot.startTime}`} style={styles.periodSlot}>
                  <View style={styles.periodTimeSlot}>
                    <Text style={styles.periodNumber}>Period {slot.number}</Text>
                    <Text style={styles.periodTime}>
                      {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                    </Text>
                    <Text style={styles.periodDuration}>({slot.duration} min)</Text>
                  </View>
                  <View style={styles.subjectSelector}>
                    <View style={styles.subjectPickerWrapper}>
                      <Picker
                        key={`picker-${selectedClass}-${selectedDay}-${slot.startTime}`}
                        selectedValue={existingPeriod?.subjectId || ''}
                        style={styles.subjectPicker}
                        onValueChange={(subjectId) => {
                          console.log('🔄 Picker onChange STARTED:', { 
                            selectedDay, 
                            slotTime: slot.startTime, 
                            subjectId, 
                            existingPeriod: existingPeriod?.label,
                            platform: Platform.OS,
                            timestamp: new Date().toISOString()
                          });
                          
                          // Use the safe wrapper function for all platforms
                          safeHandleSubjectChange(selectedDay, slot, subjectId);
                          
                          console.log('🔄 Picker onChange COMPLETED:', { 
                            selectedDay, 
                            slotTime: slot.startTime, 
                            subjectId,
                            timestamp: new Date().toISOString()
                          });
                        }}
                      >
                        <Picker.Item label="Select Subject" value="" />
                        {getClassSubjects().map(subject => (
                          <Picker.Item 
                            key={subject.id} 
                            label={subject.name} 
                            value={subject.id} 
                          />
                        ))}
                      </Picker>
                    </View>
                    {existingPeriod && (
                      <TouchableOpacity
                        style={styles.removeSubjectButton}
                        onPress={() => removePeriod(selectedDay, existingPeriod.id)}
                      >
                        <Ionicons name="trash" size={16} color="#f44336" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={styles.clearDayButton}
              onPress={() => clearDay()}
            >
              <Ionicons name="refresh" size={16} color="#666" />
              <Text style={styles.clearDayText}>Clear Day</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.saveTimetableButton}
              onPress={() => saveDayTimetable()}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                  <Text style={styles.saveTimetableText}>Save Timetable</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          </ScrollView>
        </View>
      )}

      {/* Period Modal */}
      <Modal visible={periodModal.visible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{periodModal.period ? 'Edit Period' : 'Add Period'}</Text>
            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
              <TouchableOpacity
                style={[styles.typeBtn, periodForm.type === 'subject' && styles.activeTypeBtn]}
                onPress={() => setPeriodForm(f => ({ ...f, type: 'subject' }))}
              >
                <Text>Subject</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeBtn, periodForm.type === 'break' && styles.activeTypeBtn]}
                onPress={() => setPeriodForm(f => ({ ...f, type: 'break' }))}
              >
                <Text>Break</Text>
              </TouchableOpacity>
            </View>
            {periodForm.type === 'subject' ? (
              <>
                <Text style={{ marginTop: 8 }}>Subject:</Text>
                <Picker
                  selectedValue={periodForm.subjectId}
                  style={styles.input}
                  onValueChange={itemValue => setPeriodForm(f => ({ ...f, subjectId: itemValue }))}
                >
                  {subjects.map(s => (
                    <Picker.Item key={s.id} label={s.name} value={s.id} />
                  ))}
                </Picker>
              </>
            ) : (
              <>
                <TextInput
                  placeholder="Break Label (e.g., Tea Break, Lunch Break)"
                  value={periodForm.label}
                  onChangeText={text => setPeriodForm(f => ({ ...f, label: text }))}
                  style={styles.input}
                />
              </>
            )}
            {/* SIMPLE TIME PICKER WITH CLEAR AM/PM */}
            <Text style={{ marginTop: 16, marginBottom: 8, fontSize: 18, fontWeight: 'bold', color: '#2196F3' }}>Start Time</Text>
            <View style={styles.simpleTimeRow}>
              <View style={styles.timeInputContainer}>
                <Text style={styles.timeLabel}>Time:</Text>
                <Picker
                  selectedValue={periodForm.startTime || '09:00'}
                  style={styles.simpleTimePicker}
                  onValueChange={(time) => {
                    setPeriodForm(f => ({ ...f, startTime: time }));
                  }}
                >
                  {/* AM Times */}
                  <Picker.Item label="12:00 AM" value="00:00" />
                  <Picker.Item label="12:30 AM" value="00:30" />
                  <Picker.Item label="01:00 AM" value="01:00" />
                  <Picker.Item label="01:30 AM" value="01:30" />
                  <Picker.Item label="02:00 AM" value="02:00" />
                  <Picker.Item label="02:30 AM" value="02:30" />
                  <Picker.Item label="03:00 AM" value="03:00" />
                  <Picker.Item label="03:30 AM" value="03:30" />
                  <Picker.Item label="04:00 AM" value="04:00" />
                  <Picker.Item label="04:30 AM" value="04:30" />
                  <Picker.Item label="05:00 AM" value="05:00" />
                  <Picker.Item label="05:30 AM" value="05:30" />
                  <Picker.Item label="06:00 AM" value="06:00" />
                  <Picker.Item label="06:30 AM" value="06:30" />
                  <Picker.Item label="07:00 AM" value="07:00" />
                  <Picker.Item label="07:30 AM" value="07:30" />
                  <Picker.Item label="08:00 AM" value="08:00" />
                  <Picker.Item label="08:30 AM" value="08:30" />
                  <Picker.Item label="09:00 AM" value="09:00" />
                  <Picker.Item label="09:30 AM" value="09:30" />
                  <Picker.Item label="10:00 AM" value="10:00" />
                  <Picker.Item label="10:30 AM" value="10:30" />
                  <Picker.Item label="11:00 AM" value="11:00" />
                  <Picker.Item label="11:30 AM" value="11:30" />
                  {/* PM Times */}
                  <Picker.Item label="12:00 PM" value="12:00" />
                  <Picker.Item label="12:30 PM" value="12:30" />
                  <Picker.Item label="01:00 PM" value="13:00" />
                  <Picker.Item label="01:30 PM" value="13:30" />
                  <Picker.Item label="02:00 PM" value="14:00" />
                  <Picker.Item label="02:30 PM" value="14:30" />
                  <Picker.Item label="03:00 PM" value="15:00" />
                  <Picker.Item label="03:30 PM" value="15:30" />
                  <Picker.Item label="04:00 PM" value="16:00" />
                  <Picker.Item label="04:30 PM" value="16:30" />
                  <Picker.Item label="05:00 PM" value="17:00" />
                  <Picker.Item label="05:30 PM" value="17:30" />
                  <Picker.Item label="06:00 PM" value="18:00" />
                  <Picker.Item label="06:30 PM" value="18:30" />
                  <Picker.Item label="07:00 PM" value="19:00" />
                  <Picker.Item label="07:30 PM" value="19:30" />
                  <Picker.Item label="08:00 PM" value="20:00" />
                  <Picker.Item label="08:30 PM" value="20:30" />
                  <Picker.Item label="09:00 PM" value="21:00" />
                  <Picker.Item label="09:30 PM" value="21:30" />
                  <Picker.Item label="10:00 PM" value="22:00" />
                  <Picker.Item label="10:30 PM" value="22:30" />
                  <Picker.Item label="11:00 PM" value="23:00" />
                  <Picker.Item label="11:30 PM" value="23:30" />
                </Picker>
              </View>
            </View>
            
            <Text style={{ marginTop: 16, marginBottom: 8, fontSize: 18, fontWeight: 'bold', color: '#2196F3' }}>End Time</Text>
            <View style={styles.simpleTimeRow}>
              <View style={styles.timeInputContainer}>
                <Text style={styles.timeLabel}>Time:</Text>
                <Picker
                  selectedValue={periodForm.endTime || '10:00'}
                  style={styles.simpleTimePicker}
                  onValueChange={(time) => {
                    setPeriodForm(f => ({ ...f, endTime: time }));
                  }}
                >
                  {/* AM Times */}
                  <Picker.Item label="12:00 AM" value="00:00" />
                  <Picker.Item label="12:30 AM" value="00:30" />
                  <Picker.Item label="01:00 AM" value="01:00" />
                  <Picker.Item label="01:30 AM" value="01:30" />
                  <Picker.Item label="02:00 AM" value="02:00" />
                  <Picker.Item label="02:30 AM" value="02:30" />
                  <Picker.Item label="03:00 AM" value="03:00" />
                  <Picker.Item label="03:30 AM" value="03:30" />
                  <Picker.Item label="04:00 AM" value="04:00" />
                  <Picker.Item label="04:30 AM" value="04:30" />
                  <Picker.Item label="05:00 AM" value="05:00" />
                  <Picker.Item label="05:30 AM" value="05:30" />
                  <Picker.Item label="06:00 AM" value="06:00" />
                  <Picker.Item label="06:30 AM" value="06:30" />
                  <Picker.Item label="07:00 AM" value="07:00" />
                  <Picker.Item label="07:30 AM" value="07:30" />
                  <Picker.Item label="08:00 AM" value="08:00" />
                  <Picker.Item label="08:30 AM" value="08:30" />
                  <Picker.Item label="09:00 AM" value="09:00" />
                  <Picker.Item label="09:30 AM" value="09:30" />
                  <Picker.Item label="10:00 AM" value="10:00" />
                  <Picker.Item label="10:30 AM" value="10:30" />
                  <Picker.Item label="11:00 AM" value="11:00" />
                  <Picker.Item label="11:30 AM" value="11:30" />
                  {/* PM Times */}
                  <Picker.Item label="12:00 PM" value="12:00" />
                  <Picker.Item label="12:30 PM" value="12:30" />
                  <Picker.Item label="01:00 PM" value="13:00" />
                  <Picker.Item label="01:30 PM" value="13:30" />
                  <Picker.Item label="02:00 PM" value="14:00" />
                  <Picker.Item label="02:30 PM" value="14:30" />
                  <Picker.Item label="03:00 PM" value="15:00" />
                  <Picker.Item label="03:30 PM" value="15:30" />
                  <Picker.Item label="04:00 PM" value="16:00" />
                  <Picker.Item label="04:30 PM" value="16:30" />
                  <Picker.Item label="05:00 PM" value="17:00" />
                  <Picker.Item label="05:30 PM" value="17:30" />
                  <Picker.Item label="06:00 PM" value="18:00" />
                  <Picker.Item label="06:30 PM" value="18:30" />
                  <Picker.Item label="07:00 PM" value="19:00" />
                  <Picker.Item label="07:30 PM" value="19:30" />
                  <Picker.Item label="08:00 PM" value="20:00" />
                  <Picker.Item label="08:30 PM" value="20:30" />
                  <Picker.Item label="09:00 PM" value="21:00" />
                  <Picker.Item label="09:30 PM" value="21:30" />
                  <Picker.Item label="10:00 PM" value="22:00" />
                  <Picker.Item label="10:30 PM" value="22:30" />
                  <Picker.Item label="11:00 PM" value="23:00" />
                  <Picker.Item label="11:30 PM" value="23:30" />
                </Picker>
              </View>
            </View>

            {periodForm.type === 'subject' && (
              <TextInput
                placeholder="Room Number (optional)"
                value={periodForm.room}
                onChangeText={text => setPeriodForm(f => ({ ...f, room: text }))}
                style={styles.input}
              />
            )}
            {Platform.OS !== 'web' && showTimePicker.visible && (
              <CrossPlatformDatePicker
                value={showTimePicker.value}
                mode="time"
                is24Hour={true}
                display="clock"
                onChange={onTimePicked}
              />
            )}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
              <Button title="Cancel" onPress={() => setPeriodModal({ visible: false, day: '', period: null })} />
              <Button title="Save" onPress={handleSavePeriod} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Period Settings Modal */}
      <Modal visible={periodSettingsModal.visible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.largeModalContent]}>
            <Text style={styles.modalTitle}>Period Settings</Text>
            <Text style={styles.modalSubtitle}>Configure period timings for all days</Text>
            
            <ScrollView style={styles.periodSettingsList}>
              {periodSettings.map((period, index) => (
                <View key={index} style={styles.periodSettingRow}>
                  <View style={styles.periodSettingHeader}>
                    <Text style={styles.periodSettingNumber}>Period {period.number}</Text>
                    <TouchableOpacity
                      style={styles.removePeriodButton}
                      onPress={() => removePeriodSlot(index)}
                    >
                      <Ionicons name="trash" size={16} color="#f44336" />
                    </TouchableOpacity>
                  </View>
                  
                  {Platform.OS === 'web' ? (
                    <View style={styles.timeInputRow}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <CrossPlatformDatePicker
                          label="Start Time"
                          value={(() => {
                            const [h, m] = period.startTime.split(':').map(Number);
                            return new Date(1970, 0, 1, h, m);
                          })()}
                          onChange={(event, selectedDate) => {
                            if (selectedDate) {
                              const h = selectedDate.getHours().toString().padStart(2, '0');
                              const m = selectedDate.getMinutes().toString().padStart(2, '0');
                              updatePeriodSlot(index, 'startTime', `${h}:${m}`);
                            }
                          }}
                          mode="time"
                          placeholder="Start Time"
                          containerStyle={{ marginBottom: 8 }}
                        />
                      </View>
                      
                      <Text style={styles.timeSeparator}>to</Text>
                      
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <CrossPlatformDatePicker
                          label="End Time"
                          value={(() => {
                            const [h, m] = period.endTime.split(':').map(Number);
                            return new Date(1970, 0, 1, h, m);
                          })()}
                          onChange={(event, selectedDate) => {
                            if (selectedDate) {
                              const h = selectedDate.getHours().toString().padStart(2, '0');
                              const m = selectedDate.getMinutes().toString().padStart(2, '0');
                              updatePeriodSlot(index, 'endTime', `${h}:${m}`);
                            }
                          }}
                          mode="time"
                          placeholder="End Time"
                          containerStyle={{ marginBottom: 8 }}
                        />
                      </View>
                      
                      <View style={styles.durationDisplay}>
                        <Text style={styles.durationText}>{period.duration} min</Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.timeInputRow}>
                      <TouchableOpacity
                        style={styles.timeInput}
                        onPress={() => {
                          const [h, m] = period.startTime.split(':').map(Number);
                          const date = new Date();
                          date.setHours(h, m);
                          setShowTimePicker({ 
                            visible: true, 
                            field: `period_${index}_start`,
                            value: date 
                          });
                        }}
                      >
                        <Text style={styles.timeInputText}>{formatTime(period.startTime)}</Text>
                      </TouchableOpacity>
                      
                      <Text style={styles.timeSeparator}>to</Text>
                      
                      <TouchableOpacity
                        style={styles.timeInput}
                        onPress={() => {
                          const [h, m] = period.endTime.split(':').map(Number);
                          const date = new Date();
                          date.setHours(h, m);
                          setShowTimePicker({ 
                            visible: true, 
                            field: `period_${index}_end`,
                            value: date 
                          });
                        }}
                      >
                        <Text style={styles.timeInputText}>{formatTime(period.endTime)}</Text>
                      </TouchableOpacity>
                      
                      <View style={styles.durationDisplay}>
                        <Text style={styles.durationText}>{period.duration} min</Text>
                      </View>
                    </View>
                  )}
                </View>
              ))}
              
              <TouchableOpacity
                style={styles.addPeriodButton}
                onPress={addPeriodSlot}
              >
                <Ionicons name="add" size={20} color="#2196F3" />
                <Text style={styles.addPeriodText}>Add Period</Text>
              </TouchableOpacity>
            </ScrollView>
            
            {Platform.OS !== 'web' && showTimePicker.visible && showTimePicker.field.startsWith('period_') && (
              <CrossPlatformDatePicker
                value={showTimePicker.value}
                mode="time"
                is24Hour={true}
                display="clock"
                onChange={(event, selectedDate) => {
                  if (event.type === 'dismissed') {
                    setShowTimePicker({ ...showTimePicker, visible: false });
                    return;
                  }
                  
                  const date = selectedDate || showTimePicker.value;
                  const h = date.getHours().toString().padStart(2, '0');
                  const m = date.getMinutes().toString().padStart(2, '0');
                  const time = `${h}:${m}`;
                  
                  const [, indexStr, type] = showTimePicker.field.split('_');
                  const index = parseInt(indexStr);
                  const field = type === 'start' ? 'startTime' : 'endTime';
                  
                  updatePeriodSlot(index, field, time);
                  setShowTimePicker({ ...showTimePicker, visible: false });
                }}
              />
            )}
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setPeriodSettingsModal({ visible: false })}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={savePeriodSettings}
              >
                <Text style={styles.saveButtonText}>Save Settings</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Copy Day Modal */}
      <Modal visible={copyDayModal.visible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Copy Day Timetable</Text>
            <Text style={styles.modalSubtitle}>Select a day to copy its timetable</Text>
            
            <ScrollView style={styles.copyDayList}>
              {days.map(day => {
                const dayPeriods = timetables[selectedClass]?.[day] || [];
                const periodCount = dayPeriods.length;
                
                return (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.copyDayOption,
                      periodCount === 0 && styles.copyDayOptionDisabled
                    ]}
                    onPress={() => periodCount > 0 ? copyDayTimetable(day) : null}
                    disabled={periodCount === 0}
                  >
                    <View style={styles.copyDayInfo}>
                      <Text style={[
                        styles.copyDayName,
                        periodCount === 0 && styles.copyDayNameDisabled
                      ]}>
                        {day}
                      </Text>
                      <Text style={[
                        styles.copyDayPeriods,
                        periodCount === 0 && styles.copyDayPeriodsDisabled
                      ]}>
                        {periodCount} {periodCount === 1 ? 'period' : 'periods'}
                      </Text>
                    </View>
                    {periodCount > 0 && (
                      <Ionicons name="chevron-forward" size={20} color="#2196F3" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setCopyDayModal({ visible: false })}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#007bff',
    backgroundColor: '#fff',
  },
  tabText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Enhanced scroll wrapper styles for web compatibility
  scrollWrapper: {
    flex: 1,
    ...Platform.select({
      web: {
        height: 'calc(100vh - 160px)',
        maxHeight: 'calc(100vh - 160px)',
        minHeight: 400,
        overflow: 'hidden',
      },
    }),
  },
  scrollContainer: {
    flex: 1,
    ...Platform.select({
      web: {
        overflowY: 'auto'
      }
    })
  },
  content: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      maxHeight: '75vh',
      overflowY: 'auto'
    })
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },
  subjectsSection: {
    paddingTop: 16,
    paddingBottom: 100,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    elevation: 1,
  },
  subjectName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  subjectClass: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  subjectTeacher: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  actionBtn: {
    marginLeft: 12,
    padding: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 8,
    width: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 8,
    marginTop: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  dayBlock: {
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    elevation: 1,
  },
  dayTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 80,
    backgroundColor: '#007bff',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 1000,
    ...(Platform.OS === 'web' && {
      position: 'fixed',
      zIndex: 9999,
      right: '24px',
      bottom: '80px',
    })
  },
  fabIcon: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: -2,
  },
  addPeriodBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#e0e0e0',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  addPeriodBtnText: {
    fontSize: 16,
    color: '#007bff',
    fontWeight: 'bold',
  },
  deletePeriodBtn: {
    marginLeft: 8,
    padding: 4,
    borderRadius: 4,
    backgroundColor: '#ffdddd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deletePeriodIcon: {
    fontSize: 18,
    color: '#d00',
  },
  periodTeacher: {
    marginLeft: 8,
    fontSize: 14,
    color: '#555',
    minWidth: 80,
  },
  periodCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  periodTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a237e',
  },
  periodTime: {
    fontSize: 14,
    color: '#333',
    marginTop: 2,
  },
  periodTeacher: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  typeBtn: {
    flex: 1,
    padding: 8,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    alignItems: 'center',
  },
  activeTypeBtn: {
    backgroundColor: '#e3f2fd',
    borderColor: '#1976d2',
  },
  // New Timetable Styles
  timetableContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    ...(Platform.OS === 'web' && {
      maxHeight: '75vh',
      overflowY: 'auto'
    })
  },
  timetableScrollContent: {
    paddingBottom: 120,
    flexGrow: 1,
  },
  timetableHeader: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  timetableTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 4,
  },
  timetableSubtitle: {
    fontSize: 16,
    color: '#6c757d',
  },
  classSelector: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 20,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  selectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectorLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
    marginLeft: 8,
  },
  pickerWrapper: {
    position: 'relative',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  classPicker: {
    height: 50,
    backgroundColor: 'transparent',
  },
  pickerIcon: {
    position: 'absolute',
    right: 12,
    top: 15,
    pointerEvents: 'none',
  },
  dayTabsContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  dayTabs: {
    paddingVertical: 16,
    paddingLeft: 12,
    paddingRight: 12,
  },
  dayTab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 6,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    alignItems: 'center',
    minWidth: 72,
    position: 'relative',
  },
  selectedDayTab: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  dayTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6c757d',
  },
  selectedDayTabText: {
    color: '#fff',
  },
  periodsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 250,
    paddingTop: 16,
  },
  periodsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  periodsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#495057',
  },
  copyDayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#e3f2fd',
    borderRadius: 16,
  },
  copyDayText: {
    fontSize: 12,
    color: '#2196F3',
    marginLeft: 4,
    fontWeight: '500',
  },
  periodSlot: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    alignItems: 'center',
  },
  periodTimeSlot: {
    flex: 1,
    paddingRight: 16,
  },
  periodNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2196F3',
    marginBottom: 4,
  },
  periodTime: {
    fontSize: 14,
    color: '#495057',
    fontWeight: '500',
    marginBottom: 2,
  },
  periodDuration: {
    fontSize: 12,
    color: '#6c757d',
  },
  subjectSelector: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  subjectPickerWrapper: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
    marginRight: 8,
    minHeight: 50,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  subjectPicker: {
    height: 50,
    backgroundColor: 'transparent',
    color: '#495057',
    paddingHorizontal: 8,
  },
  removeSubjectButton: {
    padding: 8,
    backgroundColor: '#ffebee',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtons: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 24,
    paddingBottom: 40,
    minHeight: 84,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    alignItems: 'center',
  },
  clearDayButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dee2e6',
    marginRight: 8,
    minHeight: 48,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  clearDayText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6c757d',
    marginLeft: 6,
  },
  saveTimetableButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#28a745',
    borderRadius: 10,
    marginLeft: 8,
    minHeight: 48,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  saveTimetableText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 6,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f0f8ff',
    borderRadius: 16,
    marginRight: 8,
  },
  settingsText: {
    fontSize: 11,
    color: '#2196F3',
    marginLeft: 4,
    fontWeight: '500',
  },
  settingsButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbdefb',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  settingsTextLarge: {
    fontSize: 14,
    color: '#2196F3',
    marginLeft: 8,
    marginRight: 8,
    fontWeight: '600',
    flex: 1,
  },
  copyDayText: {
    fontSize: 11,
    color: '#2196F3',
    marginLeft: 4,
    fontWeight: '500',
  },
  pasteDayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#e8f5e8',
    borderRadius: 16,
    marginLeft: 8,
  },
  pasteDayText: {
    fontSize: 11,
    color: '#4CAF50',
    marginLeft: 4,
    fontWeight: '500',
  },
  copyDayList: {
    maxHeight: 300,
    marginBottom: 16,
  },
  copyDayOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  copyDayOptionDisabled: {
    backgroundColor: '#f8f9fa',
    borderColor: '#e9ecef',
    opacity: 0.6,
  },
  copyDayInfo: {
    flex: 1,
  },
  copyDayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 2,
  },
  copyDayNameDisabled: {
    color: '#adb5bd',
  },
  copyDayPeriods: {
    fontSize: 14,
    color: '#6c757d',
  },
  copyDayPeriodsDisabled: {
    color: '#adb5bd',
  },
  largeModalContent: {
    width: '90%',
    height: '80%',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 16,
  },
  periodSettingsList: {
    flex: 1,
    marginVertical: 8,
  },
  periodSettingRow: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  periodSettingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  periodSettingNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2196F3',
  },
  removePeriodButton: {
    padding: 6,
    backgroundColor: '#ffebee',
    borderRadius: 6,
  },
  timeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  timeInputText: {
    fontSize: 14,
    color: '#495057',
    fontWeight: '500',
  },
  timeSeparator: {
    fontSize: 14,
    color: '#6c757d',
    marginHorizontal: 8,
  },
  durationDisplay: {
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  durationText: {
    fontSize: 12,
    color: '#28a745',
    fontWeight: '500',
  },
  addPeriodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#bbdefb',
    borderStyle: 'dashed',
  },
  addPeriodText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
    marginLeft: 6,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    marginRight: 8,
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#28a745',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    marginLeft: 8,
  },
  saveButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  modalPicker: {
    height: 50,
    backgroundColor: 'transparent',
    color: '#495057',
  },
  errorMessageContainer: {
    backgroundColor: '#ffebee',
    borderWidth: 1,
    borderColor: '#f44336',
    borderRadius: 6,
    padding: 12,
    marginTop: 12,
  },
  errorMessageText: {
    color: '#d32f2f',
    fontSize: 14,
    lineHeight: 20,
  },
  modalLabel: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  modalPickerWrapper: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
    minHeight: 50,
    justifyContent: 'center',
  },
  modalPickerItem: {
    fontSize: 16,
    color: '#495057',
    ...(Platform.OS === 'ios' && {
      textAlign: 'left',
    }),
  },
  // Time Picker Styles
  timePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  timePickerGroup: {
    flex: 1,
    marginHorizontal: 4,
  },
  timePickerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 4,
    textAlign: 'center',
  },
  timePicker: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
    minHeight: 50,
    fontSize: 14,
  },
  // Simple Time Picker Styles
  simpleTimeRow: {
    marginBottom: 16,
  },
  timeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
    marginRight: 12,
    minWidth: 50,
  },
  simpleTimePicker: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
    minHeight: 50,
    fontSize: 16,
  },
});

export default SubjectsTimetable;