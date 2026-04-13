"use client";

import { useEffect, useId, useState } from "react";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { AuthCode } from "@/lib/auth-contract";

type GoogleOneTapProps = {
  sport?: string;
  className?: string;
  prompt?: boolean;
  autoPrompt?: boolean;
  promptDelayMs?: number;
  anchorId?: string;
  showButton?: boolean;
  onLoginSuccess?: (data: GoogleOneTapResponse) => void;
  onLoginError?: (message: string) => void;
};

type GoogleOneTapResponse = {
  success: boolean;
  code?: AuthCode;
  message?: string;
  redirectTo?: string;
};

type GoogleOneTapConfigResponse = {
  success: boolean;
  enabled?: boolean;
  clientId?: string;
  message?: string;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          prompt: (
            listener?: (notification: {
              isNotDisplayed: () => boolean;
              isSkippedMoment: () => boolean;
            }) => void,
          ) => void;
          renderButton: (
            element: HTMLElement,
            options: {
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "continue_with" | "signin_with" | "signup_with";
              shape?: "rectangular" | "pill";
              width?: string | number;
            },
          ) => void;
          cancel: () => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

export default function GoogleOneTap({
  sport,
  className,
  prompt = true,
  autoPrompt,
  promptDelayMs = 6000,
  anchorId,
  showButton = true,
  onLoginSuccess,
  onLoginError,
}: GoogleOneTapProps) {
  const generatedId = useId().replace(/:/g, "");
  const buttonId = `google-login-btn-${generatedId}`;
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [clientId, setClientId] = useState<string>("");
  const [configLoaded, setConfigLoaded] = useState(false);
  const shouldPrompt = autoPrompt ?? prompt;
  const dismissalKey = `google-onetap-dismissed:${sport ?? "global"}`;

  useEffect(() => {
    let isCancelled = false;

    const loadGoogleConfig = async () => {
      try {
        const response = await fetch("/api/auth/google/config", {
          method: "GET",
          cache: "no-store",
        });

        const data = (await response.json()) as GoogleOneTapConfigResponse;
        if (isCancelled) {
          return;
        }

        if (!response.ok || !data.success || !data.enabled || !data.clientId) {
          const message = data.message || "Google sign-in is not configured right now.";
          setError(message);
          onLoginError?.(message);
          setConfigLoaded(true);
          return;
        }

        setError("");
        setClientId(data.clientId);
        setConfigLoaded(true);
      } catch (requestError) {
        console.error("Failed to load Google auth configuration", requestError);
        if (isCancelled) {
          return;
        }
        const message = "Google sign-in is not configured right now.";
        setError(message);
        onLoginError?.(message);
        setConfigLoaded(true);
      }
    };

    void loadGoogleConfig();

    return () => {
      isCancelled = true;
    };
  }, [onLoginError]);

  useEffect(() => {
    if (!configLoaded || !clientId) {
      return;
    }

    let isCancelled = false;
    let attempts = 0;
    let promptTimeout: number | null = null;

    const initialize = () => {
      if (isCancelled) {
        return;
      }

      const googleIdentity = window.google?.accounts?.id;
      const buttonContainer = document.getElementById(buttonId);

      if (!googleIdentity || !buttonContainer) {
        if (attempts < 40) {
          attempts += 1;
          window.setTimeout(initialize, 250);
        }
        return;
      }

      googleIdentity.cancel();
      googleIdentity.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          setLoading(true);
          setError("");

          try {
            const response = await fetch("/api/auth/google-onetap", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                credential,
                sport,
              }),
            });

            const data = (await response.json()) as GoogleOneTapResponse;

            if (!response.ok || !data.success) {
              const message = data.message || "Invalid Google token";
              setError(message);
              onLoginError?.(message);
              return;
            }

            googleIdentity.disableAutoSelect();
            onLoginSuccess?.(data);
            if (!onLoginSuccess) {
              window.location.assign(data.redirectTo || "/post-login");
            }
          } catch (requestError) {
            console.error("Google One Tap request failed", requestError);
            const message = "Google sign-in is unavailable right now. Please try again.";
            setError(message);
            onLoginError?.(message);
          } finally {
            setLoading(false);
          }
        },
      });

      buttonContainer.innerHTML = "";
      googleIdentity.renderButton(buttonContainer, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width: "100%",
      });

      if (shouldPrompt && typeof window !== "undefined" && !window.sessionStorage.getItem(dismissalKey)) {
        const promptOneTap = () => {
          if (isCancelled) {
            return;
          }

          googleIdentity.disableAutoSelect();
          googleIdentity.prompt((notification) => {
            if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
              window.sessionStorage.setItem(dismissalKey, "1");
              console.log("Google One Tap prompt not shown on this visit.");
            }
          });
        };

        if (promptDelayMs > 0) {
          promptTimeout = window.setTimeout(promptOneTap, promptDelayMs);
        } else {
          promptOneTap();
        }
      }
    };

    initialize();

    return () => {
      isCancelled = true;
      if (promptTimeout) {
        window.clearTimeout(promptTimeout);
      }
      window.google?.accounts?.id.cancel();
    };
  }, [buttonId, clientId, configLoaded, dismissalKey, onLoginError, onLoginSuccess, promptDelayMs, shouldPrompt, sport]);

  return (
    <div id={anchorId} className={className}>
      <div id={buttonId} className={showButton ? "w-full" : "hidden"} />
      {loading && (
        <div className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Signing you in with Google...
        </div>
      )}
      {error && showButton && (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
