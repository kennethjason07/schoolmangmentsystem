import React from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';

const { width, height } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const isTablet = width >= 768;

const LeaveApplicationList = ({
  myLeaves,
  loading,
  refreshing,
  onRefresh,
  teacherProfile,
  getStatusColor,
  getStatusIcon,
  scrollSettings
}) => {
  const renderLeaveApplication = ({ item, index }) => {
    const startDate = parseISO(item.start_date);
    const endDate = parseISO(item.end_date);
    
    return (
      <View style={[
        styles.leaveCard,
        isWeb && styles.leaveCardWeb,
        index === myLeaves.length - 1 && styles.lastLeaveCard
      ]}>
        <View style={styles.leaveHeader}>
          <View style={styles.leaveInfo}>
            <Text style={styles.leaveType}>{item.leave_type}</Text>
            <Text style={styles.leaveDates}>
              {format(startDate, 'MMM dd, yyyy')} - {format(endDate, 'MMM dd, yyyy')}
              {item.total_days && (
                <Text style={styles.totalDaysText}>
                  {' '}({item.total_days} {item.total_days === 1 ? 'day' : 'days'})
                </Text>
              )}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Ionicons name={getStatusIcon(item.status)} size={14} color="#FFFFFF" />
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>

        <View style={styles.leaveDetails}>
          <View style={styles.reasonRow}>
            <Ionicons name="document-text" size={16} color="#666" />
            <Text style={styles.reasonText}>{item.reason}</Text>
          </View>

          {item.replacement_teacher && (
            <View style={styles.replacementRow}>
              <Ionicons name="person" size={16} color="#4CAF50" />
              <Text style={styles.replacementText}>
                Replacement: {item.replacement_teacher.name}
              </Text>
            </View>
          )}

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="calendar" size={12} color="#999" />
              <Text style={styles.metaText}>
                Applied: {format(parseISO(item.applied_date), 'MMM dd, yyyy')}
              </Text>
            </View>
            {item.reviewed_at && (
              <View style={styles.metaItem}>
                <Ionicons name="checkmark-done" size={12} color="#999" />
                <Text style={styles.metaText}>
                  Reviewed: {format(parseISO(item.reviewed_at), 'MMM dd, yyyy')}
                </Text>
              </View>
            )}
          </View>
        </View>

        {item.admin_remarks && (
          <View style={styles.remarksSection}>
            <Text style={styles.remarksLabel}>Admin Remarks:</Text>
            <Text style={styles.remarksText}>{item.admin_remarks}</Text>
          </View>
        )}

        {item.replacement_notes && (
          <View style={styles.replacementNotesSection}>
            <Text style={styles.replacementNotesLabel}>Replacement Instructions:</Text>
            <Text style={styles.replacementNotesText}>{item.replacement_notes}</Text>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading leave data...</Text>
      </View>
    );
  }

  if (!teacherProfile) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={64} color="#F44336" />
        <Text style={styles.errorText}>Access Denied</Text>
        <Text style={styles.errorSubtext}>
          You don't have permission to access leave management. Please contact your administrator.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.listContainer}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        {...scrollSettings}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={['#4CAF50']}
            progressBackgroundColor="#fff"
            tintColor="#4CAF50"
            titleColor="#1976d2"
            title="Pull to refresh leave data"
          />
        }
      >
        {/* Content wrapper with padding for better scrolling */}
        <View style={styles.contentWrapper}>
          {myLeaves.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="document-text" size={64} color="#CCCCCC" />
              </View>
              <Text style={styles.emptyText}>No leave applications yet</Text>
              <Text style={styles.emptySubtext}>
                Your submitted leave applications will appear here
              </Text>
              <View style={styles.emptyActionContainer}>
                <Text style={styles.emptyActionText}>
                  Tap the "Apply for Leave" button above to submit your first leave request
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.leavesListWrapper}>
              {myLeaves.map((item, index) => (
                <View key={item.id}>
                  {renderLeaveApplication({ item, index })}
                </View>
              ))}
              
              {/* Add some bottom padding for better scrolling */}
              <View style={styles.bottomPadding} />
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  listContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5'
  },
  scrollView: {
    flex: 1
  },
  scrollViewContent: {
    flexGrow: 1,
    ...(isWeb && {
      minHeight: '100%'
    })
  },
  contentWrapper: {
    paddingHorizontal: 16,
    paddingTop: 8
  },

  // Loading and Error Styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    textAlign: 'center'
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40
  },
  errorText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F44336',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center'
  },
  errorSubtext: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    lineHeight: 24
  },

  // Empty State Styles
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 8,
    textAlign: 'center'
  },
  emptySubtext: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
    lineHeight: 22
  },
  emptyActionContainer: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 10
  },
  emptyActionText: {
    fontSize: 14,
    color: '#1976D2',
    textAlign: 'center',
    fontStyle: 'italic'
  },

  // Leave List Styles
  leavesListWrapper: {
    paddingBottom: 20
  },
  leaveCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0'
  },
  leaveCardWeb: {
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
    borderColor: '#e8e8e8'
  },
  lastLeaveCard: {
    marginBottom: 32
  },
  leaveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  leaveInfo: {
    flex: 1
  },
  leaveType: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4
  },
  leaveDates: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500'
  },
  totalDaysText: {
    fontSize: 14,
    color: '#1976D2',
    fontWeight: '600'
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 12
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 4
  },
  leaveDetails: {
    gap: 10
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10
  },
  reasonText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    lineHeight: 20
  },
  replacementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8
  },
  replacementText: {
    fontSize: 14,
    color: '#4CAF50',
    flex: 1,
    fontWeight: '600'
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0'
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  metaText: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500'
  },
  remarksSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8
  },
  remarksLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F57C00',
    marginBottom: 4
  },
  remarksText: {
    fontSize: 14,
    color: '#E65100',
    fontStyle: 'italic',
    lineHeight: 20
  },
  replacementNotesSection: {
    marginTop: 8,
    paddingTop: 8,
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8
  },
  replacementNotesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
    marginBottom: 4
  },
  replacementNotesText: {
    fontSize: 14,
    color: '#388E3C',
    lineHeight: 20
  },

  // Padding Styles
  bottomPadding: {
    height: 40
  }
});

export default LeaveApplicationList;
