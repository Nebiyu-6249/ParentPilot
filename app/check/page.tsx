import type { Metadata } from "next";

import CheckFlow from "@/components/CheckFlow";

export const metadata: Metadata = { title: "Check finished work" };

export default function CheckPage() {
  return <CheckFlow />;
}
