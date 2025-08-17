import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Alert, Keyboard, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../utils/AuthContext';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';
import { useMessageStatus } from '../../utils/useMessageStatus';

const TeacherChat = () => {
  const { user } = useAuth();
  const { markMessagesAsRead } = useMessageStatus();
  const [activeTab, setActiveTab] = useState('parents'); // 'parents' or 'students'
  const [parents, setParents] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null); // Can be parent or student
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({}); // Track unread messages per contact
  const [refreshingParents, setRefreshingParents] = useState(false);
  const [refreshingStudents, setRefreshingStudents] = useState(false);
  const flatListRef = useRef(null);

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
      console.log('🔍 Looking for parent user ID for student:', studentId);

      // Method 1: Try via linked_parent_of
      const { data: parentUser, error: parentError } = await supabase
        .from(TABLES.USERS)
        .select('id, email, full_name')
        .eq('linked_parent_of', studentId)
        .single();

      if (parentUser && !parentError) {
        console.log('✅ Found parent user via linked_parent_of:', parentUser);
        return {
          id: parentUser.id,
          name: parentUser.full_name || parentUser.email,
          email: parentUser.email
        };
      }

      console.log('❌ Parent user not found via linked_parent_of, error:', parentError);

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
          console.log('✅ Found parent via student.parent_id:', parentUserData);
          return {
            id: parentUserData.id,
            name: parentUserData.full_name || parentUserData.email,
            email: parentUserData.email
          };
        }
      }

      console.log('⚠️ No parent found for student:', studentId);
      return null;
    } catch (error) {
      console.log('💥 Error getting parent user ID:', error);
      return null;
    }
  };

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

  // Fetch both parents and students data
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await Promise.all([
        fetchParents(),
        fetchStudents(),
        fetchUnreadCounts()
      ]);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch parents of students assigned to the teacher - SUPER OPTIMIZED
  const fetchParents = async () => {
    try {
      // Get teacher info from users table
      const { data: userInfo, error: userError } = await supabase
        .from(TABLES.USERS)
        .select('linked_teacher_id')
        .eq('id', user.id)
        .single();

      if (userError || !userInfo?.linked_teacher_id) {
        throw new Error('Teacher information not found. Please contact administrator.');
      }

      const teacherId = userInfo.linked_teacher_id;
      const uniqueParents = [];
      const seen = new Set();

      // SUPER OPTIMIZATION: Execute both queries in parallel for maximum speed
      const [classParentResult, subjectParentResult] = await Promise.all([
        // Query 1: Get class teacher students and their parents
        supabase
          .from(TABLES.STUDENTS)
          .select(`
            id,
            name,
            roll_no,
            parent_id,
            class_id,
            classes!inner (
              id,
              class_name,
              section,
              class_teacher_id
            ),
            users!students_parent_id_fkey (
              id,
              email,
              full_name
            )
          `)
          .eq('classes.class_teacher_id', teacherId),
          
        // Query 2: Get subject teaching students and their parents
        supabase
          .from(TABLES.TEACHER_SUBJECTS)
          .select(`
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
                  roll_no,
                  parent_id,
                  users!students_parent_id_fkey (
                    id,
                    email,
                    full_name
                  )
                )
              )
            )
          `)
          .eq('teacher_id', teacherId)
      ]);

      // Process class teacher students and parents
      if (!classParentResult.error && classParentResult.data) {
        for (const student of classParentResult.data) {
          if (student.users && !seen.has(student.users.id)) {
            uniqueParents.push({
              id: student.users.id,
              name: student.users.full_name || student.users.email,
              email: student.users.email,
              students: [{
                id: student.id,
                name: student.name,
                roll_no: student.roll_no,
                class: `${student.classes.class_name} ${student.classes.section}`
              }],
              role: 'class_parent',
              canMessage: true
            });
            seen.add(student.users.id);
          } else if (student.users) {
            // Add student to existing parent
            const existingParent = uniqueParents.find(p => p.id === student.users.id);
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

      // Process subject teaching students and parents
      if (!subjectParentResult.error && subjectParentResult.data) {
        for (const teacherSubject of subjectParentResult.data) {
          if (teacherSubject.subjects?.classes?.students) {
            for (const student of teacherSubject.subjects.classes.students) {
              if (student.users && !seen.has(student.users.id)) {
                uniqueParents.push({
                  id: student.users.id,
                  name: student.users.full_name || student.users.email,
                  email: student.users.email,
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
                seen.add(student.users.id);
              } else if (student.users) {
                // Add student to existing parent
                const existingParent = uniqueParents.find(p => p.id === student.users.id);
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

  // Fetch students assigned to the teacher - SUPER OPTIMIZED
  const fetchStudents = async () => {
    try {
      // Get teacher info from users table
      const { data: userInfo, error: userError } = await supabase
        .from(TABLES.USERS)
        .select('linked_teacher_id')
        .eq('id', user.id)
        .single();

      if (userError || !userInfo?.linked_teacher_id) {
        throw new Error('Teacher information not found. Please contact administrator.');
      }

      const teacherId = userInfo.linked_teacher_id;
      const uniqueStudents = [];
      const seen = new Set();
      const studentUserMap = new Map(); // Cache for student user accounts

      // SUPER OPTIMIZATION 1: Single query to get ALL students and user accounts at once
      const [classStudentResult, subjectStudentResult, allStudentUsersResult] = await Promise.all([
        // Get class students
        supabase
          .from(TABLES.STUDENTS)
          .select(`
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
          `)
          .eq('classes.class_teacher_id', teacherId),
          
        // Get subject students
        supabase
          .from(TABLES.TEACHER_SUBJECTS)
          .select(`
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
          `)
          .eq('teacher_id', teacherId),
          
        // Get ALL student user accounts in one query
        supabase
          .from(TABLES.USERS)
          .select('id, email, full_name, linked_student_id')
          .not('linked_student_id', 'is', null)
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
      // Don't set loading if this is a refresh call (contact is already selected)
      if (!selectedContact) {
        setLoading(true);
        setSelectedContact(contact);
      }
      setError(null);

      // Get the contact's user ID
      const contactUserId = contact.userId || contact.id;
      
      // Get messages with this contact
      try {
        console.log('🔄 Fetching messages for contact:', contact.name, 'User ID:', contactUserId);
        
        // Try multiple query approaches for better compatibility
        let msgs = null;
        let msgError = null;
        
        // Method 1: OR query (preferred)
        const query1 = await supabase
          .from(TABLES.MESSAGES)
          .select('*')
          .or(`(sender_id.eq.${user.id},receiver_id.eq.${contactUserId}),(sender_id.eq.${contactUserId},receiver_id.eq.${user.id})`)
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
              .eq('receiver_id', contactUserId),
            supabase
              .from(TABLES.MESSAGES)
              .select('*')
              .eq('sender_id', contactUserId)
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
        
        // Mark messages from this contact as read
        if (contactUserId !== user.id) {
          markMessagesAsRead(contactUserId);
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
              console.log('📜 Scroll to end error (loading messages):', error);
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
      if (!selectedContact) {
        setLoading(false);
      }
    }
  };

  // Real-time subscription for messages
  useEffect(() => {
    if (!selectedContact) return;
    let subscription;
    (async () => {
      const contactUserId = selectedContact.userId || selectedContact.id;
      subscription = supabase
        .channel(`teacher-chat-${user.id}-${contactUserId}-${Date.now()}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: TABLES.MESSAGES
        }, (payload) => {
          console.log('Real-time message update:', payload);
          
          // Check if this message is relevant to our chat
          const isRelevant = (
            (payload.new?.sender_id === user.id && payload.new?.receiver_id === contactUserId) ||
            (payload.new?.sender_id === contactUserId && payload.new?.receiver_id === user.id) ||
            (payload.old?.sender_id === user.id && payload.old?.receiver_id === contactUserId) ||
            (payload.old?.sender_id === contactUserId && payload.old?.receiver_id === user.id)
          );
          
          if (isRelevant) {
            console.log('Message is relevant, refreshing chat');
            setTimeout(() => {
              fetchMessages(selectedContact);
            }, 200);
          }
        })
        .subscribe();
      
      console.log('Subscribed to real-time updates for chat with:', selectedContact.name);
    })();
    return () => {
      if (subscription) {
        subscription.unsubscribe();
        console.log('Unsubscribed from real-time chat updates');
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedContact, user.id]);

  // Send a message
  const handleSend = async () => {
    if (!input.trim() || !selectedContact) return;
    setSending(true);
    
    try {
      console.log('Starting to send message...');
      console.log('User ID:', user.id);
      console.log('Selected Contact:', selectedContact);

      const contactUserId = selectedContact.userId || selectedContact.id;
      const newMsg = {
        sender_id: user.id,
        receiver_id: contactUserId,
        student_id: selectedContact.students ? selectedContact.students[0]?.id : selectedContact.id, // Parent has students array, student is the student
        message: input,
        sent_at: new Date().toISOString(),
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
        receiver_id: contactUserId,
        student_id: selectedContact.students ? selectedContact.students[0]?.id : selectedContact.id,
        message: input,
        sent_at: new Date().toISOString(),
        type: 'text'
      };

      setMessages(prev => [...prev, displayMsg]);
      setInput('');
      
      // Refresh messages from database to ensure consistency
      setTimeout(() => {
        fetchMessages(selectedContact);
      }, 500);
      
      // Scroll to bottom after sending
      setTimeout(() => {
        try {
          if (flatListRef.current && flatListRef.current.scrollToEnd) {
            flatListRef.current.scrollToEnd({ animated: true });
          }
        } catch (error) {
          console.log('📜 Scroll to end error (after sending):', error);
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const isImage = asset.type && asset.type.startsWith('image');
        
        const contactUserId = selectedContact.userId || selectedContact.id;
        const newMsg = {
          sender_id: user.id,
          receiver_id: contactUserId,
          student_id: selectedContact.students ? selectedContact.students[0]?.id : selectedContact.id,
          type: isImage ? 'image' : 'file',
          uri: asset.uri,
          file_name: asset.fileName || asset.uri.split('/').pop(),
          sent_at: new Date().toISOString(),
        };
        
        const { error: sendError } = await supabase
          .from(TABLES.MESSAGES)
          .insert(newMsg);
        
        if (sendError) {
          console.error('File send error:', sendError);
          Alert.alert('Error', 'Failed to send file');
        } else {
          // Refresh messages to show the new file
          setTimeout(() => {
            fetchMessages(selectedContact);
          }, 500);
        }
      }
    } catch (e) {
      console.error('File picker error:', e);
      Alert.alert('Error', 'Failed to pick file: ' + e.message);
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
          console.log('📜 Scroll to end error (messages change):', error);
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
      console.error('Error refreshing parents data:', error);
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
      console.error('Error refreshing students data:', error);
    } finally {
      setRefreshingStudents(false);
    }
  };

  // Debug UI state
  console.log('🖥️ UI RENDER DEBUG:', {
    loading,
    error,
    selectedContact: selectedContact ? selectedContact.name : null,
    activeTab,
    studentsLength: students.length,
    parentsLength: parents.length
  });
  
  return (
    <View style={styles.container}>
      <Header title="Teacher Chat" showBack={true} />
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={{ marginTop: 16, fontSize: 16, color: '#666', textAlign: 'center' }}>
            Loading your students and parents...
          </Text>
          <Text style={{ marginTop: 8, fontSize: 14, color: '#999', textAlign: 'center' }}>
            This may take a moment
          </Text>
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
                              {unreadCounts[item.id] && (
                                <View style={styles.unreadBadge}>
                                  <Text style={styles.unreadBadgeText}>
                                    {unreadCounts[item.id] > 99 ? '99+' : unreadCounts[item.id]}
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
                                  {unreadCounts[item.userId] && (
                                    <View style={styles.unreadBadge}>
                                      <Text style={styles.unreadBadgeText}>
                                        {unreadCounts[item.userId] > 99 ? '99+' : unreadCounts[item.userId]}
                                      </Text>
                                    </View>
                                  )}
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
            </View>
          </View>
          <View style={{ flex: 1 }}>
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
                    item.sender_id === user.id ? styles.bubbleTeacher : styles.bubbleParent,
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
                    <Text style={styles.messageTime}>{item.sent_at ? new Date(item.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</Text>
                  </View>
                </TouchableOpacity>
              )}
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
              onChangeText={setInput}
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
    </View>
  );
};

const styles = StyleSheet.create({
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
});

export default TeacherChat;
