-- VALORHIVE v3.6.1 Database Constraints Migration
-- Generated: 2025-01-15
-- Purpose: Add critical data integrity constraints per v3.6.1 Addendum
-- 
-- SQLite Note: CHECK constraints must be added during table creation.
-- This migration recreates affected tables with the new constraints.
-- Foreign keys are disabled during migration to avoid constraint errors.

-- Disable foreign key checks during migration
PRAGMA foreign_keys = OFF;

-- ============================================
-- 1. Add CHECK constraints to Session table
-- Session User XOR Org: A session must belong to exactly one of User or Organization
-- ============================================

-- Create new Session table with CHECK constraint
CREATE TABLE "Session_new" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "token" TEXT NOT NULL,
  "user_id" TEXT,
  "org_id" TEXT,
  "sport" TEXT NOT NULL,
  "account_type" TEXT NOT NULL,
  "expires_at" DATETIME NOT NULL,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_activity_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "operator_name" TEXT,
  "operator_email" TEXT,
  CONSTRAINT "session_user_xor_org" CHECK (
    ("user_id" IS NOT NULL AND "org_id" IS NULL)
    OR ("user_id" IS NULL AND "org_id" IS NOT NULL)
  )
);

-- Copy data from old table
INSERT INTO "Session_new" SELECT * FROM "Session";

-- Drop old table and indexes
DROP TABLE "Session";
DROP INDEX IF EXISTS "Session_user_id_expiresAt_idx";
DROP INDEX IF EXISTS "Session_token_idx";

-- Rename new table
ALTER TABLE "Session_new" RENAME TO "Session";

-- Recreate indexes
CREATE UNIQUE INDEX "Session_token_idx" ON "Session"("token");
CREATE INDEX "Session_user_id_expiresAt_idx" ON "Session"("user_id", "expires_at");

-- ============================================
-- 2. Add CHECK constraints to Match table
-- Match Score Consistency: PLAYED requires scores, special outcomes require reasons
-- ============================================

-- Create new Match table with CHECK constraints
CREATE TABLE "Match_new" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sport" TEXT NOT NULL,
  "tournament_id" TEXT,
  "player_a_id" TEXT,
  "player_b_id" TEXT,
  "team_a_id" TEXT,
  "team_b_id" TEXT,
  "score_a" INTEGER,
  "score_b" INTEGER,
  "winner_id" TEXT,
  "winner_team_id" TEXT,
  "outcome" TEXT,
  "outcome_reason" TEXT,
  "points_a" INTEGER,
  "points_b" INTEGER,
  "tournament_scope" TEXT,
  "elo_change_a" REAL,
  "elo_change_b" REAL,
  "scheduled_time" DATETIME,
  "court_name" TEXT,
  "submitted_by_id" TEXT,
  "player_score_status" TEXT,
  "verification_status" TEXT DEFAULT 'PENDING',
  "verification_deadline" DATETIME,
  "referee_id" TEXT,
  "referee_name" TEXT,
  "played_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by_id" TEXT,
  "updated_at" DATETIME NOT NULL,
  "entered_offline" BOOLEAN NOT NULL DEFAULT false,
  "synced_at" DATETIME,
  "row_version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "match_played_has_scores" CHECK (
    "outcome" != 'PLAYED'
    OR ("score_a" IS NOT NULL AND "score_b" IS NOT NULL)
  ),
  CONSTRAINT "match_outcome_reason_required" CHECK (
    "outcome" NOT IN ('WALKOVER', 'NO_SHOW', 'FORFEIT')
    OR "outcome_reason" IS NOT NULL
  )
);

-- Copy data from old table
INSERT INTO "Match_new" SELECT * FROM "Match";

-- Drop old table and indexes
DROP TABLE "Match";
DROP INDEX IF EXISTS "Match_tournamentId_idx";
DROP INDEX IF EXISTS "Match_playerAId_playedAt_idx";
DROP INDEX IF EXISTS "Match_playerBId_playedAt_idx";
DROP INDEX IF EXISTS "Match_teamAId_playedAt_idx";
DROP INDEX IF EXISTS "Match_teamBId_playedAt_idx";
DROP INDEX IF EXISTS "Match_tournamentId_verificationStatus_idx";

