import { MvpDisabledPage } from "@/components/mvp-disabled-page";

export default function DirectorLoginPage() {
  return (
    <MvpDisabledPage
      title="Director tools are not part of the MVP launch"
      description="Director login and tournament operations were removed from the production deployment path until the full backend is restored."
      backHref="/"
      backLabel="Back to home"
    />
  );
}
