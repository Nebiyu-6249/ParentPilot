import type { Metadata } from "next";

import AppShell from "@/components/app/AppShell";
import { copy } from "@/lib/copy";
import { prisma, hasDatabase } from "@/lib/db";
import { currentParent } from "@/lib/session";
import { LocaleProvider } from "@/components/LocaleProvider";

// Reads the session cookie, so it can never be prerendered: a static /app
// would hand one parent's thread list to every visitor.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Homework" };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Today / This week / Earlier, worked out on the server so both agree. */
function group(updatedAt: Date, now: number): string {
  const age = now - updatedAt.getTime();
  if (age < DAY_MS) return copy.chat.threadsToday;
  if (age < 7 * DAY_MS) return copy.chat.threadsWeek;
  return copy.chat.threadsEarlier;
}

export default async function AppPage() {
  const parent = await currentParent();
  const signedIn = parent.email !== null;

  // Anonymous parents have no history to list. That is not an error state and
  // it does not block the thread: the whole surface works without an account.
  const threads =
    hasDatabase() && parent.id !== "anonymous"
      ? await prisma.thread
          .findMany({
            where: { parentId: parent.id },
            orderBy: { updatedAt: "desc" },
            take: 40,
            select: { id: true, title: true, updatedAt: true },
          })
          .catch(() => [])
      : [];

  const now = Date.now();

  return (
    /* The whole product surface reads its copy through this, and the provider
       also owns the document's lang and dir. A parent whose language is Arabic
       gets an Arabic interface laid out right to left from here. */
    <LocaleProvider code={parent.language}>
      <AppShell
      register={parent.register}
      signedIn={signedIn}
      language={parent.language}
      threads={threads.map((thread) => ({
        id: thread.id,
        title: thread.title,
        group: group(thread.updatedAt, now),
        }))}
      />
    </LocaleProvider>
  );
}
