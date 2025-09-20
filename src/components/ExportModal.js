import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EXPORT_FORMATS } from '../utils/exportUtils';

const ExportModal = ({ 
  visible, 
  onClose, 
  onExport, 
  title = "Export Report",
  availableFormats = [EXPORT_FORMATS.CSV, EXPORT_FORMATS.JSON, EXPORT_FORMATS.CLIPBOARD]
}) => {
  const [selectedFormat, setSelectedFormat] = useState(EXPORT_FORMATS.CSV);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');
  const [hasError, setHasError] = useState(false);

  const formatOptions = [
    {
      key: EXPORT_FORMATS.CSV,
      label: 'CSV (Excel Compatible)',
      description: 'Comma-separated values file',
      icon: 'document-text',
      color: '#4CAF50'
    },
    {
      key: EXPORT_FORMATS.JSON,
      label: 'JSON (Data Format)',
      description: 'JavaScript Object Notation',
      icon: 'code',
      color: '#2196F3'
    },
    {
      key: EXPORT_FORMATS.PDF,
      label: 'PDF (Document)',
      description: 'Portable Document Format',
      icon: 'document',
      color: '#f44336'
    },
    {
      key: EXPORT_FORMATS.EXCEL,
      label: 'Excel (Spreadsheet)',
      description: 'Microsoft Excel format',
      icon: 'grid',
      color: '#FF9800'
    },
    {
      key: EXPORT_FORMATS.CLIPBOARD,
      label: 'Copy to Clipboard',
      description: 'Copy data for pasting elsewhere',
      icon: 'copy',
      color: '#9C27B0'
    }
  ];

  const filteredFormats = formatOptions.filter(format => 
    availableFormats.includes(format.key)
  );

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      console.log('📄 ExportModal: Resetting state for new export session');
      setHasError(false);
      setExportProgress('');
      setIsExporting(false);
      setSelectedFormat(availableFormats[0] || EXPORT_FORMATS.CSV);
    }
  }, [visible, availableFormats]);

  const handleExport = async () => {
    if (!selectedFormat) {
      Alert.alert('Error', 'Please select an export format');
      return;
    }

    console.log('📤 ExportModal: Starting export process with format:', selectedFormat);
    setIsExporting(true);
    setHasError(false);
    
    try {
      // Show progress messages
      setExportProgress('Preparing export...');
      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay for UX
      
      setExportProgress('Generating content...');
      const success = await onExport(selectedFormat);
      
      console.log('📤 ExportModal: Export operation result:', success);
      
      if (success) {
        // Different success message for clipboard
        if (selectedFormat === 'clipboard') {
          setExportProgress('Copied to clipboard successfully!');
        } else {
          setExportProgress('Export completed successfully!');
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        onClose();
        // Reset state after successful export
        setTimeout(() => {
          setSelectedFormat(EXPORT_FORMATS.CSV);
          setExportProgress('');
        }, 300);
      } else {
        console.warn('📤 ExportModal: Export operation returned false');
        setHasError(true);
        setExportProgress('Export failed. Please try again.');
        Alert.alert('Export Failed', 'The export operation could not be completed. Please try a different format or check your device permissions.');
      }
    } catch (error) {
      console.error('📤 ExportModal ERROR:', error);
      console.error('📤 ExportModal ERROR stack:', error.stack);
      setHasError(true);
      setExportProgress('Export failed due to an error.');
      
      // Enhanced error message based on error type
      let errorMessage = 'Failed to export report. Please try again.';
      
      if (error.message?.includes('FileSystem')) {
        errorMessage = 'File system access failed. Please check app permissions.';
      } else if (error.message?.includes('sharing')) {
        errorMessage = 'Sharing not available on this device. Try copying to clipboard instead.';
      } else if (error.message?.includes('clipboard')) {
        errorMessage = 'Clipboard access failed. Please try a file export instead.';
      }
      
      Alert.alert('Export Error', errorMessage);
    } finally {
      setTimeout(() => {
        setIsExporting(false);
        if (!hasError) {
          setExportProgress('');
        }
      }, hasError ? 2000 : 0); // Keep error message visible longer
    }
  };

  const handleClose = () => {
    if (!isExporting) {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={handleClose}
              disabled={isExporting}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.subtitle}>Choose export format:</Text>
            
            {/* Progress indicator */}
            {isExporting && (
              <View style={styles.progressContainer}>
                <ActivityIndicator size="small" color="#2196F3" />
                <Text style={styles.progressText}>{exportProgress}</Text>
              </View>
            )}
            
            {/* Error indicator */}
            {hasError && !isExporting && (
              <View style={styles.errorContainer}>
                <Ionicons name="warning" size={16} color="#f44336" />
                <Text style={styles.errorText}>{exportProgress}</Text>
              </View>
            )}
            
            {filteredFormats.map((format) => (
              <TouchableOpacity
                key={format.key}
                style={[
                  styles.formatOption,
                  selectedFormat === format.key && styles.selectedFormat
                ]}
                onPress={() => setSelectedFormat(format.key)}
                disabled={isExporting}
              >
                <View style={styles.formatInfo}>
                  <View style={[styles.formatIcon, { backgroundColor: format.color }]}>
                    <Ionicons name={format.icon} size={20} color="#fff" />
                  </View>
                  <View style={styles.formatText}>
                    <Text style={styles.formatLabel}>{format.label}</Text>
                    <Text style={styles.formatDescription}>{format.description}</Text>
                  </View>
                </View>
                <View style={styles.radioButton}>
                  {selectedFormat === format.key && (
                    <View style={styles.radioButtonSelected} />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
              disabled={isExporting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.exportButton]}
              onPress={handleExport}
              disabled={isExporting || !selectedFormat}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="download" size={16} color="#fff" />
                  <Text style={styles.exportButtonText}>Export</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  formatOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    marginBottom: 12,
  },
  selectedFormat: {
    borderColor: '#2196F3',
    backgroundColor: '#f3f8ff',
  },
  formatInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  formatIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  formatText: {
    flex: 1,
  },
  formatLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  formatDescription: {
    fontSize: 12,
    color: '#666',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2196F3',
  },
  actions: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 0,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  exportButton: {
    backgroundColor: '#2196F3',
  },
  exportButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
    marginLeft: 8,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  progressText: {
    fontSize: 14,
    color: '#1976D2',
    marginLeft: 8,
    fontWeight: '500',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#c62828',
    marginLeft: 8,
    fontWeight: '500',
  },
});

export default ExportModal;
