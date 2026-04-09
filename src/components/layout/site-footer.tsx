import Image from "next/image";
import Link from "next/link";
import { Clock, Facebook, Heart, Instagram, Mail, Phone, Twitter, Youtube } from "lucide-react";

export default function SiteFooter({ variant = "default" }: { variant?: "default" | "landing" }) {
  const isLanding = variant === "landing";

  return (
    <footer
      className={
        isLanding
          ? "shrink-0 border-t border-[#18AFCE]/18 bg-[linear-gradient(180deg,rgba(7,18,24,0.96),rgba(4,10,14,0.98))] text-white"
          : "shrink-0 border-t border-border bg-muted/30"
      }
    >
      <div className="container mx-auto px-4 py-10 sm:py-12">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-12">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="mb-4 flex items-center gap-2">
              <Image src="/logo.png" alt="VALORHIVE" width={32} height={32} className="h-8 w-auto" />
              <span className={isLanding ? "text-xl font-bold text-white" : "text-xl font-bold text-foreground"}>VALORHIVE</span>
            </Link>
            <p className={isLanding ? "mb-4 text-sm text-white/62" : "mb-4 text-sm text-muted-foreground"}>
              Structured tournaments, verified results, and rankings that help every supported sport grow.
            </p>
            <div className="flex gap-3">
              {[Instagram, Twitter, Facebook, Youtube].map((Icon, index) => (
                <a
                  key={index}
                  href="#"
                  className={
                    isLanding
                      ? "flex h-9 w-9 items-center justify-center rounded-full border border-[#18AFCE]/18 bg-[#08151d] text-white/58 transition-colors hover:border-[#18AFCE]/40 hover:bg-[#0c1b24] hover:text-[#7de8ff]"
                      : "flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                  }
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className={isLanding ? "mb-4 font-semibold text-white" : "mb-4 font-semibold text-foreground"}>Quick Links</h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/cornhole"
                  className={
                    isLanding
                      ? "text-sm text-white/58 transition-colors hover:text-[#7de8ff]"
                      : "text-sm text-muted-foreground transition-colors hover:text-primary"
                  }
                >
                  Cornhole
                </Link>
              </li>
              <li>
                <Link
                  href="/darts"
                  className={
                    isLanding
                      ? "text-sm text-white/58 transition-colors hover:text-[#7de8ff]"
                      : "text-sm text-muted-foreground transition-colors hover:text-primary"
                  }
                >
                  Darts
                </Link>
              </li>
              <li>
                <Link
                  href="/?auth=login"
                  className={
                    isLanding
                      ? "text-sm text-white/58 transition-colors hover:text-[#7de8ff]"
                      : "text-sm text-muted-foreground transition-colors hover:text-primary"
                  }
                >
                  Log in
                </Link>
              </li>
              <li>
                <Link
                  href="/?auth=register"
                  className={
                    isLanding
                      ? "text-sm text-white/58 transition-colors hover:text-[#7de8ff]"
                      : "text-sm text-muted-foreground transition-colors hover:text-primary"
                  }
                >
                  Register
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className={isLanding ? "mb-4 font-semibold text-white" : "mb-4 font-semibold text-foreground"}>Support</h4>
            <ul className="space-y-3">
              <li className={isLanding ? "flex items-center gap-2 text-sm text-white/58" : "flex items-center gap-2 text-sm text-muted-foreground"}>
                <Mail className="h-4 w-4" />
                <span>support@valorhive.com</span>
              </li>
              <li className={isLanding ? "flex items-center gap-2 text-sm text-white/58" : "flex items-center gap-2 text-sm text-muted-foreground"}>
                <Phone className="h-4 w-4" />
                <span>+91 98765 43210</span>
              </li>
              <li className={isLanding ? "flex items-center gap-2 text-sm text-white/58" : "flex items-center gap-2 text-sm text-muted-foreground"}>
                <Clock className="h-4 w-4" />
                <span>Mon-Sat, 9AM-6PM</span>
              </li>
            </ul>
          </div>

          <div>
            <h4 className={isLanding ? "mb-4 font-semibold text-white" : "mb-4 font-semibold text-foreground"}>Legal</h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/legal/privacy"
                  className={
                    isLanding
                      ? "text-sm text-white/58 transition-colors hover:text-[#7de8ff]"
                      : "text-sm text-muted-foreground transition-colors hover:text-primary"
                  }
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/terms"
                  className={
                    isLanding
                      ? "text-sm text-white/58 transition-colors hover:text-[#7de8ff]"
                      : "text-sm text-muted-foreground transition-colors hover:text-primary"
                  }
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/liability-waiver"
                  className={
                    isLanding
                      ? "text-sm text-white/58 transition-colors hover:text-[#7de8ff]"
                      : "text-sm text-muted-foreground transition-colors hover:text-primary"
                  }
                >
                  Liability Waiver
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/tournament-agreement"
                  className={
                    isLanding
                      ? "text-sm text-white/58 transition-colors hover:text-[#7de8ff]"
                      : "text-sm text-muted-foreground transition-colors hover:text-primary"
                  }
                >
                  Tournament Agreement
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div
          className={
            isLanding
              ? "mt-10 flex flex-col items-center justify-between gap-4 border-t border-[#18AFCE]/18 pt-6 sm:flex-row"
              : "mt-10 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row"
          }
        >
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="VALORHIVE" width={20} height={20} className="h-5 w-auto" />
            <span className={isLanding ? "text-sm text-white/46" : "text-sm text-muted-foreground"}>
              Copyright {new Date().getFullYear()} VALORHIVE. All rights reserved.
            </span>
          </div>
          <div className="flex items-center gap-4">
            <p className={isLanding ? "flex items-center gap-1 text-sm text-white/46" : "flex items-center gap-1 text-sm text-muted-foreground"}>
              Made with <Heart className="h-4 w-4 text-red-500" /> in India
            </p>
            <Link
              href="/admin/login"
              className={
                isLanding
                  ? "text-xs text-white/30 transition-colors hover:text-white/55"
                  : "text-xs text-muted-foreground/50 transition-colors hover:text-muted-foreground"
              }
              aria-label="Admin login (office use only)"
            >
              Office Use Only
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
