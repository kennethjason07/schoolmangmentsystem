import React, { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Alert } from 'react-native';
import { 
  Button, 
  Card, 
  Input, 
  LoadingState, 
  EmptyState, 
  EmptyStatePresets, 
  Theme 
} from './index';
import StatCard from './StatCard';
import Colors from '../../constants/Colors';

const UIDemo = () => {
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEmpty, setShowEmpty] = useState(false);

  const handleButtonPress = () => {
    Alert.alert('Button Pressed', 'Modern button component works!');
  };

  const handleLoadingTest = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 3000);
  };

  const handleEmptyStateTest = () => {
    setShowEmpty(!showEmpty);
  };

  if (showEmpty) {
    return (
      <View style={styles.container}>
        <EmptyState
          {...EmptyStatePresets.noStudents}
          onActionPress={() => setShowEmpty(false)}
          secondaryActionText="Go Back"
          onSecondaryActionPress={() => setShowEmpty(false)}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {loading && <LoadingState fullScreen text="Loading..." />}
      
      {/* Header */}
      <Text style={styles.header}>Modern UI Components Demo</Text>
      
      {/* Buttons Section */}
      <Card variant="elevated" margin="medium">
        <Text style={styles.sectionTitle}>Buttons</Text>
        
        <View style={styles.buttonRow}>
          <Button 
            title="Primary" 
            onPress={handleButtonPress}
            variant="primary"
            style={styles.buttonSpacing}
          />
          <Button 
            title="Secondary" 
            onPress={handleButtonPress}
            variant="secondary"
            style={styles.buttonSpacing}
          />
        </View>
        
        <View style={styles.buttonRow}>
          <Button 
            title="Outline" 
            onPress={handleButtonPress}
            variant="outline"
            style={styles.buttonSpacing}
          />
          <Button 
            title="Ghost" 
            onPress={handleButtonPress}
            variant="ghost"
            style={styles.buttonSpacing}
          />
        </View>
        
        <Button 
          title="Gradient Button" 
          onPress={handleButtonPress}
          variant="primary"
          gradient
          fullWidth
          icon="sparkles"
          style={styles.gradientButton}
        />
        
        <Button 
          title="Loading Button" 
          onPress={handleLoadingTest}
          loading={loading}
          fullWidth
        />
      </Card>

      {/* Input Section */}
      <Card variant="elevated" margin="medium">
        <Text style={styles.sectionTitle}>Inputs</Text>
        
        <Input
          label="Email"
          value={inputValue}
          onChangeText={setInputValue}
          placeholder="Enter your email"
          leftIcon="mail"
          keyboardType="email-address"
          variant="outlined"
        />
        
        <Input
          label="Password"
          placeholder="Enter password"
          secureTextEntry
          variant="filled"
        />
        
        <Input
          label="Message"
          placeholder="Enter your message"
          multiline
          numberOfLines={3}
          variant="outlined"
          maxLength={200}
        />
      </Card>

      {/* StatCards Section */}
      <Card variant="elevated" margin="medium">
        <Text style={styles.sectionTitle}>Stat Cards</Text>
        
        <View style={styles.statsGrid}>
          <StatCard
            title="Total Students"
            value="1,234"
            icon="people"
            color={Colors.primary}
            subtitle="Active students"
            variant="gradient"
            animated
            style={styles.statCard}
          />
          
          <StatCard
            title="Attendance"
            value="95%"
            icon="checkmark-circle"
            color={Colors.success}
            subtitle="This month"
            trend={1}
            change={5.2}
            variant="default"
            animated
            style={styles.statCard}
          />
        </View>
      </Card>

      {/* Cards Section */}
      <Card variant="elevated" margin="medium">
        <Text style={styles.sectionTitle}>Cards</Text>
        
        <Card 
          variant="outlined" 
          onPress={() => Alert.alert('Card pressed!')}
          margin="small"
        >
          <Text style={Theme.TextStyles.h6}>Interactive Card</Text>
          <Text style={Theme.TextStyles.bodySmall}>This card responds to touch</Text>
        </Card>
        
        <Card variant="gradient" gradientColors={[Colors.chart.blue, Colors.chart.purple]}>
          <Text style={[Theme.TextStyles.h6, { color: Colors.white }]}>Gradient Card</Text>
          <Text style={[Theme.TextStyles.bodySmall, { color: 'rgba(255,255,255,0.8)' }]}>
            Beautiful gradient background
          </Text>
        </Card>
      </Card>

      {/* Loading States Section */}
      <Card variant="elevated" margin="medium">
        <Text style={styles.sectionTitle}>Loading States</Text>
        
        <View style={styles.loadingRow}>
          <LoadingState variant="spinner" size="small" text="Spinner" />
          <LoadingState variant="dots" size="medium" text="Dots" />
          <LoadingState variant="pulse" size="large" text="Pulse" />
        </View>
      </Card>

      {/* Demo Actions */}
      <Card variant="outlined" margin="medium">
        <Text style={styles.sectionTitle}>Demo Actions</Text>
        
        <Button
          title="Test Loading State"
          onPress={handleLoadingTest}
          variant="outline"
          fullWidth
          style={styles.demoButton}
        />
        
        <Button
          title="Show Empty State"
          onPress={handleEmptyStateTest}
          variant="outline"
          fullWidth
        />
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Theme.Spacing.base,
  },
  header: {
    ...Theme.TextStyles.h2,
    textAlign: 'center',
    marginBottom: Theme.Spacing.lg,
    color: Colors.primary,
  },
  sectionTitle: {
    ...Theme.TextStyles.h5,
    marginBottom: Theme.Spacing.md,
    color: Colors.text,
  },
  buttonRow: {
    flexDirection: 'row',
    marginBottom: Theme.Spacing.md,
  },
  buttonSpacing: {
    flex: 1,
    marginRight: Theme.Spacing.sm,
  },
  gradientButton: {
    marginBottom: Theme.Spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    marginHorizontal: Theme.Spacing.xs,
  },
  loadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: Theme.Spacing.lg,
  },
  demoButton: {
    marginBottom: Theme.Spacing.md,
  },
});

export default UIDemo;
