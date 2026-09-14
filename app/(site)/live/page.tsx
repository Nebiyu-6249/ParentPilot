import { redirect } from "next/navigation";

/**
 * Live Mode used to be its own screen. It is a toggle in the thread now, so
 * this route exists only to keep old links and bookmarks working.
 *
 * The listening itself did not move house: the same hook, the same rolling
 * window in the same ref, the same five second classify interval, the same
 * rule engine. What moved is where the coaching lands, which is now the
 * thread instead of a card over a blank page.
 */
export default function LivePage() {
  redirect("/app");
}
