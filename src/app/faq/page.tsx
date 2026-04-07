"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  ChevronDown,
  ChevronUp,
  Trophy,
  CreditCard,
  User,
  Shield,
  HelpCircle
} from "lucide-react";

const faqData = {
  tournaments: {
    icon: Trophy,
    title: "Tournaments",
    color: "text-amber-500",
    questions: [
      {
        q: "How do I register for a tournament?",
        a: "To register for a tournament, navigate to the Tournaments page, select the tournament you want to join, and click 'Register'. You'll need an active PLAYER tier subscription to participate in paid tournaments. Some tournaments may have eligibility criteria based on skill level or location.",
      },
      {
        q: "Can I withdraw from a tournament after registering?",
        a: "Yes, you can withdraw from a tournament before it starts. Go to your profile, select 'My Registrations', and click 'Withdraw' on the tournament. Refunds are processed based on our Refund Policy - full refunds are available before the tournament starts, with partial refunds possible during early stages.",
      },
      {
        q: "How are match schedules determined?",
        a: "Match schedules are determined by the tournament director and are based on the bracket format. For single elimination, matches are scheduled round by round. You'll receive notifications about your upcoming matches via email, SMS, and in-app notifications.",
      },
      {
        q: "What happens if my opponent doesn't show up?",
        a: "If your opponent doesn't show up within the grace period (usually 15 minutes), they will be marked as a no-show. You can report this to the tournament director, who will verify and award you a walkover victory.",
      },
      {
        q: "How are tournament rankings calculated?",
        a: "Tournament rankings are based on your performance in matches. Wins earn you points, and your position in the tournament determines bonus points. Your overall ranking is influenced by your ELO rating, which changes based on match results against opponents of varying skill levels.",
      },
    ],
  },
  payments: {
    icon: CreditCard,
    title: "Payments & Refunds",
    color: "text-green-500",
    questions: [
      {
        q: "What payment methods are accepted?",
        a: "We accept all major payment methods through Razorpay, including UPI (Google Pay, PhonePe, Paytm), credit/debit cards, net banking, and popular wallets. International cards are also supported.",
      },
      {
        q: "What is the PLAYER tier subscription?",
        a: "The PLAYER tier is a paid subscription that unlocks full tournament participation. FAN tier users can browse tournaments but cannot compete. PLAYER tier includes unlimited tournament registrations, detailed statistics, and priority support.",
      },
      {
        q: "How do refunds work?",
        a: "Refunds are processed based on timing: 100% refund if cancelled before registration deadline, 100% (minus processing fees) if cancelled after deadline but before tournament start, 50% during early tournament stages, and no refund after tournament completion. Refunds are credited to the original payment method within 5-7 business days.",
      },
      {
        q: "Can I get a refund for my subscription?",
        a: "Monthly subscriptions are non-refundable for partial months. Annual subscriptions can be refunded on a pro-rated basis for unused months. Contact our support team to request a subscription refund.",
      },
    ],
  },
  account: {
    icon: User,
    title: "Account & Profile",
    color: "text-blue-500",
    questions: [
      {
        q: "How do I verify my phone number?",
        a: "During registration or from your profile settings, click 'Verify Phone'. You'll receive an OTP via SMS. Enter the OTP to complete verification. Verified phone numbers are required for tournament participation and prize distribution.",
      },
      {
        q: "How do I update my profile information?",
        a: "Go to your Profile page and click 'Edit Profile'. You can update your name, location, profile photo, and preferences. Some fields like date of birth and gender may have restrictions on changes for tournament eligibility purposes.",
      },
      {
        q: "How do I delete my account?",
        a: "To delete your account, go to Profile Settings > Privacy > Delete Account. You can request GDPR-compliant data deletion. Note that tournament history and rankings may be retained for record-keeping purposes.",
      },
      {
        q: "Can I change my sport preference?",
        a: "Yes, you can change your primary sport from your profile settings. However, your ELO rating and tournament history are sport-specific, so changing sports will start you with a fresh rating in the new sport.",
      },
    ],
  },
  security: {
    icon: Shield,
    title: "Privacy & Security",
    color: "text-purple-500",
    questions: [
      {
        q: "How is my data protected?",
        a: "We take data protection seriously. All passwords are hashed using bcrypt, all data transmission uses HTTPS encryption, and we follow GDPR compliance standards. Payment data is processed securely through Razorpay and is never stored on our servers.",
      },
      {
        q: "What information is displayed publicly?",
        a: "Your name and rankings appear on public leaderboards. You can control other visibility settings from your privacy preferences. By default, your email, phone, and personal details are private.",
      },
      {
        q: "How do I enable two-factor authentication?",
        a: "Two-factor authentication can be enabled from Profile Settings > Security > Two-Factor Authentication. We support authenticator apps (Google Authenticator, Authy) and SMS-based verification.",
      },
      {
        q: "What should I do if I suspect unauthorized access?",
        a: "Immediately change your password and enable two-factor authentication. Contact our support team at security@valorhive.com. We'll review your account activity and take appropriate action.",
      },
    ],
  },
};

