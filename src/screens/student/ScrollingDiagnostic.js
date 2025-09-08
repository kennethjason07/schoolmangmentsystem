import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, Platform, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';

// Test data
const testItems = Array.from({ length: 30 }, (_, index) => ({
  id: `item-${index + 1}`,
  title: `Test Item ${index + 1}`,
  description: `This is test item number ${index + 1}. It should be scrollable.`,
}));

const ScrollingDiagnostic = ({ navigation }) => {
  // Only show fixed height test
  const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

  console.log('🔍 Screen dimensions:', { screenHeight, screenWidth, platform: Platform.OS });

  const renderItem = ({ item, index }) => (
    <View style={[styles.testCard, index === 0 && styles.firstCard, index === testItems.length - 1 && styles.lastCard]}>
      <Text style={styles.itemTitle}>{item.title}</Text>
      <Text style={styles.itemDescription}>{item.description}</Text>
      <Text style={styles.itemIndex}>Index: {index + 1} / {testItems.length}</Text>
    </View>
  );

  const renderScrollViewItems = () => (
    testItems.map((item, index) => (
      <View key={item.id} style={[styles.testCard, index === 0 && styles.firstCard, index === testItems.length - 1 && styles.lastCard]}>
        <Text style={styles.itemTitle}>{item.title}</Text>
        <Text style={styles.itemDescription}>{item.description}</Text>
        <Text style={styles.itemIndex}>Index: {index + 1} / {testItems.length}</Text>
      </View>
    ))
  );

  return (
    <View style={styles.container}>
      <Header title="Scrolling Diagnostic Test" showBack={true} />
      <View style={styles.infoPanel}>
        <Text style={styles.infoText}>
          📊 Platform: {Platform.OS} | Screen: {screenWidth}x{screenHeight}
        </Text>
        <Text style={styles.instructionText}>
          👆 Try scrolling through all {testItems.length} items. You should be able to see item 1 to item {testItems.length}.
        </Text>
      </View>
      <View style={styles.scrollableArea}>
        <View style={styles.fixedContainer}>
          <FlatList
            data={testItems}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.flatListContent}
            style={styles.fixedFlatListStyle}
            showsVerticalScrollIndicator={true}
            scrollEnabled={true}
            bounces={Platform.OS === 'ios'}
            ListHeaderComponent={() => (
              <Text style={styles.headerText}>🔝 START - Fixed Height FlatList (400px)</Text>
            )}
            ListFooterComponent={() => (
              <Text style={styles.footerText}>🔚 END - Fixed Height FlatList</Text>
            )}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  methodSelector: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  methodButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeButton: {
    backgroundColor: '#1976d2',
  },
  methodButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  activeButtonText: {
    color: '#fff',
  },
  infoPanel: {
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#bbdefb',
  },
  infoText: {
    fontSize: 12,
    color: '#1976d2',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  instructionText: {
    fontSize: 13,
    color: '#1976d2',
    fontWeight: 'bold',
    marginTop: 6,
  },
  scrollableArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  flatListStyle: {
    flex: 1,
  },
  flatListContent: {
    paddingVertical: 8,
  },
  scrollViewStyle: {
    flex: 1,
  },
  scrollViewContent: {
    paddingVertical: 8,
  },
  fixedContainer: {
    height: 400,
    backgroundColor: '#ffebee',
    margin: 16,
    borderRadius: 8,
  },
  fixedFlatListStyle: {
    flex: 1,
  },
  testCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  firstCard: {
    borderLeftColor: '#4CAF50',
    backgroundColor: '#f1f8e9',
  },
  lastCard: {
    borderLeftColor: '#F44336',
    backgroundColor: '#ffebee',
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  itemIndex: {
    fontSize: 12,
    color: '#999',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  headerText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50',
    backgroundColor: '#f1f8e9',
    padding: 12,
    margin: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  footerText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F44336',
    backgroundColor: '#ffebee',
    padding: 12,
    margin: 16,
    marginTop: 8,
    borderRadius: 8,
  },
});

export default ScrollingDiagnostic;
