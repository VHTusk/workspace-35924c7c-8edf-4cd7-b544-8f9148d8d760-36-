"use client";

import { useState, useEffect, useCallback } from "react";
import { Download, X, Share, Plus, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PWAInstallPromptProps {
  minVisits?: number;
  minTimeOnSite?: number; // in seconds
}

// Helper to check if running as installed PWA
function getIsStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  const iOSStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return standalone || !!iOSStandalone;
}

// Helper to check if iOS Safari
function getIsIOS(): boolean {
  if (typeof window === "undefined") return false;
  const userAgent = window.navigator.userAgent;
  const isIOSDevice = /iPad|iPhone|iPod/.test(userAgent);
  const isInSafari = /Safari/.test(userAgent) && !/CriOS|FxiOS|EdgiOS/.test(userAgent);
  return isIOSDevice && isInSafari;
}

// Helper to get and increment visit count
function getAndIncrementVisitCount(): number {
  if (typeof window === "undefined") return 0;
  const storedVisits = parseInt(localStorage.getItem("pwa_visit_count") || "0", 10);
  const newVisitCount = storedVisits + 1;
  localStorage.setItem("pwa_visit_count", newVisitCount.toString());
  return newVisitCount;
}

// Hook for PWA install prompt
function usePWAInstall(minTimeOnSite: number) {
  // Use lazy initialization for values that don't change
  const [isStandalone] = useState(() => getIsStandalone());
  const [isIOS] = useState(() => getIsIOS());
  const [visitCount] = useState(() => getAndIncrementVisitCount());
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [timeOnSite, setTimeOnSite] = useState(0);
  const [showPrompt, setShowPrompt] = useState(false);

  // Track time on site
  useEffect(() => {
    if (isStandalone) return;

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setTimeOnSite(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [isStandalone]);

  // Listen for beforeinstallprompt event (Android/Desktop)
  useEffect(() => {
    if (isStandalone) return;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, [isStandalone]);

  // Check if we should show the prompt
  useEffect(() => {
    if (isStandalone) return;

    // Check if user previously dismissed
    const dismissed = localStorage.getItem("pwa_prompt_dismissed");
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      // Show again after 7 days
      if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
        return;
      }
    }

    // Show if time on site met
    const shouldShow = timeOnSite >= minTimeOnSite || visitCount >= 2;

    if (shouldShow && (installPrompt || isIOS)) {
      // Small delay for better UX
      const timer = setTimeout(() => setShowPrompt(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [timeOnSite, visitCount, installPrompt, isIOS, isStandalone, minTimeOnSite]);

  const handleInstall = useCallback(async () => {
    if (!installPrompt) return false;

    try {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;

      if (outcome === "accepted") {
        setShowPrompt(false);
        setInstallPrompt(null);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Install prompt error:", error);
      return false;
    }
  }, [installPrompt]);

  const handleDismiss = useCallback(() => {
    setShowPrompt(false);
    localStorage.setItem("pwa_prompt_dismissed", Date.now().toString());
  }, []);

  return {
    isStandalone,
    isIOS,
    showPrompt,
    setShowPrompt,
    installPrompt,
    handleInstall,
    handleDismiss,
  };
}

export function PWAInstallPrompt({ 
  minTimeOnSite = 30 
}: PWAInstallPromptProps) {
  const {
    isStandalone,
    isIOS,
    showPrompt,
    setShowPrompt,
    installPrompt,
    handleInstall,
    handleDismiss,
  } = usePWAInstall(minTimeOnSite);

  // Don't show if already installed
  if (isStandalone) return null;

  // Don't show if no install capability
  if (!installPrompt && !isIOS) return null;

  return (
    <Dialog open={showPrompt} onOpenChange={setShowPrompt}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <TrophyIcon className="w-6 h-6 text-white" />
            </div>
            Install ValorHive
          </DialogTitle>
          <DialogDescription>
            Add to your home screen for quick access to tournaments and live scores!
          </DialogDescription>
        </DialogHeader>

        {isIOS ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Install ValorHive on your iPhone:
            </p>
            <ol className="space-y-3 text-sm">
              <li className="flex items-center gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                  1
                </span>
                <span className="flex items-center gap-2">
                  Tap the Share button
                  <Share className="w-4 h-4 text-blue-500" />
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                  2
                </span>
                <span className="flex items-center gap-2">
                  Scroll down and tap &quot;Add to Home Screen&quot;
                  <Plus className="w-4 h-4 text-green-500" />
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                  3
                </span>
                <span>Tap &quot;Add&quot; in the top right corner</span>
              </li>
            </ol>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
              <Smartphone className="w-8 h-8 text-muted-foreground" />
              <div>
                <p className="font-medium">Install App</p>
                <p className="text-sm text-muted-foreground">
                  Works offline, faster loading, home screen icon
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={handleDismiss}>
            Not Now
          </Button>
          {!isIOS && (
            <Button onClick={handleInstall} className="gap-2">
              <Download className="w-4 h-4" />
              Install Now
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Trophy icon for the install prompt
function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
      />
    </svg>
  );
}

// Lightweight banner for bottom of screen (alternative)
export function PWAInstallBanner() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone] = useState(() => getIsStandalone());
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    const dismissed = localStorage.getItem("pwa_banner_dismissed");
    if (!dismissed) return false;
    return Date.now() - parseInt(dismissed, 10) < 3 * 24 * 60 * 60 * 1000;
  });

  useEffect(() => {
    if (isStandalone) return;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, [isStandalone]);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setDismissed(true);
    }
  };

  const isVisible = installPrompt && !isStandalone && !dismissed;

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background border-t shadow-lg safe-area-bottom">
      <div className="max-w-screen-md mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0">
            <TrophyIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-medium text-sm">Install ValorHive</p>
            <p className="text-xs text-muted-foreground">Tap for quick access</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleInstall}>
            Install
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDismissed(true);
              localStorage.setItem("pwa_banner_dismissed", Date.now().toString());
            }}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
