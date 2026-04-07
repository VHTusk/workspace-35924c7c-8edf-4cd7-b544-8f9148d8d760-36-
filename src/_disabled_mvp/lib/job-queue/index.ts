/**
 * Job Queue Module for VALORHIVE
 * 
 * Exports all job queue services for ELO calculation and notification fan-out.
 * 
 * v3.25.0 - Architecture Fix: Async job queues for scalability
 */

export * from './elo-queue';
export * from './notification-queue';

// Re-export default functions
import eloQueue from './elo-queue';
import notificationQueue from './notification-queue';

export const jobQueue = {
  elo: eloQueue,
  notification: notificationQueue,
};

export default jobQueue;
