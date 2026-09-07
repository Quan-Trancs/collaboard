import mongoose from 'mongoose';
import { getRedis } from '../config/redis.js';
import { Board } from '../models/Board.js';
import { SlideObject } from '../models/SlideObject.js';
import { InkStroke } from '../models/InkStroke.js';
import { serializeInkStroke, serializeSlideObject } from './serializers.js';
import { migrateLegacyElements } from './migrateElements.js';
import { isInHardWorld, assertPointsInHardWorld } from './canvasBounds.js';

const objectsKey = (boardId: string) => `board:${boardId}:objects`;
const drawingsKey = (boardId: string) => `board:${boardId}:drawings`;
const historyKey = (boardId: string) => `board:${boardId}:history`;
const usersKey = (boardId: string) => `board:${boardId}:users`;
const cursorsKey = (boardId: string) => `board:${boardId}:cursors`;
const viewportKey = (boardId: string) => `board:${boardId}:viewport`;
const readyKey = (boardId: string) => `board:${boardId}:ready`;

const HISTORY_CAP = 200;
const CURSOR_TTL_SECONDS = 60;
const FLUSH_MS = 1500;
const flushTimers = new Map<string, ReturnType<typeof setTimeout>>();

function parseHash(hash: Record<string, string>): any[] {
  return Object.values(hash).map((value) => {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }).filter(Boolean);
}

function toObjectId(id?: string) {
  return id && mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null;
}

export function isInkPayload(element: any): boolean {
  return element?.type === 'pen' || element?.type === 'drawing';
}

function slideTypeFromLive(type: string): 'text' | 'shape' | 'image' | 'table' | 'chart' | 'icon' | null {
  if (type === 'rectangle' || type === 'circle') return 'shape';
  if (type === 'text' || type === 'shape' || type === 'image' || type === 'table' || type === 'chart' || type === 'icon') {
    return type;
  }
  return null;
}

function objectPropsFromLive(element: any) {
  if (element.props && typeof element.props === 'object') return element.props;
  return {
    color: element.color,
    strokeWidth: element.strokeWidth,
    text: element.text,
    src: element.src,
    alt: element.alt,
    opacity: element.opacity,
    borderRadius: element.borderRadius,
    shapeType: element.shapeType || (element.type === 'circle' ? 'circle' : element.type === 'rectangle' ? 'rectangle' : undefined),
    fillColor: element.fillColor,
    data: element.data,
    symbol: element.symbol,
    rows: element.rows,
    cols: element.cols,
    chartType: element.chartType,
    colors: element.colors,
    fontSize: element.fontSize,
    fontFamily: element.fontFamily,
    bold: element.bold,
    italic: element.italic,
    underline: element.underline,
    strikethrough: element.strikethrough,
    align: element.align,
    lineHeight: element.lineHeight,
  };
}

export async function hydrateBoard(boardId: string): Promise<void> {
  const redis = getRedis();
  if (await redis.exists(readyKey(boardId))) return;

  const [objectCount, drawingCount] = await Promise.all([
    redis.hlen(objectsKey(boardId)),
    redis.hlen(drawingsKey(boardId)),
  ]);

  if (objectCount === 0 || drawingCount === 0) {
    await migrateLegacyElements(boardId);
  }

  if (objectCount === 0) {
    const docs = await SlideObject.find({ board_id: boardId }).lean();
    if (docs.length > 0) {
      const mapping: Record<string, string> = {};
      for (const doc of docs) {
        const serialized = serializeSlideObject(doc);
        mapping[serialized.id] = JSON.stringify(serialized);
      }
      await redis.hset(objectsKey(boardId), mapping);
    }
  }

  if (drawingCount === 0) {
    const docs = await InkStroke.find({ board_id: boardId }).lean();
    if (docs.length > 0) {
      const mapping: Record<string, string> = {};
      for (const doc of docs) {
        const serialized = serializeInkStroke(doc);
        mapping[serialized.id] = JSON.stringify(serialized);
      }
      await redis.hset(drawingsKey(boardId), mapping);
    }
  }

  const board = await Board.findById(boardId).select('viewport').lean();
  if (board?.viewport && !(await redis.exists(viewportKey(boardId)))) {
    await redis.set(viewportKey(boardId), JSON.stringify(board.viewport));
  }

  await redis.set(readyKey(boardId), '1');
}

export async function getLiveBoardState(boardId: string) {
  await hydrateBoard(boardId);
  const redis = getRedis();
  const [objects, drawings, users, cursors, viewportRaw] = await Promise.all([
    redis.hgetall(objectsKey(boardId)),
    redis.hgetall(drawingsKey(boardId)),
    redis.hgetall(usersKey(boardId)),
    redis.hgetall(cursorsKey(boardId)),
    redis.get(viewportKey(boardId)),
  ]);

  let viewport = null;
  if (viewportRaw) {
    try {
      viewport = JSON.parse(viewportRaw);
    } catch {
      viewport = null;
    }
  }

  return {
    objects: parseHash(objects),
    drawings: parseHash(drawings),
    users: parseHash(users),
    cursors: parseHash(cursors),
    viewport,
  };
}

