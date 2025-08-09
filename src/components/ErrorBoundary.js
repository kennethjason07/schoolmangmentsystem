import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error details
    console.error('🚨 ErrorBoundary caught an error:', error);
    console.error('🚨 ErrorBoundary error message:', error.message);
    console.error('🚨 ErrorBoundary error stack:', error.stack);
    console.error('🚨 ErrorBoundary error info:', errorInfo);
    console.error('🚨 ErrorBoundary component stack:', errorInfo.componentStack);
    
    // Special handling for color-related errors
    if (error.message && error.message.includes('color')) {
      console.error('🎨 COLOR ERROR DETECTED!');
      console.error('🔍 Full error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
        componentStack: errorInfo.componentStack
      });
      
      // Try to extract which component is causing the issue
      const stackLines = error.stack?.split('\n') || [];
      console.error('📍 Error stack trace lines:', stackLines.slice(0, 10));
    }
    
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={64} color="#f44336" />
          <Text style={styles.errorTitle}>Something went wrong!</Text>
          <Text style={styles.errorMessage}>
            {this.state.error && this.state.error.toString()}
          </Text>
          <Text style={styles.errorDetails}>
            Check the console for more details.
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => this.setState({ hasError: false, error: null, errorInfo: null })}
          >
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f44336',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorDetails: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ErrorBoundary;
