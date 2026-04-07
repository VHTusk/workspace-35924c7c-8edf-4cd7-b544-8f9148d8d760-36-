import OrganizationLayoutWrapper from "@/components/org/organization-layout-wrapper";

export default function SchoolLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <OrganizationLayoutWrapper>{children}</OrganizationLayoutWrapper>;
}
