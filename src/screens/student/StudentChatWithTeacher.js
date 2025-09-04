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
import { useMessageStatus } from '../../utils/useMessageStatus';
import { formatToLocalTime } from '../../utils/timeUtils';
import { uploadChatFile, formatFileSize, getFileIcon, isSupportedFileType } from '../../utils/chatFileUpload';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { runCompleteDiagnostics } from '../../utils/storageDiagnostics';
import { runDirectStorageTest } from '../../utils/directStorageTest';
import { runNetworkDiagnostics, formatNetworkDiagnosticResults } from '../../utils/networkDiagnostics';
import { runBucketDiagnostics, formatBucketDiagnosticResults } from '../../utils/bucketDiagnostics';
import { runSimpleNetworkTest, formatSimpleNetworkResults } from '../../utils/simpleNetworkTest';
import usePullToRefresh from '../../hooks/usePullToRefresh';
import { getGlobalMessageHandler } from '../../utils/realtimeMessageHandler';

const StudentChatWithTeacher = () => {
  const { user } = useAuth();
  const { markMessagesAsRead } = useMessageStatus();
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({}); // Track unread messages per teacher
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [messageSubscription, setMessageSubscription] = useState(null);
  const flatListRef = useRef(null);

  // Pull-to-refresh functionality
  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    await Promise.all([
      fetchData(),
      fetchUnreadCounts()
    ]);
  });

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

  // Helper function to get teacher's user ID
  const getTeacherUserId = async (teacherId) => {
    try {
      console.log('🔍 Looking for user ID for teacher:', teacherId);

      // Method 1: Try linked_teacher_id (most reliable method)
      const { data: teacherUser, error: userError } = await supabase
        .from(TABLES.USERS)
        .select('id, email, full_name, role_id')
        .eq('linked_teacher_id', teacherId)
        .single();

      if (teacherUser && !userError) {
        console.log('✅ Found teacher user via linked_teacher_id:', teacherUser);
        return teacherUser.id;
      }

      console.log('❌ Teacher user not found via linked_teacher_id, error:', userError);

      // Method 2: Get teacher data and try to find a matching user by name
      const { data: teacherData, error: teacherError } = await supabase
        .from(TABLES.TEACHERS)
        .select('name')
        .eq('id', teacherId)
        .single();

      if (teacherError || !teacherData?.name) {
        console.log('❌ Could not get teacher data:', teacherError);
        throw new Error(`Teacher with ID ${teacherId} not found in teachers table`);
      }

      console.log('📝 Found teacher name:', teacherData.name);

      // Try to find user by matching full name
      const { data: userByName, error: nameError } = await supabase
        .from(TABLES.USERS)
        .select('id, email, full_name, linked_teacher_id')
        .ilike('full_name', `%${teacherData.name}%`)
        .limit(5); // Get multiple potential matches

      console.log('🔎 Name search results:', userByName, 'Error:', nameError);

      if (!nameError && userByName && userByName.length > 0) {
        // Try to find the best match
        const exactMatch = userByName.find(u => 
          u.full_name?.toLowerCase() === teacherData.name.toLowerCase()
        );
        
        if (exactMatch) {
          console.log('✅ Found exact name match:', exactMatch);
          return exactMatch.id;
        }

        // If no exact match, use the first result
        const firstMatch = userByName[0];
        console.log('⚠️ Using first partial match:', firstMatch);
        return firstMatch.id;
      }

      // Method 3: Check if the teacherId itself exists in users table (direct check)
      const { data: directUser, error: directError } = await supabase
        .from(TABLES.USERS)
        .select('id, email, full_name')
        .eq('id', teacherId)
        .single();

      if (!directError && directUser) {
        console.log('✅ Teacher ID exists directly in users table:', directUser);
        return directUser.id;
      }

      console.log('❌ Direct user lookup failed:', directError);

      // Method 4: Last resort - show available users for debugging
      console.log('🚨 No user found for teacher. Showing available teacher users for debugging:');
      const { data: allTeacherUsers } = await supabase
        .from(TABLES.USERS)
        .select('id, email, full_name, linked_teacher_id')
        .not('linked_teacher_id', 'is', null)
        .limit(10);
      
      console.log('Available teacher users:', allTeacherUsers);

      // Throw error instead of returning teacher ID as fallback
      throw new Error(`No user account found for teacher "${teacherData.name}" (ID: ${teacherId}). This teacher needs a user account to receive messages. Please contact the administrator to create a user account for this teacher.`);

    } catch (error) {
      console.log('💥 Error getting teacher user ID:', error);
      throw error; // Don't swallow the error, let it bubble up
    }
  };

  // Fetch unread message counts for all teachers
  const fetchUnreadCounts = async () => {
    try {
      if (!user?.id) return;
      
      // Get all unread messages for current user
      const { data: unreadMessages, error } = await supabase
        .from(TABLES.MESSAGES)
        .select('sender_id')
        .eq('receiver_id', user.id)
        .eq('is_read', false);
      
      if (error && error.code !== '42P01') {
        console.log('Error fetching unread counts:', error);
        return;
      }
      
      // Count unique senders
      const counts = {};
      if (unreadMessages) {
        unreadMessages.forEach(msg => {
          counts[msg.sender_id] = (counts[msg.sender_id] || 0) + 1;
        });
      }
      
      console.log('📊 Unread message counts:', counts);
      setUnreadCounts(counts);
    } catch (error) {
      console.log('Error in fetchUnreadCounts:', error);
    }
  };

  // Main data fetch function
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await Promise.all([
        fetchTeachers(),
        fetchUnreadCounts()
      ]);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Reset teacher selection and messages on screen focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('🎯 StudentChatWithTeacher screen focused');
      // Only reset if we're not already in a chat (preserve chat state when returning from other screens)
      if (!selectedTeacher) {
        console.log('📝 No selected teacher, fetching fresh data');
        setMessages([]);
        fetchData();
      } else {
        console.log('👨‍🏫 Selected teacher exists, preserving chat state:', selectedTeacher.name);
        // Just refresh unread counts without clearing chat
        fetchUnreadCounts();
      }
    }, [selectedTeacher])
  );

  // Fetch teachers assigned to the student
  const fetchTeachers = async () => {
    try {
      // Get student data using the helper function
      const { data: studentUserData, error: studentError } = await dbHelpers.getStudentByUserId(user.id);
      if (studentError || !studentUserData) {
        throw new Error('Student data not found');
      }

      // Get student details from the linked student
      const student = studentUserData.students;
      if (!student) {
        throw new Error('Student profile not found');
      }
      console.log('Student class_id:', student.class_id);
      
      // Get teachers assigned to this specific class
      const uniqueTeachers = [];
      const seen = new Set();
      
      // Method 1A: Get class teacher from classes table (using class_teacher_id)
      console.log('Fetching class teacher via classes table for class_id:', student.class_id);
      const { data: classInfo, error: classInfoError } = await supabase
        .from(TABLES.CLASSES)
        .select(`
          id,
          class_name,
          section,
          class_teacher_id,
          teachers!classes_class_teacher_id_fkey(
            id,
            name,
            qualification,
            phone
          )
        `)
        .eq('id', student.class_id)
        .single();
      
      if (!classInfoError && classInfo) {
        console.log('Found class info:', classInfo);
        
        // Add class teacher if available
        if (classInfo.class_teacher_id && classInfo.teachers && classInfo.teachers.name) {
          console.log('Found class teacher from classes table:', classInfo.teachers);
          
          try {
            // Get teacher's user ID
            const teacherUserId = await getTeacherUserId(classInfo.teachers.id);
            
            uniqueTeachers.push({
              id: classInfo.teachers.id,
              userId: teacherUserId,
              name: classInfo.teachers.name,
              phone: classInfo.teachers.phone,
              subject: 'Class Teacher',
              role: 'class_teacher',
              canMessage: true
            });
            seen.add(classInfo.teachers.id);
          } catch (userIdError) {
            console.log('❌ Could not get user ID for class teacher:', userIdError.message);
            
            // Still add the teacher but mark as non-messageable
            uniqueTeachers.push({
              id: classInfo.teachers.id,
              userId: null,
              name: classInfo.teachers.name + ' (No Account)',
              phone: classInfo.teachers.phone,
              subject: 'Class Teacher',
              role: 'class_teacher',
              canMessage: false,
              error: 'This teacher does not have a user account for messaging'
            });
            seen.add(classInfo.teachers.id);
          }
        }
      } else {
        console.log('Class info fetch error:', classInfoError);
      }
      
      // Method 1B: Alternative - Get class teacher directly from teachers table
      if (uniqueTeachers.length === 0) {
        console.log('Trying direct teacher fetch for class_id:', student.class_id);
        const { data: directClassTeacher, error: directTeacherError } = await supabase
          .from(TABLES.TEACHERS)
          .select('id, name, qualification, phone, is_class_teacher, assigned_class_id')
          .eq('assigned_class_id', student.class_id)
          .eq('is_class_teacher', true);
        
        if (!directTeacherError && directClassTeacher && directClassTeacher.length > 0) {
          console.log('Found class teacher directly:', directClassTeacher[0]);
          const teacher = directClassTeacher[0];
          if (teacher.name && !seen.has(teacher.id)) {
            uniqueTeachers.push({
              id: teacher.id,
              name: teacher.name,
              phone: teacher.phone,
              subject: 'Class Teacher',
              role: 'class_teacher'
            });
            seen.add(teacher.id);
          }
        }
      }
      
      // Method 2A: Get subject teachers via direct teacher_subjects query
      console.log('Fetching subject teachers for class_id:', student.class_id);
      
      // First, get all subjects for this specific class
      const { data: classSubjects, error: classSubjectsError } = await supabase
        .from(TABLES.SUBJECTS)
        .select('id, name')
        .eq('class_id', student.class_id);
      
      console.log('Class subjects:', classSubjects, 'Error:', classSubjectsError);
      
      if (!classSubjectsError && classSubjects && classSubjects.length > 0) {
        // For each subject, find the assigned teachers
        for (const subject of classSubjects) {
          console.log('Finding teachers for subject:', subject.name, 'ID:', subject.id);
          
          const { data: teacherAssignments, error: teacherError } = await supabase
            .from(TABLES.TEACHER_SUBJECTS)
            .select(`
              teacher_id,
              teachers!inner(
                id,
                name,
                qualification,
                phone,
                is_class_teacher
              )
            `)
            .eq('subject_id', subject.id);
          
          console.log('Teacher assignments for', subject.name, ':', teacherAssignments, 'Error:', teacherError);
          
          if (!teacherError && teacherAssignments && teacherAssignments.length > 0) {
            for (const assignment of teacherAssignments) {
              if (assignment.teachers && 
                  assignment.teachers.id && 
                  assignment.teachers.name && 
                  !seen.has(assignment.teachers.id)) {
                
                try {
                  // Get teacher's user ID
                  const teacherUserId = await getTeacherUserId(assignment.teachers.id);
                  
                  uniqueTeachers.push({
                    id: assignment.teachers.id,
                    userId: teacherUserId,
                    name: assignment.teachers.name,
                    phone: assignment.teachers.phone,
                    subject: subject.name,
                    role: 'subject_teacher',
                    canMessage: true
                  });
                } catch (userIdError) {
                  console.log('❌ Could not get user ID for subject teacher:', userIdError.message);
                  
                  // Still add the teacher but mark as non-messageable
                  uniqueTeachers.push({
                    id: assignment.teachers.id,
                    userId: null,
                    name: assignment.teachers.name + ' (No Account)',
                    phone: assignment.teachers.phone,
                    subject: subject.name,
                    role: 'subject_teacher',
                    canMessage: false,
                    error: 'This teacher does not have a user account for messaging'
                  });
                }
                
                seen.add(assignment.teachers.id);
                console.log('Added subject teacher:', assignment.teachers.name, 'for', subject.name);
              }
            }
          }
        }
      }
      
      // Method 2B: Alternative approach - use join query
      if (uniqueTeachers.filter(t => t.role === 'subject_teacher').length === 0) {
        console.log('No subject teachers found via Method 2A, trying join query...');
        
        const { data: subjectAssignments, error: subjectError } = await supabase
          .from(TABLES.TEACHER_SUBJECTS)
          .select(`
            teacher_id,
            subjects!inner(
              id,
              name,
              class_id
            ),
            teachers!inner(
              id,
              name,
              qualification
            )
          `)
          .eq('subjects.class_id', student.class_id);
        
        console.log('Join query result:', subjectAssignments, 'Error:', subjectError);
        
        if (!subjectError && subjectAssignments && subjectAssignments.length > 0) {
          for (const assignment of subjectAssignments) {
            console.log('Processing join assignment:', assignment);
            
            if (assignment.teachers && 
                assignment.teachers.id && 
                assignment.teachers.name && 
                !seen.has(assignment.teachers.id)) {
              
              try {
                // Get teacher's user ID
                const teacherUserId = await getTeacherUserId(assignment.teachers.id);
                
                uniqueTeachers.push({
                  id: assignment.teachers.id,
                  userId: teacherUserId,
                  name: assignment.teachers.name,
                  subject: assignment.subjects?.name || 'Subject Teacher',
                  role: 'subject_teacher',
                  canMessage: true
                });
              } catch (userIdError) {
                console.log('❌ Could not get user ID for join subject teacher:', userIdError.message);
                
                // Still add the teacher but mark as non-messageable
                uniqueTeachers.push({
                  id: assignment.teachers.id,
                  userId: null,
                  name: assignment.teachers.name + ' (No Account)',
                  subject: assignment.subjects?.name || 'Subject Teacher',
                  role: 'subject_teacher',
                  canMessage: false,
                  error: 'This teacher does not have a user account for messaging'
                });
              }
              
              seen.add(assignment.teachers.id);
              console.log('Added subject teacher via join:', assignment.teachers.name);
            }
          }
        }
      }
      
      // Method 3: If still no teachers, get all teachers assigned to this class (broader search)
      if (uniqueTeachers.length === 0) {
        console.log('No teachers found via specific methods, trying broader search');
        
        const { data: allClassTeachers, error: allTeachersError } = await supabase
          .from(TABLES.TEACHERS)
          .select('id, name, qualification, is_class_teacher, assigned_class_id')
          .eq('assigned_class_id', student.class_id);
        
        if (!allTeachersError && allClassTeachers && allClassTeachers.length > 0) {
          console.log('Found teachers in broader search:', allClassTeachers);
          
          allClassTeachers.forEach(teacher => {
            if (teacher.name && !seen.has(teacher.id)) {
              uniqueTeachers.push({
                id: teacher.id,
                name: teacher.name,
                subject: teacher.is_class_teacher ? 'Class Teacher' : 'Subject Teacher',
                role: teacher.is_class_teacher ? 'class_teacher' : 'subject_teacher'
              });
              seen.add(teacher.id);
            }
          });
        }
      }
      
      // Method 4: Alternative approach - get subjects for the class and then find their teachers
      if (uniqueTeachers.length === 0) {
        console.log('Still no teachers found, trying alternative approach via subjects');
        
        // First get all subjects for this class
        const { data: classSubjects, error: subjectsError } = await supabase
          .from(TABLES.SUBJECTS)
          .select('id, name')
          .eq('class_id', student.class_id);
        
        if (!subjectsError && classSubjects && classSubjects.length > 0) {
          console.log('Found class subjects:', classSubjects);
          
          // For each subject, find the teachers
          for (const subject of classSubjects) {
            const { data: teacherForSubject, error: teacherSubjectError } = await supabase
              .from(TABLES.TEACHER_SUBJECTS)
              .select(`
                teacher_id,
                teachers!inner(
                  id,
                  name,
                  qualification
                )
              `)
              .eq('subject_id', subject.id);
            
            if (!teacherSubjectError && teacherForSubject && teacherForSubject.length > 0) {
              teacherForSubject.forEach(ts => {
                if (ts.teachers && ts.teachers.name && !seen.has(ts.teachers.id)) {
                  uniqueTeachers.push({
                    id: ts.teachers.id,
                    name: ts.teachers.name,
                    subject: subject.name,
                    role: 'subject_teacher'
                  });
                  seen.add(ts.teachers.id);
                }
              });
            }
          }
        }
      }
      
      console.log('Final teachers list:', uniqueTeachers);
      
      // Method 5: Last resort - show ALL teachers for debugging (remove this in production)
      if (uniqueTeachers.length === 0) {
        console.log('No teachers found via any method. Trying to show all teachers for debugging...');
        
        const { data: allTeachers, error: allTeachersError } = await supabase
          .from(TABLES.TEACHERS)
          .select('id, name, qualification, is_class_teacher, assigned_class_id')
          .limit(10);
        
        if (!allTeachersError && allTeachers && allTeachers.length > 0) {
          console.log('Found all teachers (for debugging):', allTeachers);
          
          allTeachers.forEach(teacher => {
            if (teacher.name && !seen.has(teacher.id)) {
              uniqueTeachers.push({
                id: teacher.id,
                name: teacher.name + ' (Debug)',
                subject: teacher.is_class_teacher ? 'Class Teacher (Debug)' : 'Subject Teacher (Debug)',
                role: teacher.is_class_teacher ? 'class_teacher' : 'subject_teacher'
              });
              seen.add(teacher.id);
            }
          });
        }
      }
      
      // If STILL no teachers found, this means the database doesn't have any teachers
      if (uniqueTeachers.length === 0) {
        console.log('No teachers found at all in the database for class', student.class_id);
        
        // Get class info for debugging
        const { data: classDebugInfo, error: classDebugError } = await supabase
          .from(TABLES.CLASSES)
          .select('*')
          .eq('id', student.class_id)
          .single();
        
        console.log('Student class debug info:', classDebugInfo, classDebugError);
        
        setError(`No teachers found for your class. \n\nDebug Info:\nStudent Class ID: ${student.class_id}\nClass Name: ${classDebugInfo?.class_name || 'N/A'}\nSection: ${classDebugInfo?.section || 'N/A'}\nClass Teacher ID: ${classDebugInfo?.class_teacher_id || 'N/A'}\n\nPlease contact the school administrator to assign teachers.`);
        return;
      }
      setTeachers(uniqueTeachers);
    } catch (err) {
      setError(err.message);
      setTeachers([]);
      console.error('Fetch teachers error:', err);
    }
  };

  // Fetch chat messages for selected teacher
  const fetchMessages = async (teacher) => {
    console.log('🎯 fetchMessages called with teacher:', {
      id: teacher.id,
      name: teacher.name,
      userId: teacher.userId,
      canMessage: teacher.canMessage
    });
    
    try {
      // Don't set loading if this is a refresh call (teacher is already selected)
      if (!selectedTeacher) {
        console.log('📋 Setting loading and selected teacher');
        setLoading(true);
        setSelectedTeacher(teacher);
      } else {
        console.log('🔄 Refreshing messages for already selected teacher');
      }
      setError(null);

      // Check if teacher has a user account
      if (teacher.canMessage === false) {
        setError(teacher.error || 'This teacher does not have a user account for messaging');
        setMessages([]);
        return;
      }

      // Get student data using the helper function
      const { data: studentUserData, error: studentError } = await dbHelpers.getStudentByUserId(user.id);
      if (studentError || !studentUserData) {
        throw new Error('Student data not found');
      }

      const student = studentUserData.students;
      if (!student) {
        throw new Error('Student profile not found');
      }

      // Get teacher's user ID for message fetching
      let teacherUserId = teacher.userId;
      if (!teacherUserId) {
        try {
          teacherUserId = await getTeacherUserId(teacher.id);
        } catch (userIdError) {
          setError(userIdError.message);
          setMessages([]);
          return;
        }
      }

      // Get messages with error handling
      try {
        console.log('🔄 Fetching messages between user:', user.id, 'and teacher user:', teacherUserId);
        
        // Try multiple query approaches for better compatibility
        let msgs = null;
        let msgError = null;
        
        // Get tenant_id for RLS compliance
        const { data: currentUserData } = await supabase
          .from(TABLES.USERS)
          .select('tenant_id')
          .eq('id', user.id)
          .single();
          
        const tenantId = currentUserData?.tenant_id;
        if (!tenantId) {
          throw new Error('Cannot access messages: tenant context not found');
        }
        
        console.log('🏢 Using tenant_id for message queries:', tenantId);
        console.log('👤 User ID:', user.id);
        console.log('👨‍🏫 Teacher User ID:', teacherUserId);
        
        // Simplified approach: Let RLS handle tenant isolation, just query by user IDs
        console.log('📡 Fetching sent and received messages separately...');
        
        const [sentMsgs, receivedMsgs] = await Promise.all([
          supabase
            .from(TABLES.MESSAGES)
            .select('*')
            .eq('sender_id', user.id)
            .eq('receiver_id', teacherUserId)
            .order('sent_at', { ascending: true }),
          supabase
            .from(TABLES.MESSAGES)
            .select('*')
            .eq('sender_id', teacherUserId)
            .eq('receiver_id', user.id)
            .order('sent_at', { ascending: true })
        ]);
        
        console.log('📤 Sent messages result:', {
          count: sentMsgs.data?.length || 0,
          error: sentMsgs.error,
          sample: sentMsgs.data?.[0]
        });
        
        console.log('📥 Received messages result:', {
          count: receivedMsgs.data?.length || 0,
          error: receivedMsgs.error,
          sample: receivedMsgs.data?.[0]
        });
        
        if (!sentMsgs.error && !receivedMsgs.error) {
          msgs = [...(sentMsgs.data || []), ...(receivedMsgs.data || [])]
            .sort((a, b) => new Date(a.sent_at || a.created_at) - new Date(b.sent_at || b.created_at));
          console.log('✅ Combined messages count:', msgs.length);
        } else {
          msgError = sentMsgs.error || receivedMsgs.error;
          console.error('❌ Query errors:', { sentError: sentMsgs.error, receivedError: receivedMsgs.error });
        }
        
        // If still no messages, try a broader query for debugging
        if ((!msgs || msgs.length === 0) && !msgError) {
          console.log('🔍 No messages found, trying broader debug query...');
          
          const debugQuery = await supabase
            .from(TABLES.MESSAGES)
            .select('*')
            .eq('tenant_id', tenantId)
            .limit(10);
            
          console.log('🔍 Debug: All messages in tenant:', {
            count: debugQuery.data?.length || 0,
            error: debugQuery.error,
            messages: debugQuery.data?.map(m => ({
              id: m.id,
              sender_id: m.sender_id,
              receiver_id: m.receiver_id,
              message: m.message?.substring(0, 30)
            }))
          });
        }

        console.log('📨 Final messages result:', { msgsCount: msgs?.length || 0, msgError });
        
        if (msgs && msgs.length > 0) {
          console.log('📋 Message details:');
          msgs.forEach((msg, index) => {
            console.log(`  ${index + 1}. ${msg.sender_id === user.id ? '→' : '←'} ${msg.message?.substring(0, 50)} (${msg.sent_at || msg.created_at})`);
          });
        }

        if (msgError && msgError.code !== '42P01') {
          throw msgError;
        }
        
        const formattedMessages = (msgs || []).map(msg => ({
          ...msg,
          id: msg.id || msg.created_at || Date.now().toString(),
          message_type: msg.message_type || 'text'
        }));
        
        console.log('✅ Setting formatted messages count:', formattedMessages.length);
        setMessages(formattedMessages);
        
        // Mark messages from this teacher as read
        if (teacherUserId !== user.id) {
          markMessagesAsRead(teacherUserId);
          // Update unread counts to remove this teacher
          setUnreadCounts(prev => {
            const updated = { ...prev };
            delete updated[teacherUserId];
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
              console.log('Scroll to end error:', error);
            }
          }, 300);
        }
        
      } catch (err) {
        console.log('❌ Messages fetch error:', err);
        setMessages([]);
      }
    } catch (err) {
      setError(err.message);
      setMessages([]);
      console.error('❌ Fetch messages error:', err);
    } finally {
      if (!selectedTeacher) {
        setLoading(false);
      }
    }
  };

  // Real-time subscription for messages - simplified and more reliable
  useEffect(() => {
    if (!selectedTeacher || !selectedTeacher.userId) {
      console.log('❌ No selected teacher or teacher userId for real-time subscription');
      return;
    }
    
    const teacherUserId = selectedTeacher.userId;
    console.log('🚀 Setting up real-time subscription for chat between:', user.id, 'and', teacherUserId);
    
    // Create a unique channel name for this chat
    const sortedIds = [user.id, teacherUserId].sort();
    const channelName = `messages-${sortedIds[0]}-${sortedIds[1]}`;
    
    const subscription = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
        schema: 'public',
        table: TABLES.MESSAGES
      }, (payload) => {
        console.log('📨 Real-time payload received:', payload);
        
        const { eventType, new: newRecord, old: oldRecord } = payload;
        const messageData = newRecord || oldRecord;
        
        // Only process messages related to this chat
        if (!messageData || 
            (messageData.sender_id !== user.id && messageData.sender_id !== teacherUserId) ||
            (messageData.receiver_id !== user.id && messageData.receiver_id !== teacherUserId)) {
          console.log('🔄 Message not for this chat, ignoring');
          return;
        }
        
        console.log('✅ Processing real-time message:', eventType, messageData.id);
        
        if (eventType === 'INSERT') {
          // New message - add to list
          const formattedMessage = {
            ...messageData,
            message_type: messageData.message_type || 'text'
          };
          
          setMessages(prev => {
            // Check if message already exists (avoid duplicates)
            const exists = prev.some(m => m.id === formattedMessage.id);
            if (exists) {
              console.log('⚠️ Message already exists, skipping:', formattedMessage.id);
              return prev;
            }
            
            const updated = [...prev, formattedMessage].sort((a, b) => 
              new Date(a.sent_at || a.created_at) - new Date(b.sent_at || b.created_at)
            );
            return updated;
          });
          
          // Mark as read if from teacher
          if (messageData.sender_id === teacherUserId) {
            console.log('📖 Marking message as read from teacher');
            markMessagesAsRead(teacherUserId);
            setUnreadCounts(prev => {
              const updated = { ...prev };
              delete updated[teacherUserId];
              return updated;
            });
          }
          
          // Auto-scroll to bottom
          setTimeout(() => {
            try {
              flatListRef.current?.scrollToEnd({ animated: true });
            } catch (error) {
              console.log('Scroll error:', error);
            }
          }, 100);
          
        } else if (eventType === 'UPDATE') {
          // Message updated - replace existing
          const formattedMessage = {
            ...messageData,
            message_type: messageData.message_type || 'text'
          };
          
          setMessages(prev => prev.map(msg => 
            msg.id === formattedMessage.id ? formattedMessage : msg
          ));
          
        } else if (eventType === 'DELETE') {
          // Message deleted - remove from list
          setMessages(prev => prev.filter(msg => msg.id !== messageData.id));
        }
      })
      .subscribe((status) => {
        console.log('📡 Subscription status:', status, 'for channel:', channelName);
      });
    
    return () => {
      console.log('🛑 Cleaning up real-time subscription for:', channelName);
      subscription.unsubscribe();
    };
  }, [selectedTeacher, user.id, markMessagesAsRead]);

  // Send a message with optimistic UI
  const handleSend = async () => {
    if (!input.trim() || !selectedTeacher || sending) return;
    
    const messageText = input.trim();
    const teacherUserId = selectedTeacher.userId;
    
    if (!teacherUserId) {
      Alert.alert('Error', 'Cannot send message: Teacher account not available');
      return;
    }
    
    // Clear input immediately for better UX
    setInput('');
    setSending(true);
    
    try {
      // Get student data for the student_id field
      const { data: studentUserData, error: studentError } = await dbHelpers.getStudentByUserId(user.id);
      if (studentError || !studentUserData) {
        throw new Error('Student data not found');
      }

      const student = studentUserData.students;
      if (!student) {
        throw new Error('Student profile not found');
      }
      
      // Prepare message data for the handler (let trigger handle tenant_id)
      const messageData = {
        sender_id: user.id,
        receiver_id: teacherUserId,
        student_id: student.id,
        message: messageText,
        message_type: 'text'
        // tenant_id will be automatically set by the trigger
      };
      
      // Add optimistic message immediately for better UX
      const tempId = `temp_${Date.now()}_${Math.random()}`;
      const optimisticMessage = {
        ...messageData,
        id: tempId,
        sent_at: new Date().toISOString(),
        message_type: 'text',
        pending: true // Mark as pending
      };
      
      // Add optimistic message to UI immediately
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
          flatListRef.current?.scrollToEnd({ animated: true });
        } catch (error) {
          console.log('Scroll error after optimistic message:', error);
        }
      }, 100);
      
      // Send to database
      const { data: insertedMsg, error: sendError } = await supabase
        .from(TABLES.MESSAGES)
        .insert(messageData)
        .select()
        .single();
      
      if (sendError) {
        console.error('❌ Database insert failed:', sendError);
        
        // Mark message as failed
        setMessages(prev => prev.map(msg => 
          msg.id === tempId ? { ...msg, failed: true, error: sendError.message, pending: false } : msg
        ));
        
        // Restore input text for retry
        setInput(messageText);
        Alert.alert('Message Failed', `Failed to send message: ${sendError.message || 'Unknown error'}. You can try sending again.`);
        return;
      }
      
      // Replace optimistic message with real one
      const confirmedMessage = {
        ...insertedMsg,
        message_type: insertedMsg.message_type || 'text',
        pending: false
      };
      
      console.log('✅ Message confirmed, replacing optimistic:', { tempId, confirmedMessage });
      setMessages(prev => prev.map(msg => 
        msg.id === tempId ? confirmedMessage : msg
      ));
      
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
              setDeletingMessageId(messageId);
              
              const { error: deleteError } = await supabase
                .from(TABLES.MESSAGES)
                .delete()
                .eq('id', messageId)
                .eq('sender_id', user.id); // Only allow deleting own messages
              
              if (deleteError) {
                console.error('Delete error:', deleteError);
                Alert.alert('Error', 'Failed to delete message');
                return;
              }
              
              // Remove from local state
              setMessages(prev => prev.filter(msg => msg.id !== messageId));
            } catch (err) {
              console.error('Error deleting message:', err);
              Alert.alert('Error', 'Failed to delete message');
            } finally {
              setDeletingMessageId(null);
            }
          }
        }
      ]
    );
  };

  // Handle image download with user choice
  const handleImageDownload = async (imageUrl, fileName) => {
    console.log('🖼️ Image download requested:', { imageUrl, fileName });
    
    try {
      // Generate filename if not provided
      const downloadFileName = fileName || `chat_image_${Date.now()}.jpg`;
      console.log('📁 Download filename:', downloadFileName);
      
      // Check permissions upfront
      const { status: mediaStatus } = await MediaLibrary.getPermissionsAsync();
      const needsMediaPermission = mediaStatus !== 'granted';
      console.log('📱 Media library permission status:', mediaStatus);
      
      // Show options to user with proper button order
      Alert.alert(
        'Save Image',
        'Choose where you want to save this image:',
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: '📁 Save to Files',
            onPress: async () => {
              console.log('💾 User chose: Save to Files');
              try {
                // Download to temp location first
                const fileUri = FileSystem.documentDirectory + downloadFileName;
                console.log('⬇️ Downloading to temp location:', fileUri);
                
                const downloadResult = await FileSystem.downloadAsync(imageUrl, fileUri);
                console.log('📥 Download result:', downloadResult.status);
                
                if (downloadResult.status === 200) {
                  // Use sharing dialog to open file manager/save dialog
                  const isAvailable = await Sharing.isAvailableAsync();
                  console.log('🔗 Sharing available:', isAvailable);
                  
                  if (isAvailable) {
                    console.log('📤 Opening file manager/share dialog...');
                    await Sharing.shareAsync(downloadResult.uri, {
                      mimeType: 'image/jpeg',
                      dialogTitle: 'Save image to...'
                    });
                    console.log('✅ Share dialog opened successfully');
                  } else {
                    Alert.alert('Not Available', 'File sharing is not available on this device');
                  }
                } else {
                  throw new Error(`Download failed with status: ${downloadResult.status}`);
                }
              } catch (error) {
                console.error('❌ File save error:', error);
                Alert.alert('Save Failed', `Failed to save image to files: ${error.message}`);
              }
            }
          },
          {
            text: '📷 Save to Gallery',
            onPress: async () => {
              console.log('🖼️ User chose: Save to Gallery');
              try {
                // Request media library permissions if needed
                let permissionStatus = mediaStatus;
                if (needsMediaPermission) {
                  console.log('🔐 Requesting media library permission...');
                  const permissionResult = await MediaLibrary.requestPermissionsAsync();
                  permissionStatus = permissionResult.status;
                  console.log('🔐 Permission result:', permissionStatus);
                }
                
                if (permissionStatus !== 'granted') {
                  console.log('❌ Media library permission denied');
                  Alert.alert(
                    'Permission Required', 
                    'Permission to access your photo gallery is required to save images. Please enable it in your device settings.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Open Settings', onPress: () => {
                        // Try to open app settings (platform specific)
                        if (Platform.OS === 'ios') {
                          Linking.openURL('app-settings:');
                        } else {
                          Linking.openSettings();
                        }
                      }}
                    ]
                  );
                  return;
                }

                // Download to cache directory instead (better for MediaLibrary)
                const fileUri = FileSystem.cacheDirectory + downloadFileName;
                console.log('⬇️ Downloading to cache location for gallery save:', fileUri);
                
                const downloadResult = await FileSystem.downloadAsync(imageUrl, fileUri);
                console.log('📥 Gallery download result:', downloadResult.status);
                
                if (downloadResult.status === 200) {
                  // Check if file actually exists and is readable
                  const fileInfo = await FileSystem.getInfoAsync(downloadResult.uri);
                  console.log('📄 File info after download:', fileInfo);
                  
                  if (!fileInfo.exists) {
                    throw new Error('Downloaded file does not exist');
                  }
                  
                  // Save to media library (gallery)
                  console.log('💾 Saving to gallery with MediaLibrary...');
                  
                  // Try to create asset with explicit album creation
                  const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
                  console.log('📸 Gallery asset created:', asset);
                  
                  if (asset && asset.id) {
                    console.log('✅ Asset successfully saved to gallery:', {
                      id: asset.id,
                      filename: asset.filename,
                      uri: asset.uri,
                      mediaType: asset.mediaType
                    });
                    
                    // Try to get the album info to confirm save location
                    try {
                      const albums = await MediaLibrary.getAlbumsAsync({
                        includeSmartAlbums: true
                      });
                      console.log('📷 Available albums:', albums.map(a => a.title));
                    } catch (albumError) {
                      console.log('⚠️ Could not fetch albums info:', albumError);
                    }
                    
                    // Clean up temp file after successful save
                    try {
                      await FileSystem.deleteAsync(downloadResult.uri, { idempotent: true });
                      console.log('🧹 Temp file cleaned up successfully');
                    } catch (cleanupError) {
                      console.log('⚠️ Temp file cleanup error (non-critical):', cleanupError);
                    }
                    
                    Alert.alert(
                      'Saved Successfully! 🎉', 
                      `Image has been saved to your photo gallery!\n\nFilename: ${asset.filename || downloadFileName}\n\nYou can find it in your Photos app.`,
                      [{ text: 'OK' }]
                    );
                  } else {
                    throw new Error('MediaLibrary.createAssetAsync returned null or invalid asset');
                  }
                } else {
                  throw new Error(`Download failed with HTTP status: ${downloadResult.status}`);
                }
              } catch (error) {
                console.error('❌ Gallery save error:', error);
                Alert.alert('Save Failed', `Failed to save to gallery: ${error.message}`);
              }
            }
          }
        ],
        { cancelable: true }
      );
    } catch (error) {
      console.error('❌ Image download preparation error:', error);
      Alert.alert('Download Failed', `Failed to prepare download: ${error.message}`);
    }
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
          receiver_id: selectedTeacher.userId,
          message: '📷 Uploading photo...',
          message_type: 'image',
          timestamp: formatToLocalTime(new Date().toISOString()),
          sender: 'student',
          uploading: true
        };
        
        setMessages(prev => [...prev, tempMsg]);
        
        // Get student data for context
        const { data: studentUserData } = await supabase
          .from(TABLES.USERS)
          .select('linked_student_id')
          .eq('id', user.id)
          .single();
        
        // Get teacher user ID first
        let teacherUserId = selectedTeacher.userId;
        if (!teacherUserId) {
          try {
            teacherUserId = await getTeacherUserId(selectedTeacher.id);
          } catch (userIdError) {
            throw new Error('Cannot get teacher user ID: ' + userIdError.message);
          }
        }
        
        // Upload to chat-files bucket
        const uploadResult = await uploadChatFile(
          {
            uri: asset.uri,
            name: asset.fileName || `photo_${Date.now()}.jpg`,
            size: asset.fileSize,
            type: 'image/jpeg'
          },
          user.id,
          teacherUserId,
          studentUserData?.linked_student_id
        );
        
        if (uploadResult.success) {
          // Save to database
          const { data: insertedMsg, error: sendError } = await supabase
            .from('messages')
            .insert(uploadResult.messageData)
            .select();
            
          if (!sendError && insertedMsg?.[0]) {
            // Replace temp message with actual message
            setMessages(prev => prev.map(msg => 
              msg.id === tempMsg.id
                ? {
                    ...insertedMsg[0],
                    timestamp: formatToLocalTime(insertedMsg[0].sent_at),
                    sender: 'student'
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
          receiver_id: selectedTeacher.userId,
          message: `📎 Uploading ${file.name}...`,
          message_type: 'file',
          timestamp: formatToLocalTime(new Date().toISOString()),
          sender: 'student',
          uploading: true
        };
        
        setMessages(prev => [...prev, tempMsg]);
        
        // Get student data for context
        const { data: studentUserData } = await supabase
          .from(TABLES.USERS)
          .select('linked_student_id')
          .eq('id', user.id)
          .single();
        
        // Get teacher user ID first
        let teacherUserId = selectedTeacher.userId;
        if (!teacherUserId) {
          try {
            teacherUserId = await getTeacherUserId(selectedTeacher.id);
          } catch (userIdError) {
            throw new Error('Cannot get teacher user ID: ' + userIdError.message);
          }
        }
        
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
          teacherUserId,
          studentUserData?.linked_student_id
        );
        
        if (uploadResult.success) {
          // Save to database
          const { data: insertedMsg, error: sendError } = await supabase
            .from('messages')
            .insert(uploadResult.messageData)
            .select();
            
          if (!sendError && insertedMsg?.[0]) {
            // Replace temp message with actual message
            setMessages(prev => prev.map(msg => 
              msg.id === tempMsg.id
                ? {
                    ...insertedMsg[0],
                    timestamp: formatToLocalTime(insertedMsg[0].sent_at),
                    sender: 'student'
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

  // Send file message to database
  const sendFileMessage = async (fileData) => {
    try {
      // Get student's linked ID
      const { data: studentUserData, error: studentError } = await dbHelpers.getStudentByUserId(user.id);
      if (studentError || !studentUserData) {
        throw new Error('Student data not found');
      }

      const student = studentUserData.students;
      if (!student) {
        throw new Error('Student profile not found');
      }

      // Get teacher's user ID
      const teacherUserId = selectedTeacher.userId || await getTeacherUserId(selectedTeacher.id);

      if (!teacherUserId) {
        throw new Error('Teacher user account not found');
      }

      // Create message with file data
      const newMsg = {
        sender_id: user.id,
        receiver_id: teacherUserId,
        student_id: student.id,
        message: fileData.message_type === 'image' ? '📷 Photo' : `📎 ${fileData.file_name}`,
        message_type: fileData.message_type,
        file_url: fileData.file_url,
        file_name: fileData.file_name,
        file_size: fileData.file_size,
        file_type: fileData.file_type,
        sent_at: new Date().toISOString(),
      };

      const { data: insertedMsg, error: sendError } = await supabase
        .from('messages')
        .insert(newMsg)
        .select();

      if (sendError) throw sendError;

      // Add to local state for immediate display
      const displayMsg = {
        ...newMsg,
        id: insertedMsg[0].id,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sender: 'student'
      };

      setMessages(prev => [...prev, displayMsg]);

    } catch (error) {
      console.error('Error sending file message:', error);
      Alert.alert('Error', 'Failed to send file: ' + error.message);
    }
  };

  // Go back to teacher list
  const handleBack = () => {
    setSelectedTeacher(null);
    setMessages([]);
  };

  // Handle call functionality
  const handleCall = () => {
    if (selectedTeacher?.phone) {
      const phoneNumber = selectedTeacher.phone;
      const phoneUrl = Platform.OS === 'ios' ? `tel:${phoneNumber}` : `tel:${phoneNumber}`;

      Linking.canOpenURL(phoneUrl)
        .then((supported) => {
          if (supported) {
            return Linking.openURL(phoneUrl);
          } else {
            Alert.alert('Error', 'Phone calls are not supported on this device');
          }
        })
        .catch((err) => {
          console.error('Error opening phone app:', err);
          Alert.alert('Error', 'Unable to make phone call');
        });
    } else {
      Alert.alert('No Phone Number', 'Phone number not available for this teacher');
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        try {
          if (flatListRef.current && flatListRef.current.scrollToEnd) {
            flatListRef.current.scrollToEnd({ animated: true });
          }
        } catch (error) {
          console.log('Scroll to end on messages change error:', error);
        }
      }, 200);
    }
  }, [messages]);

  // Sort teachers by most recent chat (latest message timestamp)
  const getSortedTeachers = () => {
    return [...teachers].sort((a, b) => {
      const aMsgs = messages.filter(m => m.sender_id === a.id || m.receiver_id === a.id);
      const bMsgs = messages.filter(m => m.sender_id === b.id || m.receiver_id === b.id);
      const aTime = aMsgs.length ? new Date(aMsgs[aMsgs.length - 1].created_at) : new Date(0);
      const bTime = bMsgs.length ? new Date(bMsgs[bMsgs.length - 1].created_at) : new Date(0);
      return bTime - aTime;
    });
  };

  return (
    <View style={styles.container}>
      <Header title="Chat With Teacher" showBack={true} />
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#1976d2" />
        </View>
      ) : error ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#d32f2f', fontSize: 16, marginBottom: 12, textAlign: 'center' }}>Error: {error}</Text>
          <TouchableOpacity onPress={fetchData} style={{ backgroundColor: '#1976d2', padding: 12, borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : !selectedTeacher ? (
        <View style={styles.teacherListContainer}>
          <View style={styles.headerSection}>
            <Text style={styles.sectionTitle}>Your Teachers</Text>
            <Text style={styles.sectionSubtitle}>
              {teachers.length} teacher{teachers.length !== 1 ? 's' : ''} assigned to your class
            </Text>
          </View>
          
          {teachers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No teachers assigned to your class.</Text>
              <Text style={styles.emptySubtext}>
                Please contact the school administrator to assign teachers to your class.
              </Text>
            </View>
          ) : (
            <FlatList
              data={getSortedTeachers()}
              keyExtractor={item => item.id}
              renderItem={({ item, index }) => {
                const sortedTeachers = getSortedTeachers();
                const showClassTeacherHeader = index === 0 && item.role === 'class_teacher';
                const showSubjectTeacherHeader = index > 0 &&
                  item.role === 'subject_teacher' &&
                  sortedTeachers[index - 1].role !== 'subject_teacher';

                // Get unread count for this teacher
                const unreadCount = unreadCounts[item.userId] || unreadCounts[item.id];
                const hasUnread = unreadCount > 0;
                const hasMessages = messages && messages.length > 0;

                return (
                  <View>
                    {showClassTeacherHeader && (
                      <View style={styles.sectionHeader}>
                        <Text style={styles.sectionHeaderText}>Class Teacher</Text>
                      </View>
                    )}
                    {showSubjectTeacherHeader && (
                      <View style={styles.sectionHeader}>
                        <Text style={styles.sectionHeaderText}>Subject Teachers</Text>
                      </View>
                    )}
                    <TouchableOpacity 
                      style={[
                        styles.teacherCard,
                        item.role === 'class_teacher' && styles.classTeacherCard,
                        hasUnread && styles.unreadTeacherCard
                      ]}
                      onPress={() => {
                        // Check if teacher has a user account before proceeding
                        if (item.canMessage === false) {
                          Alert.alert(
                            'Cannot Message Teacher',
                            `${item.name.replace(' (No Account)', '')} doesn't have a user account yet, so you can't send messages to them. Please contact the school administrator to set up their account.`,
                            [{ text: 'OK' }]
                          );
                          return;
                        }
                        fetchMessages(item);
                      }}
                    >
                      <View style={[
                        styles.teacherAvatar,
                        { backgroundColor: item.role === 'class_teacher' ? '#4CAF50' : '#2196F3' },
                        hasUnread && styles.unreadAvatar
                      ]}>
                        {hasUnread && (
                          <View style={styles.unreadDot} />
                        )}
                        <Ionicons
                          name={item.role === 'class_teacher' ? 'school' : 'book'}
                          size={24}
                          color="#fff"
                        />
                      </View>
                      <View style={styles.teacherInfo}>
                        <View style={styles.teacherHeader}>
                          <Text style={[
                            styles.teacherName,
                            hasUnread && styles.unreadText
                          ]} numberOfLines={item.name.includes('(No Account)') ? 2 : 1}>
                            {item.name}
                          </Text>
                          <View style={[
                            styles.roleBadge,
                            { backgroundColor: item.role === 'class_teacher' ? '#4CAF50' : '#2196F3' }
                          ]}>
                            <Text style={styles.roleBadgeText}>
                              {item.role === 'class_teacher' ? 'CLASS' : 'SUBJECT'}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.teacherSubject} numberOfLines={1}>
                          {item.subject}
                        </Text>
                        
                        {/* Unread Message Count or Status */}
                        <View style={styles.messageStatusContainer}>
                          {hasUnread ? (
                            <Text style={styles.unreadMessagesText}>
                              +{unreadCount} new message{unreadCount > 1 ? 's' : ''}
                            </Text>
                          ) : hasMessages ? (
                            <Text style={styles.allReadText}>
                              All messages read
                            </Text>
                          ) : (
                            <Text style={styles.noMessagesText}>
                              Start a conversation
                            </Text>
                          )}
                        </View>
                      </View>
                      <View style={styles.chatActions}>
                        <View style={styles.chatIconContainer}>
                          <Ionicons name="chatbubbles" size={20} color={hasUnread ? "#f44336" : "#9c27b0"} />
                          {hasUnread && (
                            <View style={styles.unreadBadge}>
                              <Text style={styles.unreadBadgeText}>
                                {unreadCount > 99 ? '99+' : unreadCount}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#ccc" style={{ marginTop: 2 }} />
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              }}
              contentContainerStyle={{ padding: 16 }}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={['#1976d2', '#4CAF50', '#FF9800']}
                  tintColor="#1976d2"
                  title="Pull to refresh chat data"
                  titleColor="#666"
                />
              }
            />
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
            <Ionicons name="person-circle" size={32} color="#1976d2" style={{ marginRight: 8 }} />
            <View style={styles.chatHeaderInfo}>
              <Text style={styles.chatHeaderName} numberOfLines={1}>{selectedTeacher.name}</Text>
              <Text style={styles.chatHeaderSubject} numberOfLines={1}>{selectedTeacher.subject}</Text>
            </View>
            <TouchableOpacity onPress={handleCall} style={styles.callButton}>
              <Ionicons name="call" size={24} color="#4CAF50" />
            </TouchableOpacity>
          </View>
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
            renderItem={({ item }) => (
              <TouchableOpacity 
                onLongPress={() => {
                  if (item.sender_id === user.id) {
                    handleDeleteMessage(item.id);
                  }
                }}
                delayLongPress={500}
                activeOpacity={0.7}
                style={{ 
                  opacity: deletingMessageId === item.id ? 0.5 : 1,
                  transform: [{ scale: deletingMessageId === item.id ? 0.95 : 1 }]
                }}
              >
                <View style={[
                  styles.messageBubble, 
                  item.sender_id === user.id ? styles.bubbleParent : styles.bubbleTeacher,
                  deletingMessageId === item.id && styles.deletingMessage
                ]}>
                  {item.message_type === 'image' ? (
                    <TouchableOpacity 
                      onPress={() => handleImageDownload(item.file_url, item.file_name)}
                      activeOpacity={0.8}
                    >
                      <Image source={{ uri: item.file_url }} style={styles.chatImage} />
                      <View style={styles.downloadOverlay}>
                        <Ionicons name="download" size={16} color="#fff" />
                      </View>
                    </TouchableOpacity>
                  ) : item.message_type === 'file' ? (
                    <View style={styles.fileRow}>
                      <Ionicons name="document" size={20} color="#1976d2" style={{ marginRight: 6 }} />
                      <Text style={styles.fileName}>{item.file_name || 'Attachment'}</Text>
                    </View>
                  ) : (
                    <Text style={styles.messageText}>
                      {item.message && item.message.trim().length > 0
                        ? item.message
                        : item.message_type === 'image'
                          ? '📷 Photo'
                          : item.message_type === 'file'
                            ? '📎 Attachment'
                            : '[Attachment]'}
                    </Text>
                  )}
                  <Text style={styles.messageTime}>{formatToLocalTime(item.sent_at)}</Text>
                </View>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.chatList}
          />
          <View style={styles.inputRow}>
            <TouchableOpacity style={styles.attachBtn} onPress={handleAttach} disabled={sending}>
              <Ionicons name="attach" size={22} color="#1976d2" />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder="Type a message..."
              value={input}
              onChangeText={setInput}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              editable={!sending}
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
            
            <View style={styles.attachmentOptions}>
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
            </View>
          </Animatable.View>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  teacherListContainer: { flex: 1 },
  
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
  
  // Enhanced Teacher Card Styles
  teacherCard: { 
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
  classTeacherCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    backgroundColor: '#f8fff8',
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
    backgroundColor: '#fff8f8',
    elevation: 4,
    shadowColor: '#f44336',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  
  teacherAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1976d2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  unreadAvatar: {
    borderWidth: 3,
    borderColor: '#f44336',
    elevation: 2,
  },
  unreadDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#f44336',
    borderWidth: 2,
    borderColor: '#fff',
  },
  
  teacherInfo: {
    flex: 1,
    paddingRight: 12,
    minWidth: 0, // Allow text to shrink
  },
  
  teacherHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
    flexWrap: 'wrap', // Allow wrapping on small screens
  },
  
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    minWidth: 50,
    alignItems: 'center',
    marginLeft: 8, // Add margin to prevent overlap
    flexShrink: 0, // Prevent badge from shrinking
  },
  
  roleBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  
  teacherName: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#222',
    flex: 1, // Allow name to take available space
    marginRight: 8, // Ensure spacing from badge
  },
  unreadText: {
    fontWeight: 'bold',
    color: '#222',
  },
  teacherSubject: { 
    fontSize: 14, 
    color: '#666', 
    marginTop: 2,
    flexShrink: 1, // Allow subject to shrink if needed
  },
  
  chatActions: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40, // Ensure minimum width for touch target
    marginLeft: 8, // Add margin to prevent overlap
  },
  
  // Message Status Display
  messageStatusContainer: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  unreadMessagesText: {
    fontSize: 13,
    color: '#f44336',
    fontWeight: '600',
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  allReadText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
    fontStyle: 'italic',
  },
  noMessagesText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  readIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  newChatIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  unreadBadgeContainer: {
    backgroundColor: '#f44336',
    borderRadius: 14,
    minWidth: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    elevation: 2,
    shadowColor: '#f44336',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  unreadBadgeMainText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
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
  chatHeaderInfo: {
    flex: 1,
    marginRight: 8,
  },
  chatHeaderName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 2,
  },
  chatHeaderSubject: {
    fontSize: 14,
    color: '#666',
    marginTop: 0,
  },
  chatList: { flexGrow: 1, padding: 16 },
  messageRow: { flexDirection: 'row', marginBottom: 10 },
  messageLeft: { justifyContent: 'flex-start' },
  messageRight: { justifyContent: 'flex-end' },
  messageBubble: { maxWidth: '75%', padding: 12, borderRadius: 16 },
  bubbleParent: { backgroundColor: '#e3f2fd', alignSelf: 'flex-end' },
  bubbleTeacher: { backgroundColor: '#f1f8e9', alignSelf: 'flex-start' },
  messageText: { fontSize: 15, color: '#222' },
  messageTime: { fontSize: 11, color: '#888', marginTop: 4, textAlign: 'right' },
  inputRow: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#eee' },
  attachBtn: { marginRight: 8 },
  input: { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, fontSize: 15, marginRight: 8 },
  sendBtn: { backgroundColor: '#1976d2', borderRadius: 20, padding: 10 },
  chatImage: {
    width: 160,
    height: 120,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: '#eee',
  },
  fileContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    minWidth: 200,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileInfo: {
    flex: 1,
    marginLeft: 10,
  },
  fileName: {
    color: '#1976d2',
    fontSize: 14,
    fontWeight: '600',
  },
  fileSize: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  deletingMessage: {
    opacity: 0.5,
  },
  
  // Unread message styles
  unreadTeacherCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
    backgroundColor: '#fff8f8',
    shadowColor: '#f44336',
    shadowOpacity: 0.15,
    elevation: 3,
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
  
  // Animation and deleting overlay styles
  deletingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(244, 67, 54, 0.8)',
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
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
  
  // Image download overlay
  downloadOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    padding: 4,
    minWidth: 24,
    minHeight: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default StudentChatWithTeacher;