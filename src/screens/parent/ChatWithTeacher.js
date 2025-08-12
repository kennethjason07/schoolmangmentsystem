import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Alert, Keyboard, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import * as DocumentPicker from 'expo-document-picker';
import Header from '../../components/Header';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../utils/AuthContext';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';
import { useMessageStatus, getUnreadCountFromSender } from '../../utils/useMessageStatus';

const ChatWithTeacher = () => {
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

  // Helper function to get teacher's user ID (exact copy from student logic)
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

  // Fetch teachers assigned to the student (exact copy of student logic)
  const fetchTeachersAndChats = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🚀 === STARTING TEACHER FETCH (PARENT VERSION) ===');
      console.log('👤 Current user:', user);

      // Step 1: Get parent user data and linked student
      const { data: parentData, error: parentError } = await supabase
        .from(TABLES.USERS)
        .select(`
          *,
          students!users_linked_parent_of_fkey(
            id,
            name,
            class_id,
            classes(id, class_name, section)
          )
        `)
        .eq('id', user.id)
        .single();

      console.log('👪 Parent query result:', { parentData, parentError });

      if (parentError || !parentData?.linked_parent_of) {
        throw new Error('Parent account is not linked to any student. Please contact the administrator.');
      }

      const student = parentData.students;
      if (!student) {
        throw new Error('Student information not found.');
      }

      console.log('👦 Student data:', student);
      console.log('🏫 Student class:', student.classes);
      console.log('Student class_id:', student.class_id);

      // Step 2: Get all existing messages for this parent user
      const { data: allMessages, error: msgError } = await supabase
        .from('messages')
        .select('*')
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
            timestamp: new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            sender: msg.sender_id === user.id ? 'parent' : 'teacher'
          });
        });
      }

      console.log('📊 Messages grouped by teacher:', Object.keys(messagesByTeacherUserId).length);

      // Step 4: Get teachers assigned to this specific class (using same logic as student)
      const uniqueTeachers = [];
      const seen = new Set();
      const studentClassId = student.class_id;
      
      console.log('🔍 Finding teachers for class:', studentClassId);
      console.log('🎯 Class:', student.classes?.class_name, student.classes?.section);
      
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
            qualification
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
              subject: 'Class Teacher',
              role: 'class_teacher',
              className: `${student.classes.class_name} ${student.classes.section}`,
              studentName: student.name,
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
              subject: 'Class Teacher',
              role: 'class_teacher',
              className: `${student.classes.class_name} ${student.classes.section}`,
              studentName: student.name,
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
        console.log('Class info fetch error:', classInfoError);
      }
      
      // Method 1B: Alternative - Get class teacher directly from teachers table
      if (uniqueTeachers.length === 0) {
        console.log('Trying direct teacher fetch for class_id:', student.class_id);
        const { data: directClassTeacher, error: directTeacherError } = await supabase
          .from(TABLES.TEACHERS)
          .select('id, name, qualification, is_class_teacher, assigned_class_id')
          .eq('assigned_class_id', student.class_id)
          .eq('is_class_teacher', true);
        
        if (!directTeacherError && directClassTeacher && directClassTeacher.length > 0) {
          console.log('Found class teacher directly:', directClassTeacher[0]);
          const teacher = directClassTeacher[0];
          if (teacher.name && !seen.has(teacher.id)) {
            try {
              const teacherUserId = await getTeacherUserId(teacher.id);
              uniqueTeachers.push({
                id: teacher.id,
                userId: teacherUserId,
                name: teacher.name,
                subject: 'Class Teacher',
                role: 'class_teacher',
                className: `${student.classes.class_name} ${student.classes.section}`,
                studentName: student.name,
                messages: messagesByTeacherUserId[teacherUserId] || [],
                lastMessageTime: messagesByTeacherUserId[teacherUserId]?.length > 0 ?
                  messagesByTeacherUserId[teacherUserId][messagesByTeacherUserId[teacherUserId].length - 1].sent_at : null,
                canMessage: true
              });
            } catch (userIdError) {
              console.log('❌ Could not get user ID for direct class teacher:', userIdError.message);
              uniqueTeachers.push({
                id: teacher.id,
                userId: null,
                name: teacher.name + ' (No Account)',
                subject: 'Class Teacher',
                role: 'class_teacher',
                className: `${student.classes.class_name} ${student.classes.section}`,
                studentName: student.name,
                messages: [],
                lastMessageTime: null,
                canMessage: false,
                hasUserAccount: false
              });
            }
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
                    subject: subject.name,
                    role: 'subject_teacher',
                    className: `${student.classes.class_name} ${student.classes.section}`,
                    studentName: student.name,
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
                    subject: subject.name,
                    role: 'subject_teacher',
                    className: `${student.classes.class_name} ${student.classes.section}`,
                    studentName: student.name,
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
                  className: `${student.classes.class_name} ${student.classes.section}`,
                  studentName: student.name,
                  messages: messagesByTeacherUserId[teacherUserId] || [],
                  lastMessageTime: messagesByTeacherUserId[teacherUserId]?.length > 0 ?
                    messagesByTeacherUserId[teacherUserId][messagesByTeacherUserId[teacherUserId].length - 1].sent_at : null,
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
                  className: `${student.classes.class_name} ${student.classes.section}`,
                  studentName: student.name,
                  messages: [],
                  lastMessageTime: null,
                  canMessage: false,
                  hasUserAccount: false,
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
          
          for (const teacher of allClassTeachers) {
            if (teacher.name && !seen.has(teacher.id)) {
              try {
                const teacherUserId = await getTeacherUserId(teacher.id);
                uniqueTeachers.push({
                  id: teacher.id,
                  userId: teacherUserId,
                  name: teacher.name,
                  subject: teacher.is_class_teacher ? 'Class Teacher' : 'Subject Teacher',
                  role: teacher.is_class_teacher ? 'class_teacher' : 'subject_teacher',
                  className: `${student.classes.class_name} ${student.classes.section}`,
                  studentName: student.name,
                  messages: messagesByTeacherUserId[teacherUserId] || [],
                  lastMessageTime: messagesByTeacherUserId[teacherUserId]?.length > 0 ?
                    messagesByTeacherUserId[teacherUserId][messagesByTeacherUserId[teacherUserId].length - 1].sent_at : null,
                  canMessage: true
                });
              } catch (userIdError) {
                console.log('❌ Could not get user ID for broader search teacher:', userIdError.message);
                uniqueTeachers.push({
                  id: teacher.id,
                  userId: null,
                  name: teacher.name + ' (No Account)',
                  subject: teacher.is_class_teacher ? 'Class Teacher' : 'Subject Teacher',
                  role: teacher.is_class_teacher ? 'class_teacher' : 'subject_teacher',
                  className: `${student.classes.class_name} ${student.classes.section}`,
                  studentName: student.name,
                  messages: [],
                  lastMessageTime: null,
                  canMessage: false,
                  hasUserAccount: false
                });
              }
              seen.add(teacher.id);
            }
          }
        }
      }
      
      console.log('Final teachers list:', uniqueTeachers);
      
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
        
        setError(`No teachers found for your child's class. \n\nDebug Info:\nStudent Class ID: ${student.class_id}\nClass Name: ${classDebugInfo?.class_name || 'N/A'}\nSection: ${classDebugInfo?.section || 'N/A'}\nClass Teacher ID: ${classDebugInfo?.class_teacher_id || 'N/A'}\n\nPlease contact the school administrator to assign teachers.`);
        return;
      }

      setTeachers(uniqueTeachers)
      
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
          const count = await getUnreadCountFromSender(teacher.userId);
          counts[teacher.userId] = count;
        }
      }
      
      setUnreadCounts(counts);
    } catch (error) {
      console.log('Error fetching unread counts:', error);
    }
  };

  // Reset teacher selection and messages on screen focus
  useFocusEffect(
    React.useCallback(() => {
      setSelectedTeacher(null);
      setMessages([]);
      fetchTeachersAndChats();
    }, [])
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
      await markMessagesAsRead(teacher.userId);
      
      // Clear unread count for this teacher immediately
      setUnreadCounts(prev => ({
        ...prev,
        [teacher.userId]: 0
      }));
      
      // Refresh unread counts after a short delay to ensure database is updated
      setTimeout(() => {
        fetchUnreadCounts([teacher]);
      }, 1000);
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

  // Send a message
  const handleSend = async () => {
    if (!input.trim() || !selectedTeacher) return;
    
    try {
      console.log('Starting to send message...');
      console.log('User ID:', user.id);
      console.log('Selected Teacher:', selectedTeacher);

      // Get parent's linked student ID directly from users table
      const { data: parentUser, error: parentError } = await supabase
        .from(TABLES.USERS)
        .select('linked_parent_of')
        .eq('id', user.id)
        .single();

      console.log('Parent User Data:', parentUser);
      console.log('Parent Error:', parentError);

      if (parentError || !parentUser?.linked_parent_of) {
        throw new Error('Parent data not found or no student linked');
      }

      // Get teacher's user ID using our enhanced helper function
      const teacherUserId = selectedTeacher.userId || await getTeacherUserId(selectedTeacher.id);

      console.log('Teacher User ID:', teacherUserId);
      console.log('Selected Teacher ID:', selectedTeacher.id);
      console.log('Selected Teacher userId:', selectedTeacher.userId);

      if (!teacherUserId) {
        throw new Error('Teacher user account not found. Please contact admin to ensure teacher has a user account.');
      }

      // Create message for the messages table
      const newMsg = {
        sender_id: user.id,
        receiver_id: teacherUserId, // Use teacher's user ID, not teacher table ID
        student_id: parentUser.linked_parent_of,
        message: input,
        sent_at: new Date().toISOString(),
      };

      console.log('Message to insert:', newMsg);
      console.log('Table name being used:', TABLES.MESSAGES);

      const { data: insertedMsg, error: sendError } = await supabase
        .from('messages')
        .insert(newMsg)
        .select();

      console.log('Insert result:', insertedMsg);
      console.log('Insert error:', sendError);
      console.log('Insert error code:', sendError?.code);
      console.log('Insert error message:', sendError?.message);
      console.log('Insert error details:', sendError?.details);

      if (sendError) {
        console.error('Supabase error object:', JSON.stringify(sendError, null, 2));
        throw new Error(`Database error: ${sendError.message || sendError.code || 'Unknown database error'}`);
      }

      if (!insertedMsg || insertedMsg.length === 0) {
        throw new Error('Message was not inserted successfully');
      }

      // Add message to local state for immediate display
      const displayMsg = {
        id: Date.now().toString(),
        sender_id: user.id,
        receiver_id: teacherUserId,
        message: input,
        text: input, // Add this for compatibility with render
        sent_at: new Date().toISOString(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'text',
        sender: 'parent' // Add this for the render logic
      };

      setMessages(prev => [...prev, displayMsg]);
      setInput('');

      // Scroll to bottom after sending
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 100);
    } catch (err) {
      console.error('Error sending message:', err);
      console.error('Error details:', JSON.stringify(err, null, 2));
      Alert.alert('Error', `Failed to send message: ${err.message || 'Unknown error'}`);
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

  // Handle image upload with database save
  const handleImageUpload = async () => {
    setShowAttachmentMenu(false);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to access your photo library.');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        allowsMultipleSelection: false,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        
        // For now, create local message (you can add Supabase storage later)
        const newMsg = {
          id: Date.now().toString(),
          sender_id: user.id,
          receiver_id: selectedTeacher.userId,
          message: '📷 Photo',
          message_type: 'image',
          file_url: asset.uri, // Local URI for now
          file_name: asset.fileName || 'image.jpg',
          file_size: asset.fileSize || 0,
          file_type: 'image/jpeg',
          sent_at: new Date().toISOString(),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          sender: 'parent'
        };
        
        setMessages(prev => [...prev, newMsg]);
        
        // TODO: Save to database with actual file upload
        // await sendFileMessage(newMsg);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to pick image: ' + e.message);
    }
  };

  // Handle document upload with database save
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
        
        const newMsg = {
          id: Date.now().toString(),
          sender_id: user.id,
          receiver_id: selectedTeacher.userId,
          message: `📎 ${file.name}`,
          message_type: 'file',
          file_url: file.uri, // Local URI for now
          file_name: file.name,
          file_size: file.size || 0,
          file_type: file.mimeType || 'application/octet-stream',
          sent_at: new Date().toISOString(),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          sender: 'parent'
        };
        
        setMessages(prev => [...prev, newMsg]);
        
        // TODO: Save to database with actual file upload
        // await sendFileMessage(newMsg);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to pick document: ' + e.message);
    }
  };

  // Send file message to database
  const sendFileMessage = async (fileData) => {
    try {
      // Get parent's linked student ID
      const { data: parentUser, error: parentError } = await supabase
        .from(TABLES.USERS)
        .select('linked_parent_of')
        .eq('id', user.id)
        .single();

      if (parentError || !parentUser?.linked_parent_of) {
        throw new Error('Parent data not found');
      }

      // Get teacher's user ID
      const { data: teacherUser, error: teacherError } = await supabase
        .from(TABLES.USERS)
        .select('id')
        .eq('linked_teacher_id', selectedTeacher.id)
        .single();

      if (teacherError || !teacherUser) {
        throw new Error('Teacher user account not found');
      }

      // Create message with file data
      const newMsg = {
        sender_id: user.id,
        receiver_id: teacherUser.id,
        student_id: parentUser.linked_parent_of,
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
      <View style={styles.container}>
        <Header title="Chat With Teacher" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Loading teachers...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Header title="Chat With Teacher" showBack={true} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchTeachersAndChats}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
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

                // Get last message details
                const lastMessage = item.messages && item.messages.length > 0 ? 
                  item.messages[item.messages.length - 1] : null;
                const lastMessageSender = lastMessage ? 
                  (lastMessage.sender_id === user.id ? 'You' : item.name.split(' ')[0]) : null;
                const lastMessageText = lastMessage ? 
                  (lastMessage.text || lastMessage.message || 'Attachment') : 'No messages yet';
                const lastMessageTime = lastMessage ? 
                  new Date(lastMessage.sent_at).toLocaleDateString('en-US', { 
                    month: 'short', day: 'numeric',
                    ...(new Date(lastMessage.sent_at).getFullYear() !== new Date().getFullYear() && { year: 'numeric' })
                  }) : null;

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
                        
                        {/* Last Message Preview */}
                        {lastMessage ? (
                          <View style={styles.lastMessageContainer}>
                            <Text style={[
                              styles.lastMessageText,
                              hasUnread && styles.unreadText
                            ]} numberOfLines={1}>
                              {lastMessageSender}: {lastMessageText}
                            </Text>
                            {lastMessageTime && (
                              <Text style={[
                                styles.lastMessageTime,
                                hasUnread && styles.unreadTime
                              ]}>
                                {lastMessageTime}
                              </Text>
                            )}
                          </View>
                        ) : (
                          <Text style={styles.noMessagesText}>
                            Start a conversation
                          </Text>
                        )}
                      </View>
                      <View style={styles.chatActions}>
                        {hasUnread ? (
                          <View style={styles.unreadBadge}>
                            <Text style={styles.unreadBadgeText}>
                              {unreadCount > 99 ? '99+' : unreadCount}
                            </Text>
                          </View>
                        ) : (
                          <View style={styles.messageIndicator}>
                            <Ionicons name="chatbubble-outline" size={18} color="#9c27b0" />
                            {item.messages && item.messages.length > 0 && (
                              <Text style={styles.messageCount}>{item.messages.length}</Text>
                            )}
                          </View>
                        )}
                        <Ionicons name="chevron-forward" size={20} color="#ccc" />
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
          </View>
          
          <FlatList
            ref={flatListRef}
            data={[...messages]}
            keyExtractor={item => item.id}
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
                        // Open image in full screen
                        Alert.alert('Image', 'Image viewer coming soon');
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
                      {item.timestamp || (item.sent_at ? new Date(item.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '')}
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
    </View>
  );
};

const styles = StyleSheet.create({
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
    alignItems: 'center',
    justifyContent: 'center',
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
    borderLeftWidth: 3,
    borderLeftColor: '#f44336',
    backgroundColor: '#fffef7',
  },
  unreadAvatar: {
    borderWidth: 2,
    borderColor: '#f44336',
  },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#f44336',
    borderWidth: 2,
    borderColor: '#fff',
  },
  unreadText: {
    fontWeight: 'bold',
    color: '#222',
  },
  unreadTime: {
    fontWeight: 'bold',
    color: '#f44336',
  },
  unreadBadge: {
    backgroundColor: '#f44336',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },

  // Last Message Display
  lastMessageContainer: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessageText: {
    fontSize: 13,
    color: '#666',
    flex: 1,
    marginRight: 8,
  },
  noMessagesText: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 4,
  },
});

export default ChatWithTeacher; 
