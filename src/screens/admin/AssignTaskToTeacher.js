import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
  Dimensions
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import Header from '../../components/Header';
import DateTimePicker from '@react-native-community/datetimepicker';
import DropDownPicker from 'react-native-dropdown-picker';
import { supabase, dbHelpers, TABLES } from '../../utils/supabase';

const { width } = Dimensions.get('window');

// Priorities and statuses with colors and icons
const priorities = [
  { label: 'Low', value: 'Low', color: '#4CAF50', icon: 'arrow-down' },
  { label: 'Medium', value: 'Medium', color: '#FF9800', icon: 'remove' },
  { label: 'High', value: 'High', color: '#F44336', icon: 'arrow-up' }
];

const statuses = [
  { label: 'Pending', value: 'Pending', color: '#FF9800', icon: 'schedule' },
  { label: 'In Progress', value: 'In Progress', color: '#2196F3', icon: 'play-circle' },
  { label: 'Completed', value: 'Completed', color: '#4CAF50', icon: 'check-circle' }
];

const AssignTaskToTeacher = ({ navigation, route }) => {
  const { teacher } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    dueDate: '',
    priority: 'Medium',
    status: 'Pending',
    teacher_ids: null
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [error, setError] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownItems, setDropdownItems] = useState([]);

  useEffect(() => {
    loadAllData();
  }, []);

  // Update dropdown items when teachers are loaded
  useEffect(() => {
    if (teachers.length > 0) {
      const items = teachers.map(teacher => ({
        label: teacher.name,
        value: teacher.id
      }));
      console.log('Setting dropdown items:', items);
      setDropdownItems(items);
    }
  }, [teachers]);

  const loadAllData = async () => {
    try {
      // Load tasks
      const { data: tasksData, error: tasksError } = await dbHelpers.getTasks();
      if (tasksError) {
        console.error('Error loading tasks:', tasksError);
        throw tasksError;
      }
      console.log('Loaded tasks:', tasksData);
      setTasks(tasksData || []);

      // Load teachers
      const { data: teachersData, error: teachersError } = await dbHelpers.getTeachers();
      if (teachersError) {
        console.error('Error loading teachers:', teachersError);
        throw teachersError;
      }
      console.log('Loaded teachers:', teachersData);
      setTeachers(teachersData || []);

    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load tasks and teachers');
    } finally {
      setLoading(false);
    }
  };

  // Helper to format date as DD-MM-YYYY
  function formatDateDMY(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  }

  // First filter tasks for the selected teacher
  const teacherTasks = tasks.filter(task => {
    const teacherIds = task.assigned_teacher_ids || [];
    return teacher ? teacherIds.includes(teacher.id) : true;
  });

  // Then apply status and search filters
  const filteredTasks = teacherTasks.filter(task => {
    const matchesStatus = filterStatus === 'All' || task.status === filterStatus;
    const matchesSearch = task.title.toLowerCase().includes(search.toLowerCase()) ||
      task.description?.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Get priority and status objects
  const getPriorityInfo = (priority) => priorities.find(p => p.value === priority) || priorities[1];
  const getStatusInfo = (status) => statuses.find(s => s.value === status) || statuses[0];



  // Open modal for new/edit task
  const openModal = (task = null) => {
    setEditTask(task);
    if (task) {
      const teacherIds = task.assigned_teacher_ids || [];
      setForm({
        title: task.title || '',
        description: task.description || '',
        priority: task.priority || 'Medium',
        status: task.status || 'Pending',
        teacher_ids: teacherIds.length > 0 ? teacherIds[0] : null,
        dueDate: task.due_date || ''
      });
    } else {
      setForm({
        title: '',
        description: '',
        dueDate: '',
        priority: 'Medium',
        status: 'Pending',
        teacher_ids: teacher ? teacher.id : null
      });
    }
    setModalVisible(true);
  };

  // Save (add/edit) task
  const handleSave = async () => {
    if (!form.title.trim() || !form.dueDate || !form.teacher_ids) {
      Alert.alert('Error', 'Please fill all required fields.');
      return;
    }

    try {
      if (editTask) {
        // Update existing task
        const { error: updateError } = await supabase
          .from(TABLES.TASKS)
          .update({
            title: form.title,
            description: form.description,
            due_date: form.dueDate,
            priority: form.priority,
            status: form.status,
            assigned_teacher_ids: [form.teacher_ids]
          })
          .eq('id', editTask.id);

        if (updateError) throw updateError;
      } else {
        // Create new task
        console.log('🔍 ADMIN: Creating task with teacher ID:', form.teacher_ids);
        console.log('🔍 ADMIN: Task data:', {
          title: form.title,
          description: form.description,
          due_date: form.dueDate,
          priority: form.priority,
          status: form.status,
          assigned_teacher_ids: [form.teacher_ids]
        });
        
        const { data: insertResult, error: insertError } = await supabase
          .from(TABLES.TASKS)
          .insert({
            title: form.title,
            description: form.description,
            due_date: form.dueDate,
            priority: form.priority,
            status: form.status,
            assigned_teacher_ids: [form.teacher_ids]
          })
          .select();
          
        console.log('🔍 ADMIN: Insert result:', insertResult);
        console.log('🔍 ADMIN: Insert error:', insertError);

        if (insertError) throw insertError;
      }

      // Refresh data
      await loadAllData();
      setModalVisible(false);
      setEditTask(null);
      setForm({
        title: '',
        description: '',
        dueDate: '',
        priority: 'Medium',
        status: 'Pending',
        teacher_ids: null
      });

      Alert.alert('Success', editTask ? 'Task updated successfully!' : 'Task created successfully!');
    } catch (error) {
      console.error('Error saving task:', error);
      Alert.alert('Error', 'Failed to save task. Please try again.');
    }
  };

  // Delete task
  const handleDelete = async (taskId) => {
    try {
      Alert.alert(
        'Delete Task',
        'Are you sure you want to delete this task?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              const { error } = await supabase
                .from(TABLES.TASKS)
                .delete()
                .eq('id', taskId);

              if (error) throw error;

              // Refresh data
              await loadAllData();
              Alert.alert('Success', 'Task deleted successfully!');
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error deleting task:', error);
      Alert.alert('Error', 'Failed to delete task');
    }
  };



  // Date picker
  const handleDateChange = (_, date) => {
    setShowDatePicker(false);
    if (date) {
      setForm(f => ({ ...f, dueDate: date.toISOString().split('T')[0] }));
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Assign Task to Teacher" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading tasks and teachers...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Header title="Assign Task to Teacher" showBack={true} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={loadAllData}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title={teacher ? `Tasks - ${teacher.name}` : "Task Management"} showBack={true} />

      {/* Header Stats Card */}
      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <View style={styles.statIconContainer}>
            <MaterialIcons name="assignment" size={24} color="#2196F3" />
          </View>
          <View style={styles.statTextContainer}>
            <Text style={styles.statNumber}>{teacherTasks.length}</Text>
            <Text style={styles.statLabel}>Total Tasks</Text>
          </View>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <View style={styles.statIconContainer}>
            <MaterialIcons name="pending-actions" size={24} color="#FF9800" />
          </View>
          <View style={styles.statTextContainer}>
            <Text style={styles.statNumber}>{teacherTasks.filter(t => t.status === 'Pending').length}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <View style={styles.statIconContainer}>
            <MaterialIcons name="check-circle" size={24} color="#4CAF50" />
          </View>
          <View style={styles.statTextContainer}>
            <Text style={styles.statNumber}>{teacherTasks.filter(t => t.status === 'Completed').length}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
        </View>
      </View>

      {/* Search and Filter Section */}
      <View style={styles.searchFilterContainer}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search tasks, descriptions, or teachers..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor="#999"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        {/* Status Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScrollView}
          contentContainerStyle={styles.filterScrollContent}
        >
          <TouchableOpacity
            onPress={() => setFilterStatus('All')}
            style={[styles.filterPill, filterStatus === 'All' && styles.filterPillActive]}
          >
            <Text style={[styles.filterPillText, filterStatus === 'All' && styles.filterPillTextActive]}>
              All ({teacherTasks.length})
            </Text>
          </TouchableOpacity>
          {statuses.map(status => (
            <TouchableOpacity
              key={status.value}
              onPress={() => setFilterStatus(status.value)}
              style={[
                styles.filterPill,
                filterStatus === status.value && styles.filterPillActive,
                filterStatus === status.value && { backgroundColor: status.color }
              ]}
            >
              <MaterialIcons
                name={status.icon}
                size={16}
                color={filterStatus === status.value ? '#fff' : status.color}
                style={styles.filterPillIcon}
              />
              <Text style={[
                styles.filterPillText,
                filterStatus === status.value && styles.filterPillTextActive,
                { color: filterStatus === status.value ? '#fff' : status.color }
              ]}>
                {status.label} ({teacherTasks.filter(t => t.status === status.value).length})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      {/* Task List */}
      <FlatList
        data={filteredTasks}
        keyExtractor={item => item.id}
        style={styles.flatList}
        renderItem={({ item }) => {
          const priorityInfo = getPriorityInfo(item.priority);
          const statusInfo = getStatusInfo(item.status);
          const teacherIds = item.assigned_teacher_ids || [];
          const assignedTeachers = teacherIds.map(tid =>
            teachers.find(t => t.id === tid)?.name
          ).filter(Boolean);

          return (
            <TouchableOpacity
              style={styles.taskCard}
              onPress={() => openModal(item)}
              activeOpacity={0.7}
            >
              {/* Task Header with Delete Button */}
              <View style={styles.taskHeader}>
                <View style={styles.taskBadges}>
                  <View style={[styles.priorityBadge, { backgroundColor: priorityInfo.color }]}>
                    <MaterialIcons name={priorityInfo.icon} size={12} color="#fff" />
                    <Text style={styles.priorityText}>{priorityInfo.label}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusInfo.color }]}>
                    <MaterialIcons name={statusInfo.icon} size={12} color="#fff" />
                    <Text style={styles.statusText}>{statusInfo.label}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    handleDelete(item.id);
                  }}
                  style={styles.deleteButton}
                >
                  <MaterialIcons name="delete-outline" size={20} color="#F44336" />
                </TouchableOpacity>
              </View>

              {/* Structured Task Information */}
              <View style={styles.taskDetailsContainer}>
                {/* Title */}
                <View style={styles.taskDetailRow}>
                  <Text style={styles.taskDetailLabel}>Title:</Text>
                  <Text style={styles.taskDetailValue} numberOfLines={2}>{item.title}</Text>
                </View>

                {/* Task Description */}
                {item.description && (
                  <View style={styles.taskDetailRow}>
                    <Text style={styles.taskDetailLabel}>Task Description:</Text>
                    <Text style={styles.taskDetailValue} numberOfLines={3}>{item.description}</Text>
                  </View>
                )}

                {/* Due Date */}
                <View style={styles.taskDetailRow}>
                  <Text style={styles.taskDetailLabel}>Due Date:</Text>
                  <Text style={styles.taskDetailValue}>
                    {item.due_date ? formatDateDMY(item.due_date) : 'No date set'}
                  </Text>
                </View>

                {/* Priority */}
                <View style={styles.taskDetailRow}>
                  <Text style={styles.taskDetailLabel}>Priority:</Text>
                  <Text style={styles.taskDetailValue}>{item.priority}</Text>
                </View>

                {/* Status */}
                <View style={styles.taskDetailRow}>
                  <Text style={styles.taskDetailLabel}>Status:</Text>
                  <Text style={styles.taskDetailValue}>{item.status}</Text>
                </View>

                {/* Assigned to Teacher */}
                {assignedTeachers.length > 0 && (
                  <View style={styles.taskDetailRow}>
                    <Text style={styles.taskDetailLabel}>Assigned to Teacher:</Text>
                    <Text style={styles.taskDetailValue} numberOfLines={2}>
                      {assignedTeachers.length === 1
                        ? assignedTeachers[0]
                        : `${assignedTeachers[0]} +${assignedTeachers.length - 1} more`
                      }
                    </Text>
                  </View>
                )}
              </View>

              {/* Progress Indicator */}
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: item.status === 'Completed' ? '100%' :
                               item.status === 'In Progress' ? '50%' : '10%',
                        backgroundColor: statusInfo.color
                      }
                    ]}
                  />
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={Platform.OS === 'web'}
        keyboardShouldPersistTaps="handled"
        bounces={Platform.OS !== 'web'}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="assignment" size={64} color="#E0E0E0" />
            <Text style={styles.emptyTitle}>No tasks found</Text>
            <Text style={styles.emptySubtitle}>
              {search ? 'Try adjusting your search terms' : 'Create your first task to get started'}
            </Text>
          </View>
        }
      />
      {/* Floating Add Button (FAB) */}
      <TouchableOpacity style={styles.fab} onPress={() => openModal()} activeOpacity={0.8}>
        <MaterialIcons name="add" size={28} color="#fff" />
        <Text style={styles.fabText}>New Task</Text>
      </TouchableOpacity>
      {/* Add/Edit Task Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
              bounces={true}
              contentContainerStyle={styles.scrollContent}
            >
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleContainer}>
                  <MaterialIcons
                    name={editTask ? "edit" : "add-task"}
                    size={24}
                    color="#2196F3"
                    style={styles.modalIcon}
                  />
                  <Text style={styles.modalTitle}>
                    {editTask ? 'Edit Task' : 'Create New Task'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  style={styles.modalCloseButton}
                >
                  <MaterialIcons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              {/* Form Fields */}
              <View style={styles.formContainer}>
                {/* Task Title */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Task Title *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter task title"
                    value={form.title}
                    onChangeText={text => setForm(f => ({ ...f, title: text }))}
                    placeholderTextColor="#999"
                  />
                </View>

                {/* Description */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Description</Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    placeholder="Enter task description"
                    value={form.description}
                    onChangeText={text => setForm(f => ({ ...f, description: text }))}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    placeholderTextColor="#999"
                  />
                </View>

                {/* Due Date */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Due Date *</Text>
                  <TouchableOpacity
                    style={styles.datePickerButton}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <MaterialIcons name="event" size={20} color="#2196F3" />
                    <Text style={[
                      styles.datePickerText,
                      { color: form.dueDate ? '#333' : '#999' }
                    ]}>
                      {form.dueDate ? formatDateDMY(form.dueDate) : 'Select due date'}
                    </Text>
                    <MaterialIcons name="keyboard-arrow-down" size={20} color="#666" />
                  </TouchableOpacity>
                </View>

                {showDatePicker && (
                  <DateTimePicker
                    value={form.dueDate ? new Date(form.dueDate) : new Date()}
                    mode="date"
                    display="default"
                    onChange={handleDateChange}
                    minimumDate={new Date()}
                  />
                )}
                {/* Priority Selection */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Priority</Text>
                  <View style={styles.optionRow}>
                    {priorities.map(priority => (
                      <TouchableOpacity
                        key={priority.value}
                        style={[
                          styles.optionButton,
                          form.priority === priority.value && styles.optionButtonActive,
                          form.priority === priority.value && { backgroundColor: priority.color }
                        ]}
                        onPress={() => setForm(f => ({ ...f, priority: priority.value }))}
                      >
                        <MaterialIcons
                          name={priority.icon}
                          size={16}
                          color={form.priority === priority.value ? '#fff' : priority.color}
                        />
                        <Text style={[
                          styles.optionButtonText,
                          form.priority === priority.value && styles.optionButtonTextActive
                        ]}>
                          {priority.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Status Selection */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Status</Text>
                  <View style={styles.optionRow}>
                    {statuses.map(status => (
                      <TouchableOpacity
                        key={status.value}
                        style={[
                          styles.optionButton,
                          form.status === status.value && styles.optionButtonActive,
                          form.status === status.value && { backgroundColor: status.color }
                        ]}
                        onPress={() => setForm(f => ({ ...f, status: status.value }))}
                      >
                        <MaterialIcons
                          name={status.icon}
                          size={16}
                          color={form.status === status.value ? '#fff' : status.color}
                        />
                        <Text style={[
                          styles.optionButtonText,
                          form.status === status.value && styles.optionButtonTextActive
                        ]}>
                          {status.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Teacher Assignment */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Assign to Teacher *</Text>
                  {teacher ? (
                    <View style={styles.selectedTeacherContainer}>
                      <View style={styles.selectedTeacherInfo}>
                        <MaterialIcons name="person" size={20} color="#2196F3" />
                        <Text style={styles.selectedTeacherName}>{teacher.name}</Text>
                      </View>
                      <View style={styles.selectedTeacherBadge}>
                        <Text style={styles.selectedTeacherBadgeText}>Selected</Text>
                      </View>
                    </View>
                  ) : (
                    <DropDownPicker
                      open={dropdownOpen}
                      value={form.teacher_ids}
                      items={dropdownItems}
                      setOpen={setDropdownOpen}
                      setValue={(callback) => {
                        const newValue = callback(form.teacher_ids);
                        setForm(f => ({ ...f, teacher_ids: newValue }));
                      }}
                      setItems={setDropdownItems}
                      multiple={false}
                      placeholder="Select a teacher"
                      style={styles.dropdown}
                      containerStyle={styles.dropdownContainer}
                      dropDownContainerStyle={styles.dropdownList}
                      textStyle={styles.dropdownText}
                      placeholderStyle={styles.dropdownPlaceholder}
                      zIndex={5000}
                      zIndexInverse={1000}
                      listMode="MODAL"
                      modalProps={{
                        animationType: "slide",
                        transparent: true,
                      }}
                      modalContentContainerStyle={styles.dropdownModal}
                      modalTitle="Select Teacher"
                      modalTitleStyle={styles.dropdownModalTitle}
                      maxHeight={300}
                      dropDownDirection="AUTO"
                      selectedItemLabelStyle={styles.selectedItemLabel}
                      showTickIcon={true}
                      tickIconStyle={styles.tickIcon}
                    />
                  )}
                </View>
              </View>

              {/* Modal Actions */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSave}
                >
                  <MaterialIcons
                    name={editTask ? "save" : "add"}
                    size={20}
                    color="#fff"
                    style={styles.saveButtonIcon}
                  />
                  <Text style={styles.saveButtonText}>
                    {editTask ? 'Update Task' : 'Create Task'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Stats Card
  statsCard: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statTextContainer: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
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
    marginHorizontal: 16,
  },
  // Search and Filter
  searchFilterContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    fontWeight: '400',
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  filterScrollView: {
    marginBottom: 4,
  },
  filterScrollContent: {
    paddingRight: 16,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  filterPillActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  filterPillIcon: {
    marginRight: 6,
  },
  filterPillText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  filterPillTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  // Task List
  flatList: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      maxHeight: '100vh',
      overflowY: 'auto',
    }),
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100,
    ...(Platform.OS === 'web' && {
      minHeight: '100%',
    }),
  },
  taskCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  taskTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  taskTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
    lineHeight: 24,
  },
  taskBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  priorityText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#fff5f5',
  },
  taskDescription: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
    marginBottom: 16,
  },
  taskMetaContainer: {
    marginBottom: 16,
  },
  taskMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  taskMetaText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#f0f0f0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  // Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    lineHeight: 24,
  },
  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 60,
    backgroundColor: '#2196F3',
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalIcon: {
    marginRight: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  modalCloseButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  // Form Styles
  formContainer: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  datePickerText: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
    flex: 1,
    minWidth: 100,
    justifyContent: 'center',
  },
  optionButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  optionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginLeft: 6,
  },
  optionButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  // Dropdown Styles
  dropdown: {
    borderColor: '#e9ecef',
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    minHeight: 50,
  },
  dropdownContainer: {
    marginBottom: 0,
    zIndex: 3000,
  },
  dropdownList: {
    borderColor: '#e9ecef',
    borderRadius: 12,
    backgroundColor: '#fff',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    maxHeight: 200,
  },
  dropdownText: {
    fontSize: 16,
    color: '#333',
  },
  dropdownPlaceholder: {
    fontSize: 16,
    color: '#999',
  },
  dropdownModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 20,
    maxHeight: '70%',
  },
  dropdownModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedItemLabel: {
    color: '#2196F3',
    fontWeight: '600',
  },
  tickIcon: {
    tintColor: '#2196F3',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  customBadge: {
    backgroundColor: '#2196F3',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  customBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginRight: 6,
  },
  badgeCloseIcon: {
    marginLeft: 4,
  },
  // Selected Teacher Display
  selectedTeacherContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#e9ecef',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedTeacherInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectedTeacherName: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    marginLeft: 8,
  },
  selectedTeacherBadge: {
    backgroundColor: '#2196F3',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  selectedTeacherBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  // Modal Actions
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#2196F3',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonIcon: {
    marginRight: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // Structured Task Details Styles
  taskDetailsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  taskDetailRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  taskDetailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    width: 120,
    marginRight: 8,
  },
  taskDetailValue: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    lineHeight: 20,
  },
});

export default AssignTaskToTeacher; 