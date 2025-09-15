import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import Header from '../../components/Header';
import { supabase, TABLES } from '../../utils/supabase';

const TasksManagement = ({ navigation }) => {
  const [tasks, setTasks] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');

  // Form state
  const [form, setForm] = useState({
    title: '',
    description: '',
    dueDate: '',
    priority: 'Medium',
    status: 'Pending',
    teacher_ids: null
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadTasks(), loadTeachers()]);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadTasks = async () => {
    try {
      const { data, error } = await supabase
        .from(TABLES.TASKS)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  };

  const loadTeachers = async () => {
    try {
      const { data, error } = await supabase
        .from(TABLES.TEACHERS)
        .select('id, name')
        .order('name');

      if (error) throw error;
      setTeachers(data || []);
    } catch (error) {
      console.error('Error loading teachers:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  };

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
        teacher_ids: null
      });
    }
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.dueDate || !form.teacher_ids) {
      Alert.alert('Error', 'Please fill all required fields.');
      return;
    }

    try {
      if (editTask) {
        // Update existing task
        const { error } = await supabase
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

        if (error) throw error;
        Alert.alert('Success', 'Task updated successfully!');
      } else {
        // Create new task
        const { error } = await supabase
          .from(TABLES.TASKS)
          .insert({
            title: form.title,
            description: form.description,
            due_date: form.dueDate,
            priority: form.priority,
            status: form.status,
            assigned_teacher_ids: [form.teacher_ids]
          });

        if (error) throw error;
        Alert.alert('Success', 'Task created successfully!');
      }

      await loadTasks();
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
    } catch (error) {
      console.error('Error saving task:', error);
      Alert.alert('Error', 'Failed to save task');
    }
  };

  const handleDelete = async (taskId) => {
    Alert.alert(
      'Delete Task',
      'Are you sure you want to delete this task?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from(TABLES.TASKS)
                .delete()
                .eq('id', taskId);

              if (error) throw error;
              await loadTasks();
              Alert.alert('Success', 'Task deleted successfully!');
            } catch (error) {
              console.error('Error deleting task:', error);
              Alert.alert('Error', 'Failed to delete task');
            }
          }
        }
      ]
    );
  };

  const handleDateChange = (_, date) => {
    setShowDatePicker(false);
    if (date) {
      setForm(f => ({ ...f, dueDate: date.toISOString().split('T')[0] }));
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'High': return '#F44336';
      case 'Medium': return '#FF9800';
      case 'Low': return '#4CAF50';
      default: return '#9E9E9E';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed': return '#4CAF50';
      case 'In Progress': return '#2196F3';
      case 'Pending': return '#FF9800';
      default: return '#9E9E9E';
    }
  };

  const getTeacherName = (teacherIds) => {
    if (!teacherIds || teacherIds.length === 0) return 'Unassigned';
    const teacher = teachers.find(t => t.id === teacherIds[0]);
    return teacher ? teacher.name : 'Unknown Teacher';
  };

  // Filter tasks based on search and filters
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         task.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         getTeacherName(task.assigned_teacher_ids).toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === 'All' || task.status === filterStatus;
    const matchesPriority = filterPriority === 'All' || task.priority === filterPriority;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Tasks Management" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading tasks...</Text>
        </View>
      </View>
    );
  }

  // Render web-specific scrollable content
  const renderWebContent = () => (
    <div
      style={{
        height: 'calc(100vh - 80px)',
        overflow: 'auto',
        overflowY: 'scroll',
        paddingBottom: '100px',
        WebkitOverflowScrolling: 'touch',
        scrollBehavior: 'smooth'
      }}
    >
      {renderContent()}
    </div>
  );

  // Render mobile-specific ScrollView content
  const renderMobileContent = () => (
    <ScrollView
      style={styles.content}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {renderContent()}
    </ScrollView>
  );

  // Render shared content that works for both platforms
  const renderContent = () => (
    <>
      {/* Header Actions */}
      <View style={styles.headerActions}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => openModal()}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addButtonText}>Add Task</Text>
        </TouchableOpacity>
      </View>

      {/* Search and Filters */}
      <View style={styles.filtersContainer}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search tasks, teachers..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View style={styles.filterRow}>
          <View style={styles.filterItem}>
            <Text style={styles.filterLabel}>Status:</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={filterStatus}
                onValueChange={setFilterStatus}
                style={styles.picker}
              >
                <Picker.Item label="All" value="All" />
                <Picker.Item label="Pending" value="Pending" />
                <Picker.Item label="In Progress" value="In Progress" />
                <Picker.Item label="Completed" value="Completed" />
              </Picker>
            </View>
          </View>

          <View style={styles.filterItem}>
            <Text style={styles.filterLabel}>Priority:</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={filterPriority}
                onValueChange={setFilterPriority}
                style={styles.picker}
              >
                <Picker.Item label="All" value="All" />
                <Picker.Item label="High" value="High" />
                <Picker.Item label="Medium" value="Medium" />
                <Picker.Item label="Low" value="Low" />
              </Picker>
            </View>
          </View>
        </View>
      </View>

      {/* Tasks Summary */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>{tasks.length}</Text>
          <Text style={styles.summaryLabel}>Total Tasks</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>
            {tasks.filter(t => t.status === 'Pending').length}
          </Text>
          <Text style={styles.summaryLabel}>Pending</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>
            {tasks.filter(t => t.status === 'In Progress').length}
          </Text>
          <Text style={styles.summaryLabel}>In Progress</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>
            {tasks.filter(t => t.status === 'Completed').length}
          </Text>
          <Text style={styles.summaryLabel}>Completed</Text>
        </View>
      </View>

      {/* Tasks Table */}
      <View style={styles.tableContainer}>
        <Text style={styles.tableTitle}>Tasks Overview ({filteredTasks.length})</Text>

        {/* Table Header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, styles.titleColumn, { textAlign: 'left' }]}>Task Title</Text>
          <Text style={[styles.tableHeaderText, styles.teacherColumn]}>Teacher</Text>
          <Text style={[styles.tableHeaderText, styles.priorityColumn]}>Priority</Text>
          <Text style={[styles.tableHeaderText, styles.statusColumn]}>Status</Text>
          <Text style={[styles.tableHeaderText, styles.dueDateColumn]}>Due Date</Text>
          <Text style={[styles.tableHeaderText, styles.actionsColumn]}>Actions</Text>
        </View>

        {/* Table Rows */}
        {filteredTasks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="assignment" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No tasks found</Text>
            <Text style={styles.emptySubtext}>
              {searchQuery || filterStatus !== 'All' || filterPriority !== 'All'
                ? 'Try adjusting your search or filters'
                : 'Create your first task to get started'
              }
            </Text>
          </View>
        ) : (
          filteredTasks.map((task, index) => (
            <View key={task.id} style={[styles.tableRow, index % 2 === 0 && styles.evenRow]}>
              <View style={styles.titleColumn}>
                <Text style={styles.taskTitle} numberOfLines={2}>{task.title}</Text>
                {task.description && (
                  <Text style={styles.taskDescription} numberOfLines={1}>
                    {task.description}
                  </Text>
                )}
              </View>

              <View style={styles.teacherColumn}>
                <Text style={styles.teacherName}>
                  {getTeacherName(task.assigned_teacher_ids)}
                </Text>
              </View>

              <View style={styles.priorityColumn}>
                <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(task.priority) }]}>
                  <Text style={styles.priorityText}>{task.priority}</Text>
                </View>
              </View>

              <View style={styles.statusColumn}>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(task.status) }]}>
                  <Text style={styles.statusText}>{task.status}</Text>
                </View>
              </View>

              <View style={styles.dueDateColumn}>
                <Text style={styles.dueDateText}>
                  {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No date'}
                </Text>
              </View>

              <View style={styles.actionsColumn}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => openModal(task)}
                >
                  <Ionicons name="create" size={16} color="#2196F3" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleDelete(task.id)}
                >
                  <Ionicons name="trash" size={16} color="#F44336" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      <Header title="Tasks Management" showBack={true} />

      {Platform.OS === 'web' ? renderWebContent() : renderMobileContent()}

      {/* Add/Edit Task Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editTask ? 'Edit Task' : 'Add New Task'}
            </Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={styles.saveButton}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Task Title */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Task Title *</Text>
              <TextInput
                style={styles.textInput}
                value={form.title}
                onChangeText={(text) => setForm(f => ({ ...f, title: text }))}
                placeholder="Enter task title"
                multiline
              />
            </View>

            {/* Description */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={form.description}
                onChangeText={(text) => setForm(f => ({ ...f, description: text }))}
                placeholder="Enter task description"
                multiline
                numberOfLines={4}
              />
            </View>

            {/* Teacher Assignment */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Assign to Teacher *</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={form.teacher_ids}
                  onValueChange={(value) => setForm(f => ({ ...f, teacher_ids: value }))}
                  style={styles.picker}
                >
                  <Picker.Item label="Select Teacher" value={null} />
                  {teachers.map(teacher => (
                    <Picker.Item
                      key={teacher.id}
                      label={teacher.name}
                      value={teacher.id}
                    />
                  ))}
                </Picker>
              </View>
            </View>

            {/* Priority */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Priority</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={form.priority}
                  onValueChange={(value) => setForm(f => ({ ...f, priority: value }))}
                  style={styles.picker}
                >
                  <Picker.Item label="Low" value="Low" />
                  <Picker.Item label="Medium" value="Medium" />
                  <Picker.Item label="High" value="High" />
                </Picker>
              </View>
            </View>

            {/* Status */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Status</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={form.status}
                  onValueChange={(value) => setForm(f => ({ ...f, status: value }))}
                  style={styles.picker}
                >
                  <Picker.Item label="Pending" value="Pending" />
                  <Picker.Item label="In Progress" value="In Progress" />
                  <Picker.Item label="Completed" value="Completed" />
                </Picker>
              </View>
            </View>

            {/* Due Date */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Due Date *</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.dateButtonText}>
                  {form.dueDate || 'Select Date'}
                </Text>
                <Ionicons name="calendar" size={20} color="#666" />
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>

        {/* Date Picker */}
        {showDatePicker && (
          <DateTimePicker
            value={form.dueDate ? new Date(form.dueDate) : new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
          />
        )}
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    ...(Platform.OS === 'web' && {
      height: '100vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }),
  },
  content: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      overflow: 'auto',
      overflowY: 'scroll',
      maxHeight: 'calc(100vh - 60px)', // Account for header
      scrollBehavior: 'smooth',
      WebkitOverflowScrolling: 'touch',
    }),
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Platform.OS === 'web' ? 80 : 30,
    ...(Platform.OS === 'web' && {
      minHeight: 'calc(100vh - 120px)',
      paddingBottom: 80,
    }),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },

  // Header Actions
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },

  // Filters
  filtersContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingLeft: 8,
    fontSize: 16,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  filterItem: {
    flex: 1,
    marginHorizontal: 4,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  pickerContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  picker: {
    height: 50,
    width: '100%',
  },

  // Summary Cards
  summaryContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },

  // Table
  tableContainer: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    ...(Platform.OS === 'web' && {
      marginBottom: 80,
    }),
  },
  tableTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  evenRow: {
    backgroundColor: '#fafafa',
  },

  // Table Columns
  titleColumn: {
    flex: 3,
    paddingRight: 8,
  },
  teacherColumn: {
    flex: 2,
    paddingHorizontal: 4,
  },
  priorityColumn: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  statusColumn: {
    flex: 1.5,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  dueDateColumn: {
    flex: 1.5,
    paddingHorizontal: 4,
  },
  actionsColumn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    paddingLeft: 4,
  },

  // Table Content
  taskTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  taskDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  teacherName: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 60,
    alignItems: 'center',
  },
  priorityText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 70,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  dueDateText: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
  },
  actionButton: {
    padding: 8,
    marginHorizontal: 2,
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2196F3',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  dateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333',
  },
});

export default TasksManagement;
