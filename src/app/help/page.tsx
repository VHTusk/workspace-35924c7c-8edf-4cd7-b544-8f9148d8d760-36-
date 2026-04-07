"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  HelpCircle, 
  Trophy, 
  CreditCard, 
  User, 
  Shield, 
  MessageCircle,
  ChevronRight 
} from "lucide-react";

const helpCategories = [
  {
    icon: Trophy,
    title: "Tournaments",
    description: "Registration, brackets, scoring, and results",
    href: "/faq?t=tournaments",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
  {
    icon: CreditCard,
    title: "Payments & Refunds",
    description: "Subscriptions, payments, and refund process",
    href: "/faq?t=payments",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  {
    icon: User,
    title: "Account & Profile",
    description: "Profile setup, settings, and verification",
    href: "/faq?t=account",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    icon: Shield,
    title: "Privacy & Security",
    description: "Data protection and account security",
    href: "/faq?t=security",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
];

const popularArticles = [
  {
    title: "How do I register for a tournament?",
    href: "/faq#tournament-registration",
  },
  {
    title: "What is the PLAYER tier subscription?",
    href: "/faq#subscription",
  },
  {
    title: "How are rankings calculated?",
    href: "/faq#rankings",
  },
  {
    title: "How do refunds work?",
    href: "/legal/refunds",
  },
  {
    title: "How do I verify my phone/email?",
    href: "/faq#verification",
  },
];

export default function HelpCenterPage() {
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

      {/* Hero */}
      <section className="bg-gradient-to-b from-muted/50 to-background py-12 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <HelpCircle className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">How can we help you?</h1>
          <p className="text-muted-foreground text-lg mb-6">
            Find answers to common questions or get in touch with our support team
          </p>
          
          {/* Search placeholder */}
          <div className="max-w-xl mx-auto">
            <div className="relative">
              <input
                type="text"
                placeholder="Search for help..."
                className="w-full px-4 py-3 pr-4 rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Help Categories */}
      <section className="py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-semibold mb-6">Browse by Category</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {helpCategories.map((category) => (
              <Link key={category.title} href={category.href}>
                <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
                  <CardContent className="p-4 flex items-start gap-4">
                    <div className={`p-3 rounded-xl ${category.bgColor}`}>
                      <category.icon className={`h-6 w-6 ${category.color}`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">{category.title}</h3>
                      <p className="text-sm text-muted-foreground">{category.description}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Articles */}
      <section className="py-8 px-4 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-semibold mb-6">Popular Articles</h2>
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {popularArticles.map((article, index) => (
                  <li key={index}>
                    <Link 
                      href={article.href}
                      className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-foreground">{article.title}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Contact Support */}
      <section className="py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
            <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <MessageCircle className="h-8 w-8 text-primary" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="font-semibold text-lg mb-1">Still need help?</h3>
                <p className="text-muted-foreground">
                  Our support team is available 9 AM - 9 PM IST, 7 days a week
                </p>
              </div>
              <div className="flex gap-2">
                <Link href="/contact">
                  <Button>Contact Support</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Quick Links */}
      <section className="py-8 px-4 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-semibold mb-4">Quick Links</h2>
          <div className="flex flex-wrap gap-4">
            <Link href="/faq">
              <Button variant="outline" size="sm">View All FAQs</Button>
            </Link>
            <Link href="/legal/terms">
              <Button variant="outline" size="sm">Terms of Service</Button>
            </Link>
            <Link href="/legal/privacy">
              <Button variant="outline" size="sm">Privacy Policy</Button>
            </Link>
            <Link href="/feedback">
              <Button variant="outline" size="sm">Submit Feedback</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-6 mt-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2026 VALORHIVE. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
