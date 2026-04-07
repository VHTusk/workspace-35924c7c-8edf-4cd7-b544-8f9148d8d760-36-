import { redirect } from 'next/navigation';

export default async function DistrictsRedirectPage({
  params,
}: {
  params: Promise<{ sport: string }>;
}) {
  const { sport } = await params;
  redirect(`/${sport}/dashboard/cities`);
}
