import type { Metadata } from "next";

import CheckFlow from "@/components/CheckFlow";
import { LocaleProvider } from "@/components/LocaleProvider";
import { currentParent } from "@/lib/session";

export const metadata: Metadata = { title: "Check finished work" };

export default async function CheckPage() {
  const parent = await currentParent();
  return (
    <LocaleProvider code={parent.language}>
      <CheckFlow />
    </LocaleProvider>
  );
}
