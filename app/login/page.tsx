import type { Metadata } from "next";

import LoginForm from "@/components/LoginForm";
import { LocaleProvider } from "@/components/LocaleProvider";
import { currentParent } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in" };

const REASONS: Record<string, keyof typeof import("@/lib/copy").copy.login> = {
  invalid: "invalid",
  expired: "expired",
  used: "used",
  unavailable: "failed",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const reason = error && error in REASONS ? REASONS[error] : null;
  const parent = await currentParent();
  return (
    <LocaleProvider code={parent.language}>
      <LoginForm errorKey={reason ?? null} />
    </LocaleProvider>
  );
}