async function writeHistory(boardId: string, entry: Record<string, unknown>) {
  const redis = getRedis();
  await redis.lpush(historyKey(boardId), JSON.stringify(entry));
  await redis.ltrim(historyKey(boardId), 0, HISTORY_CAP - 1);
}

export async function setUser(
  boardId: string,
  socketId: string,
  user: { userId: string; name: string; color: string }
) {
  await getRedis().hset(usersKey(boardId), socketId, JSON.stringify({ ...user, socketId }));
}

export async function removeUser(boardId: string, socketId: string) {
  const redis = getRedis();
  await Promise.all([
    redis.hdel(usersKey(boardId), socketId),
    redis.hdel(cursorsKey(boardId), socketId),
  ]);
}

export async function setCursor(
  boardId: string,
  socketId: string,
  cursor: { userId: string; x: number; y: number; name: string; color: string }
) {
  if (!isInHardWorld(cursor.x, cursor.y)) return false;
  const redis = getRedis();
  await redis.hset(cursorsKey(boardId), socketId, JSON.stringify({ ...cursor, socketId }));
  await redis.expire(cursorsKey(boardId), CURSOR_TTL_SECONDS);
  return true;
}

export async function setLiveViewport(boardId: string, viewport: { x: number; y: number; zoom: number }) {
  await getRedis().set(viewportKey(boardId), JSON.stringify(viewport));
}

export async function upsertLiveItem(
  boardId: string,
  element: any,
  action: 'add' | 'update',
  userId: string,
  options: { history?: boolean } = {}
) {
  if (isInkPayload(element)) {
    const points = element.points || [];
    if (points.length && !assertPointsInHardWorld(points)) return false;
    if (element.x !== undefined && element.y !== undefined && !isInHardWorld(element.x, element.y)) {
      return false;
    }
    await getRedis().hset(drawingsKey(boardId), element.id, JSON.stringify(element));
  } else {
    const x = element.transform?.x ?? element.x;
    const y = element.transform?.y ?? element.y;
    if (!isInHardWorld(x, y)) return false;
    await getRedis().hset(objectsKey(boardId), element.id, JSON.stringify(element));
  }

  if (options.history !== false) {
    await writeHistory(boardId, {
      id: Date.now().toString(),
      action,
      element,
      userId,
      timestamp: Date.now(),
      kind: isInkPayload(element) ? 'drawing' : 'object',
    });
  }
  return true;
}

export async function getLiveItem(boardId: string, elementId: string) {
  const redis = getRedis();
  const [objectRaw, drawingRaw] = await Promise.all([
    redis.hget(objectsKey(boardId), elementId),
    redis.hget(drawingsKey(boardId), elementId),
  ]);
  const raw = objectRaw || drawingRaw;
  return raw ? JSON.parse(raw) : null;
}

export async function deleteLiveItem(boardId: string, elementId: string, userId: string) {
  const existing = await getLiveItem(boardId, elementId);
  if (!existing) return null;
  const redis = getRedis();
  await Promise.all([
    redis.hdel(objectsKey(boardId), elementId),
    redis.hdel(drawingsKey(boardId), elementId),
  ]);
  await writeHistory(boardId, {
    id: Date.now().toString(),
    action: 'delete',
    element: existing,
    userId,
    timestamp: Date.now(),
    kind: isInkPayload(existing) ? 'drawing' : 'object',
  });
  return existing;
}

export async function popHistory(boardId: string) {
  const raw = await getRedis().lpop(historyKey(boardId));
  return raw ? JSON.parse(raw) : null;
}

export async function restoreLiveItem(boardId: string, element: any) {
  if (isInkPayload(element)) {
    await getRedis().hset(drawingsKey(boardId), element.id, JSON.stringify(element));
  } else {
    await getRedis().hset(objectsKey(boardId), element.id, JSON.stringify(element));
  }
}

export async function syncLiveItems(boardId: string, elements: any[]) {
  for (const element of elements) {
    await upsertLiveItem(boardId, element, 'update', '', { history: false });
  }
}

export async function clearBoardLiveItems(boardId: string) {
  const redis = getRedis();
  await redis.del(objectsKey(boardId), drawingsKey(boardId), historyKey(boardId));
  await redis.set(readyKey(boardId), '1');
}

export async function clearBoardLiveState(boardId: string) {
  const redis = getRedis();
  await redis.del(
    objectsKey(boardId),
    drawingsKey(boardId),
    historyKey(boardId),
    usersKey(boardId),
    cursorsKey(boardId),
    viewportKey(boardId),
    readyKey(boardId)
  );
}

