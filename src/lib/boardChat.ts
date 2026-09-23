export const CHAT_MAX_LENGTH = 2000;

export interface BoardChatMessage {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
  clientId?: string;
  pending?: boolean;
}

export function draftChatText(value: string): string | null {
  const text = value.replace(/\u0000/g, "").trim();
  if (!text || text.length > CHAT_MAX_LENGTH) return null;
  return text;
}

export function applyChatHistory(history: BoardChatMessage[], pending: BoardChatMessage[]): BoardChatMessage[] {
  const pendingOnly = pending.filter((message) => message.pending);
  return [...history, ...pendingOnly];
}

export function applyChatMessage(current: BoardChatMessage[], incoming: BoardChatMessage): BoardChatMessage[] {
  if (incoming.clientId) {
    const index = current.findIndex(
      (message) => message.clientId === incoming.clientId || message.id === incoming.clientId
    );
    if (index >= 0) {
      const next = current.filter((message, messageIndex) => messageIndex === index || message.id !== incoming.id);
      const replaceAt = next.findIndex(
        (message) => message.clientId === incoming.clientId || message.id === incoming.clientId
      );
      next[replaceAt] = { ...incoming, pending: false };
      return next;
    }
  }
  if (current.some((message) => message.id === incoming.id)) return current;
  return [...current, { ...incoming, pending: false }];
}

export function isBoardChatTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest("[data-board-chat]"));
}

export const CHAT_ACK_TIMEOUT_MS = 5000;

type ChatHandler = (payload: any) => void;

type ChatSocket = {
  on(event: string, handler: ChatHandler): void;
  off(event: string, handler: ChatHandler): void;
  emit(event: string, payload: unknown): void;
};

export type BoardChatBindings = {
  onMessages: (update: (current: BoardChatMessage[]) => BoardChatMessage[]) => void;
  onUnread: (count: number) => void;
  onError: (error: string | null) => void;
  onSending: (sending: boolean) => void;
  onRejected: (draft: { text: string; id: number }) => void;
};

type Timer = { cancel: () => void };

const browserSchedule = (run: () => void, ms: number): Timer => {
  const id = setTimeout(run, ms);
  return { cancel: () => clearTimeout(id) };
};

export function createBoardChat(options: {
  socket: ChatSocket;
  userId: string;
  userName: string;
  boardId: string;
  bindings: BoardChatBindings;
  now?: () => string;
  timeoutMs?: number;
  schedule?: (run: () => void, ms: number) => Timer;
}) {
  const seen = new Set<string>();
  const timers = new Map<string, Timer>();
  let unread = 0;
  let rejectCount = 0;
  const timeoutMs = options.timeoutMs ?? CHAT_ACK_TIMEOUT_MS;
  const schedule = options.schedule ?? browserSchedule;
  const now = options.now ?? (() => new Date().toISOString());

  const setUnread = (count: number) => {
    unread = count;
    options.bindings.onUnread(count);
  };

  const finishSend = (clientId: string) => {
    timers.get(clientId)?.cancel();
    timers.delete(clientId);
    if (timers.size === 0) options.bindings.onSending(false);
  };

  const onHistory = (payload: { messages?: BoardChatMessage[] }) => {
    const history = payload.messages ?? [];
    seen.clear();
    for (const message of history) seen.add(message.id);
    options.bindings.onMessages((current) => applyChatHistory(history, current));
    setUnread(0);
    options.bindings.onError(null);
  };

  const onMessage = (message: BoardChatMessage) => {
    options.bindings.onMessages((current) => applyChatMessage(current, message));
    if (message.clientId) finishSend(message.clientId);
    options.bindings.onError(null);
    if (seen.has(message.id)) return;
    seen.add(message.id);
    if (message.userId !== options.userId) setUnread(unread + 1);
  };

  const onSendError = (payload: { error?: string; clientId?: string; text?: string }) => {
    if (payload?.clientId) finishSend(payload.clientId);
    else if (timers.size === 0) options.bindings.onSending(false);
    options.bindings.onError(payload?.error || "Could not send message");
    if (payload?.text) {
      rejectCount += 1;
      options.bindings.onRejected({ text: payload.text, id: rejectCount });
    }
    if (payload?.clientId) {
      const clientId = payload.clientId;
      options.bindings.onMessages((current) => current.filter((message) => message.clientId !== clientId));
    }
  };

  options.socket.on("chat-history", onHistory);
  options.socket.on("chat-message", onMessage);
  options.socket.on("chat-error", onSendError);

  return {
    send(text: string) {
      const cleaned = draftChatText(text);
      if (!cleaned) return;
      const clientId = crypto.randomUUID();
      const optimistic: BoardChatMessage = {
        id: clientId,
        clientId,
        userId: options.userId,
        userName: options.userName,
        text: cleaned,
        createdAt: now(),
        pending: true,
      };
      options.bindings.onMessages((current) => [...current, optimistic]);
      options.bindings.onSending(true);
      options.bindings.onError(null);
      options.socket.emit("chat-send", { boardId: options.boardId, text: cleaned, clientId });
      const timer = schedule(() => {
        timers.delete(clientId);
        options.bindings.onMessages((current) =>
          current.filter((message) => !(message.clientId === clientId && message.pending))
        );
        options.bindings.onError("Message was not delivered");
        rejectCount += 1;
        options.bindings.onRejected({ text: cleaned, id: rejectCount });
        if (timers.size === 0) options.bindings.onSending(false);
      }, timeoutMs);
      timers.set(clientId, timer);
    },
    markRead() {
      setUnread(0);
    },
    dispose() {
      for (const timer of timers.values()) timer.cancel();
      timers.clear();
      options.socket.off("chat-history", onHistory);
      options.socket.off("chat-message", onMessage);
      options.socket.off("chat-error", onSendError);
    },
  };
}
