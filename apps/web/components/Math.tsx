"use client";

import { useMemo, type ReactNode } from "react";
import katex from "katex";

/**
 * Renderar text med LaTeX och markdown.
 *
 * Parsningsordning (viktigt!):
 *   1. LaTeX-segment extraheras och ersätts med placeholders — de kan aldrig
 *      påverkas av markdown-parsningen.
 *   2. Markdown (**bold**, *italic*, sektioner, listpunkter) appliceras på
 *      texten med placeholders kvar inne i markdown-tokens — det gör att
 *      `*text \(x\) mer*` och `**…@@MATH@@…**` fungerar korrekt.
 *   3. Placeholders expanderas till KaTeX-renderad HTML först vid render.
 *
 * Stöder:
 *   \( ... \)        — inline-formel
 *   \[ ... \]        — display-formel (egen rad)
 *   **text**         — fetstil
 *   *text*           — kursiv
 *   \n\n             — styckebrytning
 *   **X** / N. **X** — sektionsrubrik när X börjar med stor bokstav
 *   – punkt          — listpunkt inom en sektion (en-dash följt av
 *                      versal/siffra/formel — streck i löpande text rör ej)
 *
 * Felaktig LaTeX eller markdown visas som rå text (ingen krasch).
 */
export default function Math({ content }: { content: string }) {
  const blocks = useMemo(() => parseContent(content), [content]);
  return (
    <>
      {blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MathPart = { tex: string; display: boolean };

type Inline =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string };

type Block =
  | { type: "section"; header: string; lead: Inline[]; items: Inline[][]; _math: MathPart[] }
  | { type: "paragraph"; body: Inline[]; _math: MathPart[] };

// ---------------------------------------------------------------------------
// Rendering — spans (inte div/ul) så att MathText är giltig även inne i <p>
// ---------------------------------------------------------------------------

function Block({ block }: { block: Block }) {
  if (block.type === "section") {
    return (
      <span className="block mt-3 first:mt-0">
        <span className="block font-semibold text-ink">{block.header}</span>
        {block.lead.length > 0 && (
          <span className="block">
            {block.lead.map((seg, j) => renderInline(seg, j, block._math))}
          </span>
        )}
        {block.items.length > 0 && (
          <span className="block mt-1 space-y-0.5">
            {block.items.map((item, j) => (
              <span key={j} className="flex gap-1.5">
                <span className="shrink-0 text-ink-muted">–</span>
                <span>{item.map((seg, k) => renderInline(seg, k, block._math))}</span>
              </span>
            ))}
          </span>
        )}
      </span>
    );
  }
  return (
    <span className="block mt-3 first:mt-0">
      {block.body.map((seg, j) => renderInline(seg, j, block._math))}
    </span>
  );
}

function renderInline(seg: Inline, i: number, mathParts: MathPart[]) {
  const children = expandMath(seg.value, mathParts, i);
  if (seg.type === "bold") return <strong key={i}>{children}</strong>;
  if (seg.type === "italic") return <em key={i}>{children}</em>;
  return <span key={i}>{children}</span>;
}

/** Expandera @@MATH_N@@-placeholders till KaTeX-spans. */
function expandMath(text: string, mathParts: MathPart[], keyBase: number): ReactNode[] {
  const parts = text.split(/@@MATH_(\d+)@@/);
  const out: ReactNode[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) {
      const m = mathParts[parseInt(parts[i], 10)];
      out.push(
        <span
          key={`${keyBase}-m${i}`}
          className={m.display ? "block my-1.5" : undefined}
          dangerouslySetInnerHTML={{ __html: renderKatex(m.tex, m.display) }}
        />,
      );
    } else if (parts[i]) {
      out.push(<span key={`${keyBase}-t${i}`}>{parts[i]}</span>);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Parsing — steg 1: extrahera LaTeX, steg 2: struktur, steg 3: markdown-inline
// ---------------------------------------------------------------------------

function parseContent(input: string): Block[] {
  // Steg 1: Extrahera LaTeX-segment → placeholders.
  const mathParts: MathPart[] = [];
  const withPlaceholders = input.replace(
    /\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)/g,
    (_match, displayTex, inlineTex) => {
      const tex = (displayTex ?? inlineTex).trim();
      mathParts.push({ tex, display: displayTex !== undefined });
      return `@@MATH_${mathParts.length - 1}@@`;
    },
  );

  // Steg 2: Normalisera sektionsrubriker — "**Rubrik**" eller "1. **Rubrik**"
  // (Rubrik börjar med versal). Siffran bevaras i rubriktexten.
  const normalized = withPlaceholders
    .replace(
      /(?:(\d+)\s*[.)]\s*)?\*\*([A-ZÅÄÖ][^*\n]*)\*\*/g,
      (_m, num, hdr) => `\n\n**${num ? `${num}. ` : ""}${hdr}**`,
    )
    .replace(/^\n\n+/, "");

  const paragraphs = normalized.split(/\n\n+/).filter((p) => p.trim());

  const blocks: Block[] = [];
  for (const para of paragraphs) {
    // Små fragment (barnånskiljetecken) fogas till föregående block
    if (para.trim().length <= 2 && blocks.length > 0) {
      const prev = blocks[blocks.length - 1];
      const extra = parseMarkdownInline(para);
      if (prev.type === "section") prev.lead.push(...extra);
      else prev.body.push(...extra);
      continue;
    }

    const headerMatch = para.match(/^\*\*([^*]+)\*\*\s*/);
    if (headerMatch) {
      const body = para.slice(headerMatch[0].length);
      const { lead, items } = splitBullets(body);
      blocks.push({
        type: "section",
        header: headerMatch[1],
        lead: parseMarkdownInline(lead),
        items: items.map(parseMarkdownInline),
        _math: mathParts,
      });
    } else {
      blocks.push({
        type: "paragraph",
        body: parseMarkdownInline(para),
        _math: mathParts,
      });
    }
  }

  return blocks;
}

/**
 * Delar en sektionskropp i en ledtext och listpunkter. Ett " – " räknas som
 * liststreck om det står i början av kroppen eller direkt efter meningsslut
 * (. ! ? : ) ] * eller ett formel-placeholder). Streck i löpande text
 * ("resultatet – korrekt") påverkas inte.
 */
function splitBullets(body: string): { lead: string; items: string[] } {
  const marked = body
    .replace(/^\s*–\s+/, "@@BULLET@@")
    .replace(/(@@MATH_\d+@@)\s*([.!?:)\]*])?\s+–\s+/g, "$1$2@@BULLET@@")
    .replace(/([.!?:)\]*])\s+–\s+/g, "$1@@BULLET@@");
  if (!marked.includes("@@BULLET@@")) return { lead: body, items: [] };
  const parts = marked.split("@@BULLET@@");
  if (/^\s*–/.test(body)) {
    return { lead: "", items: parts.filter((p) => p !== "") };
  }
  const [lead, ...items] = parts;
  return { lead, items };
}

function parseMarkdownInline(text: string): Inline[] {
  const inlines: Inline[] = [];
  const regex = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      inlines.push({ type: "text", value: text.slice(last, match.index) });
    }
    if (match[1] !== undefined) {
      inlines.push({ type: "bold", value: match[1] });
    } else if (match[2] !== undefined) {
      inlines.push({ type: "italic", value: match[2] });
    }
    last = regex.lastIndex;
  }
  if (last < text.length) {
    inlines.push({ type: "text", value: text.slice(last) });
  }
  return inlines;
}

function renderKatex(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      output: "html",
    });
  } catch {
    return tex;
  }
}
