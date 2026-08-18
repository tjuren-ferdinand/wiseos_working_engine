import Chat from "@/components/Chat";
import PageHeader from "@/components/ui/PageHeader";

export const metadata = {
  title: "AI-assistent · WiseOS",
  description: "WiseOS AI-assistent — Gemini-temporär integration",
};

export default function ChatPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="AI-assistent" subtitle="Tillfälligt Gemini — förberett för Claude-bytes." />
      <Chat />
    </div>
  );
}