export default function FAQPage() {
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('t');
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  const toggleItem = (key: string) => {
    setOpenItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

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
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Frequently Asked Questions</h1>
          <p className="text-muted-foreground text-lg">
            Find answers to common questions about VALORHIVE
          </p>
        </div>
      </section>

      {/* Quick Links */}
      <section className="py-4 px-4 border-b border-border bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-wrap gap-2">
            <Link href="/faq?t=tournaments">
              <Button variant={categoryParam === 'tournaments' ? 'default' : 'outline'} size="sm">
                <Trophy className="mr-2 h-4 w-4" />
                Tournaments
              </Button>
            </Link>
            <Link href="/faq?t=payments">
              <Button variant={categoryParam === 'payments' ? 'default' : 'outline'} size="sm">
                <CreditCard className="mr-2 h-4 w-4" />
                Payments
              </Button>
            </Link>
            <Link href="/faq?t=account">
              <Button variant={categoryParam === 'account' ? 'default' : 'outline'} size="sm">
                <User className="mr-2 h-4 w-4" />
                Account
              </Button>
            </Link>
            <Link href="/faq?t=security">
              <Button variant={categoryParam === 'security' ? 'default' : 'outline'} size="sm">
                <Shield className="mr-2 h-4 w-4" />
                Security
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-8">
          {Object.entries(faqData).map(([key, category]) => {
            if (categoryParam && categoryParam !== key) return null;
            
            return (
              <div key={key} id={key}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2 rounded-xl bg-muted ${category.color}`}>
                    <category.icon className="h-5 w-5" />
                  </div>
                  <h2 className="text-xl font-semibold">{category.title}</h2>
                </div>
                
                <div className="space-y-3">
                  {category.questions.map((item, index) => {
                    const itemKey = `${key}-${index}`;
                    const isOpen = openItems[itemKey];
                    
                    return (
                      <Card key={itemKey} className="overflow-hidden">
                        <button
                          onClick={() => toggleItem(itemKey)}
                          className="w-full text-left p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                        >
                          <span className="font-medium pr-4">{item.q}</span>
                          {isOpen ? (
                            <ChevronUp className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          )}
                        </button>
                        {isOpen && (
                          <div className="px-4 pb-4 text-muted-foreground">
                            {item.a}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Still Need Help */}
        <Card className="mt-8 border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
          <CardContent className="p-6 text-center">
            <h3 className="font-semibold text-lg mb-2">Still have questions?</h3>
            <p className="text-muted-foreground mb-4">
              Can&apos;t find the answer you&apos;re looking for? Please contact our support team.
            </p>
            <div className="flex justify-center gap-4">
              <Link href="/contact">
                <Button>Contact Support</Button>
              </Link>
              <Link href="/help">
                <Button variant="outline">Help Center</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
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
