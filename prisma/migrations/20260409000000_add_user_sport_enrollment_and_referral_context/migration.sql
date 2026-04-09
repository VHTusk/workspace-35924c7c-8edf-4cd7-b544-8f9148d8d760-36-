DO $$
BEGIN
  CREATE TYPE "UserSportEnrollmentStatus" AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "UserSportEnrollmentSource" AS ENUM (
    'MANUAL_JOIN',
    'TOURNAMENT_REGISTRATION',
    'REFERRAL',
    'MEMBERSHIP_PURCHASE',
    'ADMIN_ADD',
    'ACCOUNT_REGISTRATION'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ReferralType" AS ENUM ('PLATFORM', 'SPORT_SPECIFIC');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "UserSportEnrollment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sport" "SportType" NOT NULL,
  "status" "UserSportEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "source" "UserSportEnrollmentSource" NOT NULL DEFAULT 'ACCOUNT_REGISTRATION',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserSportEnrollment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserSportEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserSportEnrollment_userId_sport_key"
  ON "UserSportEnrollment"("userId", "sport");

CREATE INDEX IF NOT EXISTS "UserSportEnrollment_sport_status_idx"
  ON "UserSportEnrollment"("sport", "status");

ALTER TABLE "Referral"
  ADD COLUMN IF NOT EXISTS "referralType" "ReferralType" NOT NULL DEFAULT 'SPORT_SPECIFIC',
  ADD COLUMN IF NOT EXISTS "conversionEvent" TEXT;

ALTER TABLE "Referral"
  ALTER COLUMN "sport" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "Referral_referralType_sport_idx"
  ON "Referral"("referralType", "sport");

INSERT INTO "UserSportEnrollment" ("id", "userId", "sport", "status", "source", "joinedAt", "createdAt", "updatedAt")
SELECT
  CONCAT('use_', SUBSTRING(md5("id" || ':' || "sport"::text) FROM 1 FOR 24)),
  "id",
  "sport",
  'ACTIVE'::"UserSportEnrollmentStatus",
  'ACCOUNT_REGISTRATION'::"UserSportEnrollmentSource",
  COALESCE("createdAt", CURRENT_TIMESTAMP),
  COALESCE("createdAt", CURRENT_TIMESTAMP),
  CURRENT_TIMESTAMP
FROM "User"
ON CONFLICT ("userId", "sport") DO NOTHING;
