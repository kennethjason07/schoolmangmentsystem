/**
 * 📋 MODERN TASK COMPONENTS
 * Clean, modern UI components for task display and management
 */

import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  TextInput, 
  StyleSheet, 
  Alert, 
  ScrollView,
  Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CrossPlatformDatePicker, { DatePickerButton } from './CrossPlatformDatePicker';

// Task priority configuration
const TASK_PRIORITIES = {
  High: { color: '#F44336', bgColor: '#FFEBEE', label: 'High' },
  Medium: { color: '#FF9800', bgColor: '#FFF3E0', label: 'Medium' },
  Low: { color: '#4CAF50', bgColor: '#E8F5E8', label: 'Low' },
  high: { color: '#F44336', bgColor: '#FFEBEE', label: 'High' },
  medium: { color: '#FF9800', bgColor: '#FFF3E0', label: 'Medium' },
  low: { color: '#4CAF50', bgColor: '#E8F5E8', label: 'Low' }
};

// Task category configuration
const TASK_CATEGORIES = {
  attendance: { icon: 'people', color: '#4CAF50', label: 'Attendance' },
  marks: { icon: 'document-text', color: '#2196F3', label: 'Marks' },
  homework: { icon: 'school', color: '#FF9800', label: 'Homework' },
  meeting: { icon: 'people-circle', color: '#9C27B0', label: 'Meeting' },
  report: { icon: 'bar-chart', color: '#F44336', label: 'Report' },
  planning: { icon: 'calendar', color: '#00BCD4', label: 'Planning' },
  general: { icon: 'clipboard', color: '#757575', label: 'General' },
  administrative: { icon: 'shield-checkmark', color: '#3F51B5', label: 'Administrative' }
};

// Modern Task Card Component
export const ModernTaskCard = ({ 
  task, 
  onComplete, 
  type = 'personal',
  showActions = true 
}) => {
  const [completing, setCompleting] = useState(false);

  const priority = TASK_PRIORITIES[task.priority] || TASK_PRIORITIES.Medium;
  const category = TASK_CATEGORIES[task.task_type || task.category] || TASK_CATEGORIES.general;

  const handleComplete = async () => {
    if (completing) return;
    
    setCompleting(true);
    try {
      await onComplete(task.id);
      Alert.alert('✅ Task Completed', 'Great job completing this task!');
    } catch (error) {
      console.error('Error completing task:', error);
      Alert.alert('❌ Error', 'Failed to complete task. Please try again.');
    } finally {
      setCompleting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No due date';
    const date = new Date(dateString);
    const today = new Date();
    const isOverdue = date < today;
    
    const formatted = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    });
    
    return { formatted, isOverdue };
  };

  const dueDateInfo = formatDate(task.due_date);

  return (
    <View style={[styles.taskCard, { borderLeftColor: priority.color }]}>
      {/* Task Header */}
      <View style={styles.taskHeader}>
        <View style={styles.taskHeaderLeft}>
          <View style={[styles.categoryIcon, { backgroundColor: category.color }]}>
            <Ionicons name={category.icon} size={20} color="#fff" />
          </View>
          <View style={styles.taskHeaderInfo}>
            <Text style={styles.taskTitle} numberOfLines={2}>
              {task.title || task.task_title || 'Untitled Task'}
            </Text>
            <View style={styles.taskMeta}>
              <View style={[styles.priorityChip, { backgroundColor: priority.bgColor }]}>
                <View style={[styles.priorityDot, { backgroundColor: priority.color }]} />
                <Text style={[styles.priorityText, { color: priority.color }]}>
                  {priority.label}
                </Text>
              </View>
              {type === 'admin' && (
                <View style={styles.adminBadge}>
                  <Ionicons name="shield-checkmark" size={12} color="#3F51B5" />
                  <Text style={styles.adminBadgeText}>Admin</Text>
                </View>
              )}
            </View>
          </View>
        </View>
        {showActions && (
          <TouchableOpacity
            onPress={handleComplete}
            style={[
              styles.completeButton,
              completing && styles.completeButtonDisabled
            ]}
            disabled={completing}
            activeOpacity={0.7}
          >
            <Ionicons 
              name={completing ? "hourglass" : "checkmark-circle"} 
              size={18} 
              color="#fff" 
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Task Description */}
      {task.description && task.description !== task.title && task.description !== task.task_title && (
        <Text style={styles.taskDescription} numberOfLines={3}>
          {task.description || task.task_description}
        </Text>
      )}

      {/* Task Footer */}
      <View style={styles.taskFooter}>
        <View style={styles.dueDateContainer}>
          <Ionicons 
            name="time-outline" 
            size={14} 
            color={dueDateInfo.isOverdue ? '#F44336' : '#757575'} 
          />
          <Text style={[
            styles.dueDateText,
            dueDateInfo.isOverdue && styles.overdueDateText
          ]}>
            {dueDateInfo.formatted}
          </Text>
          {dueDateInfo.isOverdue && (
            <Text style={styles.overdueLabel}>OVERDUE</Text>
          )}
        </View>
        <View style={styles.categoryChip}>
          <Text style={[styles.categoryText, { color: category.color }]}>
            {category.label}
          </Text>
        </View>
      </View>
    </View>
  );
};

