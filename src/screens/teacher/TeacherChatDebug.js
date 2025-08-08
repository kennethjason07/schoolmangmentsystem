import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import { useAuth } from '../../utils/AuthContext';
import { supabase, TABLES } from '../../utils/supabase';

const TeacherChatDebug = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    debugTeacherData();
  }, []);

  const debugTeacherData = async () => {
    try {
      setLoading(true);
      const debug = {
        currentUser: user,
        teacherId: null,
        allStudents: [],
        allClasses: [],
        allTeachers: [],
        allUsers: [],
        teacherClasses: [],
        teacherSubjects: [],
        parents: [],
        students: []
      };

      console.log('🔍 Starting debug for user:', user.id);

      // 1. Get current user's teacher info
      console.log('1️⃣ Checking user\'s teacher link...');
      const { data: userInfo, error: userError } = await supabase
        .from(TABLES.USERS)
        .select('*')
        .eq('id', user.id)
        .single();

      if (userError) {
        console.error('❌ User info error:', userError);
        debug.userError = userError.message;
      } else {
        console.log('✅ User info:', userInfo);
        debug.userInfo = userInfo;
        debug.teacherId = userInfo.linked_teacher_id;
      }

      // 2. Get all teachers for reference
      console.log('2️⃣ Getting all teachers...');
      const { data: allTeachers, error: teachersError } = await supabase
        .from(TABLES.TEACHERS)
        .select('*');
      
      if (!teachersError) {
        console.log('📋 All teachers:', allTeachers.length);
        debug.allTeachers = allTeachers;
      } else {
        console.error('❌ Teachers error:', teachersError);
        debug.teachersError = teachersError.message;
      }

      // 3. Get all classes for reference
      console.log('3️⃣ Getting all classes...');
      const { data: allClasses, error: classesError } = await supabase
        .from(TABLES.CLASSES)
        .select('*');
      
      if (!classesError) {
        console.log('📋 All classes:', allClasses.length);
        debug.allClasses = allClasses;
      } else {
        console.error('❌ Classes error:', classesError);
        debug.classesError = classesError.message;
      }

      // 4. Get all students for reference
      console.log('4️⃣ Getting all students...');
      const { data: allStudents, error: studentsError } = await supabase
        .from(TABLES.STUDENTS)
        .select('*');
      
      if (!studentsError) {
        console.log('📋 All students:', allStudents.length);
        debug.allStudents = allStudents;
      } else {
        console.error('❌ Students error:', studentsError);
        debug.studentsError = studentsError.message;
      }

      // 5. Get all users for reference
      console.log('5️⃣ Getting all users...');
      const { data: allUsers, error: usersError } = await supabase
        .from(TABLES.USERS)
        .select('*');
      
      if (!usersError) {
        console.log('📋 All users:', allUsers.length);
        debug.allUsers = allUsers;
      } else {
        console.error('❌ Users error:', usersError);
        debug.usersError = usersError.message;
      }

      // 6. If we have a teacher ID, get specific data
      if (debug.teacherId) {
        console.log('6️⃣ Getting teacher-specific data for ID:', debug.teacherId);
        
        // Get classes where this teacher is class teacher
        const { data: teacherClasses, error: tcError } = await supabase
          .from(TABLES.CLASSES)
          .select('*')
          .eq('class_teacher_id', debug.teacherId);
        
        if (!tcError) {
          console.log('📚 Teacher classes:', teacherClasses.length);
          debug.teacherClasses = teacherClasses;
        } else {
          console.error('❌ Teacher classes error:', tcError);
          debug.teacherClassesError = tcError.message;
        }

        // Get subjects taught by this teacher
        const { data: teacherSubjects, error: tsError } = await supabase
          .from(TABLES.TEACHER_SUBJECTS)
          .select('*')
          .eq('teacher_id', debug.teacherId);
        
        if (!tsError) {
          console.log('📖 Teacher subjects:', teacherSubjects.length);
          debug.teacherSubjects = teacherSubjects;
        } else {
          console.error('❌ Teacher subjects error:', tsError);
          debug.teacherSubjectsError = tsError.message;
        }
      }

      // 7. Check specific Victor data
      console.log('7️⃣ Looking for Victor...');
      const { data: victorData, error: victorError } = await supabase
        .from(TABLES.STUDENTS)
        .select('*')
        .ilike('name', '%Victor%');
      
      if (!victorError && victorData?.length > 0) {
        console.log('🎯 Found Victor:', victorData);
        debug.victorData = victorData;

        // Check Victor's parent
        for (const victor of victorData) {
          if (victor.parent_id) {
            const { data: victorParent, error: vpError } = await supabase
              .from(TABLES.USERS)
              .select('*')
              .eq('id', victor.parent_id);
            
            if (!vpError) {
              console.log('👨‍👩‍👧‍👦 Victor parent:', victorParent);
              debug.victorParent = victorParent;
            }
          }
        }
      } else {
        console.log('❌ No Victor found or error:', victorError);
        debug.victorError = victorError?.message || 'Not found';
      }

      setDebugInfo(debug);
      console.log('🏁 Debug complete:', debug);

    } catch (err) {
      console.error('💥 Debug error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Debug Teacher Data" showBack={true} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Analyzing data...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Header title="Debug Teacher Data" showBack={true} />
        <View style={styles.centered}>
          <Text style={styles.error}>Error: {error}</Text>
          <TouchableOpacity onPress={debugTeacherData} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Debug Teacher Data" showBack={true} />
      <ScrollView style={styles.scroll}>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👤 Current User</Text>
          <Text style={styles.data}>ID: {debugInfo.currentUser?.id}</Text>
          <Text style={styles.data}>Email: {debugInfo.currentUser?.email}</Text>
          <Text style={styles.data}>Role: {debugInfo.currentUser?.role}</Text>
          <Text style={styles.data}>Linked Teacher ID: {debugInfo.userInfo?.linked_teacher_id || 'None'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Database Counts</Text>
          <Text style={styles.data}>Teachers: {debugInfo.allTeachers?.length || 0}</Text>
          <Text style={styles.data}>Classes: {debugInfo.allClasses?.length || 0}</Text>
          <Text style={styles.data}>Students: {debugInfo.allStudents?.length || 0}</Text>
          <Text style={styles.data}>Users: {debugInfo.allUsers?.length || 0}</Text>
        </View>

        {debugInfo.teacherId && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>👨‍🏫 Teacher Assignments</Text>
            <Text style={styles.data}>Teacher ID: {debugInfo.teacherId}</Text>
            <Text style={styles.data}>Classes as Class Teacher: {debugInfo.teacherClasses?.length || 0}</Text>
            <Text style={styles.data}>Subjects Teaching: {debugInfo.teacherSubjects?.length || 0}</Text>
            
            {debugInfo.teacherClasses?.map(cls => (
              <Text key={cls.id} style={styles.subData}>
                • Class: {cls.class_name} {cls.section} (ID: {cls.id})
              </Text>
            ))}
            
            {debugInfo.teacherSubjects?.map(subj => (
              <Text key={subj.id} style={styles.subData}>
                • Subject ID: {subj.subject_id}
              </Text>
            ))}
          </View>
        )}

        {debugInfo.victorData && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎯 Victor Data</Text>
            {debugInfo.victorData.map(victor => (
              <View key={victor.id}>
                <Text style={styles.data}>Name: {victor.name}</Text>
                <Text style={styles.data}>ID: {victor.id}</Text>
                <Text style={styles.data}>Class ID: {victor.class_id}</Text>
                <Text style={styles.data}>Parent ID: {victor.parent_id || 'None'}</Text>
                <Text style={styles.data}>Roll: {victor.roll_no}</Text>
              </View>
            ))}
            {debugInfo.victorParent && (
              <Text style={styles.data}>Parent Name: {debugInfo.victorParent[0]?.full_name || 'None'}</Text>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔍 Sample Data</Text>
          
          <Text style={styles.subTitle}>Recent Students:</Text>
          {debugInfo.allStudents?.slice(0, 5).map(student => (
            <Text key={student.id} style={styles.subData}>
              • {student.name} (Class: {student.class_id}, Parent: {student.parent_id || 'None'})
            </Text>
          ))}

          <Text style={styles.subTitle}>Recent Classes:</Text>
          {debugInfo.allClasses?.slice(0, 5).map(cls => (
            <Text key={cls.id} style={styles.subData}>
              • {cls.class_name} {cls.section} (Teacher: {cls.class_teacher_id || 'None'})
            </Text>
          ))}

          <Text style={styles.subTitle}>Recent Users:</Text>
          {debugInfo.allUsers?.slice(0, 5).map(user => (
            <Text key={user.id} style={styles.subData}>
              • {user.full_name || user.email} ({user.role}) - Teacher: {user.linked_teacher_id || 'None'}
            </Text>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>❌ Errors</Text>
          {debugInfo.userError && <Text style={styles.error}>User: {debugInfo.userError}</Text>}
          {debugInfo.teachersError && <Text style={styles.error}>Teachers: {debugInfo.teachersError}</Text>}
          {debugInfo.classesError && <Text style={styles.error}>Classes: {debugInfo.classesError}</Text>}
          {debugInfo.studentsError && <Text style={styles.error}>Students: {debugInfo.studentsError}</Text>}
          {debugInfo.usersError && <Text style={styles.error}>Users: {debugInfo.usersError}</Text>}
          {debugInfo.teacherClassesError && <Text style={styles.error}>Teacher Classes: {debugInfo.teacherClassesError}</Text>}
          {debugInfo.teacherSubjectsError && <Text style={styles.error}>Teacher Subjects: {debugInfo.teacherSubjectsError}</Text>}
          {debugInfo.victorError && <Text style={styles.error}>Victor: {debugInfo.victorError}</Text>}
        </View>

        <TouchableOpacity onPress={debugTeacherData} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={20} color="#fff" />
          <Text style={styles.refreshText}>Refresh Debug Data</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  scroll: { flex: 1, padding: 16 },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 8,
  },
  subTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 12,
    marginBottom: 4,
  },
  data: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  subData: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
    marginLeft: 8,
  },
  error: {
    fontSize: 14,
    color: '#d32f2f',
    marginBottom: 4,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  retryBtn: {
    backgroundColor: '#1976d2',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  retryText: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  refreshBtn: {
    backgroundColor: '#1976d2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  refreshText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default TeacherChatDebug;
