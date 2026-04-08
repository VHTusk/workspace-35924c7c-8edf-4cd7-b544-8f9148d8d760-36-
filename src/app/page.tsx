"use client";

import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggleCompact } from "@/components/theme-toggle";
import SiteFooter from "@/components/layout/site-footer";
import GoogleOneTap from "@/components/auth/google-one-tap";
import {
  Trophy,
  Users,
  MapPin,
  Award,
  Target,
  Calendar,
  TrendingUp,
  Shield,
  Zap,
  ChevronRight,
} from "lucide-react";

export default function HomePage() {
  const sports = [
    {
      id: "cornhole",
      name: "Cornhole",
      tagline: "Throw. Score. Win.",
      href: "/cornhole",
      gradient: "from-green-500 to-emerald-600",
      heroImage: "/images/cornhole-hero.png",
      stats: [
        { label: "Active Players", value: "5,000+" },
        { label: "Tournaments", value: "250+" },
        { label: "Prize Pool", value: "₹25L+" },
      ],
    },
    {
      id: "darts",
      name: "Darts",
      tagline: "Precision Meets Passion",
      href: "/darts",
      gradient: "from-teal-500 to-cyan-600",
      heroImage: "/images/darts-hero.png",
      stats: [
        { label: "Active Players", value: "5,000+" },
        { label: "Tournaments", value: "250+" },
        { label: "Prize Pool", value: "₹25L+" },
      ],
    },
  ];

  const howItWorks = [
    {
      step: 1,
      title: "Register",
      description: "Create your player profile and choose your sport",
      icon: Users,
    },
    {
      step: 2,
      title: "Find Tournaments",
      description: "Browse tournaments by city, date, or skill level",
      icon: Calendar,
    },
    {
      step: 3,
      title: "Compete",
      description: "Participate in matches and climb the brackets",
      icon: Target,
    },
    {
      step: 4,
      title: "Earn Points",
      description: "Win matches and earn ranking points",
      icon: TrendingUp,
    },
    {
      step: 5,
      title: "Rise Up",
      description: "Progress from city to national level",
      icon: Award,
    },
  ];

  const features = [
    {
      icon: Trophy,
      title: "Tournament Management",
      description:
        "Seamless registration, live brackets, and real-time score updates for all tournament formats.",
    },
    {
      icon: TrendingUp,
      title: "Dual Rating System",
      description:
        "Hidden Elo for fair seeding plus visible achievement points to track your competitive journey.",
    },
    {
      icon: MapPin,
      title: "Geographic Tiers",
      description:
        "Compete at City, District, State, and National levels with clear progression pathways.",
    },
    {
      icon: Shield,
      title: "Fair Play System",
      description:
        "Anti-cheat measures, dispute resolution, and verified referee network for integrity.",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="VALORHIVE" width={32} height={32} className="h-8 w-auto" priority />
            <span className="text-lg font-bold text-foreground">VALORHIVE</span>
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggleCompact />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-muted/50 to-background py-12 sm:py-16 lg:py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <Link href="/" className="inline-flex items-center gap-3 mb-6">
            <Image src="/logo.png" alt="VALORHIVE" width={80} height={80} className="h-16 w-auto sm:h-20" priority />
            <span className="text-3xl sm:text-4xl font-bold text-foreground">VALORHIVE</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-3">
            India&apos;s Premier Inclusive Sports Ecosystem
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground italic mb-6">
            &quot;Every sport deserves a stage. VALORHIVE builds it.&quot;
          </p>
          <Badge
            variant="outline"
            className="border-amber-300 text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 dark:text-amber-400 text-base px-4 py-2"
          >
            <Trophy className="mr-2 h-5 w-5" />
            Compete • Climb • Conquer
          </Badge>
          <div className="mx-auto mt-8 max-w-sm rounded-2xl border border-border/60 bg-card/80 p-4 shadow-sm backdrop-blur">
            <p className="mb-3 text-sm font-medium text-foreground">Continue with Google</p>
            <GoogleOneTap />
          </div>
        </div>
      </section>

      {/* Sports Cards Section */}
      <section className="py-12 sm:py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Choose Your Sport</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Select a sport to explore tournaments, leaderboards, and competitions happening near you
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {sports.map((sport) => (
              <Link key={sport.id} href={sport.href} className="group">
                <Card className="border-2 overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 hover:border-primary/20">
                  <CardContent className="p-0 relative">
                    {/* Background Image */}
                    <div className="absolute inset-0">
                      <img
                        src={sport.heroImage}
                        alt={sport.name}
                        className="w-full h-full object-cover"
                      />
                      <div className={`absolute inset-0 bg-gradient-to-t ${sport.gradient} opacity-70`} />
                    </div>
                    <div className="relative p-6 sm:p-8 min-h-[320px] flex flex-col justify-between">
                      <div>
                        <h3 className="text-3xl sm:text-4xl font-bold text-white mb-2">
                          {sport.name}
                        </h3>
                        <p className="text-white/90 font-medium text-lg sm:text-xl mb-6">
                          {sport.tagline}
                        </p>
                        {/* Glass morphism stat boxes */}
                        <div className="grid grid-cols-3 gap-3 mb-6">
                          {sport.stats.map((stat, idx) => (
                            <div
                              key={idx}
                              className="bg-white/20 backdrop-blur-md rounded-lg p-3 text-center border border-white/30"
                            >
                              <p className="text-lg sm:text-xl font-bold text-white">
                                {stat.value}
                              </p>
                              <p className="text-xs text-white/80">{stat.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <Button
                        className="w-full bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-xl py-6 text-base shadow-xl text-white border border-white/30"
                      >
                        Enter {sport.name}
                        <ChevronRight className="ml-2 h-5 w-5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-12 sm:py-16 px-4 bg-muted/30 border-y border-border">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">How It Works</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Your journey from local player to national champion in 5 simple steps
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-3">
            {howItWorks.map((item, idx) => (
              <div key={idx} className="relative">
                <Card className="border-border bg-card hover:shadow-lg transition-shadow h-full">
                  <CardContent className="p-4 text-center">
                    <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
                      <span className="text-lg font-bold text-primary">{item.step}</span>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mx-auto mb-3">
                      <item.icon className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </CardContent>
                </Card>
                {idx < howItWorks.length - 1 && (
                  <div className="hidden lg:flex absolute top-1/2 -right-1.5 transform -translate-y-1/2 z-10">
                    <ChevronRight className="w-3 h-3 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 sm:py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
              Built for Champions
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Professional-grade features designed for competitive players and tournament organizers
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, idx) => (
              <Card
                key={idx}
                className="border-border bg-card hover:shadow-lg transition-all hover:-translate-y-1"
              >
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 sm:py-16 px-4 bg-muted/30 border-y border-border">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
              Growing Every Day
            </h2>
            <p className="text-muted-foreground">Join thousands of players already competing</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 lg:gap-8">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-3">
                <Trophy className="w-7 h-7 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-3xl sm:text-4xl font-bold text-green-600 dark:text-green-400">
                500+
              </p>
              <p className="text-sm text-muted-foreground">Tournaments</p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center mx-auto mb-3">
                <Users className="w-7 h-7 text-teal-600 dark:text-teal-400" />
              </div>
              <p className="text-3xl sm:text-4xl font-bold text-teal-600 dark:text-teal-400">
                10,000+
              </p>
              <p className="text-sm text-muted-foreground">Players</p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-3">
                <MapPin className="w-7 h-7 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="text-3xl sm:text-4xl font-bold text-amber-600 dark:text-amber-400">
                50+
              </p>
              <p className="text-sm text-muted-foreground">Cities</p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mx-auto mb-3">
                <Award className="w-7 h-7 text-purple-600 dark:text-purple-400" />
              </div>
              <p className="text-3xl sm:text-4xl font-bold text-purple-600 dark:text-purple-400">
                ₹50L+
              </p>
              <p className="text-sm text-muted-foreground">Prize Pool</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <Zap className="w-12 h-12 text-primary mx-auto mb-4" />
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
            Ready to Start Competing?
          </h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Join VALORHIVE today and be part of India&apos;s fastest growing sports community. Registration
            is free!
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/cornhole/register">
              <Button size="lg" className="bg-green-600 hover:bg-green-700 text-white shadow-lg">
                <Trophy className="mr-2 h-5 w-5" />
                Join Cornhole
              </Button>
            </Link>
            <Link href="/darts/register">
              <Button size="lg" className="bg-teal-600 hover:bg-teal-700 text-white shadow-lg">
                <Target className="mr-2 h-5 w-5" />
                Join Darts
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <SiteFooter />
    </div>
  );
}
