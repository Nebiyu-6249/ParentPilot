import { redirect } from "next/navigation";

/**
 * Live Mode used to be its own screen. It is a toggle in the thread's composer
 * now, so this route exists only to keep old links and bookmarks working.
 *
 * Folding it in was the point rather than a tidy-up: on the separate screen a
 * parent had to leave the worksheet they were working on, and the recap that
 * came back had no relationship to the thread it came from.
 */
export default function LivePage() {
  redirect("/app");
}
