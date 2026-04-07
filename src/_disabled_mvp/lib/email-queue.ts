/**
 * Email Queue Service
 * Handles asynchronous email sending using BullMQ-like job queue
 * Falls back to immediate sending in development
 */

import { db } from '@/lib/db';

interface EmailJobData {
  to: string;
  subject: string;
  template: string;
  data: Record<string, unknown>;
  priority?: number;
  scheduledFor?: Date;
}

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

/**
 * Queue an email for sending
 * Uses database as job queue (works with SQLite/PostgreSQL)
 */
export async function queueEmail(job: EmailJobData): Promise<string> {
  const emailJob = await db.emailJob.create({
    data: {
      to: job.to,
      subject: job.subject,
      template: job.template,
      data: JSON.stringify(job.data),
      priority: job.priority || 10,
      scheduledFor: job.scheduledFor || new Date(),
      status: 'PENDING',
    },
  });
  
  console.log(`Email queued: ${emailJob.id} to ${job.to}`);
  
  // In development, try to send immediately
  if (process.env.NODE_ENV === 'development') {
    processEmailQueue().catch(console.error);
  }
  
  return emailJob.id;
}

/**
 * Process pending email jobs
 * Called by cron service or worker
 */
export async function processEmailQueue(batchSize = 10): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const pendingJobs = await db.emailJob.findMany({
    where: {
      status: 'PENDING',
      scheduledFor: { lte: new Date() },
    },
    orderBy: [
      { priority: 'asc' },
      { createdAt: 'asc' },
    ],
    take: batchSize,
  });
  
  let succeeded = 0;
  let failed = 0;
  
  for (const job of pendingJobs) {
    try {
      // Mark as processing
      await db.emailJob.update({
        where: { id: job.id },
        data: { status: 'PROCESSING' },
      });
      
      // Send the email
      const result = await sendEmailDirect({
        to: job.to,
        subject: job.subject,
        template: job.template,
        data: JSON.parse(job.data),
      });
      
      if (result.success) {
        await db.emailJob.update({
          where: { id: job.id },
          data: {
            status: 'SENT',
            sentAt: new Date(),
          },
        });
        succeeded++;
      } else {
        throw new Error(result.error || 'Send failed');
      }
    } catch (error) {
      const attempts = job.attempts + 1;
      const maxAttempts = job.maxAttempts;
      
      await db.emailJob.update({
        where: { id: job.id },
        data: {
          status: attempts >= maxAttempts ? 'FAILED' : 'PENDING',
          attempts,
          lastAttemptAt: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      
      failed++;
      console.error(`Email job ${job.id} failed:`, error);
    }
  }
  
  return {
    processed: pendingJobs.length,
    succeeded,
    failed,
  };
}

/**
 * Send email directly (for immediate sending or testing)
 */
export async function sendEmailDirect(job: EmailJobData): Promise<{
  success: boolean;
  error?: string;
  messageId?: string;
}> {
  try {
    // Import email sending logic
    const { sendEmail } = await import('@/lib/email');
    
    const result = await sendEmail({
      to: job.to,
      subject: job.subject,
      template: job.template,
      data: job.data,
    });
    
    return result;
  } catch (error) {
    console.error('Direct email send failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get email queue statistics
 */
export async function getEmailQueueStats(): Promise<{
  pending: number;
  processing: number;
  sent: number;
  failed: number;
}> {
  const stats = await db.emailJob.groupBy({
    by: ['status'],
    _count: true,
  });
  
  return {
    pending: stats.find(s => s.status === 'PENDING')?._count || 0,
    processing: stats.find(s => s.status === 'PROCESSING')?._count || 0,
    sent: stats.find(s => s.status === 'SENT')?._count || 0,
    failed: stats.find(s => s.status === 'FAILED')?._count || 0,
  };
}

/**
 * Retry failed email jobs
 */
export async function retryFailedEmails(): Promise<number> {
  const result = await db.emailJob.updateMany({
    where: {
      status: 'FAILED',
      attempts: { lt: 3 },
    },
    data: {
      status: 'PENDING',
      scheduledFor: new Date(),
    },
  });
  
  console.log(`Retrying ${result.count} failed emails`);
  return result.count;
}

/**
 * Clean up old sent/failed emails
 */
export async function cleanupOldEmails(daysOld = 30): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);
  
  const result = await db.emailJob.deleteMany({
    where: {
      status: { in: ['SENT', 'FAILED'] },
      createdAt: { lt: cutoff },
    },
  });
  
  console.log(`Cleaned up ${result.count} old emails`);
  return result.count;
}
