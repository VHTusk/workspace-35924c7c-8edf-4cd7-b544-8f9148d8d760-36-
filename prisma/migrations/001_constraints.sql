-- VALORHIVE Database Constraints
-- These constraints supplement Prisma schema validation
-- Run these after prisma db push or prisma migrate dev

-- ============================================
-- 1. Session XOR Constraint
-- Ensures a session belongs to exactly one of User or Organization
-- ============================================
-- Note: SQLite doesn't support CHECK constraints with complex conditions well
-- This is enforced at application level in the session creation code

-- ============================================
-- 2. Match Score Consistency
-- When outcome is PLAYED, scores must be present
-- ============================================
-- Application level validation in match API

-- ============================================
-- 3. Tournament Date Sanity
-- Start date must be before end date
-- Registration deadline must be before start date
-- ============================================
-- Application level validation in tournament API

-- ============================================
-- 4. Points and Elo Floors
-- Visible points and hidden Elo must be non-negative
-- ============================================
-- SQLite doesn't easily support CHECK constraints after table creation
-- Application level validation ensures this

-- ============================================
-- 5. Bracket Winner Is Participant
-- Winner must be either playerA or playerB
-- ============================================
-- Application level validation in bracket update code

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Leaderboard query (sport + points descending)
CREATE INDEX IF NOT EXISTS idx_leaderboard ON "User" (sport, visible_points DESC);

-- Tournament listing (sport + status + date)
CREATE INDEX IF NOT EXISTS idx_tournament_listing ON "Tournament" (sport, status, start_date DESC);

-- Match history for players
CREATE INDEX IF NOT EXISTS idx_player_match_history_a ON "Match" (player_a_id, played_at DESC);
CREATE INDEX IF NOT EXISTS idx_player_match_history_b ON "Match" (player_b_id, played_at DESC);

-- Active bracket matches
CREATE INDEX IF NOT EXISTS idx_active_bracket_matches ON "BracketMatch" (bracket_id, status);

-- Unread notifications
CREATE INDEX IF NOT EXISTS idx_unread_notifications ON "Notification" (user_id, is_read);

-- Active subscriptions
CREATE INDEX IF NOT EXISTS idx_active_subscriptions ON "Subscription" (user_id, sport, status);

-- Payment ledger by status
CREATE INDEX IF NOT EXISTS idx_payment_ledger_status ON "PaymentLedger" (status, createdAt);

-- Waitlist by tournament and position
CREATE INDEX IF NOT EXISTS idx_waitlist_position ON "TournamentWaitlist" (tournament_id, position);

-- ============================================
-- NOTES FOR PRODUCTION (PostgreSQL)
-- ============================================
-- When migrating to PostgreSQL in production, add these CHECK constraints:
--
-- ALTER TABLE "Session" ADD CONSTRAINT session_user_xor_org
-- CHECK ((user_id IS NOT NULL AND org_id IS NULL) OR (user_id IS NULL AND org_id IS NOT NULL));
--
-- ALTER TABLE "Match" ADD CONSTRAINT match_played_has_scores
-- CHECK (outcome != 'PLAYED' OR (score_a IS NOT NULL AND score_b IS NOT NULL));
--
-- ALTER TABLE "Tournament" ADD CONSTRAINT tournament_dates_valid
-- CHECK (start_date < end_date AND reg_deadline <= start_date);
--
-- ALTER TABLE "User" ADD CONSTRAINT user_visible_points_nonneg
-- CHECK (visible_points >= 0);
--
-- ALTER TABLE "User" ADD CONSTRAINT user_elo_floor
-- CHECK (hidden_elo >= 100);
--
-- ALTER TABLE "BracketMatch" ADD CONSTRAINT bracket_winner_is_participant
-- CHECK (winner_id IS NULL OR winner_id = player_a_id OR winner_id = player_b_id);
