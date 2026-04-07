import { redirect } from 'next/navigation';

export default async function CitiesRedirectPage({
  params,
}: {
  params: Promise<{ sport: string }>;
}) {
  const { sport } = await params;
  redirect(`/${sport}/dashboard/cities`);
}
