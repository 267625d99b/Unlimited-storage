import { useCallback, useRef } from 'react';
import axios from 'axios';

const API = '/api';

// Thumbnail loading queue for parallel loading with limit
class ThumbnailQueue {
  constructor(maxConcurrent = 5) {
    this.maxConcurrent = maxConcurrent;
    this.running = 0;
    this.queue = [];
  }

  async add(task) {
    if (this.running >= this.maxConcurrent) {
      await new Promise(resolve => this.queue.push(resolve));
    }
    this.running++;
    try {
      return await task();
    } finally {
      this.running--;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        next();
      }
    }
  }

  clear() {
    this.queue = [];
  }
}

export function useThumbnailQueue(setThumbnails) {
  const queueRef = useRef(new ThumbnailQueue(5));
  const loadedRef = useRef(new Set());

  const loadThumbnailsForFiles = useCallback((filesToLoad) => {
    const previewableFiles = filesToLoad.filter(f => 
      (f.type?.startsWith('image/') || f.type?.startsWith('video/')) &&
      !loadedRef.current.has(f.id)
    );
    
    previewableFiles.forEach(file => {
      loadedRef.current.add(file.id);
      queueRef.current.add(async () => {
        try {
          const thumbRes = await axios.get(`${API}/download/${file.id}`);
          setThumbnails(prev => ({ ...prev, [file.id]: thumbRes.data.url }));
        } catch (e) {
          loadedRef.current.delete(file.id);
          console.error('Thumbnail error:', e);
        }
      });
    });
  }, [setThumbnails]);

  const clearQueue = useCallback(() => {
    queueRef.current.clear();
  }, []);

  return { loadThumbnailsForFiles, clearQueue };
}

export default useThumbnailQueue;
