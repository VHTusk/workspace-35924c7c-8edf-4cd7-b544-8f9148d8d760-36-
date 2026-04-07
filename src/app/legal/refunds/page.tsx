"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RotateCcw } from "lucide-react";

export default function RefundPolicyPage() {
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
            <RotateCcw className="h-6 w-6 text-amber-500" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Refund Policy</h1>
            <p className="text-muted-foreground">Last updated: March 2026</p>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Refund Eligibility</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground mb-4">
                Refunds are processed based on the timing of your cancellation request relative to the tournament schedule:
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 text-foreground">Timing</th>
                      <th className="text-left py-2 text-foreground">Refund %</th>
                      <th className="text-left py-2 text-foreground">Description</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-b">
                      <td className="py-2 pr-4">Before Registration Deadline</td>
                      <td className="py-2">100%</td>
                      <td className="py-2">Full refund</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 pr-4">After Reg Deadline, Before Tournament Start</td>
                      <td className="py-2">100%</td>
                      <td className="py-2">Full refund (minus processing fees)</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 pr-4">After Tournament Start (Partial)</td>
                      <td className="py-2">50%</td>
                      <td className="py-2">Pro-rata refund based on matches played</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4">After Tournament Completion</td>
                      <td className="py-2">0%</td>
                      <td className="py-2">No refund</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tournament Cancellation by VALORHIVE</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground mb-4">
                If a tournament is cancelled by VALORHIVE or the organizer, you will receive:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li><strong>100% refund</strong> of your entry fee</li>
                <li>Automatic processing within 5-7 business days</li>
                <li>Notification via email and SMS</li>
                <li>Option to transfer registration to a future tournament</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Subscription Refunds</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Monthly subscriptions: No refund for partial months</li>
                <li>Annual subscriptions: Pro-rated refund for unused months</li>
                <li>Refunds processed within 7-10 business days</li>
                <li>Subscription benefits end immediately upon refund</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">How to Request a Refund</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                <li>Go to your profile and select &quot;My Registrations&quot;</li>
                <li>Find the tournament and click &quot;Request Refund&quot;</li>
                <li>Select the reason for cancellation</li>
                <li>Submit the request</li>
                <li>Receive confirmation email with refund timeline</li>
              </ol>
              <p className="text-muted-foreground mt-4">
                Alternatively, contact our support team at refunds@valorhive.com
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Processing Time</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li><strong>UPI:</strong> 1-3 business days</li>
                <li><strong>Bank Account:</strong> 5-7 business days</li>
                <li><strong>Wallet:</strong> 1-2 business days</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                Refunds are credited to the original payment method used during registration.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Non-Refundable Items</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Platform fees and service charges</li>
                <li>Merchandise purchases (unless defective)</li>
                <li>Completed tournament registrations where you participated</li>
                <li>Digital goods and certificates</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contact for Refund Queries</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <ul className="list-none space-y-1 text-muted-foreground">
                <li>Email: refunds@valorhive.com</li>
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
