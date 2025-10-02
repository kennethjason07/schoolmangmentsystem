import React from 'react';
import { TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Add CSS keyframes for spinning animation on web (only once globally)
if (Platform.OS === 'web' && !document.querySelector('#floating-refresh-styles')) {
  const style = document.createElement('style');
  style.id = 'floating-refresh-styles';
  style.textContent = `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    .floating-refresh-button {
      transition: all 0.3s ease !important;
      cursor: pointer !important;
    }
    
    .floating-refresh-button:hover {
      background-color: #1976D2 !important;
      transform: scale(1.05) !important;
    }
    
    .floating-refresh-button:active {
      transform: scale(0.95) !important;
    }
    
    .spinning-icon {
      animation: spin 1s linear infinite !important;
    }
  `;
  document.head.appendChild(style);
}

const FloatingRefreshButton = ({ 
  onPress, 
  refreshing = false, 
  bottom = 30, 
  right = 30,
  backgroundColor = '#2196F3',
  size = 56
}) => {
  // Only show on web
  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <TouchableOpacity
      style={[
        styles.floatingRefreshButton,
        {
          bottom,
          right,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
        }
      ]}
      className="floating-refresh-button"
      onPress={onPress}
      activeOpacity={0.8}
      disabled={refreshing}
    >
      <Ionicons 
        name={refreshing ? "sync" : "refresh"} 
        size={20} 
        color="#fff" 
        className={refreshing ? "spinning-icon" : ""}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  floatingRefreshButton: {
    position: 'fixed',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(33, 150, 243, 0.4)',
      },
    }),
  },
});

export default FloatingRefreshButton;