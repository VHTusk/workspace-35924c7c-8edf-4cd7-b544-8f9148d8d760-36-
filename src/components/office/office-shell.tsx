import Link from "next/link";
import { AdminRole } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { canAccessOfficeRoute, getOfficeAccess, getOfficeRoleLabel, getOfficeScopeSummary } from "@/lib/office-auth";
import { OfficeLogoutButton } from "@/components/office/office-logout-button";

const OFFICE_NAV = [
  { href: "/office/superadmin", label: "Super Admin", role: AdminRole.SUPER_ADMIN },
  { href: "/office/sport", label: "Sport Admin", role: AdminRole.SPORT_ADMIN },
  { href: "/office/state", label: "State Admin", role: AdminRole.STATE_ADMIN },
  { href: "/office/district", label: "District Admin", role: AdminRole.DISTRICT_ADMIN },
] as const;

export async function OfficeShell({ children }: { children: React.ReactNode }) {
  const access = await getOfficeAccess(await cookies());

  if (!access) {
    redirect("/office/login");
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="mx-auto grid min-h-screen max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-3xl border bg-background p-5 shadow-sm">
          <Link href="/office" className="text-lg font-semibold text-foreground">
            VALORHIVE Office
          </Link>
          <div className="mt-5 rounded-2xl border bg-muted/30 p-4">
            <p className="text-sm font-medium text-foreground">
              {access.user.firstName} {access.user.lastName}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{access.user.email}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              {getOfficeRoleLabel(access.primaryAssignment.adminRole)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{getOfficeScopeSummary(access.primaryAssignment)}</p>
            {access.legacyFallback ? (
              <p className="mt-3 text-xs text-amber-600">
                Legacy role fallback is active until structured admin assignments are cleaned up.
              </p>
            ) : null}
          </div>

          <nav className="mt-6 space-y-2">
            {OFFICE_NAV.filter((item) => canAccessOfficeRoute(access.primaryAssignment.adminRole, item.role)).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-2xl border px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-2">
              <OfficeLogoutButton />
            </div>
          </nav>
        </aside>

        <div className="rounded-3xl border bg-background p-6 shadow-sm">{children}</div>
      </div>
    </div>
  );
}
