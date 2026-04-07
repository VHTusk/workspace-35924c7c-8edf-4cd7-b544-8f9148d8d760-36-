"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, AlertTriangle, Heart, Shield } from "lucide-react";

export default function CommunityGuidelinesPage() {
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
          <div className="p-3 rounded-xl bg-purple-500/10">
            <Users className="h-6 w-6 text-purple-500" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Community Guidelines</h1>
            <p className="text-muted-foreground">Last updated: March 2026</p>
          </div>
        </div>

        <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <Heart className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-purple-800 dark:text-purple-300">Our Community Values</p>
              <p className="text-sm text-purple-700 dark:text-purple-400 mt-1">
                VALORHIVE is built on respect, fair play, and sportsmanship. We expect all community members to uphold these values and help create a welcoming environment for everyone.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">1. Respect for All Members</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Treat all players, organizers, and staff with dignity and respect</li>
                <li>Respect differences in background, experience, and skill level</li>
                <li>Use inclusive language and avoid discriminatory remarks</li>
                <li>Welcome new members and help them learn the ropes</li>
                <li>Be patient with players of all skill levels</li>
                <li>Celebrate others&apos; successes and support them in setbacks</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">2. Prohibited Behavior</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground mb-4">The following behaviors are strictly prohibited:</p>
              
              <div className="space-y-4">
                <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-900">
                  <p className="font-medium text-red-800 dark:text-red-300">Harassment & Discrimination</p>
                  <ul className="text-sm text-red-700 dark:text-red-400 mt-2 space-y-1">
                    <li>• Discrimination based on race, caste, religion, gender, sexuality, disability, or age</li>
                    <li>• Sexual harassment, inappropriate comments, or unwanted advances</li>
                    <li>• Targeted harassment or bullying of any member</li>
                    <li>• Doxxing or sharing personal information without consent</li>
                  </ul>
                </div>

                <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-900">
                  <p className="font-medium text-orange-800 dark:text-orange-300">Cheating & Manipulation</p>
                  <ul className="text-sm text-orange-700 dark:text-orange-400 mt-2 space-y-1">
                    <li>• Cheating, hacking, or using unauthorized tools</li>
                    <li>• Match-fixing or colluding with opponents</li>
                    <li>• Creating multiple accounts to circumvent restrictions</li>
                    <li>• Exploiting platform bugs or loopholes</li>
                  </ul>
                </div>

                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900">
                  <p className="font-medium text-amber-800 dark:text-amber-300">Harmful Content</p>
                  <ul className="text-sm text-amber-700 dark:text-amber-400 mt-2 space-y-1">
                    <li>• Sharing offensive, violent, or explicit content</li>
                    <li>• Spam, phishing, or malicious links</li>
                    <li>• Impersonating other users or staff</li>
                    <li>• Sharing misinformation about tournaments or players</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">3. Fair Play Standards</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Play fairly and honestly in all matches</li>
                <li>Accept referee and director decisions gracefully</li>
                <li>Report any suspected cheating or rule violations</li>
                <li>Do not attempt to manipulate scores or rankings</li>
                <li>Respect the rules of each specific game/sport</li>
                <li>Acknowledge good plays by opponents</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">4. Communication Standards</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Keep discussions civil and constructive</li>
                <li>Do not use profanity, slurs, or threatening language</li>
                <li>Respect others&apos; opinions even when you disagree</li>
                <li>Avoid spamming or flooding chat channels</li>
                <li>Use appropriate channels for different topics</li>
                <li>Do not share others&apos; private communications without permission</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">5. Tournament Etiquette</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Arrive on time for all scheduled matches</li>
                <li>Follow check-in procedures promptly</li>
                <li>Wait for official confirmation before leaving a match</li>
                <li>Do not distract other players during their matches</li>
                <li>Congratulate winners and support fellow competitors</li>
                <li>Raise disputes through proper channels only</li>
                <li>Accept outcomes gracefully - win or lose</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">6. Social Media & Public Conduct</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Represent VALORHIVE positively in all public forums</li>
                <li>Do not post content that damages the community reputation</li>
                <li>Tag or mention VALORHIVE only for relevant content</li>
                <li>Do not share private tournament information before official announcements</li>
                <li>Credit photographers and content creators appropriately</li>
                <li>Report fake accounts impersonating VALORHIVE or its staff</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">7. Reporting Violations</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <div className="flex items-start gap-3 mb-4">
                <Shield className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-muted-foreground">
                  Help us maintain a safe community by reporting violations:
                </p>
              </div>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Use the &quot;Report&quot; button on profiles, messages, or content</li>
                <li>Email detailed reports to safety@valorhive.com</li>
                <li>Include screenshots or evidence when possible</li>
                <li>Reports are confidential - your identity is protected</li>
                <li>False reports may result in penalties</li>
                <li>Urgent safety concerns: Call our helpline at +91 98765 43210</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">8. Enforcement & Penalties</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground mb-4">Violations may result in the following actions:</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 text-foreground">Violation Level</th>
                      <th className="text-left py-2 text-foreground">Action</th>
                      <th className="text-left py-2 text-foreground">Examples</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-b">
                      <td className="py-2 pr-4">Minor</td>
                      <td className="py-2">Warning</td>
                      <td className="py-2">Minor etiquette breach, first offense</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 pr-4">Moderate</td>
                      <td className="py-2">Temporary suspension (1-7 days)</td>
                      <td className="py-2">Repeated minor violations, inappropriate language</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 pr-4">Serious</td>
                      <td className="py-2">Extended suspension (1-3 months)</td>
                      <td className="py-2">Harassment, discrimination, cheating attempt</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4">Severe</td>
                      <td className="py-2">Permanent ban</td>
                      <td className="py-2">Match-fixing, serious harassment, illegal activity</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">9. Appeals Process</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Appeals must be submitted within 7 days of penalty notification</li>
                <li>Email appeals@valorhive.com with your case details</li>
                <li>Include any relevant evidence or context</li>
                <li>Appeals are reviewed within 5 business days</li>
                <li>Decisions on appeals are final</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">10. Contact</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground">For community-related concerns:</p>
              <ul className="list-none space-y-1 text-muted-foreground mt-2">
                <li>Community Team: community@valorhive.com</li>
                <li>Safety Team: safety@valorhive.com</li>
                <li>Appeals: appeals@valorhive.com</li>
                <li>Phone: +91 98765 43210</li>
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
