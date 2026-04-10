import { redirect } from "next/navigation";

export default async function SportAdminLoginPage({
  params,
}: {
  params: Promise<{ sport: string }>;
}) {
  const { sport } = await params;
  redirect(`/office/login?sport=${encodeURIComponent(sport)}`);
}
