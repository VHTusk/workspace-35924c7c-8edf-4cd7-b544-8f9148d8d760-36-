import { redirect } from "next/navigation";

export default async function SportRegisterRedirectPage({
  params,
}: {
  params: Promise<{ sport: string }>;
}) {
  const { sport } = await params;
  redirect(`/${sport}?auth=register`);
}
