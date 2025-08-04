import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../utils/AuthContext';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';

const StudentChatWithTeacher = () => {
  const { user } = useAuth();
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef(null);

  // Reset teacher selection and messages on screen focus
  useFocusEffect(
    React.useCallback(() => {
      setSelectedTeacher(null);
      setMessages([]);
      fetchTeachers();
    }, [])
  );

  // Fetch teachers assigned to the student
  const fetchTeachers = async () => {
    try {
      setLoading(true);
      setError(null);
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
      // Get teacher assignments for the student's class
      const { data: assignments, error: assignError } = await supabase
        .from(TABLES.TEACHER_SUBJECTS)
        .select(`
          teacher_id,
          subjects(
            name,
            class_id
          ),
          teachers(name, id)
        `)
        .eq('subjects.class_id', student.class_id);
      if (assignError) throw assignError;
      // Unique teachers
      const uniqueTeachers = [];
      const seen = new Set();
      assignments.forEach(a => {
        if (!seen.has(a.teacher_id)) {
          uniqueTeachers.push({
            id: a.teachers.id,
            name: a.teachers.name,
            subject: a.subjects.name,
          });
          seen.add(a.teacher_id);
        }
      });
      setTeachers(uniqueTeachers);
    } catch (err) {
      setError(err.message);
      setTeachers([]);
      console.error('Fetch teachers error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch chat messages for selected teacher
  const fetchMessages = async (teacher) => {
    try {
      setLoading(true);
      setError(null);
      setSelectedTeacher(teacher);

      // Get student data using the helper function
      const { data: studentUserData, error: studentError } = await dbHelpers.getStudentByUserId(user.id);
      if (studentError || !studentUserData) {
        throw new Error('Student data not found');
      }

      const student = studentUserData.students;
      if (!student) {
        throw new Error('Student profile not found');
      }

      // Get messages with error handling
      try {
        const { data: msgs, error: msgError } = await supabase
          .from(TABLES.MESSAGES)
          .select('*')
          .or(`(sender_id.eq.${user.id},receiver_id.eq.${teacher.id}),(sender_id.eq.${teacher.id},receiver_id.eq.${user.id})`)
          .order('sent_at', { ascending: true });

        if (msgError && msgError.code !== '42P01') {
          throw msgError;
        }
        setMessages(msgs || []);
      } catch (err) {
        console.log('Messages error:', err);
        setMessages([]);
      }
    } catch (err) {
      setError(err.message);
      setMessages([]);
      console.error('Fetch messages error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Real-time subscription for messages
  useEffect(() => {
    if (!selectedTeacher) return;
    let subscription;
    (async () => {
      // Get student info
      const { data: student } = await supabase
        .from(TABLES.STUDENTS)
        .select('id')
        .eq('user_id', user.id)
        .single();
      subscription = supabase
        .channel('student-chat-messages')
        .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.MESSAGES }, (payload) => {
          // Only update if the message is for this chat
          if (
            (payload.new.sender_id === student.id && payload.new.receiver_id === selectedTeacher.id) ||
            (payload.new.sender_id === selectedTeacher.id && payload.new.receiver_id === student.id)
          ) {
            fetchMessages(selectedTeacher);
          }
        })
        .subscribe();
    })();
    return () => {
      if (subscription) subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeacher]);

  // Send a message
  const handleSend = async () => {
    if (!input.trim() || !selectedTeacher) return;
    setSending(true);
    try {
      const newMsg = {
        sender_id: user.id,
        receiver_id: selectedTeacher.id,
        message: input,
        sent_at: new Date().toISOString(),
      };

      const { error: sendError } = await supabase
        .from(TABLES.MESSAGES)
        .insert(newMsg);

      if (sendError && sendError.code !== '42P01') {
        throw sendError;
      }

      setInput('');
      // fetchMessages(selectedTeacher); // Real-time will update
    } catch (err) {
      Alert.alert('Error', 'Failed to send message.');
      console.error('Send message error:', err);
    } finally {
      setSending(false);
    }
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
        mediaTypes: ImagePicker.MediaTypeOptions.All,
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
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
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
          <TouchableOpacity onPress={fetchTeachers} style={{ backgroundColor: '#1976d2', padding: 12, borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : !selectedTeacher ? (
        <View style={styles.teacherListContainer}>
          <Text style={styles.sectionTitle}>Your Teachers</Text>
          <FlatList
            data={getSortedTeachers()}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.teacherCard} onPress={() => fetchMessages(item)}>
                <Ionicons name="person-circle" size={36} color="#1976d2" style={{ marginRight: 12 }} />
                <View>
                  <Text style={styles.teacherName}>{item.name}</Text>
                  <Text style={styles.teacherSubject}>{item.subject}</Text>
                </View>
                <Ionicons name="chatbubbles" size={22} color="#9c27b0" style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
            )}
            contentContainerStyle={{ padding: 16 }}
          />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={80}
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
              <View style={[styles.messageRow, item.sender_id === user.id ? styles.messageRight : styles.messageLeft]}>
                <View style={[styles.messageBubble, item.sender_id === user.id ? styles.bubbleParent : styles.bubbleTeacher]}>
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
                    <Text style={styles.messageText}>{item.text}</Text>
                  )}
                  <Text style={styles.messageTime}>{item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</Text>
                </View>
              </View>
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
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1976d2', margin: 16 },
  teacherCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 12, elevation: 2 },
  teacherName: { fontSize: 16, fontWeight: 'bold', color: '#222' },
  teacherSubject: { fontSize: 14, color: '#666' },
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
});

export default StudentChatWithTeacher; 