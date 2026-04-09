"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UniversalRegisterPanel } from "@/components/auth/universal-register-panel";

export interface UniversalRegisterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSwitchToLogin?: () => void;
  initialSport?: string;
}

export function UniversalRegisterModal({
  open,
  onOpenChange,
  onSwitchToLogin,
  initialSport,
}: UniversalRegisterModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto border-border/60 p-0 sm:max-w-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Create a VALORHIVE account</DialogTitle>
          <DialogDescription>Register once and join structured competitions across supported sports.</DialogDescription>
        </DialogHeader>
        <UniversalRegisterPanel
          initialSport={initialSport}
          onSuccess={() => onOpenChange(false)}
          onSwitchToLogin={onSwitchToLogin}
        />
      </DialogContent>
    </Dialog>
  );
}
