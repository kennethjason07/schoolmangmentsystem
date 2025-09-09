import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import StatCard from './StatCard';

const TeacherDashboardHeader = ({ 
  teacherProfile, 
  schoolDetails, 
  teacherStats, 
  loading 
}) => {
  return (
    <View>
      {/* Welcome Section at the very top */}
      <View style={styles.welcomeSection}>
        <Text style={styles.welcomeText}>
          Welcome back, {teacherProfile?.name || teacherProfile?.full_name || 'Teacher'}!
        </Text>
        <Text style={styles.dateText}>
          {new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </Text>
      </View>

      {/* School Details Card - AdminDashboard Style */}
      {schoolDetails && (
        <View style={styles.schoolDetailsSection}>
          {/* Decorative background elements */}
          <View style={styles.backgroundCircle1} />
          <View style={styles.backgroundCircle2} />
          <View style={styles.backgroundPattern} />
          
          <View style={styles.welcomeContent}>
            <View style={styles.schoolHeader}>
              {schoolDetails.logo_url ? (
                <Image source={{ uri: schoolDetails.logo_url }} style={styles.schoolLogo} />
              ) : (
                <View style={styles.logoPlaceholder}>
                  <Ionicons name="school" size={40} color="#fff" />
                </View>
              )}
              <View style={styles.schoolInfo}>
                <Text style={styles.schoolName}>
                  {schoolDetails.name || 'Maximus School'}
                </Text>
                <Text style={styles.schoolType}>
                  {schoolDetails.type || 'Educational Institution'}
                </Text>
              </View>
            </View>
            
            <View style={styles.dateContainer}>
              <Ionicons name="calendar-outline" size={16} color="rgba(255,255,255,0.8)" />
              <Text style={styles.schoolDateText}>
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Enhanced Stats Cards Section */}
      <View style={styles.statsSection}>
        <View style={styles.statsSectionHeader}>
          <Ionicons name="analytics" size={20} color="#1976d2" />
          <Text style={styles.statsSectionTitle}>Quick Overview</Text>
        </View>

        <View style={styles.statsColumnContainer}>
          {teacherStats[0] ? (
            <StatCard {...teacherStats[0]} loading={loading} />
          ) : (
            <StatCard
              title="My Students"
              value="0"
              icon="people"
              color="#2196F3"
              subtitle="Loading..."
              loading={loading}
            />
          )}

          {teacherStats[1] ? (
            <StatCard {...teacherStats[1]} loading={loading} />
          ) : (
            <StatCard
              title="My Subjects"
              value="0"
              icon="book"
              color="#4CAF50"
              subtitle="Loading..."
              loading={loading}
            />
          )}

          {teacherStats[2] ? (
            <StatCard {...teacherStats[2]} loading={loading} />
          ) : (
            <StatCard
              title="Today's Classes"
              value="0"
              icon="time"
              color="#FF9800"
              subtitle="Loading..."
              loading={loading}
            />
          )}

          {teacherStats[3] ? (
            <StatCard {...teacherStats[3]} loading={loading} />
          ) : (
            <StatCard
              title="Attendance Rate"
              value="0%"
              icon="checkmark-circle"
              color="#4CAF50"
              subtitle="Loading..."
              loading={loading}
            />
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  welcomeSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#f8f9fa',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },

  // School Details Section - AdminDashboard Style
  schoolDetailsSection: {
    marginVertical: 12,
    marginHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#667eea',
    shadowColor: '#667eea',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  backgroundCircle1: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    top: -50,
    right: -30,
  },
  backgroundCircle2: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    bottom: -20,
    left: -20,
  },
  backgroundPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(118, 75, 162, 0.6)',
  },
  welcomeContent: {
    padding: 24,
    zIndex: 1,
  },
  schoolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  schoolLogo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 15,
  },
  logoPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  schoolInfo: {
    flex: 1,
  },
  schoolName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  schoolType: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  schoolDateText: {
    fontSize: 16,
    color: '#ffffff',
    marginLeft: 8,
    fontWeight: '500',
  },

  // Stats Section
  statsSection: {
    marginBottom: 16,
  },
  statsSectionHeader: {
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
  statsSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976d2',
    marginLeft: 8,
  },
  statsColumnContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
});

export default TeacherDashboardHeader;
