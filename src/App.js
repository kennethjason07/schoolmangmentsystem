import React from 'react';
import { View, Text } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ fontSize: 20, color: 'red', fontWeight: 'bold', marginBottom: 12 }}>Something went wrong.</Text>
          <Text selectable style={{ color: '#333', marginBottom: 8 }}>{String(this.state.error)}</Text>
          {this.state.errorInfo && (
            <Text selectable style={{ color: '#666', fontSize: 12 }}>{this.state.errorInfo.componentStack}</Text>
          )}
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppNavigator />
    </ErrorBoundary>
  );
}