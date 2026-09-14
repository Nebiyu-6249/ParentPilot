import type { RegisterName } from "@/lib/ai/schemas";
import type { PacketBundle } from "@/lib/types";

/**
 * Consumes the NDJSON stream from /api/packet.
 *
 * Each `status` line names the pipeline step the server is actually on, so
 * the status line a parent reads is a report rather than an animation. The
 * final `bundle` line is the packet.
 */
export async function requestPacket(
  body: { problemId: string; register?: RegisterName; language?: string },
  onStatus?: (text: string) => void,
): Promise<PacketBundle> {
  const response = await fetch("/api/packet", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok || !response.body) {
    throw new Error(`packet responded ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let bundle: PacketBundle | null = null;

  const consumeLine = (line: string): void => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const event = JSON.parse(trimmed) as
      | { type: "status"; step: string; text: string }
      | { type: "bundle"; bundle: PacketBundle };

    if (event.type === "status") onStatus?.(event.text);
    else bundle = event.bundle;
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      consumeLine(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
    }
  }

  consumeLine(buffer);

  if (!bundle) throw new Error("packet stream ended without a bundle");
  return bundle;
}
