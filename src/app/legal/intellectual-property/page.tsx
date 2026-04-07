"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Copyright, Landmark, Image, Video, FileText } from "lucide-react";

export default function IntellectualPropertyPolicyPage() {
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
          <div className="p-3 rounded-xl bg-indigo-500/10">
            <Copyright className="h-6 w-6 text-indigo-500" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Intellectual Property Policy</h1>
            <p className="text-muted-foreground">Last updated: March 2026</p>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">1. VALORHIVE Intellectual Property</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground mb-4">
                VALORHIVE and its associated entities own all intellectual property rights in the following:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li><strong>Brand Assets:</strong> VALORHIVE name, logo, and all associated branding</li>
                <li><strong>Platform Design:</strong> Website design, user interface, and user experience elements</li>
                <li><strong>Content:</strong> All text, graphics, images, and multimedia content created by VALORHIVE</li>
                <li><strong>Software:</strong> Platform code, algorithms, and proprietary technology</li>
                <li><strong>Data:</strong> Aggregated data, analytics, and insights derived from platform usage</li>
                <li><strong>Tournament Formats:</strong> Unique tournament structures and formats developed by VALORHIVE</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                All content is protected by Indian copyright laws and international treaties. Unauthorized use is prohibited.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">2. Trademark Usage</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <div className="flex items-start gap-3 mb-4">
                <Landmark className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-muted-foreground">
                  The VALORHIVE name and logo are registered trademarks. Usage guidelines:
                </p>
              </div>
              
              <div className="space-y-4">
                <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-900">
                  <p className="font-medium text-green-800 dark:text-green-300 mb-2">Permitted Uses:</p>
                  <ul className="text-sm text-green-700 dark:text-green-400 space-y-1">
                    <li>• Referring to VALORHIVE in news articles or blog posts</li>
                    <li>• Linking to VALORHIVE from your website or social media</li>
                    <li>• Using official partner/organizer badges (if authorized)</li>
                    <li>• Sharing screenshots of your profile or results</li>
                  </ul>
                </div>

                <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-900">
                  <p className="font-medium text-red-800 dark:text-red-300 mb-2">Prohibited Uses:</p>
                  <ul className="text-sm text-red-700 dark:text-red-400 space-y-1">
                    <li>• Using VALORHIVE branding as your own logo or identity</li>
                    <li>• Modifying or distorting the VALORHIVE logo</li>
                    <li>• Creating products or merchandise with VALORHIVE branding</li>
                    <li>• Using VALORHIVE branding to imply endorsement without authorization</li>
                    <li>• Registering domains or social media handles containing &quot;VALORHIVE&quot;</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">3. User-Generated Content</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <div className="flex items-start gap-3 mb-4">
                <Image className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" aria-hidden="true" />
                <p className="text-muted-foreground">
                  Content you submit to VALORHIVE (profile photos, tournament media, etc.):
                </p>
              </div>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>You retain ownership of your original content</li>
                <li>By uploading, you grant VALORHIVE a non-exclusive, worldwide, royalty-free license to use, display, and distribute your content on the platform</li>
                <li>You represent that you have the right to upload and share the content</li>
                <li>You must not upload content that infringes on others&apos; intellectual property rights</li>
                <li>VALORHIVE may remove content that violates this policy or applicable laws</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">4. Tournament Media</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <div className="flex items-start gap-3 mb-4">
                <Video className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-muted-foreground">
                  Photos, videos, and recordings from VALORHIVE tournaments:
                </p>
              </div>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>VALORHIVE owns rights to all official tournament media</li>
                <li>Players grant VALORHIVE rights to use their likeness in tournament coverage</li>
                <li>Personal photography for non-commercial use is generally permitted</li>
                <li>Commercial use of tournament media requires written permission</li>
                <li>Streaming or broadcasting of matches is restricted unless authorized</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">5. Third-Party Content</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground mb-4">
                VALORHIVE may contain or link to third-party content. Such content remains the property of its respective owners. Users must:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Respect the intellectual property rights of third parties</li>
                <li>Not reproduce or distribute third-party content without permission</li>
                <li>Report any unauthorized third-party content on VALORHIVE</li>
                <li>Obtain necessary licenses before using third-party works</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">6. Copyright Infringement Claims</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground mb-4">
                If you believe your intellectual property has been infringed on VALORHIVE, please submit a DMCA-style notice including:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Your name and contact information</li>
                <li>Description of the copyrighted work you claim has been infringed</li>
                <li>URL or location of the infringing content on VALORHIVE</li>
                <li>Statement that you have a good faith belief the use is unauthorized</li>
                <li>Statement that the information is accurate, under penalty of perjury</li>
                <li>Your physical or electronic signature</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                Send notices to: ip@valorhive.com
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">7. Counter-Notification</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground mb-4">
                If your content was removed and you believe it was a mistake, you may submit a counter-notification:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Your name and contact information</li>
                <li>URL of the removed content</li>
                <li>Statement under penalty of perjury that you have a good faith belief the content was removed due to mistake or misidentification</li>
                <li>Consent to jurisdiction of courts in Bengaluru, India</li>
                <li>Your physical or electronic signature</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                Counter-notifications are processed within 10-14 business days.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">8. Licensing Inquiries</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground mb-4">
                For licensing VALORHIVE intellectual property:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Media and press: media@valorhive.com</li>
                <li>Partnership and branding: partnerships@valorhive.com</li>
                <li>Merchandise licensing: licensing@valorhive.com</li>
                <li>Technology licensing: tech-licensing@valorhive.com</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">9. DMCA Agent</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground">VALORHIVE&apos;s designated agent for copyright matters:</p>
              <ul className="list-none space-y-1 text-muted-foreground mt-2">
                <li>Email: ip@valorhive.com</li>
                <li>Address: VALORHIVE Legal Department, Bengaluru, Karnataka, India</li>
                <li>Phone: +91 98765 43210</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">10. Enforcement</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground">
                VALORHIVE reserves the right to take action against intellectual property violations, including content removal, account suspension, and legal proceedings. Repeat infringers will have their accounts terminated. We cooperate with law enforcement on intellectual property crimes.
              </p>
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
