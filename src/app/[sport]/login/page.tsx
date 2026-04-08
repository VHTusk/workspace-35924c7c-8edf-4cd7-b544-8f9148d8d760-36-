import { redirect } from "next/navigation";

export default async function SportLoginRedirectPage({
  params,
}: {
  params: Promise<{ sport: string }>;
}) {
  const { sport } = await params;
  redirect(`/${sport}?auth=login`);
}
