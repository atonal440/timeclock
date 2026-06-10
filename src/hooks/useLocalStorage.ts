import { useState, useEffect } from 'react';
import { loadData, saveData } from '../utils/storage';

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => loadData(key, initialValue));

  useEffect(() => {
    // Handling Set specifically, as it doesn't JSON.stringify well out of the box
    // But in our case we might use it for standard data.
    // If the value is a Set, convert it to an array for storage.
    if (storedValue instanceof Set) {
        saveData(key, Array.from(storedValue));
    } else {
        saveData(key, storedValue);
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}
