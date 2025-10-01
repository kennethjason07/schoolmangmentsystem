import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Alert, Keyboard, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import * as DocumentPicker from 'expo-document-picker';
import Header from '../../components/Header';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../utils/AuthContext';
import { supabase, TABLES } from '../../utils/supabase';
import { getCachedTenantId } from '../../utils/tenantHelpers';
import { getGlobalMessageHandler } from '../../utils/realtimeMessageHandler';
import { useMessageStatus, getUnreadCountFromSender } from '../../utils/useMessageStatus';
import { formatToLocalTime } from '../../utils/timeUtils';
import { uploadChatFile, formatFileSize, getFileIcon, isSupportedFileType } from '../../utils/chatFileUpload';
import { badgeNotifier } from '../../utils/badgeNotifier';
import { testRealtimeConnection, testUserFilteredConnection, insertTestMessage } from '../../utils/testRealtime';
import ImageViewer from '../../components/ImageViewer';
import { useParentAuth } from '../../hooks/useParentAuth'; // Import parent auth hook
import { getTeacherUserId } from './teacherUserIdHelper'; // Import teacher user ID helper
import ChatBadgeDebugger from '../../utils/chatBadgeDebugger'; // Import chat badge debugger

// Debug mode constant for parent chat
const DEBUG_MODE = __DEV__ && true; // Enable debug logging in development

