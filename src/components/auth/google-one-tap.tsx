"use client";

import { useEffect, useId, useState } from "react";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

type GoogleOneTapProps = {
  sport?: string;
  className?: string;
  prompt?: boolean;
  anchorId?: string;
};

type GoogleOneTapResponse = {
  success: boolean;
  message?: string;
  redirectTo?: string;
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
  anchorId,
}: GoogleOneTapProps) {
  const generatedId = useId().replace(/:/g, "");
  const buttonId = `google-login-btn-${generatedId}`;
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) {
      setError("Google sign-in is not configured right now.");
      return;
    }

    let isCancelled = false;
    let attempts = 0;

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
              setError(data.message || "Invalid Google token");
              return;
            }

            googleIdentity.disableAutoSelect();
            window.location.assign(data.redirectTo || "/post-login");
          } catch (requestError) {
            console.error("Google One Tap request failed", requestError);
            setError("Google sign-in is unavailable right now. Please try again.");
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

      if (prompt) {
        googleIdentity.disableAutoSelect();
        googleIdentity.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            console.log("Google One Tap prompt not shown on this visit.");
          }
        });
      }
    };

    initialize();

    return () => {
      isCancelled = true;
      window.google?.accounts?.id.cancel();
    };
  }, [buttonId, clientId, prompt, sport]);

  return (
    <div id={anchorId} className={className}>
      <div id={buttonId} className="w-full" />
      {loading && (
        <div className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Signing you in with Google...
        </div>
      )}
      {error && (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
