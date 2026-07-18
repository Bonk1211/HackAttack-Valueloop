import { ValueLoopApp } from "@/components/value-loop-app";
import { accounts } from "@/lib/mock-data";
import { notFound } from "next/navigation";

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!accounts.some((account) => account.id === id)) notFound();
  return <ValueLoopApp initialScreen="account" initialAccountId={id} />;
}
