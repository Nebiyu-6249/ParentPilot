import type { Metadata } from "next";

import SettingsScreen from "@/components/SettingsScreen";
import { currentParent } from "@/lib/session";

// reads the parent's saved settings, so it must never be prerendered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const parent = await currentParent();
  return (
    <SettingsScreen
      register={parent.register}
      language={parent.language}
      anxietyBand={parent.anxietyBand}
      child={parent.child}
    />
  );
}