-- Rename new table
ALTER TABLE "Match_new" RENAME TO "Match";

-- Recreate indexes
CREATE INDEX "Match_tournamentId_idx" ON "Match"("tournament_id");
CREATE INDEX "Match_playerAId_playedAt_idx" ON "Match"("player_a_id", "played_at");
CREATE INDEX "Match_playerBId_playedAt_idx" ON "Match"("player_b_id", "played_at");
CREATE INDEX "Match_teamAId_playedAt_idx" ON "Match"("team_a_id", "played_at");
CREATE INDEX "Match_teamBId_playedAt_idx" ON "Match"("team_b_id", "played_at");
CREATE INDEX "Match_tournamentId_verificationStatus_idx" ON "Match"("tournament_id", "verification_status");

-- ============================================
-- 3. Add CHECK constraints to Tournament table
-- Tournament Date Sanity: start_date < end_date AND reg_deadline <= start_date
-- ============================================

-- Create new Tournament table with CHECK constraint
CREATE TABLE "Tournament_new" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "sport" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "scope" TEXT,
  "location" TEXT NOT NULL,
  "start_date" DATETIME NOT NULL,
  "end_date" DATETIME NOT NULL,
  "reg_deadline" DATETIME NOT NULL,
  "prize_pool" INTEGER NOT NULL,
  "max_players" INTEGER NOT NULL,
  "entry_fee" INTEGER NOT NULL DEFAULT 0,
  "max_players_per_org" INTEGER,
  "format" TEXT NOT NULL DEFAULT 'INDIVIDUAL',
  "team_size" INTEGER,
  "max_teams" INTEGER,
  "early_bird_fee" INTEGER,
  "early_bird_deadline" DATETIME,
  "group_discount_min" INTEGER,
  "group_discount_percent" INTEGER,
  "bracket_format" TEXT,
  "city" TEXT,
  "district" TEXT,
  "state" TEXT,
  "org_id" TEXT,
  "age_min" INTEGER,
  "age_max" INTEGER,
  "gender" TEXT,
  "is_public" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "scoring_mode" TEXT NOT NULL DEFAULT 'STAFF_ONLY',
  "roster_lock_date" DATETIME,
  "created_by_id" TEXT,
  "template_id" TEXT,
  "series_id" TEXT,
  "series_points" INTEGER,
  "series_position" INTEGER,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL,
  CONSTRAINT "tournament_dates_valid" CHECK (
    "start_date" < "end_date"
    AND "reg_deadline" <= "start_date"
  )
);

-- Copy data from old table
INSERT INTO "Tournament_new" SELECT * FROM "Tournament";

-- Drop old table and indexes
DROP TABLE "Tournament";
DROP INDEX IF EXISTS "Tournament_sport_status_idx";
DROP INDEX IF EXISTS "Tournament_sport_type_idx";
DROP INDEX IF EXISTS "Tournament_city_sport_status_idx";
DROP INDEX IF EXISTS "Tournament_state_sport_status_idx";
DROP INDEX IF EXISTS "Tournament_sport_isPublic_status_idx";

-- Rename new table
ALTER TABLE "Tournament_new" RENAME TO "Tournament";

-- Recreate indexes
CREATE INDEX "Tournament_sport_status_idx" ON "Tournament"("sport", "status");
CREATE INDEX "Tournament_sport_type_idx" ON "Tournament"("sport", "type");
CREATE INDEX "Tournament_city_sport_status_idx" ON "Tournament"("city", "sport", "status");
CREATE INDEX "Tournament_state_sport_status_idx" ON "Tournament"("state", "sport", "status");
CREATE INDEX "Tournament_sport_isPublic_status_idx" ON "Tournament"("sport", "is_public", "status");

-- ============================================
-- 4. Add CHECK constraints to User table
-- Points and Elo Floors: visible_points >= 0, hidden_elo >= 100
-- ============================================

