/**
 * Performance Optimization Hooks
 * تحسينات الأداء والذاكرة
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

/**
 * Lazy loading للصور مع intersection observer
 */
export function useLazyImage(src, placeholder = '') {
  const [imageSrc, setImageSrc] = useState(placeholder);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    if (!src) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = new Image();
            img.onload = () => {
              setImageSrc(src);
              setIsLoaded(true);
            };
            img.onerror = () => {
              setError(true);
            };
            img.src = src;
            observer.disconnect();
          }
        });
      },
      { rootMargin: '100px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [src]);

  return { imageSrc, isLoaded, error, imgRef };
}

/**
 * Virtual scrolling للقوائم الكبيرة
 */
export function useVirtualList(items, itemHeight, containerHeight) {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleItems = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + 2,
      items.length
    );

    return {
      items: items.slice(startIndex, endIndex),
      startIndex,
      endIndex,
      totalHeight: items.length * itemHeight,
      offsetY: startIndex * itemHeight
    };
  }, [items, itemHeight, containerHeight, scrollTop]);

  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);

  return { visibleItems, handleScroll };
}

/**
 * تتبع استخدام الذاكرة
 */
export function useMemoryMonitor(threshold = 0.8) {
  const [memoryInfo, setMemoryInfo] = useState(null);
  const [isHighUsage, setIsHighUsage] = useState(false);

  useEffect(() => {
    if (!performance.memory) return;

    const checkMemory = () => {
      const { usedJSHeapSize, jsHeapSizeLimit } = performance.memory;
      const usage = usedJSHeapSize / jsHeapSizeLimit;
      
      setMemoryInfo({
        used: usedJSHeapSize,
        limit: jsHeapSizeLimit,
        usage: (usage * 100).toFixed(1)
      });
      
      setIsHighUsage(usage > threshold);
    };

    checkMemory();
    const interval = setInterval(checkMemory, 10000);

    return () => clearInterval(interval);
  }, [threshold]);

  return { memoryInfo, isHighUsage };
}

/**
 * تنظيف الموارد عند unmount
 */
export function useCleanup(cleanupFn) {
  const cleanupRef = useRef(cleanupFn);
  cleanupRef.current = cleanupFn;

  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);
}

/**
 * تحميل البيانات مع caching
 */
export function useCachedFetch(url, options = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const cacheRef = useRef(new Map());
  const { ttl = 60000, enabled = true } = options;

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!enabled || !url) {
      setLoading(false);
      return;
    }

    const cacheKey = url;
    const cached = cacheRef.current.get(cacheKey);

    // استخدام الكاش إذا كان صالح
    if (!forceRefresh && cached && Date.now() - cached.timestamp < ttl) {
      setData(cached.data);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      if (!response.ok) throw new Error('Fetch failed');

      const result = await response.json();
      
      // حفظ في الكاش
      cacheRef.current.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [url, ttl, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refresh = useCallback(() => fetchData(true), [fetchData]);
  const clearCache = useCallback(() => cacheRef.current.clear(), []);

  return { data, loading, error, refresh, clearCache };
}

/**
 * تأخير التحديثات المتكررة
 */
export function useThrottle(value, limit = 100) {
  const [throttledValue, setThrottledValue] = useState(value);
  const lastRan = useRef(Date.now());

  useEffect(() => {
    const handler = setTimeout(() => {
      if (Date.now() - lastRan.current >= limit) {
        setThrottledValue(value);
        lastRan.current = Date.now();
      }
    }, limit - (Date.now() - lastRan.current));

    return () => clearTimeout(handler);
  }, [value, limit]);

  return throttledValue;
}

/**
 * تحسين إعادة الرسم
 */
export function useRafCallback(callback) {
  const rafRef = useRef(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const rafCallback = useCallback((...args) => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(() => {
      callbackRef.current(...args);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return rafCallback;
}

/**
 * تتبع حجم العنصر
 */
export function useElementSize(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!ref.current) return;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ width, height });
    });

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

export default {
  useLazyImage,
  useVirtualList,
  useMemoryMonitor,
  useCleanup,
  useCachedFetch,
  useThrottle,
  useRafCallback,
  useElementSize
};
