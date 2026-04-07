# Prisma Schema Optimization Analysis

## Current State
- **Total Lines:** 5,705
- **Total Models:** 164
- **Total Enums:** 63
- **Complexity:** Very High

## Executive Summary

The VALORHIVE schema has grown to 164 models over multiple version iterations (v3.26 through v3.73). This growth reflects a comprehensive tournament platform but has introduced significant complexity. This document analyzes the schema structure and provides actionable recommendations for optimization without breaking functionality.

---

## Model Categories

### 1. Core Business Models (42 models)
*Essential for platform operation - Keep as-is*

| Model | Purpose | Optimization Notes |
|-------|---------|-------------------|
| `User` | Player accounts | Already well-structured, 115+ fields |
| `Organization` | Club/School/Corporate entities | Core entity |
| `Tournament` | Tournament management | Core entity |
| `Match` | Match results and scoring | Core entity |
| `Bracket` / `BracketMatch` | Tournament bracket management | Core entity |
| `TournamentRegistration` | Player tournament entries | Core entity |
| `OrgRosterPlayer` / `OrgRosterRequest` | Organization roster management | Core entity |
| `Subscription` / `OrgSubscription` | Subscription management | Core entity |
| `PaymentLedger` | Payment tracking | Core entity |
| `Session` | User sessions | Core entity |
| `SportRules` | Sport-specific point rules | Core entity |

**Recommendation:** These models are essential and should remain as separate tables. Consider adding composite indexes for common query patterns.

### 2. Team/Doubles Models (6 models)
*Support for doubles and team tournaments*

| Model | Purpose |
|-------|---------|
| `Team` | Doubles/Team entity |
| `TeamMember` | Team membership |
| `TeamInvitation` | Partner invitations |
| `TournamentTeam` | Team tournament registration |

**Recommendation:** Keep as-is. Team functionality requires separate tables for proper normalization.

### 3. Archive/Historical Models (5 models)
*Historical data storage*

| Model | Purpose | Recommendation |
|-------|---------|----------------|
| `ArchivedTournament` | Archived tournament data | Move to separate archive database |
| `ArchivedMatch` | Archived match data | Move to separate archive database |
| `TournamentSnapshot` | Immutable tournament records | Move to separate archive database |
| `LeaderboardSnapshot` | Historical leaderboard data | Consider time-series database |
| `PlayerPerformanceTrend` | Historical performance data | Consider time-series database |

**Recommendation:** Archive models should be moved to a separate read-only database after 2 years (per retention policy). This reduces main database size and improves query performance.

### 4. Analytics/Reporting Models (18 models)
*Business intelligence and metrics*

| Model | Purpose | Optimization |
|-------|---------|--------------|
| `AdminMetrics` | Admin performance tracking | Keep |
| `RegionLoadMetric` | Admin workload balancing | Consider aggregation |
| `TournamentFinanceSnapshot` | Financial records | Keep - compliance requirement |
| `PlayerCompletionStats` | Tournament completion stats | Can be derived/aggregated |
| `PlayerSkillMetrics` | Skill radar chart data | Could use JSONB |
| `PlayerFormIndicator` | Form tracking | Could use JSONB |
| `HeadToHeadRecord` | Head-to-head stats | Could use JSONB |
| `DartsScoringHeatmap` | Darts analytics | Consider time-series |
| `CornholeScoringHeatmap` | Cornhole analytics | Consider time-series |

**Recommendation:** 
- Heatmap models could benefit from a time-series database (InfluxDB, TimescaleDB)
- Form indicators and skill metrics could be consolidated into a single JSONB field

### 5. Notification Models (11 models)
*Notification delivery and preferences*

| Model | Purpose | Optimization |
|-------|---------|--------------|
| `Notification` | In-app notifications | Keep |
| `NotificationPreference` | Legacy preferences | Consolidate with settings below |
| `TournamentReminder` | Tournament reminders | Keep |
| `MatchReminder` | Match reminders | Keep |
| `EmailNotificationSetting` | Email preferences | Could use JSONB |
| `WhatsAppNotificationSetting` | WhatsApp preferences | Could use JSONB |
| `PushNotificationSetting` | Push preferences | Could use JSONB |
| `DeviceToken` | FCM/APNs tokens | Keep |
| `PushNotificationLog` | Notification tracking | Archive after 30 days |

