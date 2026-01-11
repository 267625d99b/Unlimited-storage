/**
 * Chunked Upload Hook
 * هوك لرفع الملفات الكبيرة على أجزاء
 */

import { useState, useCallback, useRef } from 'react';
import axios from 'axios';

const API = '/api';
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB - must match server
const MAX_CONCURRENT_CHUNKS = 3; // Upload 3 chunks at a time
const MAX_RETRIES = 3;

export function useChunkedUpload(options = {}) {
  const { onProgress, onComplete, onError } = options;
  
  const [uploads, setUploads] = useState({}); // uploadId -> upload state
  const [isUploading, setIsUploading] = useState(false);
  const abortControllers = useRef({});

  /**
   * Start uploading a file
   */
  const uploadFile = useCallback(async (file, folderId = null) => {
    const fileId = `${file.name}-${file.size}-${Date.now()}`;
    
    try {
      setIsUploading(true);
      
      // Initialize upload state
      setUploads(prev => ({
        ...prev,
        [fileId]: {
          fileName: file.name,
          fileSize: file.size,
          progress: 0,
          status: 'initializing',
          uploadId: null,
          error: null
        }
      }));

      // Calculate total chunks
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

      // Initialize upload session on server
      const initRes = await axios.post(`${API}/chunked/init`, {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || 'application/octet-stream',
        folderId,
        totalChunks
      });

      const { uploadId, resumed, missingChunks } = initRes.data;
      
      // Create abort controller
      abortControllers.current[uploadId] = new AbortController();

      // Update state with uploadId
      setUploads(prev => ({
        ...prev,
        [fileId]: {
          ...prev[fileId],
          uploadId,
          status: resumed ? 'resuming' : 'uploading',
          totalChunks
        }
      }));

      // Determine which chunks to upload
      const chunksToUpload = resumed && missingChunks 
        ? missingChunks 
        : Array.from({ length: totalChunks }, (_, i) => i);

      // Upload chunks with concurrency control
      await uploadChunksWithConcurrency(
        file, 
        uploadId, 
        chunksToUpload, 
        totalChunks,
        fileId
      );

      // Complete upload
      setUploads(prev => ({
        ...prev,
        [fileId]: { ...prev[fileId], status: 'completing' }
      }));

      const completeRes = await axios.post(`${API}/chunked/${uploadId}/complete`);

      // Success!
      setUploads(prev => ({
        ...prev,
        [fileId]: {
          ...prev[fileId],
          status: 'completed',
          progress: 100,
          file: completeRes.data.file
        }
      }));

      onComplete?.(completeRes.data.file, file);
      
      // Cleanup
      delete abortControllers.current[uploadId];
      
      return completeRes.data.file;

    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'فشل في رفع الملف';
      
      setUploads(prev => ({
        ...prev,
        [fileId]: {
          ...prev[fileId],
          status: 'error',
          error: errorMessage
        }
      }));

      onError?.(errorMessage, file);
      throw error;

    } finally {
      setIsUploading(false);
    }
  }, [onProgress, onComplete, onError]);

  /**
   * Upload chunks with concurrency control
   */
  const uploadChunksWithConcurrency = async (file, uploadId, chunksToUpload, totalChunks, fileId) => {
    const queue = [...chunksToUpload];
    const inProgress = new Set();
    let uploadedCount = totalChunks - chunksToUpload.length; // Already uploaded chunks

    const uploadNextChunk = async () => {
      if (queue.length === 0) return;
      
      const chunkIndex = queue.shift();
      inProgress.add(chunkIndex);

      try {
        await uploadSingleChunk(file, uploadId, chunkIndex);
        uploadedCount++;
        
        // Update progress
        const progress = Math.round((uploadedCount / totalChunks) * 100);
        setUploads(prev => ({
          ...prev,
          [fileId]: { ...prev[fileId], progress, uploadedChunks: uploadedCount }
        }));
        onProgress?.(progress, file);

      } catch (error) {
        // Retry logic
        const retryCount = (error.retryCount || 0) + 1;
        if (retryCount <= MAX_RETRIES) {
          console.log(`Retrying chunk ${chunkIndex} (attempt ${retryCount})`);
          error.retryCount = retryCount;
          queue.push(chunkIndex); // Re-add to queue
        } else {
          throw error;
        }
      } finally {
        inProgress.delete(chunkIndex);
      }
    };

    // Process queue with concurrency
    while (queue.length > 0 || inProgress.size > 0) {
      // Check if cancelled
      if (abortControllers.current[uploadId]?.signal.aborted) {
        throw new Error('تم إلغاء الرفع');
      }

      // Start new uploads up to max concurrent
      while (queue.length > 0 && inProgress.size < MAX_CONCURRENT_CHUNKS) {
        uploadNextChunk();
      }

      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };

  /**
   * Upload a single chunk
   */
  const uploadSingleChunk = async (file, uploadId, chunkIndex) => {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('chunkIndex', chunkIndex.toString());

    await axios.post(`${API}/chunked/${uploadId}/chunk`, formData, {
      signal: abortControllers.current[uploadId]?.signal,
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  };

  /**
   * Cancel an upload
   */
  const cancelUpload = useCallback(async (uploadId) => {
    // Abort ongoing requests
    if (abortControllers.current[uploadId]) {
      abortControllers.current[uploadId].abort();
      delete abortControllers.current[uploadId];
    }

    // Cancel on server
    try {
      await axios.delete(`${API}/chunked/${uploadId}`);
    } catch (e) {
      console.error('Cancel error:', e);
    }

    // Update state
    setUploads(prev => {
      const newUploads = { ...prev };
      for (const [key, upload] of Object.entries(newUploads)) {
        if (upload.uploadId === uploadId) {
          newUploads[key] = { ...upload, status: 'cancelled' };
        }
      }
      return newUploads;
    });
  }, []);

  /**
   * Resume an upload
   */
  const resumeUpload = useCallback(async (uploadId, file, folderId) => {
    try {
      const res = await axios.post(`${API}/chunked/${uploadId}/resume`);
      
      if (res.data.canResume) {
        // Re-upload missing chunks
        return uploadFile(file, folderId);
      } else {
        throw new Error('لا يمكن استئناف الرفع');
      }
    } catch (error) {
      throw error;
    }
  }, [uploadFile]);

  /**
   * Get upload progress
   */
  const getProgress = useCallback(async (uploadId) => {
    const res = await axios.get(`${API}/chunked/${uploadId}/progress`);
    return res.data;
  }, []);

  /**
   * Clear completed/failed uploads from state
   */
  const clearCompleted = useCallback(() => {
    setUploads(prev => {
      const newUploads = {};
      for (const [key, upload] of Object.entries(prev)) {
        if (upload.status !== 'completed' && upload.status !== 'error' && upload.status !== 'cancelled') {
          newUploads[key] = upload;
        }
      }
      return newUploads;
    });
  }, []);

  /**
   * Check if file should use chunked upload
   */
  const shouldUseChunkedUpload = useCallback((file) => {
    // Use chunked upload for files > 50MB
    return file.size > 50 * 1024 * 1024;
  }, []);

  return {
    uploads,
    isUploading,
    uploadFile,
    cancelUpload,
    resumeUpload,
    getProgress,
    clearCompleted,
    shouldUseChunkedUpload,
    CHUNK_SIZE
  };
}

export default useChunkedUpload;
