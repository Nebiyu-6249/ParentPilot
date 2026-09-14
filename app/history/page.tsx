import type { Metadata } from "next";
import Link from "next/link";

import HistoryList from "@/components/HistoryList";
import { Page, Section } from "@/components/ui";
import { copy } from "@/lib/copy";
import { prisma, hasDatabase } from "@/lib/db";
import { currentParent } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Past sessions" };

export default async function HistoryPage() {
  const parent = await currentParent();

  const sessions =
    hasDatabase() && parent.id !== "anonymous"
      ? await prisma.session
          .findMany({
            where: { child: { parentId: parent.id } },
            orderBy: { startedAt: "desc" },
            take: 50,
            select: {
              id: true,
              startedAt: true,
              autonomyScore: true,
              parked: true,
              shareToken: true,
              shareExpiresAt: true,
              child: { select: { grade: true, firstName: true } },
              _count: { select: { moves: true } },
            },
          })
          .catch(() => [])
      : [];

  // The topic of a session is the standard its most recent problem sits under.
  const topics = new Map<string, string>();
  if (hasDatabase() && parent.id !== "anonymous" && sessions.length > 0) {
    const problems = await prisma.problem
      .findMany({
        where: { assignment: { child: { parentId: parent.id } } },
        orderBy: { id: "desc" },
        take: 50,
        select: { printedText: true, assignment: { select: { childId: true } } },
      })
      .catch(() => []);
    for (const problem of problems) {
      const key = problem.assignment.childId;
      if (!topics.has(key)) topics.set(key, problem.printedText);
    }
  }

  return (
    <Page>
      <header style={{ paddingBottom: 18 }}>
        <h1 style={{ fontSize: "var(--type-h1)" }}>{copy.history.heading}</h1>
      </header>

      {parent.id === "anonymous" ? (
        <Section title={copy.history.anonymous}>
          <Link href="/login" style={{ fontSize: 17 }}>
            {copy.account.signIn}
          </Link>
        </Section>
      ) : (
        <HistoryList
          sessions={sessions.map((s) => ({
            id: s.id,
            startedAt: s.startedAt.toISOString(),
            autonomyScore: s.autonomyScore,
            parked: s.parked,
            moves: s._count.moves,
            grade: s.child.grade,
            topic: null,
            shareToken: s.shareToken,
            shareExpiresAt: s.shareExpiresAt?.toISOString() ?? null,
          }))}
        />
      )}
    </Page>
  );
}
