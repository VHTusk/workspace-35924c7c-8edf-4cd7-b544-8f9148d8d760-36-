"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  ChartNoAxesColumn,
  CircleCheckBig,
  MapPinned,
  Search,
  ShieldCheck,
  Swords,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import GoogleOneTap from "@/components/auth/google-one-tap";
import { AUTH_SPORTS } from "@/components/auth/auth-sport-config";
import { UniversalLoginModal } from "@/components/auth/universal-login-modal";
import { UniversalRegisterModal } from "@/components/auth/universal-register-modal";
import { Button } from "@/components/ui/button";

const HERO_OUTCOMES = [
  "Verified match results",
  "Recurring city tournaments",
  "Rankings that keep moving",
];

const HOW_IT_WORKS = [
  {
    title: "Register",
    description: "Create an account and start your first competition journey.",
    icon: Users,
  },
  {
    title: "Find Tournaments",
    description: "Browse formats, cities, and upcoming match schedules.",
    icon: Search,
  },
  {
    title: "Compete",
    description: "Play in structured competition with recorded outcomes.",
    icon: Trophy,
  },
  {
    title: "Rise Up",
    description: "Track progress as your rank evolves over time.",
    icon: ChartNoAxesColumn,
  },
];

const BUILT_FOR_CHAMPIONS = [
  {
    title: "Tournament Management",
    description: "Structured operations built for recurring competitive formats.",
    icon: Trophy,
  },
  {
    title: "Dual Rating System",
    description: "Rank movement and visible points that reflect performance.",
    icon: Target,
  },
  {
    title: "Geographic Tiers",
    description: "District-to-national progression with clearer competition stages.",
    icon: MapPinned,
  },
  {
    title: "Fair Play System",
    description: "Verified results, transparent standards, and match integrity.",
    icon: ShieldCheck,
  },
];

const STATS = [
  { value: "500+", label: "Competitions" },
  { value: "10,000+", label: "Players" },
  { value: "50+", label: "Cities" },
  { value: "350L+", label: "Prize Pool" },
];

