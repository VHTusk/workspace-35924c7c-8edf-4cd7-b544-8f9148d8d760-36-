"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertTriangle, Shield, ExternalLink } from "lucide-react";

export default function DisclaimerPage() {
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
          <div className="p-3 rounded-xl bg-orange-500/10">
            <AlertTriangle className="h-6 w-6 text-orange-500" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Website Disclaimer</h1>
            <p className="text-muted-foreground">Last updated: March 2026</p>
          </div>
        </div>

        <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-orange-800 dark:text-orange-300">Important Notice</p>
              <p className="text-sm text-orange-700 dark:text-orange-400 mt-1">
                The information on this website is provided "as is" without any warranties, express or implied. By using this website, you agree to this disclaimer.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">1. General Information</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground">
                VALORHIVE (operated by VALORHIVE Sports Technologies Pvt. Ltd.) provides this website and associated services for informational purposes only. While we strive to keep information accurate and current, we make no representations or warranties about completeness, accuracy, reliability, suitability, or availability of the website or the information contained herein.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">2. No Professional Advice</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground">
                The information on this website does not constitute professional advice, including but not limited to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground mt-4">
                <li><strong>Legal Advice:</strong> Consult a qualified attorney for legal matters</li>
                <li><strong>Medical Advice:</strong> Consult healthcare professionals for health concerns</li>
                <li><strong>Financial Advice:</strong> Consult certified financial advisors for investment decisions</li>
                <li><strong>Sports Training:</strong> Consult certified coaches for professional training programs</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                Any reliance you place on such information is strictly at your own risk.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">3. Third-Party Links & Content</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground">
                This website may contain links to third-party websites or content. These links are provided for your convenience only. VALORHIVE:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground mt-4">
                <li>Does not control or endorse third-party content</li>
                <li>Is not responsible for third-party websites&apos; privacy practices</li>
                <li>Makes no guarantees about third-party content accuracy</li>
                <li>Disclaims liability for any damages from third-party content</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                We encourage users to review the terms and privacy policies of any third-party sites they visit.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">4. Limitation of Liability</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground mb-4">
                To the fullest extent permitted by law, VALORHIVE shall not be liable for:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Any direct, indirect, incidental, or consequential damages</li>
                <li>Loss of profits, data, or business opportunities</li>
                <li>Personal injury or property damage</li>
                <li>Service interruptions or data loss</li>
                <li>Virus attacks or security breaches</li>
                <li>Errors or omissions in content</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                This applies regardless of whether the damages arise from contract, tort, or otherwise.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">5. No Guarantee of Service</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Service availability is not guaranteed and may be interrupted</li>
                <li>We may modify or discontinue any part of the service at any time</li>
                <li>No warranty that the website will meet your specific requirements</li>
                <li>No warranty that the website will be uninterrupted, timely, or error-free</li>
                <li>No warranty regarding results from using the website</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">6. User-Generated Content</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground">
                Opinions, views, and content expressed by users in profiles, comments, or forums are those of the individual authors and do not necessarily reflect the views of VALORHIVE. We do not endorse or verify user-generated content. Users are solely responsible for their contributions to the platform.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">7. Tournament & Event Information</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground mb-4">
                While we strive for accuracy, tournament details are subject to change. VALORHIVE:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Reserves the right to modify tournament rules, dates, venues, and prizes</li>
                <li>May cancel tournaments due to circumstances beyond our control</li>
                <li>Does not guarantee specific match-ups or outcomes</li>
                <li>Is not responsible for venue conditions or third-party services</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">8. Accuracy of Information</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground">
                We make reasonable efforts to ensure information accuracy, but errors may occur. Rankings, statistics, and player information are provided for informational purposes and may not always reflect real-time status. Official records maintained by tournament directors take precedence over website displayed information.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">9. Viruses & Security</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground">
                VALORHIVE does not guarantee that this website is free of viruses or other harmful components. We recommend using appropriate security measures including firewalls, antivirus software, and regular backups. You are responsible for maintaining the security of your own devices and data.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">10. Changes to This Disclaimer</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground">
                We may update this disclaimer at any time. Changes will be posted on this page with an updated "Last updated" date. Continued use of the website after changes constitutes acceptance of the modified disclaimer.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">11. Governing Law</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground">
                This disclaimer is governed by the laws of India. Any disputes arising from the use of this website shall be subject to the exclusive jurisdiction of the courts in Bengaluru, Karnataka, India.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">12. Contact</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground">For questions about this disclaimer:</p>
              <ul className="list-none space-y-1 text-muted-foreground mt-2">
                <li>Email: legal@valorhive.com</li>
                <li>Phone: +91 98765 43210</li>
                <li>Address: VALORHIVE Sports Technologies Pvt. Ltd., Bengaluru, Karnataka, India</li>
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
