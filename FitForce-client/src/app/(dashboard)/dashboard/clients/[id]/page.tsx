import { redirect } from 'next/navigation';

export default async function ClientPageRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/dashboard/clients/${id}/overview`);
}