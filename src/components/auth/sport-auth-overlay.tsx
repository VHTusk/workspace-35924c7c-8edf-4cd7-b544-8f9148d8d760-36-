"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { UniversalLoginModal } from "@/components/auth/universal-login-modal";
import { UniversalRegisterModal } from "@/components/auth/universal-register-modal";

type SportAuthOverlayProps = {
  sport: string;
  initialView?: "login" | "register" | null;
};

export function SportAuthOverlay({ sport, initialView = null }: SportAuthOverlayProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authView, setAuthView] = useState<"login" | "register" | null>(initialView);

  useEffect(() => {
    const authParam = searchParams.get("auth");
    if (authParam === "login" || authParam === "register") {
      setAuthView(authParam);
      return;
    }

    setAuthView(null);
  }, [searchParams]);

  const handleAuthChange = (view: "login" | "register" | null) => {
    const params = new URLSearchParams(searchParams.toString());

    if (view) {
      params.set("auth", view);
      setAuthView(view);
    } else {
      params.delete("auth");
      setAuthView(null);
    }

    router.replace(params.size ? `/${sport}?${params.toString()}` : `/${sport}`);
  };

  return (
    <>
      <UniversalLoginModal
        open={authView === "login"}
        onOpenChange={(open) => handleAuthChange(open ? "login" : null)}
        onSwitchToRegister={() => handleAuthChange("register")}
        initialSport={sport}
        hideSportSelection
      />
      <UniversalRegisterModal
        open={authView === "register"}
        onOpenChange={(open) => handleAuthChange(open ? "register" : null)}
        onSwitchToLogin={() => handleAuthChange("login")}
        initialSport={sport}
      />
    </>
  );
}
