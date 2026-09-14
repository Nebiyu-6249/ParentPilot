"use client";

import { useEffect, useState } from "react";

import PacketScreen from "@/components/PacketScreen";
import StatusLine from "@/components/StatusLine";
import { Banner, Page } from "@/components/ui";
import { copy } from "@/lib/copy";
import { requestPacket } from "@/lib/client/packet";
import type { RegisterName } from "@/lib/ai/schemas";
import type { PacketBundle } from "@/lib/types";

/**
 * Streams a packet, naming each step as the server reaches it.
 *
 * The first line is set before the request goes out, so there is never a
 * blank screen, and the rest come off the NDJSON stream as the pipeline
 * moves through verification, standard matching and generation.
 */
export default function PacketLoader({
  problemId,
  register,
}: {
  problemId: string;
  register: RegisterName;
}) {
  const [bundle, setBundle] = useState<PacketBundle | null>(null);
  const [step, setStep] = useState<string>(copy.status.reading);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;

    requestPacket({ problemId, register }, (text) => {
      if (live) setStep(text);
    })
      .then((result) => {
        if (live) setBundle(result);
      })
      .catch(() => {
        if (live) setFailed(true);
      });

    return () => {
      live = false;
    };
  }, [problemId, register]);

  if (bundle) return <PacketScreen initial={bundle} />;

  return (
    <Page>
      {failed ? <Banner text={copy.errors.generic} /> : <StatusLine step={step} />}
    </Page>
  );
}
