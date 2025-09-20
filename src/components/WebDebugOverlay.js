import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { getCachedTenantId } from '../utils/tenantHelpers';
import { useAuth } from '../utils/AuthContext';
import { useTenantAccess } from '../utils/tenantHelpers';

const WebDebugOverlay = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [debugInfo, setDebugInfo] = useState({});
  const { user } = useAuth();
  const { tenantId, isReady, tenantName, tenant } = useTenantAccess();

  useEffect(() => {
    // Update debug info every second
    const interval = setInterval(() => {
      const cachedTenantId = getCachedTenantId();
      setDebugInfo({
        timestamp: new Date().toLocaleTimeString(),
        tenantId,
        cachedTenantId,
        isReady,
        tenantName,
        userId: user?.id,
        userEmail: user?.email,
        tenantObject: tenant ? { id: tenant.id, name: tenant.name } : null,
        url: window.location.href,
        userAgent: navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Other'
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [tenantId, isReady, tenantName, user, tenant]);

  const toggleVisibility = () => {
    setIsVisible(!isVisible);
    console.log('🔍 Web Debug Overlay toggled:', !isVisible);
    console.log('🔍 Current debug info:', debugInfo);
  };

  if (!isVisible) {
    return (
      <TouchableOpacity 
        style={styles.toggleButton} 
        onPress={toggleVisibility}
      >
        <Text style={styles.toggleText}>🐛</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.header}>
        <Text style={styles.title}>🌐 Web Debug Info</Text>
        <TouchableOpacity onPress={toggleVisibility}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.content}>
        <Text style={styles.debugText}>
          🕒 {debugInfo.timestamp}
        </Text>
        <Text style={[styles.debugText, !debugInfo.tenantId && styles.error]}>
          🏢 Tenant ID: {debugInfo.tenantId || 'NULL'}
        </Text>
        <Text style={[styles.debugText, !debugInfo.cachedTenantId && styles.error]}>
          💾 Cached: {debugInfo.cachedTenantId || 'NULL'}
        </Text>
        <Text style={[styles.debugText, !debugInfo.isReady && styles.warning]}>
          ✅ Ready: {debugInfo.isReady ? 'YES' : 'NO'}
        </Text>
        <Text style={styles.debugText}>
          📛 Tenant: {debugInfo.tenantName || 'Unknown'}
        </Text>
        <Text style={[styles.debugText, !debugInfo.userId && styles.error]}>
          👤 User: {debugInfo.userId || 'Not logged in'}
        </Text>
        <Text style={styles.debugText}>
          📧 Email: {debugInfo.userEmail || 'Unknown'}
        </Text>
        <Text style={styles.debugText}>
          🌐 Browser: {debugInfo.userAgent}
        </Text>
      </View>
      
      <TouchableOpacity 
        style={styles.testButton}
        onPress={() => {
          console.log('🔍 Manual debug trigger - Full state:');
          console.log('🔍 Debug Info:', debugInfo);
          console.log('🔍 Window location:', window.location.href);
          console.log('🔍 Local storage:', {
            tenantId: localStorage.getItem('tenantId'),
            userSession: localStorage.getItem('supabase.auth.token')
          });
          alert(`Debug info logged to console at ${new Date().toLocaleTimeString()}`);
        }}
      >
        <Text style={styles.testButtonText}>📝 Log Full Debug</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  toggleButton: {
    position: 'fixed',
    top: 10,
    right: 10,
    width: 40,
    height: 40,
    backgroundColor: '#FF6B6B',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  toggleText: {
    fontSize: 20,
    color: '#fff',
  },
  overlay: {
    position: 'fixed',
    top: 10,
    right: 10,
    width: 300,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 8,
    padding: 10,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingBottom: 5,
  },
  title: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  closeButton: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    marginBottom: 10,
  },
  debugText: {
    color: '#fff',
    fontSize: 11,
    marginBottom: 2,
    fontFamily: 'monospace',
  },
  error: {
    color: '#FF6B6B',
    fontWeight: 'bold',
  },
  warning: {
    color: '#FFA500',
    fontWeight: 'bold',
  },
  testButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    alignItems: 'center',
  },
  testButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default WebDebugOverlay;