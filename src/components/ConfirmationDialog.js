import React from 'react';
import { Platform, Alert } from 'react-native';

/**
 * Cross-platform confirmation dialog component
 * Uses native Alert.alert on mobile and window.confirm on web for better UX
 */
export const ConfirmationDialog = {
  /**
   * Show confirmation dialog for delete operations
   * @param {string} title - Dialog title
   * @param {string} message - Dialog message
   * @param {Function} onConfirm - Callback when user confirms
   * @param {Function} onCancel - Optional callback when user cancels
   * @param {Object} options - Additional options
   */
  show: (title, message, onConfirm, onCancel = null, options = {}) => {
    const {
      confirmText = 'Delete',
      cancelText = 'Cancel',
      destructive = true
    } = options;

    if (Platform.OS === 'web') {
      // For web, use native confirm dialog for faster response
      const confirmed = window.confirm(`${title}\n\n${message}`);
      if (confirmed) {
        onConfirm();
      } else if (onCancel) {
        onCancel();
      }
    } else {
      // For mobile, use Alert.alert for better UX
      Alert.alert(
        title,
        message,
        [
          {
            text: cancelText,
            style: 'cancel',
            onPress: onCancel
          },
          {
            text: confirmText,
            style: destructive ? 'destructive' : 'default',
            onPress: onConfirm
          }
        ],
        { cancelable: true, onDismiss: onCancel }
      );
    }
  },

  /**
   * Show confirmation dialog specifically for photo deletion
   * @param {string} studentName - Name of the student whose photo is being deleted
   * @param {Function} onConfirm - Callback when user confirms deletion
   * @param {Function} onCancel - Optional callback when user cancels
   */
  showPhotoDeleteConfirmation: (studentName, onConfirm, onCancel = null) => {
    ConfirmationDialog.show(
      'Delete Profile Picture',
      `Are you sure you want to delete ${studentName}'s profile picture? This action cannot be undone.`,
      onConfirm,
      onCancel,
      {
        confirmText: 'Delete',
        cancelText: 'Cancel',
        destructive: true
      }
    );
  },

  /**
   * Show confirmation dialog for removing photo from upload list
   * @param {string} photoName - Name of the photo file being removed
   * @param {Function} onConfirm - Callback when user confirms removal
   * @param {Function} onCancel - Optional callback when user cancels
   */
  showRemovePhotoConfirmation: (photoName, onConfirm, onCancel = null) => {
    ConfirmationDialog.show(
      'Remove Photo',
      `Remove "${photoName}" from upload list?`,
      onConfirm,
      onCancel,
      {
        confirmText: 'Remove',
        cancelText: 'Keep',
        destructive: false
      }
    );
  }
};

export default ConfirmationDialog;