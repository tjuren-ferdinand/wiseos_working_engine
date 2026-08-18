import { NextResponse } from "next/server";
import { GeminiProvider } from "@/lib/ai/gemini-provider";
import type { ChatMessage } from "@/lib/ai/ai-provider";

const apiKey = process.env.GEMINI_API_KEY ?? "";
const model = process.env.GEMINI_MODEL || "gemini-flash-latest";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { messages?: ChatMessage[] };
    const messages = body.messages ?? [];

    const provider = new GeminiProvider(apiKey, model);
    const result = await provider.generateResponse(messages);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ response: result.text });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Oväntat fel";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
