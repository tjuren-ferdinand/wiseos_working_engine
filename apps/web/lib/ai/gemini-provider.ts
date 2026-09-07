import { GoogleGenAI } from "@google/genai";
import type { AIProvider, AIResponse, ChatMessage } from "./ai-provider";

export class GeminiProvider implements AIProvider {
  private ai: GoogleGenAI;
  private model: string;
  private hasKey: boolean;

  constructor(apiKey: string, model = "gemini-1.5-pro") {
    this.ai = new GoogleGenAI({ apiKey });
    this.model = model;
    this.hasKey = !!apiKey && apiKey.trim().length > 0;
  }

  async generateResponse(messages: ChatMessage[]): Promise<AIResponse> {
    if (!this.hasKey) {
      return { text: "", error: "AI-tjänsten är inte konfigurerad ännu." };
    }

    try {
      const contents = messages.map((m) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }],
      }));

      const result = await this.ai.models.generateContent({
        model: this.model,
        contents,
      });

      const text = result.text ?? "";
      return { text };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("429") || message.includes("rate limit")) {
        return { text: "", error: "AI-tjänsten är tillfälligt överbelastad. Försök igen om en liten stund." };
      }
      return { text: "", error: "Något gick fel när vi pratade med AI-tjänsten." };
    }
  }
}
