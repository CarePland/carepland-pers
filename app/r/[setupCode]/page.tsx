import { redirect } from "next/navigation";

type ReceiverSetupShortLinkPageProps = {
  params: Promise<{
    setupCode: string;
  }>;
};

export default async function ReceiverSetupShortLinkPage({
  params,
}: ReceiverSetupShortLinkPageProps) {
  const { setupCode } = await params;
  redirect(`/connect/receiver/setup?code=${encodeURIComponent(setupCode)}`);
}
