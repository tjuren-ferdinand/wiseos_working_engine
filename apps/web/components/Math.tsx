"use client";

import { useMemo } from "react";
import katex from "katex";

/**
 * Renderar text med inline-LaTeX. Stöder:
 *   \( ... \)  — inline-formel
 *   \[ ... \]  — display-formel (block)
 *
 * Allt utanför dessa avgränsare renderas som vanlig text.
 * Felaktig LaTeX visas som rå text (inte kraschar).
 */
export default function Math({ content }: { content: string }) {
  const parts = useMemo(() => parseMath(content), [content]);
  return (
    <>
      {parts.map((part, i) => {
        if (part.type === "text") {
          return <span key={i}>{part.value}</span>;
        }
        const html = renderKatex(part.value, part.type === "display");
        return (
          <span
            key={i}
            className={part.type === "display" ? "math-block" : "math-inline"}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </>
  );
}

type Part = { type: "text" | "inline" | "display"; value: string };

function parseMath(input: string): Part[] {
  const parts: Part[] = [];
  const regex = /\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(input)) !== null) {
    if (match.index > last) {
      parts.push({ type: "text", value: input.slice(last, match.index) });
    }
    if (match[1] !== undefined) {
      parts.push({ type: "display", value: match[1].trim() });
    } else if (match[2] !== undefined) {
      parts.push({ type: "inline", value: match[2].trim() });
    }
    last = regex.lastIndex;
  }
  if (last < input.length) {
    parts.push({ type: "text", value: input.slice(last) });
  }
  return parts;
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
