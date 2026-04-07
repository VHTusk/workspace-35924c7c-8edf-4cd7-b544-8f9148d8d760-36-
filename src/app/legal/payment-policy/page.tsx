"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CreditCard, Shield, Clock, Receipt } from "lucide-react";

export default function PaymentBillingPolicyPage() {
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
          <div className="p-3 rounded-xl bg-blue-500/10">
            <CreditCard className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Payment & Billing Policy</h1>
            <p className="text-muted-foreground">Last updated: March 2026</p>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">1. Accepted Payment Methods</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground mb-4">
                VALORHIVE accepts the following payment methods through our secure payment gateway (Razorpay):
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li><strong>UPI:</strong> Google Pay, PhonePe, Paytm, BHIM, and other UPI apps</li>
                <li><strong>Credit Cards:</strong> Visa, Mastercard, American Express, RuPay</li>
                <li><strong>Debit Cards:</strong> All major Indian bank debit cards</li>
                <li><strong>Net Banking:</strong> All major Indian banks</li>
                <li><strong>Wallets:</strong> Paytm, PhonePe, Amazon Pay, Mobikwik</li>
                <li><strong>EMI:</strong> Available for orders above ₹3,000 (credit card only)</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">2. Pricing & Currency</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>All prices are displayed in Indian Rupees (INR) inclusive of applicable taxes</li>
                <li>GST (Goods and Services Tax) is included in displayed prices</li>
                <li>Prices may vary based on tournament type, scope, and timing</li>
                <li>Early bird discounts are applied automatically when available</li>
                <li>Prices are subject to change without prior notice</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">3. Subscription Billing</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <div className="flex items-start gap-3 mb-4">
                <Clock className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-muted-foreground">
                  VALORHIVE offers annual subscriptions with the following billing terms:
                </p>
              </div>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li><strong>Annual Subscription:</strong> ₹1,200 per year per sport</li>
                <li>Billing occurs at the time of purchase and annually thereafter</li>
                <li>Subscription period: 1 year from date of purchase</li>
                <li>Auto-renewal is enabled by default; can be disabled in settings</li>
                <li>Renewal reminders are sent 7 days before expiry</li>
                <li>Prorated refunds available for annual subscriptions (see Refund Policy)</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">4. Tournament Entry Fees</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Entry fees are collected at the time of registration</li>
                <li>Payment must be completed to confirm registration</li>
                <li>Fee includes tournament participation and platform charges</li>
                <li>Some tournaments may have early bird pricing</li>
                <li>Late registration may incur additional fees</li>
                <li>Team tournaments: Captain pays the full team fee</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">5. Payment Processing</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <div className="flex items-start gap-3 mb-4">
                <Shield className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <p className="text-muted-foreground">
                  All payments are processed securely through Razorpay, a PCI DSS Level 1 compliant payment gateway:
                </p>
              </div>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>256-bit SSL encryption for all transactions</li>
                <li>3D Secure authentication for card payments</li>
                <li>VALORHIVE does not store your complete card details</li>
                <li>Payment confirmation is sent via email and SMS</li>
                <li>Transaction ID is provided for all payments</li>
                <li>Failed transactions are automatically refunded within 5-7 business days</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">6. Invoices & Receipts</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <div className="flex items-start gap-3 mb-4">
                <Receipt className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-muted-foreground">
                  Tax invoices are automatically generated for all transactions:
                </p>
              </div>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Invoices are sent to your registered email address</li>
                <li>Access invoices from your profile under &quot;Payment History&quot;</li>
                <li> GST invoice with company details available for organizations</li>
                <li>Invoice includes: GST number, HSN/SAC code, and tax breakdown</li>
                <li>Updated invoices provided for any adjustments or refunds</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">7. Failed & Pending Payments</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>If payment fails, amount is not charged to your account</li>
                <li>Pending payments show as &quot;Processing&quot; in transaction history</li>
                <li>Bank-refunded failed transactions take 5-7 business days</li>
                <li>Contact support if amount is deducted but payment shows failed</li>
                <li>Do not attempt multiple payments for the same registration</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">8. Taxes</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>All prices include applicable GST (currently 18%)</li>
                <li>Tax invoices include GST details for business claims</li>
                <li>TDS may be deducted from prize money as per Income Tax Act</li>
                <li>PAN card required for prize amounts above ₹10,000</li>
                <li>International payments subject to additional taxes/fees</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">9. Prize Money & Payouts</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Prize money is credited to bank account within 7-14 days</li>
                <li>PAN card and bank account verification required</li>
                <li>TDS deducted at source: 30% for winnings above ₹10,000</li>
                <li>Form 16A provided for TDS deductions</li>
                <li>Prize cannot be transferred to another person</li>
                <li>Team prizes split equally among team members</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">10. Disputes & Chargebacks</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Contact support before initiating a chargeback</li>
                <li>Disputes are investigated within 5 business days</li>
                <li>Provide transaction ID and payment proof for faster resolution</li>
                <li>Chargebacks may result in account suspension</li>
                <li>Fraudulent chargebacks are reported to credit bureaus</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">11. Payment Security</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="font-medium text-foreground mb-2">We Never Ask For:</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Complete card number via email/phone</li>
                    <li>• CVV or OTP via email/phone</li>
                    <li>• PIN or password</li>
                    <li>• Card photo or screenshot</li>
                  </ul>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                  <p className="font-medium text-green-800 dark:text-green-300 mb-2">Security Tips:</p>
                  <ul className="text-sm text-green-700 dark:text-green-400 space-y-1">
                    <li>• Only pay through the official VALORHIVE app</li>
                    <li>• Check URL before entering payment details</li>
                    <li>• Never share OTP with anyone</li>
                    <li>• Report suspicious activity immediately</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">12. Contact for Payment Issues</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <ul className="list-none space-y-1 text-muted-foreground">
                <li>Email: payments@valorhive.com</li>
                <li>Phone: +91 98765 43210 (Mon-Sat, 9 AM - 6 PM IST)</li>
                <li>WhatsApp: +91 98765 43210</li>
                <li>Support Ticket: Available in app under Help section</li>
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
