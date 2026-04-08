import Image from "next/image";
import Link from "next/link";
import { Clock, Facebook, Heart, Instagram, Mail, Phone, Twitter, Youtube } from "lucide-react";

export default function SiteFooter() {
  return (
    <footer className="shrink-0 border-t border-border bg-muted/30">
      <div className="container mx-auto px-4 py-10 sm:py-12">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-12">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="mb-4 flex items-center gap-2">
              <Image src="/logo.png" alt="VALORHIVE" width={32} height={32} className="h-8 w-auto" />
              <span className="text-xl font-bold text-foreground">VALORHIVE</span>
            </Link>
            <p className="mb-4 text-sm text-muted-foreground">
              Structured tournaments, verified results, and rankings that help every supported sport grow.
            </p>
            <div className="flex gap-3">
              {[Instagram, Twitter, Facebook, Youtube].map((Icon, index) => (
                <a
                  key={index}
                  href="#"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="mb-4 font-semibold text-foreground">Quick Links</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/cornhole" className="text-sm text-muted-foreground transition-colors hover:text-primary">
                  Cornhole
                </Link>
              </li>
              <li>
                <Link href="/darts" className="text-sm text-muted-foreground transition-colors hover:text-primary">
                  Darts
                </Link>
              </li>
              <li>
                <Link href="/login" className="text-sm text-muted-foreground transition-colors hover:text-primary">
                  Log in
                </Link>
              </li>
              <li>
                <Link href="/register" className="text-sm text-muted-foreground transition-colors hover:text-primary">
                  Register
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-semibold text-foreground">Support</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span>support@valorhive.com</span>
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>+91 98765 43210</span>
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Mon-Sat, 9AM-6PM</span>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-semibold text-foreground">Legal</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/legal/privacy" className="text-sm text-muted-foreground transition-colors hover:text-primary">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/legal/terms" className="text-sm text-muted-foreground transition-colors hover:text-primary">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/legal/liability-waiver" className="text-sm text-muted-foreground transition-colors hover:text-primary">
                  Liability Waiver
                </Link>
              </li>
              <li>
                <Link href="/legal/tournament-agreement" className="text-sm text-muted-foreground transition-colors hover:text-primary">
                  Tournament Agreement
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="VALORHIVE" width={20} height={20} className="h-5 w-auto" />
            <span className="text-sm text-muted-foreground">
              Copyright {new Date().getFullYear()} VALORHIVE. All rights reserved.
            </span>
          </div>
          <div className="flex items-center gap-4">
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              Made with <Heart className="h-4 w-4 text-red-500" /> in India
            </p>
            <Link
              href="/admin/login"
              className="text-xs text-muted-foreground/50 transition-colors hover:text-muted-foreground"
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
