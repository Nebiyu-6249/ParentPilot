import type { Metadata } from "next";

import LiveMode from "@/components/LiveMode";
import { prisma, hasDatabase } from "@/lib/db";
import { currentParent } from "@/lib/session";

// creates a Session row on every visit, so it must never be prerendered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Live Mode" };

export default async function LivePage() {
  const parent = await currentParent();

  let sessionId: string | null = null;
  if (hasDatabase() && parent.child) {
    const session = await prisma.session
      .create({ data: { childId: parent.child.id, mode: "LIVE" } })
      .catch(() => null);
    sessionId = session?.id ?? null;
  }

  return <LiveMode language={parent.language} sessionId={sessionId} />;
}