const HERO_SLIDES = [
  {
    title: "Cornhole",
    eyebrow: "Structured league action",
    description: "Recurring matches, visible rankings, and verified results built around every round.",
    image: "/images/hero/cornhole/action-shot.png",
    accent: "text-[#cfff35]",
  },
  {
    title: "Darts",
    eyebrow: "Precision under pressure",
    description: "City competitions where every throw counts and leaderboard movement stays visible.",
    image: "/images/hero/darts/action-shot.png",
    accent: "text-[#4fe2ff]",
  },
  {
    title: "Slingshots",
    eyebrow: "Fast, focused competition",
    description: "A new format ready for repeat play, clean scorekeeping, and progression-based ranking.",
    image: null,
    accent: "text-[#ff8b45]",
  },
];

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authView, setAuthView] = useState<"login" | "register" | null>(null);
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);

  useEffect(() => {
    const authParam = searchParams.get("auth");
    if (authParam === "login" || authParam === "register") {
      setAuthView(authParam);
      return;
    }

    setAuthView((current) => (current && !searchParams.get("auth") ? null : current));
  }, [searchParams]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveHeroSlide((current) => (current + 1) % HERO_SLIDES.length);
    }, 4200);

    return () => window.clearInterval(interval);
  }, []);

  const openAuth = (view: "login" | "register") => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("auth", view);
    router.replace(params.size ? `/?${params.toString()}` : "/");
  };

  const handleAuthChange = (view: "login" | "register" | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (view) {
      params.set("auth", view);
      setAuthView(view);
    } else {
      params.delete("auth");
      setAuthView(null);
    }
    router.replace(params.size ? `/?${params.toString()}` : "/");
  };

  const heroSlide = HERO_SLIDES[activeHeroSlide];

  return (
    <div className="min-h-screen bg-[#050c10] text-white">
      <GoogleOneTap showButton={false} autoPrompt />

      <main className="relative overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(24,175,206,0.18),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(238,93,14,0.14),transparent_28%),linear-gradient(180deg,#041017_0%,#050c10_48%,#03080c_100%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(24,175,206,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(24,175,206,0.12)_1px,transparent_1px)] [background-size:48px_48px]" />

        <div className="relative mx-auto max-w-[1220px]">
          <div className="overflow-hidden rounded-[30px] border border-[#18AFCE]/55 bg-[linear-gradient(180deg,rgba(7,18,24,0.96),rgba(4,10,14,0.98))] shadow-[0_0_0_1px_rgba(24,175,206,0.18),0_0_28px_rgba(24,175,206,0.2),0_0_90px_rgba(24,175,206,0.08)]">
            <header className="border-b border-[#18AFCE]/18 px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <Link href="/" className="inline-flex items-center gap-3">
                  <Image src="/logo.png" alt="VALORHIVE" width={34} height={34} className="h-9 w-auto" priority />
                  <div className="leading-tight">
                    <p className="text-sm font-semibold tracking-[0.18em] text-white/90">VALORHIVE</p>
                  </div>
                </Link>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openAuth("login")}
                    className="rounded-xl border border-[#18AFCE]/35 bg-[#07141c] px-4 py-2 text-sm font-semibold text-[#c6f7ff] shadow-[0_0_14px_rgba(24,175,206,0.14)] transition-all hover:-translate-y-0.5 hover:border-[#18AFCE]/70 hover:bg-[#0a1b24]"
                  >
                    Log in
                  </button>
                  <button
                    type="button"
                    onClick={() => openAuth("register")}
                    className="rounded-xl bg-[#d6ff3f] px-4 py-2 text-sm font-semibold text-[#10210f] shadow-[0_0_18px_rgba(214,255,63,0.28)] transition-all hover:-translate-y-0.5 hover:bg-[#c8f12c]"
                  >
                    Sign Up
                  </button>
                </div>
              </div>
            </header>

            <section id="overview" className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
              <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="overflow-hidden rounded-[26px] border border-[#18AFCE]/28 bg-[#07131b] shadow-[0_0_30px_rgba(24,175,206,0.1)]">
                  <div className="relative aspect-[16/11]">
                    {HERO_SLIDES.map((slide, index) =>
                      slide.image ? (
                        <Image
                          key={slide.title}
                          src={slide.image}
                          alt={`${slide.title} competition`}
                          fill
                          priority={index === 0}
                          className={`object-cover transition-all duration-700 ${
                            index === activeHeroSlide ? "scale-100 opacity-100" : "scale-105 opacity-0"
                          }`}
                        />
                      ) : (
                        <div
                          key={slide.title}
                          className={`absolute inset-0 transition-all duration-700 ${
                            index === activeHeroSlide ? "scale-100 opacity-100" : "scale-105 opacity-0"
                          }`}
                        >
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(238,93,14,0.38),transparent_24%),radial-gradient(circle_at_75%_30%,rgba(24,175,206,0.32),transparent_26%),linear-gradient(145deg,#091117_0%,#10242f_52%,#180d08_100%)]" />
                          <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(24,175,206,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(24,175,206,0.12)_1px,transparent_1px)] [background-size:40px_40px]" />
                          <div className="absolute inset-x-0 bottom-0 top-0 flex items-center justify-center">
                            <div className="rounded-[28px] border border-white/12 bg-black/18 p-8 shadow-[0_0_40px_rgba(238,93,14,0.18)] backdrop-blur-sm">
                              <Target className="h-20 w-20 text-[#ff8b45] drop-shadow-[0_0_22px_rgba(238,93,14,0.42)]" />
                            </div>
                          </div>
                        </div>
                      ),
                    )}
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,12,16,0.08),rgba(5,12,16,0.24)_38%,rgba(5,12,16,0.68)_100%)]" />
                    <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/18 bg-[#09161f]/78 px-3 py-1.5 backdrop-blur">
                      <CircleCheckBig className="h-4 w-4 text-[#18AFCE]" />
                      <span className="text-xs font-medium text-white/88">VALORHIVE</span>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                      <div className="rounded-[22px] border border-white/12 bg-[#07131b]/72 p-4 shadow-[0_0_24px_rgba(24,175,206,0.12)] backdrop-blur-md">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/45">
                          {heroSlide.eyebrow}
                        </p>
                        <div className="mt-2 flex items-center justify-between gap-4">
                          <div>
                            <h3 className={`text-2xl font-semibold ${heroSlide.accent}`}>{heroSlide.title}</h3>
                            <p className="mt-1 max-w-md text-sm leading-6 text-white/72">
                              {heroSlide.description}
                            </p>
                          </div>
                          <div className="hidden items-center gap-2 sm:flex">
                            {HERO_SLIDES.map((slide, index) => (
                              <button
                                key={slide.title}
                                type="button"
                                aria-label={`Show ${slide.title} slide`}
                                onClick={() => setActiveHeroSlide(index)}
                                className={`h-2.5 rounded-full transition-all ${
                                  index === activeHeroSlide
                                    ? "w-10 bg-[#18AFCE] shadow-[0_0_12px_rgba(24,175,206,0.62)]"
                                    : "w-2.5 bg-white/28 hover:bg-white/48"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col justify-center rounded-[26px] border border-[#18AFCE]/22 bg-[linear-gradient(180deg,rgba(9,19,27,0.96),rgba(5,11,15,0.96))] p-6 shadow-[inset_0_0_0_1px_rgba(24,175,206,0.06),0_0_32px_rgba(24,175,206,0.08)] sm:p-8">
                  <div className="inline-flex w-fit items-center rounded-full border border-[#18AFCE]/25 bg-[#0a1922] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7de8ff]">
                    Structured Competition
                  </div>
                  <h1 className="mt-5 max-w-[10ch] text-4xl font-semibold leading-[1.05] tracking-tight sm:text-[3.4rem]">
                    India&apos;s Premier{" "}
                    <span className="text-[#d6ff3f] [text-shadow:0_0_18px_rgba(214,255,63,0.32)]">
                      Inclusive Sports
                    </span>{" "}
                    Ecosystem
                  </h1>
                  <p className="mt-5 max-w-xl text-sm leading-7 text-white/68 sm:text-base">
                    Every sport. Every city. One competitive system where tournaments stay structured and rankings keep moving.
                  </p>

                  <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                    <Button
                      className="h-11 rounded-xl bg-[#d6ff3f] px-5 text-sm font-semibold text-[#12230f] shadow-[0_0_22px_rgba(214,255,63,0.28)] transition-all hover:-translate-y-0.5 hover:bg-[#c8f12c]"
                      onClick={() => openAuth("register")}
                    >
                      Join Upcoming Competitions
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      className="h-11 rounded-xl border-[#18AFCE]/40 bg-[#08141c] px-5 text-sm font-semibold text-[#c3f8ff] shadow-[0_0_18px_rgba(24,175,206,0.14)] transition-all hover:-translate-y-0.5 hover:bg-[#0c1c26] hover:text-white"
                    >
                      <Link href="/tournaments">
                        View Tournaments
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>

                  <p className="mt-4 text-xs font-medium uppercase tracking-[0.22em] text-white/45">
                    Starting with Cornhole, Darts, Frisbee Golf, Pickleball
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {HERO_OUTCOMES.map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-[#18AFCE]/22 bg-[linear-gradient(180deg,rgba(12,25,34,0.9),rgba(7,14,19,0.96))] px-4 py-4 text-center text-sm font-medium text-white/86 shadow-[0_0_18px_rgba(24,175,206,0.12)]"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </section>

            <section id="sports" className="px-4 pb-6 sm:px-6 lg:px-8">
              <SectionHeading
                eyebrow="Choose your sport"
                title="Choose your sport"
                description="Choose a format built for structured match play, local tournament movement, and consistent rankings."
              />

              <div className="grid gap-5">
                {AUTH_SPORTS.map((sport) => {
                  const Icon = sport.icon;
                  const isCornhole = sport.slug === "cornhole";
                  const panelClass = isCornhole
                    ? "from-[#cfff35] via-[#6fe5c0] to-[#1db8f4]"
                    : "from-[#47d5ff] via-[#27bdf1] to-[#5ef0c9]";

                  return (
                    <div
                      key={sport.slug}
                      className={`relative overflow-hidden rounded-[24px] border border-[#18AFCE]/28 bg-gradient-to-r ${panelClass} p-[1px] shadow-[0_0_22px_rgba(24,175,206,0.18)]`}
                    >
                      <div className="relative flex flex-col gap-4 rounded-[23px] bg-[linear-gradient(90deg,rgba(18,38,43,0.14),rgba(8,16,23,0.08))] px-5 py-5 text-[#10202b] sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/28 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.26)] backdrop-blur">
                            <Icon className="h-9 w-9" />
                          </div>
                          <div>
                            <h3 className="text-3xl font-semibold">{sport.label}</h3>
                            <div className="mt-3 grid grid-cols-3 gap-5 text-sm">
                              <SportStat value="5,000+" label="Players" />
                              <SportStat value="250+" label="Tournaments" />
                              <SportStat value="INR 25L+" label="Prize Pool" />
                            </div>
                          </div>
                        </div>

                        <Button
                          asChild
                          className="h-11 rounded-xl bg-[#d6ff3f] px-5 text-sm font-semibold text-[#13220f] shadow-[0_0_20px_rgba(214,255,63,0.22)] transition-all hover:-translate-y-0.5 hover:bg-[#c8f12c]"
                        >
                          <Link href={sport.tournamentsHref}>View Details</Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="px-4 pb-6 pt-2 sm:px-6 lg:px-8">
              <SectionHeading
                eyebrow="How it works"
                title="How it works"
                description="A clearer path from registration to repeat competition."
              />

              <div className="grid gap-4 md:grid-cols-4">
                {HOW_IT_WORKS.map((item) => (
                  <NeonInfoCard key={item.title} title={item.title} description={item.description} icon={item.icon} />
                ))}
              </div>
            </section>

            <section className="px-4 pb-6 pt-2 sm:px-6 lg:px-8">
              <SectionHeading
                eyebrow="Built for champions"
                title="Built for champions"
                description="Competition infrastructure designed for repeatable formats and long-term player progress."
              />

              <div className="grid gap-4 md:grid-cols-4">
                {BUILT_FOR_CHAMPIONS.map((item) => (
                  <NeonInfoCard key={item.title} title={item.title} description={item.description} icon={item.icon} />
                ))}
              </div>
            </section>

            <section className="px-4 pb-6 pt-2 sm:px-6 lg:px-8">
              <SectionHeading eyebrow="Growing every day" title="Growing every day" />

              <div className="grid gap-4 md:grid-cols-4">
                {STATS.map((item, index) => (
                  <div
                    key={item.label}
                    className="rounded-[22px] border border-[#18AFCE]/18 bg-[linear-gradient(180deg,rgba(11,20,28,0.96),rgba(6,11,15,0.96))] px-5 py-6 text-center shadow-[0_0_18px_rgba(24,175,206,0.08)]"
                  >
                    <p
                      className={
                        index === 0
                          ? "text-4xl font-semibold text-[#d6ff3f]"
                          : index === 1
                            ? "text-4xl font-semibold text-[#39d7ff]"
                            : index === 2
                              ? "text-4xl font-semibold text-[#4fd8ff]"
                              : "text-4xl font-semibold text-[#d6ff3f]"
                      }
                    >
                      {item.value}
                    </p>
                    <p className="mt-2 text-sm text-white/56">{item.label}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="px-4 pb-8 pt-2 sm:px-6 lg:px-8">
              <div className="rounded-[26px] border border-[#18AFCE]/24 bg-[radial-gradient(circle_at_left,rgba(214,255,63,0.18),transparent_32%),radial-gradient(circle_at_right,rgba(24,175,206,0.18),transparent_30%),linear-gradient(180deg,rgba(13,24,32,0.98),rgba(8,13,18,0.98))] px-6 py-8 text-center shadow-[0_0_24px_rgba(24,175,206,0.12)]">
                <h2 className="text-3xl font-semibold text-white">Ready to Start Competing?</h2>
                <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-white/62">
                  Join structured competitions, build your ranking, and move through a more consistent competitive system.
                </p>
                <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                  <Button
                    className="h-11 rounded-xl bg-[#d6ff3f] px-6 text-sm font-semibold text-[#12220f] shadow-[0_0_22px_rgba(214,255,63,0.28)] transition-all hover:-translate-y-0.5 hover:bg-[#c8f12c]"
                    onClick={() => openAuth("register")}
                  >
                    Get Started
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="h-11 rounded-xl border-[#18AFCE]/40 bg-[#08151d] px-6 text-sm font-semibold text-[#c8f7ff] shadow-[0_0_18px_rgba(24,175,206,0.12)] transition-all hover:-translate-y-0.5 hover:bg-[#0d1b24]"
                  >
                    <Link href="/tournaments">View Tournaments</Link>
                  </Button>
                </div>
              </div>
            </section>

            <footer
              id="support"
              className="border-t border-[#18AFCE]/18 px-4 py-5 text-sm text-white/45 sm:px-6 lg:px-8"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3">
                  <Image src="/logo.png" alt="VALORHIVE" width={28} height={28} className="h-7 w-auto" />
                  <span className="font-semibold text-white/80">VALORHIVE</span>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <Link href="/tournaments" className="transition-colors hover:text-[#8fefff]">
                    Quick links
                  </Link>
                  <Link href="/help" className="transition-colors hover:text-[#8fefff]">
                    Support
                  </Link>
                  <Link href="/legal/privacy" className="transition-colors hover:text-[#8fefff]">
                    Legal
                  </Link>
                  <Link href="/contact" className="transition-colors hover:text-[#8fefff]">
                    Contact
                  </Link>
                </div>
              </div>

              <div className="mt-4 text-center text-xs text-white/32">
                © {new Date().getFullYear()} VALORHIVE. All rights reserved.
              </div>
            </footer>
          </div>
        </div>
      </main>

      <UniversalLoginModal
        open={authView === "login"}
        onOpenChange={(open) => handleAuthChange(open ? "login" : null)}
        onSwitchToRegister={() => handleAuthChange("register")}
      />
      <UniversalRegisterModal
        open={authView === "register"}
        onOpenChange={(open) => handleAuthChange(open ? "register" : null)}
        onSwitchToLogin={() => handleAuthChange("login")}
      />
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/45">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-semibold uppercase tracking-[0.04em] text-white">{title}</h2>
      {description ? <p className="mx-auto mt-2 max-w-2xl text-sm leading-7 text-white/55">{description}</p> : null}
    </div>
  );
}

function NeonInfoCard({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: typeof Trophy;
}) {
  return (
    <div className="group h-full rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,24,32,0.98),rgba(9,13,18,0.98))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_18px_rgba(24,175,206,0.06)] transition-all duration-200 hover:-translate-y-1 hover:border-[#18AFCE]/32 hover:shadow-[0_0_28px_rgba(24,175,206,0.14)]">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#d6ff3f]/18 bg-[#d6ff3f]/8 text-[#d6ff3f] shadow-[0_0_18px_rgba(214,255,63,0.12)]">
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/50">{description}</p>
    </div>
  );
}

function SportStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-xl font-semibold text-[#10222c]">{value}</p>
      <p className="mt-0.5 text-xs uppercase tracking-[0.14em] text-[#10222c]/70">{label}</p>
    </div>
  );
}
