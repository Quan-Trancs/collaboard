import { describe, expect, it } from "vitest";
import { applyChatHistory, applyChatMessage, createBoardChat, draftChatText, type BoardChatMessage } from "./boardChat";

function message(overrides: Partial<BoardChatMessage>): BoardChatMessage {
  return {
    id: "m1",
    userId: "u1",
    userName: "Ada",
    text: "hello",
    createdAt: "2026-09-23T00:00:00.000Z",
    ...overrides,
  };
}

describe("board chat", () => {
  it("trims a draft and drops a blank one", () => {
    expect(draftChatText("  hi  ")).toBe("hi");
    expect(draftChatText("   ")).toBeNull();
  });

  it("replaces the optimistic message when the server echoes it", () => {
    const pending = message({ id: "client-1", clientId: "client-1", pending: true, text: "hello" });
    const saved = message({ id: "server-1", clientId: "client-1", text: "hello" });
    expect(applyChatMessage([pending], saved)).toEqual([{ ...saved, pending: false }]);
  });

  it("ignores a duplicate server message", () => {
    const saved = message({ id: "server-1" });
    const current = [saved];
    expect(applyChatMessage(current, saved)).toBe(current);
  });

  it("keeps an unsent message when history arrives", () => {
    const pending = message({ id: "client-1", pending: true, text: "still sending" });
    const history = [message({ id: "older", text: "earlier" })];
    expect(applyChatHistory(history, [pending])).toEqual([...history, pending]);
  });
});

describe("board chat session", () => {
  function harness() {
    const handlers = new Map<string, (payload: any) => void>();
    const sent: unknown[] = [];
    const socket = {
      on(event: string, handler: (payload: any) => void) {
        handlers.set(event, handler);
      },
      off(event: string, handler: (payload: any) => void) {
        if (handlers.get(event) === handler) handlers.delete(event);
      },
      emit(_event: string, payload: unknown) {
        sent.push(payload);
      },
    };
    let messages: BoardChatMessage[] = [];
    let unread = 0;
    let error: string | null = null;
    let sending = false;
    const timers: Array<() => void> = [];
    const chat = createBoardChat({
      socket,
      userId: "me",
      userName: "Me",
      boardId: "board-1",
      now: () => "2026-09-23T00:00:00.000Z",
      schedule: (run) => {
        timers.push(run);
        return { cancel: () => {} };
      },
      bindings: {
        onMessages: (update) => {
          messages = update(messages);
        },
        onUnread: (count) => {
          unread = count;
        },
        onError: (next) => {
          error = next;
        },
        onSending: (next) => {
          sending = next;
        },
        onRejected: () => {},
      },
    });
    return {
      chat,
      sent,
      timers,
      trigger: (event: string, payload: unknown) => handlers.get(event)?.(payload),
      read: () => ({ messages, unread, error, sending }),
    };
  }

  it("keeps chat events off the drawing socket API", () => {
    const session = harness();
    session.chat.send("  hello  ");
    expect(session.sent).toEqual([
      expect.objectContaining({ boardId: "board-1", text: "hello" }),
    ]);
    expect(session.read().sending).toBe(true);

    const clientId = (session.sent[0] as { clientId: string }).clientId;
    session.trigger("chat-message", message({ id: "saved-1", userId: "me", clientId, text: "hello" }));
    expect(session.read().messages.map((item) => item.id)).toEqual(["saved-1"]);
    expect(session.read().sending).toBe(false);
    expect(session.read().unread).toBe(0);
  });

  it("counts another person's message once", () => {
    const session = harness();
    session.trigger("chat-message", message({ id: "theirs", userId: "them", userName: "Them" }));
    session.trigger("chat-message", message({ id: "theirs", userId: "them", userName: "Them" }));
    expect(session.read().unread).toBe(1);
    session.chat.markRead();
    expect(session.read().unread).toBe(0);
  });

  it("gives the composer back if the server never answers", () => {
    const session = harness();
    session.chat.send("hello");
    session.timers[0]();
    expect(session.read().messages).toEqual([]);
    expect(session.read().sending).toBe(false);
    expect(session.read().error).toBe("Message was not delivered");
  });
});
