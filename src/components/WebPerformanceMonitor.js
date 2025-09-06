import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';

const WebPerformanceMonitor = ({ children }) => {
  const [loadTime, setLoadTime] = useState(null);
  const [showMetrics, setShowMetrics] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const startTime = performance.now();
    
    // Monitor initial load
    const handleLoad = () => {
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      setLoadTime(totalTime);
      
      console.log('🚀 Web App Performance Metrics:');
      console.log(`📊 Total Load Time: ${totalTime.toFixed(2)}ms`);
      console.log(`📦 Bundle Size: ${(document.body.innerHTML.length / 1024).toFixed(2)}KB`);
      
      // Show metrics if load time is over 3 seconds
      if (totalTime > 3000) {
        setShowMetrics(true);
        console.warn('⚠️ Slow load detected. Consider further optimization.');
      }
    };

    // Listen for app ready state
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', handleLoad);
    } else {
      handleLoad();
    }

    return () => {
      document.removeEventListener('DOMContentLoaded', handleLoad);
    };
  }, []);

  if (Platform.OS !== 'web') {
    return children;
  }

  return (
    <>
      {children}
      {showMetrics && loadTime && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          background: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '10px',
          borderRadius: '5px',
          fontSize: '12px',
          zIndex: 9999,
          cursor: 'pointer'
        }} onClick={() => setShowMetrics(false)}>
          Load: {loadTime.toFixed(0)}ms (Click to dismiss)
        </div>
      )}
    </>
  );
};

export default WebPerformanceMonitor;
