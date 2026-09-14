import type { Metadata } from "next";

import SetupFlow from "@/components/SetupFlow";
import { currentParent } from "@/lib/session";

// reads the parent's saved calibration, so it must never be prerendered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Setup" };

export default async function SetupPage() {
  const parent = await currentParent();
  return <SetupFlow initialRegister={parent.register} initialLanguage={parent.language} />;
}
