import { redirect } from "next/navigation";

/**
 * Capture used to be its own three-step flow. It is now the first turn of a
 * thread, so this route exists only to keep old links and bookmarks working.
 */
export default function CapturePage() {
  redirect("/app");
}
