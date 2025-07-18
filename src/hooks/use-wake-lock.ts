
"use client";

import { useState, useEffect, useCallback } from 'react';

export function useWakeLock() {
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);

  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator) {
      try {
        const lock = await navigator.wakeLock.request('screen');
        setWakeLock(lock);
        console.log('Screen Wake Lock is active.');
        lock.addEventListener('release', () => {
          console.log('Screen Wake Lock was released.');
          setWakeLock(null);
        });
      } catch (err: any) {
        console.error(`${err.name}, ${err.message}`);
      }
    } else {
        console.log('Wake Lock API is not supported by this browser.');
    }
  }, []);

  useEffect(() => {
    requestWakeLock();

    const handleVisibilityChange = () => {
      if (wakeLock !== null && document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (wakeLock !== null) {
        wakeLock.release();
        setWakeLock(null);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [wakeLock, requestWakeLock]);
}
