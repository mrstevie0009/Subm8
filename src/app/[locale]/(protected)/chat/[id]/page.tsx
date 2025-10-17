//src/app/[locale]/(protected)/chat/[id]/page.tsx
import ClientThread from "@/components/ClientThread";

export const dynamic = "force-dynamic";

export default function ChatThreadPage() {
  return <ClientThread />;
}