const ChatWithTeacher = () => {
  const { user } = useAuth();
  const { markMessagesAsRead } = useMessageStatus();
  
  // Add parent context integration
  const { 
    isParent, 
    parentStudents, 
    directParentMode, 
    loading: parentLoading, 
    error: parentError 
  } = useParentAuth(); // Use parent auth hook instead of tenant access
  
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
  const [realtimeTestCleanup, setRealtimeTestCleanup] = useState(null);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedImageData, setSelectedImageData] = useState(null);
  const flatListRef = useRef(null);
  
  // Add debug state for parent troubleshooting
  const [debugInfo, setDebugInfo] = useState({
    parentContext: null,
    teacherResolution: null,
    chatDataFetchStatus: null
  });

  // Fetch teachers assigned to the student with parent validation
  const fetchTeachersAndChats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🚀 === [PARENT-AWARE] STARTING TEACHER FETCH ===');
      console.log('👤 Current user:', user);
      
      // Enhanced parent validation
      
      // Check if parent context is still loading
      if (parentLoading) {
        console.log('🔄 [PARENT-AWARE] Parent context is loading, delaying chat data fetch...');
        return;
      }
      
      // If parent context is not loaded or user is not a parent
      if (!isParent) {
        console.error('❌ [PARENT-AWARE] Cannot resolve parent: User is not a parent');
        setError('This feature is only available for parents');
        setLoading(false);
        return;
      }

      // Get the first student from parent students
      const studentData = parentStudents && parentStudents.length > 0 ? parentStudents[0] : null;
      
      if (!studentData) {
        console.error('❌ [PARENT-AWARE] No student found for parent');
        setError('No student found for this parent account');
        setLoading(false);
        return;
      }

      console.log('📊 === [PARENT-AWARE] CHAT FETCH DEBUG ===');
      console.log('🔍 Debug Mode: ENABLED');
      console.log('👤 Parent User ID:', user?.id);
      console.log('👦 Student data:', studentData);
      console.log('⏰ Fetch Time:', new Date().toISOString());
      console.log('📧 User Email:', user?.email);
      
      setDebugInfo(prev => ({
        ...prev,
        parentContext: {
          user_id: user?.id,
          student_data: studentData,
          email: user?.email,
          fetch_time: new Date().toISOString()
        }
      }));

      console.log('👦 [PARENT-AWARE] Student data:', studentData);
      console.log('🏦 [PARENT-AWARE] Student class:', studentData.class_name, studentData.section);
      console.log('[PARENT-AWARE] Student class_id:', studentData.class_id);

      // Step 2: Get all existing messages for this parent user
      const { data: allMessages, error: msgError } = await supabase
        .from('messages')
        .select('id, sender_id, receiver_id, student_id, message, sent_at, is_read, message_type, file_url, file_name, file_size, file_type')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('sent_at', { ascending: true });

      console.log('💬 Messages query:', { count: allMessages?.length, error: msgError });

      // Step 3: Group messages by teacher user ID (the other participant)
      const messagesByTeacherUserId = {};
      if (allMessages && allMessages.length > 0) {
        allMessages.forEach(msg => {
          const teacherUserId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
          if (!messagesByTeacherUserId[teacherUserId]) {
            messagesByTeacherUserId[teacherUserId] = [];
          }
          messagesByTeacherUserId[teacherUserId].push({
            ...msg,
            text: msg.message,
            timestamp: formatToLocalTime(msg.sent_at),
            sender: msg.sender_id === user.id ? 'parent' : 'teacher'
          });
        });
      }

      console.log('📊 Messages grouped by teacher:', Object.keys(messagesByTeacherUserId).length);

      // Step 4: Get teachers assigned to this specific class
      const uniqueTeachers = [];
      const seen = new Set();
      const studentClassId = studentData.class_id;
      
      console.log('🔍 Finding teachers for class:', studentClassId);
      console.log('🎯 Class:', studentData.class_name, studentData.section);
      
      // Method 1: Get class teacher from classes table using proper join
      console.log('[PARENT-AWARE] Fetching class teacher via classes table for class_id:', studentClassId);
      const { data: classInfo, error: classInfoError } = await supabase
        .from(TABLES.CLASSES)
        .select(`
          id,
          class_name,
          section,
          class_teacher_id,
          teachers (
            id,
            name,
            qualification,
            phone
          )
        `)
        .eq('id', studentClassId)
        .single();
      
      if (!classInfoError && classInfo && classInfo.teachers) {
        console.log('Found class info with teacher:', classInfo);
        
        // Add class teacher if available
        if (classInfo.teachers.id && classInfo.teachers.name) {
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
              className: `${studentData.class_name} ${studentData.section}`,
              studentName: studentData.name,
              messages: messagesByTeacherUserId[teacherUserId] || [],
              lastMessageTime: messagesByTeacherUserId[teacherUserId]?.length > 0 ?
                messagesByTeacherUserId[teacherUserId][messagesByTeacherUserId[teacherUserId].length - 1].sent_at : null,
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
              className: `${studentData.class_name} ${studentData.section}`,
              studentName: studentData.name,
              messages: [],
              lastMessageTime: null,
              canMessage: false,
              hasUserAccount: false,
              error: 'This teacher does not have a user account for messaging'
            });
            seen.add(classInfo.teachers.id);
          }
        }
      } else {
        console.log('Class info fetch error or no teacher:', classInfoError, classInfo);
      }
      
      // Method 2: Get subject teachers via teacher_subjects and subjects tables
      console.log('[PARENT-AWARE] Fetching subject teachers for class_id:', studentClassId);
      
      // First, get all subjects for this specific class
      const { data: classSubjects, error: classSubjectsError } = await supabase
        .from(TABLES.SUBJECTS)
        .select('id, name, class_id, academic_year')
        .eq('class_id', studentClassId);
      
      console.log('Class subjects:', classSubjects, 'Error:', classSubjectsError);
      
      if (!classSubjectsError && classSubjects && classSubjects.length > 0) {
        // For each subject, find the assigned teachers
        for (const subject of classSubjects) {
          console.log('[PARENT-AWARE] Finding teachers for subject:', subject.name, 'ID:', subject.id);
          
          // Get teachers assigned to this subject
          const { data: teacherAssignments, error: teacherError } = await supabase
            .from(TABLES.TEACHER_SUBJECTS)
            .select(`
              teacher_id,
              teachers (
                id,
                name,
                qualification,
                phone
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
                    className: `${studentData.class_name} ${studentData.section}`,
                    studentName: studentData.name,
                    messages: messagesByTeacherUserId[teacherUserId] || [],
                    lastMessageTime: messagesByTeacherUserId[teacherUserId]?.length > 0 ?
                      messagesByTeacherUserId[teacherUserId][messagesByTeacherUserId[teacherUserId].length - 1].sent_at : null,
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
                    className: `${studentData.class_name} ${studentData.section}`,
                    studentName: studentData.name,
                    messages: [],
                    lastMessageTime: null,
                    canMessage: false,
                    hasUserAccount: false,
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
      
      console.log('Final teachers list:', uniqueTeachers);
      
      // If STILL no teachers found, this means the database doesn't have any teachers
      if (uniqueTeachers.length === 0) {
        console.log('No teachers found at all in the database for class', studentClassId);
        
        // Get class info for debugging
        const { data: classDebugInfo, error: classDebugError } = await supabase
          .from(TABLES.CLASSES)
          .select('*')
          .eq('id', studentClassId)
          .single();
        
        console.log('Student class debug info:', classDebugInfo, classDebugError);
        
        setError(`No teachers found for your child's class. \n\nDebug Info:\nStudent Class ID: ${studentClassId}\nClass Name: ${classDebugInfo?.class_name || 'N/A'}\nSection: ${classDebugInfo?.section || 'N/A'}\nClass Teacher ID: ${classDebugInfo?.class_teacher_id || 'N/A'}\n\nPlease contact the school administrator to assign teachers.`);
        return;
      }

      setTeachers(uniqueTeachers);
      
      // Step 5: Fetch unread counts for each teacher
      await fetchUnreadCounts(uniqueTeachers);
      
    } catch (err) {
      console.error('💥 Error in fetchTeachersAndChats:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch unread message counts for all teachers
  const fetchUnreadCounts = async (teachersList) => {
    try {
      const counts = {};
      
      for (const teacher of teachersList) {
        if (teacher.userId && teacher.userId !== user.id) {
          const count = await getUnreadCountFromSender(teacher.userId, user.id);
          counts[teacher.userId] = count;
          console.log(`📊 Unread count for ${teacher.name} (${teacher.userId}): ${count}`);
        }
      }
      
      console.log('📊 Final unread counts:', counts);
      setUnreadCounts(counts);
    } catch (error) {
      console.log('Error fetching unread counts:', error);
    }
  };

  

  // Set up real-time message subscription using RealtimeMessageHandler
  const messageHandler = getGlobalMessageHandler(supabase, TABLES.MESSAGES);
  
  useEffect(() => {
    if (!selectedTeacher || !selectedTeacher.userId) return;
    
    console.log('🔔 Setting up RealtimeMessageHandler subscription for:', {
      userId: user.id,
      teacherUserId: selectedTeacher.userId,
      teacherName: selectedTeacher.name
    });
    
    // Setup real-time subscription with message updates using the same pattern as TeacherChat.js
    const subscription = messageHandler.startSubscription(
      user.id,
      selectedTeacher.userId,
      (message, eventType) => {
        console.log('📨 Parent Chat - Real-time message update:', { message, eventType });
        
        if (eventType === 'sent' || eventType === 'received' || eventType === 'updated') {
          // Update messages state
          setMessages(prev => {
            // Remove any existing message with the same ID
            const filtered = prev.filter(m => m.id !== message.id);
            // Add the new/updated message and sort by timestamp
            const formattedMessage = {
              ...message,
              text: message.message,
              timestamp: formatToLocalTime(message.sent_at),
              sender: message.sender_id === user.id ? 'parent' : 'teacher'
            };
            const updated = [...filtered, formattedMessage].sort((a, b) => 
              new Date(a.sent_at || a.created_at) - new Date(b.sent_at || b.created_at)
            );
            return updated;
          });
          
          // Mark messages as read if they're from the teacher
          if (message.sender_id === selectedTeacher.userId && !message.is_read) {
            console.log('📖 Parent Chat: Marking message as read in real-time handler');
            markMessagesAsRead(selectedTeacher.userId).then((result) => {
              if (result?.success) {
                console.log('✅ Parent Chat: Messages marked as read successfully, notifying badge system');
                badgeNotifier.notifyMessagesRead(user.id, selectedTeacher.userId);
              } else {
                console.log('❌ Parent Chat: Failed to mark messages as read:', result?.error);
              }
            });
            
            setUnreadCounts(prev => {
              const updated = { ...prev };
              delete updated[selectedTeacher.userId];
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
        
        // Update unread counts if message is from teacher to parent (not in current chat)
        if (message.sender_id !== user.id && message.receiver_id === user.id) {
          console.log('📬 Parent Chat: Updating unread count for sender:', message.sender_id);
          setUnreadCounts(prev => {
            const newCount = (prev[message.sender_id] || 0) + 1;
            console.log(`📊 Parent Chat: Teacher ${message.sender_id} unread count: ${prev[message.sender_id] || 0} -> ${newCount}`);
            return {
              ...prev,
              [message.sender_id]: newCount
            };
          });
        }
      }
    );
    
    return () => {
      messageHandler.stopSubscription();
    };
  }, [selectedTeacher?.userId, user.id, messageHandler, markMessagesAsRead]);

  // Reset teacher selection and messages on screen focus with parent-aware initialization
  useFocusEffect(
    React.useCallback(() => {
      setSelectedTeacher(null);
      setMessages([]);
      if (user && !parentLoading) {
        console.log('🔄 [PARENT-AWARE] Parent context loaded, initializing chat data...');
        fetchTeachersAndChats();
      } else if (parentLoading) {
        console.log('🔄 [PARENT-AWARE] Parent context is loading, waiting for initialization...');
      } else if (user) {
        console.log('🔄 [PARENT-AWARE] User available, initializing chat data...');
        fetchTeachersAndChats();
      }
    }, [user, parentLoading, parentStudents])
  );

  // Select a teacher and load chat
  const handleSelectTeacher = async (teacher) => {
    console.log('Selected teacher:', teacher);
    console.log('Teacher role:', teacher.role);
    console.log('Teacher userId:', teacher.userId);
    console.log('Teacher messages:', teacher.messages?.length || 0);
    console.log('Teacher has user account:', teacher.hasUserAccount !== false);

    setSelectedTeacher(teacher);
    setMessages(teacher.messages || []);
    
    // Only handle read status if teacher has a user account
    if (teacher.userId && teacher.userId !== user.id && teacher.hasUserAccount !== false) {
      console.log('📖 Parent Chat: Selecting teacher, marking messages as read');
      const result = await markMessagesAsRead(teacher.userId);
      
      if (result?.success) {
        console.log('✅ Parent Chat: Messages marked as read on teacher select, notifying badge system');
        // Notify badge system that messages were read
        badgeNotifier.notifyMessagesRead(user.id, teacher.userId);
        
        // Clear unread count for this teacher immediately
        setUnreadCounts(prev => ({
          ...prev,
          [teacher.userId]: 0
        }));
        
        // Refresh unread counts after a short delay to ensure database is updated
        setTimeout(() => {
          console.log('🔄 Parent Chat: Refreshing unread counts after marking as read');
          fetchUnreadCounts([teacher]);
        }, 1000);
      } else {
        console.log('❌ Parent Chat: Failed to mark messages as read on teacher select:', result?.error);
      }
    }
    
    // Show warning if teacher doesn't have user account
    if (teacher.hasUserAccount === false) {
      Alert.alert(
        'Teacher Account Notice',
        `${teacher.name} doesn't have a user account yet, so you can't send messages to them. Please contact the school administrator to set up their account.`,
        [{ text: 'OK' }]
      );
    }
  };

  // Send a message with optimistic UI using RealtimeMessageHandler and parent validation
  const handleSend = async () => {
    if (!input.trim() || !selectedTeacher || sending) return;
    
    const messageText = input.trim();
    
    // Clear input immediately for better UX
    setInput('');
    setSending(true);
    
    try {
      console.log('[PARENT-AWARE] Starting to send message...');
      console.log('[PARENT-AWARE] User ID:', user.id);
      console.log('[PARENT-AWARE] Selected Teacher:', selectedTeacher);
      
      // Parent validation before sending
      if (!isParent) {
        throw new Error('Unable to determine parent context. Please try again.');
      }

      // Get parent's linked student ID using parent context
      if (!parentStudents || parentStudents.length === 0) {
        throw new Error('No student linked to parent account');
      }
      
      const parentStudent = parentStudents[0]; // Get first student

      // Get teacher's user ID using our enhanced helper function
      const teacherUserId = selectedTeacher.userId || await getTeacherUserId(selectedTeacher.id);

      if (!teacherUserId) {
        throw new Error('Teacher user account not found. Please contact admin to ensure teacher has a user account.');
      }

      // Determine tenant_id for RLS
      let tenantId = getCachedTenantId();
      if (!tenantId) {
        // Fallback: fetch from users table
        const { data: currentUserData } = await supabase
          .from(TABLES.USERS)
          .select('tenant_id')
          .eq('id', user.id)
          .single();
        tenantId = currentUserData?.tenant_id;
        if (!tenantId) {
          throw new Error('Tenant context not available. Please try again.');
        }
      }

      // Prepare message data for the handler
      const messageData = {
        sender_id: user.id,
        receiver_id: teacherUserId,
        student_id: parentStudent.id,
        message: messageText,
        message_type: 'text',
        tenant_id: tenantId
      };
      
      // Use the message handler for optimistic UI and reliable sending
      await messageHandler.sendMessageOptimistic(
        messageData,
        // Optimistic update callback
        (optimisticMessage) => {
          console.log('⚡ Parent Chat - Adding optimistic message to UI:', optimisticMessage);
          setMessages(prev => {
            const updated = [...prev, {
              ...optimisticMessage,
              text: optimisticMessage.message,
              timestamp: formatToLocalTime(optimisticMessage.sent_at),
              sender: 'parent'
            }].sort((a, b) => 
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
          console.log('✅ Parent Chat - Message confirmed, replacing optimistic:', { tempId, confirmedMessage });
          setMessages(prev => prev.map(msg => 
            msg.id === tempId ? {
              ...confirmedMessage,
              text: confirmedMessage.message,
              timestamp: formatToLocalTime(confirmedMessage.sent_at),
              sender: 'parent'
            } : msg
          ));
          
          // Notify badge system that a new message was sent (for the receiver)
          badgeNotifier.notifyNewMessage(teacherUserId, user.id);
        },
        // Error callback
        (tempId, failedMessage, error) => {
          console.error('❌ Parent Chat - Message failed:', { tempId, error });
          // Update message to show failed state
          setMessages(prev => prev.map(msg => 
            msg.id === tempId ? { 
              ...failedMessage, 
              failed: true,
              text: failedMessage.message,
              timestamp: formatToLocalTime(failedMessage.sent_at),
              sender: 'parent'
            } : msg
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

  // Attachment handler
  const handleAttach = async () => {
    Alert.alert(
      'Select Attachment',
      'Choose what you want to attach',
      [
        {
          text: 'Photos',
          onPress: handleImageUpload
        },
        {
          text: 'Documents',
          onPress: handleDocumentUpload
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  // Handle image upload with chat-files storage
  const handleImageUpload = async () => {
    setShowAttachmentMenu(false);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to access your photo library.');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'Images',
        allowsEditing: false,
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
          sender: 'parent',
          uploading: true
        };
        
        setMessages(prev => [...prev, tempMsg]);
        
        // Get parent's linked student ID from parent context
        if (!parentStudents || parentStudents.length === 0) {
          throw new Error('No student linked to parent account');
        }
        
        const parentStudent = parentStudents[0]; // Get first student

        // Upload to chat-files bucket
        const uploadResult = await uploadChatFile(
          {
            uri: asset.uri,
            name: asset.fileName || `photo_${Date.now()}.jpg`,
            size: asset.fileSize,
            type: 'image/jpeg'
          },
          user.id,
          selectedTeacher.userId,
          parentStudent.id
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
                    sender: 'parent'
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
          sender: 'parent',
          uploading: true
        };
        
        setMessages(prev => [...prev, tempMsg]);
        
        // Get parent's linked student ID from parent context
        if (!parentStudents || parentStudents.length === 0) {
          throw new Error('No student linked to parent account');
        }
        
        const parentStudent = parentStudents[0]; // Get first student

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
          selectedTeacher.userId,
          parentStudent.id
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
                    sender: 'parent'
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
      // Get parent's linked student ID from parent context
      if (!parentStudents || parentStudents.length === 0) {
        throw new Error('No student linked to parent account');
      }
      
      const parentStudent = parentStudents[0]; // Get first student

      // Get teacher's user ID
      const teacherUserId = selectedTeacher.userId || await getTeacherUserId(selectedTeacher.id);

      if (!teacherUserId) {
        throw new Error('Teacher user account not found');
      }

      // Create message with file data
      const newMsg = {
        sender_id: user.id,
        receiver_id: teacherUserId,
        student_id: parentStudent.id,
        message: fileData.message_type === 'image' ? '📷 Photo' : `📎 ${fileData.file_name}`,
        message_type: fileData.message_type,
        file_url: fileData.file_url,
        file_name: fileData.file_name,
        file_size: fileData.file_size,
        file_type: fileData.file_type,
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
        timestamp: formatToLocalTime(new Date().toISOString()),
        sender: 'parent'
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

  // Sort teachers by role priority (class teacher first) and then by most recent chat
  const getSortedTeachers = () => {
    return [...teachers].sort((a, b) => {
      // First priority: Class teachers and "both" role teachers come first
      const aRolePriority = a.role === 'class_teacher' ? 0 : a.role === 'both' ? 1 : 2;
      const bRolePriority = b.role === 'class_teacher' ? 0 : b.role === 'both' ? 1 : 2;

      if (aRolePriority !== bRolePriority) {
        return aRolePriority - bRolePriority;
      }

      // Second priority: Most recent message timestamp
      const aMsgs = a.messages || [];
      const bMsgs = b.messages || [];
      const aTime = aMsgs.length ? new Date(aMsgs[aMsgs.length - 1].sent_at || aMsgs[aMsgs.length - 1].created_at) : new Date(0);
      const bTime = bMsgs.length ? new Date(bMsgs[bMsgs.length - 1].sent_at || bMsgs[bMsgs.length - 1].created_at) : new Date(0);

      return bTime - aTime;
    });
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 100);
    }
  }, [messages]);

  // Auto-scroll when keyboard opens
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(() => {
        if (flatListRef.current && messages.length > 0) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 100);
    });

    return () => {
      keyboardDidShowListener?.remove();
    };
  }, [messages]);

  // Function to handle calling teacher
  const handleCallTeacher = (teacher) => {
    if (!teacher.phone || teacher.phone.trim() === '') {
      Alert.alert(
        'No Phone Number',
        `${teacher.name} does not have a phone number on file. Please contact the school administration to get their contact information.`,
        [{ text: 'OK' }]
      );
      return;
    }

    const phoneNumber = teacher.phone.replace(/\D/g, ''); // Remove non-digit characters
    const telURL = `tel:${phoneNumber}`;

    Alert.alert(
      'Call Teacher',
      `Do you want to call ${teacher.name}?\nPhone: ${teacher.phone}`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Call',
          onPress: () => {
            Linking.openURL(telURL).catch((err) => {
              console.error('Failed to open dialer:', err);
              Alert.alert(
                'Cannot Make Call',
                'Your device does not support making phone calls or the phone app is not available.',
                [{ text: 'OK' }]
              );
            });
          }
        }
      ]
    );
  };

  // Delete message function
  const handleDeleteMessage = async (messageId) => {
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingMessageId(messageId);
              
              // Delete from database
              const { error } = await supabase
                .from(TABLES.MESSAGES)
                .delete()
                .eq('id', messageId);

              if (error) throw error;

              // Remove from local state with animation
              setTimeout(() => {
                setMessages(prev => prev.filter(msg => msg.id !== messageId));
                
                // Update teacher's messages as well
                setTeachers(prev => prev.map(teacher => {
                  if (teacher.id === selectedTeacher.id) {
                    return {
                      ...teacher,
                      messages: teacher.messages.filter(msg => msg.id !== messageId)
                    };
                  }
                  return teacher;
                }));
                
                setDeletingMessageId(null);
              }, 500);

            } catch (error) {
              console.error('Error deleting message:', error);
              setDeletingMessageId(null);
              Alert.alert('Error', 'Failed to delete message');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.container}>
          <Header title="Chat With Teacher" showBack={true} />
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1976d2" />
            <Text style={styles.loadingText}>Loading teachers...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.container}>
          <Header title="Chat With Teacher" showBack={true} />
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Error: {error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchTeachersAndChats}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <Header title="Chat With Teacher" showBack={true} />
      {!selectedTeacher ? (
        <View style={styles.teacherListContainer}>
          <View style={styles.headerSection}>
            <Text style={styles.sectionTitle}>Your Child's Teachers</Text>
            <Text style={styles.sectionSubtitle}>
              {teachers.length} teacher{teachers.length !== 1 ? 's' : ''} available for chat
            </Text>
            {teachers.length > 0 && (
              <View style={styles.classInfo}>
                <Ionicons name="school" size={16} color="#1976d2" />
                <Text style={styles.classInfoText}>
                  Class: {teachers[0]?.className || 'N/A'} • Student: {teachers[0]?.studentName || 'N/A'}
                </Text>
              </View>
            )}
          </View>
          {teachers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.noTeachersIcon}>
                <Ionicons name="people-outline" size={48} color="#9e9e9e" />
              </View>
              <Text style={styles.noTeachersTitle}>No Teachers Assigned</Text>
              <Text style={styles.noTeachersMessage}>
                Your child's teachers have not been assigned yet. Please contact the school administration for assistance.
              </Text>
              <TouchableOpacity
                style={styles.contactButton}
                onPress={() => {
                  // You can add functionality to open phone/email app here
                  Alert.alert(
                    'Contact Administration',
                    'Please contact the school office to have teachers assigned to your child\'s class.',
                    [{ text: 'OK' }]
                  );
                }}
              >
                <Ionicons name="call" size={16} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.contactButtonText}>Contact School</Text>
              </TouchableOpacity>
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
                const unreadCount = unreadCounts[item.userId] || 0;
                const hasUnread = unreadCount > 0;
                const hasMessages = item.messages && item.messages.length > 0;
                
                // Debug logging
                console.log(`🔍 Teacher: ${item.name}`);
                console.log(`   - userId: ${item.userId}`);
                console.log(`   - unreadCounts[${item.userId}]: ${unreadCounts[item.userId]}`);
                console.log(`   - unreadCount: ${unreadCount}`);
                console.log(`   - hasUnread: ${hasUnread}`);
                console.log(`   - hasMessages: ${hasMessages}`);
                console.log(`   - All unreadCounts:`, unreadCounts);

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
                    <TouchableOpacity style={[
                      styles.teacherCard,
                      item.role === 'class_teacher' && styles.classTeacherCard,
                      hasUnread && styles.unreadCard
                    ]} onPress={() => handleSelectTeacher(item)}>
                      <View style={[
                        styles.teacherAvatar,
                        { backgroundColor: item.role === 'class_teacher' ? '#4CAF50' :
                                          item.role === 'both' ? '#FF9800' : '#2196F3' },
                        hasUnread && styles.unreadAvatar
                      ]}>
                        <Ionicons
                          name={item.role === 'class_teacher' ? 'school' : item.role === 'both' ? 'star' : 'book'}
                          size={24}
                          color="#fff"
                        />
                        {hasUnread && (
                          <View style={styles.unreadDot} />
                        )}
                      </View>
                      <View style={styles.teacherInfo}>
                        <View style={styles.teacherHeader}>
                          <Text style={[
                            styles.teacherName,
                            hasUnread && styles.unreadText
                          ]}>
                            {item.name}
                          </Text>
                          <View style={[styles.roleBadge, {
                            backgroundColor: item.role === 'class_teacher' ? '#4CAF50' :
                                            item.role === 'both' ? '#FF9800' : '#2196F3'
                          }]}>
                            <Text style={styles.roleBadgeText}>
                              {item.role === 'class_teacher' ? 'CLASS' :
                               item.role === 'both' ? 'BOTH' : 'SUBJECT'}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.teacherSubject} numberOfLines={1}>
                          {item.subject || 'Teacher'}
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
                        {/* Call Button */}
                        <TouchableOpacity
                          style={styles.callButton}
                          onPress={() => handleCallTeacher(item)}
                          activeOpacity={0.7}
                        >
                          <Ionicons 
                            name="call" 
                            size={18} 
                            color={item.phone ? "#4CAF50" : "#ccc"} 
                          />
                        </TouchableOpacity>
                        
                        {/* Chat Icon */}
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
                        
                        <View style={styles.chevronContainer}>
                          <Ionicons name="chevron-forward" size={16} color="#ccc" />
                        </View>
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
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
        >
          <View style={styles.chatHeader}>
            <TouchableOpacity onPress={handleBack} style={{ marginRight: 10 }}>
              <Ionicons name="arrow-back" size={24} color="#1976d2" />
            </TouchableOpacity>
            <View style={[
              styles.teacherAvatar,
              { backgroundColor: selectedTeacher.role === 'class_teacher' ? '#4CAF50' :
                                selectedTeacher.role === 'both' ? '#FF9800' : '#2196F3',
                width: 40, height: 40, borderRadius: 20, marginRight: 12 }
            ]}>
              <Ionicons
                name={selectedTeacher.role === 'class_teacher' ? 'school' : selectedTeacher.role === 'both' ? 'star' : 'book'}
                size={20}
                color="#fff"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.chatHeaderName, { fontSize: 18, fontWeight: 'bold', color: '#222' }]}>
                {selectedTeacher.name}
              </Text>
              <Text style={[styles.chatHeaderSubject, { fontSize: 14, color: '#666' }]}>
                {selectedTeacher.subject}
              </Text>
            </View>
            {/* Call Button in Chat Header */}
            <TouchableOpacity
              style={styles.chatHeaderCallButton}
              onPress={() => handleCallTeacher(selectedTeacher)}
              activeOpacity={0.7}
            >
              <Ionicons 
                name="call" 
                size={20} 
                color={selectedTeacher.phone ? "#4CAF50" : "#ccc"} 
              />
            </TouchableOpacity>
            
            {/* Real-time Test Button */}
            <TouchableOpacity 
              style={styles.testButton}
              onPress={() => {
                Alert.alert(
                  'Real-time Test',
                  'Choose a test to run:',
                  [
                    {
                      text: 'Basic Test',
                      onPress: () => {
                        // Clean up any previous test
                        if (realtimeTestCleanup) {
                          realtimeTestCleanup();
                        }
                        // Start basic real-time test
                        const cleanup = testRealtimeConnection(user.id);
                        setRealtimeTestCleanup(cleanup);
                      }
                    },
                    {
                      text: 'Filtered Test',
                      onPress: () => {
                        // Clean up any previous test
                        if (realtimeTestCleanup) {
                          realtimeTestCleanup();
                        }
                        // Start filtered real-time test
                        const cleanup = testUserFilteredConnection(user.id);
                        setRealtimeTestCleanup(cleanup);
                      }
                    },
                    {
                      text: 'Insert Test Message',
                      onPress: async () => {
                        try {
                          await insertTestMessage(user.id);
                          Alert.alert('Success', 'Test message inserted! Check console for real-time events.');
                        } catch (error) {
                          Alert.alert('Error', 'Failed to insert test message: ' + error.message);
                        }
                      }
                    },
                    {
                      text: 'Cancel',
                      style: 'cancel'
                    }
                  ]
                );
              }}
            >
              <Ionicons name="bug" size={18} color="#ff9800" />
            </TouchableOpacity>
          </View>
          
          <FlatList
            ref={flatListRef}
            data={[...messages]}
            keyExtractor={item => item.id}
            maintainVisibleContentPosition={{
              minIndexForVisible: 0,
              autoscrollToTopThreshold: 10,
            }}
            renderItem={({ item }) => (
              <TouchableOpacity
                onLongPress={() => {
                  if (item.sender === 'parent' || item.sender_id === user.id) {
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
                <Animatable.View 
                  style={[styles.messageRow, (item.sender === 'parent' || item.sender_id === user.id) ? styles.messageRight : styles.messageLeft]}
                  animation="fadeInUp"
                  duration={300}
                >
                  <View style={[styles.messageBubble, (item.sender === 'parent' || item.sender_id === user.id) ? styles.bubbleParent : styles.bubbleTeacher]}>
                    {deletingMessageId === item.id && (
                      <Animatable.View 
                        style={styles.deletingOverlay}
                        animation="fadeIn"
                        duration={200}
                      >
                        <ActivityIndicator size="small" color="#fff" />
                        <Ionicons name="trash" size={16} color="#fff" style={{ marginLeft: 5 }} />
                      </Animatable.View>
                    )}
                    
                    {/* Image Messages */}
                    {item.message_type === 'image' && item.file_url && (
                      <TouchableOpacity onPress={() => {
                        console.log('📱 Image tapped! Item data:', {
                          id: item.id,
                          message_type: item.message_type,
                          file_url: item.file_url,
                          file_name: item.file_name,
                          file_size: item.file_size,
                          fullItem: item
                        });
                        
                        // Open image in full screen viewer with download functionality
                        const imageData = {
                          file_url: item.file_url,
                          file_name: item.file_name || 'image.jpg',
                          file_size: item.file_size
                        };
                        
                        console.log('📱 Setting image data:', imageData);
                        setSelectedImageData(imageData);
                        setShowImageViewer(true);
                      }}>
                        <Image 
                          source={{ uri: item.file_url }} 
                          style={styles.chatImage}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    )}
                    
                    {/* File Messages */}
                    {item.message_type === 'file' && (
                      <TouchableOpacity 
                        style={styles.fileContainer}
                        onPress={() => {
                          if (item.file_url) {
                            Linking.openURL(item.file_url).catch(() => {
                              Alert.alert('Error', 'Cannot open this file');
                            });
                          }
                        }}
                      >
                        <View style={styles.fileRow}>
                          <Ionicons name="document" size={24} color="#1976d2" />
                          <View style={styles.fileInfo}>
                            <Text style={styles.fileName} numberOfLines={1}>
                              {item.file_name || 'Document'}
                            </Text>
                            {item.file_size && (
                              <Text style={styles.fileSize}>
                                {item.file_size > 1024 * 1024 
                                  ? `${(item.file_size / (1024 * 1024)).toFixed(1)} MB`
                                  : `${(item.file_size / 1024).toFixed(1)} KB`
                                }
                              </Text>
                            )}
                          </View>
                          <Ionicons name="download" size={20} color="#666" />
                        </View>
                      </TouchableOpacity>
                    )}
                    
                    {/* Text Messages */}
                    {(!item.message_type || item.message_type === 'text') && (
                      <Text style={[styles.messageText, { opacity: deletingMessageId === item.id ? 0.3 : 1 }]}>
                        {item.text || item.message}
                      </Text>
                    )}
                    
                    <Text style={[styles.messageTime, { opacity: deletingMessageId === item.id ? 0.3 : 1 }]}>
                      {item.timestamp || formatToLocalTime(item.sent_at)}
                    </Text>
                  </View>
                </Animatable.View>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.chatList}
            style={{ flex: 1 }}
            onContentSizeChange={() => {
              setTimeout(() => {
                if (flatListRef.current) {
                  flatListRef.current.scrollToEnd({ animated: true });
                }
              }, 50);
            }}
            onLayout={() => {
              setTimeout(() => {
                if (flatListRef.current && messages.length > 0) {
                  flatListRef.current.scrollToEnd({ animated: false });
                }
              }, 50);
            }}
          />
          
          <View style={styles.inputRow}>
            <TouchableOpacity style={styles.attachBtn} onPress={handleAttach}>
              <Ionicons name="attach" size={22} color="#1976d2" />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder="Type a message..."
              value={input}
              onChangeText={setInput}
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />
            <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
              <Ionicons name="send" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
      {/* WhatsApp-style Attachment Menu with Animations */}
      {showAttachmentMenu && (
        <Animatable.View 
          style={styles.attachmentOverlay}
          animation="fadeIn"
          duration={200}
        >
          <TouchableOpacity 
            style={styles.attachmentBackdrop} 
            onPress={() => setShowAttachmentMenu(false)}
            activeOpacity={1}
          />
          <Animatable.View 
            style={styles.attachmentMenu}
            animation="slideInUp"
            duration={300}
            delay={100}
          >
            <Animatable.View
              animation="bounceIn"
              delay={200}
              duration={400}
            >
              <TouchableOpacity 
                style={[styles.attachmentOption, { backgroundColor: '#7C4DFF' }]}
                onPress={handleDocumentUpload}
              >
                <Ionicons name="document" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.attachmentText}>Document</Text>
            </Animatable.View>
            
            <Animatable.View
              animation="bounceIn"
              delay={300}
              duration={400}
            >
              <TouchableOpacity 
                style={[styles.attachmentOption, { backgroundColor: '#FF5722' }]}
                onPress={handleImageUpload}
              >
                <Ionicons name="camera" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.attachmentText}>Photos</Text>
            </Animatable.View>
          </Animatable.View>
        </Animatable.View>
      )}
      
      {/* Image Viewer Modal with Download Functionality */}
      <ImageViewer
        visible={showImageViewer}
        imageData={selectedImageData}
        onClose={() => {
          setShowImageViewer(false);
          setSelectedImageData(null);
        }}
      />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  teacherListContainer: { flex: 1 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1976d2', margin: 16 },
  teacherCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 12, elevation: 2 },
  teacherName: { fontSize: 16, fontWeight: 'bold', color: '#222' },
  teacherSubject: { fontSize: 14, color: '#666' },
  lastMessage: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  messageCount: {
    fontSize: 10,
    color: '#9c27b0',
    marginTop: 2,
    fontWeight: 'bold',
  },
  chatHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderBottomWidth: 1, borderColor: '#eee' },
  chatList: { flexGrow: 1, justifyContent: 'flex-end', padding: 16 },
  messageRow: { flexDirection: 'row', marginBottom: 10 },
  messageLeft: { justifyContent: 'flex-start' },
  messageRight: { justifyContent: 'flex-end' },
  messageBubble: { maxWidth: '75%', padding: 12, borderRadius: 16 },
  bubbleParent: { backgroundColor: '#e3f2fd', alignSelf: 'flex-end' },
  bubbleTeacher: { backgroundColor: '#f1f8e9', alignSelf: 'flex-start' },
  messageText: { fontSize: 15, color: '#222' },
  messageTime: { fontSize: 11, color: '#888', marginTop: 4, textAlign: 'right' },
  inputRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 10, 
    backgroundColor: '#fff', 
    borderTopWidth: 1, 
    borderColor: '#eee',
    paddingBottom: Platform.OS === 'ios' ? 34 : 10,
  },
  attachBtn: { marginRight: 8 },
  input: { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, fontSize: 15, marginRight: 8 },
  sendBtn: { backgroundColor: '#1976d2', borderRadius: 20, padding: 10 },
  chatImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
    marginBottom: 8,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  deletingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(244, 67, 54, 0.8)',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  attachmentOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingRight: 20,
    paddingBottom: 80,
    zIndex: 1000,
  },
  attachmentBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  attachmentMenu: {
    alignItems: 'center',
  },
  attachmentOption: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  attachmentText: {
    color: '#fff',
    fontSize: 10,
    marginTop: -5,
    marginBottom: 15,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Enhanced Teacher Card Styles
  teacherAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1976d2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  teacherInfo: {
    flex: 1,
    paddingRight: 8,
  },
  teacherHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
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
  teacherQualification: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  lastMessageTime: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    fontStyle: 'italic',
  },
  chatActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 8,
    minWidth: 80,
  },
  messageIndicator: {
    alignItems: 'center',
    marginBottom: 4,
  },
  messageCountBadge: {
    backgroundColor: '#9c27b0',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },

  // Header Section Styles
  headerSection: {
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  classInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  classInfoText: {
    fontSize: 13,
    color: '#1976d2',
    marginLeft: 6,
    fontWeight: '500',
  },

  // Section Header Styles
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Enhanced Teacher Card Styles
  classTeacherCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    backgroundColor: '#f8fff8',
  },

  // Empty State Styles
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  // No Teachers Assigned Styles
  noTeachersIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  noTeachersTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#424242',
    textAlign: 'center',
    marginBottom: 8,
  },
  noTeachersMessage: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 32,
    marginBottom: 24,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1976d2',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    elevation: 2,
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  contactButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Unread Message Indicators
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
  unreadText: {
    fontWeight: 'bold',
    color: '#222',
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
    zIndex: 1,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
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
  
  // Chat Icon Container for badge positioning
  chatIconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Test button for real-time debugging
  testButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
    marginLeft: 8,
  },

  // Call Button Styles
  callButton: {
    padding: 8,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  chatHeaderCallButton: {
    padding: 10,
    marginRight: 8,
    borderRadius: 25,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Chevron Container
  chevronContainer: {
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 20,
  },
});


export default ChatWithTeacher; 
