import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Alert, Keyboard, RefreshControl, Linking, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import * as DocumentPicker from 'expo-document-picker';
import Header from '../../components/Header';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../utils/AuthContext';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';
import { useTenantAccess, tenantDatabase, createTenantQuery, getCachedTenantId } from '../../utils/tenantHelpers';
import { useMessageStatus } from '../../utils/useMessageStatus';
import { formatToLocalTime, debugTimestamp } from '../../utils/timeUtils';
import { uploadChatFile, formatFileSize, getFileIcon, isSupportedFileType } from '../../utils/chatFileUpload';
import { handleFileView, formatFileSize as formatFileSizeDisplay, getFileTypeColor } from '../../utils/fileViewer';
import ImageViewer from '../../components/ImageViewer';
import { getGlobalMessageHandler } from '../../utils/realtimeMessageHandler';
import universalNotificationService from '../../services/UniversalNotificationService';

// Debug mode configuration
const DEBUG_MODE = __DEV__ && true; // Enable debug logging and UI elements

const TeacherChat = () => {
  const { user } = useAuth();
  const tenantAccess = useTenantAccess();
  const { markMessagesAsRead } = useMessageStatus();
  const [activeTab, setActiveTab] = useState('parents'); // 'parents' or 'students'
  const [parents, setParents] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null); // Can be parent or student
  const [messages, setMessages] = useState([]);
  // Cached context for reducing redundant calls
  const [tenantId, setTenantId] = useState(null);
  const [teacherId, setTeacherId] = useState(null);
  const MESSAGE_PAGE_SIZE = 50;
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({}); // Track unread messages per contact
  const [refreshingParents, setRefreshingParents] = useState(false);
  const [refreshingStudents, setRefreshingStudents] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [currentImage, setCurrentImage] = useState(null);
  const flatListRef = useRef(null);
  const badgeSubscriptionRef = useRef(null);
  
  // Typing indicator state and refs
  const [isContactTyping, setIsContactTyping] = useState(false);
  const typingChannelRef = useRef(null);
  const typingDebounceRef = useRef(null);
  const typingIndicatorTimeoutRef = useRef(null);
  const lastTypingSentRef = useRef(0);
  
  // Debug state variables
  const [tenantLoading, setTenantLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState({
    tenantContext: null,
    teacherResolution: null,
    dataFetchStatus: null
  });

  // Helper function to validate tenant readiness and get effective tenant ID
  const validateTenantReadiness = async () => {
    console.log('🔍 [TeacherChat] validateTenantReadiness - Starting validation');
    console.log('🔍 [TeacherChat] User state:', { 
      id: user?.id, 
      email: user?.email 
    });
    console.log('🔍 [TeacherChat] Tenant access state:', { 
      isReady: tenantAccess.isReady,
      isLoading: tenantAccess.isLoading,
      currentTenant: tenantAccess.currentTenant?.id
    });
    
    // Wait for tenant system to be ready
    if (!tenantAccess.isReady || tenantAccess.isLoading) {
      console.log('⏳ [TeacherChat] Tenant system not ready, waiting...');
      return { success: false, reason: 'TENANT_NOT_READY' };
    }
    
    // Get effective tenant ID
    const effectiveTenantId = await getCachedTenantId();
    if (!effectiveTenantId) {
      console.log('❌ [TeacherChat] No effective tenant ID available');
      return { success: false, reason: 'NO_TENANT_ID' };
    }
    
    console.log('✅ [TeacherChat] Tenant validation successful:', {
      effectiveTenantId,
      currentTenant: tenantAccess.currentTenant?.id
    });
    
    return { 
      success: true, 
      effectiveTenantId,
      tenantContext: tenantAccess.currentTenant
    };
  };

  // Keyboard visibility listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  // Helper function to get parent's user ID from student
  const getParentUserId = async (studentId) => {
    try {
      // Method 1: Try via linked_parent_of
      const { data: parentUser, error: parentError } = await supabase
        .from(TABLES.USERS)
        .select('id, email, full_name')
        .eq('linked_parent_of', studentId)
        .single();

      if (parentUser && !parentError) {
        return {
          id: parentUser.id,
          name: parentUser.full_name || parentUser.email,
          email: parentUser.email
        };
      }

      // Method 2: Get student data and find parent via parent_id
      const { data: studentData, error: studentError } = await supabase
        .from(TABLES.STUDENTS)
        .select('parent_id')
        .eq('id', studentId)
        .single();

      if (!studentError && studentData?.parent_id) {
        // Get parent user info
        const { data: parentUserData, error: parentUserError } = await supabase
          .from(TABLES.USERS)
          .select('id, email, full_name')
          .eq('id', studentData.parent_id)
          .single();

        if (!parentUserError && parentUserData) {
          return {
            id: parentUserData.id,
            name: parentUserData.full_name || parentUserData.email,
            email: parentUserData.email
          };
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  };

  // Global real-time subscription for badge updates
  useEffect(() => {
    if (!user?.id) return;

    console.log('🔔 TeacherChat: Setting up global badge subscription for teacher:', user.id);

    // Setup global real-time subscription for badge updates
    const setupBadgeSubscription = () => {
      const channelName = `teacher-badge-${user.id}-${Date.now()}`;
      
      badgeSubscriptionRef.current = supabase
        .channel(channelName)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`
        }, (payload) => {
          console.log('📨 TeacherChat Badge: New message received from:', payload.new?.sender_id);
          
          if (payload.new?.sender_id && payload.new.sender_id !== user.id) {
            // Increment unread count for this sender
            setUnreadCounts(prev => {
              const updated = { ...prev };
              updated[payload.new.sender_id] = (updated[payload.new.sender_id] || 0) + 1;
              console.log('📊 TeacherChat Badge: Updated counts:', updated);
              return updated;
            });
          }
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`
        }, (payload) => {
          console.log('📝 TeacherChat Badge: Message updated:', payload);
          
          // If message was marked as read, decrease unread count
          if (payload.new?.is_read && !payload.old?.is_read && payload.new?.sender_id) {
            console.log('✅ TeacherChat Badge: Message marked as read from:', payload.new.sender_id);
            setUnreadCounts(prev => {
              const updated = { ...prev };
              if (updated[payload.new.sender_id]) {
                updated[payload.new.sender_id] = Math.max(0, updated[payload.new.sender_id] - 1);
                if (updated[payload.new.sender_id] === 0) {
                  delete updated[payload.new.sender_id];
                }
              }
              console.log('📊 TeacherChat Badge: Updated counts after read:', updated);
              return updated;
            });
          }
        })
        .on('postgres_changes', {
          event: 'DELETE',
          schema: 'public',
          table: 'messages'
        }, (payload) => {
          console.log('🗑️ TeacherChat Badge: Message deleted:', payload);
          
          // If a message was deleted, refetch counts to be safe
          if (payload.old?.receiver_id === user.id && payload.old?.sender_id) {
            console.log('🔄 TeacherChat Badge: Refetching counts due to deletion');
            fetchUnreadCounts();
          }
        })
        .subscribe((status) => {
          console.log('📡 TeacherChat Badge: Subscription status:', status);
          if (status === 'SUBSCRIBED') {
            console.log('✅ TeacherChat Badge: Real-time badge updates are working!');
          } else if (status === 'CHANNEL_ERROR') {
            console.log('❌ TeacherChat Badge: Real-time failed, will rely on manual refresh');
          }
        });
    };

    setupBadgeSubscription();

    return () => {
      console.log('🛑 TeacherChat: Cleaning up global badge subscription');
      if (badgeSubscriptionRef.current) {
        try {
          badgeSubscriptionRef.current.unsubscribe();
        } catch (error) {
          console.log('Error unsubscribing from badge updates:', error);
        }
        badgeSubscriptionRef.current = null;
      }
    };
  }, [user?.id]);

  // Reset selection and messages on screen focus
  useFocusEffect(
    React.useCallback(() => {
      setSelectedContact(null);
      setMessages([]);
      fetchData();
    }, [])
  );

  // Fetch unread message counts for all contacts
  const fetchUnreadCounts = async () => {
    try {
      if (!user?.id) return;
      
      console.log('🚀 [TeacherChat] fetchUnreadCounts - Starting with enhanced tenant validation');
      
      // Validate tenant readiness
      const tenantValidation = await validateTenantReadiness();
      if (!tenantValidation.success) {
        console.log('⚠️ [TeacherChat] Tenant not ready for unread counts fetch:', tenantValidation.reason);
        if (tenantValidation.reason === 'TENANT_NOT_READY') {
          // Don't throw error, just use empty counts
          setUnreadCounts({});
          return;
        }
        console.error('❌ [TeacherChat] Tenant validation failed for unread counts:', tenantValidation.reason);
        return;
      }
      
      const { effectiveTenantId } = tenantValidation;
      console.log('✅ [TeacherChat] Using effective tenant ID for unread counts:', effectiveTenantId);
      
      // Get all unread messages for current user with tenant awareness
      const unreadQuery = createTenantQuery(
        effectiveTenantId,
        TABLES.MESSAGES,
        'sender_id'
      ).eq('receiver_id', user.id)
       .eq('is_read', false);
      
      const { data: unreadMessages, error } = await unreadQuery;
      
      if (error && error.code !== '42P01') {
        console.log('❌ TeacherChat: Error fetching unread messages:', error);
        return;
      }
      
      console.log('📊 TeacherChat: Fetched unread messages:', unreadMessages);
      
      // Count unique senders
      const counts = {};
      if (unreadMessages) {
        unreadMessages.forEach(msg => {
          counts[msg.sender_id] = (counts[msg.sender_id] || 0) + 1;
        });
      }
      
      console.log('📊 TeacherChat: Calculated unread counts:', counts);
      setUnreadCounts(counts);
    } catch (error) {
      console.log('❌ TeacherChat: Exception in fetchUnreadCounts:', error);
    }
  };

  // Initialize chat data in one pass: tenant -> teacher -> students -> related users
  const fetchData = async () => {
    setLoading(true);
    setTenantLoading(true);
    setError(null);

    try {
      // 1) Tenant readiness (cached)
      const tenantValidation = await validateTenantReadiness();
      if (!tenantValidation.success) {
        if (tenantValidation.reason === 'TENANT_NOT_READY') {
          setLoading(false);
          setTenantLoading(false);
          return;
        }
        throw new Error('Tenant validation failed: ' + tenantValidation.reason);
      }
      const effectiveTenantId = tenantValidation.effectiveTenantId;
      setTenantId(effectiveTenantId);

      // 2) Resolve teacherId once
      const { data: userInfo } = await createTenantQuery(
        effectiveTenantId,
        TABLES.USERS,
        'linked_teacher_id'
      ).eq('id', user.id);
      const uRecord = Array.isArray(userInfo) ? userInfo?.[0] : userInfo;
      if (!uRecord?.linked_teacher_id) {
        throw new Error('Teacher information not found. Please contact administrator.');
      }
      setTeacherId(uRecord.linked_teacher_id);

      // 3) Fetch students (class + subject) in parallel, once
      const [classStudentResult, subjectStudentResult] = await Promise.all([
        createTenantQuery(
          effectiveTenantId,
          TABLES.STUDENTS,
          `
            id,
            name,
            roll_no,
            class_id,
            classes!inner (
              id,
              class_name,
              section,
              class_teacher_id
            )
          `
        ).eq('classes.class_teacher_id', uRecord.linked_teacher_id),
        createTenantQuery(
          effectiveTenantId,
          TABLES.TEACHER_SUBJECTS,
          `
            subjects!inner (
              id,
              name,
              classes!inner (
                id,
                class_name,
                section,
                students!inner (
                  id,
                  name,
                  roll_no
                )
              )
            )
          `
        ).eq('teacher_id', uRecord.linked_teacher_id)
      ]);

      // 4) Build unique studentIds
      const studentIdSet = new Set();
      (classStudentResult.data || []).forEach(s => studentIdSet.add(s.id));
      (subjectStudentResult.data || []).forEach(ts => {
        (ts.subjects?.classes?.students || []).forEach(s => studentIdSet.add(s.id));
      });
      const studentIds = Array.from(studentIdSet);

      // 5) Fetch only related parent and student user accounts
      const [parentUsersRes, studentUsersRes] = studentIds.length > 0
        ? await Promise.all([
            createTenantQuery(
              effectiveTenantId,
              TABLES.USERS,
              'id, email, full_name, linked_parent_of'
            ).in('linked_parent_of', studentIds),
            createTenantQuery(
              effectiveTenantId,
              TABLES.USERS,
              'id, email, full_name, linked_student_id'
            ).in('linked_student_id', studentIds)
          ])
        : [{ data: [] }, { data: [] }];

      // 6) Build maps
      const parentUserMap = new Map();
      (parentUsersRes.data || []).forEach(u => {
        if (u.linked_parent_of) {
          parentUserMap.set(u.linked_parent_of, {
            id: u.id,
            name: u.full_name || u.email,
            email: u.email,
            canMessage: true
          });
        }
      });
      const studentUserMap = new Map();
      (studentUsersRes.data || []).forEach(u => {
        if (u.linked_student_id) {
          studentUserMap.set(u.linked_student_id, u);
        }
      });

      // 7) Build parents list (unique by parent user)
      const uniqueParents = [];
      const seenParentIds = new Set();
      // class parents
      (classStudentResult.data || []).forEach(student => {
        const p = parentUserMap.get(student.id);
        if (p && !seenParentIds.has(p.id)) {
          uniqueParents.push({
            id: p.id,
            name: p.name,
            email: p.email,
            students: [{
              id: student.id,
              name: student.name,
              roll_no: student.roll_no,
              class: `${student.classes.class_name} ${student.classes.section}`
            }],
            role: 'class_parent',
            canMessage: true
          });
          seenParentIds.add(p.id);
        } else if (p) {
          const existing = uniqueParents.find(x => x.id === p.id);
          if (existing) {
            existing.students.push({
              id: student.id,
              name: student.name,
              roll_no: student.roll_no,
              class: `${student.classes.class_name} ${student.classes.section}`
            });
          }
        }
      });
      // subject parents
      (subjectStudentResult.data || []).forEach(ts => {
        const className = ts.subjects?.classes?.class_name;
        const section = ts.subjects?.classes?.section;
        const subjectName = ts.subjects?.name;
        (ts.subjects?.classes?.students || []).forEach(student => {
          const p = parentUserMap.get(student.id);
          if (p && !seenParentIds.has(p.id)) {
            uniqueParents.push({
              id: p.id,
              name: p.name,
              email: p.email,
              students: [{
                id: student.id,
                name: student.name,
                roll_no: student.roll_no,
                class: `${className} ${section}`,
                subject: subjectName
              }],
              role: 'subject_parent',
              canMessage: true
            });
            seenParentIds.add(p.id);
          } else if (p) {
            const existing = uniqueParents.find(x => x.id === p.id);
            if (existing) {
              const exists = existing.students.some(s => s.id === student.id);
              if (!exists) {
                existing.students.push({
                  id: student.id,
                  name: student.name,
                  roll_no: student.roll_no,
                  class: `${className} ${section}`,
                  subject: subjectName
                });
              }
            }
          }
        });
      });

      // 8) Build students list (unique by student id)
      const uniqueStudents = [];
      const seenStudentIds = new Set();
      (classStudentResult.data || []).forEach(student => {
        if (!seenStudentIds.has(student.id)) {
          const stuUser = studentUserMap.get(student.id);
          const canMessage = !!stuUser;
          uniqueStudents.push({
            id: student.id,
            name: student.name,
            roll_no: student.roll_no,
            email: canMessage ? stuUser.email : null,
            phone: student.phone || null,
            class: `${student.classes.class_name} ${student.classes.section}`,
            role: 'class_student',
            canMessage,
            userId: canMessage ? stuUser.id : null
          });
          seenStudentIds.add(student.id);
        }
      });
      (subjectStudentResult.data || []).forEach(ts => {
        const className = ts.subjects?.classes?.class_name;
        const section = ts.subjects?.classes?.section;
        const subjectName = ts.subjects?.name;
        (ts.subjects?.classes?.students || []).forEach(student => {
          if (!seenStudentIds.has(student.id)) {
            const stuUser = studentUserMap.get(student.id);
            const canMessage = !!stuUser;
            uniqueStudents.push({
              id: student.id,
              name: student.name,
              roll_no: student.roll_no,
              email: canMessage ? stuUser.email : null,
              phone: student.phone || null,
              class: `${className} ${section}`,
              subject: subjectName,
              role: 'subject_student',
              canMessage,
              userId: canMessage ? stuUser.id : null
            });
            seenStudentIds.add(student.id);
          } else {
            const existing = uniqueStudents.find(s => s.id === student.id);
            if (existing && !existing.subject) {
              existing.subject = subjectName;
            }
          }
        });
      });

      setParents(uniqueParents);
      setStudents(uniqueStudents);

      // 9) Fetch unread counts once
      await fetchUnreadCounts();
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message);
    } finally {
      setTenantLoading(false);
      setLoading(false);
    }
  };

  // Fetch parents of students assigned to the teacher - ENHANCED TENANT VERSION
  const fetchParents = async () => {
    try {
      console.log('🚀 [TeacherChat] fetchParents - Starting with enhanced tenant validation');
      
      // Validate tenant readiness
      const tenantValidation = await validateTenantReadiness();
      if (!tenantValidation.success) {
        console.log('⚠️ [TeacherChat] Tenant not ready for parents fetch:', tenantValidation.reason);
        if (tenantValidation.reason === 'TENANT_NOT_READY') {
          // Don't throw error, just use empty array
          setParents([]);
          return;
        }
        throw new Error('Tenant validation failed: ' + tenantValidation.reason);
      }
      
      const { effectiveTenantId } = tenantValidation;
      console.log('✅ [TeacherChat] Using effective tenant ID for parents:', effectiveTenantId);
      
      if (DEBUG_MODE) {
        console.log('👨‍👩‍👧 Starting enhanced parent data fetch for teacher chat...');
      }
      
      // Get teacher info from users table using tenant-aware query
      const userInfoQuery = createTenantQuery(
        effectiveTenantId,
        TABLES.USERS,
        'linked_teacher_id'
      ).eq('id', user.id);
      
      const { data: userInfo, error: userError } = await userInfoQuery;

      if (DEBUG_MODE) {
        console.log('👨‍🏫 Teacher lookup result:', { userInfo, userError });
      }

      // Handle array response from createTenantQuery
      const userRecord = Array.isArray(userInfo) ? userInfo[0] : userInfo;
      
      if (userError || !userRecord?.linked_teacher_id) {
        if (DEBUG_MODE) {
          console.error('❌ Teacher information not found:', userError);
          setDebugInfo(prev => ({
            ...prev,
            teacherResolution: {
              method: 'user_table_lookup',
              success: false,
              error: userError?.message || 'No linked_teacher_id'
            }
          }));
        }
        throw new Error('Teacher information not found. Please contact administrator.');
      }

      const teacherId = userRecord.linked_teacher_id;
      
      if (DEBUG_MODE) {
        console.log('✅ Teacher ID resolved:', teacherId);
        setDebugInfo(prev => ({
          ...prev,
          teacherResolution: {
            method: 'user_table_lookup',
            teacher_id: teacherId,
            success: true
          }
        }));
      }
      const uniqueParents = [];
      const seen = new Set();

      // OPTIMIZED: Execute enhanced tenant-aware queries in parallel for maximum speed
      const [classStudentResult, subjectStudentResult, allParentUsersResult] = await Promise.all([
        // Query 1: Get class teacher students with tenant awareness
        createTenantQuery(
          effectiveTenantId,
          TABLES.STUDENTS,
          `
            id,
            name,
            roll_no,
            class_id,
            classes!inner (
              id,
              class_name,
              section,
              class_teacher_id
            )
          `
        ).eq('classes.class_teacher_id', teacherId),
          
        // Query 2: Get subject teaching students with tenant awareness
        createTenantQuery(
          effectiveTenantId,
          TABLES.TEACHER_SUBJECTS,
          `
            subjects!inner (
              id,
              name,
              classes!inner (
                id,
                class_name,
                section,
                students!inner (
                  id,
                  name,
                  roll_no
                )
              )
            )
          `
        ).eq('teacher_id', teacherId),
          
        // Query 3: Get ALL parent user accounts with tenant awareness
        createTenantQuery(
          effectiveTenantId,
          TABLES.USERS,
          'id, email, full_name, linked_parent_of'
        ).not('linked_parent_of', 'is', null)
      ]);

      // Build parent-user mapping for instant lookups
      const parentUserMap = new Map();
      if (!allParentUsersResult.error && allParentUsersResult.data) {
        allParentUsersResult.data.forEach(user => {
          if (user.linked_parent_of) {
            parentUserMap.set(user.linked_parent_of, {
              id: user.id,
              name: user.full_name || user.email,
              email: user.email,
              canMessage: true
            });
          }
        });
      }

      // Process class teacher students and find their parent users
      if (!classStudentResult.error && classStudentResult.data) {
        for (const student of classStudentResult.data) {
          const parentUser = parentUserMap.get(student.id);
          if (parentUser && !seen.has(parentUser.id)) {
            uniqueParents.push({
              id: parentUser.id,
              name: parentUser.name,
              email: parentUser.email,
              students: [{
                id: student.id,
                name: student.name,
                roll_no: student.roll_no,
                class: `${student.classes.class_name} ${student.classes.section}`
              }],
              role: 'class_parent',
              canMessage: true
            });
            seen.add(parentUser.id);
          } else if (parentUser) {
            // Add student to existing parent
            const existingParent = uniqueParents.find(p => p.id === parentUser.id);
            if (existingParent) {
              existingParent.students.push({
                id: student.id,
                name: student.name,
                roll_no: student.roll_no,
                class: `${student.classes.class_name} ${student.classes.section}`
              });
            }
          }
        }
      }

      // Process subject teaching students and find their parent users
      if (!subjectStudentResult.error && subjectStudentResult.data) {
        for (const teacherSubject of subjectStudentResult.data) {
          if (teacherSubject.subjects?.classes?.students) {
            for (const student of teacherSubject.subjects.classes.students) {
              const parentUser = parentUserMap.get(student.id);
              if (parentUser && !seen.has(parentUser.id)) {
                uniqueParents.push({
                  id: parentUser.id,
                  name: parentUser.name,
                  email: parentUser.email,
                  students: [{
                    id: student.id,
                    name: student.name,
                    roll_no: student.roll_no,
                    class: `${teacherSubject.subjects.classes.class_name} ${teacherSubject.subjects.classes.section}`,
                    subject: teacherSubject.subjects.name
                  }],
                  role: 'subject_parent',
                  canMessage: true
                });
                seen.add(parentUser.id);
              } else if (parentUser) {
                // Add student to existing parent
                const existingParent = uniqueParents.find(p => p.id === parentUser.id);
                if (existingParent) {
                  const studentExists = existingParent.students.some(s => s.id === student.id);
                  if (!studentExists) {
                    existingParent.students.push({
                      id: student.id,
                      name: student.name,
                      roll_no: student.roll_no,
                      class: `${teacherSubject.subjects.classes.class_name} ${teacherSubject.subjects.classes.section}`,
                      subject: teacherSubject.subjects.name
                    });
                  }
                }
              }
            }
          }
        }
      }

      setParents(uniqueParents);
    } catch (err) {
      console.error('Fetch parents error:', err);
      throw err;
    }
  };

  // Fetch students assigned to the teacher - ENHANCED TENANT VERSION
  const fetchStudents = async () => {
    try {
      console.log('🚀 [TeacherChat] fetchStudents - Starting with enhanced tenant validation');
      
      // Validate tenant readiness
      const tenantValidation = await validateTenantReadiness();
      if (!tenantValidation.success) {
        console.log('⚠️ [TeacherChat] Tenant not ready for students fetch:', tenantValidation.reason);
        if (tenantValidation.reason === 'TENANT_NOT_READY') {
          // Don't throw error, just use empty array
          setStudents([]);
          return;
        }
        throw new Error('Tenant validation failed: ' + tenantValidation.reason);
      }
      
      const { effectiveTenantId } = tenantValidation;
      console.log('✅ [TeacherChat] Using effective tenant ID for students:', effectiveTenantId);
      
      // Get teacher info from users table using tenant-aware query
      const userInfoQuery = createTenantQuery(
        effectiveTenantId,
        TABLES.USERS,
        'linked_teacher_id'
      ).eq('id', user.id);
      
      const { data: userInfo, error: userError } = await userInfoQuery;

      // Handle array response from createTenantQuery
      const userRecord = Array.isArray(userInfo) ? userInfo[0] : userInfo;
      
      if (userError || !userRecord?.linked_teacher_id) {
        throw new Error('Teacher information not found. Please contact administrator.');
      }

      const teacherId = userRecord.linked_teacher_id;
      const uniqueStudents = [];
      const seen = new Set();
      const studentUserMap = new Map(); // Cache for student user accounts

      // SUPER OPTIMIZATION 1: Tenant-aware queries to get ALL students and user accounts at once
      const [classStudentResult, subjectStudentResult, allStudentUsersResult] = await Promise.all([
        // Get class students with tenant awareness
        createTenantQuery(
          effectiveTenantId,
          TABLES.STUDENTS,
          `
            id,
            name,
            roll_no,
            class_id,
            classes!inner (
              id,
              class_name,
              section,
              class_teacher_id
            )
          `
        ).eq('classes.class_teacher_id', teacherId),
          
        // Get subject students with tenant awareness
        createTenantQuery(
          effectiveTenantId,
          TABLES.TEACHER_SUBJECTS,
          `
            subjects!inner (
              id,
              name,
              classes!inner (
                id,
                class_name,
                section,
                students!inner (
                  id,
                  name,
                  roll_no
                )
              )
            )
          `
        ).eq('teacher_id', teacherId),
          
        // Get ALL student user accounts with tenant awareness
        createTenantQuery(
          effectiveTenantId,
          TABLES.USERS,
          'id, email, full_name, linked_student_id'
        ).not('linked_student_id', 'is', null)
      ]);

      // Build student-user mapping for instant lookups
      if (!allStudentUsersResult.error && allStudentUsersResult.data) {
        allStudentUsersResult.data.forEach(user => {
          if (user.linked_student_id) {
            studentUserMap.set(user.linked_student_id, user);
          }
        });
      }

      // Process class students
      if (!classStudentResult.error && classStudentResult.data) {
        for (const student of classStudentResult.data) {
          if (!seen.has(student.id)) {
            const studentUser = studentUserMap.get(student.id);
            const canMessage = !!studentUser;
            
            uniqueStudents.push({
              id: student.id,
              name: student.name,
              roll_no: student.roll_no,
              email: canMessage ? studentUser.email : null,
              phone: student.phone || null,
              class: `${student.classes.class_name} ${student.classes.section}`,
              role: 'class_student',
              canMessage: canMessage,
              userId: canMessage ? studentUser.id : null
            });
            seen.add(student.id);
          }
        }
      }

      // Process subject students
      if (!subjectStudentResult.error && subjectStudentResult.data) {
        for (const teacherSubject of subjectStudentResult.data) {
          if (teacherSubject.subjects?.classes?.students) {
            for (const student of teacherSubject.subjects.classes.students) {
              if (!seen.has(student.id)) {
                const studentUser = studentUserMap.get(student.id);
                const canMessage = !!studentUser;
                
                uniqueStudents.push({
                  id: student.id,
                  name: student.name,
                  roll_no: student.roll_no,
                  email: canMessage ? studentUser.email : null,
                  phone: student.phone || null,
                  class: `${teacherSubject.subjects.classes.class_name} ${teacherSubject.subjects.classes.section}`,
                  subject: teacherSubject.subjects.name,
                  role: 'subject_student',
                  canMessage: canMessage,
                  userId: canMessage ? studentUser.id : null
                });
                seen.add(student.id);
              } else {
                // Add subject info to existing student
                const existingStudent = uniqueStudents.find(s => s.id === student.id);
                if (existingStudent && !existingStudent.subject) {
                  existingStudent.subject = teacherSubject.subjects.name;
                }
              }
            }
          }
        }
      }
      
      setStudents(uniqueStudents);
    } catch (err) {
      console.error('Fetch students error:', err);
      throw err;
    }
  };

  // Fetch chat messages for selected contact (parent or student)
  const fetchMessages = async (contact) => {
    try {
      console.log('🚀 [TeacherChat] fetchMessages - Starting with enhanced tenant validation');
      
      // Don't set loading if this is a refresh call (contact is already selected)
      if (!selectedContact) {
        setLoading(true);
        setSelectedContact(contact);
      }
      setError(null);
      
      // Use cached tenantId if available
      let effectiveTenantId = tenantId;
      if (!effectiveTenantId) {
        const tenantValidation = await validateTenantReadiness();
        if (!tenantValidation.success) {
          if (tenantValidation.reason === 'TENANT_NOT_READY') {
            setMessages([]);
            return;
          }
          throw new Error('Tenant validation failed: ' + tenantValidation.reason);
        }
        effectiveTenantId = tenantValidation.effectiveTenantId;
        setTenantId(effectiveTenantId);
      }
      console.log('✅ [TeacherChat] Using effective tenant ID for messages:', effectiveTenantId);

      // Get the contact's user ID
      const contactUserId = contact.userId || contact.id;
      
      // Get messages with this contact
      try {
        // Try multiple query approaches for better compatibility
        let msgs = null;
        let msgError = null;
        
        // Method 1: Tenant-aware OR query (preferred) with pagination (last 50)
        const query1 = await createTenantQuery(
          effectiveTenantId,
          TABLES.MESSAGES
        ).or(`and(sender_id.eq.${user.id},receiver_id.eq.${contactUserId}),and(sender_id.eq.${contactUserId},receiver_id.eq.${user.id})`)
         .order('sent_at', { ascending: false })
         .range(0, MESSAGE_PAGE_SIZE - 1);
          
        if (!query1.error) {
          msgs = query1.data;
        } else {
          
          // Method 2: Two separate tenant-aware queries and combine
          const [sentMsgs, receivedMsgs] = await Promise.all([
            createTenantQuery(
              effectiveTenantId,
              TABLES.MESSAGES
            ).eq('sender_id', user.id)
             .eq('receiver_id', contactUserId),
            createTenantQuery(
              effectiveTenantId,
              TABLES.MESSAGES
            ).eq('sender_id', contactUserId)
             .eq('receiver_id', user.id)
          ]);
          
          if (!sentMsgs.error && !receivedMsgs.error) {
            msgs = [...(sentMsgs.data || []), ...(receivedMsgs.data || [])]
              .sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at));
          } else {
            msgError = sentMsgs.error || receivedMsgs.error;
          }
        }

        if (msgs) {
          // Process messages
        }

        if (msgError && msgError.code !== '42P01') {
          throw msgError;
        }
        
        // For descending fetch, reverse to display ascending
        const formattedMessages = (msgs || [])
          .slice()
          .reverse()
          .map(msg => ({
            ...msg,
            id: msg.id || msg.created_at || Date.now().toString(),
            message_type: msg.message_type || 'text'
          }));
        
        setMessages(formattedMessages);
        
        // Mark messages from this contact as read
        if (contactUserId !== user.id) {
          const markResult = await markMessagesAsRead(contactUserId);
          if (markResult?.success) {
            console.log('✅ TeacherChat: Messages marked as read, broadcasting to universal service');
            // Broadcast to universal notification service for immediate badge update
            universalNotificationService.broadcastMessageRead(user.id, contactUserId);
          }
          // Update unread counts to remove this contact
          setUnreadCounts(prev => {
            const updated = { ...prev };
            delete updated[contactUserId];
            return updated;
          });
        }
        
        // Scroll to bottom after loading messages
        if (formattedMessages.length > 0) {
          setTimeout(() => {
            try {
              if (flatListRef.current && flatListRef.current.scrollToEnd) {
                flatListRef.current.scrollToEnd({ animated: true });
              }
            } catch (error) {
              // Silently handle scroll error
            }
          }, 300);
        }
        
      } catch (err) {
        setMessages([]);
      }
    } catch (err) {
      setError(err.message);
      setMessages([]);
    } finally {
      if (!selectedContact) {
        setLoading(false);
      }
    }
  };

  // Real-time subscription for messages using optimistic UI
  const messageHandler = getGlobalMessageHandler(supabase, TABLES.MESSAGES);
  
  // Send typing signal with debounce
  const handleTypingSignal = () => {
    if (!selectedContact) return;
    const now = Date.now();
    const contactUserId = selectedContact.userId || selectedContact.id;

    // Throttle typing events to at most once per 800ms
    if (now - (lastTypingSentRef.current || 0) >= 800) {
      lastTypingSentRef.current = now;
      try {
        typingChannelRef.current?.send({
          type: 'broadcast',
          event: 'typing',
          payload: { sender_id: user.id, receiver_id: contactUserId }
        });
      } catch (e) {
        // ignore
      }
    }

    // Always (re)start stop_typing timer after user input inactivity
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    typingDebounceRef.current = setTimeout(() => {
      try {
        typingChannelRef.current?.send({
          type: 'broadcast',
          event: 'stop_typing',
          payload: { sender_id: user.id, receiver_id: contactUserId }
        });
      } catch (e) {
        // ignore
      }
    }, 1200);
  };
  
  useEffect(() => {
    if (!selectedContact) return;
    
    const contactUserId = selectedContact.userId || selectedContact.id;
    
    // Setup real-time subscription with message updates
    const subscription = messageHandler.startSubscription(
      user.id,
      contactUserId,
      (message, eventType) => {
        console.log('📨 Real-time message update:', { message, eventType });
        
        if (eventType === 'sent' || eventType === 'received' || eventType === 'updated') {
          // Update messages state
          setMessages(prev => {
            // Remove any existing message with the same ID
            const filtered = prev.filter(m => m.id !== message.id);
            // Add the new/updated message and sort by timestamp
            const updated = [...filtered, message].sort((a, b) => 
              new Date(a.sent_at || a.created_at) - new Date(b.sent_at || b.created_at)
            );
            return updated;
          });
          
          // Mark messages as read if they're from the contact
          if (message.sender_id === contactUserId && !message.is_read) {
            markMessagesAsRead(contactUserId);
            setUnreadCounts(prev => {
              const updated = { ...prev };
              delete updated[contactUserId];
              return updated;
            });
          }
          
          // Auto-scroll to bottom on new messages
          setTimeout(() => {
            try {
              if (flatListRef.current?.scrollToEnd) {
                flatListRef.current.scrollToEnd({ animated: true });
              }
            } catch (error) {
              // Silently handle scroll error
            }
          }, 100);
        } else if (eventType === 'deleted') {
          // Remove deleted message
          setMessages(prev => prev.filter(m => m.id !== message.id));
        }
      }
    );
    
    return () => {
      messageHandler.stopSubscription();
    };
  }, [selectedContact, user.id, messageHandler, markMessagesAsRead]);

  // Typing indicator broadcast channel
  useEffect(() => {
    if (!selectedContact) return;

    const myId = String(user.id);
    const contactId = String(selectedContact.userId || selectedContact.id);
    const sorted = [myId, contactId].sort();
    // Follow docs naming convention: scope:id:entity
    const channelName = `chat:typing:${sorted[0]}:${sorted[1]}`;

    // Cleanup any existing channel
    if (typingChannelRef.current) {
      try { typingChannelRef.current.unsubscribe(); } catch (e) {}
      try { supabase.removeChannel?.(typingChannelRef.current); } catch (e) {}
      typingChannelRef.current = null;
    }

    // For production, consider config: { config: { private: true } } and set Realtime auth policies
    const channel = supabase.channel(channelName, { config: { private: true } });
    typingChannelRef.current = channel;

    channel
      .on('broadcast', { event: 'typing' }, (payload) => {
        const sender = payload?.payload?.sender_id;
        if (sender && sender !== user.id) {
          setIsContactTyping(true);
          if (typingIndicatorTimeoutRef.current) clearTimeout(typingIndicatorTimeoutRef.current);
          typingIndicatorTimeoutRef.current = setTimeout(() => setIsContactTyping(false), 2000);
        }
      })
      .on('broadcast', { event: 'stop_typing' }, (payload) => {
        const sender = payload?.payload?.sender_id;
        if (sender && sender !== user.id) {
          setIsContactTyping(false);
        }
      })
      .subscribe((status) => {
        // optional: log status
      });

    return () => {
      try { channel.unsubscribe(); } catch (e) {}
      try { supabase.removeChannel?.(channel); } catch (e) {}
      typingChannelRef.current = null;
      setIsContactTyping(false);
      if (typingIndicatorTimeoutRef.current) clearTimeout(typingIndicatorTimeoutRef.current);
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    };
  }, [selectedContact, user.id]);

  // Send a message with optimistic UI
  const handleSend = async () => {
    if (!input.trim() || !selectedContact || sending) return;
    
    const contactUserId = selectedContact.userId || selectedContact.id;
    const messageText = input.trim();
    const studentId = selectedContact.students ? selectedContact.students[0]?.id : selectedContact.id;
    
    // Clear input immediately for better UX
    setInput('');
    setSending(true);
    
    try {
      // Ensure tenant context is ready and include tenant_id in message for RLS compliance
      const tenantValidation = await validateTenantReadiness();
      if (!tenantValidation.success) {
        throw new Error('Tenant context not ready. Please try again.');
      }
      const { effectiveTenantId } = tenantValidation;

      // Prepare message data for the handler (include tenant_id)
      const messageData = {
        sender_id: user.id,
        receiver_id: contactUserId,
        student_id: studentId,
        message: messageText,
        message_type: 'text',
        tenant_id: effectiveTenantId
      };
      
      // Use the message handler for optimistic UI and reliable sending
      await messageHandler.sendMessageOptimistic(
        messageData,
        // Optimistic update callback
        (optimisticMessage) => {
          console.log('⚡ Adding optimistic message to UI:', optimisticMessage);
          setMessages(prev => {
            const updated = [...prev, optimisticMessage].sort((a, b) => 
              new Date(a.sent_at || a.created_at) - new Date(b.sent_at || b.created_at)
            );
            return updated;
          });
          
          // Auto-scroll to bottom
          setTimeout(() => {
            try {
              if (flatListRef.current?.scrollToEnd) {
                flatListRef.current.scrollToEnd({ animated: true });
              }
            } catch (error) {
              // Silently handle scroll error
            }
          }, 100);
        },
        // Confirmed callback
        (tempId, confirmedMessage) => {
          console.log('✅ Message confirmed, replacing optimistic:', { tempId, confirmedMessage });
          setMessages(prev => prev.map(msg => 
            msg.id === tempId ? confirmedMessage : msg
          ));
        },
        // Error callback
        (tempId, failedMessage, error) => {
          console.error('❌ Message failed:', { tempId, error });
          // Update message to show failed state
          setMessages(prev => prev.map(msg => 
            msg.id === tempId ? { ...failedMessage, failed: true } : msg
          ));
          
          // Restore input text for retry
          setInput(messageText);
          Alert.alert('Message Failed', `Failed to send message: ${error.message || 'Unknown error'}. The message is marked as failed - you can try sending again.`);
        }
      );
      
    } catch (error) {
      console.error('Failed to send message:', error);
      // Restore input text on failure
      setInput(messageText);
      Alert.alert('Error', `Failed to send message: ${error.message || 'Unknown error'}`);
    } finally {
      setSending(false);
    }
  };

  // Delete message function
  const handleDeleteMessage = (messageId) => {
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🚀 [TeacherChat] handleDeleteMessage - Starting with enhanced tenant validation');
              setDeletingMessageId(messageId);
              
              // Validate tenant readiness
              const tenantValidation = await validateTenantReadiness();
              if (!tenantValidation.success) {
                console.log('⚠️ [TeacherChat] Tenant not ready for message deletion:', tenantValidation.reason);
                Alert.alert('Error', 'System not ready. Please try again.');
                return;
              }
              
              const { effectiveTenantId } = tenantValidation;
              console.log('✅ [TeacherChat] Using effective tenant ID for message deletion:', effectiveTenantId);
              
              const { error: deleteError } = await supabase
                .from(TABLES.MESSAGES)
                .delete()
                .eq('id', messageId)
                .eq('sender_id', user.id) // Only allow deleting own messages
                .eq('tenant_id', effectiveTenantId); // Add tenant filtering
              
              if (deleteError) {
                Alert.alert('Error', 'Failed to delete message');
                return;
              }
              
              // Remove from local state
              setMessages(prev => prev.filter(msg => msg.id !== messageId));
            } catch (err) {
              Alert.alert('Error', 'Failed to delete message');
            } finally {
              setDeletingMessageId(null);
            }
          }
        }
      ]
    );
  };

  // Show attachment menu
  const handleAttach = () => {
    setShowAttachmentMenu(true);
  };

  // Handle photo upload with chat-files storage
  const handlePhotoUpload = async () => {
    setShowAttachmentMenu(false);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Permission to access media library is required!');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        aspect: [4, 3],
        quality: 0.8,
        allowsMultipleSelection: false,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        
        // Check file size (100MB limit)
        if (asset.fileSize && asset.fileSize > 104857600) {
          Alert.alert('File Too Large', 'Please select an image smaller than 100MB.');
          return;
        }

        // Show uploading indicator
        const tempMsg = {
          id: 'temp_' + Date.now(),
          sender_id: user.id,
          receiver_id: selectedContact.userId || selectedContact.id,
          message: '📷 Uploading photo...',
          message_type: 'image',
          timestamp: formatToLocalTime(new Date().toISOString()),
          sender: 'teacher',
          uploading: true
        };
        
        setMessages(prev => [...prev, tempMsg]);
        
        // Get student ID for context
        const studentId = selectedContact.students ? selectedContact.students[0]?.id : selectedContact.id;
        
        // Upload to chat-files bucket
        const uploadResult = await uploadChatFile(
          {
            uri: asset.uri,
            name: asset.fileName || `photo_${Date.now()}.jpg`,
            size: asset.fileSize,
            type: 'image/jpeg'
          },
          user.id,
          selectedContact.userId || selectedContact.id,
          studentId
        );
        
        if (uploadResult.success) {
          // Save to database with tenant awareness
          console.log('🚀 [TeacherChat] Saving photo message to database with enhanced tenant validation');
          
          // Validate tenant readiness
          const tenantValidation = await validateTenantReadiness();
          if (!tenantValidation.success) {
            throw new Error('Tenant validation failed for photo message: ' + tenantValidation.reason);
          }
          
          const { effectiveTenantId } = tenantValidation;
          
          // Add tenant ID to message data
          const messageDataWithTenant = {
            ...uploadResult.messageData,
            tenant_id: effectiveTenantId
          };
          
          const { data: insertedMsg, error: sendError } = await supabase
            .from('messages')
            .insert(messageDataWithTenant)
            .select();
            
          if (!sendError && insertedMsg?.[0]) {
            // Replace temp message with actual message
            setMessages(prev => prev.map(msg => 
              msg.id === tempMsg.id
                ? {
                    ...insertedMsg[0],
                    timestamp: formatToLocalTime(insertedMsg[0].sent_at),
                    sender: 'teacher'
                  }
                : msg
            ));
            
            // Scroll to bottom
            setTimeout(() => {
              if (flatListRef.current) {
                flatListRef.current.scrollToEnd({ animated: true });
              }
            }, 100);
          } else {
            throw new Error('Failed to save message to database');
          }
        } else {
          throw new Error(uploadResult.error);
        }
      }
    } catch (e) {
      console.error('Image upload error:', e);
      // Remove temp message on error
      setMessages(prev => prev.filter(msg => !msg.uploading));
      Alert.alert('Upload Failed', 'Failed to upload image: ' + e.message);
    }
  };

  // Handle document upload with chat-files storage
  const handleDocumentUpload = async () => {
    setShowAttachmentMenu(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        
        // Check file size (100MB limit)
        if (file.size && file.size > 104857600) {
          Alert.alert('File Too Large', 'Please select a file smaller than 100MB.');
          return;
        }

        // Check if file type is supported
        if (!isSupportedFileType(file.mimeType)) {
          Alert.alert('Unsupported File Type', 'This file type is not supported for chat attachments.');
          return;
        }

        // Show uploading indicator
        const tempMsg = {
          id: 'temp_' + Date.now(),
          sender_id: user.id,
          receiver_id: selectedContact.userId || selectedContact.id,
          message: `📎 Uploading ${file.name}...`,
          message_type: 'file',
          timestamp: formatToLocalTime(new Date().toISOString()),
          sender: 'teacher',
          uploading: true
        };
        
        setMessages(prev => [...prev, tempMsg]);
        
        // Get student ID for context
        const studentId = selectedContact.students ? selectedContact.students[0]?.id : selectedContact.id;
        
        // Upload to chat-files bucket
        const uploadResult = await uploadChatFile(
          {
            uri: file.uri,
            name: file.name,
            size: file.size,
            type: file.mimeType,
            mimeType: file.mimeType
          },
          user.id,
          selectedContact.userId || selectedContact.id,
          studentId
        );
        
        if (uploadResult.success) {
          // Save to database with tenant awareness
          console.log('🚀 [TeacherChat] Saving document message to database with enhanced tenant validation');
          
          // Validate tenant readiness
          const tenantValidation = await validateTenantReadiness();
          if (!tenantValidation.success) {
            throw new Error('Tenant validation failed for document message: ' + tenantValidation.reason);
          }
          
          const { effectiveTenantId } = tenantValidation;
          
          // Add tenant ID to message data
          const messageDataWithTenant = {
            ...uploadResult.messageData,
            tenant_id: effectiveTenantId
          };
          
          const { data: insertedMsg, error: sendError } = await supabase
            .from('messages')
            .insert(messageDataWithTenant)
            .select();
            
          if (!sendError && insertedMsg?.[0]) {
            // Replace temp message with actual message
            setMessages(prev => prev.map(msg => 
              msg.id === tempMsg.id
                ? {
                    ...insertedMsg[0],
                    timestamp: formatToLocalTime(insertedMsg[0].sent_at),
                    sender: 'teacher'
                  }
                : msg
            ));
            
            // Scroll to bottom
            setTimeout(() => {
              if (flatListRef.current) {
                flatListRef.current.scrollToEnd({ animated: true });
              }
            }, 100);
          } else {
            throw new Error('Failed to save message to database');
          }
        } else {
          throw new Error(uploadResult.error);
        }
      }
    } catch (e) {
      console.error('Document upload error:', e);
      // Remove temp message on error
      setMessages(prev => prev.filter(msg => !msg.uploading));
      Alert.alert('Upload Failed', 'Failed to upload document: ' + e.message);
    }
  };

  // Go back to contact list
  const handleBack = () => {
    setSelectedContact(null);
    setMessages([]);
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      setTimeout(() => {
        try {
          if (flatListRef.current && flatListRef.current.scrollToEnd) {
            flatListRef.current.scrollToEnd({ animated: true });
          }
        } catch (error) {
          // Silently handle scroll error
        }
      }, 100);
    }
  }, [messages]);

  // Sort contacts by most recent chat
  const getSortedContacts = (contactList) => {
    return [...contactList].sort((a, b) => {
      const aUserId = a.userId || a.id;
      const bUserId = b.userId || b.id;
      const aMsgs = messages.filter(m => m.sender_id === aUserId || m.receiver_id === aUserId);
      const bMsgs = messages.filter(m => m.sender_id === bUserId || m.receiver_id === bUserId);
      const aTime = aMsgs.length ? new Date(aMsgs[aMsgs.length - 1].sent_at) : new Date(0);
      const bTime = bMsgs.length ? new Date(bMsgs[bMsgs.length - 1].sent_at) : new Date(0);
      return bTime - aTime;
    });
  };

  // Handle pull-to-refresh for contact lists
  const onRefreshParents = async () => {
    setRefreshingParents(true);
    try {
      await Promise.all([
        fetchParents(),
        fetchUnreadCounts()
      ]);
    } catch (error) {
      // Silently handle error
    } finally {
      setRefreshingParents(false);
    }
  };

  const onRefreshStudents = async () => {
    setRefreshingStudents(true);
    try {
      await Promise.all([
        fetchStudents(),
        fetchUnreadCounts()
      ]);
    } catch (error) {
      // Silently handle error
    } finally {
      setRefreshingStudents(false);
    }
  };

  
  return (
    <View style={styles.container}>
      <Header title="Teacher Chat" showBack={true} />
      {loading || tenantLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={{ marginTop: 16, fontSize: 16, color: '#666', textAlign: 'center' }}>
            {tenantLoading ? 'Loading tenant context...' : 'Loading your students and parents...'}
          </Text>
          {DEBUG_MODE && tenantLoading && (
            <Text style={styles.debugText}>
              Resolving teacher context and permissions...
            </Text>
          )}
          {DEBUG_MODE && !tenantLoading && loading && (
            <Text style={styles.debugText}>
              Fetching contacts and unread counts...
            </Text>
          )}
        </View>
      ) : error ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#d32f2f', fontSize: 16, marginBottom: 12, textAlign: 'center' }}>Error: {error}</Text>
          <TouchableOpacity onPress={fetchData} style={{ backgroundColor: '#1976d2', padding: 12, borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : !selectedContact ? (
        <View style={styles.contactListContainer}>
          {/* Tab Navigation */}
          <View style={styles.tabContainer}>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'parents' && styles.activeTab]}
              onPress={() => setActiveTab('parents')}
            >
              <Ionicons 
                name={activeTab === 'parents' ? 'people' : 'people-outline'} 
                size={20} 
                color={activeTab === 'parents' ? '#1976d2' : '#666'} 
              />
              <Text style={[styles.tabText, activeTab === 'parents' && styles.activeTabText]}>Parents</Text>
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{parents.length}</Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'students' && styles.activeTab]}
              onPress={() => setActiveTab('students')}
            >
              <Ionicons 
                name={activeTab === 'students' ? 'school' : 'school-outline'} 
                size={20} 
                color={activeTab === 'students' ? '#1976d2' : '#666'} 
              />
              <Text style={[styles.tabText, activeTab === 'students' && styles.activeTabText]}>Students</Text>
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{students.length}</Text>
              </View>
            </TouchableOpacity>
          </View>
          
          {/* Content Area */}
          {activeTab === 'parents' ? (
            <View style={styles.contentContainer}>
              <View style={styles.headerSection}>
                <Text style={styles.sectionTitle}>Student Parents</Text>
                <Text style={styles.sectionSubtitle}>
                  {parents.length} parent{parents.length !== 1 ? 's' : ''} of your students
                </Text>
              </View>
              
              {parents.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="people-outline" size={64} color="#ccc" />
                  <Text style={styles.emptyText}>No parents found for your students.</Text>
                  <Text style={styles.emptySubtext}>
                    Please contact the school administrator to verify your class assignments.
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={getSortedContacts(parents)}
                  keyExtractor={item => item.id}
                  refreshControl={
                    <RefreshControl
                      refreshing={refreshingParents}
                      onRefresh={onRefreshParents}
                      colors={['#1976d2']}
                      tintColor="#1976d2"
                    />
                  }
                  renderItem={({ item, index }) => {
                    const sortedParents = getSortedContacts(parents);
                    const showClassParentHeader = index === 0 && item.role === 'class_parent';
                    const showSubjectParentHeader = index > 0 &&
                      item.role === 'subject_parent' &&
                      sortedParents[index - 1].role !== 'subject_parent';

                    return (
                      <View>
                        {showClassParentHeader && (
                          <View style={styles.sectionHeader}>
                            <Text style={styles.sectionHeaderText}>Class Parents</Text>
                          </View>
                        )}
                        {showSubjectParentHeader && (
                          <View style={styles.sectionHeader}>
                            <Text style={styles.sectionHeaderText}>Subject Parents</Text>
                          </View>
                        )}
                        <TouchableOpacity 
                          style={[
                            styles.contactCard,
                            item.role === 'class_parent' && styles.classParentCard,
                            unreadCounts[item.id] && styles.unreadContactCard
                          ]} 
                          onPress={() => fetchMessages(item)}
                        >
                          <View style={[
                            styles.contactAvatar,
                            { backgroundColor: item.role === 'class_parent' ? '#4CAF50' : '#2196F3' }
                          ]}>
                            <Ionicons
                              name={item.role === 'class_parent' ? 'school' : 'book'}
                              size={24}
                              color="#fff"
                            />
                          </View>
                          <View style={styles.contactInfo}>
                            <View style={styles.contactHeader}>
                              <Text style={styles.contactName}>{item.name}</Text>
                              <View style={[
                                styles.roleBadge,
                                { backgroundColor: item.role === 'class_parent' ? '#4CAF50' : '#2196F3' }
                              ]}>
                                <Text style={styles.roleBadgeText}>
                                  {item.role === 'class_parent' ? 'CLASS' : 'SUBJECT'}
                                </Text>
                              </View>
                            </View>
                            <Text style={styles.contactSubInfo} numberOfLines={2}>
                              Children: {item.students.map(s => `${s.name} (${s.class})`).join(', ')}
                            </Text>
                          </View>
                          <View style={styles.chatActions}>
                            <View style={styles.chatIconContainer}>
                              <Ionicons name="chatbubbles" size={20} color={unreadCounts[item.id] ? "#f44336" : "#9c27b0"} />
                              {(() => {
                                // Debug logging for parent badges
                                console.log('🔍 Parent Badge Debug:', {
                                  parentName: item.name,
                                  parentId: item.id,
                                  unreadCount: unreadCounts[item.id],
                                  allUnreadCounts: unreadCounts,
                                  shouldShowBadge: !!unreadCounts[item.id]
                                });
                                return unreadCounts[item.id] ? (
                                  <View style={styles.unreadBadge}>
                                    <Text style={styles.unreadBadgeText}>
                                      {unreadCounts[item.id] > 99 ? '99+' : unreadCounts[item.id]}
                                    </Text>
                                  </View>
                                ) : null;
                              })()}
                            </View>
                            <Ionicons name="chevron-forward" size={16} color="#ccc" style={{ marginTop: 2 }} />
                          </View>
                        </TouchableOpacity>
                      </View>
                    );
                  }}
                  contentContainerStyle={{ padding: 16 }}
                  showsVerticalScrollIndicator={false}
                />
              )}
            </View>
          ) : (
            <View style={styles.contentContainer}>
              <View style={styles.headerSection}>
                <Text style={styles.sectionTitle}>Your Students</Text>
                <Text style={styles.sectionSubtitle}>
                  {students.length} student{students.length !== 1 ? 's' : ''} in your classes
                </Text>
              </View>
              
              {students.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="school-outline" size={64} color="#ccc" />
                  <Text style={styles.emptyText}>No students found in your classes.</Text>
                  <Text style={styles.emptySubtext}>
                    Please contact the school administrator to verify your teaching assignments.
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={getSortedContacts(students)}
                  keyExtractor={item => item.id}
                  refreshControl={
                    <RefreshControl
                      refreshing={refreshingStudents}
                      onRefresh={onRefreshStudents}
                      colors={['#1976d2']}
                      tintColor="#1976d2"
                    />
                  }
                  renderItem={({ item, index }) => {
                    const sortedStudents = getSortedContacts(students);
                    const showClassStudentHeader = index === 0 && item.role === 'class_student';
                    const showSubjectStudentHeader = index > 0 &&
                      item.role === 'subject_student' &&
                      sortedStudents[index - 1].role !== 'subject_student';

                    return (
                      <View>
                        {showClassStudentHeader && (
                          <View style={styles.sectionHeader}>
                            <Text style={styles.sectionHeaderText}>Class Students</Text>
                          </View>
                        )}
                        {showSubjectStudentHeader && (
                          <View style={styles.sectionHeader}>
                            <Text style={styles.sectionHeaderText}>Subject Students</Text>
                          </View>
                        )}
                        <TouchableOpacity 
                          style={[
                            styles.contactCard,
                            item.role === 'class_student' && styles.classStudentCard,
                            !item.canMessage && styles.disabledCard,
                            unreadCounts[item.userId] && item.canMessage && styles.unreadContactCard
                          ]} 
                          onPress={() => item.canMessage ? fetchMessages(item) : Alert.alert('Cannot Message', 'This student does not have a user account for messaging.')}
                        >
                          <View style={[
                            styles.contactAvatar,
                            { backgroundColor: item.role === 'class_student' ? '#FF9800' : '#9C27B0' }
                          ]}>
                            <Ionicons
                              name={item.role === 'class_student' ? 'school' : 'book'}
                              size={24}
                              color="#fff"
                            />
                          </View>
                          <View style={styles.contactInfo}>
                            <View style={styles.contactHeader}>
                              <Text style={[styles.contactName, !item.canMessage && styles.disabledText]}>{item.name}</Text>
                              <View style={styles.badgeContainer}>
                                <View style={[
                                  styles.roleBadge,
                                  { backgroundColor: item.role === 'class_student' ? '#FF9800' : '#9C27B0' }
                                ]}>
                                  <Text style={styles.roleBadgeText}>
                                    {item.role === 'class_student' ? 'CLASS' : 'SUBJECT'}
                                  </Text>
                                </View>
                                {!item.canMessage && (
                                  <View style={[styles.roleBadge, { backgroundColor: '#f44336', marginLeft: 4 }]}>
                                    <Text style={styles.roleBadgeText}>NO ACC</Text>
                                  </View>
                                )}
                              </View>
                            </View>
                            <Text style={[styles.contactSubInfo, !item.canMessage && styles.disabledText]} numberOfLines={2}>
                              Roll: {item.roll_no} • Class: {item.class}
                              {item.subject && ` • Subject: ${item.subject}`}
                            </Text>
                            {item.email && (
                              <Text style={[styles.contactEmail, !item.canMessage && styles.disabledText]} numberOfLines={1}>
                                {item.email}
                              </Text>
                            )}
                          </View>
                          <View style={styles.chatActions}>
                            {item.canMessage ? (
                              <>
                                <View style={styles.chatIconContainer}>
                                  <Ionicons name="chatbubbles" size={20} color={unreadCounts[item.userId] ? "#f44336" : "#9c27b0"} />
                                  {(() => {
                                    // Debug logging for student badges
                                    console.log('🔍 Student Badge Debug:', {
                                      studentName: item.name,
                                      studentId: item.id,
                                      userId: item.userId,
                                      canMessage: item.canMessage,
                                      unreadCount: unreadCounts[item.userId],
                                      allUnreadCounts: unreadCounts,
                                      shouldShowBadge: !!unreadCounts[item.userId]
                                    });
                                    return unreadCounts[item.userId] ? (
                                      <View style={styles.unreadBadge}>
                                        <Text style={styles.unreadBadgeText}>
                                          {unreadCounts[item.userId] > 99 ? '99+' : unreadCounts[item.userId]}
                                        </Text>
                                      </View>
                                    ) : null;
                                  })()}
                                </View>
                                <Ionicons name="chevron-forward" size={16} color="#ccc" style={{ marginTop: 2 }} />
                              </>
                            ) : (
                              <Ionicons name="alert-circle" size={20} color="#f44336" />
                            )}
                          </View>
                        </TouchableOpacity>
                      </View>
                    );
                  }}
                  contentContainerStyle={{ padding: 16 }}
                  showsVerticalScrollIndicator={false}
                />
              )}
            </View>
          )}
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 20}
          enabled={true}
        >
          <View style={styles.chatHeader}>
            <TouchableOpacity onPress={handleBack} style={{ marginRight: 10 }}>
              <Ionicons name="arrow-back" size={24} color="#1976d2" />
            </TouchableOpacity>
            <Ionicons 
              name={selectedContact.students ? 'person-circle' : 'school'} 
              size={32} 
              color="#1976d2" 
              style={{ marginRight: 8 }} 
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.contactName}>{selectedContact.name}</Text>
              <Text style={styles.contactSubInfo}>
                {selectedContact.students ? 
                  `Children: ${selectedContact.students.map(s => s.name).join(', ')}` :
                  `Roll: ${selectedContact.roll_no} • ${selectedContact.class}`
                }
              </Text>
              {isContactTyping && (
                <Text style={[styles.contactSubInfo, { color: '#1976d2', marginTop: 2 }]}>Typing…</Text>
              )}
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <FlatList
              ref={flatListRef}
              data={[...messages]}
              keyExtractor={item => item.id?.toString() || Math.random().toString()}
              maintainVisibleContentPosition={{
                minIndexForVisible: 0,
                autoscrollToTopThreshold: 10,
              }}
              onContentSizeChange={() => {
                if (flatListRef.current && messages.length > 0) {
                  setTimeout(() => {
                    try {
                      flatListRef.current?.scrollToEnd({ animated: false });
                    } catch (error) {
                      // Silently handle scroll error
                    }
                  }, 100);
                }
              }}
              onLayout={() => {
                if (flatListRef.current && messages.length > 0) {
                  setTimeout(() => {
                    try {
                      flatListRef.current?.scrollToEnd({ animated: false });
                    } catch (error) {
                      // Silently handle scroll error  
                    }
                  }, 200);
                }
              }}
              renderItem={({ item }) => {
                // Debug logging
                console.log('🔍 Rendering message:', {
                  id: item.id,
                  message_type: item.message_type,
                  type: item.type,
                  message: item.message,
                  file_url: item.file_url,
                  file_name: item.file_name,
                  hasFileUrl: !!item.file_url,
                  keys: Object.keys(item),
                  isImageType: (item.message_type === 'image' || item.type === 'image'),
                  isFileType: (item.message_type === 'file' || item.type === 'file'),
                  shouldShowText: (!item.message_type || item.message_type === 'text' || (!item.type || item.type === 'text'))
                });
                
                // Special handling for image messages
                const isImageMessage = (item.message_type === 'image' || item.type === 'image') && item.file_url;
                const isFileMessage = (item.message_type === 'file' || item.type === 'file') && item.file_url;
                const isTextMessage = !isImageMessage && !isFileMessage;
                
                console.log('🎯 Message rendering decision:', {
                  id: item.id,
                  isImageMessage,
                  isFileMessage,
                  isTextMessage,
                  hasFileUrl: !!item.file_url
                });
                
                return (
                <TouchableOpacity 
                  style={[styles.messageRow, item.sender_id === user.id ? styles.messageRight : styles.messageLeft]}
                  onLongPress={() => {
                    if (item.sender_id === user.id) {
                      handleDeleteMessage(item.id);
                    }
                  }}
                  disabled={deletingMessageId === item.id}
                >
                  <View style={[
                    styles.messageBubble, 
                    item.sender_id === user.id ? styles.bubbleTeacher : styles.bubbleParent,
                    deletingMessageId === item.id && styles.deletingMessage
                  ]}>
                    {isImageMessage && (
                      <TouchableOpacity 
                        onPress={() => {
                          console.log('🖼️ Image pressed, showing ImageViewer with:', {
                            file_url: item.file_url || item.uri,
                            file_name: item.file_name || 'image.jpg',
                            file_type: item.file_type || 'image/jpeg',
                            file_size: item.file_size
                          });
                          setCurrentImage({
                            file_url: item.file_url || item.uri,
                            file_name: item.file_name || 'image.jpg',
                            file_type: item.file_type || 'image/jpeg',
                            file_size: item.file_size
                          });
                          setImageViewerVisible(true);
                        }}
                        activeOpacity={0.8}
                      >
                        <Image 
                          source={{ uri: item.file_url || item.uri }} 
                          style={styles.chatImage} 
                          resizeMode="cover"
                          onError={(error) => console.log('🚨 Image load error:', error)}
                          onLoad={() => console.log('✅ Image loaded successfully:', item.file_url)}
                        />
                        <View style={styles.imageOverlay}>
                          <Ionicons name="eye" size={16} color="#fff" />
                        </View>
                      </TouchableOpacity>
                    )}
                    {isFileMessage && (
                      <TouchableOpacity 
                        style={styles.fileRow}
                        onPress={() => {
                          console.log('📄 File pressed, calling handleFileView with:', {
                            file_url: item.file_url,
                            file_name: item.file_name,
                            file_type: item.file_type,
                            file_size: item.file_size
                          });
                          handleFileView({
                            file_url: item.file_url,
                            file_name: item.file_name,
                            file_type: item.file_type,
                            file_size: item.file_size
                          });
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.fileIconContainer, { backgroundColor: getFileTypeColor(item.file_type) }]}>
                          <Ionicons name={getFileIcon(item.file_type)} size={18} color="#fff" />
                        </View>
                        <View style={styles.fileInfo}>
                          <Text style={styles.fileName} numberOfLines={2}>{item.file_name}</Text>
                          <Text style={styles.fileSize}>{formatFileSizeDisplay(item.file_size)}</Text>
                        </View>
                        <Ionicons name="download" size={16} color="#666" style={{ marginLeft: 8 }} />
                      </TouchableOpacity>
                    )}
                    {isTextMessage && (
                      <Text style={styles.messageText}>{item.message || item.text}</Text>
                    )}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 }}>
                      <Text style={styles.messageTime}>{formatToLocalTime(item.sent_at)}</Text>
                      {item.sender_id === user.id && (
                        <View style={{ marginLeft: 6 }}>
                          {item.failed ? (
                            <Ionicons name="alert-circle" size={14} color="#d32f2f" />
                          ) : item.pending || item.uploading ? (
                            <Ionicons name="time-outline" size={14} color="#999" />
                          ) : item.is_read ? (
                            <Ionicons name="checkmark-done" size={14} color="#1976d2" />
                          ) : (
                            <Ionicons name="checkmark" size={14} color="#999" />
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
                );
              }}
              contentContainerStyle={styles.chatList}
              style={{ flex: 1 }}
              keyboardShouldPersistTaps="handled"
            />
          </View>
          <View style={[styles.inputRow, { 
            backgroundColor: '#fff', 
            paddingBottom: Platform.OS === 'ios' ? (isKeyboardVisible ? 20 : 10) : 10,
            paddingTop: 10
          }]}>
            <TouchableOpacity style={styles.attachBtn} onPress={handleAttach} disabled={sending}>
              <Ionicons name="attach" size={22} color="#1976d2" />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder="Type a message..."
              value={input}
              onChangeText={(text) => { setInput(text); handleTypingSignal(); }}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              editable={!sending}
              multiline={false}
              blurOnSubmit={true}
            />
            <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={sending}>
              <Ionicons name="send" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
      
      {/* Attachment Menu Modal */}
      {showAttachmentMenu && (
        <TouchableOpacity 
          style={styles.attachmentModalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowAttachmentMenu(false)}
        >
          <Animatable.View animation="slideInUp" duration={300} style={styles.attachmentModal}>
            <View style={styles.attachmentHeader}>
              <Text style={styles.attachmentTitle}>Send Attachment</Text>
              <TouchableOpacity onPress={() => setShowAttachmentMenu(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.attachmentOptions}
              style={styles.attachmentScrollView}
            >
              <TouchableOpacity style={styles.attachmentOption} onPress={handlePhotoUpload}>
                <View style={[styles.attachmentIcon, { backgroundColor: '#4CAF50' }]}>
                  <Ionicons name="camera" size={24} color="#fff" />
                </View>
                <Text style={styles.attachmentText}>Photo</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.attachmentOption} onPress={handleDocumentUpload}>
                <View style={[styles.attachmentIcon, { backgroundColor: '#2196F3' }]}>
                  <Ionicons name="document" size={24} color="#fff" />
                </View>
                <Text style={styles.attachmentText}>Document</Text>
              </TouchableOpacity>
            </ScrollView>
          </Animatable.View>
        </TouchableOpacity>
      )}
      
      {/* ImageViewer Modal */}
      <ImageViewer
        visible={imageViewerVisible}
        imageData={currentImage}
        onClose={() => {
          setImageViewerVisible(false);
          setCurrentImage(null);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  // Debug styles
  debugText: {
    fontSize: 12,
    color: '#1976d2',
    marginTop: 6,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  contactListContainer: { flex: 1 },
  
  // Tab Navigation Styles
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#1976d2',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginLeft: 8,
  },
  activeTabText: {
    color: '#1976d2',
  },
  tabBadge: {
    backgroundColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
    minWidth: 20,
    alignItems: 'center',
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#666',
  },
  
  contentContainer: { flex: 1 },
  
  // Header Section Styles
  headerSection: {
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1976d2', marginBottom: 4 },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  
  // Section Header Styles
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginTop: 8,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  // Enhanced Contact Card Styles
  contactCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#fff', 
    borderRadius: 10, 
    padding: 16, 
    marginBottom: 8, 
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  classParentCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    backgroundColor: '#f8fff8',
  },
  classStudentCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
    backgroundColor: '#fff8f0',
  },
  disabledCard: {
    opacity: 0.6,
    backgroundColor: '#f5f5f5',
  },
  
  contactAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1976d2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  
  contactInfo: {
    flex: 1,
    paddingRight: 8,
  },
  
  contactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    minWidth: 50,
    alignItems: 'center',
  },
  
  roleBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  
  contactName: { fontSize: 16, fontWeight: 'bold', color: '#222' },
  contactSubInfo: { fontSize: 14, color: '#666', marginTop: 2 },
  contactEmail: { fontSize: 12, color: '#888', marginTop: 1 },
  disabledText: { color: '#999' },
  
  chatActions: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Empty State Styles
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  
  // Chat Styles
  chatHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderBottomWidth: 1, borderColor: '#eee' },
  chatList: { flexGrow: 1, padding: 16 },
  messageRow: { flexDirection: 'row', marginBottom: 10 },
  messageLeft: { justifyContent: 'flex-start' },
  messageRight: { justifyContent: 'flex-end' },
  messageBubble: { maxWidth: '75%', padding: 12, borderRadius: 16 },
  bubbleTeacher: { backgroundColor: '#e3f2fd', alignSelf: 'flex-end' },
  bubbleParent: { backgroundColor: '#f1f8e9', alignSelf: 'flex-start' },
  messageText: { fontSize: 15, color: '#222' },
  messageTime: { fontSize: 11, color: '#888', marginTop: 4, textAlign: 'right' },
  inputRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 10, 
    backgroundColor: '#fff', 
    borderTopWidth: 1, 
    borderColor: '#eee',
    minHeight: 60,
    paddingHorizontal: 12
  },
  input: { 
    flex: 1, 
    backgroundColor: '#f5f5f5', 
    borderRadius: 20, 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    fontSize: 15, 
    marginRight: 8,
    minHeight: 40,
    maxHeight: 100,
    textAlignVertical: 'center'
  },
  sendBtn: { 
    backgroundColor: '#1976d2', 
    borderRadius: 20, 
    padding: 12,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center'
  },
  deletingMessage: {
    opacity: 0.5,
  },
  
  // Unread message styles
  unreadContactCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
    backgroundColor: '#fff8f8',
    shadowColor: '#f44336',
    shadowOpacity: 0.15,
    elevation: 3,
  },
  
  // File and image display styles
  chatImage: {
    width: 160,
    height: 120,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: '#eee',
  },
  
  imageOverlay: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    padding: 4,
  },
  
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    backgroundColor: 'rgba(25, 118, 210, 0.05)',
    borderRadius: 8,
    padding: 8,
  },
  
  fileIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  
  fileInfo: {
    flex: 1,
  },
  
  fileName: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '600',
    marginBottom: 2,
  },
  
  fileSize: {
    fontSize: 12,
    color: '#666',
  },
  
  attachBtn: {
    marginRight: 8,
    padding: 2,
  },
  
  chatIconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  unreadBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#f44336',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  
  unreadBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    lineHeight: 12,
  },
  
  // Attachment Modal Styles
  attachmentModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  
  attachmentModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
  },
  
  attachmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  
  attachmentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  
  attachmentScrollView: {
    paddingHorizontal: 10,
  },
  
  attachmentOptions: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingTop: 20,
    alignItems: 'center',
  },
  
  attachmentOption: {
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    minWidth: 100,
  },
  
  attachmentIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  
  attachmentText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
});

export default TeacherChat;
