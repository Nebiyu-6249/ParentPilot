import type { ReactNode } from "react";

/**
 * The small amount of markdown an assistant turn actually uses.
 *
 * Bold, inline code, numbered and bulleted lists, paragraphs. No library: the
 * grammar below is the whole of what `chat-turn.md` asks for, a parser for it
 * is forty lines, and a markdown dependency in a page that renders model
 * output is a much larger surface than the feature is worth.
 *
 * Nothing here interprets HTML. Text is placed as text, so a reply containing
 * a tag renders as that tag's characters rather than as markup.
 */

type Block =
  | { kind: "p"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] };

const BULLET = /^\s*[-*]\s+(.*)$/;
const NUMBER = /^\s*\d+[.)]\s+(.*)$/;

export function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let paragraph: string[] = [];

  const flushParagraph = (): void => {
    if (paragraph.length === 0) return;
    blocks.push({ kind: "p", text: paragraph.join(" ") });
    paragraph = [];
  };
  const flushList = (): void => {
    if (!list) return;
    blocks.push({ kind: "list", ordered: list.ordered, items: list.items });
    list = null;
  };

  for (const line of source.split("\n")) {
    const bullet = line.match(BULLET);
    const numbered = line.match(NUMBER);

    if (bullet ?? numbered) {
      flushParagraph();
      const ordered = numbered !== null;
      const item = (numbered?.[1] ?? bullet?.[1] ?? "").trim();
      if (list && list.ordered === ordered) list.items.push(item);
      else {
        flushList();
        list = { ordered, items: [item] };
      }
      continue;
    }

    if (!line.trim()) {
      flushList();
      flushParagraph();
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  flushList();
  flushParagraph();
  return blocks;
}

/** Bold and inline code within one line. */
function inline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  // One pass over both, so `**a `b` c**` cannot interleave badly: whichever
  // opens first wins and the other is literal inside it.
  const pattern = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let at = 0;
  let match: RegExpExecArray | null;
  let n = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > at) out.push(text.slice(at, match.index));
    if (match[1] !== undefined) out.push(<strong key={`${keyPrefix}-b${n}`}>{match[1]}</strong>);
    else out.push(<code key={`${keyPrefix}-c${n}`} className="pp-code">{match[2]}</code>);
    at = match.index + match[0].length;
    n += 1;
  }

  if (at < text.length) out.push(text.slice(at));
  return out;
}

export function Markdown({ source }: { source: string }) {
  const blocks = parseBlocks(source);

  return (
    <>
      {blocks.map((block, i) =>
        block.kind === "p" ? (
          <p key={`p${i}`} className="pp-md-p">
            {inline(block.text, `p${i}`)}
          </p>
        ) : block.ordered ? (
          <ol key={`l${i}`} className="pp-md-list">
            {block.items.map((item, j) => (
              <li key={`l${i}i${j}`}>{inline(item, `l${i}i${j}`)}</li>
            ))}
          </ol>
        ) : (
          <ul key={`l${i}`} className="pp-md-list">
            {block.items.map((item, j) => (
              <li key={`l${i}i${j}`}>{inline(item, `l${i}i${j}`)}</li>
            ))}
          </ul>
        ),
      )}
    </>
  );
}
