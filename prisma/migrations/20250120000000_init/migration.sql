-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "captainId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'DOUBLES',
    "teamElo" REAL NOT NULL DEFAULT 1000,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "matchesPlayed" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    CONSTRAINT "Team_captainId_fkey" FOREIGN KEY ("captainId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TournamentTeam" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentId" TEXT,
    "amount" INTEGER NOT NULL,
    "registeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" DATETIME,
    "refundId" TEXT,
    "refundAmount" INTEGER,
    CONSTRAINT "TournamentTeam_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TournamentTeam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeamInvitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" DATETIME,
    CONSTRAINT "TeamInvitation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamInvitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeamInvitation_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sport" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PLAYER',
    "accountTier" TEXT NOT NULL DEFAULT 'FAN',
    "email" TEXT,
    "password" TEXT,
    "phone" TEXT,
    "googleId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dob" DATETIME,
    "gender" TEXT,
    "city" TEXT,
    "district" TEXT,
    "state" TEXT,
    "pinCode" TEXT,
    "affiliatedOrgId" TEXT,
    "identityLocked" BOOLEAN NOT NULL DEFAULT false,
    "hiddenElo" REAL NOT NULL DEFAULT 1500,
    "visiblePoints" INTEGER NOT NULL DEFAULT 0,
    "emailVerifyToken" TEXT,
    "emailVerifyExpiry" DATETIME,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" DATETIME,
    "tosAcceptedAt" DATETIME,
    "privacyAcceptedAt" DATETIME,
    "language" TEXT NOT NULL DEFAULT 'en',
    "hideElo" BOOLEAN NOT NULL DEFAULT false,
    "showOnLeaderboard" BOOLEAN NOT NULL DEFAULT true,
    "profession" TEXT,
    "professionMembershipNumber" TEXT,
    "professionGoverningBody" TEXT,
    "professionVerified" TEXT NOT NULL DEFAULT 'NONE',
    "professionDocumentUrl" TEXT,
    "professionVerifiedAt" DATETIME,
    "professionVerifiedBy" TEXT,
    "showProfessionPublicly" BOOLEAN NOT NULL DEFAULT false,
    "playerOrgType" TEXT NOT NULL DEFAULT 'INDEPENDENT',
    "verificationStatus" TEXT NOT NULL DEFAULT 'NONE',
    "idDocumentUrl" TEXT,
    "idDocumentType" TEXT,
    "orgVerifiedAt" DATETIME,
    "orgVerifiedBy" TEXT,
    "verificationNotes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deactivatedAt" DATETIME,
    "deactivationReason" TEXT,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "isAnonymized" BOOLEAN NOT NULL DEFAULT false,
    "anonymizedAt" DATETIME,
    "gdprDeletionRequestedAt" DATETIME,
    "gdprDeletionScheduledFor" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "referralCode" TEXT,
    CONSTRAINT "User_affiliatedOrgId_fkey" FOREIGN KEY ("affiliatedOrgId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "userId" TEXT,
    "orgId" TEXT,
    "sport" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "operatorName" TEXT,
    "operatorEmail" TEXT,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Session_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DirectorMagicLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DirectorMagicLink_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DirectorSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DirectorSession_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sport" TEXT NOT NULL,
    "tournamentId" TEXT,
    "playerAId" TEXT,
    "playerBId" TEXT,
    "teamAId" TEXT,
    "teamBId" TEXT,
    "scoreA" INTEGER,
    "scoreB" INTEGER,
    "winnerId" TEXT,
    "winnerTeamId" TEXT,
    "outcome" TEXT,
    "outcomeReason" TEXT,
    "pointsA" INTEGER,
    "pointsB" INTEGER,
    "tournamentScope" TEXT,
    "eloChangeA" REAL,
    "eloChangeB" REAL,
    "scheduledTime" DATETIME,
    "courtName" TEXT,
    "submittedById" TEXT,
    "playerScoreStatus" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "verificationDeadline" DATETIME,
    "refereeId" TEXT,
    "refereeName" TEXT,
    "playedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "enteredOffline" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" DATETIME,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "Match_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Match_playerAId_fkey" FOREIGN KEY ("playerAId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Match_playerBId_fkey" FOREIGN KEY ("playerBId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Match_teamAId_fkey" FOREIGN KEY ("teamAId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Match_teamBId_fkey" FOREIGN KEY ("teamBId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Match_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "scope" TEXT,
    "location" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "regDeadline" DATETIME NOT NULL,
    "prizePool" INTEGER NOT NULL,
    "maxPlayers" INTEGER NOT NULL,
    "entryFee" INTEGER NOT NULL DEFAULT 0,
    "maxPlayersPerOrg" INTEGER,
    "format" TEXT NOT NULL DEFAULT 'INDIVIDUAL',
    "teamSize" INTEGER,
    "maxTeams" INTEGER,
    "earlyBirdFee" INTEGER,
    "earlyBirdDeadline" DATETIME,
    "groupDiscountMin" INTEGER,
    "groupDiscountPercent" INTEGER,
    "bracketFormat" TEXT,
    "city" TEXT,
    "district" TEXT,
    "state" TEXT,
    "venueGoogleMapsUrl" TEXT,
    "managerName" TEXT NOT NULL,
    "managerPhone" TEXT NOT NULL,
    "managerWhatsApp" TEXT,
    "contactPersonName" TEXT,
    "contactPersonPhone" TEXT,
    "contactPersonWhatsApp" TEXT,
    "orgId" TEXT,
    "ageMin" INTEGER,
    "ageMax" INTEGER,
    "gender" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "scoringMode" TEXT NOT NULL DEFAULT 'STAFF_ONLY',
    "rosterLockDate" DATETIME,
    "createdById" TEXT,
    "templateId" TEXT,
    "seriesId" TEXT,
    "seriesPoints" INTEGER,
    "seriesPosition" INTEGER,
    "autopilotEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoCloseRegistration" BOOLEAN NOT NULL DEFAULT true,
    "autoGenerateBracket" BOOLEAN NOT NULL DEFAULT true,
    "autoStartTournament" BOOLEAN NOT NULL DEFAULT true,
    "autoAdvanceWinner" BOOLEAN NOT NULL DEFAULT true,
    "autoPromoteWaitlist" BOOLEAN NOT NULL DEFAULT true,
    "registrationClosedAt" DATETIME,
    "bracketGeneratedAt" DATETIME,
    "tournamentStartedAt" DATETIME,
    "directorName" TEXT,
    "directorPhone" TEXT,
    "directorEmail" TEXT,
    "directorUsername" TEXT,
    "directorPasswordHash" TEXT,
    "directorCredentialsSent" BOOLEAN NOT NULL DEFAULT false,
    "directorAssignedById" TEXT,
    "directorAssignedAt" DATETIME,
    "showDirectorContact" BOOLEAN NOT NULL DEFAULT false,
    "venueEscalationActive" BOOLEAN NOT NULL DEFAULT false,
    "venueEscalationTriggeredAt" DATETIME,
    "venueEscalationTriggeredById" TEXT,
    "venueEscalationReason" TEXT,
    "isProfessionExclusive" BOOLEAN NOT NULL DEFAULT false,
    "allowedProfessions" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Tournament_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Tournament_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "TournamentSeries" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sport" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CLUB',
    "planTier" TEXT NOT NULL DEFAULT 'BASIC',
    "email" TEXT,
    "password" TEXT NOT NULL,
    "phone" TEXT,
    "city" TEXT,
    "district" TEXT,
    "state" TEXT,
    "pinCode" TEXT,
    "logoUrl" TEXT,
    "tosAcceptedAt" DATETIME,
    "privacyAcceptedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Bracket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "totalRounds" INTEGER NOT NULL,
    "seedingMethod" TEXT NOT NULL DEFAULT 'ELO',
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedById" TEXT NOT NULL,
    CONSTRAINT "Bracket_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Bracket_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BracketMatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bracketId" TEXT NOT NULL,
    "matchId" TEXT,
    "roundNumber" INTEGER NOT NULL,
    "matchNumber" INTEGER NOT NULL,
    "playerAId" TEXT,
    "playerBId" TEXT,
    "winnerId" TEXT,
    "teamAId" TEXT,
    "teamBId" TEXT,
    "winnerTeamId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "scheduledAt" DATETIME,
    "courtAssignment" TEXT,
    "bracketSide" TEXT,
    "nextMatchId" TEXT,
    "loserNextMatchId" TEXT,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "BracketMatch_bracketId_fkey" FOREIGN KEY ("bracketId") REFERENCES "Bracket" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BracketMatch_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BracketMatch_teamAId_fkey" FOREIGN KEY ("teamAId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BracketMatch_teamBId_fkey" FOREIGN KEY ("teamBId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrgAdmin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "invitedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "OrgAdmin_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrgAdmin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrgAdmin_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" DATETIME,
    "link" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TournamentResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "bonusPoints" INTEGER NOT NULL,
    "awardedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TournamentResult_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TournamentResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PrizePayoutRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "paidAt" DATETIME NOT NULL,
    "markedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PrizePayoutRecord_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PrizePayoutRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PrizePayoutRecord_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PrizeDistribution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "percentage" REAL NOT NULL,
    "amount" REAL NOT NULL,
    "description" TEXT,
    "isMonetary" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PrizeDistribution_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PrizePayout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT,
    "teamId" TEXT,
    "position" INTEGER NOT NULL,
    "amount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payoutMethod" TEXT,
    "transactionRef" TEXT,
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PrizePayout_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PrizePayout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PrizePayout_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sport" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "tournamentId" TEXT,
    "operatorName" TEXT,
    "operatorEmail" TEXT,
    "reason" TEXT,
    "metadata" TEXT,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SportRules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sport" TEXT NOT NULL,
    "cityParticipation" INTEGER NOT NULL DEFAULT 1,
    "cityWin" INTEGER NOT NULL DEFAULT 2,
    "districtParticipation" INTEGER NOT NULL DEFAULT 1,
    "districtWin" INTEGER NOT NULL DEFAULT 3,
    "stateParticipation" INTEGER NOT NULL DEFAULT 2,
    "stateWin" INTEGER NOT NULL DEFAULT 4,
    "nationalParticipation" INTEGER NOT NULL DEFAULT 3,
    "nationalWin" INTEGER NOT NULL DEFAULT 6,
    "cityFirst" INTEGER NOT NULL DEFAULT 10,
    "citySecond" INTEGER NOT NULL DEFAULT 6,
    "cityThird" INTEGER NOT NULL DEFAULT 3,
    "districtFirst" INTEGER NOT NULL DEFAULT 15,
    "districtSecond" INTEGER NOT NULL DEFAULT 9,
    "districtThird" INTEGER NOT NULL DEFAULT 5,
    "stateFirst" INTEGER NOT NULL DEFAULT 20,
    "stateSecond" INTEGER NOT NULL DEFAULT 12,
    "stateThird" INTEGER NOT NULL DEFAULT 6,
    "nationalFirst" INTEGER NOT NULL DEFAULT 30,
    "nationalSecond" INTEGER NOT NULL DEFAULT 18,
    "nationalThird" INTEGER NOT NULL DEFAULT 9,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MfaSecret" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MfaSecret_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MfaRecoveryCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MfaRecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TournamentReminder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hoursBefore" INTEGER NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TournamentReminder_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TournamentReminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MatchReminder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "minutesBefore" INTEGER NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MatchReminder_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MatchReminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AutopilotLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "details" TEXT,
    "errorMessage" TEXT,
    "executedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AutopilotLog_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Sector" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Zone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sectorId" TEXT NOT NULL,
    "states" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Zone_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sport" TEXT,
    "adminRole" TEXT NOT NULL,
    "sectorId" TEXT,
    "zoneId" TEXT,
    "stateCode" TEXT,
    "districtName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deactivatedAt" DATETIME,
    "deactivatedBy" TEXT,
    "deactivationReason" TEXT,
    "assignedById" TEXT NOT NULL,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "trustLevel" INTEGER NOT NULL DEFAULT 0,
    "actionsCount" INTEGER NOT NULL DEFAULT 0,
    "escalationsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AdminAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AdminAssignment_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AdminAssignment_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminPermissions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assignmentId" TEXT NOT NULL,
    "canCreateTournament" BOOLEAN NOT NULL DEFAULT false,
    "canApproveTournament" BOOLEAN NOT NULL DEFAULT false,
    "canPublishTournament" BOOLEAN NOT NULL DEFAULT false,
    "canStartTournament" BOOLEAN NOT NULL DEFAULT false,
    "canPauseTournament" BOOLEAN NOT NULL DEFAULT false,
    "canCancelTournament" BOOLEAN NOT NULL DEFAULT false,
    "canEditTournament" BOOLEAN NOT NULL DEFAULT false,
    "canGenerateBracket" BOOLEAN NOT NULL DEFAULT false,
    "canScoreMatches" BOOLEAN NOT NULL DEFAULT false,
    "canRollbackMatch" BOOLEAN NOT NULL DEFAULT false,
    "canOverrideResult" BOOLEAN NOT NULL DEFAULT false,
    "canViewPlayers" BOOLEAN NOT NULL DEFAULT true,
    "canEditPlayer" BOOLEAN NOT NULL DEFAULT false,
    "canBanPlayer" BOOLEAN NOT NULL DEFAULT false,
    "canAdjustElo" BOOLEAN NOT NULL DEFAULT false,
    "maxEloAdjustment" INTEGER NOT NULL DEFAULT 0,
    "canViewRevenue" BOOLEAN NOT NULL DEFAULT false,
    "canProcessRefund" BOOLEAN NOT NULL DEFAULT false,
    "canProcessPayout" BOOLEAN NOT NULL DEFAULT false,
    "canViewDisputes" BOOLEAN NOT NULL DEFAULT true,
    "canResolveDisputes" BOOLEAN NOT NULL DEFAULT false,
    "canApproveOrgs" BOOLEAN NOT NULL DEFAULT false,
    "canSuspendOrgs" BOOLEAN NOT NULL DEFAULT false,
    "canAssignAdmins" BOOLEAN NOT NULL DEFAULT false,
    "canAssignDirectors" BOOLEAN NOT NULL DEFAULT false,
    "canViewAuditLogs" BOOLEAN NOT NULL DEFAULT false,
    "canManageFeatureFlags" BOOLEAN NOT NULL DEFAULT false,
    "canViewAnalytics" BOOLEAN NOT NULL DEFAULT false,
    "canManageSportRules" BOOLEAN NOT NULL DEFAULT false,
    "canAccessHealthDashboard" BOOLEAN NOT NULL DEFAULT false,
    "canManageSectors" BOOLEAN NOT NULL DEFAULT false,
    "canEditCompletedMatch" BOOLEAN NOT NULL DEFAULT false,
    "canDeleteTournament" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AdminPermissions_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "AdminAssignment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminEscalation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "requestedAction" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "currentLevel" TEXT NOT NULL,
    "assignedToId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "escalationChain" TEXT NOT NULL,
    "autoEscalateAt" DATETIME,
    "resolution" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AdminEscalation_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "AdminAssignment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assignmentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT,
    "ipAddress" TEXT,
    "actedById" TEXT NOT NULL,
    "actedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminAuditLog_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "AdminAssignment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BoundaryChangeLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "changedById" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "beforeState" TEXT NOT NULL,
    "afterState" TEXT NOT NULL,
    "affectedAdmins" TEXT NOT NULL,
    "affectedTournaments" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AdminMetrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tournamentsCreated" INTEGER NOT NULL DEFAULT 0,
    "tournamentsApproved" INTEGER NOT NULL DEFAULT 0,
    "matchesScored" INTEGER NOT NULL DEFAULT 0,
    "disputesResolved" INTEGER NOT NULL DEFAULT 0,
    "refundsProcessed" INTEGER NOT NULL DEFAULT 0,
    "adminsAssigned" INTEGER NOT NULL DEFAULT 0,
    "avgResponseTime" REAL NOT NULL DEFAULT 0,
    "escalationCount" INTEGER NOT NULL DEFAULT 0,
    "escalationsHandled" INTEGER NOT NULL DEFAULT 0,
    "trustScore" INTEGER NOT NULL DEFAULT 0,
    "trustLevel" INTEGER NOT NULL DEFAULT 0,
    "lastTrustReview" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AdminMetrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Court" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "currentMatchId" TEXT,
    "assignedAt" DATETIME,
    "capacity" INTEGER NOT NULL DEFAULT 2,
    "courtType" TEXT,
    "isPriority" BOOLEAN NOT NULL DEFAULT false,
    "matchesHosted" INTEGER NOT NULL DEFAULT 0,
    "totalOccupiedMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Court_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MatchCheckIn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "courtId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NOT_CHECKED_IN',
    "checkedInAt" DATETIME,
    "gracePeriodEnds" DATETIME,
    "extensionCount" INTEGER NOT NULL DEFAULT 0,
    "extendedById" TEXT,
    "noShowDetectedAt" DATETIME,
    "noShowConfirmedAt" DATETIME,
    "noShowConfirmedBy" TEXT,
    "source" TEXT NOT NULL DEFAULT 'PLAYER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MatchCheckIn_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MatchCheckIn_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MatchCheckIn_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VenueFlowConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "checkInEnabled" BOOLEAN NOT NULL DEFAULT true,
    "checkInOpensMinutes" INTEGER NOT NULL DEFAULT 30,
    "noShowGraceMinutes" INTEGER NOT NULL DEFAULT 15,
    "autoNoShowEnabled" BOOLEAN NOT NULL DEFAULT false,
    "requireDirectorConfirm" BOOLEAN NOT NULL DEFAULT true,
    "autoCourtAssign" BOOLEAN NOT NULL DEFAULT true,
    "priorityCourtsForSeeds" INTEGER,
    "dynamicScheduling" BOOLEAN NOT NULL DEFAULT true,
    "queueBufferMinutes" INTEGER NOT NULL DEFAULT 5,
    "maxQueueSize" INTEGER NOT NULL DEFAULT 10,
    "healthCheckInterval" INTEGER NOT NULL DEFAULT 60,
    "idleCourtAlertMinutes" INTEGER NOT NULL DEFAULT 5,
    "notifyPlayerReady" BOOLEAN NOT NULL DEFAULT true,
    "notifyCourtAssigned" BOOLEAN NOT NULL DEFAULT true,
    "notifyNoShow" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VenueFlowConfig_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CourtAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courtId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT,
    "isAutoAssigned" BOOLEAN NOT NULL DEFAULT true,
    "matchStartedAt" DATETIME,
    "matchEndedAt" DATETIME,
    "releasedAt" DATETIME,
    "releasedBy" TEXT,
    "releaseReason" TEXT,
    CONSTRAINT "CourtAssignment_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CourtAssignment_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VenueFlowLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "courtId" TEXT,
    "matchId" TEXT,
    "playerId" TEXT,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "oldState" TEXT,
    "newState" TEXT,
    "reason" TEXT,
    "performedBy" TEXT,
    "performedByRole" TEXT,
    "isOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "durationMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VenueFlowLog_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VenueFlowLog_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VenueFlowLog_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VenueFlowLog_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MatchQueue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "readiness" TEXT NOT NULL DEFAULT 'NOT_READY',
    "readyAt" DATETIME,
    "assignedCourtId" TEXT,
    "assignedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "queuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MatchQueue_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MatchQueue_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VenueHealthAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "courtId" TEXT,
    "alertType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'WARNING',
    "message" TEXT NOT NULL,
    "metadata" TEXT,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" DATETIME,
    "resolvedBy" TEXT,
    "resolution" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VenueHealthAlert_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "amount" INTEGER NOT NULL,
    "paymentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrgSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "amount" INTEGER NOT NULL,
    "paymentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrgSubscription_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TournamentRegistration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentId" TEXT,
    "amount" INTEGER NOT NULL,
    "registeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" DATETIME,
    "refundId" TEXT,
    "refundAmount" INTEGER,
    "declaredProfession" TEXT,
    "professionCheckPassed" BOOLEAN NOT NULL DEFAULT true,
    "requiresProfessionVerification" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "TournamentRegistration_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TournamentRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrgTournamentRegistration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentId" TEXT,
    "amount" INTEGER NOT NULL,
    "registeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" DATETIME,
    CONSTRAINT "OrgTournamentRegistration_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrgTournamentRegistration_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TournamentWaitlist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "position" INTEGER NOT NULL,
    "promotedAt" DATETIME,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TournamentWaitlist_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrgRosterPlayer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "OrgRosterPlayer_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrgRosterPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrgRosterRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" DATETIME,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "OrgRosterRequest_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrgRosterRequest_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlayerRating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "matchesPlayed" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "highestElo" REAL NOT NULL DEFAULT 1500,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "tournamentsPlayed" INTEGER NOT NULL DEFAULT 0,
    "tournamentsWon" INTEGER NOT NULL DEFAULT 0,
    "rd" REAL NOT NULL DEFAULT 350,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlayerRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RatingSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "rd" REAL NOT NULL DEFAULT 350,
    "matchId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RatingSnapshot_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlayerAchievement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "earnedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "badgeId" TEXT,
    CONSTRAINT "PlayerAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PlayerAchievement_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "BadgeDefinition" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "raisedById" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reason" TEXT NOT NULL,
    "evidence" TEXT,
    "resolution" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Dispute_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MatchResultHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "oldScoreA" INTEGER,
    "oldScoreB" INTEGER,
    "newScoreA" INTEGER,
    "newScoreB" INTEGER,
    "oldWinnerId" TEXT,
    "newWinnerId" TEXT,
    "reason" TEXT NOT NULL,
    "editedById" TEXT NOT NULL,
    "editedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MatchResultHistory_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "pushNotifications" BOOLEAN NOT NULL DEFAULT true,
    "matchResultNotifs" BOOLEAN NOT NULL DEFAULT true,
    "tournamentNotifs" BOOLEAN NOT NULL DEFAULT true,
    "pointsNotifs" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TransferCooldown" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "fromOrgId" TEXT,
    "toOrgId" TEXT,
    "cooldownEnds" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TransferCooldown_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IdentityChangeRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IdentityChangeRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TournamentStaff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TournamentStaff_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TournamentStaff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TournamentSponsor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT,
    "orgId" TEXT,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "website" TEXT,
    "tier" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TournamentSponsor_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TournamentSponsor_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TournamentMedia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TournamentMedia_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TournamentCheckin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "checkedInAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL DEFAULT 'SELF',
    CONSTRAINT "TournamentCheckin_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScheduleSlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "courtName" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "matchId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScheduleSlot_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TournamentAnnouncement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TournamentAnnouncement_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "targetRoles" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Announcement_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaymentLedger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "orgId" TEXT,
    "tournamentId" TEXT,
    "sport" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INITIATED',
    "paymentId" TEXT,
    "razorpayId" TEXT,
    "description" TEXT,
    "upiVpa" TEXT,
    "upiBank" TEXT,
    "paymentMethod" TEXT,
    "reconciledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaymentLedger_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlayerAvailability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT true,
    "specificDate" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlayerAvailability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BlockedPlayer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "reason" TEXT,
    "isMute" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BlockedPlayer_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BlockedPlayer_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BadgeDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sport" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "iconUrl" TEXT,
    "category" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "pointsRequired" INTEGER,
    "conditionExpr" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ActivityFeed" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sport" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sport" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ConversationParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" DATETIME,
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isSystemMessage" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" DATETIME,
    "deletedAt" DATETIME,
    CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeaderboardSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sport" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME,
    "userId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "visiblePoints" INTEGER NOT NULL,
    "hiddenElo" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeaderboardSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "referrerId" TEXT NOT NULL,
    "refereeId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rewardPoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Referral_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrgStatistics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "totalMembers" INTEGER NOT NULL DEFAULT 0,
    "activeMembers" INTEGER NOT NULL DEFAULT 0,
    "tournamentsHosted" INTEGER NOT NULL DEFAULT 0,
    "tournamentsWon" INTEGER NOT NULL DEFAULT 0,
    "totalMatchesPlayed" INTEGER NOT NULL DEFAULT 0,
    "totalWins" INTEGER NOT NULL DEFAULT 0,
    "topPlayerId" TEXT,
    "avgMemberElo" REAL NOT NULL DEFAULT 0,
    "lastCalculated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrgStatistics_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserFollow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserFollow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserFollow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserFollowsOrg" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserFollowsOrg_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserFollowsOrg_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrgFollowsUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrgFollowsUser_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrgFollowsUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmailNotificationSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "orgId" TEXT,
    "sport" TEXT NOT NULL,
    "matchResults" BOOLEAN NOT NULL DEFAULT true,
    "tournamentUpdates" BOOLEAN NOT NULL DEFAULT true,
    "rankChanges" BOOLEAN NOT NULL DEFAULT true,
    "milestones" BOOLEAN NOT NULL DEFAULT true,
    "weeklyDigest" BOOLEAN NOT NULL DEFAULT true,
    "announcements" BOOLEAN NOT NULL DEFAULT true,
    "promotional" BOOLEAN NOT NULL DEFAULT true,
    "quietHoursStart" INTEGER,
    "quietHoursEnd" INTEGER,
    "quietHoursTimezone" TEXT DEFAULT 'Asia/Kolkata',
    "digestMode" BOOLEAN NOT NULL DEFAULT false,
    "digestFrequency" TEXT DEFAULT 'daily',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmailNotificationSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmailNotificationSetting_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WhatsAppNotificationSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "orgId" TEXT,
    "sport" TEXT NOT NULL,
    "matchResults" BOOLEAN NOT NULL DEFAULT true,
    "tournamentUpdates" BOOLEAN NOT NULL DEFAULT true,
    "rankChanges" BOOLEAN NOT NULL DEFAULT true,
    "milestones" BOOLEAN NOT NULL DEFAULT false,
    "weeklyDigest" BOOLEAN NOT NULL DEFAULT false,
    "promotional" BOOLEAN NOT NULL DEFAULT false,
    "quietHoursStart" INTEGER,
    "quietHoursEnd" INTEGER,
    "quietHoursTimezone" TEXT DEFAULT 'Asia/Kolkata',
    "phoneNumber" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WhatsAppNotificationSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WhatsAppNotificationSetting_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "orgId" TEXT,
    "sport" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" TEXT,
    "earnedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Milestone_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Milestone_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "signature" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" DATETIME,
    "lastError" TEXT,
    "processedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "rolloutPercentage" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ContentReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reporterId" TEXT NOT NULL,
    "reportedUserId" TEXT,
    "reportedOrgId" TEXT,
    "contentType" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "contentSnapshot" TEXT,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "action" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ArchivedTournament" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "originalId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "scope" TEXT,
    "location" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "summary" TEXT NOT NULL,
    "archivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ArchivedMatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "originalId" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "archivedTournamentId" TEXT,
    "sport" TEXT NOT NULL,
    "playerAId" TEXT NOT NULL,
    "playerBId" TEXT,
    "scoreA" INTEGER,
    "scoreB" INTEGER,
    "winnerId" TEXT,
    "playedAt" DATETIME NOT NULL,
    "archivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PlayerSearchIndex" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "visiblePoints" INTEGER NOT NULL,
    "hiddenElo" REAL NOT NULL,
    "searchVector" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DeviceToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "orgId" TEXT,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "deviceId" TEXT,
    "deviceName" TEXT,
    "appVersion" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PushNotificationSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "orgId" TEXT,
    "sport" TEXT NOT NULL,
    "matchResults" BOOLEAN NOT NULL DEFAULT true,
    "tournamentUpdates" BOOLEAN NOT NULL DEFAULT true,
    "rankChanges" BOOLEAN NOT NULL DEFAULT true,
    "milestones" BOOLEAN NOT NULL DEFAULT true,
    "announcements" BOOLEAN NOT NULL DEFAULT true,
    "quietHoursStart" INTEGER,
    "quietHoursEnd" INTEGER,
    "quietHoursTimezone" TEXT DEFAULT 'Asia/Kolkata',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PushNotificationSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PushNotificationSetting_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PushNotificationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "orgId" TEXT,
    "token" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PlayerContract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contractTitle" TEXT NOT NULL,
    "contractType" TEXT NOT NULL,
    "contractTerms" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "verifiedBy" TEXT,
    "verifiedAt" DATETIME,
    "rejectionReason" TEXT,
    "contractDocumentUrl" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlayerContract_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PlayerContract_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InterOrgTeamSelection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "selectedBy" TEXT NOT NULL,
    "selectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" DATETIME,
    CONSTRAINT "InterOrgTeamSelection_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InterOrgTeamSelection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InterOrgTeamPlayer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamSelectionId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "playerOrgType" TEXT NOT NULL,
    "isCaptain" BOOLEAN NOT NULL DEFAULT false,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InterOrgTeamPlayer_teamSelectionId_fkey" FOREIGN KEY ("teamSelectionId") REFERENCES "InterOrgTeamSelection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InterOrgTeamPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlayerIdVerification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "documentUrl" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "verifiedBy" TEXT,
    "verifiedAt" DATETIME,
    "rejectionReason" TEXT,
    "autoApproved" BOOLEAN NOT NULL DEFAULT false,
    "ocrConfidence" REAL,
    "ocrExtractedAt" DATETIME,
    "ocrExtractedName" TEXT,
    "ocrDocumentNumber" TEXT,
    "ocrDocumentType" TEXT,
    "ocrDateOfBirth" TEXT,
    "ocrBypassed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlayerIdVerification_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PlayerIdVerification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GdprConsent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "consentType" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "source" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GdprConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TournamentTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'INDIVIDUAL',
    "format" TEXT NOT NULL DEFAULT 'INDIVIDUAL',
    "scope" TEXT,
    "maxPlayers" INTEGER NOT NULL DEFAULT 64,
    "maxTeams" INTEGER,
    "teamSize" INTEGER,
    "entryFee" INTEGER NOT NULL DEFAULT 0,
    "earlyBirdFee" INTEGER,
    "earlyBirdDeadlineDays" INTEGER,
    "groupDiscountMin" INTEGER,
    "groupDiscountPercent" INTEGER,
    "bracketFormat" TEXT NOT NULL DEFAULT 'SINGLE_ELIMINATION',
    "ageMin" INTEGER,
    "ageMax" INTEGER,
    "gender" TEXT,
    "scoringMode" TEXT NOT NULL DEFAULT 'STAFF_ONLY',
    "maxPlayersPerOrg" INTEGER,
    "prizePoolDefault" INTEGER,
    "regDeadlineDays" INTEGER NOT NULL DEFAULT 7,
    "durationDays" INTEGER NOT NULL DEFAULT 1,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "defaultLocation" TEXT,
    "defaultCity" TEXT,
    "defaultState" TEXT,
    "description" TEXT,
    "rules" TEXT,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurringFrequency" TEXT,
    "recurringDayOfWeek" INTEGER,
    "recurringDayOfMonth" INTEGER,
    "recurringWeekOfMonth" INTEGER,
    "recurringMonthQuarter" INTEGER,
    "seriesId" TEXT,
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TournamentTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TournamentTemplate_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "TournamentSeries" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TournamentSeries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "description" TEXT,
    "seriesType" TEXT NOT NULL DEFAULT 'SEASON',
    "scoringSystem" TEXT NOT NULL DEFAULT 'POINTS',
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "registrationDeadline" DATETIME,
    "participationPoints" INTEGER NOT NULL DEFAULT 1,
    "winPoints" INTEGER NOT NULL DEFAULT 3,
    "placementPoints" TEXT,
    "maxTournamentsCounted" INTEGER,
    "totalPrizePool" INTEGER,
    "prizeDistribution" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UPCOMING',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "lastCalculatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TournamentSeries_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SeriesStanding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seriesId" TEXT NOT NULL,
    "userId" TEXT,
    "teamId" TEXT,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "participationCount" INTEGER NOT NULL DEFAULT 0,
    "winCount" INTEGER NOT NULL DEFAULT 0,
    "placementCount" TEXT,
    "tournamentBreakdown" TEXT,
    "rank" INTEGER,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SeriesStanding_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "TournamentSeries" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecurringTournament" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "tournamentId" TEXT,
    "scheduledStartDate" DATETIME NOT NULL,
    "scheduledRegDeadline" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tournamentCreatedAt" DATETIME,
    "error" TEXT,
    CONSTRAINT "RecurringTournament_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TournamentTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlayerPerformanceTrend" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "periodType" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "matchesPlayed" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "winRate" REAL NOT NULL DEFAULT 0,
    "eloStart" REAL NOT NULL,
    "eloEnd" REAL NOT NULL,
    "eloChange" REAL NOT NULL,
    "pointsEarned" INTEGER NOT NULL DEFAULT 0,
    "avgMarginOfVictory" REAL,
    "avgMarginOfDefeat" REAL,
    "upsetWins" INTEGER NOT NULL DEFAULT 0,
    "upsetLosses" INTEGER NOT NULL DEFAULT 0,
    "tournamentsPlayed" INTEGER NOT NULL DEFAULT 0,
    "tournamentsWon" INTEGER NOT NULL DEFAULT 0,
    "avgPlacement" REAL,
    "formScore" REAL NOT NULL DEFAULT 0,
    "formTrend" TEXT NOT NULL DEFAULT 'STABLE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DartsScoringHeatmap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sport" TEXT NOT NULL DEFAULT 'DARTS',
    "segment" INTEGER NOT NULL,
    "ring" TEXT NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "missCount" INTEGER NOT NULL DEFAULT 0,
    "avgScore" REAL NOT NULL DEFAULT 0,
    "gamePhase" TEXT,
    "matchType" TEXT,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CornholeScoringHeatmap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sport" TEXT NOT NULL DEFAULT 'CORNHOLE',
    "zone" TEXT NOT NULL,
    "throwCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "successRate" REAL NOT NULL DEFAULT 0,
    "roundPosition" INTEGER,
    "scoreSituation" TEXT,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PlayerFormIndicator" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "currentForm" REAL NOT NULL DEFAULT 0,
    "formLevel" TEXT NOT NULL DEFAULT 'NEUTRAL',
    "trendDirection" TEXT NOT NULL DEFAULT 'STABLE',
    "trendMagnitude" REAL NOT NULL DEFAULT 0,
    "recentResults" TEXT,
    "recentWinRate" REAL NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "streakType" TEXT NOT NULL DEFAULT 'NONE',
    "longestWinStreak" INTEGER NOT NULL DEFAULT 0,
    "longestLossStreak" INTEGER NOT NULL DEFAULT 0,
    "upsetRatio" REAL NOT NULL DEFAULT 0,
    "last7DaysForm" REAL NOT NULL DEFAULT 0,
    "last30DaysForm" REAL NOT NULL DEFAULT 0,
    "last90DaysForm" REAL NOT NULL DEFAULT 0,
    "calculatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matchesConsidered" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "HeadToHeadRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerAId" TEXT NOT NULL,
    "playerBId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "totalMatches" INTEGER NOT NULL DEFAULT 0,
    "playerAWins" INTEGER NOT NULL DEFAULT 0,
    "playerBWins" INTEGER NOT NULL DEFAULT 0,
    "individualMatches" INTEGER NOT NULL DEFAULT 0,
    "doublesMatches" INTEGER NOT NULL DEFAULT 0,
    "cityMatches" INTEGER NOT NULL DEFAULT 0,
    "districtMatches" INTEGER NOT NULL DEFAULT 0,
    "stateMatches" INTEGER NOT NULL DEFAULT 0,
    "nationalMatches" INTEGER NOT NULL DEFAULT 0,
    "playerATotalScore" INTEGER NOT NULL DEFAULT 0,
    "playerBTotalScore" INTEGER NOT NULL DEFAULT 0,
    "avgScoreMargin" REAL NOT NULL DEFAULT 0,
    "recentMatches" TEXT,
    "lastEncounterDate" DATETIME,
    "lastWinnerId" TEXT,
    "avgEloDifference" REAL NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TournamentMediaItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "duration" INTEGER,
    "title" TEXT,
    "caption" TEXT,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "matchId" TEXT,
    "roundNumber" INTEGER,
    "taggedPlayerIds" TEXT,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" DATETIME,
    "approvedById" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "shareCount" INTEGER NOT NULL DEFAULT 0,
    "isHighlight" BOOLEAN NOT NULL DEFAULT false,
    "highlightType" TEXT,
    CONSTRAINT "TournamentMediaItem_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VideoHighlight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "matchId" TEXT,
    "sport" TEXT NOT NULL,
    "sourceVideoUrl" TEXT NOT NULL,
    "clipUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "highlightType" TEXT NOT NULL,
    "startTimestamp" INTEGER NOT NULL,
    "endTimestamp" INTEGER NOT NULL,
    "playerIds" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "shareCount" INTEGER NOT NULL DEFAULT 0,
    "shareUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VideoHighlight_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TournamentRecap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "videoUrl" TEXT,
    "thumbnailUrl" TEXT,
    "duration" INTEGER,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "highlights" TEXT NOT NULL,
    "totalMatches" INTEGER NOT NULL,
    "totalUpsets" INTEGER NOT NULL,
    "longestMatch" TEXT,
    "highestScore" TEXT,
    "mvpPlayerId" TEXT,
    "topScorerId" TEXT,
    "bestDefensivePlayerId" TEXT,
    "standings" TEXT NOT NULL,
    "photoCount" INTEGER NOT NULL DEFAULT 0,
    "videoCount" INTEGER NOT NULL DEFAULT 0,
    "isAutoGenerated" BOOLEAN NOT NULL DEFAULT false,
    "generatedAt" DATETIME,
    "publishedAt" DATETIME,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TournamentRecap_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShareableResultCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sport" TEXT NOT NULL,
    "cardType" TEXT NOT NULL,
    "tournamentId" TEXT,
    "matchId" TEXT,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "message" TEXT,
    "imageUrl" TEXT NOT NULL,
    "templateId" TEXT,
    "stats" TEXT,
    "shareUrl" TEXT NOT NULL,
    "shortCode" TEXT NOT NULL,
    "shareToTwitter" INTEGER NOT NULL DEFAULT 0,
    "shareToWhatsApp" INTEGER NOT NULL DEFAULT 0,
    "shareToFacebook" INTEGER NOT NULL DEFAULT 0,
    "shareToLinkedIn" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ShortUrlRedirect" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shortCode" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "targetUrl" TEXT NOT NULL,
    "sport" TEXT,
    "createdById" TEXT,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "lastClickedAt" DATETIME,
    "qrCodeUrl" TEXT,
    "expiresAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SuspendedIdentity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "identifierType" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "suspendedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "suspendedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EloJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "lastError" TEXT,
    "processedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TournamentSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "finalStandings" TEXT NOT NULL,
    "bracketState" TEXT NOT NULL,
    "matchResults" TEXT NOT NULL,
    "statistics" TEXT NOT NULL,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshotVersion" TEXT NOT NULL DEFAULT '1.0',
    "checksum" TEXT NOT NULL,
    "lockedAt" DATETIME,
    "lockedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FinalizationWindow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "windowStartsAt" DATETIME NOT NULL,
    "windowEndsAt" DATETIME NOT NULL,
    "customDuration" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "totalDisputes" INTEGER NOT NULL DEFAULT 0,
    "activeDisputes" INTEGER NOT NULL DEFAULT 0,
    "resolvedDisputes" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" DATETIME,
    "lockedById" TEXT,
    "lockReason" TEXT,
    "unlockedAt" DATETIME,
    "unlockedById" TEXT,
    "unlockReason" TEXT,
    "unlockExpiresAt" DATETIME,
    "windowOpenedNotif" BOOLEAN NOT NULL DEFAULT false,
    "windowClosingNotif" BOOLEAN NOT NULL DEFAULT false,
    "windowClosedNotif" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TournamentDispute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "raisedById" TEXT NOT NULL,
    "disputedEntityId" TEXT,
    "disputeType" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" DATETIME,
    "blocksFinalization" BOOLEAN NOT NULL DEFAULT true,
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "escalationLevel" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TournamentCompletionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "details" TEXT,
    "actorId" TEXT,
    "actorRole" TEXT,
    "errorMessage" TEXT,
    "executedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TournamentStateLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "fromState" TEXT NOT NULL,
    "toState" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RecognitionAward" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "recipientType" TEXT NOT NULL,
    "recognitionType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scope" TEXT,
    "scopeValue" TEXT,
    "validFrom" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" DATETIME,
    "revokedById" TEXT,
    "revocationReason" TEXT,
    "triggeredBy" TEXT NOT NULL DEFAULT 'TOURNAMENT_COMPLETION',
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PlayerCompletionStats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "tournamentsPlayed" INTEGER NOT NULL DEFAULT 0,
    "tournamentsWon" INTEGER NOT NULL DEFAULT 0,
    "tournamentsPodium" INTEGER NOT NULL DEFAULT 0,
    "firstPlace" INTEGER NOT NULL DEFAULT 0,
    "secondPlace" INTEGER NOT NULL DEFAULT 0,
    "thirdPlace" INTEGER NOT NULL DEFAULT 0,
    "titlesHeld" INTEGER NOT NULL DEFAULT 0,
    "achievementsEarned" INTEGER NOT NULL DEFAULT 0,
    "disputesRaised" INTEGER NOT NULL DEFAULT 0,
    "disputesWon" INTEGER NOT NULL DEFAULT 0,
    "trustScore" REAL NOT NULL DEFAULT 100.0,
    "lastTournamentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RefundPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT,
    "refundMode" TEXT NOT NULL DEFAULT 'MANUAL',
    "beforeRegDeadline" REAL NOT NULL DEFAULT 100,
    "afterRegBeforeStart" REAL NOT NULL DEFAULT 100,
    "afterStartPartial" REAL NOT NULL DEFAULT 50,
    "afterStartComplete" REAL NOT NULL DEFAULT 0,
    "platformFeePercent" REAL NOT NULL DEFAULT 0,
    "processingFeeFixed" INTEGER NOT NULL DEFAULT 0,
    "partialRefundHours" INTEGER NOT NULL DEFAULT 24,
    "proRataMatchRefund" BOOLEAN NOT NULL DEFAULT false,
    "minMatchesForRefund" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RefundPolicy_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RefundJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "registrationId" TEXT,
    "teamRegistrationId" TEXT,
    "playerId" TEXT,
    "teamId" TEXT,
    "originalAmount" INTEGER NOT NULL,
    "refundAmount" INTEGER NOT NULL,
    "platformFee" INTEGER NOT NULL DEFAULT 0,
    "processingFee" INTEGER NOT NULL DEFAULT 0,
    "netRefund" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "razorpayRefundId" TEXT,
    "razorpayPaymentId" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 5,
    "lastRetryAt" DATETIME,
    "nextRetryAt" DATETIME,
    "lastError" TEXT,
    "approvedById" TEXT,
    "approvedAt" DATETIME,
    "approvalNotes" TEXT,
    "initiatedAt" DATETIME,
    "completedAt" DATETIME,
    "cancellationReason" TEXT,
    "cancellationNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RefundJob_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaymentRecovery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT,
    "registrationId" TEXT,
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "webhookPayload" TEXT,
    "recoveryAttempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "lastAttemptAt" DATETIME,
    "nextAttemptAt" DATETIME,
    "lastError" TEXT,
    "resolvedAt" DATETIME,
    "resolvedById" TEXT,
    "resolutionNotes" TEXT,
    "originalWebhookAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaymentRecovery_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TournamentFinanceSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "grossCollections" INTEGER NOT NULL DEFAULT 0,
    "platformFeesCollected" INTEGER NOT NULL DEFAULT 0,
    "paymentGatewayFees" INTEGER NOT NULL DEFAULT 0,
    "netCollections" INTEGER NOT NULL DEFAULT 0,
    "entryFeesTotal" INTEGER NOT NULL DEFAULT 0,
    "earlyBirdTotal" INTEGER NOT NULL DEFAULT 0,
    "addOnsTotal" INTEGER NOT NULL DEFAULT 0,
    "totalRegistrations" INTEGER NOT NULL DEFAULT 0,
    "paidRegistrations" INTEGER NOT NULL DEFAULT 0,
    "freeRegistrations" INTEGER NOT NULL DEFAULT 0,
    "totalRefundsInitiated" INTEGER NOT NULL DEFAULT 0,
    "totalRefundsCompleted" INTEGER NOT NULL DEFAULT 0,
    "totalRefundAmount" INTEGER NOT NULL DEFAULT 0,
    "pendingRefundAmount" INTEGER NOT NULL DEFAULT 0,
    "prizePoolCollected" INTEGER NOT NULL DEFAULT 0,
    "prizePoolPaid" INTEGER NOT NULL DEFAULT 0,
    "prizePoolPending" INTEGER NOT NULL DEFAULT 0,
    "organizerPayout" INTEGER NOT NULL DEFAULT 0,
    "platformRevenue" INTEGER NOT NULL DEFAULT 0,
    "reconciledAt" DATETIME,
    "reconciledById" TEXT,
    "reconciliationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "discrepancyNotes" TEXT,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" DATETIME,
    CONSTRAINT "TournamentFinanceSnapshot_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CancellationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "cancelledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledById" TEXT NOT NULL,
    "totalRegistrations" INTEGER NOT NULL DEFAULT 0,
    "totalPaid" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" INTEGER NOT NULL DEFAULT 0,
    "refundMode" TEXT NOT NULL,
    "refundsInitiated" INTEGER NOT NULL DEFAULT 0,
    "refundsPending" INTEGER NOT NULL DEFAULT 0,
    "refundsCompleted" INTEGER NOT NULL DEFAULT 0,
    "playersNotified" BOOLEAN NOT NULL DEFAULT false,
    "notifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CancellationLog_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminAvailability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isAllDay" BOOLEAN NOT NULL DEFAULT false,
    "exceptionDates" TEXT,
    "currentStatus" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "statusMessage" TEXT,
    "statusUntil" DATETIME,
    "maxConcurrent" INTEGER NOT NULL DEFAULT 5,
    "preferredSports" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DirectorAssignmentRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sport" TEXT NOT NULL,
    "stateCode" TEXT,
    "districtName" TEXT,
    "minTrustLevel" INTEGER NOT NULL DEFAULT 0,
    "requireAvailability" BOOLEAN NOT NULL DEFAULT true,
    "maxDistanceKm" INTEGER,
    "distanceWeight" REAL NOT NULL DEFAULT 0.3,
    "trustWeight" REAL NOT NULL DEFAULT 0.3,
    "loadWeight" REAL NOT NULL DEFAULT 0.2,
    "experienceWeight" REAL NOT NULL DEFAULT 0.2,
    "fallbackToStateAdmin" BOOLEAN NOT NULL DEFAULT true,
    "fallbackToZoneAdmin" BOOLEAN NOT NULL DEFAULT true,
    "fallbackToSportAdmin" BOOLEAN NOT NULL DEFAULT true,
    "allowManualOverride" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AdminInactivityFlag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastLoginAt" DATETIME,
    "lastActionAt" DATETIME,
    "daysInactive" INTEGER NOT NULL DEFAULT 0,
    "pendingEscalations" INTEGER NOT NULL DEFAULT 0,
    "unrespondedActions" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'MONITORING',
    "flaggedAt" DATETIME,
    "flaggedById" TEXT,
    "escalationLevel" TEXT,
    "escalatedAt" DATETIME,
    "resolvedAt" DATETIME,
    "resolvedById" TEXT,
    "resolutionNotes" TEXT,
    "autoDisabled" BOOLEAN NOT NULL DEFAULT false,
    "authorityTransferred" BOOLEAN NOT NULL DEFAULT false,
    "transferredToId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RegionLoadMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activeTournaments" INTEGER NOT NULL DEFAULT 0,
    "pendingActions" INTEGER NOT NULL DEFAULT 0,
    "openEscalations" INTEGER NOT NULL DEFAULT 0,
    "scheduledToday" INTEGER NOT NULL DEFAULT 0,
    "scheduledThisWeek" INTEGER NOT NULL DEFAULT 0,
    "maxCapacity" INTEGER NOT NULL DEFAULT 10,
    "currentLoadPercent" REAL NOT NULL DEFAULT 0,
    "avgResponseTimeMin" REAL NOT NULL DEFAULT 0,
    "actionsToday" INTEGER NOT NULL DEFAULT 0,
    "actionsThisWeek" INTEGER NOT NULL DEFAULT 0,
    "tournamentsHandled" INTEGER NOT NULL DEFAULT 0,
    "escalationsResolved" INTEGER NOT NULL DEFAULT 0,
    "periodStart" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodEnd" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EmergencyControlLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "originalAdminId" TEXT,
    "originalRole" TEXT NOT NULL,
    "originalStateCode" TEXT,
    "originalDistrictName" TEXT,
    "assumingAdminId" TEXT NOT NULL,
    "assumingRole" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "triggerDescription" TEXT NOT NULL,
    "triggeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "triggeredById" TEXT,
    "affectedTournaments" INTEGER NOT NULL DEFAULT 0,
    "affectedPlayers" INTEGER NOT NULL DEFAULT 0,
    "affectedRegions" TEXT,
    "estimatedDuration" INTEGER,
    "actualEndTime" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "resolvedAt" DATETIME,
    "resolvedById" TEXT,
    "resolutionNotes" TEXT,
    "superAdminNotified" BOOLEAN NOT NULL DEFAULT false,
    "sportAdminNotified" BOOLEAN NOT NULL DEFAULT false,
    "affectedAdminsNotified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AutoDirectorAssignmentLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "assignmentType" TEXT NOT NULL DEFAULT 'AUTO',
    "candidatesConsidered" INTEGER NOT NULL DEFAULT 0,
    "candidateScores" TEXT,
    "selectedAdminId" TEXT NOT NULL,
    "selectedScore" REAL NOT NULL,
    "selectionReason" TEXT NOT NULL,
    "overriddenBy" TEXT,
    "overriddenAt" DATETIME,
    "overrideReason" TEXT,
    "finalAdminId" TEXT,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "sport" TEXT NOT NULL,
    "employeeId" TEXT,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "department" TEXT,
    "designation" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" DATETIME,
    "verifiedBy" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" DATETIME,
    CONSTRAINT "Employee_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmployeeInvitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "invitedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invitedBy" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "respondedAt" DATETIME,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "emailSentAt" DATETIME,
    "reminderSent" BOOLEAN NOT NULL DEFAULT false,
    "reminderSentAt" DATETIME,
    "responseMessage" TEXT,
    CONSTRAINT "EmployeeInvitation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmployeeInvitation_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmployeeInvitation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmployeeTournamentParticipation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "registeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "result" TEXT,
    "rank" INTEGER,
    "pointsEarned" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "EmployeeTournamentParticipation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmployeeTournamentParticipation_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RepSquad" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "formedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disbandedAt" DATETIME,
    "matchesPlayed" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "tournamentsParticipated" INTEGER NOT NULL DEFAULT 0,
    "tournamentsWon" INTEGER NOT NULL DEFAULT 0,
    "managerId" TEXT,
    "coachId" TEXT,
    CONSTRAINT "RepSquad_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RepPlayer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "squadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "playerType" TEXT NOT NULL DEFAULT 'EMPLOYEE_REP',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" DATETIME,
    "contractId" TEXT,
    "contractStartDate" DATETIME,
    "contractEndDate" DATETIME,
    "role" TEXT NOT NULL DEFAULT 'PLAYER',
    "matchesPlayed" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "RepPlayer_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "RepSquad" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RepPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RepSquadTournamentRegistration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "squadId" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "registeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registeredBy" TEXT NOT NULL,
    "paymentId" TEXT,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "finalRank" INTEGER,
    "prizeWon" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "RepSquadTournamentRegistration_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "RepSquad" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RepSquadTournamentRegistration_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SchoolClass" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gradeLevel" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SchoolClass_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SchoolSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "classId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SchoolSection_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SchoolSection_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SchoolHouse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "logoUrl" TEXT,
    "motto" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "tournamentsWon" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SchoolHouse_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CollegeDepartment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "totalStudents" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CollegeDepartment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CollegeBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "departmentId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startYear" INTEGER NOT NULL,
    "endYear" INTEGER NOT NULL,
    "totalStudents" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CollegeBatch_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "CollegeDepartment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CollegeBatch_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "sport" TEXT NOT NULL,
    "studentType" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "dob" DATETIME,
    "gender" TEXT,
    "classId" TEXT,
    "sectionId" TEXT,
    "houseId" TEXT,
    "departmentId" TEXT,
    "batchId" TEXT,
    "year" INTEGER,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" DATETIME,
    "verifiedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" DATETIME,
    "tournamentsPlayed" INTEGER NOT NULL DEFAULT 0,
    "matchesWon" INTEGER NOT NULL DEFAULT 0,
    "matchesLost" INTEGER NOT NULL DEFAULT 0,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Student_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Student_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Student_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "SchoolSection" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Student_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "SchoolHouse" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Student_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "CollegeDepartment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Student_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "CollegeBatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SchoolTeam" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "formedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disbandedAt" DATETIME,
    "matchesPlayed" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "tournamentsParticipated" INTEGER NOT NULL DEFAULT 0,
    "tournamentsWon" INTEGER NOT NULL DEFAULT 0,
    "coachId" TEXT,
    CONSTRAINT "SchoolTeam_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CollegeTeam" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "formedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disbandedAt" DATETIME,
    "matchesPlayed" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "tournamentsParticipated" INTEGER NOT NULL DEFAULT 0,
    "tournamentsWon" INTEGER NOT NULL DEFAULT 0,
    "coachId" TEXT,
    CONSTRAINT "CollegeTeam_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AcademicTeamMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "teamType" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PLAYER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" DATETIME,
    CONSTRAINT "AcademicTeamMember_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AcademicTeamRegistration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "teamType" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "registeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registeredBy" TEXT NOT NULL,
    "paymentId" TEXT,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "finalRank" INTEGER,
    "prizeWon" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "AcademicTeamRegistration_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlayerSkillMetrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "accuracy" INTEGER NOT NULL DEFAULT 50,
    "consistency" INTEGER NOT NULL DEFAULT 50,
    "clutch" INTEGER NOT NULL DEFAULT 50,
    "endurance" INTEGER NOT NULL DEFAULT 50,
    "strategy" INTEGER NOT NULL DEFAULT 50,
    "teamwork" INTEGER NOT NULL DEFAULT 50,
    "matchesAnalyzed" INTEGER NOT NULL DEFAULT 0,
    "lastCalculated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlayerSkillMetrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlayerStreak" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "currentWinStreak" INTEGER NOT NULL DEFAULT 0,
    "currentMatchStreak" INTEGER NOT NULL DEFAULT 0,
    "currentTournamentStreak" INTEGER NOT NULL DEFAULT 0,
    "bestWinStreak" INTEGER NOT NULL DEFAULT 0,
    "bestMatchStreak" INTEGER NOT NULL DEFAULT 0,
    "bestTournamentStreak" INTEGER NOT NULL DEFAULT 0,
    "streakStartedAt" DATETIME,
    "lastMatchAt" DATETIME,
    "streakType" TEXT NOT NULL DEFAULT 'WIN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlayerStreak_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlayerActivityFeedItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" TEXT,
    "relevanceScore" REAL NOT NULL DEFAULT 1.0,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" DATETIME,
    "linkUrl" TEXT,
    "imageUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlayerActivityFeedItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FriendActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "tournamentId" TEXT,
    "tournamentName" TEXT,
    "matchId" TEXT,
    "lookingForTeam" BOOLEAN NOT NULL DEFAULT false,
    "teamPreferences" TEXT,
    "statusUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FriendActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlayerTrophy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "tournamentId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "trophyType" TEXT NOT NULL,
    "position" INTEGER,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "shareCount" INTEGER NOT NULL DEFAULT 0,
    "lastSharedAt" DATETIME,
    "iconUrl" TEXT,
    "imageUrl" TEXT,
    "earnedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlayerTrophy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuickTeamRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "tournamentId" TEXT,
    "format" TEXT NOT NULL,
    "skillLevelMin" INTEGER,
    "skillLevelMax" INTEGER,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "matchedWithId" TEXT,
    "teamId" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuickTeamRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlayerTournamentRecommendation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "reason" TEXT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "isViewed" BOOLEAN NOT NULL DEFAULT false,
    "isDismissed" BOOLEAN NOT NULL DEFAULT false,
    "viewedAt" DATETIME,
    "dismissedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlayerTournamentRecommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HeroSlide" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sport" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "caption" TEXT,
    "imageUrl" TEXT NOT NULL,
    "videoUrl" TEXT,
    "thumbnailUrl" TEXT,
    "linkUrl" TEXT,
    "linkText" TEXT,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "uploadedById" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TournamentGalleryImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "caption" TEXT,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "tags" TEXT,
    "taggedPlayerIds" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TournamentGalleryImage_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlayerSpotlightImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "caption" TEXT,
    "type" TEXT NOT NULL DEFAULT 'ACTION',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlayerSpotlightImage_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MediaCollection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sport" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "coverImageUrl" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MediaCollectionItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "collectionId" TEXT NOT NULL,
    "galleryImageId" TEXT,
    "imageUrl" TEXT,
    "thumbnailUrl" TEXT,
    "caption" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MediaCollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "MediaCollection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DuelVenue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sport" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "district" TEXT,
    "state" TEXT,
    "pinCode" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "googleMapsUrl" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "venueType" TEXT NOT NULL DEFAULT 'INDOOR',
    "amenities" TEXT,
    "isDuelEligible" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "totalDuelsHosted" INTEGER NOT NULL DEFAULT 0,
    "managedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DuelVenueSlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "venueId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "slotFee" INTEGER NOT NULL DEFAULT 0,
    "duelMatchId" TEXT,
    "lockedById" TEXT,
    "lockedAt" DATETIME,
    "lockExpiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DuelVenueSlot_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "DuelVenue" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DuelVenueSlot_duelMatchId_fkey" FOREIGN KEY ("duelMatchId") REFERENCES "DuelMatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DuelMatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sport" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'INDIVIDUAL',
    "venueId" TEXT,
    "venueName" TEXT,
    "venueAddress" TEXT,
    "venueGoogleMapsUrl" TEXT,
    "scheduledStart" DATETIME NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "entryFee" INTEGER NOT NULL,
    "prizePool" INTEGER NOT NULL,
    "platformFeePercent" REAL NOT NULL DEFAULT 10,
    "matchRules" TEXT,
    "customTerms" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isEscalatable" BOOLEAN NOT NULL DEFAULT false,
    "escalationThreshold" INTEGER NOT NULL DEFAULT 4,
    "maxParticipants" INTEGER NOT NULL DEFAULT 8,
    "escalatedToTournamentId" TEXT,
    "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedAt" DATETIME,
    "approvedById" TEXT,
    "approvalNotes" TEXT,
    "rejectionReason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishedAt" DATETIME,
    "winnerId" TEXT,
    "finalScore" TEXT,
    "completedAt" DATETIME,
    "cancelledAt" DATETIME,
    "cancelledById" TEXT,
    "cancellationReason" TEXT,
    "cancellationFee" INTEGER,
    "expiresAt" DATETIME,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DuelMatch_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DuelMatch_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "DuelVenue" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DuelMatch_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DuelRegistration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "duelMatchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'INITIATED',
    "paymentId" TEXT,
    "amount" INTEGER NOT NULL,
    "checkedIn" BOOLEAN NOT NULL DEFAULT false,
    "checkedInAt" DATETIME,
    "teamId" TEXT,
    "teamName" TEXT,
    "isWinner" BOOLEAN NOT NULL DEFAULT false,
    "prizeAmount" INTEGER,
    "payoutStatus" TEXT,
    "payoutAt" DATETIME,
    "refundedAt" DATETIME,
    "refundAmount" INTEGER,
    "refundId" TEXT,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DuelRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DuelRegistration_duelMatchId_fkey" FOREIGN KEY ("duelMatchId") REFERENCES "DuelMatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CityDuelLeaderboard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "city" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CityDuelEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leaderboardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "duelsPlayed" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "prizeWon" INTEGER NOT NULL DEFAULT 0,
    "duelRating" REAL NOT NULL DEFAULT 1000,
    "rank" INTEGER,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CityDuelEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CityDuelEntry_leaderboardId_fkey" FOREIGN KEY ("leaderboardId") REFERENCES "CityDuelLeaderboard" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Translation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "translations" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "updatedBy" TEXT
);

-- CreateTable
CREATE TABLE "SupportedLanguage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nativeName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "requestBody" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MatchEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Team_sport_status_idx" ON "Team"("sport", "status");

-- CreateIndex
CREATE INDEX "Team_sport_teamElo_idx" ON "Team"("sport", "teamElo");

-- CreateIndex
CREATE INDEX "Team_captainId_idx" ON "Team"("captainId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_sport_key" ON "Team"("name", "sport");

-- CreateIndex
CREATE INDEX "TeamMember_userId_idx" ON "TeamMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_teamId_userId_key" ON "TeamMember"("teamId", "userId");

-- CreateIndex
CREATE INDEX "TournamentTeam_teamId_idx" ON "TournamentTeam"("teamId");

-- CreateIndex
CREATE INDEX "TournamentTeam_status_idx" ON "TournamentTeam"("status");

-- CreateIndex
CREATE INDEX "TournamentTeam_tournamentId_status_idx" ON "TournamentTeam"("tournamentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentTeam_tournamentId_teamId_key" ON "TournamentTeam"("tournamentId", "teamId");

-- CreateIndex
CREATE INDEX "TeamInvitation_inviteeId_status_idx" ON "TeamInvitation"("inviteeId", "status");

-- CreateIndex
CREATE INDEX "TeamInvitation_status_expiresAt_idx" ON "TeamInvitation"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "TeamInvitation_teamId_inviteeId_key" ON "TeamInvitation"("teamId", "inviteeId");

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- CreateIndex
CREATE INDEX "User_sport_hiddenElo_idx" ON "User"("sport", "hiddenElo");

-- CreateIndex
CREATE INDEX "User_sport_visiblePoints_idx" ON "User"("sport", "visiblePoints");

-- CreateIndex
CREATE INDEX "User_sport_isActive_idx" ON "User"("sport", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_sport_key" ON "User"("email", "sport");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_sport_key" ON "User"("phone", "sport");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_sport_key" ON "User"("googleId", "sport");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "Session_token_idx" ON "Session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "DirectorMagicLink_token_key" ON "DirectorMagicLink"("token");

-- CreateIndex
CREATE INDEX "DirectorMagicLink_token_idx" ON "DirectorMagicLink"("token");

-- CreateIndex
CREATE INDEX "DirectorMagicLink_tournamentId_idx" ON "DirectorMagicLink"("tournamentId");

-- CreateIndex
CREATE INDEX "DirectorMagicLink_expiresAt_idx" ON "DirectorMagicLink"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "DirectorSession_token_key" ON "DirectorSession"("token");

-- CreateIndex
CREATE INDEX "DirectorSession_token_idx" ON "DirectorSession"("token");

-- CreateIndex
CREATE INDEX "DirectorSession_tournamentId_expiresAt_idx" ON "DirectorSession"("tournamentId", "expiresAt");

-- CreateIndex
CREATE INDEX "Match_tournamentId_idx" ON "Match"("tournamentId");

-- CreateIndex
CREATE INDEX "Match_playerAId_playedAt_idx" ON "Match"("playerAId", "playedAt");

-- CreateIndex
CREATE INDEX "Match_playerBId_playedAt_idx" ON "Match"("playerBId", "playedAt");

-- CreateIndex
CREATE INDEX "Match_teamAId_playedAt_idx" ON "Match"("teamAId", "playedAt");

-- CreateIndex
CREATE INDEX "Match_teamBId_playedAt_idx" ON "Match"("teamBId", "playedAt");

-- CreateIndex
CREATE INDEX "Match_tournamentId_verificationStatus_idx" ON "Match"("tournamentId", "verificationStatus");

-- CreateIndex
CREATE INDEX "Tournament_sport_status_idx" ON "Tournament"("sport", "status");

-- CreateIndex
CREATE INDEX "Tournament_sport_type_idx" ON "Tournament"("sport", "type");

-- CreateIndex
CREATE INDEX "Tournament_city_sport_status_idx" ON "Tournament"("city", "sport", "status");

-- CreateIndex
CREATE INDEX "Tournament_state_sport_status_idx" ON "Tournament"("state", "sport", "status");

-- CreateIndex
CREATE INDEX "Tournament_sport_isPublic_status_idx" ON "Tournament"("sport", "isPublic", "status");

-- CreateIndex
CREATE INDEX "Organization_sport_idx" ON "Organization"("sport");

-- CreateIndex
CREATE INDEX "Organization_email_idx" ON "Organization"("email");

-- CreateIndex
CREATE INDEX "Organization_phone_idx" ON "Organization"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Bracket_tournamentId_key" ON "Bracket"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "BracketMatch_matchId_key" ON "BracketMatch"("matchId");

-- CreateIndex
CREATE INDEX "BracketMatch_bracketId_roundNumber_idx" ON "BracketMatch"("bracketId", "roundNumber");

-- CreateIndex
CREATE INDEX "BracketMatch_bracketId_status_idx" ON "BracketMatch"("bracketId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OrgAdmin_orgId_userId_key" ON "OrgAdmin"("orgId", "userId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "TournamentResult_userId_idx" ON "TournamentResult"("userId");

-- CreateIndex
CREATE INDEX "TournamentResult_sport_idx" ON "TournamentResult"("sport");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentResult_tournamentId_rank_key" ON "TournamentResult"("tournamentId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentResult_tournamentId_userId_key" ON "TournamentResult"("tournamentId", "userId");

-- CreateIndex
CREATE INDEX "PrizePayoutRecord_sport_idx" ON "PrizePayoutRecord"("sport");

-- CreateIndex
CREATE UNIQUE INDEX "PrizePayoutRecord_tournamentId_userId_key" ON "PrizePayoutRecord"("tournamentId", "userId");

-- CreateIndex
CREATE INDEX "PrizeDistribution_tournamentId_idx" ON "PrizeDistribution"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "PrizeDistribution_tournamentId_position_key" ON "PrizeDistribution"("tournamentId", "position");

-- CreateIndex
CREATE INDEX "PrizePayout_tournamentId_status_idx" ON "PrizePayout"("tournamentId", "status");

-- CreateIndex
CREATE INDEX "PrizePayout_status_idx" ON "PrizePayout"("status");

-- CreateIndex
CREATE INDEX "AuditLog_sport_action_idx" ON "AuditLog"("sport", "action");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_tournamentId_idx" ON "AuditLog"("tournamentId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SportRules_sport_key" ON "SportRules"("sport");

-- CreateIndex
CREATE UNIQUE INDEX "MfaSecret_userId_key" ON "MfaSecret"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MfaRecoveryCode_userId_codeHash_key" ON "MfaRecoveryCode"("userId", "codeHash");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- CreateIndex
CREATE INDEX "Wallet_sport_idx" ON "Wallet"("sport");

-- CreateIndex
CREATE INDEX "TournamentReminder_tournamentId_idx" ON "TournamentReminder"("tournamentId");

-- CreateIndex
CREATE INDEX "TournamentReminder_userId_idx" ON "TournamentReminder"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentReminder_tournamentId_userId_hoursBefore_key" ON "TournamentReminder"("tournamentId", "userId", "hoursBefore");

-- CreateIndex
CREATE INDEX "MatchReminder_matchId_idx" ON "MatchReminder"("matchId");

-- CreateIndex
CREATE INDEX "MatchReminder_userId_idx" ON "MatchReminder"("userId");

-- CreateIndex
CREATE INDEX "MatchReminder_sentAt_idx" ON "MatchReminder"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "MatchReminder_matchId_userId_minutesBefore_key" ON "MatchReminder"("matchId", "userId", "minutesBefore");

-- CreateIndex
CREATE INDEX "AutopilotLog_tournamentId_executedAt_idx" ON "AutopilotLog"("tournamentId", "executedAt");

-- CreateIndex
CREATE INDEX "AutopilotLog_action_status_idx" ON "AutopilotLog"("action", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Sector_name_key" ON "Sector"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Sector_code_key" ON "Sector"("code");

-- CreateIndex
CREATE INDEX "Sector_isActive_idx" ON "Sector"("isActive");

-- CreateIndex
CREATE INDEX "Zone_sectorId_isActive_idx" ON "Zone"("sectorId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Zone_code_sectorId_key" ON "Zone"("code", "sectorId");

-- CreateIndex
CREATE INDEX "AdminAssignment_adminRole_isActive_idx" ON "AdminAssignment"("adminRole", "isActive");

-- CreateIndex
CREATE INDEX "AdminAssignment_sport_adminRole_idx" ON "AdminAssignment"("sport", "adminRole");

-- CreateIndex
CREATE INDEX "AdminAssignment_stateCode_districtName_idx" ON "AdminAssignment"("stateCode", "districtName");

-- CreateIndex
CREATE UNIQUE INDEX "AdminAssignment_userId_sport_adminRole_stateCode_districtName_key" ON "AdminAssignment"("userId", "sport", "adminRole", "stateCode", "districtName");

-- CreateIndex
CREATE UNIQUE INDEX "AdminPermissions_assignmentId_key" ON "AdminPermissions"("assignmentId");

-- CreateIndex
CREATE INDEX "AdminEscalation_type_status_idx" ON "AdminEscalation"("type", "status");

-- CreateIndex
CREATE INDEX "AdminEscalation_currentLevel_status_idx" ON "AdminEscalation"("currentLevel", "status");

-- CreateIndex
CREATE INDEX "AdminEscalation_autoEscalateAt_idx" ON "AdminEscalation"("autoEscalateAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_assignmentId_actedAt_idx" ON "AdminAuditLog"("assignmentId", "actedAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_action_actedAt_idx" ON "AdminAuditLog"("action", "actedAt");

-- CreateIndex
CREATE INDEX "BoundaryChangeLog_changeType_createdAt_idx" ON "BoundaryChangeLog"("changeType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminMetrics_adminId_key" ON "AdminMetrics"("adminId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminMetrics_userId_key" ON "AdminMetrics"("userId");

-- CreateIndex
CREATE INDEX "AdminMetrics_trustScore_idx" ON "AdminMetrics"("trustScore");

-- CreateIndex
CREATE INDEX "Court_tournamentId_status_idx" ON "Court"("tournamentId", "status");

-- CreateIndex
CREATE INDEX "Court_status_isPriority_idx" ON "Court"("status", "isPriority");

-- CreateIndex
CREATE UNIQUE INDEX "Court_tournamentId_name_key" ON "Court"("tournamentId", "name");

-- CreateIndex
CREATE INDEX "MatchCheckIn_matchId_idx" ON "MatchCheckIn"("matchId");

-- CreateIndex
CREATE INDEX "MatchCheckIn_playerId_idx" ON "MatchCheckIn"("playerId");

-- CreateIndex
CREATE INDEX "MatchCheckIn_status_idx" ON "MatchCheckIn"("status");

-- CreateIndex
CREATE INDEX "MatchCheckIn_gracePeriodEnds_idx" ON "MatchCheckIn"("gracePeriodEnds");

-- CreateIndex
CREATE UNIQUE INDEX "MatchCheckIn_matchId_playerId_key" ON "MatchCheckIn"("matchId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "VenueFlowConfig_tournamentId_key" ON "VenueFlowConfig"("tournamentId");

-- CreateIndex
CREATE INDEX "CourtAssignment_courtId_assignedAt_idx" ON "CourtAssignment"("courtId", "assignedAt");

-- CreateIndex
CREATE INDEX "CourtAssignment_matchId_idx" ON "CourtAssignment"("matchId");

-- CreateIndex
CREATE INDEX "CourtAssignment_releasedAt_idx" ON "CourtAssignment"("releasedAt");

-- CreateIndex
CREATE INDEX "VenueFlowLog_tournamentId_createdAt_idx" ON "VenueFlowLog"("tournamentId", "createdAt");

-- CreateIndex
CREATE INDEX "VenueFlowLog_action_createdAt_idx" ON "VenueFlowLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "VenueFlowLog_matchId_idx" ON "VenueFlowLog"("matchId");

-- CreateIndex
CREATE INDEX "VenueFlowLog_courtId_idx" ON "VenueFlowLog"("courtId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchQueue_matchId_key" ON "MatchQueue"("matchId");

-- CreateIndex
CREATE INDEX "MatchQueue_tournamentId_position_idx" ON "MatchQueue"("tournamentId", "position");

-- CreateIndex
CREATE INDEX "MatchQueue_tournamentId_readiness_idx" ON "MatchQueue"("tournamentId", "readiness");

-- CreateIndex
CREATE INDEX "MatchQueue_tournamentId_status_idx" ON "MatchQueue"("tournamentId", "status");

-- CreateIndex
CREATE INDEX "VenueHealthAlert_tournamentId_isResolved_createdAt_idx" ON "VenueHealthAlert"("tournamentId", "isResolved", "createdAt");

-- CreateIndex
CREATE INDEX "VenueHealthAlert_alertType_severity_idx" ON "VenueHealthAlert"("alertType", "severity");

-- CreateIndex
CREATE INDEX "Subscription_userId_sport_idx" ON "Subscription"("userId", "sport");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE UNIQUE INDEX "OrgSubscription_orgId_key" ON "OrgSubscription"("orgId");

-- CreateIndex
CREATE INDEX "TournamentRegistration_userId_idx" ON "TournamentRegistration"("userId");

-- CreateIndex
CREATE INDEX "TournamentRegistration_status_idx" ON "TournamentRegistration"("status");

-- CreateIndex
CREATE INDEX "TournamentRegistration_tournamentId_status_idx" ON "TournamentRegistration"("tournamentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentRegistration_tournamentId_userId_key" ON "TournamentRegistration"("tournamentId", "userId");

-- CreateIndex
CREATE INDEX "OrgTournamentRegistration_orgId_idx" ON "OrgTournamentRegistration"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgTournamentRegistration_tournamentId_userId_key" ON "OrgTournamentRegistration"("tournamentId", "userId");

-- CreateIndex
CREATE INDEX "TournamentWaitlist_tournamentId_position_idx" ON "TournamentWaitlist"("tournamentId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentWaitlist_tournamentId_userId_key" ON "TournamentWaitlist"("tournamentId", "userId");

-- CreateIndex
CREATE INDEX "OrgRosterPlayer_orgId_isActive_idx" ON "OrgRosterPlayer"("orgId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "OrgRosterPlayer_userId_sport_key" ON "OrgRosterPlayer"("userId", "sport");

-- CreateIndex
CREATE INDEX "OrgRosterRequest_playerId_status_idx" ON "OrgRosterRequest"("playerId", "status");

-- CreateIndex
CREATE INDEX "OrgRosterRequest_orgId_status_idx" ON "OrgRosterRequest"("orgId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OrgRosterRequest_orgId_playerId_sport_key" ON "OrgRosterRequest"("orgId", "playerId", "sport");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerRating_userId_key" ON "PlayerRating"("userId");

-- CreateIndex
CREATE INDEX "RatingSnapshot_playerId_createdAt_idx" ON "RatingSnapshot"("playerId", "createdAt");

-- CreateIndex
CREATE INDEX "RatingSnapshot_sport_createdAt_idx" ON "RatingSnapshot"("sport", "createdAt");

-- CreateIndex
CREATE INDEX "PlayerAchievement_userId_sport_idx" ON "PlayerAchievement"("userId", "sport");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentStaff_tournamentId_userId_key" ON "TournamentStaff"("tournamentId", "userId");

-- CreateIndex
CREATE INDEX "PaymentLedger_userId_status_idx" ON "PaymentLedger"("userId", "status");

-- CreateIndex
CREATE INDEX "PaymentLedger_orgId_status_idx" ON "PaymentLedger"("orgId", "status");

-- CreateIndex
CREATE INDEX "PaymentLedger_tournamentId_status_idx" ON "PaymentLedger"("tournamentId", "status");

-- CreateIndex
CREATE INDEX "PaymentLedger_razorpayId_idx" ON "PaymentLedger"("razorpayId");

-- CreateIndex
CREATE INDEX "PaymentLedger_paymentMethod_status_idx" ON "PaymentLedger"("paymentMethod", "status");

-- CreateIndex
CREATE INDEX "PlayerAvailability_userId_sport_idx" ON "PlayerAvailability"("userId", "sport");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerAvailability_userId_sport_dayOfWeek_startTime_key" ON "PlayerAvailability"("userId", "sport", "dayOfWeek", "startTime");

-- CreateIndex
CREATE INDEX "BlockedPlayer_blockerId_idx" ON "BlockedPlayer"("blockerId");

-- CreateIndex
CREATE INDEX "BlockedPlayer_blockedId_idx" ON "BlockedPlayer"("blockedId");

-- CreateIndex
CREATE UNIQUE INDEX "BlockedPlayer_blockerId_blockedId_sport_key" ON "BlockedPlayer"("blockerId", "blockedId", "sport");

-- CreateIndex
CREATE UNIQUE INDEX "BadgeDefinition_sport_code_key" ON "BadgeDefinition"("sport", "code");

-- CreateIndex
CREATE INDEX "ActivityFeed_sport_createdAt_idx" ON "ActivityFeed"("sport", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityFeed_actorId_idx" ON "ActivityFeed"("actorId");

-- CreateIndex
CREATE INDEX "Conversation_sport_idx" ON "Conversation"("sport");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationParticipant_conversationId_userId_key" ON "ConversationParticipant"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "LeaderboardSnapshot_sport_dimension_rank_idx" ON "LeaderboardSnapshot"("sport", "dimension", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardSnapshot_sport_dimension_periodStart_userId_key" ON "LeaderboardSnapshot"("sport", "dimension", "periodStart", "userId");

-- CreateIndex
CREATE INDEX "Referral_referrerId_idx" ON "Referral"("referrerId");

-- CreateIndex
CREATE INDEX "Referral_code_idx" ON "Referral"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_refereeId_sport_key" ON "Referral"("refereeId", "sport");

-- CreateIndex
CREATE UNIQUE INDEX "OrgStatistics_orgId_key" ON "OrgStatistics"("orgId");

-- CreateIndex
CREATE INDEX "UserFollow_followerId_idx" ON "UserFollow"("followerId");

-- CreateIndex
CREATE INDEX "UserFollow_followingId_idx" ON "UserFollow"("followingId");

-- CreateIndex
CREATE UNIQUE INDEX "UserFollow_followerId_followingId_sport_key" ON "UserFollow"("followerId", "followingId", "sport");

-- CreateIndex
CREATE INDEX "UserFollowsOrg_userId_idx" ON "UserFollowsOrg"("userId");

-- CreateIndex
CREATE INDEX "UserFollowsOrg_orgId_idx" ON "UserFollowsOrg"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "UserFollowsOrg_userId_orgId_sport_key" ON "UserFollowsOrg"("userId", "orgId", "sport");

-- CreateIndex
CREATE INDEX "OrgFollowsUser_orgId_idx" ON "OrgFollowsUser"("orgId");

-- CreateIndex
CREATE INDEX "OrgFollowsUser_userId_idx" ON "OrgFollowsUser"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgFollowsUser_orgId_userId_sport_key" ON "OrgFollowsUser"("orgId", "userId", "sport");

-- CreateIndex
CREATE UNIQUE INDEX "EmailNotificationSetting_userId_sport_key" ON "EmailNotificationSetting"("userId", "sport");

-- CreateIndex
CREATE UNIQUE INDEX "EmailNotificationSetting_orgId_sport_key" ON "EmailNotificationSetting"("orgId", "sport");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppNotificationSetting_userId_sport_key" ON "WhatsAppNotificationSetting"("userId", "sport");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppNotificationSetting_orgId_sport_key" ON "WhatsAppNotificationSetting"("orgId", "sport");

-- CreateIndex
CREATE INDEX "Milestone_userId_sport_idx" ON "Milestone"("userId", "sport");

-- CreateIndex
CREATE INDEX "Milestone_orgId_sport_idx" ON "Milestone"("orgId", "sport");

-- CreateIndex
CREATE INDEX "Milestone_type_idx" ON "Milestone"("type");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_idempotencyKey_key" ON "WebhookEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WebhookEvent_provider_eventType_idx" ON "WebhookEvent"("provider", "eventType");

-- CreateIndex
CREATE INDEX "WebhookEvent_status_nextRetryAt_idx" ON "WebhookEvent"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_createdAt_idx" ON "WebhookEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

-- CreateIndex
CREATE INDEX "FeatureFlag_enabled_idx" ON "FeatureFlag"("enabled");

-- CreateIndex
CREATE INDEX "ContentReport_status_createdAt_idx" ON "ContentReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ContentReport_reportedUserId_idx" ON "ContentReport"("reportedUserId");

-- CreateIndex
CREATE INDEX "ContentReport_contentType_contentId_idx" ON "ContentReport"("contentType", "contentId");

-- CreateIndex
CREATE UNIQUE INDEX "ArchivedTournament_originalId_key" ON "ArchivedTournament"("originalId");

-- CreateIndex
CREATE INDEX "ArchivedTournament_sport_archivedAt_idx" ON "ArchivedTournament"("sport", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ArchivedMatch_originalId_key" ON "ArchivedMatch"("originalId");

-- CreateIndex
CREATE INDEX "ArchivedMatch_archivedTournamentId_idx" ON "ArchivedMatch"("archivedTournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerSearchIndex_userId_key" ON "PlayerSearchIndex"("userId");

-- CreateIndex
CREATE INDEX "PlayerSearchIndex_sport_visiblePoints_idx" ON "PlayerSearchIndex"("sport", "visiblePoints");

-- CreateIndex
CREATE INDEX "PlayerSearchIndex_sport_hiddenElo_idx" ON "PlayerSearchIndex"("sport", "hiddenElo");

-- CreateIndex
CREATE UNIQUE INDEX "SystemConfig_key_key" ON "SystemConfig"("key");

-- CreateIndex
CREATE INDEX "SystemConfig_key_idx" ON "SystemConfig"("key");

-- CreateIndex
CREATE INDEX "DeviceToken_userId_isActive_idx" ON "DeviceToken"("userId", "isActive");

-- CreateIndex
CREATE INDEX "DeviceToken_orgId_isActive_idx" ON "DeviceToken"("orgId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceToken_token_key" ON "DeviceToken"("token");

-- CreateIndex
CREATE INDEX "PushNotificationSetting_userId_idx" ON "PushNotificationSetting"("userId");

-- CreateIndex
CREATE INDEX "PushNotificationSetting_orgId_idx" ON "PushNotificationSetting"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "PushNotificationSetting_userId_sport_key" ON "PushNotificationSetting"("userId", "sport");

-- CreateIndex
CREATE UNIQUE INDEX "PushNotificationSetting_orgId_sport_key" ON "PushNotificationSetting"("orgId", "sport");

-- CreateIndex
CREATE INDEX "PushNotificationLog_userId_sentAt_idx" ON "PushNotificationLog"("userId", "sentAt");

-- CreateIndex
CREATE INDEX "PushNotificationLog_status_idx" ON "PushNotificationLog"("status");

-- CreateIndex
CREATE INDEX "PlayerContract_organizationId_status_idx" ON "PlayerContract"("organizationId", "status");

-- CreateIndex
CREATE INDEX "PlayerContract_playerId_status_idx" ON "PlayerContract"("playerId", "status");

-- CreateIndex
CREATE INDEX "PlayerContract_status_endDate_idx" ON "PlayerContract"("status", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerContract_playerId_organizationId_key" ON "PlayerContract"("playerId", "organizationId");

-- CreateIndex
CREATE INDEX "InterOrgTeamSelection_organizationId_idx" ON "InterOrgTeamSelection"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "InterOrgTeamSelection_tournamentId_organizationId_key" ON "InterOrgTeamSelection"("tournamentId", "organizationId");

-- CreateIndex
CREATE INDEX "InterOrgTeamPlayer_playerId_idx" ON "InterOrgTeamPlayer"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "InterOrgTeamPlayer_teamSelectionId_playerId_key" ON "InterOrgTeamPlayer"("teamSelectionId", "playerId");

-- CreateIndex
CREATE INDEX "PlayerIdVerification_organizationId_status_idx" ON "PlayerIdVerification"("organizationId", "status");

-- CreateIndex
CREATE INDEX "PlayerIdVerification_playerId_idx" ON "PlayerIdVerification"("playerId");

-- CreateIndex
CREATE INDEX "PlayerIdVerification_status_createdAt_idx" ON "PlayerIdVerification"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PlayerIdVerification_autoApproved_idx" ON "PlayerIdVerification"("autoApproved");

-- CreateIndex
CREATE INDEX "GdprConsent_userId_consentType_idx" ON "GdprConsent"("userId", "consentType");

-- CreateIndex
CREATE INDEX "GdprConsent_createdAt_idx" ON "GdprConsent"("createdAt");

-- CreateIndex
CREATE INDEX "TournamentTemplate_orgId_sport_idx" ON "TournamentTemplate"("orgId", "sport");

-- CreateIndex
CREATE INDEX "TournamentTemplate_orgId_createdAt_idx" ON "TournamentTemplate"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "TournamentTemplate_orgId_isActive_idx" ON "TournamentTemplate"("orgId", "isActive");

-- CreateIndex
CREATE INDEX "TournamentSeries_orgId_sport_idx" ON "TournamentSeries"("orgId", "sport");

-- CreateIndex
CREATE INDEX "TournamentSeries_sport_status_idx" ON "TournamentSeries"("sport", "status");

-- CreateIndex
CREATE INDEX "TournamentSeries_startDate_idx" ON "TournamentSeries"("startDate");

-- CreateIndex
CREATE INDEX "SeriesStanding_seriesId_rank_idx" ON "SeriesStanding"("seriesId", "rank");

-- CreateIndex
CREATE INDEX "SeriesStanding_seriesId_totalPoints_idx" ON "SeriesStanding"("seriesId", "totalPoints");

-- CreateIndex
CREATE UNIQUE INDEX "SeriesStanding_seriesId_userId_key" ON "SeriesStanding"("seriesId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "SeriesStanding_seriesId_teamId_key" ON "SeriesStanding"("seriesId", "teamId");

-- CreateIndex
CREATE INDEX "RecurringTournament_templateId_scheduledStartDate_idx" ON "RecurringTournament"("templateId", "scheduledStartDate");

-- CreateIndex
CREATE INDEX "RecurringTournament_status_scheduledStartDate_idx" ON "RecurringTournament"("status", "scheduledStartDate");

-- CreateIndex
CREATE INDEX "PlayerPerformanceTrend_userId_sport_periodStart_idx" ON "PlayerPerformanceTrend"("userId", "sport", "periodStart");

-- CreateIndex
CREATE INDEX "PlayerPerformanceTrend_sport_periodStart_idx" ON "PlayerPerformanceTrend"("sport", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerPerformanceTrend_userId_sport_periodType_periodStart_key" ON "PlayerPerformanceTrend"("userId", "sport", "periodType", "periodStart");

-- CreateIndex
CREATE INDEX "DartsScoringHeatmap_userId_periodStart_idx" ON "DartsScoringHeatmap"("userId", "periodStart");

-- CreateIndex
CREATE INDEX "DartsScoringHeatmap_userId_segment_ring_idx" ON "DartsScoringHeatmap"("userId", "segment", "ring");

-- CreateIndex
CREATE UNIQUE INDEX "DartsScoringHeatmap_userId_segment_ring_periodStart_key" ON "DartsScoringHeatmap"("userId", "segment", "ring", "periodStart");

-- CreateIndex
CREATE INDEX "CornholeScoringHeatmap_userId_periodStart_idx" ON "CornholeScoringHeatmap"("userId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "CornholeScoringHeatmap_userId_zone_periodStart_key" ON "CornholeScoringHeatmap"("userId", "zone", "periodStart");

-- CreateIndex
CREATE INDEX "PlayerFormIndicator_sport_currentForm_idx" ON "PlayerFormIndicator"("sport", "currentForm");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerFormIndicator_userId_sport_key" ON "PlayerFormIndicator"("userId", "sport");

-- CreateIndex
CREATE INDEX "HeadToHeadRecord_playerAId_sport_idx" ON "HeadToHeadRecord"("playerAId", "sport");

-- CreateIndex
CREATE INDEX "HeadToHeadRecord_playerBId_sport_idx" ON "HeadToHeadRecord"("playerBId", "sport");

-- CreateIndex
CREATE UNIQUE INDEX "HeadToHeadRecord_playerAId_playerBId_sport_key" ON "HeadToHeadRecord"("playerAId", "playerBId", "sport");

-- CreateIndex
CREATE INDEX "TournamentMediaItem_tournamentId_type_idx" ON "TournamentMediaItem"("tournamentId", "type");

-- CreateIndex
CREATE INDEX "TournamentMediaItem_tournamentId_category_idx" ON "TournamentMediaItem"("tournamentId", "category");

-- CreateIndex
CREATE INDEX "TournamentMediaItem_sport_uploadedAt_idx" ON "TournamentMediaItem"("sport", "uploadedAt");

-- CreateIndex
CREATE INDEX "TournamentMediaItem_matchId_idx" ON "TournamentMediaItem"("matchId");

-- CreateIndex
CREATE INDEX "VideoHighlight_tournamentId_status_idx" ON "VideoHighlight"("tournamentId", "status");

-- CreateIndex
CREATE INDEX "VideoHighlight_matchId_idx" ON "VideoHighlight"("matchId");

-- CreateIndex
CREATE INDEX "VideoHighlight_sport_createdAt_idx" ON "VideoHighlight"("sport", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentRecap_tournamentId_key" ON "TournamentRecap"("tournamentId");

-- CreateIndex
CREATE INDEX "TournamentRecap_sport_publishedAt_idx" ON "TournamentRecap"("sport", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShareableResultCard_shareUrl_key" ON "ShareableResultCard"("shareUrl");

-- CreateIndex
CREATE UNIQUE INDEX "ShareableResultCard_shortCode_key" ON "ShareableResultCard"("shortCode");

-- CreateIndex
CREATE INDEX "ShareableResultCard_userId_cardType_idx" ON "ShareableResultCard"("userId", "cardType");

-- CreateIndex
CREATE INDEX "ShareableResultCard_tournamentId_idx" ON "ShareableResultCard"("tournamentId");

-- CreateIndex
CREATE INDEX "ShareableResultCard_sport_createdAt_idx" ON "ShareableResultCard"("sport", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShortUrlRedirect_shortCode_key" ON "ShortUrlRedirect"("shortCode");

-- CreateIndex
CREATE INDEX "ShortUrlRedirect_targetType_targetId_idx" ON "ShortUrlRedirect"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "ShortUrlRedirect_shortCode_idx" ON "ShortUrlRedirect"("shortCode");

-- CreateIndex
CREATE INDEX "SuspendedIdentity_identifier_idx" ON "SuspendedIdentity"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "SuspendedIdentity_identifier_identifierType_key" ON "SuspendedIdentity"("identifier", "identifierType");

-- CreateIndex
CREATE UNIQUE INDEX "EloJob_matchId_key" ON "EloJob"("matchId");

-- CreateIndex
CREATE INDEX "EloJob_status_createdAt_idx" ON "EloJob"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentSnapshot_tournamentId_key" ON "TournamentSnapshot"("tournamentId");

-- CreateIndex
CREATE INDEX "TournamentSnapshot_sport_capturedAt_idx" ON "TournamentSnapshot"("sport", "capturedAt");

-- CreateIndex
CREATE INDEX "TournamentSnapshot_tournamentId_idx" ON "TournamentSnapshot"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "FinalizationWindow_tournamentId_key" ON "FinalizationWindow"("tournamentId");

-- CreateIndex
CREATE INDEX "FinalizationWindow_status_windowEndsAt_idx" ON "FinalizationWindow"("status", "windowEndsAt");

-- CreateIndex
CREATE INDEX "FinalizationWindow_sport_status_idx" ON "FinalizationWindow"("sport", "status");

-- CreateIndex
CREATE INDEX "TournamentDispute_tournamentId_status_idx" ON "TournamentDispute"("tournamentId", "status");

-- CreateIndex
CREATE INDEX "TournamentDispute_raisedById_idx" ON "TournamentDispute"("raisedById");

-- CreateIndex
CREATE INDEX "TournamentDispute_status_createdAt_idx" ON "TournamentDispute"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TournamentCompletionLog_tournamentId_executedAt_idx" ON "TournamentCompletionLog"("tournamentId", "executedAt");

-- CreateIndex
CREATE INDEX "TournamentCompletionLog_action_status_idx" ON "TournamentCompletionLog"("action", "status");

-- CreateIndex
CREATE INDEX "TournamentStateLog_tournamentId_createdAt_idx" ON "TournamentStateLog"("tournamentId", "createdAt");

-- CreateIndex
CREATE INDEX "TournamentStateLog_sport_createdAt_idx" ON "TournamentStateLog"("sport", "createdAt");

-- CreateIndex
CREATE INDEX "TournamentStateLog_fromState_toState_idx" ON "TournamentStateLog"("fromState", "toState");

-- CreateIndex
CREATE INDEX "RecognitionAward_recipientId_recipientType_isActive_idx" ON "RecognitionAward"("recipientId", "recipientType", "isActive");

-- CreateIndex
CREATE INDEX "RecognitionAward_sport_recognitionType_isActive_idx" ON "RecognitionAward"("sport", "recognitionType", "isActive");

-- CreateIndex
CREATE INDEX "RecognitionAward_tournamentId_idx" ON "RecognitionAward"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerCompletionStats_playerId_key" ON "PlayerCompletionStats"("playerId");

-- CreateIndex
CREATE INDEX "PlayerCompletionStats_sport_tournamentsWon_idx" ON "PlayerCompletionStats"("sport", "tournamentsWon");

-- CreateIndex
CREATE INDEX "PlayerCompletionStats_sport_trustScore_idx" ON "PlayerCompletionStats"("sport", "trustScore");

-- CreateIndex
CREATE UNIQUE INDEX "RefundPolicy_tournamentId_key" ON "RefundPolicy"("tournamentId");

-- CreateIndex
CREATE INDEX "RefundPolicy_tournamentId_idx" ON "RefundPolicy"("tournamentId");

-- CreateIndex
CREATE INDEX "RefundPolicy_refundMode_idx" ON "RefundPolicy"("refundMode");

-- CreateIndex
CREATE INDEX "RefundJob_tournamentId_status_idx" ON "RefundJob"("tournamentId", "status");

-- CreateIndex
CREATE INDEX "RefundJob_status_nextRetryAt_idx" ON "RefundJob"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "RefundJob_razorpayPaymentId_idx" ON "RefundJob"("razorpayPaymentId");

-- CreateIndex
CREATE INDEX "PaymentRecovery_status_nextAttemptAt_idx" ON "PaymentRecovery"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "PaymentRecovery_razorpayPaymentId_idx" ON "PaymentRecovery"("razorpayPaymentId");

-- CreateIndex
CREATE INDEX "PaymentRecovery_registrationId_idx" ON "PaymentRecovery"("registrationId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentFinanceSnapshot_tournamentId_key" ON "TournamentFinanceSnapshot"("tournamentId");

-- CreateIndex
CREATE INDEX "TournamentFinanceSnapshot_sport_capturedAt_idx" ON "TournamentFinanceSnapshot"("sport", "capturedAt");

-- CreateIndex
CREATE INDEX "TournamentFinanceSnapshot_reconciliationStatus_idx" ON "TournamentFinanceSnapshot"("reconciliationStatus");

-- CreateIndex
CREATE INDEX "CancellationLog_tournamentId_idx" ON "CancellationLog"("tournamentId");

-- CreateIndex
CREATE INDEX "CancellationLog_cancelledAt_idx" ON "CancellationLog"("cancelledAt");

-- CreateIndex
CREATE INDEX "AdminAvailability_userId_currentStatus_idx" ON "AdminAvailability"("userId", "currentStatus");

-- CreateIndex
CREATE INDEX "AdminAvailability_currentStatus_idx" ON "AdminAvailability"("currentStatus");

-- CreateIndex
CREATE UNIQUE INDEX "AdminAvailability_adminId_dayOfWeek_key" ON "AdminAvailability"("adminId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "DirectorAssignmentRule_sport_stateCode_districtName_idx" ON "DirectorAssignmentRule"("sport", "stateCode", "districtName");

-- CreateIndex
CREATE INDEX "DirectorAssignmentRule_isActive_idx" ON "DirectorAssignmentRule"("isActive");

-- CreateIndex
CREATE INDEX "AdminInactivityFlag_status_daysInactive_idx" ON "AdminInactivityFlag"("status", "daysInactive");

-- CreateIndex
CREATE INDEX "AdminInactivityFlag_userId_idx" ON "AdminInactivityFlag"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminInactivityFlag_adminId_key" ON "AdminInactivityFlag"("adminId");

-- CreateIndex
CREATE INDEX "RegionLoadMetric_userId_periodStart_idx" ON "RegionLoadMetric"("userId", "periodStart");

-- CreateIndex
CREATE INDEX "RegionLoadMetric_currentLoadPercent_idx" ON "RegionLoadMetric"("currentLoadPercent");

-- CreateIndex
CREATE UNIQUE INDEX "RegionLoadMetric_adminId_periodStart_key" ON "RegionLoadMetric"("adminId", "periodStart");

-- CreateIndex
CREATE INDEX "EmergencyControlLog_status_triggeredAt_idx" ON "EmergencyControlLog"("status", "triggeredAt");

-- CreateIndex
CREATE INDEX "EmergencyControlLog_originalRole_originalStateCode_idx" ON "EmergencyControlLog"("originalRole", "originalStateCode");

-- CreateIndex
CREATE INDEX "EmergencyControlLog_assumingAdminId_idx" ON "EmergencyControlLog"("assumingAdminId");

-- CreateIndex
CREATE INDEX "AutoDirectorAssignmentLog_tournamentId_idx" ON "AutoDirectorAssignmentLog"("tournamentId");

-- CreateIndex
CREATE INDEX "AutoDirectorAssignmentLog_selectedAdminId_idx" ON "AutoDirectorAssignmentLog"("selectedAdminId");

-- CreateIndex
CREATE INDEX "AutoDirectorAssignmentLog_assignedAt_idx" ON "AutoDirectorAssignmentLog"("assignedAt");

-- CreateIndex
CREATE INDEX "Employee_orgId_isActive_idx" ON "Employee"("orgId", "isActive");

-- CreateIndex
CREATE INDEX "Employee_email_sport_idx" ON "Employee"("email", "sport");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_orgId_email_sport_key" ON "Employee"("orgId", "email", "sport");

-- CreateIndex
CREATE INDEX "EmployeeInvitation_orgId_status_idx" ON "EmployeeInvitation"("orgId", "status");

-- CreateIndex
CREATE INDEX "EmployeeInvitation_employeeId_status_idx" ON "EmployeeInvitation"("employeeId", "status");

-- CreateIndex
CREATE INDEX "EmployeeInvitation_status_expiresAt_idx" ON "EmployeeInvitation"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeInvitation_tournamentId_employeeId_key" ON "EmployeeInvitation"("tournamentId", "employeeId");

-- CreateIndex
CREATE INDEX "EmployeeTournamentParticipation_tournamentId_idx" ON "EmployeeTournamentParticipation"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeTournamentParticipation_employeeId_tournamentId_key" ON "EmployeeTournamentParticipation"("employeeId", "tournamentId");

-- CreateIndex
CREATE INDEX "RepSquad_orgId_sport_status_idx" ON "RepSquad"("orgId", "sport", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RepSquad_orgId_sport_name_key" ON "RepSquad"("orgId", "sport", "name");

-- CreateIndex
CREATE INDEX "RepPlayer_squadId_status_idx" ON "RepPlayer"("squadId", "status");

-- CreateIndex
CREATE INDEX "RepPlayer_userId_idx" ON "RepPlayer"("userId");

-- CreateIndex
CREATE INDEX "RepPlayer_playerType_status_idx" ON "RepPlayer"("playerType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RepPlayer_squadId_userId_key" ON "RepPlayer"("squadId", "userId");

-- CreateIndex
CREATE INDEX "RepSquadTournamentRegistration_tournamentId_status_idx" ON "RepSquadTournamentRegistration"("tournamentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RepSquadTournamentRegistration_squadId_tournamentId_key" ON "RepSquadTournamentRegistration"("squadId", "tournamentId");

-- CreateIndex
CREATE INDEX "SchoolClass_orgId_isActive_idx" ON "SchoolClass"("orgId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolClass_orgId_gradeLevel_sport_key" ON "SchoolClass"("orgId", "gradeLevel", "sport");

-- CreateIndex
CREATE INDEX "SchoolSection_orgId_isActive_idx" ON "SchoolSection"("orgId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolSection_classId_name_key" ON "SchoolSection"("classId", "name");

-- CreateIndex
CREATE INDEX "SchoolHouse_orgId_isActive_idx" ON "SchoolHouse"("orgId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolHouse_orgId_name_sport_key" ON "SchoolHouse"("orgId", "name", "sport");

-- CreateIndex
CREATE INDEX "CollegeDepartment_orgId_isActive_idx" ON "CollegeDepartment"("orgId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CollegeDepartment_orgId_name_sport_key" ON "CollegeDepartment"("orgId", "name", "sport");

-- CreateIndex
CREATE INDEX "CollegeBatch_orgId_isActive_idx" ON "CollegeBatch"("orgId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CollegeBatch_departmentId_startYear_key" ON "CollegeBatch"("departmentId", "startYear");

-- CreateIndex
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");

-- CreateIndex
CREATE INDEX "Student_orgId_status_idx" ON "Student"("orgId", "status");

-- CreateIndex
CREATE INDEX "Student_orgId_studentType_idx" ON "Student"("orgId", "studentType");

-- CreateIndex
CREATE INDEX "Student_email_sport_idx" ON "Student"("email", "sport");

-- CreateIndex
CREATE UNIQUE INDEX "Student_orgId_email_sport_key" ON "Student"("orgId", "email", "sport");

-- CreateIndex
CREATE INDEX "SchoolTeam_orgId_sport_status_idx" ON "SchoolTeam"("orgId", "sport", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolTeam_orgId_sport_name_key" ON "SchoolTeam"("orgId", "sport", "name");

-- CreateIndex
CREATE INDEX "CollegeTeam_orgId_sport_status_idx" ON "CollegeTeam"("orgId", "sport", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CollegeTeam_orgId_sport_name_key" ON "CollegeTeam"("orgId", "sport", "name");

-- CreateIndex
CREATE INDEX "AcademicTeamMember_teamId_isActive_idx" ON "AcademicTeamMember"("teamId", "isActive");

-- CreateIndex
CREATE INDEX "AcademicTeamMember_teamType_teamId_idx" ON "AcademicTeamMember"("teamType", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicTeamMember_studentId_teamId_key" ON "AcademicTeamMember"("studentId", "teamId");

-- CreateIndex
CREATE INDEX "AcademicTeamRegistration_tournamentId_status_idx" ON "AcademicTeamRegistration"("tournamentId", "status");

-- CreateIndex
CREATE INDEX "AcademicTeamRegistration_teamType_teamId_idx" ON "AcademicTeamRegistration"("teamType", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicTeamRegistration_teamId_teamType_tournamentId_key" ON "AcademicTeamRegistration"("teamId", "teamType", "tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerSkillMetrics_userId_key" ON "PlayerSkillMetrics"("userId");

-- CreateIndex
CREATE INDEX "PlayerSkillMetrics_sport_idx" ON "PlayerSkillMetrics"("sport");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerStreak_userId_key" ON "PlayerStreak"("userId");

-- CreateIndex
CREATE INDEX "PlayerStreak_sport_currentWinStreak_idx" ON "PlayerStreak"("sport", "currentWinStreak");

-- CreateIndex
CREATE INDEX "PlayerActivityFeedItem_userId_createdAt_idx" ON "PlayerActivityFeedItem"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PlayerActivityFeedItem_userId_isRead_idx" ON "PlayerActivityFeedItem"("userId", "isRead");

-- CreateIndex
CREATE INDEX "PlayerActivityFeedItem_userId_type_idx" ON "PlayerActivityFeedItem"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "FriendActivity_userId_key" ON "FriendActivity"("userId");

-- CreateIndex
CREATE INDEX "FriendActivity_sport_status_idx" ON "FriendActivity"("sport", "status");

-- CreateIndex
CREATE INDEX "FriendActivity_lookingForTeam_idx" ON "FriendActivity"("lookingForTeam");

-- CreateIndex
CREATE INDEX "PlayerTrophy_userId_sport_idx" ON "PlayerTrophy"("userId", "sport");

-- CreateIndex
CREATE INDEX "PlayerTrophy_userId_isFeatured_idx" ON "PlayerTrophy"("userId", "isFeatured");

-- CreateIndex
CREATE INDEX "PlayerTrophy_userId_earnedAt_idx" ON "PlayerTrophy"("userId", "earnedAt");

-- CreateIndex
CREATE INDEX "QuickTeamRequest_sport_status_expiresAt_idx" ON "QuickTeamRequest"("sport", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "QuickTeamRequest_tournamentId_status_idx" ON "QuickTeamRequest"("tournamentId", "status");

-- CreateIndex
CREATE INDEX "PlayerTournamentRecommendation_userId_isDismissed_createdAt_idx" ON "PlayerTournamentRecommendation"("userId", "isDismissed", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerTournamentRecommendation_userId_tournamentId_key" ON "PlayerTournamentRecommendation"("userId", "tournamentId");

-- CreateIndex
CREATE INDEX "HeroSlide_sport_isActive_displayOrder_idx" ON "HeroSlide"("sport", "isActive", "displayOrder");

-- CreateIndex
CREATE INDEX "HeroSlide_sport_startDate_endDate_idx" ON "HeroSlide"("sport", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "TournamentGalleryImage_tournamentId_isActive_displayOrder_idx" ON "TournamentGalleryImage"("tournamentId", "isActive", "displayOrder");

-- CreateIndex
CREATE INDEX "TournamentGalleryImage_sport_isFeatured_idx" ON "TournamentGalleryImage"("sport", "isFeatured");

-- CreateIndex
CREATE INDEX "TournamentGalleryImage_category_idx" ON "TournamentGalleryImage"("category");

-- CreateIndex
CREATE INDEX "PlayerSpotlightImage_playerId_isActive_displayOrder_idx" ON "PlayerSpotlightImage"("playerId", "isActive", "displayOrder");

-- CreateIndex
CREATE INDEX "PlayerSpotlightImage_sport_isFeatured_idx" ON "PlayerSpotlightImage"("sport", "isFeatured");

-- CreateIndex
CREATE INDEX "MediaCollection_sport_isActive_displayOrder_idx" ON "MediaCollection"("sport", "isActive", "displayOrder");

-- CreateIndex
CREATE INDEX "MediaCollectionItem_collectionId_displayOrder_idx" ON "MediaCollectionItem"("collectionId", "displayOrder");

-- CreateIndex
CREATE INDEX "DuelVenue_sport_city_isActive_idx" ON "DuelVenue"("sport", "city", "isActive");

-- CreateIndex
CREATE INDEX "DuelVenue_city_isDuelEligible_idx" ON "DuelVenue"("city", "isDuelEligible");

-- CreateIndex
CREATE UNIQUE INDEX "DuelVenueSlot_duelMatchId_key" ON "DuelVenueSlot"("duelMatchId");

-- CreateIndex
CREATE INDEX "DuelVenueSlot_venueId_date_status_idx" ON "DuelVenueSlot"("venueId", "date", "status");

-- CreateIndex
CREATE INDEX "DuelVenueSlot_status_date_idx" ON "DuelVenueSlot"("status", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DuelVenueSlot_venueId_date_startTime_key" ON "DuelVenueSlot"("venueId", "date", "startTime");

-- CreateIndex
CREATE INDEX "DuelMatch_sport_city_status_idx" ON "DuelMatch"("sport", "city", "status");

-- CreateIndex
CREATE INDEX "DuelMatch_hostId_status_idx" ON "DuelMatch"("hostId", "status");

-- CreateIndex
CREATE INDEX "DuelMatch_status_scheduledStart_idx" ON "DuelMatch"("status", "scheduledStart");

-- CreateIndex
CREATE INDEX "DuelMatch_city_isPublic_status_idx" ON "DuelMatch"("city", "isPublic", "status");

-- CreateIndex
CREATE INDEX "DuelRegistration_duelMatchId_paymentStatus_idx" ON "DuelRegistration"("duelMatchId", "paymentStatus");

-- CreateIndex
CREATE INDEX "DuelRegistration_userId_paymentStatus_idx" ON "DuelRegistration"("userId", "paymentStatus");

-- CreateIndex
CREATE UNIQUE INDEX "DuelRegistration_duelMatchId_userId_key" ON "DuelRegistration"("duelMatchId", "userId");

-- CreateIndex
CREATE INDEX "CityDuelLeaderboard_city_sport_period_isActive_idx" ON "CityDuelLeaderboard"("city", "sport", "period", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CityDuelLeaderboard_city_sport_period_startDate_key" ON "CityDuelLeaderboard"("city", "sport", "period", "startDate");

-- CreateIndex
CREATE INDEX "CityDuelEntry_leaderboardId_rank_idx" ON "CityDuelEntry"("leaderboardId", "rank");

-- CreateIndex
CREATE INDEX "CityDuelEntry_userId_idx" ON "CityDuelEntry"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CityDuelEntry_leaderboardId_userId_key" ON "CityDuelEntry"("leaderboardId", "userId");

-- CreateIndex
CREATE INDEX "Translation_category_idx" ON "Translation"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Translation_key_key" ON "Translation"("key");

-- CreateIndex
CREATE UNIQUE INDEX "SupportedLanguage_code_key" ON "SupportedLanguage"("code");

-- CreateIndex
CREATE INDEX "SupportedLanguage_isActive_idx" ON "SupportedLanguage"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_key_key" ON "IdempotencyKey"("key");

-- CreateIndex
CREATE INDEX "IdempotencyKey_key_idx" ON "IdempotencyKey"("key");

-- CreateIndex
CREATE INDEX "IdempotencyKey_resourceType_resourceId_idx" ON "IdempotencyKey"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "MatchEvent_eventId_key" ON "MatchEvent"("eventId");

-- CreateIndex
CREATE INDEX "MatchEvent_matchId_idx" ON "MatchEvent"("matchId");

-- CreateIndex
CREATE INDEX "MatchEvent_eventId_idx" ON "MatchEvent"("eventId");

-- CreateIndex
CREATE INDEX "MatchEvent_processedAt_idx" ON "MatchEvent"("processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MatchEvent_matchId_eventId_key" ON "MatchEvent"("matchId", "eventId");

