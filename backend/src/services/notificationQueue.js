const EventEmitter = require("events");

/**
 * NotificationQueue
 *
 * Lightweight, robust in-memory job queue with automatic concurrency control,
 * exponential backoff retry handling (up to 3 attempts), and event telemetry.
 * Architecture is pluggable: can be transparently swapped with BullMQ / Redis
 * as traffic demands scale.
 */
class NotificationQueue extends EventEmitter {
  constructor(concurrency = 5) {
    super();
    this.queue = [];
    this.running = 0;
    this.concurrency = concurrency;
    this.maxRetries = 3;
  }

  /**
   * Adds a notification task to the worker queue.
   *
   * @param {string} taskName - Name of the notification job
   * @param {Function} handler - Async function returning a promise
   * @param {object} [metadata={}] - Arbitrary metadata for logging/tracking
   */
  enqueue(taskName, handler, metadata = {}) {
    const job = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      name: taskName,
      handler,
      metadata,
      attempts: 0,
      createdAt: new Date(),
    };

    this.queue.push(job);
    this.emit("job_enqueued", { id: job.id, name: job.name });
    this.processNext();
    return job.id;
  }

  /**
   * Internal worker loop.
   */
  async processNext() {
    if (this.running >= this.concurrency || this.queue.length === 0) {
      return;
    }

    const job = this.queue.shift();
    if (!job) return;

    this.running++;
    job.attempts++;

    try {
      await job.handler();
      this.emit("job_completed", { id: job.id, name: job.name, attempts: job.attempts });
    } catch (err) {
      console.error(`[NotificationQueue] Job ${job.name} (attempt ${job.attempts}/${this.maxRetries}) failed:`, err.message);

      if (job.attempts < this.maxRetries) {
        const backoffMs = Math.pow(2, job.attempts) * 1000;
        setTimeout(() => {
          this.queue.push(job);
          this.processNext();
        }, backoffMs);
      } else {
        this.emit("job_failed", { id: job.id, name: job.name, error: err.message });
      }
    } finally {
      this.running--;
      this.processNext();
    }
  }

  /**
   * Returns current queue diagnostics.
   */
  getMetrics() {
    return {
      pending: this.queue.length,
      running: this.running,
      concurrency: this.concurrency,
    };
  }
}

// Global Singleton Queue Instance
const globalNotificationQueue = new NotificationQueue(5);

module.exports = globalNotificationQueue;
