import type { Server, Socket } from 'socket.io';
import {
  findChatByClientId,
  listChatMessages,
  normalizeChatText,
  normalizeClientId,
  recordChatMessage,
} from './chat.js';

const CHAT_MIN_INTERVAL_MS = 300;

type ChatSession = {
  boardId: () => string | null;
  user: () => { userId: string; name: string } | null;
};

export async function emitChatHistory(socket: Socket, boardId: string) {
  try {
    const messages = await listChatMessages(boardId);
    socket.emit('chat-history', { messages });
  } catch {
    socket.emit('chat-history', { messages: [] });
  }
}

export function registerBoardChat(socket: Socket, io: Server, session: ChatSession) {
  let lastChatAt = 0;

  socket.on('chat-send', async (data: { boardId?: string; text?: unknown; clientId?: unknown }) => {
    const boardId = session.boardId();
    const user = session.user();
    if (!boardId || !user || data.boardId !== boardId) return;

    const clientId = normalizeClientId(data.clientId);
    const rawText = typeof data.text === 'string' ? data.text : '';
    const normalized = normalizeChatText(data.text);
    if ('error' in normalized) {
      socket.emit('chat-error', { error: normalized.error, clientId, text: rawText });
      return;
    }

    try {
      if (clientId) {
        const existing = await findChatByClientId(boardId, clientId);
        if (existing) {
          io.to(`board-${boardId}`).emit('chat-message', existing);
          return;
        }
      }

      const now = Date.now();
      if (now - lastChatAt < CHAT_MIN_INTERVAL_MS) {
        socket.emit('chat-error', {
          error: 'Slow down a moment before sending another message',
          clientId,
          text: normalized.text,
        });
        return;
      }

      const message = await recordChatMessage({
        boardId,
        userId: user.userId,
        userName: user.name,
        text: normalized.text,
        clientId,
      });
      lastChatAt = now;
      io.to(`board-${boardId}`).emit('chat-message', message);
    } catch {
      socket.emit('chat-error', { error: 'Could not send message', clientId, text: normalized.text });
    }
  });
}
