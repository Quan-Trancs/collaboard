import mongoose from 'mongoose';
import { ChatMessage } from '../models/ChatMessage.js';

export const CHAT_MAX_LENGTH = 2000;
export const CHAT_HISTORY_LIMIT = 100;

export type ChatMessagePayload = {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
  clientId?: string;
};

export function normalizeChatText(value: unknown): { text: string } | { error: string } {
  if (typeof value !== 'string') return { error: 'Message must be text' };
  const text = value.replace(/\u0000/g, '').trim();
  if (!text) return { error: 'Message is empty' };
  if (text.length > CHAT_MAX_LENGTH) {
    return { error: `Message is longer than ${CHAT_MAX_LENGTH} characters` };
  }
  return { text };
}

export function normalizeClientId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const id = value.trim();
  if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) return undefined;
  return id;
}

export function serializeChatMessage(
  doc: { _id: { toString(): string }; user_id: { toString(): string }; user_name: string; text: string; createdAt?: Date },
  clientId?: string
): ChatMessagePayload {
  return {
    id: doc._id.toString(),
    userId: doc.user_id.toString(),
    userName: doc.user_name,
    text: doc.text,
    createdAt: (doc.createdAt ?? new Date()).toISOString(),
    ...(clientId ? { clientId } : {}),
  };
}

export async function findChatByClientId(boardId: string, clientId: string): Promise<ChatMessagePayload | null> {
  if (!mongoose.Types.ObjectId.isValid(boardId)) return null;
  const existing = await ChatMessage.findOne({ board_id: boardId, client_id: clientId }).lean();
  if (!existing) return null;
  return serializeChatMessage(existing, clientId);
}

export async function listChatMessages(boardId: string, limit = CHAT_HISTORY_LIMIT): Promise<ChatMessagePayload[]> {
  if (!mongoose.Types.ObjectId.isValid(boardId)) return [];
  const rows = await ChatMessage.find({ board_id: boardId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return rows.reverse().map((row) => serializeChatMessage(row));
}

function isDuplicateKey(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: number }).code === 11000);
}

export async function recordChatMessage(input: {
  boardId: string;
  userId: string;
  userName: string;
  text: string;
  clientId?: string | undefined;
}): Promise<ChatMessagePayload> {
  const boardId = new mongoose.Types.ObjectId(input.boardId);
  const userId = new mongoose.Types.ObjectId(input.userId);
  const userName = input.userName.trim().slice(0, 80) || 'Someone';

  if (input.clientId) {
    const existing = await ChatMessage.findOne({ board_id: boardId, client_id: input.clientId }).lean();
    if (existing) return serializeChatMessage(existing, input.clientId);
  }

  try {
    const doc = await ChatMessage.create({
      board_id: boardId,
      user_id: userId,
      user_name: userName,
      text: input.text,
      ...(input.clientId ? { client_id: input.clientId } : {}),
    });
    return serializeChatMessage(doc, input.clientId);
  } catch (error) {
    if (input.clientId && isDuplicateKey(error)) {
      const existing = await ChatMessage.findOne({ board_id: boardId, client_id: input.clientId }).lean();
      if (existing) return serializeChatMessage(existing, input.clientId);
    }
    throw error;
  }
}
