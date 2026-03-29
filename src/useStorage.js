import { useState, useEffect, useCallback } from 'react';

const PREFIX = 'pg_manager_';

export function useLocalStorage(key, defaultValue) {
  const fullKey = PREFIX + key;

  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(fullKey);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const set = useCallback((val) => {
    setValue(val);
    try {
      localStorage.setItem(fullKey, JSON.stringify(val));
    } catch (e) {
      console.warn('localStorage write failed:', e);
    }
  }, [fullKey]);

  return [value, set];
}
