import { redirect } from "next/navigation";

export default async function MyTournamentsRedirectPage({
  params,
}: {
  params: Promise<{ sport: string }>;
}) {
  const { sport } = await params;
  redirect(`/${sport}/tournaments?tab=my-tournaments`);
}