**Recommendation:** 
- Merge `EmailNotificationSetting`, `WhatsAppNotificationSetting`, `PushNotificationSetting` into a single `NotificationSettings` model with JSONB fields
- Archive `PushNotificationLog` entries after 30 days

### 6. Admin/Governance Models (19 models)
*Administrative hierarchy and control*

| Model | Purpose | Notes |
|-------|---------|-------|
| `AdminAssignment` | Admin role assignments | Core governance |
| `AdminPermissions` | Granular permissions | Keep |
| `AdminAuditLog` | Admin action tracking | Compliance requirement |
| `AdminEscalation` | Escalation chain | Keep |
| `AdminMetrics` | Admin performance | Keep |
| `AdminAvailability` | Admin schedule | Keep |
| `AdminInactivityFlag` | Inactivity tracking | Keep |
| `Sector` / `Zone` | Geographic hierarchy | Keep |
| `BoundaryChangeLog` | Boundary changes | Keep |
| `EmergencyControlLog` | Emergency transfers | Keep |
| `DirectorMagicLink` / `DirectorSession` | Director access | Keep |
| `DirectorAssignmentRule` | Auto-assignment rules | Keep |
| `AutoDirectorAssignmentLog` | Assignment logging | Keep |

**Recommendation:** These models support the complex admin hierarchy (v3.46+) and should remain. Consider index optimization for geographic queries.

### 7. Venue Flow Models (9 models)
*Venue management (v3.47.0)*

| Model | Purpose |
|-------|---------|
| `Court` | Court/board management |
| `CourtAssignment` | Court assignment history |
| `MatchCheckIn` | Player check-in tracking |
| `MatchQueue` | Match queuing system |
| `VenueFlowConfig` | Per-tournament settings |
| `VenueFlowLog` | Venue action audit |
| `VenueHealthAlert` | Venue alerts |

**Recommendation:** Well-structured for venue management. `VenueFlowLog` should be archived after tournament completion.

### 8. Financial Safety Models (5 models)
*Refund and payment processing (v3.49.0)*

| Model | Purpose |
|-------|---------|
| `RefundPolicy` | Refund configuration |
| `RefundJob` | Refund processing queue |
| `PaymentRecovery` | Failed webhook recovery |
| `TournamentFinanceSnapshot` | Financial records |
| `CancellationLog` | Cancellation tracking |

**Recommendation:** Essential for financial compliance. Keep all models. Archive `RefundJob` and `PaymentRecovery` after 1 year.

### 9. Completion & Trust Models (6 models)
*Tournament finalization (v3.48.0)*

| Model | Purpose |
|-------|---------|
| `TournamentSnapshot` | Immutable results |
| `FinalizationWindow` | Dispute window tracking |
| `TournamentDispute` | Result disputes |
| `TournamentCompletionLog` | Completion audit |
| `RecognitionAward` | Title/achievement awards |
| `PlayerCompletionStats` | Player completion stats |

**Recommendation:** Essential for result integrity. `TournamentCompletionLog` can be archived after tournament finalization.

### 10. Corporate/School Mode Models (18 models)
*Organization-specific features (v3.54.0, v3.55.0)*

| Model | Purpose | Notes |
|-------|---------|-------|
| `Employee` | Employee records | Corporate mode |
| `EmployeeInvitation` | Tournament invitations | Corporate mode |
| `EmployeeTournamentParticipation` | Employee participation | Corporate mode |
| `RepSquad` | Competitive squads | Corporate mode |
| `RepPlayer` | Squad members | Corporate mode |
| `RepSquadTournamentRegistration` | Squad registrations | Corporate mode |
| `SchoolClass` / `SchoolSection` / `SchoolHouse` | School structure | School mode |
| `CollegeDepartment` / `CollegeBatch` | College structure | College mode |
| `Student` | Student records | School/College mode |
| `SchoolTeam` / `CollegeTeam` | Academic teams | School/College mode |
| `AcademicTeamMember` | Team membership | School/College mode |
| `AcademicTeamRegistration` | Team registrations | School/College mode |

**Recommendation:** These models are only needed for SCHOOL/COLLEGE/ CORPORATE organization types. Consider conditional schema or schema-per-tenant for large deployments.

### 11. Media Infrastructure Models (8 models)
*Media management (v3.72.0)*

