import api from './api';

/**
 * Eventify Background Upload Queue
 *
 * Allows kiosk recordings to be submitted instantly so the next guest can record
 * without waiting for the network upload to finish.
 */

class UploadQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.listeners = new Set();
  }

  /**
   * Subscribe to queue status changes.
   * @param {function} listener
   * @returns {function} unsubscribe function
   */
  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  notify() {
    const state = this.getState();
    this.listeners.forEach((fn) => {
      try {
        fn(state);
      } catch (e) {
        console.error('[UploadQueue] Listener error:', e);
      }
    });
  }

  getState() {
    const pending = this.queue.filter((item) => item.status === 'pending' || item.status === 'uploading');
    const completed = this.queue.filter((item) => item.status === 'completed');
    const failed = this.queue.filter((item) => item.status === 'failed');
    const current = this.queue.find((item) => item.status === 'uploading') || null;

    return {
      items: [...this.queue],
      pendingCount: pending.length,
      completedCount: completed.length,
      failedCount: failed.length,
      isUploading: pending.length > 0,
      currentProgress: current ? current.progress : 0,
    };
  }

  /**
   * Add a recording to the queue and begin background processing.
   */
  enqueue({ blob, filename, eventId, guestName, phase, recordingType, isFramed }) {
    const item = {
      id: `queue_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      blob,
      filename,
      eventId,
      guestName: guestName || 'Anonymous',
      phase,
      recordingType,
      isFramed: Boolean(isFramed),
      status: 'pending', // 'pending' | 'uploading' | 'completed' | 'failed'
      progress: 0,
      attempts: 0,
      error: null,
      createdAt: new Date(),
    };

    this.queue.push(item);
    this.notify();
    this.processNext();
    return item;
  }

  /**
   * Process the next pending item in the queue.
   */
  async processNext() {
    if (this.isProcessing) return;

    const nextItem = this.queue.find((item) => item.status === 'pending');
    if (!nextItem) {
      this.isProcessing = false;
      this.notify();
      return;
    }

    this.isProcessing = true;
    nextItem.status = 'uploading';
    nextItem.progress = 5;
    this.notify();

    try {
      const formData = new FormData();
      formData.append('video', nextItem.blob, nextItem.filename);
      formData.append('eventId', nextItem.eventId);
      formData.append('guestName', nextItem.guestName);
      formData.append('phase', nextItem.phase);
      formData.append('recordingType', nextItem.recordingType);
      formData.append('isFramed', nextItem.isFramed ? 'true' : 'false');

      await api.post('/videos/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) {
            nextItem.progress = Math.min(99, Math.round((e.loaded / e.total) * 100));
            this.notify();
          }
        },
      });

      nextItem.status = 'completed';
      nextItem.progress = 100;
      nextItem.error = null;
      console.log(`[UploadQueue] ✅ Successfully uploaded recording for ${nextItem.guestName}`);
    } catch (err) {
      console.error(`[UploadQueue] ❌ Upload failed for ${nextItem.guestName}:`, err.message);
      nextItem.attempts += 1;

      if (nextItem.attempts < 3) {
        // Will retry automatically
        nextItem.status = 'pending';
        nextItem.progress = 0;
        await new Promise((r) => setTimeout(r, 2500));
      } else {
        nextItem.status = 'failed';
        nextItem.error = err.response?.data?.error || err.message || 'Upload failed';
      }
    } finally {
      this.isProcessing = false;
      this.notify();
      // Continue with remaining pending items
      setTimeout(() => this.processNext(), 500);
    }
  }

  /**
   * Retry all failed uploads.
   */
  retryFailed() {
    this.queue.forEach((item) => {
      if (item.status === 'failed') {
        item.status = 'pending';
        item.attempts = 0;
        item.error = null;
        item.progress = 0;
      }
    });
    this.notify();
    this.processNext();
  }

  /**
   * Clear completed items from memory.
   */
  clearCompleted() {
    this.queue = this.queue.filter((item) => item.status !== 'completed');
    this.notify();
  }
}

const uploadQueue = new UploadQueue();
export default uploadQueue;
