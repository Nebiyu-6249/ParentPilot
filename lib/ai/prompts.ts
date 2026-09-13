import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Loads system prompts from /prompts at runtime.
 *
 * Prompts are never inlined in a component or a route handler. Keeping them
 * as markdown files means they can be read, reviewed and diffed by someone
 * who does not read TypeScript, which matters because the prompt files are
 * where the em-dash ban and the never-address-the-child rule actually live.
 *
 * `next.config.ts` traces `prompts/**` into the serverless bundle so this
 * read works on Vercel as well as locally.
 */

export type PromptName =
  | "extract-worksheet"
  | "generate-packet"
  | "classify-move"
  | "session-recap"
  | "teacher-note";

const cache = new Map<PromptName, string>();

async function readPrompt(name: PromptName): Promise<string> {
  const cached = cache.get(name);
  if (cached !== undefined) return cached;

  const file = path.join(process.cwd(), "prompts", `${name}.md`);
  const text = await readFile(file, "utf8");
  cache.set(name, text);
  return text;
}

/**
 * Loads a prompt and substitutes `{{TOKEN}}` placeholders.
 *
 * Any placeholder left unfilled is replaced with `null` rather than left as
 * a literal `{{TOKEN}}`, because a model shown a raw template token tends
 * to invent a value for it.
 */
export async function loadPrompt(
  name: PromptName,
  vars: Record<string, string | number | null | undefined> = {},
): Promise<string> {
  const raw = await readPrompt(name);
  return raw.replace(/\{\{([A-Z_]+)\}\}/g, (_match, token: string) => {
    const value = vars[token];
    if (value === null || value === undefined || value === "") return "null";
    return String(value);
  });
}
