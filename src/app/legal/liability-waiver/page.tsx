"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldAlert, AlertTriangle } from "lucide-react";

export default function LiabilityWaiverPage() {
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
          <div className="p-3 rounded-xl bg-red-500/10">
            <ShieldAlert className="h-6 w-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Liability Waiver & Release</h1>
            <p className="text-muted-foreground">Last updated: March 2026</p>
          </div>
        </div>

        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-300">Important Notice</p>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                By participating in any VALORHIVE tournament or event, you acknowledge that you have read, understood, and agree to the terms of this waiver. This is a legally binding document.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">1. Acknowledgment of Risks</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground mb-4">
                I hereby acknowledge and understand that participation in sports activities including but not limited to cornhole, darts, and related tournaments involves inherent risks. These risks include, but are not limited to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Physical injuries such as sprains, strains, fractures, and bruises</li>
                <li>Injuries from equipment (dart boards, cornhole boards, bags)</li>
                <li>Slip and fall injuries at tournament venues</li>
                <li>Heat-related illnesses during outdoor events</li>
                <li>Injuries from other participants or spectators</li>
                <li>Property damage or loss</li>
                <li>Travel risks to and from tournament venues</li>
                <li>Emotional distress from competition</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                I understand that these risks cannot be eliminated regardless of the care taken to avoid injuries.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">2. Assumption of Risk</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground">
                I hereby voluntarily assume all risks associated with participating in VALORHIVE tournaments and events, including both known and unknown risks. I understand that by participating, I am responsible for my own safety and well-being. I acknowledge that VALORHIVE does not insure participants and I am encouraged to obtain my own personal health and accident insurance.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">3. Release & Waiver of Liability</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground mb-4">
                In consideration of being allowed to participate in VALORHIVE tournaments and events, I hereby release, waive, discharge, and covenant not to sue:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground mb-4">
                <li>VALORHIVE and its parent companies, subsidiaries, and affiliates</li>
                <li>Officers, directors, employees, and agents of VALORHIVE</li>
                <li>Tournament organizers, directors, referees, and volunteers</li>
                <li>Venue owners, operators, and staff</li>
                <li>Sponsors, advertisers, and partners</li>
              </ul>
              <p className="text-muted-foreground">
                From any and all liability, claims, demands, actions, and causes of action whatsoever arising out of or related to any loss, damage, or injury, including death, that may be sustained by me, or any property belonging to me, while participating in or in any way connected with VALORHIVE tournaments and events.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">4. Indemnification</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground">
                I agree to indemnify, defend, and hold harmless VALORHIVE, its officers, directors, employees, agents, and representatives from any and all claims, suits, losses, damages, costs, and expenses (including reasonable attorney&apos;s fees) arising out of or in connection with:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground mt-2">
                <li>My participation in tournaments and events</li>
                <li>Any injury or damage caused by me to other participants, spectators, or property</li>
                <li>Any breach of this waiver or the Terms of Service</li>
                <li>Any violation of applicable laws or regulations</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">5. Medical Treatment Authorization</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground">
                I authorize VALORHIVE and its representatives to seek and obtain emergency medical treatment on my behalf if I am unable to do so myself. I understand that I am responsible for all costs associated with such medical treatment. I confirm that I have no medical conditions that would prevent me from safely participating in sports activities, or I have disclosed all such conditions to VALORHIVE.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">6. No Guarantees</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground">
                I understand that VALORHIVE does not guarantee the outcome of any tournament, the quality of any venue, or the conduct of any participant. I acknowledge that tournaments may be postponed, modified, or cancelled due to circumstances beyond VALORHIVE&apos;s control, including weather, venue availability, government regulations, or public health concerns.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">7. Personal Property</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground">
                I acknowledge that VALORHIVE is not responsible for any loss, theft, or damage to my personal property during tournaments or events. I am solely responsible for securing my belongings, including but not limited to equipment, phones, wallets, and other valuables.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">8. Venue Rules & Regulations</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground">
                I agree to comply with all rules and regulations of tournament venues, including but not limited to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground mt-2">
                <li>Prohibition of alcohol and illegal substances</li>
                <li>Smoking restrictions</li>
                <li>Noise regulations</li>
                <li>Parking and access rules</li>
                <li>Safety and emergency procedures</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">9. Duration & Binding Effect</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground">
                This waiver shall remain in effect for all current and future participation in VALORHIVE tournaments and events. This waiver binds my heirs, executors, administrators, and assigns. If any provision of this waiver is found to be unenforceable, the remaining provisions shall continue in full force and effect.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">10. Governing Law</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground">
                This waiver shall be governed by and construed in accordance with the laws of India. Any disputes arising out of or in connection with this waiver shall be subject to the exclusive jurisdiction of the courts in Bengaluru, Karnataka, India.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">11. Contact</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground">For questions about this Liability Waiver:</p>
              <ul className="list-none space-y-1 text-muted-foreground mt-2">
                <li>Email: legal@valorhive.com</li>
                <li>Phone: +91 98765 43210</li>
                <li>Address: VALORHIVE, Bengaluru, Karnataka, India</li>
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
