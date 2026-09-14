import type { Metadata } from "next";

import OpsGate from "@/components/OpsGate";
import OpsBoard from "@/components/OpsBoard";
import { Page, Section } from "@/components/ui";
import { prisma, hasDatabase } from "@/lib/db";
import { isOperator, opsConfigured } from "@/lib/ops";
import { spendCeilingUsd, spendToday, todayCounts } from "@/lib/limits";
import { embeddedStandardCount } from "@/lib/standards";
import { modelRouting } from "@/lib/ai/provider";

export const metadata: Metadata = { title: "Operations" };
export const dynamic = "force-dynamic";

export default async function OpsPage() {
  if (!opsConfigured()) {
    return (
      <Page>
        <Section title="Operations">
          <p style={{ fontSize: 17 }}>
            OPS_PASSWORD is not set in this environment, so this page is closed. Set it and redeploy.
          </p>
        </Section>
      </Page>
    );
  }

  if (!(await isOperator())) return <OpsGate />;

  const [counts, spend, embedded, failures] = await Promise.all([
    todayCounts(),
    spendToday(),
    embeddedStandardCount(),
    hasDatabase()
      ? prisma.failureLog.findMany({ orderBy: { at: "desc" }, take: 20 }).catch(() => [])
      : Promise.resolve([]),
  ]);

  return (
    <OpsBoard
      counts={counts}
      spend={spend}
      ceiling={spendCeilingUsd()}
      embedded={embedded}
      models={modelRouting}
      failures={failures.map((f) => ({
        id: f.id,
        at: f.at.toISOString(),
        scope: f.scope,
        message: f.message,
      }))}
    />
  );
}
