-- VALORHIVE v3.6.1 Database Constraints
-- Raw SQL Migration for Data Integrity
-- 
-- IMPORTANT: SQLite Limitations
-- SQLite does not support ALTER TABLE ADD CONSTRAINT CHECK syntax.
-- CHECK constraints must be defined at table creation time.
-- 
-- To apply these constraints to an existing SQLite database,
-- you must recreate the tables with CHECK constraints included.
-- 
-- See migration file: 20250115000000_add_db_constraints/migration.sql
-- for the complete table recreation approach.
--
-- For PostgreSQL or other databases that support ALTER TABLE ADD CONSTRAINT,
-- use the statements below directly.

-- ============================================
-- 1. Session User XOR Org Constraint
-- Ensures a session belongs to exactly one of User or Organization
-- ============================================
-- PostgreSQL syntax:
-- ALTER TABLE "Session" ADD CONSTRAINT session_user_xor_org
-- CHECK (
--   ("user_id" IS NOT NULL AND "org_id" IS NULL)
--   OR ("user_id" IS NULL AND "org_id" IS NOT NULL)
-- );

-- ============================================
-- 2. Match Score Consistency Constraints
-- ============================================

-- 2a. When outcome is PLAYED, both scores must be set
-- PostgreSQL syntax:
-- ALTER TABLE "Match" ADD CONSTRAINT match_played_has_scores
-- CHECK (
--   "outcome" != 'PLAYED'
--   OR ("score_a" IS NOT NULL AND "score_b" IS NOT NULL)
-- );

-- 2b. When outcome is WALKOVER, NO_SHOW, or FORFEIT, outcome_reason is required
-- PostgreSQL syntax:
-- ALTER TABLE "Match" ADD CONSTRAINT match_outcome_reason_required
-- CHECK (
--   "outcome" NOT IN ('WALKOVER', 'NO_SHOW', 'FORFEIT')
--   OR "outcome_reason" IS NOT NULL
-- );

-- ============================================
-- 3. Tournament Date Sanity Constraints
-- ============================================
-- PostgreSQL syntax:
-- ALTER TABLE "Tournament" ADD CONSTRAINT tournament_dates_valid
-- CHECK (
--   "start_date" < "end_date"
--   AND "reg_deadline" <= "start_date"
-- );

-- ============================================
-- 4. Points and Elo Floor Constraints
-- ============================================

-- 4a. Visible points must be non-negative
-- PostgreSQL syntax:
-- ALTER TABLE "User" ADD CONSTRAINT user_visible_points_nonneg
-- CHECK ("visible_points" >= 0);

-- 4b. Hidden ELO must be at least 100 (floor)
-- PostgreSQL syntax:
-- ALTER TABLE "User" ADD CONSTRAINT user_elo_floor
-- CHECK ("hidden_elo" >= 100);

-- ============================================
-- 5. Unique Player Per Tournament
-- Note: This is already enforced by @@unique([tournamentId, userId]) in Prisma schema
-- No additional action needed
-- ============================================

-- ============================================
-- SQLite Implementation Note
-- ============================================
-- For SQLite, the constraints are applied by recreating tables.
-- Use the Prisma migration in:
--   prisma/migrations/20250115000000_add_db_constraints/migration.sql
-- 
-- Or run:
--   npx prisma migrate dev
-- ============================================
