import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminRole } from "@prisma/client";
import { canAccessOfficeRoute, getOfficeAccess, getOfficeRoleLabel } from "@/lib/office-auth";
import { OfficeShell } from "@/components/office/office-shell";

export default async function OfficeSuperAdminPage() {
  const access = await getOfficeAccess(await cookies());
  if (!access) {
    redirect("/office/login");
  }
  if (!canAccessOfficeRoute(access.primaryAssignment.adminRole, AdminRole.SUPER_ADMIN)) {
    redirect(access.redirectPath);
  }

  return (
    <OfficeShell>
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Office Dashboard</p>
        <h1 className="mt-2 text-3xl font-semibold">Super Admin</h1>
        <p className="mt-2 text-muted-foreground">Cross-sport governance, global overrides, and full system visibility.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <OfficeInfoCard title="Current access" value={getOfficeRoleLabel(access.primaryAssignment.adminRole)} />
        <OfficeInfoCard title="Assignments" value={String(access.assignments.length || 1)} />
        <OfficeInfoCard title="Scope" value="All sports and geographies" />
      </div>
    </section>
    </OfficeShell>
  );
}

function OfficeInfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-muted/20 p-5">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-2 text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
