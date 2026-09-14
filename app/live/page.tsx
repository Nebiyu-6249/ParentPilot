import type { Metadata } from "next";

import LiveMode from "@/components/LiveMode";
import { currentParent } from "@/lib/session";

// Reads the parent's language and anxiety band, so it must never be prerendered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Live Mode" };

export default async function LivePage() {
  const parent = await currentParent();
  return <LiveMode language={parent.language} />;
}
