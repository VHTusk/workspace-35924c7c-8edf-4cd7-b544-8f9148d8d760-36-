"use client";

import { useEffect, useState, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
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

// Helper to get online status
function getIsOnline(): boolean {
  if (typeof window === "undefined") return true;
  return window.navigator.onLine;
}

// Get initial PWA status
function getInitialPWAStatus(): {
  isInstalled: boolean;
  isOnline: boolean;
  canInstall: boolean;
  isIOS: boolean;
  needIOSInstructions: boolean;
} {
  const isInstalled = getIsStandalone();
  const isIOS = getIsIOS();
  const needIOSInstructions = isIOS && !isInstalled;
  const isOnline = getIsOnline();

  return {
    isInstalled,
    isOnline,
    canInstall: false,
    isIOS,
    needIOSInstructions,
  };
}

interface PWAStatus {
  isInstalled: boolean;
  isOnline: boolean;
  canInstall: boolean;
  isIOS: boolean;
  needIOSInstructions: boolean;
}

export function usePWA() {
  const [status, setStatus] = useState<PWAStatus>(() => getInitialPWAStatus());
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Listen for beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setStatus((prev) => ({ ...prev, canInstall: true }));
    };

    // Listen for app installed
    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setStatus((prev) => ({ ...prev, isInstalled: true, canInstall: false }));
    };

    // Listen for online/offline
    const handleOnline = () => setStatus((prev) => ({ ...prev, isOnline: true }));
    const handleOffline = () => setStatus((prev) => ({ ...prev, isOnline: false }));

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const install = useCallback(async () => {
    if (!installPrompt) return false;

    try {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;

      if (outcome === "accepted") {
        setInstallPrompt(null);
        setStatus((prev) => ({ ...prev, isInstalled: true, canInstall: false }));
        return true;
      }
      return false;
    } catch (error) {
      console.error("Install error:", error);
      return false;
    }
  }, [installPrompt]);

  return {
    ...status,
    install,
  };
}

// Hook for offline detection - simplified
export function useOfflineDetection(): boolean {
  const [isOffline, setIsOffline] = useState(() => {
    if (typeof window === "undefined") return false;
    return !window.navigator.onLine;
  });

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOffline;
}

// Hook for service worker registration
export function useServiceWorker() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    // Disable service worker in development to prevent reload loops
    if (process.env.NODE_ENV !== "production") {
      return;
    }
    
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        setRegistration(reg);

        // Check for updates
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                setUpdateAvailable(true);
              }
            });
          }
        });
      })
      .catch(console.error);
  }, []);

  const update = useCallback(() => {
    // Disable in development
    if (process.env.NODE_ENV !== "production") return;
    
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
      window.location.reload();
    }
  }, [registration]);

  return { registration, updateAvailable, update };
}
