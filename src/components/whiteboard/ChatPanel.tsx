import { FormEvent, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CHAT_MAX_LENGTH, draftChatText, type BoardChatMessage } from "@/lib/boardChat";

interface ChatPanelProps {
  messages: BoardChatMessage[];
  connected: boolean;
  sending: boolean;
  currentUserId: string;
  error: string | null;
  rejectedDraft: { text: string; id: number } | null;
  onClose: () => void;
  onSend: (text: string) => void;
}

function formatChatTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function ChatPanel({
  messages,
  connected,
  sending,
  currentUserId,
  error,
  rejectedDraft,
  onClose,
  onSend,
}: ChatPanelProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!rejectedDraft) return;
    setDraft(rejectedDraft.text);
  }, [rejectedDraft]);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const text = draftChatText(draft);
    if (!text || !connected || sending) return;
    onSend(text);
    setDraft("");
  };

  return (
    <aside
      data-board-chat
      className="absolute inset-y-0 right-0 z-30 flex w-full max-w-sm flex-col border-l border-gray-200 bg-white shadow-lg"
      aria-label="Board chat"
      onWheel={(event) => event.stopPropagation()}
    >
      <header className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
        <h2 className="text-sm font-semibold text-gray-900">Chat</h2>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close chat">
          <X className="h-4 w-4" />
        </Button>
      </header>
      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3" aria-live="polite">
        {messages.length === 0 && (
          <p className="text-sm text-gray-500">No messages yet. Say hello.</p>
        )}
        {messages.map((message) => {
          const mine = message.userId === currentUserId;
          return (
            <div key={message.id} className={mine ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  mine
                    ? "max-w-[85%] rounded-lg bg-blue-600 px-3 py-2 text-white"
                    : "max-w-[85%] rounded-lg bg-gray-100 px-3 py-2 text-gray-900"
                }
              >
                {!mine && <p className="text-xs font-medium text-gray-600">{message.userName}</p>}
                <p className="whitespace-pre-wrap break-words text-sm">{message.text}</p>
                <p className={`mt-1 text-[10px] ${mine ? "text-blue-100" : "text-gray-500"}`}>
                  {formatChatTime(message.createdAt)}
                  {message.pending ? " · Sending" : ""}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={submit} className="border-t border-gray-200 p-3">
        <div className="flex gap-2">
          <Input
            aria-label="Chat message"
            value={draft}
            maxLength={CHAT_MAX_LENGTH}
            disabled={!connected || sending}
            placeholder={connected ? "Message the board" : "Connecting…"}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
          />
          <Button type="submit" aria-label="Send message" disabled={!connected || sending || !draft.trim()}>
            Send
          </Button>
        </div>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </form>
    </aside>
  );
}