async function upsertInk(boardOid: mongoose.Types.ObjectId, createdBy: mongoose.Types.ObjectId, element: any) {
  const fields = {
    board_id: boardOid,
    points: element.points,
    color: element.color || '#000000',
    strokeWidth: element.strokeWidth || 2,
    client_id: String(element.id),
  };
  const mongoId = toObjectId(element.id);
  if (mongoId) {
    await InkStroke.updateOne(
      { _id: mongoId },
      { $set: fields, $setOnInsert: { created_by: createdBy } },
      { upsert: true }
    );
    return;
  }
  await InkStroke.updateOne(
    { board_id: boardOid, client_id: String(element.id) },
    { $set: fields, $setOnInsert: { created_by: createdBy } },
    { upsert: true }
  );
}

async function upsertObject(boardOid: mongoose.Types.ObjectId, createdBy: mongoose.Types.ObjectId, element: any) {
  const type = slideTypeFromLive(element.type);
  if (!type) return;
  const fields = {
    board_id: boardOid,
    type,
    transform: {
      x: element.transform?.x ?? element.x ?? 0,
      y: element.transform?.y ?? element.y ?? 0,
      width: Math.abs(element.transform?.width ?? element.width ?? 100) || 100,
      height: Math.abs(element.transform?.height ?? element.height ?? 100) || 100,
      rotation: element.transform?.rotation ?? 0,
    },
    zIndex: element.zIndex ?? 0,
    locked: element.locked ?? false,
    visible: element.visible ?? true,
    props: objectPropsFromLive(element),
    client_id: String(element.id),
  };
  const mongoId = toObjectId(element.id);
  if (mongoId) {
    await SlideObject.updateOne(
      { _id: mongoId },
      { $set: fields, $setOnInsert: { created_by: createdBy } },
      { upsert: true }
    );
    return;
  }
  await SlideObject.updateOne(
    { board_id: boardOid, client_id: String(element.id) },
    { $set: fields, $setOnInsert: { created_by: createdBy } },
    { upsert: true }
  );
}

export async function flushLiveBoardToMongo(boardId: string, userId?: string) {
  const boardOid = toObjectId(boardId);
  if (!boardOid) return;

  const board = await Board.findById(boardOid).select('owner_id').lean();
  if (!board) return;

  await hydrateBoard(boardId);
  const redis = getRedis();
  const [objectsHash, drawingsHash, viewportRaw] = await Promise.all([
    redis.hgetall(objectsKey(boardId)),
    redis.hgetall(drawingsKey(boardId)),
    redis.get(viewportKey(boardId)),
  ]);

  const objects = parseHash(objectsHash);
  const drawings = parseHash(drawingsHash);
  const createdBy = toObjectId(userId) || board.owner_id;

  const liveInkIds = new Set<string>();
  for (const element of drawings) {
    if (!element?.id || !Array.isArray(element.points) || element.points.length < 2) continue;
    liveInkIds.add(String(element.id));
    await upsertInk(boardOid, createdBy, element);
  }

  const inkDocs = await InkStroke.find({ board_id: boardOid }).select('_id client_id').lean();
  const inkToDelete = inkDocs
    .filter((doc) => {
      const keys = [doc._id.toString(), doc.client_id].filter(Boolean) as string[];
      return !keys.some((key) => liveInkIds.has(key));
    })
    .map((doc) => doc._id);
  if (inkToDelete.length) {
    await InkStroke.deleteMany({ _id: { $in: inkToDelete } });
  }

  const liveObjectIds = new Set<string>();
  for (const element of objects) {
    if (!element?.id || !slideTypeFromLive(element.type)) continue;
    liveObjectIds.add(String(element.id));
    await upsertObject(boardOid, createdBy, element);
  }

  const objectDocs = await SlideObject.find({ board_id: boardOid }).select('_id client_id').lean();
  const objectsToDelete = objectDocs
    .filter((doc) => {
      const keys = [doc._id.toString(), doc.client_id].filter(Boolean) as string[];
      return !keys.some((key) => liveObjectIds.has(key));
    })
    .map((doc) => doc._id);
  if (objectsToDelete.length) {
    await SlideObject.deleteMany({ _id: { $in: objectsToDelete } });
  }

  if (viewportRaw) {
    try {
      const viewport = JSON.parse(viewportRaw);
      await Board.updateOne({ _id: boardOid }, { $set: { viewport } });
    } catch {
      // ignore bad viewport JSON
    }
  }
}

export function scheduleBoardFlush(boardId: string, userId?: string) {
  const previous = flushTimers.get(boardId);
  if (previous) clearTimeout(previous);
  flushTimers.set(
    boardId,
    setTimeout(() => {
      flushTimers.delete(boardId);
      flushLiveBoardToMongo(boardId, userId).catch((error) => {
        console.error(`Failed to flush board ${boardId}`, error);
      });
    }, FLUSH_MS)
  );
}

export async function flushBoardNow(boardId: string, userId?: string) {
  const previous = flushTimers.get(boardId);
  if (previous) clearTimeout(previous);
  flushTimers.delete(boardId);
  await flushLiveBoardToMongo(boardId, userId);
}
