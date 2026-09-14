import type { Metadata } from "next";

import PacketLoader from "@/components/PacketLoader";
import PacketScreen from "@/components/PacketScreen";
import { demoBundle } from "@/lib/demo";
import { currentParent } from "@/lib/session";

// reads the parent's register, so it must never be prerendered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Worksheet" };

/**
 * The main screen.
 *
 * The demo renders server side and instantly, because it is a fixture and a
 * status line in front of a file read would be theatre. A real problem is
 * streamed by the client so the status line can name the step the server is
 * genuinely on.
 */
export default async function ProblemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parent = await currentParent();

  if (id === "demo") {
    return <PacketScreen initial={await demoBundle(parent.register)} />;
  }

  return <PacketLoader problemId={id} register={parent.register} />;
}
