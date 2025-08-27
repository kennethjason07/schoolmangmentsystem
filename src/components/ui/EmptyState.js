import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Theme from '../../constants/Theme';
import Colors from '../../constants/Colors';
import Button from './Button';

const EmptyState = ({
  icon,
  title,
  description,
  illustration,
  actionText,
  onActionPress,
  secondaryActionText,
  onSecondaryActionPress,
  variant = 'default', // default, compact, minimal
  style,
  iconStyle,
  titleStyle,
  descriptionStyle,
}) => {
  const getIconSize = () => {
    switch (variant) {
      case 'compact':
        return 48;
      case 'minimal':
        return 32;
      default:
        return 64;
    }
  };

  const getSpacing = () => {
    switch (variant) {
      case 'compact':
        return Theme.Spacing.md;
      case 'minimal':
        return Theme.Spacing.sm;
      default:
        return Theme.Spacing.lg;
    }
  };

  const renderIcon = () => {
    if (illustration) {
      return (
        <Image
          source={illustration}
          style={[styles.illustration, iconStyle]}
          resizeMode="contain"
        />
      );
    }

    if (icon) {
      return (
        <View style={[styles.iconContainer, { marginBottom: getSpacing() }]}>
          <Ionicons
            name={icon}
            size={getIconSize()}
            color={Colors.textLight}
            style={iconStyle}
          />
        </View>
      );
    }

    return null;
  };

  const renderContent = () => (
    <View style={styles.content}>
      {renderIcon()}
      
      {title && (
        <Text
          style={[
            variant === 'minimal' ? styles.titleMinimal : styles.title,
            { marginBottom: description ? getSpacing() / 2 : getSpacing() },
            titleStyle,
          ]}
        >
          {title}
        </Text>
      )}

      {description && (
        <Text
          style={[
            variant === 'minimal' ? styles.descriptionMinimal : styles.description,
            { marginBottom: getSpacing() },
            descriptionStyle,
          ]}
        >
          {description}
        </Text>
      )}
    </View>
  );

  const renderActions = () => {
    if (!actionText && !secondaryActionText) return null;

    return (
      <View style={styles.actions}>
        {actionText && onActionPress && (
          <Button
            title={actionText}
            onPress={onActionPress}
            variant="primary"
            size={variant === 'compact' ? 'small' : 'medium'}
            style={styles.primaryAction}
          />
        )}
        
        {secondaryActionText && onSecondaryActionPress && (
          <Button
            title={secondaryActionText}
            onPress={onSecondaryActionPress}
            variant="outline"
            size={variant === 'compact' ? 'small' : 'medium'}
            style={styles.secondaryAction}
          />
        )}
      </View>
    );
  };

  const containerStyle = [
    styles.container,
    variant === 'compact' && styles.compactContainer,
    variant === 'minimal' && styles.minimalContainer,
    style,
  ];

  return (
    <View style={containerStyle}>
      {renderContent()}
      {renderActions()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Theme.Spacing['2xl'],
  },
  compactContainer: {
    padding: Theme.Spacing.lg,
  },
  minimalContainer: {
    padding: Theme.Spacing.base,
  },
  content: {
    alignItems: 'center',
    maxWidth: 300,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 96,
    height: 96,
    backgroundColor: Colors.lightGray,
    borderRadius: Theme.BorderRadius.full,
    marginBottom: Theme.Spacing.lg,
  },
  illustration: {
    width: 120,
    height: 120,
    marginBottom: Theme.Spacing.lg,
    opacity: 0.8,
  },
  title: {
    ...Theme.TextStyles.h4,
    textAlign: 'center',
    color: Colors.text,
  },
  titleMinimal: {
    ...Theme.TextStyles.h6,
    textAlign: 'center',
    color: Colors.text,
  },
  description: {
    ...Theme.TextStyles.body,
    textAlign: 'center',
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  descriptionMinimal: {
    ...Theme.TextStyles.bodySmall,
    textAlign: 'center',
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    maxWidth: 240,
    marginTop: Theme.Spacing.lg,
  },
  primaryAction: {
    width: '100%',
    marginBottom: Theme.Spacing.sm,
  },
  secondaryAction: {
    width: '100%',
  },
});

// Pre-defined empty state configurations
export const EmptyStatePresets = {
  noData: {
    icon: 'document-outline',
    title: 'No Data Available',
    description: 'There is no data to display at the moment. Please try again later.',
  },
  noResults: {
    icon: 'search-outline',
    title: 'No Results Found',
    description: 'We couldn\'t find any results matching your search. Try adjusting your search terms.',
  },
  noStudents: {
    icon: 'people-outline',
    title: 'No Students Found',
    description: 'No students have been added yet. Start by adding your first student.',
    actionText: 'Add Student',
  },
  noTeachers: {
    icon: 'person-outline',
    title: 'No Teachers Found',
    description: 'No teachers have been added yet. Start by adding your first teacher.',
    actionText: 'Add Teacher',
  },
  noClasses: {
    icon: 'library-outline',
    title: 'No Classes Found',
    description: 'No classes have been created yet. Start by setting up your first class.',
    actionText: 'Create Class',
  },
  noNotifications: {
    icon: 'notifications-outline',
    title: 'No Notifications',
    description: 'You\'re all caught up! No new notifications at the moment.',
  },
  noAssignments: {
    icon: 'clipboard-outline',
    title: 'No Assignments',
    description: 'No assignments have been created yet. Create your first assignment to get started.',
    actionText: 'Create Assignment',
  },
  offline: {
    icon: 'cloud-offline-outline',
    title: 'You\'re Offline',
    description: 'Please check your internet connection and try again.',
    actionText: 'Retry',
  },
  error: {
    icon: 'warning-outline',
    title: 'Something Went Wrong',
    description: 'We encountered an unexpected error. Please try again.',
    actionText: 'Try Again',
  },
};

export default EmptyState;
