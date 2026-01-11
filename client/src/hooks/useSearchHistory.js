/**
 * Search History Hook
 * حفظ واسترجاع عمليات البحث السابقة
 */

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'search_history';
const MAX_HISTORY = 10;

export function useSearchHistory() {
  const [history, setHistory] = useState([]);

  // تحميل السجل من localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Error loading search history:', e);
    }
  }, []);

  // حفظ السجل في localStorage
  const saveHistory = useCallback((newHistory) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
      setHistory(newHistory);
    } catch (e) {
      console.error('Error saving search history:', e);
    }
  }, []);

  // إضافة بحث جديد
  const addSearch = useCallback((query, filters = {}) => {
    if (!query?.trim()) return;

    const newEntry = {
      id: Date.now(),
      query: query.trim(),
      filters,
      timestamp: new Date().toISOString()
    };

    setHistory(prev => {
      // إزالة التكرارات
      const filtered = prev.filter(item => 
        item.query.toLowerCase() !== query.trim().toLowerCase()
      );
      
      // إضافة الجديد في البداية
      const newHistory = [newEntry, ...filtered].slice(0, MAX_HISTORY);
      saveHistory(newHistory);
      return newHistory;
    });
  }, [saveHistory]);

  // حذف عنصر من السجل
  const removeSearch = useCallback((id) => {
    setHistory(prev => {
      const newHistory = prev.filter(item => item.id !== id);
      saveHistory(newHistory);
      return newHistory;
    });
  }, [saveHistory]);

  // مسح كل السجل
  const clearHistory = useCallback(() => {
    saveHistory([]);
  }, [saveHistory]);

  // البحث في السجل
  const searchInHistory = useCallback((query) => {
    if (!query?.trim()) return history;
    
    const lowerQuery = query.toLowerCase();
    return history.filter(item => 
      item.query.toLowerCase().includes(lowerQuery)
    );
  }, [history]);

  return {
    history,
    addSearch,
    removeSearch,
    clearHistory,
    searchInHistory
  };
}

export default useSearchHistory;
