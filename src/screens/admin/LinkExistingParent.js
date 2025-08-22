import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';

const LinkExistingParent = ({ route, navigation }) => {
  const { student } = route.params;
  
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [parentSearchResults, setParentSearchResults] = useState([]);
  const [parentSearchQuery, setParentSearchQuery] = useState('');
  const [selectedParentAccount, setSelectedParentAccount] = useState(null);
  const [linkingRelation, setLinkingRelation] = useState('Guardian');

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
      
      // Show success alert and navigate back
      Alert.alert(
        'Success',
        `✅ Successfully linked ${selectedParentAccount.full_name} to ${student.name}!\n\n📧 Parent Email: ${selectedParentAccount.email}\n👤 Relation: ${linkingRelation}\n\n✨ The parent can now access this student's information.`,
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.goBack(); // Go back to Parent Account Management
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('Error linking parent:', error);
      Alert.alert('Error', `Failed to link parent: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Clear search when query is empty
  useEffect(() => {
    if (parentSearchQuery.trim() === '') {
      setParentSearchResults([]);
      setSelectedParentAccount(null);
    }
  }, [parentSearchQuery]);

  return (
    <View style={styles.container}>
      <Header 
        title="Link Existing Parent" 
        showBack={true} 
        onBack={() => navigation.goBack()} 
      />
      
      <KeyboardAvoidingView 
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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

          {/* Add some bottom padding */}
          <View style={{ height: 100 }} />
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
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    padding: 16,
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
});

export default LinkExistingParent;
