"use client";

import { useState, useEffect, useCallback } from 'react';

// Custom event for follow status changes
const FOLLOW_EVENT = 'valorhive:follow-change';

export interface FollowChangeEvent {
  type: 'follow' | 'unfollow';
  targetType: 'user' | 'org';
  targetId: string;
}

// Hook to listen for follow changes and trigger callbacks
export function useFollowCountRefresh() {
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const handleFollowChange = () => {
      setRefreshKey(prev => prev + 1);
    };

    window.addEventListener(FOLLOW_EVENT, handleFollowChange);
    return () => window.removeEventListener(FOLLOW_EVENT, handleFollowChange);
  }, []);

  return refreshKey;
}

// Function to dispatch a follow change event
export function dispatchFollowChange(event: FollowChangeEvent) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(FOLLOW_EVENT, { detail: event }));
  }
}

// Hook for components to trigger sidebar refresh
export function useTriggerFollowRefresh() {
  return useCallback((type: 'follow' | 'unfollow', targetType: 'user' | 'org', targetId: string) => {
    dispatchFollowChange({ type, targetType, targetId });
  }, []);
}
