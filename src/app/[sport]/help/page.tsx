import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  HelpCircle,
  BookOpen,
  MessageCircle,
  Mail,
  Phone,
  Video,
  FileText,
  Users,
  Trophy,
  CreditCard,
  Shield,
  ChevronRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Help Center | VALORHIVE",
  description: "Get help with VALORHIVE - Find answers, tutorials, and support for tournament management.",
};

const helpCategories = [
  {
    title: "Getting Started",
    icon: BookOpen,
    description: "New to VALORHIVE? Start here.",
    articles: [
      "How to create an account",
      "Understanding tournament formats",
      "Player registration guide",
      "Organization setup",
    ],
  },
  {
    title: "Tournaments",
    icon: Trophy,
    description: "Everything about tournaments.",
    articles: [
      "Joining a tournament",
      "Tournament rules and formats",
      "Bracket explained",
      "Scoring system",
    ],
  },
  {
    title: "Payments",
    icon: CreditCard,
    description: "Payment and refund help.",
    articles: [
      "Payment methods",
      "Entry fee refunds",
      "Prize money distribution",
      "Payment issues",
    ],
  },
  {
    title: "Account & Security",
    icon: Shield,
    description: "Keep your account safe.",
    articles: [
      "Password reset",
      "Two-factor authentication",
      "Privacy settings",
      "Account verification",
    ],
  },
];

const popularQuestions = [
  {
    question: "How do I join a tournament?",
    answer: "Browse tournaments from the Tournaments page, click on a tournament you're interested in, and click the 'Register' button. You'll need to complete your profile and pay any entry fee if applicable. Once registered, you'll receive confirmation and tournament updates.",
  },
  {
    question: "What happens if I miss my match?",
    answer: "If you miss your scheduled match time, you may be marked as a 'no-show' after a grace period (typically 15 minutes). The tournament director has discretion to grant extensions or award a walkover to your opponent. Always check in on time and contact the director if you anticipate delays.",
  },
  {
    question: "How is my rating calculated?",
    answer: "VALORHIVE uses an ELO-based rating system. Your rating increases when you win against higher-rated opponents and decreases when you lose to lower-rated opponents. The system considers tournament scope (city, district, state, national) for point allocation.",
  },
  {
    question: "Can I get a refund if I withdraw?",
    answer: "Refund eligibility depends on when you withdraw: 100% refund before registration deadline, 100% before tournament start (may deduct processing fee), 50% after tournament starts (partial), and 0% after completion. Check the specific tournament's refund policy.",
  },
  {
    question: "How do I register my organization?",
    answer: "Click 'Register' and select 'Organization Account'. Choose your organization type (School, College, Club, Corporate, etc.), fill in required details, and submit verification documents. Our team reviews applications within 2-3 business days.",
  },
  {
    question: "What if there's a dispute about match results?",
    answer: "If you disagree with a match result, you can raise a dispute within 48 hours of the tournament completion through the tournament page. Provide evidence (screenshots, witness statements) and the tournament director will review. Appeals escalate to admins if needed.",
  },
];

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-muted/50 to-background py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <HelpCircle className="w-16 h-16 mx-auto mb-6 text-primary" />
            <h1 className="text-4xl font-bold mb-4">How can we help you?</h1>
            <p className="text-lg text-muted-foreground mb-8">
              Find answers, tutorials, and support for VALORHIVE
            </p>
            {/* Search Bar */}
            <div className="relative max-w-xl mx-auto">
              <input
                type="text"
                placeholder="Search for help..."
                className="w-full px-6 py-4 rounded-full border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <Button className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full">
                Search
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Help Categories */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold mb-8 text-center">Browse by Category</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {helpCategories.map((category) => (
              <Card key={category.title} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <category.icon className="w-10 h-10 mb-2 text-primary" />
                  <CardTitle className="text-lg">{category.title}</CardTitle>
                  <CardDescription>{category.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {category.articles.map((article) => (
                      <li key={article}>
                        <Link
                          href="#"
                          className="flex items-center text-sm text-muted-foreground hover:text-primary transition-colors"
                        >
                          <ChevronRight className="w-4 h-4 mr-1" />
                          {article}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Questions */}
      <section className="py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold mb-8 text-center">Popular Questions</h2>
          <div className="max-w-3xl mx-auto">
            <Accordion type="single" collapsible className="w-full">
              {popularQuestions.map((item, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className="text-left">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* Contact Options */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold mb-8 text-center">Still need help?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <Card className="text-center">
              <CardHeader>
                <MessageCircle className="w-10 h-10 mx-auto mb-2 text-primary" />
                <CardTitle>Live Chat</CardTitle>
                <CardDescription>Chat with our support team</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full">Start Chat</Button>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <Mail className="w-10 h-10 mx-auto mb-2 text-primary" />
                <CardTitle>Email Support</CardTitle>
                <CardDescription>Get help via email</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" asChild>
                  <a href="mailto:support@valorhive.com">support@valorhive.com</a>
                </Button>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <Phone className="w-10 h-10 mx-auto mb-2 text-primary" />
                <CardTitle>Phone Support</CardTitle>
                <CardDescription>Call us directly</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" asChild>
                  <a href="tel:+911234567890">+91 12345 67890</a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Resources */}
      <section className="py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold mb-8 text-center">Resources</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <Video className="w-8 h-8 mb-4 text-primary" />
                <h3 className="font-semibold mb-2">Video Tutorials</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Watch step-by-step guides for common tasks
                </p>
                <Button variant="link" className="p-0">Watch Now →</Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <FileText className="w-8 h-8 mb-4 text-primary" />
                <h3 className="font-semibold mb-2">Documentation</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Detailed guides and API documentation
                </p>
                <Button variant="link" className="p-0">Read Docs →</Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <Users className="w-8 h-8 mb-4 text-primary" />
                <h3 className="font-semibold mb-2">Community Forum</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Connect with other players and organizers
                </p>
                <Button variant="link" className="p-0">Join Community →</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
