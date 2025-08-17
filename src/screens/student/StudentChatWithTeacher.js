import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Alert, Keyboard, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../utils/AuthContext';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';
import { useMessageStatus } from '../../utils/useMessageStatus';
import { formatToLocalTime } from '../../utils/timeUtils';
import usePullToRefresh from '../../hooks/usePullToRefresh';

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
  const flatListRef = useRef(null);

  // Pull-to-refresh functionality
  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    await fetchData();
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
      setSelectedTeacher(null);
      setMessages([]);
      fetchData();
    }, [])
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
          .select('id, name, qualification, is_class_teacher, assigned_class_id')
          .eq('assigned_class_id', student.class_id)
          .eq('is_class_teacher', true);
        
        if (!directTeacherError && directClassTeacher && directClassTeacher.length > 0) {
          console.log('Found class teacher directly:', directClassTeacher[0]);
          const teacher = directClassTeacher[0];
          if (teacher.name && !seen.has(teacher.id)) {
            uniqueTeachers.push({
              id: teacher.id,
              name: teacher.name,
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
    try {
      // Don't set loading if this is a refresh call (teacher is already selected)
      if (!selectedTeacher) {
        setLoading(true);
        setSelectedTeacher(teacher);
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
        
        // Method 1: OR query (preferred)
        const query1 = await supabase
          .from(TABLES.MESSAGES)
          .select('*')
          .or(`(sender_id.eq.${user.id},receiver_id.eq.${teacherUserId}),(sender_id.eq.${teacherUserId},receiver_id.eq.${user.id})`)
          .order('sent_at', { ascending: true });
          
        if (!query1.error) {
          msgs = query1.data;
        } else {
          console.log('OR query failed, trying alternative:', query1.error);
          
          // Method 2: Two separate queries and combine
          const [sentMsgs, receivedMsgs] = await Promise.all([
            supabase
              .from(TABLES.MESSAGES)
              .select('*')
              .eq('sender_id', user.id)
              .eq('receiver_id', teacherUserId),
            supabase
              .from(TABLES.MESSAGES)
              .select('*')
              .eq('sender_id', teacherUserId)
              .eq('receiver_id', user.id)
          ]);
          
          if (!sentMsgs.error && !receivedMsgs.error) {
            msgs = [...(sentMsgs.data || []), ...(receivedMsgs.data || [])]
              .sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at));
          } else {
            msgError = sentMsgs.error || receivedMsgs.error;
          }
        }

        console.log('📨 Messages query result:', { msgsCount: msgs?.length || 0, msgError });
        
        if (msgs) {
          msgs.forEach((msg, index) => {
            console.log(`Message ${index + 1}:`, {
              id: msg.id,
              sender_id: msg.sender_id,
              receiver_id: msg.receiver_id,
              message: msg.message?.substring(0, 50) + '...',
              sent_at: msg.sent_at
            });
          });
        }

        if (msgError && msgError.code !== '42P01') {
          throw msgError;
        }
        
        const formattedMessages = (msgs || []).map(msg => ({
          ...msg,
          id: msg.id || msg.created_at || Date.now().toString(),
          type: msg.type || 'text'
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
            if (flatListRef.current) {
              flatListRef.current.scrollToEnd({ animated: true });
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

  // Real-time subscription for messages
  useEffect(() => {
    if (!selectedTeacher) return;
    let subscription;
    (async () => {
      // Get teacher's user ID for proper subscription
      let teacherUserId = selectedTeacher.userId;
      if (!teacherUserId) {
        try {
          teacherUserId = await getTeacherUserId(selectedTeacher.id);
        } catch (err) {
          console.log('Could not get teacher user ID for subscription:', err);
          return;
        }
      }
      
      subscription = supabase
        .channel(`student-chat-${user.id}-${teacherUserId}-${Date.now()}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: TABLES.MESSAGES
        }, (payload) => {
          console.log('Real-time message update:', payload);
          
          // Check if this message is relevant to our chat
          const isRelevant = (
            (payload.new?.sender_id === user.id && payload.new?.receiver_id === teacherUserId) ||
            (payload.new?.sender_id === teacherUserId && payload.new?.receiver_id === user.id) ||
            (payload.old?.sender_id === user.id && payload.old?.receiver_id === teacherUserId) ||
            (payload.old?.sender_id === teacherUserId && payload.old?.receiver_id === user.id)
          );
          
          if (isRelevant) {
            console.log('Message is relevant, refreshing chat');
            // Refresh messages when there's a relevant change
            setTimeout(() => {
              fetchMessages(selectedTeacher);
            }, 200);
          }
        })
        .subscribe();
      
      console.log('Subscribed to real-time updates for chat between', user.id, 'and', teacherUserId);
    })();
    return () => {
      if (subscription) {
        subscription.unsubscribe();
        console.log('Unsubscribed from real-time chat updates');
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeacher, user.id]);

  // Send a message
  const handleSend = async () => {
    if (!input.trim() || !selectedTeacher) return;
    setSending(true);
    try {
      console.log('Starting to send message...');
      console.log('User ID:', user.id);
      console.log('Selected Teacher:', selectedTeacher);

      // Get student data for the student_id field
      const { data: studentUserData, error: studentError } = await dbHelpers.getStudentByUserId(user.id);
      if (studentError || !studentUserData) {
        throw new Error('Student data not found');
      }

      const student = studentUserData.students;
      if (!student) {
        throw new Error('Student profile not found');
      }

      // Get teacher's user ID using our helper function
      const teacherUserId = selectedTeacher.userId || await getTeacherUserId(selectedTeacher.id);
      console.log('Teacher User ID:', teacherUserId);
      console.log('Selected Teacher ID:', selectedTeacher.id);
      console.log('Selected Teacher userId:', selectedTeacher.userId);

      if (!teacherUserId) {
        throw new Error('Teacher user account not found. Please contact admin to ensure teacher has a user account.');
      }

      const newMsg = {
        sender_id: user.id,
        receiver_id: teacherUserId, // Use teacher's user ID, not teacher table ID
        student_id: student.id,
        message: input,
      };

      console.log('Message to insert:', newMsg);

      const { data: insertedMsg, error: sendError } = await supabase
        .from(TABLES.MESSAGES)
        .insert(newMsg)
        .select();

      console.log('Send error:', sendError);
      console.log('Inserted message:', insertedMsg);

      if (sendError) {
        console.error('Supabase error object:', JSON.stringify(sendError, null, 2));
        throw new Error(`Database error: ${sendError.message || sendError.code || 'Unknown database error'}`);
      }

      // Add message to local state for immediate display
      const displayMsg = {
        id: insertedMsg?.[0]?.id || Date.now().toString(),
        sender_id: user.id,
        receiver_id: teacherUserId,
        student_id: student.id,
        message: input,
        sent_at: insertedMsg?.[0]?.sent_at || new Date().toISOString(),
        type: 'text'
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

  // Attachment handler
  const handleAttach = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission to access media library is required!');
        return;
      }
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType.Images,
        allowsEditing: false,
        quality: 1,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const isImage = asset.type && asset.type.startsWith('image');
        // Get student info
        const { data: student } = await supabase
          .from(TABLES.STUDENTS)
          .select('id')
          .eq('user_id', user.id)
          .single();
        const newMsg = {
          sender_id: student.id,
          receiver_id: selectedTeacher.id,
          type: isImage ? 'image' : 'file',
          uri: asset.uri,
          file_name: asset.fileName || asset.uri.split('/').pop(),
          created_at: new Date().toISOString(),
        };
        const { error: sendError } = await supabase
          .from(TABLES.MESSAGES)
          .insert(newMsg);
        if (sendError) throw sendError;
      }
    } catch (e) {
      alert('Failed to pick file: ' + e.message);
    }
  };

  // Go back to teacher list
  const handleBack = () => {
    setSelectedTeacher(null);
    setMessages([]);
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current.scrollToEnd({ animated: true });
      }, 100);
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
(unreadCounts[item.userId] || unreadCounts[item.id]) && styles.unreadTeacherCard
                      ]} 
                      onPress={() => fetchMessages(item)}
                    >
                      <View style={[
                        styles.teacherAvatar,
                        { backgroundColor: item.role === 'class_teacher' ? '#4CAF50' : '#2196F3' }
                      ]}>
                        <Ionicons
                          name={item.role === 'class_teacher' ? 'school' : 'book'}
                          size={24}
                          color="#fff"
                        />
                      </View>
                      <View style={styles.teacherInfo}>
                        <View style={styles.teacherHeader}>
                          <Text style={styles.teacherName} numberOfLines={item.name.includes('(No Account)') ? 2 : 1}>
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
                        <Text style={styles.teacherSubject} numberOfLines={2}>
                          {item.subject}
                        </Text>
                      </View>
                      <View style={styles.chatActions}>
                        <View style={styles.chatIconContainer}>
                          <Ionicons name="chatbubbles" size={20} color={(unreadCounts[item.userId] || unreadCounts[item.id]) ? "#f44336" : "#9c27b0"} />
                          {(unreadCounts[item.userId] || unreadCounts[item.id]) && (
                            <View style={styles.unreadBadge}>
                              <Text style={styles.unreadBadgeText}>
                                {(unreadCounts[item.userId] || unreadCounts[item.id]) > 99 ? '99+' : (unreadCounts[item.userId] || unreadCounts[item.id])}
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
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
        >
          <View style={styles.chatHeader}>
            <TouchableOpacity onPress={handleBack} style={{ marginRight: 10 }}>
              <Ionicons name="arrow-back" size={24} color="#1976d2" />
            </TouchableOpacity>
            <Ionicons name="person-circle" size={32} color="#1976d2" style={{ marginRight: 8 }} />
            <View>
              <Text style={styles.teacherName}>{selectedTeacher.name}</Text>
              <Text style={styles.teacherSubject}>{selectedTeacher.subject}</Text>
            </View>
          </View>
          <FlatList
            ref={flatListRef}
            data={[...messages]}
            keyExtractor={item => item.id?.toString() || Math.random().toString()}
            renderItem={({ item }) => (
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
                  item.sender_id === user.id ? styles.bubbleParent : styles.bubbleTeacher,
                  deletingMessageId === item.id && styles.deletingMessage
                ]}>
                  {item.type === 'image' && (
                    <Image source={{ uri: item.uri }} style={styles.chatImage} />
                  )}
                  {item.type === 'file' && (
                    <View style={styles.fileRow}>
                      <Ionicons name="document" size={20} color="#1976d2" style={{ marginRight: 6 }} />
                      <Text style={styles.fileName}>{item.file_name}</Text>
                    </View>
                  )}
                  {(!item.type || item.type === 'text') && (
                    <Text style={styles.messageText}>{item.message || item.text}</Text>
                  )}
                  <Text style={styles.messageTime}>{formatToLocalTime(item.sent_at || item.created_at)}</Text>
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
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  fileName: {
    fontSize: 14,
    color: '#1976d2',
    textDecorationLine: 'underline',
    maxWidth: 120,
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
});

export default StudentChatWithTeacher; 