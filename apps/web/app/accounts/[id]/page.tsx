import { ValueLoopApp } from "@/components/value-loop-app";

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ValueLoopApp initialScreen="account" initialAccountId={id} />;
}
