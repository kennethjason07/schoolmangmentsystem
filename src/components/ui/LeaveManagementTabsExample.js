import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { CompactTabs, TabPresets } from './CompactTabs';
import Colors from '../../constants/Colors';
import Theme from '../../constants/Theme';

// Example showing how to replace the bulky Leave Management filter tabs
const LeaveManagementTabsExample = () => {
  const [selectedStatus, setSelectedStatus] = useState('All');

  // Count badges (you would get these from your actual data)
  const getStatusCount = (status) => {
    // Replace with your actual filtering logic
    const counts = {
      All: 15,
      Pending: 5,
      Approved: 8,
      Rejected: 2,
    };
    return status === 'All' ? undefined : counts[status];
  };

  // Create tabs with dynamic badges
  const leaveTabs = [
    { 
      label: 'All', 
      value: 'All',
      badge: undefined // Don't show badge count for "All"
    },
    { 
      label: 'Pending', 
      value: 'Pending',
      badge: getStatusCount('Pending')
    },
    { 
      label: 'Approved', 
      value: 'Approved',
      badge: getStatusCount('Approved')
    },
    { 
      label: 'Rejected', 
      value: 'Rejected',
      badge: getStatusCount('Rejected')
    },
  ];

  const handleTabChange = (tabValue) => {
    setSelectedStatus(tabValue);
    // Call your filtering function here
    // filterApplications(tabValue);
  };

  return (
    <View style={styles.container}>
      {/* 
        OLD WAY - Taking ~60px height:
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
          {statusFilters.map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterTab,           // paddingVertical: 10 (20px)
                selectedStatus === status && styles.activeFilterTab
              ]}
              onPress={() => setSelectedStatus(status)}
            >
              <Text style={[styles.filterTabText, ...]}>
                {status}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      */}

      {/* NEW WAY - Only ~40px height total! */}
      <CompactTabs
        tabs={leaveTabs}
        activeTab={selectedStatus}
        onTabChange={handleTabChange}
        variant="default"
        scrollable={true}
        showBorder={true}
        style={styles.compactTabsContainer}
      />

      {/* Alternative: Even more compact pills style */}
      <CompactTabs
        tabs={leaveTabs}
        activeTab={selectedStatus}
        onTabChange={handleTabChange}
        variant="pills"
        scrollable={true}
        showBorder={false}
        style={styles.pillsContainer}
      />

      {/* Alternative: Minimal underline style */}
      <CompactTabs
        tabs={leaveTabs}
        activeTab={selectedStatus}
        onTabChange={handleTabChange}
        variant="minimal"
        scrollable={true}
        showBorder={true}
        style={styles.minimalContainer}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background,
  },
  
  // Compact tabs container - matches your existing styling but much more compact
  compactTabsContainer: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    ...Theme.Shadows.sm,
  },
  
  // Pills style - even more compact and modern
  pillsContainer: {
    backgroundColor: Colors.background,
    marginTop: Theme.Spacing.sm,
  },
  
  // Minimal style - clean underline approach
  minimalContainer: {
    backgroundColor: Colors.surface,
    marginTop: Theme.Spacing.sm,
  },
});

export default LeaveManagementTabsExample;

/*
HEIGHT COMPARISON:

OLD BULKY TABS:
- Container paddingVertical: 12px (24px total)
- Tab paddingVertical: 10px (20px total)
- Margins and borders: ~16px
- TOTAL: ~60px height

NEW COMPACT TABS:
- Container paddingVertical: 4px (8px total)
- Tab minHeight: 32px
- Minimal margins: ~4px
- TOTAL: ~40px height

SPACE SAVED: 33% reduction (20px less height)

USAGE IN LeaveManagement.js:

1. Import:
   import { CompactTabs } from '../../components/ui';

2. Replace lines 368-387 with:
   <CompactTabs
     tabs={statusFilters.map(status => ({ 
       label: status, 
       value: status,
       badge: status === 'Pending' ? pendingCount : undefined
     }))}
     activeTab={selectedStatus}
     onTabChange={setSelectedStatus}
     variant="default"
     scrollable={true}
     showBorder={true}
   />

3. Remove the old filter styles (lines 802-838)

*/