| Model | Purpose |
|-------|---------|
| `HeroSlide` | Homepage carousel |
| `TournamentGalleryImage` | Tournament photos |
| `PlayerSpotlightImage` | Featured player images |
| `MediaCollection` / `MediaCollectionItem` | Grouped galleries |
| `TournamentMedia` / `TournamentMediaItem` | Tournament media |
| `VideoHighlight` | Video clips |
| `TournamentRecap` | Tournament recaps |
| `ShareableResultCard` | Social sharing |

**Recommendation:** Consider moving media metadata to object storage (S3) metadata or a dedicated media service for large-scale deployments.

### 12. Duel Mode Models (7 models)
*Local competitive matches (v3.73.0)*

| Model | Purpose |
|-------|---------|
| `DuelVenue` | Duel venues |
| `DuelVenueSlot` | Venue booking slots |
| `DuelMatch` | Duel matches |
| `DuelRegistration` | Duel registrations |
| `CityDuelLeaderboard` / `CityDuelEntry` | City leaderboards |

**Recommendation:** Well-structured for duel functionality. Consider archiving completed duels after 1 year.

### 13. Social/Messaging Models (9 models)
*Social features and communication*

| Model | Purpose |
|-------|---------|
| `Conversation` / `ConversationParticipant` / `Message` | In-app messaging |
| `UserFollow` / `UserFollowsOrg` / `OrgFollowsUser` | Follow system |
| `BlockedPlayer` | Player blocking |
| `PlayerAvailability` | Availability calendar |
| `ActivityFeed` | Activity feed |
| `FriendActivity` | Friend status |
| `Referral` | Referral system |

**Recommendation:** `Message` model can grow rapidly. Consider message retention policy and archiving. BlockedPlayer could be consolidated with a JSONB field in User preferences.

### 14. System/Configuration Models (8 models)
*Platform configuration*

| Model | Purpose |
|-------|---------|
| `SystemConfig` | Platform settings |
| `FeatureFlag` | Feature toggles |
| `WebhookEvent` | Webhook processing |
| `EloJob` | ELO calculation queue |
| `SuspendedIdentity` | Cross-sport bans |
| `ShortUrlRedirect` | URL shortening |
| `Translation` / `SupportedLanguage` | i18n support |

**Recommendation:** Keep as-is. These are low-volume configuration tables.

### 15. Player Experience Models (10 models)
*Enhanced player features (v3.71.0)*

| Model | Purpose | Optimization |
|-------|---------|--------------|
| `PlayerSkillMetrics` | Skill radar | Could merge with User |
| `PlayerStreak` | Streak tracking | Could merge with PlayerRating |
| `PlayerActivityFeedItem` | Activity feed | Archive after 90 days |
| `FriendActivity` | Friend status | Keep |
| `PlayerTrophy` | Trophy cabinet | Keep |
| `QuickTeamRequest` | Team finder | Keep |
| `PlayerTournamentRecommendation` | Recommendations | Can be regenerated |

**Recommendation:** `PlayerActivityFeedItem` should have a 90-day retention policy. Tournament recommendations can be purged and regenerated.

---

## Overlapping/Duplicate Models

### Potential Consolidation Opportunities

| Models | Overlap | Recommendation |
|--------|---------|----------------|
| `PrizePayout` vs `PrizePayoutRecord` | Similar purpose | Consolidate into single model with status tracking |
| `TournamentMedia` vs `TournamentMediaItem` | Media storage | Consolidate into single model with `type` field |
| `NotificationPreference` vs `EmailNotificationSetting` etc. | Notification settings | Consolidate into single `NotificationSettings` with JSONB |
| `PlayerRating` vs `PlayerSkillMetrics` vs `PlayerFormIndicator` | Player stats | Consider merging into unified `PlayerStats` model |

---

## Index Optimization Recommendations

### High-Priority Composite Indexes

```prisma
// Tournament queries - common filter combination
@@index([sport, status, startDate])
@@index([sport, type, status])
@@index([city, sport, status, startDate])

// Match queries - tournament bracket lookups
@@index([tournamentId, roundNumber, status])

// Leaderboard queries
@@index([sport, visiblePoints(DESC)])
@@index([sport, hiddenElo(DESC)])

// User searches
@@index([sport, isActive, visiblePoints])
```

### Full-Text Search Optimization

Consider adding computed search columns or using SQLite FTS5 for:
- `User` name search
- `Tournament` name/location search
- `Organization` name search

---

## Optimization Recommendations

### Phase 1: Quick Wins (1-2 weeks)

