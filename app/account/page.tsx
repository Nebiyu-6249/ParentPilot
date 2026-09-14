import type { Metadata } from "next";

import AccountScreen from "@/components/AccountScreen";
import { prisma, hasDatabase } from "@/lib/db";
import { currentParent } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your account" };

export default async function AccountPage() {
  const parent = await currentParent();

  const children =
    hasDatabase() && parent.id !== "anonymous"
      ? await prisma.child
          .findMany({ where: { parentId: parent.id }, orderBy: { id: "asc" } })
          .catch(() => [])
      : [];

  return (
    <AccountScreen
      email={parent.email}
      register={parent.register}
      language={parent.language}
      anxietyBand={parent.anxietyBand}
      children={children.map((c) => ({
        id: c.id,
        firstName: c.firstName,
        grade: c.grade,
        curriculum: c.curriculum,
      }))}
    />
  );
}