// Task Creation Modal Component
export const TaskCreationModal = ({ 
  visible, 
  onClose, 
  onSubmit,
  loading = false 
}) => {
  const [taskData, setTaskData] = useState({
    title: '',
    description: '',
    category: 'general',
    priority: 'medium',
    due_date: ''
  });
  const [showDatePicker, setShowDatePicker] = useState(false);

  const resetForm = () => {
    setTaskData({
      title: '',
      description: '',
      category: 'general',
      priority: 'medium',
      due_date: ''
    });
  };

  const handleSubmit = async () => {
    if (!taskData.title.trim()) {
      Alert.alert('❌ Missing Title', 'Please enter a task title.');
      return;
    }

    if (!taskData.due_date) {
      Alert.alert('❌ Missing Due Date', 'Please select a due date.');
      return;
    }

    try {
      await onSubmit(taskData);
      resetForm();
      onClose();
      Alert.alert('✅ Task Created', 'Your task has been created successfully!');
    } catch (error) {
      console.error('Error creating task:', error);
      Alert.alert('❌ Error', 'Failed to create task. Please try again.');
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!visible) return null;

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        {/* Modal Header */}
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Create New Task</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#757575" />
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.modalScroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Task Title */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Task Title *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter task title (e.g., 'Mark attendance for Grade 5A')"
              value={taskData.title}
              onChangeText={(text) => setTaskData(prev => ({...prev, title: text}))}
              autoFocus
            />
          </View>

          {/* Task Description */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Description (Optional)</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Add additional details about the task..."
              value={taskData.description}
              onChangeText={(text) => setTaskData(prev => ({...prev, description: text}))}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Category Selection */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.categoryGrid}>
                {Object.entries(TASK_CATEGORIES).map(([key, category]) => (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.categoryOption,
                      taskData.category === key && { 
                        backgroundColor: category.color,
                        borderColor: category.color 
                      }
                    ]}
                    onPress={() => setTaskData(prev => ({...prev, category: key}))}
                  >
                    <Ionicons 
                      name={category.icon} 
                      size={18} 
                      color={taskData.category === key ? '#fff' : category.color} 
                    />
                    <Text style={[
                      styles.categoryOptionText,
                      taskData.category === key && { color: '#fff' }
                    ]}>
                      {category.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Priority Selection */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Priority</Text>
            <View style={styles.priorityGrid}>
              {Object.entries(TASK_PRIORITIES).slice(0, 3).map(([key, priority]) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.priorityOption,
                    { borderColor: priority.color },
                    taskData.priority === key.toLowerCase() && { 
                      backgroundColor: priority.bgColor 
                    }
                  ]}
                  onPress={() => setTaskData(prev => ({...prev, priority: key.toLowerCase()}))}
                >
                  <View style={[styles.priorityDot, { backgroundColor: priority.color }]} />
                  <Text style={[
                    styles.priorityOptionText,
                    taskData.priority === key.toLowerCase() && { 
                      color: priority.color,
                      fontWeight: '600'
                    }
                  ]}>
                    {priority.label} Priority
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Due Date */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Due Date *</Text>
            {Platform.OS === 'web' ? (
              <CrossPlatformDatePicker
                value={taskData.due_date ? new Date(taskData.due_date) : new Date()}
                onChange={(event, selectedDate) => {
                  if (selectedDate) {
                    const yyyy = selectedDate.getFullYear();
                    const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
                    const dd = String(selectedDate.getDate()).padStart(2, '0');
                    setTaskData(prev => ({...prev, due_date: `${yyyy}-${mm}-${dd}`}));
                  }
                }}
                mode="date"
                containerStyle={styles.dateInput}
              />
            ) : (
              <>
                <DatePickerButton
                  value={taskData.due_date ? new Date(taskData.due_date) : new Date()}
                  onPress={() => setShowDatePicker(true)}
                  mode="date"
                  style={styles.dateInput}
                  displayFormat={(date) => date.toLocaleDateString('en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                />
                {showDatePicker && (
                  <CrossPlatformDatePicker
                    value={taskData.due_date ? new Date(taskData.due_date) : new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedDate) => {
                      setShowDatePicker(false);
                      if (selectedDate) {
                        const yyyy = selectedDate.getFullYear();
                        const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
                        const dd = String(selectedDate.getDate()).padStart(2, '0');
                        setTaskData(prev => ({...prev, due_date: `${yyyy}-${mm}-${dd}`}));
                      }
                    }}
                  />
                )}
              </>
            )}
          </View>
        </ScrollView>

        {/* Modal Actions */}
        <View style={styles.modalActions}>
          <TouchableOpacity
            onPress={handleClose}
            style={styles.cancelButton}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSubmit}
            style={[
              styles.createButton,
              (!taskData.title.trim() || !taskData.due_date || loading) && styles.createButtonDisabled
            ]}
            disabled={!taskData.title.trim() || !taskData.due_date || loading}
            activeOpacity={0.7}
          >
            <Ionicons name="add-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.createButtonText}>
              {loading ? 'Creating...' : 'Create Task'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// Task Section Header Component
export const TaskSectionHeader = ({ 
  title, 
  count, 
  color, 
  icon, 
  onAddTask,
  showAddButton = false 
}) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionHeaderLeft}>
      <View style={[styles.sectionIcon, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View>
        <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
        <Text style={styles.sectionCount}>{count} pending tasks</Text>
      </View>
    </View>
    {showAddButton && (
      <TouchableOpacity onPress={onAddTask} style={[styles.addButton, { backgroundColor: color }]}>
        <Ionicons name="add" size={18} color="#fff" />
        <Text style={styles.addButtonText}>Add</Text>
      </TouchableOpacity>
    )}
  </View>
);

// Empty State Component
export const EmptyTaskState = ({ 
  type, 
  onAddTask 
}) => (
  <View style={styles.emptyState}>
    <Ionicons 
      name={type === 'admin' ? 'shield-checkmark-outline' : 'happy-outline'} 
      size={64} 
      color="#E0E0E0" 
    />
    <Text style={styles.emptyStateTitle}>
      {type === 'admin' ? 'No admin tasks!' : 'No personal tasks!'}
    </Text>
    <Text style={styles.emptyStateSubtitle}>
      {type === 'admin' 
        ? 'Great job! All administrative tasks are completed.' 
        : 'Create a new task to get started with your organization.'}
    </Text>
    {type === 'personal' && onAddTask && (
      <TouchableOpacity onPress={onAddTask} style={styles.emptyStateButton}>
        <Ionicons name="add-circle" size={20} color="#2196F3" />
        <Text style={styles.emptyStateButtonText}>Add Your First Task</Text>
      </TouchableOpacity>
    )}
  </View>
);

const styles = StyleSheet.create({
  // Task Card Styles
  taskCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  taskHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  taskHeaderInfo: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212121',
    lineHeight: 22,
    marginBottom: 8,
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priorityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8EAF6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  adminBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3F51B5',
    marginLeft: 4,
  },
  completeButton: {
    backgroundColor: '#4CAF50',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeButtonDisabled: {
    backgroundColor: '#BDBDBD',
  },
  taskDescription: {
    fontSize: 14,
    color: '#757575',
    lineHeight: 20,
    marginBottom: 12,
  },
  taskFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dueDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dueDateText: {
    fontSize: 13,
    color: '#757575',
    marginLeft: 4,
  },
  overdueDateText: {
    color: '#F44336',
    fontWeight: '600',
  },
  overdueLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F44336',
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  categoryChip: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Modal Styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '90%',
    maxWidth: 480,
    maxHeight: '85%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212121',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    maxHeight: '70%',
  },
  formGroup: {
    padding: 20,
    paddingTop: 16,
    paddingBottom: 0,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#FAFAFA',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  categoryGrid: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#757575',
    marginLeft: 6,
  },
  priorityGrid: {
    gap: 8,
  },
  priorityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 8,
  },
  priorityOptionText: {
    fontSize: 15,
    color: '#757575',
    marginLeft: 12,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#FAFAFA',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#757575',
  },
  createButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#2196F3',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonDisabled: {
    backgroundColor: '#BDBDBD',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },

  // Section Header Styles
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionCount: {
    fontSize: 14,
    color: '#757575',
    marginTop: 2,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 4,
  },

  // Empty State Styles
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#757575',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#9E9E9E',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 20,
  },
  emptyStateButtonText: {
    color: '#2196F3',
    fontWeight: '600',
    marginLeft: 8,
  },
});