1. **Consolidate Notification Settings**
   ```prisma
   model NotificationSettings {
     id              String   @id @default(cuid())
     userId          String?  @unique
     orgId           String?  @unique
     
     // Consolidated settings as JSONB
     email           String?  // JSON: { matchResults: true, ... }
     push            String?  // JSON: { matchResults: true, ... }
     whatsapp        String?  // JSON: { matchResults: true, ... }
     
     quietHours      String?  // JSON: { start: 22, end: 8, timezone: "Asia/Kolkata" }
   }
   ```
   **Impact:** Reduces 3 models to 1, simpler preference management

2. **Add Composite Indexes**
   - Add suggested composite indexes above
   - Review slow queries and add targeted indexes
   **Impact:** 20-50% query performance improvement

3. **Archive Policy Implementation**
   - Archive `PushNotificationLog` after 30 days
   - Archive `PlayerActivityFeedItem` after 90 days
   - Archive `Message` after 1 year
   **Impact:** 30-50% reduction in active table sizes

### Phase 2: Archive Separation (2-4 weeks)

1. **Create Archive Database Schema**
   ```sql
   -- Separate SQLite database for archives
   -- Or migrate to PostgreSQL with table partitioning
   ```

2. **Move Archive Models**
   - `ArchivedTournament` → Archive DB
   - `ArchivedMatch` → Archive DB
   - `TournamentSnapshot` (after 2 years) → Archive DB
   - `LeaderboardSnapshot` (after 1 year) → Archive DB

3. **Implement Archival Jobs**
   - Weekly job to move completed tournament data
   - Maintain referential integrity through original IDs

### Phase 3: Read Replica Considerations (4-8 weeks)

1. **Analytics Models for Read Replica**
   - `PlayerPerformanceTrend`
   - `DartsScoringHeatmap`
   - `CornholeScoringHeatmap`
   - `HeadToHeadRecord`

2. **Time-Series Database Consideration**
   - Consider TimescaleDB or InfluxDB for:
     - Heatmap analytics
     - Performance trends
     - Leaderboard snapshots

### Phase 4: Schema Splitting (Future)

For large-scale deployments, consider schema splitting:

1. **Core Schema** (Always in main DB)
   - User, Organization, Tournament, Match, Registration
   - Payment, Subscription
   - Session, Audit

2. **Analytics Schema** (Read replica or separate DB)
   - All heatmap models
   - Performance trends
   - Leaderboard snapshots

3. **Archive Schema** (Cold storage)
   - All Archived* models
   - Historical logs

4. **Organization-Specific Schemas** (Per-tenant)
   - Corporate/School/College models could be tenant-specific

---

## Migration Path

### Safe Migration Approach

1. **Create new consolidated models** (don't drop existing)
2. **Dual-write to both old and new models**
3. **Migrate existing data**
4. **Update queries to use new models**
5. **Remove old models after verification**

### Rollback Strategy

- Keep old models for 30 days after migration
- Implement feature flags for new schema access
- Maintain data export capability for rollback

---

## Performance Impact Estimates

| Optimization | Estimated Impact |
|--------------|-----------------|
| Composite indexes | 20-50% query speedup |
| Notification settings consolidation | 15% reduction in join queries |
| Archive separation | 30-50% reduction in main DB size |
| Message archiving | 40-60% reduction in Message table |
| Read replicas | 50-70% reduction in read load on primary |

---

## Monitoring Recommendations

1. **Query Performance Tracking**
   - Log slow queries (>100ms)
   - Monitor index usage
   - Track table sizes

2. **Archive Job Monitoring**
   - Track archival success/failure
   - Monitor archive DB size
   - Verify data integrity

3. **Schema Drift Detection**
   - Compare model counts between environments
   - Alert on unexpected model additions

---

## Conclusion

The VALORHIVE schema has grown organically with feature additions. While the models are well-designed individually, the overall complexity (164 models) impacts:
- Query performance (complex joins)
- Maintenance overhead
- Developer onboarding
- Database migrations

Implementing the phased optimization approach will:
- Reduce active table count by ~20%
- Improve query performance by 30-50%
- Maintain all functionality
- Preserve data integrity
- Enable future scalability

The recommendations prioritize backward compatibility and safe migration paths to avoid disrupting the production platform.

---

*Document Version: 1.0*
*Last Updated: 2024*
*Author: Schema Analysis Agent*
