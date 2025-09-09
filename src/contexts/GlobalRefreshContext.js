/**
 * 🔄 GLOBAL REFRESH CONTEXT
 * Manages app-wide data refreshes to keep all screens synchronized
 */

import React, { createContext, useContext, useRef, useCallback } from 'react';

const GlobalRefreshContext = createContext();

export const useGlobalRefresh = () => {
  const context = useContext(GlobalRefreshContext);
  if (!context) {
    throw new Error('useGlobalRefresh must be used within a GlobalRefreshProvider');
  }
  return context;
};

export const GlobalRefreshProvider = ({ children }) => {
  // Store refresh callbacks from different screens
  const refreshCallbacks = useRef({});

  // Register a screen's refresh function
  const registerRefreshCallback = useCallback((screenName, refreshFn) => {
    if (typeof refreshFn !== 'function') {
      console.error(`[GlobalRefresh] Invalid refresh function for ${screenName}`);
      return;
    }
    
    refreshCallbacks.current[screenName] = refreshFn;
    console.log(`🔄 [GlobalRefresh] Registered refresh callback for ${screenName}`);
  }, []);

  // Unregister a screen's refresh function
  const unregisterRefreshCallback = useCallback((screenName) => {
    delete refreshCallbacks.current[screenName];
    console.log(`🔄 [GlobalRefresh] Unregistered refresh callback for ${screenName}`);
  }, []);

  // Trigger refresh for all registered screens
  const triggerGlobalRefresh = useCallback(async (excludeScreens = []) => {
    console.log(`🔄 [GlobalRefresh] Triggering global refresh...`);
    const screens = Object.keys(refreshCallbacks.current);
    
    if (screens.length === 0) {
      console.warn(`🔄 [GlobalRefresh] No screens registered for refresh`);
      return;
    }

    const refreshPromises = screens
      .filter(screen => !excludeScreens.includes(screen))
      .map(async (screenName) => {
        try {
          console.log(`🔄 [GlobalRefresh] Refreshing ${screenName}...`);
          const refreshFn = refreshCallbacks.current[screenName];
          if (refreshFn) {
            await refreshFn();
            console.log(`✅ [GlobalRefresh] ${screenName} refreshed successfully`);
          }
        } catch (error) {
          console.error(`❌ [GlobalRefresh] Failed to refresh ${screenName}:`, error);
        }
      });

    await Promise.allSettled(refreshPromises);
    console.log(`✅ [GlobalRefresh] Global refresh completed`);
  }, []);

  // Trigger refresh for specific screens
  const triggerScreenRefresh = useCallback(async (screenNames = []) => {
    if (!Array.isArray(screenNames)) {
      screenNames = [screenNames];
    }

    console.log(`🔄 [GlobalRefresh] Triggering refresh for screens:`, screenNames);

    const refreshPromises = screenNames.map(async (screenName) => {
      try {
        const refreshFn = refreshCallbacks.current[screenName];
        if (refreshFn) {
          await refreshFn();
          console.log(`✅ [GlobalRefresh] ${screenName} refreshed successfully`);
        } else {
          console.warn(`⚠️ [GlobalRefresh] No refresh callback found for ${screenName}`);
        }
      } catch (error) {
        console.error(`❌ [GlobalRefresh] Failed to refresh ${screenName}:`, error);
      }
    });

    await Promise.allSettled(refreshPromises);
  }, []);

  const value = {
    registerRefreshCallback,
    unregisterRefreshCallback,
    triggerGlobalRefresh,
    triggerScreenRefresh,
    getRegisteredScreens: () => Object.keys(refreshCallbacks.current)
  };

  return (
    <GlobalRefreshContext.Provider value={value}>
      {children}
    </GlobalRefreshContext.Provider>
  );
};
