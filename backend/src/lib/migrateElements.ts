import mongoose from 'mongoose';
import { BoardElement } from '../models/BoardElement.js';
import { SlideObject } from '../models/SlideObject.js';
import { InkStroke } from '../models/InkStroke.js';

function isDrawingType(type: string): boolean {
  return type === 'drawing';
}

export async function migrateLegacyElements(boardId?: string): Promise<void> {
  const filter = boardId && mongoose.Types.ObjectId.isValid(boardId)
    ? { board_id: new mongoose.Types.ObjectId(boardId) }
    : {};

  const legacy = await BoardElement.find(filter).lean();
  if (legacy.length === 0) return;

  const objectOps = [];
  const strokeOps = [];

  for (const el of legacy) {
    const id = el._id;
    if (isDrawingType(el.type)) {
      strokeOps.push({
        updateOne: {
          filter: { _id: id },
          update: {
            $setOnInsert: {
              _id: id,
              board_id: el.board_id,
              points: el.data?.points || [],
              color: el.data?.color || '#000000',
              strokeWidth: el.data?.strokeWidth || 2,
              created_by: el.created_by,
              createdAt: el.createdAt,
              updatedAt: el.updatedAt,
            },
          },
          upsert: true,
        },
      });
    } else {
      const type = el.type === 'drawing' ? 'shape' : el.type;
      objectOps.push({
        updateOne: {
          filter: { _id: id },
          update: {
            $setOnInsert: {
              _id: id,
              board_id: el.board_id,
              type,
              transform: {
                x: el.position?.x ?? 0,
                y: el.position?.y ?? 0,
                width: el.size?.width ?? 100,
                height: el.size?.height ?? 100,
                rotation: 0,
              },
              zIndex: 0,
              locked: false,
              visible: true,
              props: el.data || {},
              created_by: el.created_by,
              createdAt: el.createdAt,
              updatedAt: el.updatedAt,
            },
          },
          upsert: true,
        },
      });
    }
  }

  if (objectOps.length) await SlideObject.bulkWrite(objectOps);
  if (strokeOps.length) await InkStroke.bulkWrite(strokeOps);
  await BoardElement.deleteMany(filter);
  console.log(`Migrated ${legacy.length} legacy board elements`);
}