-- Create new User table with CHECK constraints
CREATE TABLE "User_new" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sport" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'PLAYER',
  "account_tier" TEXT NOT NULL DEFAULT 'FAN',
  "email" TEXT,
  "password" TEXT,
  "phone" TEXT,
  "google_id" TEXT,
  "first_name" TEXT NOT NULL,
  "last_name" TEXT NOT NULL,
  "dob" DATETIME,
  "gender" TEXT,
  "city" TEXT,
  "district" TEXT,
  "state" TEXT,
  "pin_code" TEXT,
  "affiliated_org_id" TEXT,
  "identity_locked" BOOLEAN NOT NULL DEFAULT false,
  "hidden_elo" REAL NOT NULL DEFAULT 1500,
  "visible_points" INTEGER NOT NULL DEFAULT 0,
  "email_verify_token" TEXT,
  "email_verify_expiry" DATETIME,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "verified_at" DATETIME,
  "tos_accepted_at" DATETIME,
  "privacy_accepted_at" DATETIME,
  "language" TEXT NOT NULL DEFAULT 'en',
  "hide_elo" BOOLEAN NOT NULL DEFAULT false,
  "show_on_leaderboard" BOOLEAN NOT NULL DEFAULT true,
  "player_org_type" TEXT NOT NULL DEFAULT 'INDEPENDENT',
  "verification_status" TEXT NOT NULL DEFAULT 'NONE',
  "id_document_url" TEXT,
  "id_document_type" TEXT,
  "org_verified_at" DATETIME,
  "org_verified_by" TEXT,
  "verification_notes" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "deactivated_at" DATETIME,
  "deactivation_reason" TEXT,
  "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
  "locked_until" DATETIME,
  "is_anonymized" BOOLEAN NOT NULL DEFAULT false,
  "anonymized_at" DATETIME,
  "gdpr_deletion_requested_at" DATETIME,
  "gdpr_deletion_scheduled_for" DATETIME,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL,
  "referral_code" TEXT,
  CONSTRAINT "user_visible_points_nonneg" CHECK ("visible_points" >= 0),
  CONSTRAINT "user_elo_floor" CHECK ("hidden_elo" >= 100)
);

-- Copy data from old table
INSERT INTO "User_new" SELECT * FROM "User";

-- Drop old table and indexes
DROP TABLE "User";
DROP INDEX IF EXISTS "User_email_sport_key";
DROP INDEX IF EXISTS "User_phone_sport_key";
DROP INDEX IF EXISTS "User_googleId_sport_key";
DROP INDEX IF EXISTS "User_sport_hiddenElo_idx";
DROP INDEX IF EXISTS "User_sport_visiblePoints_idx";
DROP INDEX IF EXISTS "User_sport_isActive_idx";
DROP INDEX IF EXISTS "User_referral_code_key";

-- Rename new table
ALTER TABLE "User_new" RENAME TO "User";

-- Recreate indexes and unique constraints
CREATE UNIQUE INDEX "User_email_sport_key" ON "User"("email", "sport");
CREATE UNIQUE INDEX "User_phone_sport_key" ON "User"("phone", "sport");
CREATE UNIQUE INDEX "User_googleId_sport_key" ON "User"("google_id", "sport");
CREATE INDEX "User_sport_hiddenElo_idx" ON "User"("sport", "hidden_elo");
CREATE INDEX "User_sport_visiblePoints_idx" ON "User"("sport", "visible_points");
CREATE INDEX "User_sport_isActive_idx" ON "User"("sport", "is_active");
CREATE UNIQUE INDEX "User_referral_code_key" ON "User"("referral_code");

-- Re-enable foreign key checks
PRAGMA foreign_keys = ON;

-- ============================================
-- 5. Unique Player Per Tournament
-- Note: This is already enforced by @@unique([tournamentId, userId]) in Prisma schema
-- The TournamentRegistration table already has this constraint:
-- CREATE UNIQUE INDEX "TournamentRegistration_tournamentId_userId_key" ON "TournamentRegistration"("tournament_id", "user_id");
-- No additional action needed
-- ============================================

-- Migration complete
-- These constraints enforce:
-- 1. Session integrity (user XOR org ownership)
-- 2. Match result completeness (scores when played, reasons for special outcomes)
-- 3. Tournament date logic (registration before start, start before end)
-- 4. Rating floor protections (non-negative points, minimum ELO of 100)
