import type { Metadata } from "next";

import SettingsScreen from "@/components/SettingsScreen";
import { currentParent } from "@/lib/session";
import { LocaleProvider } from "@/components/LocaleProvider";

// reads the parent's saved settings, so it must never be prerendered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const parent = await currentParent();
  return (
    <LocaleProvider code={parent.language}>
      <SettingsScreen
        register={parent.register}
        language={parent.language}
        anxietyBand={parent.anxietyBand}
        child={parent.child}
      />
    </LocaleProvider>
  );
}
