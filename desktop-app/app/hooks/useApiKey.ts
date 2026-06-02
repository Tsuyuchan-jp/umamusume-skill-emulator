import { useState, useEffect } from 'react';

const API_KEY_STORAGE_KEY = 'gemini_api_key';

export function useApiKey() {
  const [apiKey, setApiKeyState] = useState<string>('');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const storedKey = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (storedKey) {
      setApiKeyState(storedKey);
    }
    setIsLoaded(true);
  }, []);

  const setApiKey = (key: string) => {
    localStorage.setItem(API_KEY_STORAGE_KEY, key);
    setApiKeyState(key);
  };

  const removeApiKey = () => {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
    setApiKeyState('');
  };

  return { apiKey, setApiKey, removeApiKey, isLoaded };
}
