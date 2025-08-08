import { useState } from 'react';

/**
 * Custom hook for pull-to-refresh functionality
 * @param {Function} onRefresh - Function to call when refresh is triggered
 * @param {boolean} initialRefreshing - Initial refreshing state (default: false)
 * @returns {Object} { refreshing, onRefresh: wrappedOnRefresh }
 */
export const usePullToRefresh = (onRefresh, initialRefreshing = false) => {
  const [refreshing, setRefreshing] = useState(initialRefreshing);

  const wrappedOnRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  return {
    refreshing,
    onRefresh: wrappedOnRefresh,
  };
};

export default usePullToRefresh;
