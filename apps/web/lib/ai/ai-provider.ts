export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AIResponse {
  text: string;
  error?: string;
}

export interface AIProvider {
  generateResponse(messages: ChatMessage[]): Promise<AIResponse>;
}
