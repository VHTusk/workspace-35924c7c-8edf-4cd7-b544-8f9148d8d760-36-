import { db } from '../src/lib/db';

async function clearAllProfiles() {
  console.log('Starting to clear all registered profiles...\n');

  try {
    // Use raw SQL for SQLite to disable foreign keys temporarily
    await db.$executeRawUnsafe(`PRAGMA foreign_keys = OFF;`);

    // Delete in order to respect foreign key constraints
    
    // 1. Clear admin assignments
    console.log('Clearing admin assignments...');
    const adminAssignments = await db.adminAssignment.deleteMany();
    console.log(`  Deleted ${adminAssignments.count} admin assignments`);

    // 2. Clear admin metrics
    console.log('Clearing admin metrics...');
    const adminMetrics = await db.adminMetrics.deleteMany();
    console.log(`  Deleted ${adminMetrics.count} admin metrics`);

    // 3. Clear sessions
    console.log('Clearing sessions...');
    const sessions = await db.session.deleteMany();
    console.log(`  Deleted ${sessions.count} sessions`);

    // 4. Clear director sessions and magic links
    console.log('Clearing director sessions...');
    const directorSessions = await db.directorSession.deleteMany();
    console.log(`  Deleted ${directorSessions.count} director sessions`);

    console.log('Clearing director magic links...');
    const magicLinks = await db.directorMagicLink.deleteMany();
    console.log(`  Deleted ${magicLinks.count} director magic links`);

    // 5. Clear team-related data
    console.log('Clearing team invitations...');
    const teamInvitations = await db.teamInvitation.deleteMany();
    console.log(`  Deleted ${teamInvitations.count} team invitations`);

    console.log('Clearing tournament teams...');
    const tournamentTeams = await db.tournamentTeam.deleteMany();
    console.log(`  Deleted ${tournamentTeams.count} tournament teams`);

    console.log('Clearing team members...');
    const teamMembers = await db.teamMember.deleteMany();
    console.log(`  Deleted ${teamMembers.count} team members`);

    console.log('Clearing teams...');
    const teams = await db.team.deleteMany();
    console.log(`  Deleted ${teams.count} teams`);

    // 6. Clear tournament registrations
    console.log('Clearing tournament registrations...');
    const tournamentRegs = await db.tournamentRegistration.deleteMany();
    console.log(`  Deleted ${tournamentRegs.count} tournament registrations`);

    // 7. Clear org tournament registrations
    console.log('Clearing org tournament registrations...');
    const orgTournamentRegs = await db.orgTournamentRegistration.deleteMany();
    console.log(`  Deleted ${orgTournamentRegs.count} org tournament registrations`);

    // 8. Clear waitlist entries
    console.log('Clearing tournament waitlists...');
    const waitlists = await db.tournamentWaitlist.deleteMany();
    console.log(`  Deleted ${waitlists.count} waitlist entries`);

    // 9. Clear matches
    console.log('Clearing match results history...');
    const matchHistory = await db.matchResultHistory.deleteMany();
    console.log(`  Deleted ${matchHistory.count} match history records`);

    console.log('Clearing bracket matches...');
    const bracketMatches = await db.bracketMatch.deleteMany();
    console.log(`  Deleted ${bracketMatches.count} bracket matches`);

    console.log('Clearing matches...');
    const matches = await db.match.deleteMany();
    console.log(`  Deleted ${matches.count} matches`);

    // 10. Clear brackets
    console.log('Clearing brackets...');
    const brackets = await db.bracket.deleteMany();
    console.log(`  Deleted ${brackets.count} brackets`);

    // 11. Clear tournament results
    console.log('Clearing tournament results...');
    const results = await db.tournamentResult.deleteMany();
    console.log(`  Deleted ${results.count} tournament results`);

    // 12. Clear prize payouts
    console.log('Clearing prize payouts (new)...');
    const prizePayoutsNew = await db.prizePayout.deleteMany();
    console.log(`  Deleted ${prizePayoutsNew.count} prize payouts`);

    console.log('Clearing prize payout records...');
    const prizePayoutRecords = await db.prizePayoutRecord.deleteMany();
    console.log(`  Deleted ${prizePayoutRecords.count} prize payout records`);

    // 13. Clear notifications
    console.log('Clearing notifications...');
    const notifications = await db.notification.deleteMany();
    console.log(`  Deleted ${notifications.count} notifications`);

    // 14. Clear dispute
    console.log('Clearing disputes...');
    const disputes = await db.dispute.deleteMany();
    console.log(`  Deleted ${disputes.count} disputes`);

    // 15. Clear subscriptions
    console.log('Clearing subscriptions...');
    const subscriptions = await db.subscription.deleteMany();
    console.log(`  Deleted ${subscriptions.count} subscriptions`);

    // 16. Clear player ratings
    console.log('Clearing player ratings...');
    const ratings = await db.playerRating.deleteMany();
    console.log(`  Deleted ${ratings.count} player ratings`);

    // 17. Clear player achievements
    console.log('Clearing player achievements...');
    const achievements = await db.playerAchievement.deleteMany();
    console.log(`  Deleted ${achievements.count} player achievements`);

    // 18. Clear MFA data
    console.log('Clearing MFA secrets...');
    const mfaSecrets = await db.mfaSecret.deleteMany();
    console.log(`  Deleted ${mfaSecrets.count} MFA secrets`);

    console.log('Clearing MFA recovery codes...');
    const mfaCodes = await db.mfaRecoveryCode.deleteMany();
    console.log(`  Deleted ${mfaCodes.count} MFA recovery codes`);

    // 19. Clear notification preferences
    console.log('Clearing notification preferences...');
    const notifPrefs = await db.notificationPreference.deleteMany();
    console.log(`  Deleted ${notifPrefs.count} notification preferences`);

    // 20. Clear wallets
    console.log('Clearing wallets...');
    const wallets = await db.wallet.deleteMany();
    console.log(`  Deleted ${wallets.count} wallets`);

    // 21. Clear audit logs
    console.log('Clearing audit logs...');
    const auditLogs = await db.auditLog.deleteMany();
    console.log(`  Deleted ${auditLogs.count} audit logs`);

    // 22. Clear org admin roles
    console.log('Clearing org admin roles...');
    const orgAdmins = await db.orgAdmin.deleteMany();
    console.log(`  Deleted ${orgAdmins.count} org admin roles`);

    // 23. Clear org roster
    console.log('Clearing org roster players...');
    const rosterPlayers = await db.orgRosterPlayer.deleteMany();
    console.log(`  Deleted ${rosterPlayers.count} roster players`);

    console.log('Clearing org roster requests...');
    const rosterRequests = await db.orgRosterRequest.deleteMany();
    console.log(`  Deleted ${rosterRequests.count} roster requests`);

    // 24. Clear player availability
    console.log('Clearing player availability...');
    const availability = await db.playerAvailability.deleteMany();
    console.log(`  Deleted ${availability.count} availability records`);

    // 25. Clear blocked players
    console.log('Clearing blocked players...');
    const blocked = await db.blockedPlayer.deleteMany();
    console.log(`  Deleted ${blocked.count} blocked player records`);

    // 26. Clear conversation participants
    console.log('Clearing conversation participants...');
    const participants = await db.conversationParticipant.deleteMany();
    console.log(`  Deleted ${participants.count} conversation participants`);

    // 27. Clear messages
    console.log('Clearing messages...');
    const messages = await db.message.deleteMany();
    console.log(`  Deleted ${messages.count} messages`);

    // 28. Clear leaderboard snapshots
    console.log('Clearing leaderboard snapshots...');
    const snapshots = await db.leaderboardSnapshot.deleteMany();
    console.log(`  Deleted ${snapshots.count} leaderboard snapshots`);

    // 29. Clear referrals
    console.log('Clearing referrals...');
    const referrals = await db.referral.deleteMany();
    console.log(`  Deleted ${referrals.count} referrals`);

    // 30. Clear follows
    console.log('Clearing user follows...');
    const userFollows = await db.userFollow.deleteMany();
    console.log(`  Deleted ${userFollows.count} user follows`);

    console.log('Clearing user follows orgs...');
    const userFollowsOrgs = await db.userFollowsOrg.deleteMany();
    console.log(`  Deleted ${userFollowsOrgs.count} user follows orgs`);

    console.log('Clearing org follows users...');
    const orgFollowsUsers = await db.orgFollowsUser.deleteMany();
    console.log(`  Deleted ${orgFollowsUsers.count} org follows users`);

    // 31. Clear notification settings
    console.log('Clearing email notification settings...');
    const emailNotif = await db.emailNotificationSetting.deleteMany();
    console.log(`  Deleted ${emailNotif.count} email notification settings`);

    console.log('Clearing WhatsApp notification settings...');
    const whatsappNotif = await db.whatsAppNotificationSetting.deleteMany();
    console.log(`  Deleted ${whatsappNotif.count} WhatsApp notification settings`);

    console.log('Clearing push notification settings...');
    const pushNotif = await db.pushNotificationSetting.deleteMany();
    console.log(`  Deleted ${pushNotif.count} push notification settings`);

    // 32. Clear milestones
    console.log('Clearing milestones...');
    const milestones = await db.milestone.deleteMany();
    console.log(`  Deleted ${milestones.count} milestones`);

    // 33. Clear reminders
    console.log('Clearing tournament reminders...');
    const tournamentReminders = await db.tournamentReminder.deleteMany();
    console.log(`  Deleted ${tournamentReminders.count} tournament reminders`);

    console.log('Clearing match reminders...');
    const matchReminders = await db.matchReminder.deleteMany();
    console.log(`  Deleted ${matchReminders.count} match reminders`);

    // 34. Clear venue flow data
    console.log('Clearing match check-ins...');
    const checkIns = await db.matchCheckIn.deleteMany();
    console.log(`  Deleted ${checkIns.count} match check-ins`);

    console.log('Clearing venue flow logs...');
    const venueLogs = await db.venueFlowLog.deleteMany();
    console.log(`  Deleted ${venueLogs.count} venue flow logs`);

    // 35. Clear contracts
    console.log('Clearing player contracts...');
    const contracts = await db.playerContract.deleteMany();
    console.log(`  Deleted ${contracts.count} player contracts`);

    // 36. Clear inter-org team players
    console.log('Clearing inter-org team players...');
    const interOrgPlayers = await db.interOrgTeamPlayer.deleteMany();
    console.log(`  Deleted ${interOrgPlayers.count} inter-org team players`);

    // 37. Clear ID verifications
    console.log('Clearing player ID verifications...');
    const idVerifications = await db.playerIdVerification.deleteMany();
    console.log(`  Deleted ${idVerifications.count} ID verifications`);

    // 38. Clear GDPR consents
    console.log('Clearing GDPR consents...');
    const gdprConsents = await db.gdprConsent.deleteMany();
    console.log(`  Deleted ${gdprConsents.count} GDPR consents`);

    // 39. Clear transfer cooldowns
    console.log('Clearing transfer cooldowns...');
    const cooldowns = await db.transferCooldown.deleteMany();
    console.log(`  Deleted ${cooldowns.count} transfer cooldowns`);

    // 40. Clear identity change requests
    console.log('Clearing identity change requests...');
    const identityReqs = await db.identityChangeRequest.deleteMany();
    console.log(`  Deleted ${identityReqs.count} identity change requests`);

    // 41. Clear staff assignments
    console.log('Clearing tournament staff...');
    const staff = await db.tournamentStaff.deleteMany();
    console.log(`  Deleted ${staff.count} staff assignments`);

    // 42. Clear employee data
    console.log('Clearing employees...');
    const employees = await db.employee.deleteMany();
    console.log(`  Deleted ${employees.count} employees`);

    console.log('Clearing employee invitations...');
    const empInvitations = await db.employeeInvitation.deleteMany();
    console.log(`  Deleted ${empInvitations.count} employee invitations`);

    console.log('Clearing employee tournament participations...');
    const empParticipations = await db.employeeTournamentParticipation.deleteMany();
    console.log(`  Deleted ${empParticipations.count} employee participations`);

    // 43. Clear rep players
    console.log('Clearing rep players...');
    const repPlayers = await db.repPlayer.deleteMany();
    console.log(`  Deleted ${repPlayers.count} rep players`);

    console.log('Clearing rep squad registrations...');
    const repRegs = await db.repSquadTournamentRegistration.deleteMany();
    console.log(`  Deleted ${repRegs.count} rep squad registrations`);

    // 44. Clear student data
    console.log('Clearing students...');
    const students = await db.student.deleteMany();
    console.log(`  Deleted ${students.count} students`);

    console.log('Clearing academic team registrations...');
    const academicRegs = await db.academicTeamRegistration.deleteMany();
    console.log(`  Deleted ${academicRegs.count} academic team registrations`);

    // 45. NOW delete all users
    console.log('Clearing all users...');
    const users = await db.user.deleteMany();
    console.log(`  Deleted ${users.count} users`);

    // 46. Clear org subscriptions
    console.log('Clearing org subscriptions...');
    const orgSubs = await db.orgSubscription.deleteMany();
    console.log(`  Deleted ${orgSubs.count} org subscriptions`);

    // 47. Clear org statistics
    console.log('Clearing org statistics...');
    const orgStats = await db.orgStatistics.deleteMany();
    console.log(`  Deleted ${orgStats.count} org statistics`);

    // 48. Clear tournament sponsors
    console.log('Clearing tournament sponsors...');
    const sponsors = await db.tournamentSponsor.deleteMany();
    console.log(`  Deleted ${sponsors.count} tournament sponsors`);

    // 49. Clear tournament media
    console.log('Clearing tournament media...');
    const media = await db.tournamentMedia.deleteMany();
    console.log(`  Deleted ${media.count} tournament media`);

    console.log('Clearing tournament media items...');
    const mediaItems = await db.tournamentMediaItem.deleteMany();
    console.log(`  Deleted ${mediaItems.count} tournament media items`);

    // 50. Clear video highlights
    console.log('Clearing video highlights...');
    const videoHighlights = await db.videoHighlight.deleteMany();
    console.log(`  Deleted ${videoHighlights.count} video highlights`);

    // 51. Clear tournament recaps
    console.log('Clearing tournament recaps...');
    const recaps = await db.tournamentRecap.deleteMany();
    console.log(`  Deleted ${recaps.count} tournament recaps`);

    // 52. Clear tournament checkins
    console.log('Clearing tournament checkins...');
    const tournCheckins = await db.tournamentCheckin.deleteMany();
    console.log(`  Deleted ${tournCheckins.count} tournament checkins`);

    // 53. Clear schedule slots
    console.log('Clearing schedule slots...');
    const scheduleSlots = await db.scheduleSlot.deleteMany();
    console.log(`  Deleted ${scheduleSlots.count} schedule slots`);

    // 54. Clear announcements
    console.log('Clearing tournament announcements...');
    const tournAnnouncements = await db.tournamentAnnouncement.deleteMany();
    console.log(`  Deleted ${tournAnnouncements.count} tournament announcements`);

    console.log('Clearing announcements...');
    const announcements = await db.announcement.deleteMany();
    console.log(`  Deleted ${announcements.count} announcements`);

    // 55. Clear prize distributions
    console.log('Clearing prize distributions...');
    const prizeDists = await db.prizeDistribution.deleteMany();
    console.log(`  Deleted ${prizeDists.count} prize distributions`);

    // 56. Clear payment ledgers
    console.log('Clearing payment ledgers...');
    const paymentLedgers = await db.paymentLedger.deleteMany();
    console.log(`  Deleted ${paymentLedgers.count} payment ledgers`);

    // 57. Clear autopilot logs
    console.log('Clearing autopilot logs...');
    const autopilotLogs = await db.autopilotLog.deleteMany();
    console.log(`  Deleted ${autopilotLogs.count} autopilot logs`);

    // 58. Clear courts
    console.log('Clearing courts...');
    const courts = await db.court.deleteMany();
    console.log(`  Deleted ${courts.count} courts`);

    // 59. Clear venue flow config
    console.log('Clearing venue flow config...');
    const venueConfig = await db.venueFlowConfig.deleteMany();
    console.log(`  Deleted ${venueConfig.count} venue flow configs`);

    // 60. Clear match queue
    console.log('Clearing match queue...');
    const matchQueue = await db.matchQueue.deleteMany();
    console.log(`  Deleted ${matchQueue.count} match queue entries`);

    // 61. Clear venue health alerts
    console.log('Clearing venue health alerts...');
    const healthAlerts = await db.venueHealthAlert.deleteMany();
    console.log(`  Deleted ${healthAlerts.count} venue health alerts`);

    // 62. Clear refund policies
    console.log('Clearing refund policies...');
    const refundPolicies = await db.refundPolicy.deleteMany();
    console.log(`  Deleted ${refundPolicies.count} refund policies`);

    // 63. Clear refund jobs
    console.log('Clearing refund jobs...');
    const refundJobs = await db.refundJob.deleteMany();
    console.log(`  Deleted ${refundJobs.count} refund jobs`);

    // 64. Clear finance snapshots
    console.log('Clearing finance snapshots...');
    const financeSnaps = await db.tournamentFinanceSnapshot.deleteMany();
    console.log(`  Deleted ${financeSnaps.count} finance snapshots`);

    // 65. Clear cancellation logs
    console.log('Clearing cancellation logs...');
    const cancelLogs = await db.cancellationLog.deleteMany();
    console.log(`  Deleted ${cancelLogs.count} cancellation logs`);

    // 66. Clear payment recoveries
    console.log('Clearing payment recoveries...');
    const paymentRecs = await db.paymentRecovery.deleteMany();
    console.log(`  Deleted ${paymentRecs.count} payment recoveries`);

    // 67. Clear inter-org team selections
    console.log('Clearing inter-org team selections...');
    const interOrgSelections = await db.interOrgTeamSelection.deleteMany();
    console.log(`  Deleted ${interOrgSelections.count} inter-org team selections`);

    // 68. Clear rep squads
    console.log('Clearing rep squads...');
    const repSquads = await db.repSquad.deleteMany();
    console.log(`  Deleted ${repSquads.count} rep squads`);

    // 69. Clear school/college data
    console.log('Clearing school classes...');
    const schoolClasses = await db.schoolClass.deleteMany();
    console.log(`  Deleted ${schoolClasses.count} school classes`);

    console.log('Clearing school sections...');
    const schoolSections = await db.schoolSection.deleteMany();
    console.log(`  Deleted ${schoolSections.count} school sections`);

    console.log('Clearing school houses...');
    const schoolHouses = await db.schoolHouse.deleteMany();
    console.log(`  Deleted ${schoolHouses.count} school houses`);

    console.log('Clearing school teams...');
    const schoolTeams = await db.schoolTeam.deleteMany();
    console.log(`  Deleted ${schoolTeams.count} school teams`);

    console.log('Clearing college departments...');
    const collegeDepts = await db.collegeDepartment.deleteMany();
    console.log(`  Deleted ${collegeDepts.count} college departments`);

    console.log('Clearing college batches...');
    const collegeBatches = await db.collegeBatch.deleteMany();
    console.log(`  Deleted ${collegeBatches.count} college batches`);

    console.log('Clearing college teams...');
    const collegeTeams = await db.collegeTeam.deleteMany();
    console.log(`  Deleted ${collegeTeams.count} college teams`);

    // 70. Clear conversations
    console.log('Clearing conversations...');
    const conversations = await db.conversation.deleteMany();
    console.log(`  Deleted ${conversations.count} conversations`);

    // 71. Clear tournaments
    console.log('Clearing tournaments...');
    const tournaments = await db.tournament.deleteMany();
    console.log(`  Deleted ${tournaments.count} tournaments`);

    // 72. Clear tournament templates
    console.log('Clearing tournament templates...');
    const templates = await db.tournamentTemplate.deleteMany();
    console.log(`  Deleted ${templates.count} tournament templates`);

    // 73. Clear tournament series
    console.log('Clearing tournament series...');
    const series = await db.tournamentSeries.deleteMany();
    console.log(`  Deleted ${series.count} tournament series`);

    // 74. NOW delete organizations
    console.log('Clearing organizations...');
    const orgs = await db.organization.deleteMany();
    console.log(`  Deleted ${orgs.count} organizations`);

    // Re-enable foreign keys
    await db.$executeRawUnsafe(`PRAGMA foreign_keys = ON;`);

    console.log('\n✅ All registered profiles and related data have been cleared!');
    
  } catch (error) {
    console.error('Error clearing profiles:', error);
    // Re-enable foreign keys even on error
    await db.$executeRawUnsafe(`PRAGMA foreign_keys = ON;`);
    throw error;
  } finally {
    await db.$disconnect();
  }
}

clearAllProfiles();
