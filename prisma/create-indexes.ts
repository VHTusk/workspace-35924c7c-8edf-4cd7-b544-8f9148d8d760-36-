/**
 * Database Index Creation Script
 * Run this after prisma db push to add performance indexes
 * 
 * Usage: bun run prisma/create-indexes.ts
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const indexes = [
  // Leaderboard query (sport + points descending)
  `CREATE INDEX IF NOT EXISTS idx_leaderboard ON "User" (sport, visible_points DESC);`,
  
  // Tournament listing (sport + status + date)
  `CREATE INDEX IF NOT EXISTS idx_tournament_listing ON "Tournament" (sport, status, start_date DESC);`,
  
  // Match history for players
  `CREATE INDEX IF NOT EXISTS idx_player_match_history_a ON "Match" (player_a_id, played_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_player_match_history_b ON "Match" (player_b_id, played_at DESC);`,
  
  // Active bracket matches
  `CREATE INDEX IF NOT EXISTS idx_active_bracket_matches ON "BracketMatch" (bracket_id, status);`,
  
  // Unread notifications
  `CREATE INDEX IF NOT EXISTS idx_unread_notifications ON "Notification" (user_id, is_read);`,
  
  // Active subscriptions
  `CREATE INDEX IF NOT EXISTS idx_active_subscriptions ON "Subscription" (user_id, sport, status);`,
  
  // Payment ledger by status
  `CREATE INDEX IF NOT EXISTS idx_payment_ledger_status ON "PaymentLedger" (status, "createdAt");`,
  
  // Waitlist by tournament and position
  `CREATE INDEX IF NOT EXISTS idx_waitlist_position ON "TournamentWaitlist" (tournament_id, position);`,
];

async function createIndexes() {
  console.log('Creating database indexes...\n');
  
  const dbPath = process.env.DATABASE_URL?.replace('file:', '') || './db/custom.db';
  
  for (const indexSql of indexes) {
    try {
      const { stdout, stderr } = await execAsync(`sqlite3 "${dbPath}" "${indexSql}"`);
      if (stderr && !stderr.includes('already exists')) {
        console.error(`Error: ${stderr}`);
      } else {
        // Extract index name from SQL
        const match = indexSql.match(/CREATE INDEX IF NOT EXISTS (\w+)/);
        if (match) {
          console.log(`✓ Created index: ${match[1]}`);
        }
      }
    } catch (error) {
      // Index might already exist, which is fine
      const match = indexSql.match(/CREATE INDEX IF NOT EXISTS (\w+)/);
      if (match) {
        console.log(`→ Index exists: ${match[1]}`);
      }
    }
  }
  
  console.log('\n✓ Index creation complete!');
}

createIndexes().catch(console.error);
