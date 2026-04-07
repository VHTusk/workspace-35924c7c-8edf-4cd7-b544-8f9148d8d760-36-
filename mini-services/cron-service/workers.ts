/**
 * VALORHIVE Cron Workers
 * 
 * Workers execute cron job logic by importing functions directly from the main project.
 * This eliminates HTTP calls and the associated problems:
 * - No duplicate runs
 * - No app-runtime coupling
 * - Easier idempotency guarantees
 * 
 * Each worker is a function that imports the necessary modules and executes the logic.
 */

import path from 'path';
import { JobHandler, JobResult } from './job-queue';

// ============================================
// Module Paths
// ============================================

const projectRoot = path.resolve(__dirname, '../..');
const libPath = path.join(projectRoot, 'src/lib');

// ============================================
// Module Cache
// ============================================

interface ModuleCache {
  tournamentAutopilot?: typeof import('../../src/lib/tournament-autopilot');
  completionChain?: typeof import('../../src/lib/completion-chain');
  resultFinalization?: typeof import('../../src/lib/result-finalization');
  tournamentSnapshot?: typeof import('../../src/lib/tournament-snapshot');
  recognitionTrigger?: typeof import('../../src/lib/recognition-trigger');
  tournamentRecap?: typeof import('../../src/lib/tournament-recap-service');
  inactiveAdminDetector?: typeof import('../../src/lib/inactive-admin-detector');
  regionLoadBalancer?: typeof import('../../src/lib/region-load-balancer');
  adminEscalation?: typeof import('../../src/lib/admin-escalation');
  venueFlow?: typeof import('../../src/lib/venue-flow');
  refundEngine?: typeof import('../../src/lib/refund-engine');
  paymentRecovery?: typeof import('../../src/lib/payment-recovery');
  financeSnapshot?: typeof import('../../src/lib/finance-snapshot');
  matchReminderEngine?: typeof import('../../src/lib/match-reminder-engine');
  playerReengagement?: typeof import('../../src/lib/player-reengagement');
  feedbackCollector?: typeof import('../../src/lib/feedback-collector');
  healthMonitor?: typeof import('../../src/lib/health-monitor');
  smartNotificationRouter?: typeof import('../../src/lib/smart-notification-router');
  tournamentReminders?: typeof import('../../src/lib/tournament-reminders');
}

const modules: ModuleCache = {};

/**
 * Load all required modules
 */
export async function loadWorkerModules(): Promise<boolean> {
  console.log('[Workers] Loading worker modules...');
  
  try {
    // Tournament automation
    modules.tournamentAutopilot = await import(path.join(libPath, 'tournament-autopilot'));
    
    // Completion chain
    modules.completionChain = await import(path.join(libPath, 'completion-chain'));
    modules.resultFinalization = await import(path.join(libPath, 'result-finalization'));
    modules.tournamentSnapshot = await import(path.join(libPath, 'tournament-snapshot'));
    modules.recognitionTrigger = await import(path.join(libPath, 'recognition-trigger'));
    modules.tournamentRecap = await import(path.join(libPath, 'tournament-recap-service'));
    
    // Governance
    modules.inactiveAdminDetector = await import(path.join(libPath, 'inactive-admin-detector'));
    modules.regionLoadBalancer = await import(path.join(libPath, 'region-load-balancer'));
    modules.adminEscalation = await import(path.join(libPath, 'admin-escalation'));
    
    // Venue flow
    modules.venueFlow = await import(path.join(libPath, 'venue-flow'));
    
    // Finance
    modules.refundEngine = await import(path.join(libPath, 'refund-engine'));
    modules.paymentRecovery = await import(path.join(libPath, 'payment-recovery'));
    modules.financeSnapshot = await import(path.join(libPath, 'finance-snapshot'));
    
    // Automation
    modules.matchReminderEngine = await import(path.join(libPath, 'match-reminder-engine'));
    modules.playerReengagement = await import(path.join(libPath, 'player-reengagement'));
    modules.feedbackCollector = await import(path.join(libPath, 'feedback-collector'));
    modules.healthMonitor = await import(path.join(libPath, 'health-monitor'));
    modules.smartNotificationRouter = await import(path.join(libPath, 'smart-notification-router'));
    modules.tournamentReminders = await import(path.join(libPath, 'tournament-reminders'));
    
    console.log('[Workers] All worker modules loaded successfully');
    return true;
  } catch (error) {
    console.error('[Workers] Failed to load worker modules:', error);
    console.log('[Workers] Running in simulation mode (modules not loaded)');
    return false;
  }
}

// ============================================
// Worker Functions
// ============================================

/**
 * Tournament Autopilot Worker
 * 
 * Processes automated tournament tasks:
 * - Registration auto-close
 * - Auto-bracket generation
 * - Auto-start tournament
 * - Auto-advance winner
 * - Waitlist auto-promotion
 * - Match reminders
 */
