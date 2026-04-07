"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  ArrowLeft, 
  MessageSquare,
  Star,
  Send,
  ThumbsUp,
  Bug,
  Lightbulb,
  HelpCircle,
  CheckCircle 
} from "lucide-react";

const feedbackTypes = [
  {
    id: "bug",
    icon: Bug,
    title: "Bug Report",
    description: "Something isn't working correctly",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
  },
  {
    id: "feature",
    icon: Lightbulb,
    title: "Feature Request",
    description: "Suggest a new feature or improvement",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
  {
    id: "general",
    icon: MessageSquare,
    title: "General Feedback",
    description: "Share your thoughts and experience",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    id: "question",
    icon: HelpCircle,
    title: "Question",
    description: "Ask us something",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
];

export default function FeedbackPage() {
  const [submitted, setSubmitted] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
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
              <MessageSquare className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Share Your Feedback</h1>
          <p className="text-muted-foreground text-lg">
            Help us improve VALORHIVE. We read every piece of feedback.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {submitted ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-4">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">Thank You!</h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Your feedback has been submitted successfully. We appreciate you taking the time to help us improve VALORHIVE.
              </p>
              <div className="flex justify-center gap-4">
                <Button onClick={() => {
                  setSubmitted(false);
                  setSelectedType(null);
                  setRating(null);
                }}>
                  Submit More Feedback
                </Button>
                <Link href="/">
                  <Button variant="outline">Back to Home</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Feedback Type */}
            <div>
              <h2 className="text-lg font-semibold mb-4">What type of feedback is this?</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {feedbackTypes.map((type) => (
                  <Card 
                    key={type.id}
                    className={`cursor-pointer transition-all hover:border-primary/50 ${
                      selectedType === type.id ? 'border-primary ring-2 ring-primary/20' : ''
                    }`}
                    onClick={() => setSelectedType(type.id)}
                  >
                    <CardContent className="p-4 flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${type.bgColor}`}>
                        <type.icon className={`h-5 w-5 ${type.color}`} />
                      </div>
                      <div>
                        <h3 className="font-medium">{type.title}</h3>
                        <p className="text-sm text-muted-foreground">{type.description}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Rating */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Rate Your Experience</CardTitle>
                <CardDescription>
                  How would you rate your overall experience with VALORHIVE?
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      className="p-1 transition-transform hover:scale-110"
                    >
                      <Star
                        className={`h-8 w-8 ${
                          rating && star <= rating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-muted-foreground'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <p className="text-center text-sm text-muted-foreground mt-2">
                  {rating === 1 && "We're sorry to hear that 😞"}
                  {rating === 2 && "We'll work to improve 🙁"}
                  {rating === 3 && "Thanks for your feedback 😐"}
                  {rating === 4 && "Great to hear! 😊"}
                  {rating === 5 && "Awesome! We're thrilled! 🎉"}
                </p>
              </CardContent>
            </Card>

            {/* Feedback Form */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tell Us More</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Title</label>
                    <Input 
                      placeholder="Brief summary of your feedback" 
                      required 
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Details</label>
                    <Textarea 
                      placeholder="Please share as much detail as possible..."
                      rows={6}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Email (optional)</label>
                      <Input 
                        type="email"
                        placeholder="your@email.com"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        For follow-up on your feedback
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Page/Feature (optional)</label>
                      <Input 
                        placeholder="e.g., Tournament Registration"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Where did you encounter this?
                      </p>
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full sm:w-auto"
                    disabled={!selectedType}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Submit Feedback
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="border-amber-500/20">
                <CardContent className="p-4 flex items-center gap-4">
                  <ThumbsUp className="h-8 w-8 text-amber-500" />
                  <div>
                    <h3 className="font-medium">Enjoying VALORHIVE?</h3>
                    <p className="text-sm text-muted-foreground">
                      Leave us a review on the app store
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-blue-500/20">
                <CardContent className="p-4 flex items-center gap-4">
                  <HelpCircle className="h-8 w-8 text-blue-500" />
                  <div>
                    <h3 className="font-medium">Need immediate help?</h3>
                    <p className="text-sm text-muted-foreground">
                      <Link href="/contact" className="text-primary hover:underline">
                        Contact support
                      </Link>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
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
