"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Cookie } from "lucide-react";

export default function CookiePolicyPage() {
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
            <Cookie className="h-6 w-6 text-orange-500" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Cookie Policy</h1>
            <p className="text-muted-foreground">Last updated: March 2026</p>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">What Are Cookies?</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground">
                Cookies are small text files stored on your device when you visit our website. They help us provide a better user experience by remembering your preferences and understanding how you use our platform.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Types of Cookies We Use</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-foreground">Essential Cookies</h4>
                  <p className="text-muted-foreground text-sm">
                    Required for the platform to function. These include session tokens, authentication cookies, and security-related cookies. Cannot be disabled.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Functional Cookies</h4>
                  <p className="text-muted-foreground text-sm">
                    Remember your preferences like language, theme (dark/light mode), and notification settings. Can be disabled but may affect user experience.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Analytics Cookies</h4>
                  <p className="text-muted-foreground text-sm">
                    Help us understand how users interact with our platform. We use these to improve our services. Anonymous data only.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Marketing Cookies</h4>
                  <p className="text-muted-foreground text-sm">
                    Used to deliver relevant advertisements. Can be disabled through your browser settings or our cookie preferences.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Specific Cookies We Use</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 text-foreground">Cookie Name</th>
                      <th className="text-left py-2 pr-4 text-foreground">Purpose</th>
                      <th className="text-left py-2 text-foreground">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-b">
                      <td className="py-2 pr-4">session_token</td>
                      <td className="py-2 pr-4">Authentication</td>
                      <td className="py-2">30 days</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 pr-4">theme</td>
                      <td className="py-2 pr-4">Dark/Light mode preference</td>
                      <td className="py-2">1 year</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 pr-4">language</td>
                      <td className="py-2 pr-4">Language preference</td>
                      <td className="py-2">1 year</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 pr-4">_ga</td>
                      <td className="py-2 pr-4">Google Analytics</td>
                      <td className="py-2">2 years</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4">consent</td>
                      <td className="py-2 pr-4">Cookie consent status</td>
                      <td className="py-2">1 year</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Managing Cookies</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground mb-4">
                You can control cookies in several ways:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li><strong>Browser Settings:</strong> Block or delete cookies through your browser&apos;s privacy settings</li>
                <li><strong>Cookie Preferences:</strong> Use our cookie consent banner to manage preferences</li>
                <li><strong>Opt-out:</strong> Some third-party cookies offer opt-out mechanisms</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                Note: Disabling essential cookies will prevent the platform from functioning correctly.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Third-Party Cookies</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground mb-4">
                We use the following third-party services that may set cookies:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li><strong>Google Analytics:</strong> Website analytics</li>
                <li><strong>Razorpay:</strong> Payment processing</li>
                <li><strong>Google OAuth:</strong> Social login</li>
                <li><strong>MSG91/Twilio:</strong> SMS verification</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                Please review these services&apos; privacy policies for their cookie practices.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contact Us</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground">
                For questions about our Cookie Policy, contact us at:
              </p>
              <ul className="list-none space-y-1 text-muted-foreground mt-2">
                <li>Email: privacy@valorhive.com</li>
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