export const autopilotWorker: JobHandler = async () => {
  const startTime = Date.now();
  
  try {
    if (modules.tournamentAutopilot) {
      console.log('[Worker] Running autopilot processors...');
      const results = await modules.tournamentAutopilot.runAutopilotProcessors();
      
      const summary = {
        registrationAutoClosed: results.registrationAutoClose.filter(r => r.success).length,
        bracketsGenerated: results.autoBracketGeneration.filter(r => r.success).length,
        tournamentsStarted: results.autoStartTournament.filter(r => r.success).length,
        winnersAdvanced: results.autoAdvanceWinner.filter(r => r.success).length,
        waitlistPromotions: results.waitlistAutoPromotion.filter(r => r.success).length,
        matchRemindersSent: results.matchReminders.processed,
      };
      
      return {
        success: true,
        data: { summary, details: results },
        duration: Date.now() - startTime,
      };
    } else {
      // Simulation mode
      console.log('[Worker] [SIMULATION] Would run autopilot processors');
      return {
        success: true,
        data: { simulation: true },
        duration: Date.now() - startTime,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    };
  }
};

/**
 * Tournament Completion Worker
 * 
 * Processes tournament completion tasks:
 * - Auto-complete tournaments
 * - Process finalization windows
 * - Trigger recognition awards
 */
export const completionWorker: JobHandler = async () => {
  const startTime = Date.now();
  const errors: string[] = [];
  
  try {
    const results: {
      autoCompletion: unknown;
      finalizationWindows: unknown;
      snapshots: number;
      recognitions: number;
      recaps: number;
    } = {
      autoCompletion: null,
      finalizationWindows: null,
      snapshots: 0,
      recognitions: 0,
      recaps: 0,
    };
    
    // Auto-complete tournaments
    if (modules.completionChain) {
      console.log('[Worker] Running completion chain...');
      results.autoCompletion = await modules.completionChain.CompletionChainService.autoComplete();
      
      // For each completed tournament, create snapshot and start finalization
      if (results.autoCompletion && typeof results.autoCompletion === 'object' && 'details' in results.autoCompletion) {
        for (const detail of (results.autoCompletion as any).details || []) {
          if (detail.success && modules.tournamentSnapshot && modules.resultFinalization) {
            try {
              await modules.tournamentSnapshot.TournamentSnapshotService.create(detail.tournamentId);
              await modules.resultFinalization.ResultFinalizationService.startWindow(detail.tournamentId);
              results.snapshots++;
            } catch (e) {
              errors.push(`Failed to process ${detail.tournamentId}: ${e}`);
            }
          }
        }
      }
    }
    
    // Process finalization windows
    if (modules.resultFinalization) {
      console.log('[Worker] Processing finalization windows...');
      results.finalizationWindows = await modules.resultFinalization.ResultFinalizationService.processWindows();
    }
    
    return {
      success: true,
      data: { ...results, errors },
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    };
  }
};

/**
 * Governance Worker
 * 
 * Processes governance tasks:
 * - Inactivity detection
 * - Load metric updates
 * - Auto-escalation processing
 */
export const governanceWorker: JobHandler = async (payload) => {
  const startTime = Date.now();
  const task = payload?.task as string || 'all';
  
  try {
    const results: Record<string, unknown> = {};
    const errors: string[] = [];
    
    if (task === 'all' || task === 'detect-inactivity') {
      if (modules.inactiveAdminDetector) {
        console.log('[Worker] Running inactivity detection...');
        results.inactivity = await modules.inactiveAdminDetector.detectInactiveAdmins();
      }
    }
    
    if (task === 'all' || task === 'process-escalations') {
      if (modules.adminEscalation) {
        console.log('[Worker] Processing auto-escalations...');
        results.escalations = await modules.adminEscalation.processAutoEscalations();
      }
    }
    
    if (task === 'all' || task === 'update-load-metrics') {
      if (modules.regionLoadBalancer) {
        console.log('[Worker] Updating load metrics...');
        // Update for both sports
        await modules.regionLoadBalancer.getRegionLoadMetrics('CORNHOLE' as any);
        await modules.regionLoadBalancer.getRegionLoadMetrics('DARTS' as any);
      }
    }
    
    return {
      success: true,
      data: { results, errors, task },
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    };
  }
};

/**
 * Venue Flow Worker
 * 
 * Processes venue flow tasks:
 * - No-show detection
 * - Dynamic scheduling
 * - Health monitoring
 */
export const venueFlowWorker: JobHandler = async () => {
  const startTime = Date.now();
  
  try {
    if (modules.venueFlow) {
      console.log('[Worker] Running venue flow processors...');
      const results = await modules.venueFlow.runVenueFlowProcessors();
      
      const summary = {
        noShowsDetected: results.noShowDetection.noShows.length,
        matchesAssigned: results.scheduling.assigned,
        matchesQueued: results.scheduling.queued,
        tournamentsChecked: results.health.tournamentsChecked,
        healthAlertsCreated: results.health.alertsCreated,
      };
      
      return {
        success: true,
        data: { summary, details: results },
        duration: Date.now() - startTime,
      };
    } else {
      console.log('[Worker] [SIMULATION] Would run venue flow processors');
      return {
        success: true,
        data: { simulation: true },
        duration: Date.now() - startTime,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    };
  }
};

/**
 * Finance Worker
 * 
 * Processes financial tasks:
 * - Refund processing
 * - Payment recovery
 * - Reconciliation
 */
export const financeWorker: JobHandler = async (payload) => {
  const startTime = Date.now();
  const jobType = payload?.type as string || 'all';
  const errors: string[] = [];
  
  try {
    const results: {
      refunds: unknown;
      recovery: unknown;
      reconciliation: unknown;
    } = {
      refunds: null,
      recovery: null,
      reconciliation: null,
    };
    
    if (jobType === 'all' || jobType === 'refunds') {
      if (modules.refundEngine) {
        console.log('[Worker] Processing refunds...');
        try {
          results.refunds = await modules.refundEngine.RefundEngineService.processPending();
        } catch (e) {
          errors.push(`Refund processing failed: ${e}`);
        }
      }
    }
    
    if (jobType === 'all' || jobType === 'recovery') {
      if (modules.paymentRecovery) {
        console.log('[Worker] Processing payment recovery...');
        try {
          results.recovery = await modules.paymentRecovery.PaymentRecoveryService.processQueue();
        } catch (e) {
          errors.push(`Recovery processing failed: ${e}`);
        }
      }
    }
    
    if (jobType === 'reconciliation') {
      if (modules.financeSnapshot) {
        console.log('[Worker] Running reconciliation...');
        try {
          results.reconciliation = await modules.financeSnapshot.FinanceSnapshotService.runDailyReconciliation('SYSTEM');
        } catch (e) {
          errors.push(`Reconciliation failed: ${e}`);
        }
      }
    }
    
    return {
      success: true,
      data: { ...results, errors },
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    };
  }
};

/**
 * Automation Worker
 * 
 * Processes automation tasks:
 * - Match reminders
 * - Player re-engagement
 * - Feedback collection
 * - Health monitoring
 * - Smart notification routing
 */
export const automationWorker: JobHandler = async (payload) => {
  const startTime = Date.now();
  const task = payload?.task as string || 'all';
  const results: Record<string, unknown> = {};
  const errors: string[] = [];
  
  try {
    if (task === 'all' || task === 'match-reminders') {
      if (modules.matchReminderEngine) {
        console.log('[Worker] Processing match reminders...');
        try {
          results.matchReminders = await modules.matchReminderEngine.processMatchReminders();
          await modules.matchReminderEngine.cleanupOldMatchReminders();
        } catch (e) {
          errors.push(`Match reminders: ${e}`);
        }
      }
    }
    
    if (task === 'all' || task === 'notifications') {
      if (modules.smartNotificationRouter) {
        console.log('[Worker] Processing smart notifications...');
        try {
          results.scheduledNotifications = await modules.smartNotificationRouter.processScheduledNotifications();
          results.batchedNotifications = await modules.smartNotificationRouter.processBatchedNotifications();
        } catch (e) {
          errors.push(`Notifications: ${e}`);
        }
      }
    }
    
    if (task === 'all' || task === 'health-monitor') {
      if (modules.healthMonitor) {
        console.log('[Worker] Running health monitoring...');
        try {
          const healthResult = await modules.healthMonitor.runMonitoringCycle();
          results.health = {
            overall: healthResult.health.overall,
            alerts: healthResult.health.alerts.length,
          };
        } catch (e) {
          errors.push(`Health monitor: ${e}`);
        }
      }
    }
    
    if (task === 'all' || task === 'feedback') {
      if (modules.feedbackCollector) {
        console.log('[Worker] Processing feedback collection...');
        try {
          results.feedback = await modules.feedbackCollector.processExpiredFeedbackRequests();
        } catch (e) {
          errors.push(`Feedback: ${e}`);
        }
      }
    }
    
    if (task === 'all' || task === 'escalations') {
      if (modules.adminEscalation) {
        console.log('[Worker] Processing escalations...');
        try {
          results.escalations = await modules.adminEscalation.processAutoEscalations();
        } catch (e) {
          errors.push(`Escalations: ${e}`);
        }
      }
    }
    
    if (task === 'all' || task === 'tournament-reminders') {
      if (modules.tournamentReminders) {
        console.log('[Worker] Processing tournament reminders...');
        try {
          results.tournamentReminders = await modules.tournamentReminders.processAllTournamentReminders();
        } catch (e) {
          errors.push(`Tournament reminders: ${e}`);
        }
      }
    }
    
    return {
      success: true,
      data: { results, errors, task },
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    };
  }
};

// ============================================
// Worker Registry
// ============================================

/**
 * Get all workers as a map of job type to handler
 */
export function getWorkers(): Map<string, JobHandler> {
  const workers = new Map<string, JobHandler>();
  
  workers.set('autopilot', autopilotWorker);
  workers.set('completion', completionWorker);
  workers.set('governance', governanceWorker);
  workers.set('venue-flow', venueFlowWorker);
  workers.set('finance', financeWorker);
  workers.set('automation', automationWorker);
  
  return workers;
}
