"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UniversalLoginPanel } from "@/components/auth/universal-login-panel";

export interface UniversalLoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSwitchToRegister?: () => void;
  initialSport?: string;
  hideSportSelection?: boolean;
  successRedirect?: string;
}

export function UniversalLoginModal({
  open,
  onOpenChange,
  onSwitchToRegister,
  initialSport,
  hideSportSelection = false,
  successRedirect,
}: UniversalLoginModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto border-border/60 p-0 sm:max-w-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Log in to VALORHIVE</DialogTitle>
          <DialogDescription>Access your account across all supported sports.</DialogDescription>
        </DialogHeader>
        <UniversalLoginPanel
          initialSport={initialSport}
          hideSportSelection={hideSportSelection}
          successRedirect={successRedirect}
          onSuccess={() => onOpenChange(false)}
          onSwitchToRegister={onSwitchToRegister}
        />
      </DialogContent>
    </Dialog>
  );
}
