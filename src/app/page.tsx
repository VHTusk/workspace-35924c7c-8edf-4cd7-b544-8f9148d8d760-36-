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
import { AUTH_SPORTS } from "@/components/auth/auth-sport-config";
import SiteFooter from "@/components/layout/site-footer";
import { UniversalLoginModal } from "@/components/auth/universal-login-modal";
import { UniversalRegisterModal } from "@/components/auth/universal-register-modal";
import { Button } from "@/components/ui/button";
import LanguageSelector from "@/components/ui/language-selector";
import { useTranslation } from "@/hooks/use-translation";

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

const HERO_VISUAL = HERO_SLIDES[0];

export default function HomePage() {
  const { language } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authView, setAuthView] = useState<"login" | "register" | null>(null);
  const [sessionStatus, setSessionStatus] = useState<{
    authenticated: boolean;
    userType: "player" | "org" | null;
    sport: string | null;
    displayName: string | null;
    avatarUrl: string | null;
  }>({
    authenticated: false,
    userType: null,
    sport: null,
    displayName: null,
    avatarUrl: null,
  });

  useEffect(() => {
    const authParam = searchParams.get("auth");
    if (authParam === "login" || authParam === "register") {
      setAuthView(authParam);
      return;
    }

    setAuthView((current) => (current && !searchParams.get("auth") ? null : current));
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    const loadSessionStatus = async () => {
      try {
        const response = await fetch("/api/auth/status", {
          credentials: "include",
        });

        if (!response.ok) {
          return;
        }

        const data = await response.json();
        if (!cancelled) {
          setSessionStatus({
            authenticated: data.authenticated === true,
            userType: data.userType ?? null,
            sport: typeof data.sport === "string" ? data.sport.toLowerCase() : null,
            displayName: typeof data.displayName === "string" ? data.displayName : null,
            avatarUrl: typeof data.avatarUrl === "string" ? data.avatarUrl : null,
          });
        }
      } catch {
        if (!cancelled) {
          setSessionStatus({
            authenticated: false,
            userType: null,
            sport: null,
            displayName: null,
            avatarUrl: null,
          });
        }
      }
    };

    void loadSessionStatus();

    return () => {
      cancelled = true;
    };
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

  const isHindi = language === "hi";
  const defaultSportHref = `/${AUTH_SPORTS[0].slug}`;
  const loggedInHref = sessionStatus.sport ? `/${sessionStatus.sport}` : defaultSportHref;
  const heroOutcomes = isHindi
    ? ["सत्यापित मैच परिणाम", "दोहराए जाने वाले सिटी टूर्नामेंट", "लगातार बदलती रैंकिंग"]
    : HERO_OUTCOMES;
  const howItWorks = isHindi
    ? [
        {
          title: "रजिस्टर करें",
          description: "अपना अकाउंट बनाएं और अपनी पहली प्रतियोगी यात्रा शुरू करें।",
          icon: Users,
        },
        {
          title: "टूर्नामेंट खोजें",
          description: "फॉर्मैट, शहर और आने वाले मैच शेड्यूल देखें।",
          icon: Search,
        },
        {
          title: "प्रतिस्पर्धा करें",
          description: "संरचित प्रतियोगिता में खेलें जहाँ परिणाम रिकॉर्ड होते हैं।",
          icon: Trophy,
        },
        {
          title: "आगे बढ़ें",
          description: "देखें कि समय के साथ आपकी रैंक कैसे बदलती है।",
          icon: ChartNoAxesColumn,
        },
      ]
    : HOW_IT_WORKS;
  const builtForChampions = isHindi
    ? [
        {
          title: "टूर्नामेंट प्रबंधन",
          description: "दोहराए जाने वाले प्रतिस्पर्धी फॉर्मैट के लिए संरचित संचालन।",
          icon: Trophy,
        },
        {
          title: "डुअल रेटिंग सिस्टम",
          description: "रैंक मूवमेंट और दृश्यमान अंक जो प्रदर्शन दर्शाते हैं।",
          icon: Target,
        },
        {
          title: "भौगोलिक स्तर",
          description: "जिला से राष्ट्रीय स्तर तक स्पष्ट प्रतियोगी प्रगति।",
          icon: MapPinned,
        },
        {
          title: "फेयर प्ले सिस्टम",
          description: "सत्यापित परिणाम, पारदर्शी मानक और मैच इंटेग्रिटी।",
          icon: ShieldCheck,
        },
      ]
    : BUILT_FOR_CHAMPIONS;
  const stats = isHindi
    ? [
        { value: "500+", label: "प्रतियोगिताएँ" },
        { value: "10,000+", label: "खिलाड़ी" },
        { value: "50+", label: "शहर" },
        { value: "350L+", label: "प्राइज पूल" },
      ]
    : STATS;
  const landingCopy = isHindi
    ? {
        about: "हमारे बारे में",
        login: "लॉग इन",
        signUp: "साइन अप",
        dashboard: "डैशबोर्ड",
        openProfile: "प्रोफाइल खोलें",
        eyebrow: "संरचित प्रतियोगिता",
        heroTitleStart: "भारत का प्रमुख",
        heroTitleAccent: "समावेशी खेल",
        heroTitleEnd: "इकोसिस्टम",
        heroDescription:
          "हर खेल। हर शहर। एक प्रतिस्पर्धी सिस्टम जहाँ टूर्नामेंट संरचित रहते हैं और रैंकिंग लगातार बदलती रहती है।",
        primaryCta: "आगामी प्रतियोगिताओं में जुड़ें",
        primaryCtaLoggedIn: "स्पोर्ट होम खोलें",
        secondaryCta: "स्पोर्ट होम देखें",
        sportsLine: "शुरुआत कॉर्नहोल, डार्ट्स, फ्रिस्बी गोल्फ, पिकलबॉल से",
        sportsEyebrow: "खेल",
        sportsTitle: "अपना शुरुआती खेल चुनें",
        sportsDescription: "पहले उस प्रतियोगी फॉर्मैट को चुनें जिसमें आप प्रवेश करना चाहते हैं।",
        details: "विवरण देखें",
        players: "खिलाड़ी",
        tournaments: "टूर्नामेंट",
        prizePool: "प्राइज पूल",
        flowEyebrow: "प्रतियोगिता प्रवाह",
        flowTitle: "यह कैसे काम करता है",
        flowDescription: "रजिस्ट्रेशन से दोहराए जाने वाले प्रतिस्पर्धी खेल तक एक सरल रास्ता।",
        platformEyebrow: "प्लेटफ़ॉर्म फीचर्स",
        platformTitle: "चैंपियंस के लिए बना",
        platformDescription: "दोहराए जाने वाले टूर्नामेंट, सत्यापित परिणाम और खिलाड़ी प्रगति के लिए मुख्य सिस्टम।",
        momentumEyebrow: "गति",
        momentumTitle: "हर दिन बढ़ रहा है",
        ctaTitle: "प्रतिस्पर्धा शुरू करने के लिए तैयार हैं?",
        ctaDescription:
          "संरचित प्रतियोगिताओं में जुड़ें, अपनी रैंकिंग बनाएं और एक अधिक स्थिर प्रतिस्पर्धी सिस्टम में आगे बढ़ें।",
        ctaButton: "शुरू करें",
        ctaButtonLoggedIn: "स्पोर्ट होम खोलें",
        heroVisualEyebrow: "संरचित लीग एक्शन",
        heroVisualDescription:
          "हर राउंड के साथ दोहराए जाने वाले मैच, दृश्यमान रैंकिंग और सत्यापित परिणाम।",
      }
    : {
        about: "About",
        login: "Log in",
        signUp: "Sign Up",
        dashboard: "Dashboard",
        openProfile: "Open Profile",
        eyebrow: "Structured Competition",
        heroTitleStart: "India's Premier",
        heroTitleAccent: "Inclusive Sports",
        heroTitleEnd: "Ecosystem",
        heroDescription:
          "Every sport. Every city. One competitive system where tournaments stay structured and rankings keep moving.",
        primaryCta: "Join Upcoming Competitions",
        primaryCtaLoggedIn: "Open Sport Home",
        secondaryCta: "View Sport Home",
        sportsLine: "Starting with Cornhole, Darts, Frisbee Golf, Pickleball",
        sportsEyebrow: "Sports",
        sportsTitle: "Pick your starting sport",
        sportsDescription: "Select the competition format you want to enter first and move into scheduled local play.",
        details: "Enter",
        players: "Players",
        tournaments: "Tournaments",
        prizePool: "Prize Pool",
        flowEyebrow: "Competition flow",
        flowTitle: "How it works",
        flowDescription: "A simple path from registration to repeat competitive play.",
        platformEyebrow: "Platform features",
        platformTitle: "Built for champions",
        platformDescription:
          "Core systems designed for repeatable tournaments, verified outcomes, and steady player progress.",
        momentumEyebrow: "Momentum",
        momentumTitle: "Growing every day",
        ctaTitle: "Ready to Start Competing?",
        ctaDescription:
          "Join structured competitions, build your ranking, and move through a more consistent competitive system.",
        ctaButton: "Get Started",
        ctaButtonLoggedIn: "Open Sport Home",
        heroVisualEyebrow: HERO_VISUAL.eyebrow,
        heroVisualDescription: HERO_VISUAL.description,
      };

  return (
    <div className="min-h-screen bg-[#050c10] text-white">
      <main className="relative overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(24,175,206,0.18),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(238,93,14,0.14),transparent_28%),linear-gradient(180deg,#041017_0%,#050c10_48%,#03080c_100%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(24,175,206,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(24,175,206,0.12)_1px,transparent_1px)] [background-size:48px_48px]" />

        <div className="relative mx-auto max-w-[1220px]">
          <div className="overflow-hidden rounded-[30px] border border-[#18AFCE]/55 bg-[linear-gradient(180deg,rgba(7,18,24,0.96),rgba(4,10,14,0.98))] shadow-[0_0_0_1px_rgba(24,175,206,0.18),0_0_28px_rgba(24,175,206,0.2),0_0_90px_rgba(24,175,206,0.08)]">
            <header className="border-b border-[#18AFCE]/18 px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <Link href="/" className="inline-flex items-center gap-3">
                  <Image src="/logo.png" alt="VALORHIVE" width={52} height={52} className="h-12 w-auto" priority />
                  <div className="leading-tight">
                    <p className="text-sm font-semibold tracking-[0.18em] text-white/90">VALORHIVE</p>
                  </div>
                </Link>

                <div className="flex items-center gap-2">
                  <LanguageSelector variant="compact" className="border-[#18AFCE]/30 bg-[#07141c] text-[#c6f7ff]" />
                </div>
              </div>
            </header>

            <section id="overview" className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
              <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="overflow-hidden rounded-[26px] border border-[#18AFCE]/28 bg-[#07131b] shadow-[0_0_30px_rgba(24,175,206,0.1)]">
                  <div className="relative aspect-[16/11]">
                    {HERO_VISUAL.image ? (
                      <Image
                        src={HERO_VISUAL.image}
                        alt={`${HERO_VISUAL.title} competition`}
                        fill
                        priority
                        className="object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(238,93,14,0.38),transparent_24%),radial-gradient(circle_at_75%_30%,rgba(24,175,206,0.32),transparent_26%),linear-gradient(145deg,#091117_0%,#10242f_52%,#180d08_100%)]" />
                        <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(24,175,206,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(24,175,206,0.12)_1px,transparent_1px)] [background-size:40px_40px]" />
                        <div className="absolute inset-x-0 bottom-0 top-0 flex items-center justify-center">
                          <div className="rounded-[28px] border border-white/12 bg-black/18 p-8 shadow-[0_0_40px_rgba(238,93,14,0.18)] backdrop-blur-sm">
                            <Target className="h-20 w-20 text-[#ff8b45] drop-shadow-[0_0_22px_rgba(238,93,14,0.42)]" />
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,12,16,0.08),rgba(5,12,16,0.24)_38%,rgba(5,12,16,0.68)_100%)]" />
                    <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/18 bg-[#09161f]/78 px-3 py-1.5 backdrop-blur">
                      <CircleCheckBig className="h-4 w-4 text-[#18AFCE]" />
                      <span className="text-xs font-medium text-white/88">VALORHIVE</span>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                      <div className="rounded-[22px] border border-white/12 bg-[#07131b]/72 p-4 shadow-[0_0_24px_rgba(24,175,206,0.12)] backdrop-blur-md">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/45">
                          {landingCopy.heroVisualEyebrow}
                        </p>
                        <div className="mt-2">
                          <div>
                            <h3 className={`text-2xl font-semibold ${HERO_VISUAL.accent}`}>{HERO_VISUAL.title}</h3>
                            <p className="mt-1 max-w-md text-sm leading-6 text-white/72">
                              {landingCopy.heroVisualDescription}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col justify-center rounded-[26px] border border-[#18AFCE]/22 bg-[linear-gradient(180deg,rgba(9,19,27,0.96),rgba(5,11,15,0.96))] p-6 shadow-[inset_0_0_0_1px_rgba(24,175,206,0.06),0_0_32px_rgba(24,175,206,0.08)] sm:p-8">
                  <div className="inline-flex w-fit items-center rounded-full border border-[#18AFCE]/25 bg-[#0a1922] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7de8ff]">
                    {landingCopy.eyebrow}
                  </div>
                  <h1 className="mt-5 max-w-[10ch] text-4xl font-semibold leading-[1.05] tracking-tight sm:text-[3.4rem]">
                    {landingCopy.heroTitleStart}{" "}
                    <span className="text-[#d6ff3f] [text-shadow:0_0_18px_rgba(214,255,63,0.32)]">
                      {landingCopy.heroTitleAccent}
                    </span>{" "}
                    {landingCopy.heroTitleEnd}
                  </h1>
                  <p className="mt-5 max-w-xl text-sm leading-7 text-white/68 sm:text-base">
                    {landingCopy.heroDescription}
                  </p>

                  <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                    <Button
                      className="h-11 rounded-xl bg-[#d6ff3f] px-5 text-sm font-semibold text-[#12230f] shadow-[0_0_22px_rgba(214,255,63,0.28)] transition-all hover:-translate-y-0.5 hover:bg-[#c8f12c]"
                      onClick={() => {
                        if (sessionStatus.authenticated) {
                          router.push(loggedInHref);
                          return;
                        }

                        openAuth("register");
                      }}
                    >
                      {sessionStatus.authenticated ? landingCopy.primaryCtaLoggedIn : landingCopy.primaryCta}
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      className="h-11 rounded-xl border-[#18AFCE]/40 bg-[#08141c] px-5 text-sm font-semibold text-[#c3f8ff] shadow-[0_0_18px_rgba(24,175,206,0.14)] transition-all hover:-translate-y-0.5 hover:bg-[#0c1c26] hover:text-white"
                    >
                      <Link href={defaultSportHref}>
                        {landingCopy.secondaryCta}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>

                  <p className="mt-4 text-xs font-medium uppercase tracking-[0.22em] text-white/45">
                    {landingCopy.sportsLine}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {heroOutcomes.map((item) => (
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
                eyebrow={landingCopy.sportsEyebrow}
                title={landingCopy.sportsTitle}
                description={landingCopy.sportsDescription}
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
                              <SportStat value="5,000+" label={landingCopy.players} />
                              <SportStat value="250+" label={landingCopy.tournaments} />
                              <SportStat value="INR 25L+" label={landingCopy.prizePool} />
                            </div>
                          </div>
                        </div>

                        <Button
                          asChild
                          className="h-11 rounded-xl bg-[#d6ff3f] px-5 text-sm font-semibold text-[#13220f] shadow-[0_0_20px_rgba(214,255,63,0.22)] transition-all hover:-translate-y-0.5 hover:bg-[#c8f12c]"
                        >
                          <Link href={sport.tournamentsHref}>{landingCopy.details}</Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="px-4 pb-6 pt-2 sm:px-6 lg:px-8">
              <SectionHeading
                eyebrow={landingCopy.flowEyebrow}
                title={landingCopy.flowTitle}
                description={landingCopy.flowDescription}
              />

              <div className="grid gap-4 md:grid-cols-4">
                {howItWorks.map((item) => (
                  <NeonInfoCard key={item.title} title={item.title} description={item.description} icon={item.icon} />
                ))}
              </div>
            </section>

            <section id="about" className="px-4 pb-6 pt-2 sm:px-6 lg:px-8">
              <SectionHeading
                eyebrow={landingCopy.platformEyebrow}
                title={landingCopy.platformTitle}
                description={landingCopy.platformDescription}
              />

              <div className="grid gap-4 md:grid-cols-4">
                {builtForChampions.map((item) => (
                  <NeonInfoCard key={item.title} title={item.title} description={item.description} icon={item.icon} />
                ))}
              </div>
            </section>

            <section className="px-4 pb-6 pt-2 sm:px-6 lg:px-8">
              <SectionHeading eyebrow={landingCopy.momentumEyebrow} title={landingCopy.momentumTitle} />

              <div className="grid gap-4 md:grid-cols-4">
                {stats.map((item, index) => (
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
                <h2 className="text-3xl font-semibold text-white">{landingCopy.ctaTitle}</h2>
                <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-white/62">
                  {landingCopy.ctaDescription}
                </p>
                <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                  <Button
                    className="h-11 rounded-xl bg-[#d6ff3f] px-6 text-sm font-semibold text-[#12220f] shadow-[0_0_22px_rgba(214,255,63,0.28)] transition-all hover:-translate-y-0.5 hover:bg-[#c8f12c]"
                    onClick={() => {
                      if (sessionStatus.authenticated) {
                        router.push(loggedInHref);
                        return;
                      }

                      openAuth("register");
                    }}
                  >
                    {sessionStatus.authenticated ? landingCopy.ctaButtonLoggedIn : landingCopy.ctaButton}
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="h-11 rounded-xl border-[#18AFCE]/40 bg-[#08151d] px-6 text-sm font-semibold text-[#c8f7ff] shadow-[0_0_18px_rgba(24,175,206,0.12)] transition-all hover:-translate-y-0.5 hover:bg-[#0d1b24]"
                  >
                    <Link href={defaultSportHref}>{landingCopy.secondaryCta}</Link>
                  </Button>
                </div>
              </div>
            </section>

            <SiteFooter variant="landing" />
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

