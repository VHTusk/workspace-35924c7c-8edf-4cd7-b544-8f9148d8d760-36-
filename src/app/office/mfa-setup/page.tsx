import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { MfaSetup } from "@/components/auth/mfa-setup";

export default function OfficeMfaSetupPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/40 via-background to-background px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link href="/office/login" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to office login
        </Link>

        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-3">
            <Image src="/logo.png" alt="VALORHIVE" width={44} height={44} className="h-11 w-auto" priority />
            <span className="text-xl font-semibold text-foreground">VALORHIVE</span>
          </Link>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">Secure your office access</h1>
          <p className="mt-2 text-muted-foreground">
            Complete two-factor authentication setup before continuing into the office dashboard.
          </p>
        </div>

        <MfaSetup />
      </div>
    </div>
  );
}
