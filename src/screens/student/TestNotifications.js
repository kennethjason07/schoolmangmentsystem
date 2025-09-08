import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';

// Test data with many notifications to test scrolling
const testNotifications = Array.from({ length: 25 }, (_, index) => ({
  id: `test-${index + 1}`,
  title: `Test Notification ${index + 1}`,
  message: `This is a test notification message ${index + 1} to verify that scrolling is working properly. This message should be long enough to show the scrolling behavior.`,
  date: '2025-01-08',
  read: index % 3 === 0, // Make some read, some unread
  type: index % 4 === 0 ? 'Urgent' : 'General',
}));

const TestNotifications = ({ navigation }) => {
  const renderNotification = ({ item }) => (
    <View style={[styles.card, item.read ? styles.cardRead : styles.cardUnread]}>
      <View style={styles.cardHeader}>
        <Ionicons name={item.read ? 'mail-open' : 'mail'} size={22} color={item.read ? '#888' : '#1976d2'} style={{ marginRight: 10 }} />
        <Text style={[styles.title, item.read && { color: '#888' }]}>{item.title}</Text>
        <Text style={styles.date}>{item.date}</Text>
      </View>
      
      <View style={styles.badgeRow}>
        <View style={[styles.typeBadge, { backgroundColor: item.type === 'Urgent' ? '#F44336' : '#4CAF50' }]}>
          <Text style={styles.badgeText}>{item.type.toUpperCase()}</Text>
        </View>
      </View>
      
      <Text style={styles.message}>{item.message}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Header title="Test Notifications (25 items)" showBack={true} />
      
      <View style={styles.contentContainer}>
        <Text style={styles.instruction}>
          📱 This screen has 25 test notifications. Try scrolling up and down to verify scrolling works properly!
        </Text>
        
        <FlatList
          data={testNotifications}
          keyExtractor={item => item.id}
          renderItem={renderNotification}
          contentContainerStyle={{ 
            paddingBottom: 24,
            flexGrow: 1,
          }}
          style={{ 
            flex: 1,
          }}
          showsVerticalScrollIndicator={true}
          scrollEnabled={true}
          bounces={true}
          ListEmptyComponent={<Text style={styles.empty}>No test notifications found.</Text>}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  instruction: {
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    textAlign: 'center',
    color: '#1976d2',
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#e3eaf2',
  },
  cardUnread: {
    borderLeftWidth: 5,
    borderLeftColor: '#1976d2',
  },
  cardRead: {
    borderLeftWidth: 5,
    borderLeftColor: '#bdbdbd',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
    color: '#222',
  },
  date: {
    color: '#888',
    fontSize: 13,
    marginLeft: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 8,
    marginTop: 2,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    alignSelf: 'flex-start',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  message: {
    color: '#333',
    fontSize: 15,
    marginBottom: 8,
    marginTop: 2,
  },
  empty: {
    color: '#888',
    textAlign: 'center',
    marginTop: 40,
  },
});

export default TestNotifications;
