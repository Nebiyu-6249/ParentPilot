import type { Metadata } from "next";

import CaptureFlow from "@/components/CaptureFlow";

export const metadata: Metadata = { title: "New worksheet" };

export default function CapturePage() {
  return <CaptureFlow />;
}
