import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  ScrollView,
  TouchableOpacity, 
  TextInput,
  StyleSheet, 
  ActivityIndicator, 
  Alert, 
  Platform, 
  Animated, 
  RefreshControl,
  Dimensions,
  Image
} from 'react-native';
import Header from '../../components/Header';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../utils/supabase';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const StudentList = ({ route, navigation }) => {
  const { classId, className, section } = route.params || {};
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredStudents, setFilteredStudents] = useState([]);

  // Pagination state
  const PAGE_SIZE = 50;
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingPage, setLoadingPage] = useState(false);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef(null);
  const scrollTopOpacity = useRef(new Animated.Value(0)).current;

  // Move fetchStudents outside useEffect to make it reusable
  const fetchStudents = async (pageNumber = 0, replace = true) => {
    if (replace) setLoading(true);
    setError(null);
    try {
      console.log('StudentList: Received classId:', classId);
      
      if (!classId) {
        console.log('StudentList: No classId provided');
        setError('No class ID provided');
        setLoading(false);
        return;
      }
      
      const from = pageNumber * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // Build query with narrow projection and server-side search on name
      let query = supabase
        .from('students')
        .select(`
          id,
          name,
          roll_no,
          class_id,
          photo_url,
          classes(class_name, section),
          parents:parent_id(name, phone)
        `)
        .eq('class_id', classId)
        .order('roll_no', { ascending: true })
        .range(from, to);

      if (searchQuery && searchQuery.trim().length > 0) {
        query = query.ilike('name', `%${searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('StudentList: Supabase error:', error);
        throw error;
      }
      
      console.log('StudentList: Query result:', { data, error });
      console.log('StudentList: Number of students found:', data?.length || 0);
      
      if (data && data.length > 0) {
        console.log('StudentList: First student:', data[0]);
      }
      
      if (replace) {
        setStudents(data || []);
      } else {
        setStudents(prev => [ ...(prev || []), ...(data || []) ]);
      }
      setFilteredStudents(prev => replace ? (data || []) : ([...(prev || []), ...(data || [])]));
      setHasMore((data?.length || 0) === PAGE_SIZE);
      setPage(pageNumber);
      
      // Animate content in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
      
    } catch (err) {
      console.error('Error fetching students:', err);
      setError('Failed to load students.');
      Alert.alert('Error', 'Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('StudentList: Component mounted');
    console.log('StudentList: route.params:', route.params);
    console.log('StudentList: classId from params:', classId);
    
    fetchStudents(0, true);
  }, [classId]);

  // Refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    setPage(0);
    setHasMore(true);
    await fetchStudents(0, true);
    setRefreshing(false);
  };

  // Search functionality
  const handleSearch = async (query) => {
    setSearchQuery(query);
    // Server-side search by name; reset paging
    setPage(0);
    setHasMore(true);
    await fetchStudents(0, true);
  };
  
  // Scroll event handler
  const handleScroll = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const shouldShow = offsetY > 150;
    
    if (shouldShow !== showScrollTop) {
      setShowScrollTop(shouldShow);
      Animated.timing(scrollTopOpacity, {
        toValue: shouldShow ? 1 : 0,
        duration: 300,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }
  };

  // Scroll to top function
  const scrollToTop = () => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: 0, animated: true });
    }
  };

  const renderStudent = (item, index) => (
    <TouchableOpacity
      key={item.id}
      style={styles.studentCard}
      onPress={() => {
        console.log('StudentList: Navigating to StudentDetails with student:', item);
        console.log('StudentList: Student ID:', item.id);
        navigation.navigate('StudentDetails', { student: item });
      }}
    >
      <View style={styles.studentCardContent}>
        <View style={styles.avatarContainer}>
          {item.photo_url ? (
            <Image source={{ uri: item.photo_url }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {item.name ? item.name.charAt(0).toUpperCase() : '?'}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.studentInfo}>
          <Text style={styles.studentName}>{item.name}</Text>
          <View style={styles.studentDetails}>
            <View style={styles.detailRow}>
              <Ionicons name="id-card" size={14} color="#666" />
              <Text style={styles.detailText}>Roll No: {item.roll_no || 'N/A'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="school" size={14} color="#666" />
              <Text style={styles.detailText}>
                Class: {item.classes?.class_name} {item.classes?.section}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="people" size={14} color="#666" />
              <Text style={styles.detailText}>
                Parent: {item.parents?.name || 'N/A'}
              </Text>
            </View>
          </View>
        </View>
        
        <View style={styles.chevronContainer}>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="people" size={64} color="#ccc" />
      <Text style={styles.emptyText}>No students found</Text>
      <Text style={styles.emptySubtext}>
        This class doesn't have any students yet
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Students" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading students...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Header title="Students" showBack={true} />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#f44336" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      <Header title="Students" showBack={true} />
      
      {/* Main Content Container - Defines scrollable area */}
      <View style={styles.scrollableContainer}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
          scrollEventThrottle={16}
          onScroll={handleScroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#2196F3']}
              progressBackgroundColor="#fff"
            />
          }
        >
          {/* Header Statistics Card */}
          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <Ionicons name="people" size={24} color="#2196F3" />
              <View style={styles.statContent}>
                <Text style={styles.statNumber}>{students.length}</Text>
                <Text style={styles.statLabel}>Total Students</Text>
              </View>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="school" size={24} color="#4CAF50" />
              <View style={styles.statContent}>
                <Text style={styles.statNumber}>{className || 'N/A'}</Text>
                <Text style={styles.statLabel}>Class - Section {section}</Text>
              </View>
            </View>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search students by name, roll no, or parent..."
                value={searchQuery}
                onChangeText={handleSearch}
                placeholderTextColor="#999"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity 
                  onPress={() => handleSearch('')}
                  style={styles.clearButton}
                >
                  <Ionicons name="close-circle" size={20} color="#ccc" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Students List */}
          <Animated.View style={[styles.studentsContainer, { opacity: fadeAnim }]}>
            {filteredStudents.length > 0 ? (
              <>
                {filteredStudents.map((student, index) => renderStudent(student, index))}
                {/* Load more button for pagination */}
                {hasMore && (
                  <TouchableOpacity
                    onPress={async () => {
                      if (!loadingPage) {
                        setLoadingPage(true);
                        try {
                          await fetchStudents(page + 1, false);
                        } finally {
                          setLoadingPage(false);
                        }
                      }
                    }}
                    style={{ marginTop: 12, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#2196F3', borderRadius: 6 }}
                  >
                    <Text style={{ color: '#fff' }}>{loadingPage ? 'Loading...' : 'Load more'}</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="people" size={64} color="#ccc" />
                <Text style={styles.emptyText}>
                  {searchQuery ? 'No students found' : 'No students in this class'}
                </Text>
                <Text style={styles.emptySubtext}>
                  {searchQuery 
                    ? 'Try adjusting your search criteria'
                    : 'This class doesn\'t have any students yet'
                  }
                </Text>
              </View>
            )}
          </Animated.View>

          {/* Bottom spacing for better scrolling */}
          <View style={styles.bottomSpacing} />
        </ScrollView>
        
        {/* Scroll to top button - Web specific */}
        {Platform.OS === 'web' && (
          <Animated.View 
            style={[
              styles.scrollToTopButton,
              { opacity: scrollTopOpacity }
            ]}
          >
            <TouchableOpacity
              style={styles.scrollToTopInner}
              onPress={scrollToTop}
            >
              <Ionicons name="chevron-up" size={24} color="#fff" />
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Main container styles
  mainContainer: {
    flex: 1,
    backgroundColor: '#f5f5f7',
    ...(Platform.OS === 'web' && {
      height: '100vh',
      maxHeight: '100vh',
      overflow: 'hidden',
      position: 'relative',
    }),
  },
  scrollableContainer: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      height: 'calc(100vh - 60px)', // Adjust based on header height
      maxHeight: 'calc(100vh - 60px)',
      overflow: 'hidden',
    }),
  },
  scrollView: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      height: '100%',
      maxHeight: '100%',
      overflowY: 'scroll',
      overflowX: 'hidden',
      WebkitOverflowScrolling: 'touch',
      scrollBehavior: 'smooth',
      // Force scrollbar to always show
      scrollbarWidth: 'thin',
      scrollbarColor: '#2196F3 #f5f5f7',
    }),
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 100, // More bottom padding for scrollability
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  
  // Loading and error states
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
  },
  
  // Statistics card
  statsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statContent: {
    marginLeft: 12,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 20,
  },
  
  // Search container
  searchContainer: {
    marginBottom: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    ...(Platform.OS === 'web' && {
      outline: 'none',
    }),
  },
  clearButton: {
    padding: 4,
  },
  
  // Students container
  studentsContainer: {
    flex: 1,
  },
  
  // Student card styles
  studentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    }),
  },
  studentCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#eee',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  studentDetails: {
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  detailText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 8,
  },
  chevronContainer: {
    marginLeft: 12,
  },
  
  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  
  // Bottom spacing
  bottomSpacing: {
    height: 100, // Increased for better scrollability
  },
  
  // Scroll to top button
  scrollToTopButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    zIndex: 1000,
  },
  scrollToTopInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    }),
  },
});

export default StudentList; 