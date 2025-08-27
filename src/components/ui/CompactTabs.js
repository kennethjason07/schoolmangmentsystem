import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Theme from '../../constants/Theme';
import Colors from '../../constants/Colors';

const CompactTab = ({
  label,
  isActive = false,
  onPress,
  badge,
  icon,
  variant = 'default', // default, minimal, pills
  disabled = false,
}) => {
  const getTabStyles = () => {
    if (disabled) {
      return {
        backgroundColor: Colors.lightGray,
        borderColor: Colors.border,
        textColor: Colors.textLight,
      };
    }

    if (isActive) {
      return {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
        textColor: Colors.white,
      };
    }

    switch (variant) {
      case 'minimal':
        return {
          backgroundColor: 'transparent',
          borderColor: 'transparent',
          textColor: Colors.textSecondary,
        };
      case 'pills':
        return {
          backgroundColor: Colors.lightGray,
          borderColor: 'transparent',
          textColor: Colors.text,
        };
      default:
        return {
          backgroundColor: Colors.surface,
          borderColor: Colors.border,
          textColor: Colors.text,
        };
    }
  };

  const tabStyles = getTabStyles();

  return (
    <TouchableOpacity
      style={[
        styles.tab,
        variant === 'minimal' && styles.tabMinimal,
        variant === 'pills' && styles.tabPills,
        {
          backgroundColor: tabStyles.backgroundColor,
          borderColor: tabStyles.borderColor,
        },
        isActive && styles.tabActive,
        disabled && styles.tabDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={14}
          color={tabStyles.textColor}
          style={styles.tabIcon}
        />
      )}
      
      <Text
        style={[
          styles.tabText,
          variant === 'minimal' && styles.tabTextMinimal,
          { color: tabStyles.textColor },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>

      {badge !== undefined && badge > 0 && (
        <View style={[styles.badge, isActive && styles.badgeActive]}>
          <Text style={[styles.badgeText, isActive && styles.badgeTextActive]}>
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      )}

      {isActive && variant !== 'minimal' && (
        <View style={styles.activeIndicator} />
      )}
    </TouchableOpacity>
  );
};

const CompactTabs = ({
  tabs = [],
  activeTab,
  onTabChange,
  variant = 'default', // default, minimal, pills
  scrollable = true,
  showBorder = true,
  style,
  contentContainerStyle,
}) => {
  const renderTab = (tab, index) => (
    <CompactTab
      key={tab.key || tab.value || index}
      label={tab.label}
      isActive={activeTab === (tab.value || tab.key)}
      onPress={() => onTabChange?.(tab.value || tab.key, tab)}
      badge={tab.badge}
      icon={tab.icon}
      variant={variant}
      disabled={tab.disabled}
    />
  );

  const containerStyle = [
    styles.container,
    variant === 'minimal' && styles.containerMinimal,
    variant === 'pills' && styles.containerPills,
    showBorder && styles.containerWithBorder,
    style,
  ];

  if (scrollable) {
    return (
      <View style={containerStyle}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
        >
          {tabs.map(renderTab)}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <View style={[styles.tabsContainer, contentContainerStyle]}>
        {tabs.map(renderTab)}
      </View>
    </View>
  );
};

// Preset configurations for common use cases
export const TabPresets = {
  status: [
    { label: 'All', value: 'all', icon: 'list' },
    { label: 'Pending', value: 'pending', icon: 'time', badge: 5 },
    { label: 'Approved', value: 'approved', icon: 'checkmark-circle' },
    { label: 'Rejected', value: 'rejected', icon: 'close-circle' },
  ],
  
  leaveStatus: [
    { label: 'All', value: 'all' },
    { label: 'Pending', value: 'pending', badge: 3 },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
  ],

  attendance: [
    { label: 'All', value: 'all' },
    { label: 'Present', value: 'present', icon: 'checkmark' },
    { label: 'Absent', value: 'absent', icon: 'close' },
    { label: 'Late', value: 'late', icon: 'time' },
  ],

  grades: [
    { label: 'All Classes', value: 'all' },
    { label: 'Class 1', value: '1' },
    { label: 'Class 2', value: '2' },
    { label: 'Class 3', value: '3' },
    { label: 'Class 4', value: '4' },
  ],
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    paddingVertical: Theme.Spacing.xs, // Minimal vertical padding
  },
  containerMinimal: {
    backgroundColor: 'transparent',
    paddingVertical: 0,
  },
  containerPills: {
    backgroundColor: Colors.background,
    paddingVertical: Theme.Spacing.sm,
    paddingHorizontal: Theme.Spacing.base,
  },
  containerWithBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  
  scrollContent: {
    paddingHorizontal: Theme.Spacing.base,
    alignItems: 'center',
  },
  
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: Theme.Spacing.base,
  },

  // Tab Styles - MUCH MORE COMPACT
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.Spacing.md, // 12px horizontal
    paddingVertical: Theme.Spacing.xs,   // 4px vertical - VERY COMPACT!
    marginRight: Theme.Spacing.sm,
    borderRadius: Theme.BorderRadius.base,
    borderWidth: 1,
    minHeight: 32, // Only 32px height instead of 80-100px!
    position: 'relative',
  },
  
  tabMinimal: {
    borderWidth: 0,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    borderRadius: 0,
    paddingVertical: Theme.Spacing.sm,
    minHeight: 36,
  },
  
  tabPills: {
    borderWidth: 0,
    borderRadius: Theme.BorderRadius.full,
    paddingHorizontal: Theme.Spacing.base,
    minHeight: 28, // Even more compact for pills
  },

  tabActive: {
    // Active state handled by getTabStyles
  },

  tabDisabled: {
    opacity: 0.5,
  },

  // Text and Icon Styles
  tabIcon: {
    marginRight: Theme.Spacing.xs,
  },
  
  tabText: {
    fontSize: Theme.Typography.sizes.sm, // 12px font
    fontWeight: Theme.Typography.weights.medium,
    lineHeight: 16, // Tight line height
  },
  
  tabTextMinimal: {
    fontSize: Theme.Typography.sizes.base,
    fontWeight: Theme.Typography.weights.semibold,
  },

  // Badge Styles
  badge: {
    backgroundColor: Colors.error,
    borderRadius: Theme.BorderRadius.full,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    marginLeft: Theme.Spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  badgeActive: {
    backgroundColor: Colors.white,
  },
  
  badgeText: {
    fontSize: 10,
    fontWeight: Theme.Typography.weights.bold,
    color: Colors.white,
    lineHeight: 12,
  },
  
  badgeTextActive: {
    color: Colors.error,
  },

  // Active Indicator for Minimal Style
  activeIndicator: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: Colors.primary,
    borderRadius: 1,
  },
});

export { CompactTab };
export default CompactTabs;
