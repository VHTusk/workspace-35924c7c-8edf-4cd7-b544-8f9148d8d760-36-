"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trophy, CheckCircle } from "lucide-react";

export default function TournamentParticipationAgreementPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-14 items-center px-4">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 rounded-xl bg-amber-500/10">
            <Trophy className="h-6 w-6 text-amber-500" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Tournament Participation Agreement</h1>
            <p className="text-muted-foreground">Last updated: March 2026</p>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">1. Agreement to Terms</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground">
                By registering for and participating in any VALORHIVE tournament, you agree to be bound by this Tournament Participation Agreement, the Terms of Service, and all tournament-specific rules. This agreement constitutes a legally binding contract between you and VALORHIVE.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">2. Eligibility Requirements</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>You must be at least 18 years of age to participate</li>
                <li>Valid government-issued ID may be required for verification</li>
                <li>Active PLAYER tier subscription required for State and National tournaments</li>
                <li>Accurate personal information must be provided during registration</li>
                <li>Players must not be currently suspended or banned from VALORHIVE</li>
                <li>For team tournaments, all team members must meet eligibility requirements</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">3. Registration & Entry Fees</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Registration is complete only upon successful payment confirmation</li>
                <li>Entry fees are non-transferable to other players or tournaments</li>
                <li>Late registrations may be accepted at organizer&apos;s discretion with additional fees</li>
                <li>Waitlisted players will be notified if spots become available</li>
                <li>All fees are displayed in Indian Rupees (INR) and include applicable taxes</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">4. Player Conduct & Fair Play</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground mb-4">All participants must adhere to the following standards:</p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li><strong>No Cheating:</strong> Use of unauthorized equipment, software, or methods</li>
                <li><strong>No Collusion:</strong> Agreeing with opponents on match outcomes beforehand</li>
                <li><strong>No Match-Fixing:</strong> Deliberately losing or underperforming</li>
                <li><strong>Respectful Behavior:</strong> No harassment, discrimination, or abuse</li>
                <li><strong>Timeliness:</strong> Arrive on time for all scheduled matches</li>
                <li><strong>Sportsmanship:</strong> Accept referee decisions gracefully</li>
                <li><strong>Integrity:</strong> Report any suspected rule violations</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">5. Check-In & Match Procedures</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Check-in opens 30 minutes before tournament start time</li>
                <li>Players not checked in within the grace period may be marked as no-show</li>
                <li>Grace period is typically 15 minutes from scheduled match time</li>
                <li>Matches must be played on designated courts/lanes only</li>
                <li>Score reporting must be done immediately after match completion</li>
                <li>Disputes must be raised before the next round begins</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">6. Scoring & Results</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Official scores are recorded by tournament directors or referees</li>
                <li>Results are final once verified and published on the platform</li>
                <li>ELO rating adjustments are calculated automatically based on results</li>
                <li>Tie-breakers follow tournament-specific rules (head-to-head, point differential)</li>
                <li>Prize distribution occurs after the finalization window (typically 24-48 hours)</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">7. Prizes & Awards</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Prize amounts are as advertised and may be subject to TDS deduction</li>
                <li>Winners must provide valid PAN card for prize amounts above ₹10,000</li>
                <li>Prizes are distributed via bank transfer within 7-14 business days</li>
                <li>Trophies and certificates may be awarded at organizer&apos;s discretion</li>
                <li>Ranking points are awarded based on tournament scope and placement</li>
                <li>For team tournaments, prize is split equally among team members unless otherwise specified</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">8. Dispute Resolution</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Disputes must be raised through the official dispute system on VALORHIVE</li>
                <li>Video/photo evidence may be submitted to support claims</li>
                <li>Tournament director decisions are final for on-site disputes</li>
                <li>Administrative disputes are reviewed by VALORHIVE support team</li>
                <li>Frivolous or false dispute submissions may result in penalties</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">9. Withdrawals & Substitutions</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Withdrawals before registration deadline: Full refund</li>
                <li>Withdrawals after deadline: Subject to refund policy</li>
                <li>Substitutions may be allowed with organizer approval</li>
                <li>Medical withdrawals require valid documentation</li>
                <li>No-shows forfeit entry fee and may affect future registrations</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">10. Violations & Penalties</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground mb-4">Violations may result in:</p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Warning (first offense for minor violations)</li>
                <li>Point deduction in current tournament</li>
                <li>Forfeiture of current match</li>
                <li>Disqualification from tournament</li>
                <li>Suspension from future tournaments</li>
                <li>Permanent ban from VALORHIVE platform</li>
                <li>Forfeiture of prizes and awards</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">11. Media & Promotion</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground">
                By participating, you grant VALORHIVE the right to use your name, likeness, and tournament performance for promotional purposes, including but not limited to social media, website content, and marketing materials. You may opt out of specific media usage by contacting media@valorhive.com.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">12. Acknowledgment</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <p className="text-muted-foreground">
                  By registering for a tournament, you acknowledge that you have read, understood, and agree to be bound by this Tournament Participation Agreement and all applicable rules and regulations.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">13. Contact</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground">For tournament-related queries:</p>
              <ul className="list-none space-y-1 text-muted-foreground mt-2">
                <li>Email: tournaments@valorhive.com</li>
                <li>Phone: +91 98765 43210</li>
                <li>WhatsApp: +91 98765 43210</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 mt-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2026 VALORHIVE. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
