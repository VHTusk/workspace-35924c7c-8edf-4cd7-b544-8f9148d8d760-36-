/**
 * VALORHIVE Cron Job Queue
 * 
 * Simple in-memory job queue for cron tasks.
 * Jobs are enqueued by the scheduler and processed by workers.
 * 
 * Architecture:
 * - Scheduler: Enqueues jobs based on time (node-cron)
 * - Queue: Manages job execution order and concurrency
 * - Workers: Execute the actual logic by importing functions
 * 
 * Benefits over HTTP-based cron:
 * - No duplicate runs (single process)
 * - No app-runtime coupling
 * - Easier idempotency guarantees
 * - Better error handling and retry logic
 */

import { EventEmitter } from 'events';

// ============================================
// Types
// ============================================

export type JobType = 
  | 'autopilot'
  | 'completion'
  | 'governance'
  | 'venue-flow'
  | 'finance'
  | 'automation'
  | 'backup'
  | 'daily-cleanup'
  | 'weekly-cleanup'
  | 'sli-aggregation'
  | 'cache-warming'
  | 'elo-job-queue'
  | 'recurring-tournaments'
  | 'noshow-forfeit';

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Job {
  id: string;
  type: JobType;
  priority: number;
  payload?: Record<string, unknown>;
  status: JobStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  attempts: number;
  maxAttempts: number;
}

export interface JobResult {
  success: boolean;
  data?: unknown;
  error?: string;
  duration: number;
}

export type JobHandler = (payload?: Record<string, unknown>) => Promise<JobResult>;

// ============================================
// Job Queue Class
// ============================================

class JobQueue extends EventEmitter {
  private queue: Job[] = [];
  private running: Map<string, Job> = new Map();
  private completed: Job[] = [];
  private handlers: Map<JobType, JobHandler> = new Map();
  private maxConcurrent: number;
  private maxCompletedHistory: number;
  private isProcessing: boolean = false;
  private jobIdCounter: number = 0;

  constructor(options?: { maxConcurrent?: number; maxCompletedHistory?: number }) {
    super();
    this.maxConcurrent = options?.maxConcurrent || 3;
    this.maxCompletedHistory = options?.maxCompletedHistory || 100;
  }

  /**
   * Register a handler for a job type
   */
  registerHandler(type: JobType, handler: JobHandler): void {
    this.handlers.set(type, handler);
    console.log(`[JobQueue] Registered handler for: ${type}`);
  }

  /**
   * Enqueue a new job
   */
  enqueue(type: JobType, payload?: Record<string, unknown>, options?: { priority?: number }): string {
    const job: Job = {
      id: `${type}-${++this.jobIdCounter}-${Date.now()}`,
      type,
      priority: options?.priority || 0,
      payload,
      status: 'pending',
      createdAt: new Date(),
      attempts: 0,
      maxAttempts: 3,
    };

    // Insert sorted by priority (higher first)
    const insertIndex = this.queue.findIndex(j => j.priority < job.priority);
    if (insertIndex === -1) {
      this.queue.push(job);
    } else {
      this.queue.splice(insertIndex, 0, job);
    }

    this.emit('job:enqueued', job);
    console.log(`[JobQueue] Enqueued job: ${job.id}`);

    // Start processing if not already
    this.process();

    return job.id;
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): Job | undefined {
    return (
      this.queue.find(j => j.id === jobId) ||
      this.running.get(jobId) ||
      this.completed.find(j => j.id === jobId)
    );
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    pending: number;
    running: number;
    completed: number;
    handlers: number;
  } {
    return {
      pending: this.queue.length,
      running: this.running.size,
      completed: this.completed.length,
      handlers: this.handlers.size,
    };
  }

  /**
   * Get all pending jobs
   */
  getPendingJobs(): Job[] {
    return [...this.queue];
  }

  /**
   * Get all running jobs
   */
  getRunningJobs(): Job[] {
    return Array.from(this.running.values());
  }

  /**
   * Get completed job history
   */
  getCompletedJobs(): Job[] {
    return [...this.completed];
  }

  /**
   * Process jobs in the queue
   */
  private async process(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0 && this.running.size < this.maxConcurrent) {
      const job = this.queue.shift();
      if (!job) break;

      this.running.set(job.id, job);
      job.status = 'running';
      job.startedAt = new Date();
      job.attempts++;

      this.emit('job:started', job);

      // Execute job asynchronously
      this.executeJob(job).catch(error => {
        console.error(`[JobQueue] Unhandled error in job ${job.id}:`, error);
      });
    }

    this.isProcessing = false;
  }

  /**
   * Execute a single job
   */
  private async executeJob(job: Job): Promise<void> {
    const handler = this.handlers.get(job.type);
    
    if (!handler) {
      console.error(`[JobQueue] No handler registered for job type: ${job.type}`);
      job.status = 'failed';
      job.error = `No handler registered for job type: ${job.type}`;
      job.completedAt = new Date();
      this.completeJob(job);
      return;
    }

    try {
      const result = await handler(job.payload);
      
      if (result.success) {
        job.status = 'completed';
        job.completedAt = new Date();
        this.emit('job:completed', job, result);
      } else {
        // Handler returned failure - check if we should retry
        if (job.attempts < job.maxAttempts) {
          console.log(`[JobQueue] Job ${job.id} failed, retrying (${job.attempts}/${job.maxAttempts})`);
          job.status = 'pending';
          this.running.delete(job.id);
          this.queue.unshift(job); // Add back to front of queue
        } else {
          job.status = 'failed';
          job.error = result.error || 'Handler returned failure';
          job.completedAt = new Date();
          this.emit('job:failed', job, result.error);
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      if (job.attempts < job.maxAttempts) {
        console.log(`[JobQueue] Job ${job.id} threw error, retrying (${job.attempts}/${job.maxAttempts}): ${errorMsg}`);
        job.status = 'pending';
        this.running.delete(job.id);
        this.queue.unshift(job);
      } else {
        job.status = 'failed';
        job.error = errorMsg;
        job.completedAt = new Date();
        this.emit('job:failed', job, errorMsg);
      }
    }

    if (job.status === 'completed' || job.status === 'failed') {
      this.completeJob(job);
    }

    // Continue processing
    this.process();
  }

  /**
   * Mark job as complete and move to history
   */
  private completeJob(job: Job): void {
    this.running.delete(job.id);
    this.completed.push(job);
    
    // Trim history
    if (this.completed.length > this.maxCompletedHistory) {
      this.completed.shift();
    }
  }

  /**
   * Clear completed job history
   */
  clearHistory(): void {
    this.completed = [];
  }
}

// ============================================
// Singleton Instance
// ============================================

export const jobQueue = new JobQueue({
  maxConcurrent: 3,
  maxCompletedHistory: 100,
});

// ============================================
// Event Logging
// ============================================

jobQueue.on('job:enqueued', (job: Job) => {
  console.log(`[JobQueue] Job enqueued: ${job.id} (type: ${job.type}, priority: ${job.priority})`);
});

jobQueue.on('job:started', (job: Job) => {
  console.log(`[JobQueue] Job started: ${job.id}`);
});

jobQueue.on('job:completed', (job: Job, result: JobResult) => {
  console.log(`[JobQueue] Job completed: ${job.id} (duration: ${result.duration}ms)`);
});

jobQueue.on('job:failed', (job: Job, error?: string) => {
  console.error(`[JobQueue] Job failed: ${job.id} - ${error}`);
});
