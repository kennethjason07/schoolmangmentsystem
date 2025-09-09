import React from 'react';
import { View, Text, TouchableOpacity, FlatList, Alert, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CrossPlatformDatePicker, { DatePickerButton } from './CrossPlatformDatePicker';

const TeacherDashboardContent = ({
  navigation,
  schedule,
  groupedSchedule,
  adminTaskList,
  personalTasks,
  allAdminTasks,
  allPersonalTasks,
  showAllAdminTasks,
  showAllPersonalTasks,
  setShowAllAdminTasks,
  setShowAllPersonalTasks,
  setAdminTaskList,
  setPersonalTasks,
  addTaskModalVisible,
  setAddTaskModalVisible,
  newTask,
  setNewTask,
  showDatePicker,
  setShowDatePicker,
  handleAddTask,
  handleCompleteAdminTask,
  handleCompletePersonalTask,
  notifications,
  analytics,
  assignedClasses,
  upcomingEvents,
  recentActivities,
  announcements,
  // Helper functions passed as props
  formatTimeForDisplay,
  getPriorityInfo,
  getTaskTypeInfo,
  sortTasksByPriority
}) => {

  return (
    <View>
      {/* Quick Actions */}
      <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <View style={styles.sectionIcon}>
            <Ionicons name="flash" size={20} color="#1976d2" />
          </View>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>
        <View style={styles.quickActionsGrid}>
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => navigation.navigate('TeacherTimetable')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#1976d2' }]}>
              <Ionicons name="calendar" size={24} color="#fff" />
            </View>
            <Text style={styles.actionTitle}>My Timetable</Text>
            <Text style={styles.actionSubtitle}>View weekly schedule</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => navigation.navigate('Attendance')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#4caf50' }]}>
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
            </View>
            <Text style={styles.actionTitle}>Attendance</Text>
            <Text style={styles.actionSubtitle}>Mark student attendance</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => navigation.navigate('Marks')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#ff9800' }]}>
              <Ionicons name="document-text" size={24} color="#fff" />
            </View>
            <Text style={styles.actionTitle}>Marks & Exams</Text>
            <Text style={styles.actionSubtitle}>Manage assessments</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => navigation.navigate('ViewStudentInfo')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#9c27b0' }]}>
              <Ionicons name="people" size={24} color="#fff" />
            </View>
            <Text style={styles.actionTitle}>Students</Text>
            <Text style={styles.actionSubtitle}>View student info</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => navigation.navigate('ViewSubmissions')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#e91e63' }]}>
              <Ionicons name="document-text-outline" size={24} color="#fff" />
            </View>
            <Text style={styles.actionTitle}>Submissions</Text>
            <Text style={styles.actionSubtitle}>Grade assignments</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => navigation.navigate('LeaveApplication')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#4CAF50' }]}>
              <Ionicons name="calendar-outline" size={24} color="#fff" />
            </View>
            <Text style={styles.actionTitle}>Leave Request</Text>
            <Text style={styles.actionSubtitle}>Apply for leave</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Today's Schedule below stats */}
      <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <View style={styles.sectionIcon}>
            <Ionicons name="calendar" size={20} color="#1976d2" />
          </View>
          <Text style={styles.sectionTitle}>Today's Schedule & Upcoming Classes</Text>
        </View>
        <View style={{ marginHorizontal: 4, marginTop: 8 }}>
          {schedule?.length === 0 ? (
            <View style={styles.emptyScheduleContainer}>
              <Ionicons name="calendar-outline" size={48} color="#ccc" />
              <Text style={styles.emptyScheduleText}>No classes scheduled for today</Text>
              <Text style={styles.emptyScheduleSubtext}>Enjoy your free day!</Text>
            </View>
          ) : (
            groupedSchedule?.map(group => (
              <View key={group.classKey} style={{ marginBottom: 8 }}>
                <Text style={{ fontWeight: 'bold', fontSize: 15, color: '#1976d2', marginBottom: 4, marginLeft: 4 }}>
                  Class: {group.classKey}
                </Text>
                {group.items.map((item, index) => (
                  <TouchableOpacity
                    key={`schedule-${group.classKey}-${item.id || index}`}
                    style={styles.scheduleItem}
                    onPress={() => navigation.navigate('TeacherTimetable')}
                  >
                    <View style={styles.scheduleItemIcon}>
                      <Ionicons name="time" size={20} color="#1976d2" />
                    </View>
                    <View style={styles.scheduleItemContent}>
                      <Text style={styles.scheduleSubjectText}>{item.subject}</Text>
                      <Text style={styles.scheduleTimeText}>
                        {item.start_time} - {item.end_time} | Period {item.period_number}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#666" />
                  </TouchableOpacity>
                ))}
              </View>
            ))
          )}
        </View>
      </View>

      {/* Enhanced Tasks Section */}
      <View style={styles.section}>
        <View style={styles.tasksHeader}>
          <View style={styles.tasksHeaderLeft}>
            <View style={styles.tasksIconContainer}>
              <Ionicons name="list-circle" size={24} color="#1976d2" />
            </View>
            <View>
              <Text style={styles.tasksTitle}>My Tasks</Text>
              <Text style={styles.tasksSubtitle}>
                {(adminTaskList?.length || 0) + (personalTasks?.length || 0)} pending tasks
              </Text>
            </View>
          </View>
        </View>

        {/* Admin Tasks Section */}
        <View style={styles.tasksCategorySection}>
          <View style={styles.tasksCategoryHeader}>
            <View style={styles.tasksCategoryBadge}>
              <Ionicons name="shield-checkmark" size={16} color="#1976d2" />
              <Text style={styles.tasksCategoryTitle}>Admin Tasks</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.tasksCategoryCount}>
                <Text style={styles.tasksCategoryCountText}>
                  {showAllAdminTasks ? allAdminTasks?.length || 0 : adminTaskList?.length || 0}
                </Text>
              </View>
              {(allAdminTasks?.length || 0) > 3 && (
                <TouchableOpacity
                  onPress={() => {
                    setShowAllAdminTasks(!showAllAdminTasks);
                    setAdminTaskList(showAllAdminTasks ? allAdminTasks.slice(0, 3) : allAdminTasks);
                  }}
                  style={styles.viewAllButton}
                  activeOpacity={0.8}
                >
                  <Text style={styles.viewAllText}>
                    {showAllAdminTasks ? 'Show Less' : 'View All'}
                  </Text>
                  <Ionicons 
                    name={showAllAdminTasks ? 'chevron-up' : 'chevron-down'} 
                    size={14} 
                    color="#1976d2" 
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.tasksContainer}>
            {(adminTaskList?.length === 0 || !adminTaskList) && (
              <View style={styles.emptyTasksContainer}>
                <Ionicons name="checkmark-done-circle" size={48} color="#e0e0e0" />
                <Text style={styles.emptyTasksText}>All admin tasks completed!</Text>
                <Text style={styles.emptyTasksSubtext}>Great job staying on top of your responsibilities</Text>
              </View>
            )}
            {sortTasksByPriority(adminTaskList || []).map((task, index) => {
              const priorityInfo = getPriorityInfo(task.priority);
              const typeInfo = getTaskTypeInfo(task.task_type || task.type);
              return (
                <View key={`admin-task-${task.id || index}`} style={[styles.taskCard, { borderLeftColor: priorityInfo.color }]}>
                  <View style={styles.taskCardHeader}>
                    <View style={styles.taskCardContent}>
                      <View style={[styles.taskTypeIcon, { backgroundColor: typeInfo.color }]}>
                        <Ionicons
                          name={typeInfo.icon}
                          size={20}
                          color="#fff"
                        />
                      </View>
                      <View style={styles.taskInfo}>
                        <View style={styles.taskTitleRow}>
                          <Text style={styles.taskTitle}>{task.title || task.task_title || task.task || task.message}</Text>
                          <View style={[styles.priorityBadge, { backgroundColor: priorityInfo.bgColor }]}>
                            <Text style={[styles.priorityText, { color: priorityInfo.color }]}>
                              {priorityInfo.label}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.taskMeta}>
                          <Ionicons name="calendar-outline" size={14} color="#666" />
                          <Text style={styles.taskDueDate}>
                            Due: {task.due_date || task.due ?
                              new Date(task.due_date || task.due).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              }) :
                              new Date(task.created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric'
                              })
                            }
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleCompleteAdminTask(task.id)}
                    style={styles.completeTaskButton}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    <Text style={styles.completeTaskButtonText}>Done</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>

        {/* Personal Tasks Section */}
        <View style={styles.tasksCategorySection}>
          <View style={styles.tasksCategoryHeader}>
            <View style={styles.tasksCategoryBadge}>
              <Ionicons name="person-circle" size={16} color="#4CAF50" />
              <Text style={[styles.tasksCategoryTitle, { color: '#4CAF50' }]}>Personal Tasks</Text>
            </View>
            <View style={styles.personalTasksHeaderRight}>
              <View style={[styles.tasksCategoryCount, { backgroundColor: '#4CAF50' }]}>
                <Text style={styles.tasksCategoryCountText}>
                  {showAllPersonalTasks ? allPersonalTasks?.length || 0 : personalTasks?.length || 0}
                </Text>
              </View>
              {(allPersonalTasks?.length || 0) > 3 && (
                <TouchableOpacity
                  onPress={() => {
                    setShowAllPersonalTasks(!showAllPersonalTasks);
                    setPersonalTasks(showAllPersonalTasks ? allPersonalTasks.slice(0, 3) : allPersonalTasks);
                  }}
                  style={[styles.viewAllButton, { backgroundColor: '#e8f5e8', marginLeft: 8, marginRight: 8 }]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.viewAllText, { color: '#4CAF50' }]}>
                    {showAllPersonalTasks ? 'Show Less' : 'View All'}
                  </Text>
                  <Ionicons 
                    name={showAllPersonalTasks ? 'chevron-up' : 'chevron-down'} 
                    size={14} 
                    color="#4CAF50" 
                  />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => setAddTaskModalVisible(true)}
                style={styles.addPersonalTaskButton}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={16} color="#fff" style={{ marginRight: 4 }} />
                <Text style={styles.addPersonalTaskButtonText}>Add Task</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.tasksContainer}>
            {(personalTasks?.length === 0 || !personalTasks) && (
              <View style={styles.emptyTasksContainer}>
                <Ionicons name="happy" size={48} color="#e0e0e0" />
                <Text style={styles.emptyTasksText}>No personal tasks!</Text>
                <Text style={styles.emptyTasksSubtext}>Add a task to get started with your personal organization</Text>
              </View>
            )}
            {sortTasksByPriority(personalTasks || []).map((task, index) => {
              const priorityInfo = getPriorityInfo(task.priority);
              const typeInfo = getTaskTypeInfo(task.task_type || task.type);
              return (
                <View key={`personal-task-${task.id || index}`} style={[styles.taskCard, { borderLeftColor: priorityInfo.color }]}>
                  <View style={styles.taskCardHeader}>
                    <View style={styles.taskCardContent}>
                      <View style={[styles.taskTypeIcon, { backgroundColor: typeInfo.color }]}>
                        <Ionicons
                          name={typeInfo.icon}
                          size={20}
                          color="#fff"
                        />
                      </View>
                      <View style={styles.taskInfo}>
                        <View style={styles.taskTitleRow}>
                          <View style={styles.taskTitleContainer}>
                            <Text style={styles.taskTitle}>
                              {task.task_title || 'Untitled Task'}
                            </Text>
                            {task.task_description && task.task_description !== task.task_title && (
                              <Text style={styles.taskDescription} numberOfLines={2}>
                                {task.task_description}
                              </Text>
                            )}
                          </View>
                          <View style={[styles.priorityBadge, { backgroundColor: priorityInfo.bgColor }]}>
                            <Text style={[styles.priorityText, { color: priorityInfo.color }]}>
                              {priorityInfo.label}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.taskMeta}>
                          <Ionicons name="calendar-outline" size={14} color="#666" />
                          <Text style={styles.taskDueDate}>
                            Due: {task.due_date || task.due ?
                              new Date(task.due_date || task.due).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              }) :
                              new Date(task.created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric'
                              })
                            }
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleCompletePersonalTask(task.id)}
                    style={[styles.completeTaskButton, { backgroundColor: '#4CAF50' }]}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    <Text style={styles.completeTaskButtonText}>Done</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {/* Recent Notifications and Messages */}
      <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <View style={styles.sectionIcon}>
            <Ionicons name="notifications" size={20} color="#1976d2" />
          </View>
          <Text style={styles.sectionTitle}>Recent Notifications & Messages</Text>
        </View>
        <View style={{ marginHorizontal: 12, marginBottom: 18 }}>
          {notifications?.map((note, index) => (
            <View key={`notification-${note.id || index}`} style={styles.notificationCard}>
              <Text style={{ color: '#1976d2', fontWeight: 'bold', fontSize: 15 }}>{note.message}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                <Ionicons name="calendar" size={14} color="#888" style={{ marginRight: 4 }} />
                <Text style={{ color: '#888', fontSize: 13 }}>
                  {note.created_at ? new Date(note.created_at).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  }) : 'N/A'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Analytics */}
      <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <View style={styles.sectionIcon}>
            <Ionicons name="analytics" size={20} color="#1976d2" />
          </View>
          <Text style={styles.sectionTitle}>Analytics</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 8, marginBottom: 18 }}>
          <View style={styles.analyticsCard}>
            <Text style={{ fontWeight: 'bold', color: '#388e3c', fontSize: 16 }}>Attendance Rate</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
              <Ionicons name="checkmark-circle" size={22} color="#388e3c" style={{ marginRight: 6 }} />
              <Text style={{ color: '#1976d2', fontSize: 26, fontWeight: 'bold' }}>{analytics?.attendanceRate || 0}%</Text>
            </View>
            <View style={{ height: 6, backgroundColor: '#e0e0e0', borderRadius: 3, marginTop: 10 }}>
              <View style={{ width: `${analytics?.attendanceRate || 0}%`, height: 6, backgroundColor: '#388e3c', borderRadius: 3 }} />
            </View>
          </View>
          <View style={[styles.analyticsCard, { borderColor: '#fff3e0' }]}>
            <Text style={{ fontWeight: 'bold', color: '#ff9800', fontSize: 16 }}>Marks Distribution</Text>
            {analytics?.marksDistribution?.map(dist => (
              <View key={dist.label} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#ff9800', marginRight: 6 }} />
                <Text style={{ color: '#333', fontSize: 15 }}>{dist.label}: {dist.value}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Assigned Classes & Subjects Summary */}
      <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <View style={styles.sectionIcon}>
            <Ionicons name="school" size={20} color="#1976d2" />
          </View>
          <Text style={styles.sectionTitle}>Assigned Classes & Subjects</Text>
        </View>
        <View style={{ marginHorizontal: 12, marginBottom: 12 }}>
          {Object.entries(assignedClasses || {}).map(([className, subjects]) => (
            <View key={className} style={styles.classSubjectCard}>
              <Text style={{ fontWeight: 'bold', color: '#388e3c', fontSize: 15, marginBottom: 4 }}>Class {className}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {subjects?.map((subject, index) => (
                  <View key={`${className}-subject-${subject}-${index}`} style={{ backgroundColor: '#e3f2fd', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginRight: 8, marginBottom: 6 }}>
                    <Text style={{ color: '#1976d2', fontWeight: 'bold' }}>{subject}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Upcoming Events */}
      <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <View style={styles.sectionIcon}>
            <Ionicons name="calendar-outline" size={20} color="#1976d2" />
          </View>
          <Text style={styles.sectionTitle}>Upcoming Events</Text>
          <TouchableOpacity
            style={styles.addEventButton}
            onPress={() => Alert.alert('Add Event', 'Event management feature coming soon!')}
          >
            <Ionicons name="add-circle" size={24} color="#1976d2" />
          </TouchableOpacity>
        </View>

        {(upcomingEvents?.length === 0 || !upcomingEvents) ? (
          <View style={styles.emptyEventsContainer}>
            <Ionicons name="calendar-outline" size={48} color="#ccc" />
            <Text style={styles.emptyEventsText}>No upcoming events</Text>
            <Text style={styles.emptyEventsSubtext}>Your schedule is clear for now</Text>
          </View>
        ) : (
          <View style={styles.eventsContainer}>
            {upcomingEvents?.map((event, index) => (
              <TouchableOpacity
                key={`event-${event.id || index}`}
                style={[styles.eventCard, { borderLeftColor: event.color }]}
                onPress={() => {
                  Alert.alert(
                    event.title,
                    `${event.description}\n\nDate: ${new Date(event.date).toLocaleDateString('en-GB', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}\nTime: ${event.time}`,
                    [{ text: 'OK' }]
                  );
                }}
              >
                <View style={styles.eventHeader}>
                  <View style={[styles.eventIcon, { backgroundColor: event.color }]}>
                    <Ionicons name={event.icon} size={20} color="#fff" />
                  </View>
                  <View style={styles.eventInfo}>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    <Text style={styles.eventDescription} numberOfLines={2}>
                      {event.description}
                    </Text>
                  </View>
                  <View style={styles.eventMeta}>
                    <View style={[styles.priorityBadge, {
                      backgroundColor: event.priority === 'high' ? '#F44336' :
                                      event.priority === 'medium' ? '#FF9800' : '#4CAF50'
                    }]}>
                      <Text style={styles.priorityText}>
                        {event.priority?.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.eventFooter}>
                  <View style={styles.eventDateTime}>
                    <Ionicons name="calendar" size={14} color="#666" />
                    <Text style={styles.eventDate}>
                      {new Date(event.date).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short'
                      })}
                    </Text>
                    <Ionicons name="time" size={14} color="#666" style={{ marginLeft: 12 }} />
                    <Text style={styles.eventTime}>{event.time}</Text>
                  </View>
                  <View style={[styles.eventTypeBadge, { backgroundColor: `${event.color}20` }]}>
                    <Text style={[styles.eventTypeText, { color: event.color }]}>
                      {event.type?.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Recent Activities */}
      <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <View style={styles.sectionIcon}>
            <Ionicons name="pulse" size={20} color="#1976d2" />
          </View>
          <Text style={styles.sectionTitle}>Recent Activities</Text>
        </View>
        <View style={{ marginHorizontal: 12, marginBottom: 12 }}>
          {recentActivities?.map((act, index) => (
            <View key={`activity-${act.id || index}`} style={styles.activityCard}>
              <Text style={{ color: '#333', fontWeight: 'bold' }}>{act.activity}</Text>
              <Text style={{ color: '#888', marginTop: 2, fontSize: 13 }}>
                {act.date ? new Date(act.date).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric'
                }) : 'N/A'}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Announcements */}
      <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <View style={styles.sectionIcon}>
            <Ionicons name="megaphone" size={20} color="#1976d2" />
          </View>
          <Text style={styles.sectionTitle}>Announcements</Text>
        </View>
        <View style={{ marginHorizontal: 12, marginBottom: 18 }}>
          {announcements?.map((ann, index) => (
            <View key={`announcement-${ann.id || index}`} style={styles.announcementCard}>
              <Text style={{ color: '#388e3c', fontWeight: 'bold' }}>{ann.message}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976d2',
    flex: 1,
  },

  // Quick Actions
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  quickActionCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  actionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },

  // Schedule
  emptyScheduleContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
  },
  emptyScheduleText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 12,
  },
  emptyScheduleSubtext: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  scheduleItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  scheduleItemContent: {
    flex: 1,
  },
  scheduleSubjectText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 4,
  },
  scheduleTimeText: {
    fontSize: 14,
    color: '#666',
  },

  // Tasks
  tasksHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  tasksHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tasksIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  tasksTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 2,
  },
  tasksSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  tasksCategorySection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  tasksCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 12,
  },
  tasksCategoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tasksCategoryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976d2',
    marginLeft: 8,
  },
  tasksCategoryCount: {
    backgroundColor: '#1976d2',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tasksCategoryCountText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  personalTasksHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addPersonalTaskButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 8,
  },
  addPersonalTaskButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  viewAllText: {
    fontSize: 12,
    color: '#1976d2',
    fontWeight: 'bold',
    marginRight: 4,
  },
  tasksContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  emptyTasksContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTasksText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
  },
  emptyTasksSubtext: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
    textAlign: 'center',
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    borderLeftWidth: 4,
  },
  taskCardHeader: {
    flex: 1,
  },
  taskCardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  taskTypeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  taskInfo: {
    flex: 1,
  },
  taskTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  taskTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  taskDescription: {
    fontSize: 14,
    color: '#666',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskDueDate: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  completeTaskButton: {
    backgroundColor: '#1976d2',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 12,
  },
  completeTaskButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },

  // Notifications
  notificationCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#1976d2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },

  // Analytics
  analyticsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    margin: 6,
    flex: 1,
    minWidth: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },

  // Classes & Subjects
  classSubjectCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },

  // Events
  addEventButton: {
    padding: 8,
  },
  emptyEventsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
  },
  emptyEventsText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 12,
  },
  emptyEventsSubtext: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  eventsContainer: {
    marginHorizontal: 16,
  },
  eventCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  eventIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  eventInfo: {
    flex: 1,
    marginRight: 12,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  eventDescription: {
    fontSize: 14,
    color: '#666',
  },
  eventMeta: {
    alignItems: 'flex-end',
  },
  eventFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventDateTime: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventDate: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  eventTime: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  eventTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  eventTypeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },

  // Activities
  activityCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },

  // Announcements
  announcementCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
});

export default TeacherDashboardContent;
