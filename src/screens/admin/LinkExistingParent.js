import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';
import FloatingRefreshButton from '../../components/FloatingRefreshButton';

// Import CSS for web animations
if (Platform.OS === 'web') {
  require('./LinkExistingParent.css');
}

const LinkExistingParent = ({ route, navigation }) => {
  const { student } = route.params;
  
  // Existing state
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [parentSearchResults, setParentSearchResults] = useState([]);
  const [parentSearchQuery, setParentSearchQuery] = useState('');
  const [selectedParentAccount, setSelectedParentAccount] = useState(null);
  const [linkingRelation, setLinkingRelation] = useState('Guardian');
  
  // Success state for enhanced success message
  const [linkSuccess, setLinkSuccess] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const successOpacity = useRef(new Animated.Value(0)).current;
  
  // Web scrolling state and refs
  const scrollViewRef = useRef(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollTopOpacity = useRef(new Animated.Value(0)).current;

  // Search for existing parent accounts
  const searchParentAccounts = async () => {
    if (!parentSearchQuery.trim()) {
      setParentSearchResults([]);
      return;
    }
    
    try {
      setSearchLoading(true);
      const { data: searchResults, error } = await dbHelpers.searchParentAccounts(parentSearchQuery.trim());
      
      if (error) {
        console.error('Error searching parent accounts:', error);
        Alert.alert('Error', 'Failed to search parent accounts');
        return;
      }
      
      setParentSearchResults(searchResults || []);
    } catch (error) {
      console.error('Error in searchParentAccounts:', error);
      Alert.alert('Error', 'Failed to search parent accounts');
    } finally {
      setSearchLoading(false);
    }
  };

  // Handle linking selected parent account
  const handleLinkSelectedParent = async () => {
    if (!selectedParentAccount || !student) {
      Alert.alert('Error', 'Please select a parent account to link');
      return;
    }
    
    try {
      setLoading(true);
      
      const { data: linkResult, error: linkError } = await dbHelpers.linkParentToAdditionalStudent(
        selectedParentAccount.email,
        student.id,
        linkingRelation
      );
      
      if (linkError) {
        console.error('Error linking parent:', linkError);
        Alert.alert('Error', `Failed to link parent: ${linkError.message || linkError}`);
        return;
      }
      
      // Show enhanced success message
      setSuccessData({
        parentName: selectedParentAccount.full_name,
        parentEmail: selectedParentAccount.email,
        studentName: student.name,
        relation: linkingRelation
      });
      setLinkSuccess(true);
      
      // Animate success message in
      Animated.timing(successOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
      
      // Auto-hide after 4 seconds and navigate back
      setTimeout(() => {
        hideSuccessMessage();
      }, 4000);
      
    } catch (error) {
      console.error('Error linking parent:', error);
      Alert.alert('Error', `Failed to link parent: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Hide success message and navigate back
  const hideSuccessMessage = () => {
    Animated.timing(successOpacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      setLinkSuccess(false);
      setSuccessData(null);
      navigation.goBack(); // Go back to Parent Account Management
    });
  };

  // Clear search when query is empty
  useEffect(() => {
    if (parentSearchQuery.trim() === '') {
      setParentSearchResults([]);
      setSelectedParentAccount(null);
    }
  }, [parentSearchQuery]);

  // Web scrolling functions
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

  const scrollToTop = () => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: 0, animated: true });
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Re-run the search if there's a query
      if (parentSearchQuery.trim()) {
        await searchParentAccounts();
      }
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={styles.mainContainer}>
      <Header 
        title="Link Existing Parent" 
        showBack={true} 
        onBack={() => navigation.goBack()} 
      />
      
      <View style={styles.scrollableContainer}>
        <KeyboardAvoidingView 
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView 
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
            onScroll={handleScroll}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#2196F3']}
              />
            }
          >
          {/* Student Info Card */}
          <View style={styles.studentCard}>
            <View style={styles.studentHeader}>
              <Ionicons name="person" size={24} color="#2196F3" />
              <Text style={styles.studentHeaderText}>Student Information</Text>
            </View>
            <Text style={styles.studentName}>{student.name}</Text>
            <Text style={styles.studentDetail}>Admission No: {student.admission_no || 'N/A'}</Text>
            <Text style={styles.studentDetail}>
              Class: {student.classes?.class_name} {student.classes?.section}
            </Text>
            <Text style={styles.studentDetail}>Roll No: {student.roll_no || 'N/A'}</Text>
          </View>

          {/* Search Section */}
          <View style={styles.searchCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="search" size={24} color="#9C27B0" />
              <Text style={styles.sectionHeaderText}>Search Parent Accounts</Text>
            </View>
            
            <Text style={styles.searchLabel}>Enter parent's name or email address</Text>
            <View style={styles.searchSection}>
              <View style={styles.searchInputContainer}>
                <Ionicons name="search" size={20} color="#666" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by name or email..."
                  value={parentSearchQuery}
                  onChangeText={setParentSearchQuery}
                  onSubmitEditing={searchParentAccounts}
                  returnKeyType="search"
                />
              </View>
              <TouchableOpacity
                style={[styles.searchButton, searchLoading && styles.searchButtonDisabled]}
                onPress={searchParentAccounts}
                disabled={searchLoading || !parentSearchQuery.trim()}
              >
                {searchLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="search" size={16} color="#fff" />
                    <Text style={styles.searchButtonText}>Search</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Search Results */}
          <View style={styles.resultsCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="people" size={24} color="#4CAF50" />
              <Text style={styles.sectionHeaderText}>Search Results</Text>
            </View>

            {parentSearchResults.length > 0 ? (
              <>
                <Text style={styles.resultsHeader}>
                  Found {parentSearchResults.length} parent account(s):
                </Text>
                {parentSearchResults.map((parent) => (
                  <TouchableOpacity
                    key={parent.id}
                    style={[
                      styles.parentResultItem,
                      selectedParentAccount?.id === parent.id && styles.parentResultItemSelected
                    ]}
                    onPress={() => setSelectedParentAccount(parent)}
                  >
                    <View style={styles.parentResultInfo}>
                      <Text style={styles.parentResultName}>{parent.full_name}</Text>
                      <Text style={styles.parentResultEmail}>{parent.email}</Text>
                      {parent.phone && (
                        <Text style={styles.parentResultPhone}>📱 {parent.phone}</Text>
                      )}
                    </View>
                    {selectedParentAccount?.id === parent.id && (
                      <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                    )}
                  </TouchableOpacity>
                ))}
              </>
            ) : parentSearchQuery.trim() !== '' && !searchLoading ? (
              <View style={styles.noResultsContainer}>
                <Ionicons name="search" size={48} color="#BDBDBD" />
                <Text style={styles.noResultsText}>No parent accounts found</Text>
                <Text style={styles.noResultsSubtext}>
                  Try searching with a different name or email
                </Text>
              </View>
            ) : (
              <View style={styles.searchPromptContainer}>
                <Ionicons name="people-outline" size={48} color="#BDBDBD" />
                <Text style={styles.searchPromptText}>
                  Enter name or email to search for existing parent accounts
                </Text>
              </View>
            )}
          </View>

          {/* Relation Selection */}
          {selectedParentAccount && (
            <View style={styles.relationCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="heart" size={24} color="#FF5722" />
                <Text style={styles.sectionHeaderText}>Select Relation</Text>
              </View>
              
              <Text style={styles.relationLabel}>
                How is {selectedParentAccount.full_name} related to {student.name}?
              </Text>
              
              <View style={styles.relationContainer}>
                <TouchableOpacity
                  style={[
                    styles.relationButton,
                    linkingRelation === 'Father' && styles.relationButtonSelected
                  ]}
                  onPress={() => setLinkingRelation('Father')}
                >
                  <Ionicons 
                    name="man" 
                    size={20} 
                    color={linkingRelation === 'Father' ? '#fff' : '#666'} 
                  />
                  <Text style={[
                    styles.relationButtonText,
                    linkingRelation === 'Father' && styles.relationButtonTextSelected
                  ]}>
                    Father
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.relationButton,
                    linkingRelation === 'Mother' && styles.relationButtonSelected
                  ]}
                  onPress={() => setLinkingRelation('Mother')}
                >
                  <Ionicons 
                    name="woman" 
                    size={20} 
                    color={linkingRelation === 'Mother' ? '#fff' : '#666'} 
                  />
                  <Text style={[
                    styles.relationButtonText,
                    linkingRelation === 'Mother' && styles.relationButtonTextSelected
                  ]}>
                    Mother
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.relationButton,
                    linkingRelation === 'Guardian' && styles.relationButtonSelected
                  ]}
                  onPress={() => setLinkingRelation('Guardian')}
                >
                  <Ionicons 
                    name="shield" 
                    size={20} 
                    color={linkingRelation === 'Guardian' ? '#fff' : '#666'} 
                  />
                  <Text style={[
                    styles.relationButtonText,
                    linkingRelation === 'Guardian' && styles.relationButtonTextSelected
                  ]}>
                    Guardian
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Link Summary */}
              <View style={styles.linkSummaryContainer}>
                <Text style={styles.linkSummaryTitle}>Link Summary:</Text>
                <Text style={styles.linkSummaryText}>
                  👤 Parent: {selectedParentAccount.full_name}
                </Text>
                <Text style={styles.linkSummaryText}>
                  📧 Email: {selectedParentAccount.email}
                </Text>
                <Text style={styles.linkSummaryText}>
                  👶 Student: {student.name}
                </Text>
                <Text style={styles.linkSummaryText}>
                  💖 Relation: {linkingRelation}
                </Text>
              </View>
            </View>
          )}

            {/* Bottom spacing for better scroll experience */}
            <View style={styles.bottomSpacing} />
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="close" size={16} color="#666" />
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.linkButton,
                (!selectedParentAccount || loading) && styles.linkButtonDisabled
              ]}
              onPress={handleLinkSelectedParent}
              disabled={loading || !selectedParentAccount}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="link" size={16} color="#fff" />
                  <Text style={styles.linkButtonText}>Link Parent Account</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
      
      {/* Floating Refresh Button */}
      <FloatingRefreshButton 
        onRefresh={searchParentAccounts}
        isRefreshing={loading || searchLoading}
        bottom={80}
      />
      
      {/* Scroll to Top Button (Web Only) */}
      {Platform.OS === 'web' && (
        <Animated.View 
          style={[styles.scrollToTopButton, { opacity: scrollTopOpacity }]}
        >
          <TouchableOpacity style={styles.scrollToTopInner} onPress={scrollToTop}>
            <Ionicons name="chevron-up" size={24} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      )}
      
      {/* Enhanced Success Message Overlay */}
      {linkSuccess && successData && (
        <Animated.View style={[styles.successOverlay, { opacity: successOpacity }]} className={Platform.OS === 'web' ? 'success-overlay' : undefined}>
          <View style={styles.successCard} className={Platform.OS === 'web' ? 'success-card' : undefined}>
            <View style={styles.successHeader}>
              <View style={styles.successIconContainer}>
                <Ionicons name="checkmark-circle" size={48} color="#4CAF50" className={Platform.OS === 'web' ? 'success-icon' : undefined} />
              </View>
              <Text style={styles.successTitle}>Parent Account Linked!</Text>
            </View>
            
            <View style={styles.successContent}>
              <View style={styles.successDetailRow} className={Platform.OS === 'web' ? 'success-detail-row' : undefined}>
                <Ionicons name="person" size={20} color="#666" />
                <Text style={styles.successDetailLabel}>Parent:</Text>
                <Text style={styles.successDetailValue}>{successData.parentName}</Text>
              </View>
              
              <View style={styles.successDetailRow} className={Platform.OS === 'web' ? 'success-detail-row' : undefined}>
                <Ionicons name="mail" size={20} color="#666" />
                <Text style={styles.successDetailLabel}>Email:</Text>
                <Text style={styles.successDetailValue}>{successData.parentEmail}</Text>
              </View>
              
              <View style={styles.successDetailRow} className={Platform.OS === 'web' ? 'success-detail-row' : undefined}>
                <Ionicons name="school" size={20} color="#666" />
                <Text style={styles.successDetailLabel}>Student:</Text>
                <Text style={styles.successDetailValue}>{successData.studentName}</Text>
              </View>
              
              <View style={styles.successDetailRow} className={Platform.OS === 'web' ? 'success-detail-row' : undefined}>
                <Ionicons name="heart" size={20} color="#666" />
                <Text style={styles.successDetailLabel}>Relation:</Text>
                <Text style={styles.successDetailValue}>{successData.relation}</Text>
              </View>
            </View>
            
            <Text style={styles.successMessage}>
              ✨ The parent can now access this student's information
            </Text>
            
            <TouchableOpacity 
              style={styles.successButton}
              className={Platform.OS === 'web' ? 'success-button' : undefined}
              onPress={hideSuccessMessage}
            >
              <Text style={styles.successButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  // 🎯 CRITICAL: Main container with fixed viewport height
  mainContainer: {
    flex: 1,
    backgroundColor: '#f5f5f7',
    ...(Platform.OS === 'web' && {
      height: '100vh',           // ✅ CRITICAL: Fixed viewport height
      maxHeight: '100vh',        // ✅ CRITICAL: Prevent expansion
      overflow: 'hidden',        // ✅ CRITICAL: Hide overflow on main container
      position: 'relative',      // ✅ CRITICAL: For absolute positioning
    }),
  },
  
  // 🎯 CRITICAL: Scrollable area with calculated height
  scrollableContainer: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      height: 'calc(100vh - 60px)',      // ✅ CRITICAL: Account for header (adjust 60px)
      maxHeight: 'calc(100vh - 60px)',   // ✅ CRITICAL: Prevent expansion
      overflow: 'hidden',                // ✅ CRITICAL: Control overflow
    }),
  },
  
  // KeyboardAvoidingView container
  keyboardContainer: {
    flex: 1,
  },
  
  // 🎯 CRITICAL: ScrollView with explicit overflow
  scrollView: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      height: '100%',                    // ✅ CRITICAL: Full height
      maxHeight: '100%',                 // ✅ CRITICAL: Prevent expansion
      overflowY: 'scroll',              // ✅ CRITICAL: Enable vertical scroll
      overflowX: 'hidden',              // ✅ CRITICAL: Disable horizontal scroll
      WebkitOverflowScrolling: 'touch', // ✅ GOOD: Smooth iOS scrolling
      scrollBehavior: 'smooth',         // ✅ GOOD: Smooth animations
      scrollbarWidth: 'thin',           // ✅ GOOD: Thin scrollbars
      scrollbarColor: '#2196F3 #f5f5f7', // ✅ GOOD: Custom scrollbar colors
    }),
  },
  
  // 🎯 CRITICAL: Content container properties
  scrollContent: {
    flexGrow: 1,                    // ✅ CRITICAL: Allow content to grow
    padding: 16,
    paddingBottom: 120,             // ✅ IMPORTANT: Extra bottom padding for action buttons
  },
  
  // 🎯 GOOD TO HAVE: Bottom spacing for better scroll experience
  bottomSpacing: {
    height: 100,                    // ✅ IMPORTANT: Extra space at bottom
  },
  
  // Card Styles
  studentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  searchCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#9C27B0',
  },
  resultsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  relationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#FF5722',
  },

  // Header Styles
  studentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  studentHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2196F3',
    marginLeft: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },

  // Student Info Styles
  studentName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  studentDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },

  // Search Styles
  searchLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  searchSection: {
    flexDirection: 'row',
    gap: 8,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#2196F3',
    borderRadius: 8,
    gap: 6,
    minWidth: 100,
    justifyContent: 'center',
  },
  searchButtonDisabled: {
    backgroundColor: '#BDBDBD',
    opacity: 0.7,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Results Styles
  resultsHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  parentResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  parentResultItemSelected: {
    backgroundColor: '#E8F5E8',
    borderColor: '#4CAF50',
    borderWidth: 2,
  },
  parentResultInfo: {
    flex: 1,
  },
  parentResultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  parentResultEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  parentResultPhone: {
    fontSize: 14,
    color: '#666',
  },
  noResultsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noResultsText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
    textAlign: 'center',
  },
  noResultsSubtext: {
    fontSize: 14,
    color: '#BDBDBD',
    marginTop: 8,
    textAlign: 'center',
  },
  searchPromptContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  searchPromptText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },

  // Relation Styles
  relationLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  relationContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  relationButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#fff',
    gap: 8,
  },
  relationButtonSelected: {
    backgroundColor: '#9C27B0',
    borderColor: '#9C27B0',
  },
  relationButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  relationButtonTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },

  // Link Summary Styles
  linkSummaryContainer: {
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E3F2FD',
  },
  linkSummaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 8,
  },
  linkSummaryText: {
    fontSize: 14,
    color: '#424242',
    marginBottom: 4,
  },

  // Action Buttons
  actionContainer: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 8,
    gap: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    gap: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  linkButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#9C27B0',
    borderRadius: 8,
    gap: 8,
  },
  linkButtonDisabled: {
    backgroundColor: '#BDBDBD',
    opacity: 0.7,
  },
  linkButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  
  // Scroll to Top Button (Web Only)
  scrollToTopButton: {
    position: 'absolute',
    bottom: 140,
    right: 20,
    zIndex: 1000,
    ...Platform.select({
      web: {
        position: 'fixed',
        bottom: 140,
        right: 20,
      },
    }),
  },
  scrollToTopInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.15)',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
      },
    }),
  },
  
  // 🎉 Enhanced Success Message Styles
  successOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    ...Platform.select({
      web: {
        position: 'fixed',
        backdropFilter: 'blur(4px)',
      },
    }),
  },
  successCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 20,
    maxWidth: 400,
    width: '100%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    ...Platform.select({
      web: {
        boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.2)',
        animation: 'slideInFromBottom 0.5s ease-out',
      },
    }),
  },
  successHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  successIconContainer: {
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2E7D32',
    textAlign: 'center',
  },
  successContent: {
    marginBottom: 20,
  },
  successDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  successDetailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginLeft: 8,
    minWidth: 60,
  },
  successDetailValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    marginLeft: 8,
    fontWeight: '500',
  },
  successMessage: {
    fontSize: 16,
    color: '#4CAF50',
    textAlign: 'center',
    fontWeight: '500',
    marginBottom: 24,
    lineHeight: 22,
  },
  successButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        '&:hover': {
          backgroundColor: '#45A049',
          transform: 'translateY(-1px)',
        },
      },
    }),
  },
  successButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default LinkExistingParent;
