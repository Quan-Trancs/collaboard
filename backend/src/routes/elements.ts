/**
 * Compatibility adapter for the previous mixed /api/elements API.
 * New clients should use /api/objects and /api/drawings.
 */
import express, { Response } from 'express';
import mongoose from 'mongoose';
import { SlideObject } from '../models/SlideObject.js';
import { InkStroke } from '../models/InkStroke.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getBoardAccess } from '../lib/boardAccess.js';
import { serializeInkStroke, serializeSlideObject } from '../lib/serializers.js';
import { isInHardWorld, assertPointsInHardWorld } from '../lib/canvasBounds.js';
import { upsertLiveItem, deleteLiveItem } from '../lib/boardState.js';

const router = express.Router();
router.use(authenticate);

function objectToLegacy(object: ReturnType<typeof serializeSlideObject>) {
  return {
    id: object.id,
    board_id: object.board_id,
    type: object.type,
    data: object.props,
    position: { x: object.transform.x, y: object.transform.y },
    size: { width: object.transform.width, height: object.transform.height },
    created_by: object.created_by,
    created_at: object.created_at,
    updated_at: object.updated_at,
  };
}

function strokeToLegacy(stroke: ReturnType<typeof serializeInkStroke>) {
  const first = stroke.points[0] || { x: 0, y: 0 };
  return {
    id: stroke.id,
    board_id: stroke.board_id,
    type: 'drawing',
    data: {
      points: stroke.points,
      color: stroke.color,
      strokeWidth: stroke.strokeWidth,
    },
    position: first,
    size: null,
    created_by: stroke.created_by,
    created_at: stroke.created_at,
    updated_at: stroke.updated_at,
  };
}

router.get('/board/:boardId', asyncHandler(async (req: AuthRequest, res: Response) => {
  const access = await getBoardAccess(req.params.boardId!, req.userId!);
  if (access.error) {
    res.status(access.error.status).json(access.error.body);
    return;
  }

  const [objects, strokes] = await Promise.all([
    SlideObject.find({ board_id: access.boardObjectId }).sort({ createdAt: 1 }).lean(),
    InkStroke.find({ board_id: access.boardObjectId }).sort({ createdAt: 1 }).lean(),
  ]);

  res.json([
    ...objects.map((doc) => objectToLegacy(serializeSlideObject(doc))),
    ...strokes.map((doc) => strokeToLegacy(serializeInkStroke(doc))),
  ]);
}));

router.post('/', validate(schemas.createElement), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { board_id, type, data, position, size } = req.body;
  const access = await getBoardAccess(board_id, req.userId!);
  if (access.error) {
    res.status(access.error.status).json(access.error.body);
    return;
  }
  if (!access.canEdit) {
    res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    return;
  }

  if (type === 'drawing') {
    const points = data.points || [position];
    if (!assertPointsInHardWorld(points)) {
      res.status(400).json({ error: 'Stroke is outside the board world', code: 'OUT_OF_BOUNDS' });
      return;
    }
    const stroke = await InkStroke.create({
      board_id: access.boardObjectId,
      points,
      color: data.color || '#000000',
      strokeWidth: data.strokeWidth || 2,
      created_by: access.userObjectId,
    });
    const serialized = serializeInkStroke(stroke);
    await upsertLiveItem(board_id, { ...serialized, type: 'drawing' }, 'add', req.userId!);
    res.status(201).json(strokeToLegacy(serialized));
    return;
  }

  if (!isInHardWorld(position.x, position.y)) {
    res.status(400).json({ error: 'Object is outside the board world', code: 'OUT_OF_BOUNDS' });
    return;
  }

  const object = await SlideObject.create({
    board_id: access.boardObjectId,
    type,
    transform: {
      x: position.x,
      y: position.y,
      width: size?.width ?? 100,
      height: size?.height ?? 100,
      rotation: 0,
    },
    props: data || {},
    created_by: access.userObjectId,
  });
  const serialized = serializeSlideObject(object);
  await upsertLiveItem(board_id, serialized, 'add', req.userId!);
  res.status(201).json(objectToLegacy(serialized));
}));

router.post('/batch-save', validate(schemas.batchSaveElements), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { boardId, elements } = req.body;
  const access = await getBoardAccess(boardId, req.userId!);
  if (access.error) {
    res.status(access.error.status).json(access.error.body);
    return;
  }
  if (!access.canEdit) {
    res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    return;
  }

  const objectOps = [];
  const strokeOps = [];

  for (const el of elements) {
    const id = el.id && mongoose.Types.ObjectId.isValid(el.id)
      ? new mongoose.Types.ObjectId(el.id)
      : new mongoose.Types.ObjectId();

    if (el.type === 'drawing') {
      const points = el.data?.points || [el.position];
      if (!assertPointsInHardWorld(points)) {
        res.status(400).json({ error: 'Stroke is outside the board world', code: 'OUT_OF_BOUNDS' });
        return;
      }
      strokeOps.push({
        updateOne: {
          filter: { _id: id },
          update: {
            $set: {
              board_id: access.boardObjectId,
              points,
              color: el.data?.color || '#000000',
              strokeWidth: el.data?.strokeWidth || 2,
              created_by: access.userObjectId,
            },
          },
          upsert: true,
        },
      });
    } else {
      if (!isInHardWorld(el.position.x, el.position.y)) {
        res.status(400).json({ error: 'Object is outside the board world', code: 'OUT_OF_BOUNDS' });
        return;
      }
      objectOps.push({
        updateOne: {
          filter: { _id: id },
          update: {
            $set: {
              board_id: access.boardObjectId,
              type: el.type,
              transform: {
                x: el.position.x,
                y: el.position.y,
                width: el.size?.width ?? 100,
                height: el.size?.height ?? 100,
                rotation: 0,
              },
              props: el.data || {},
              created_by: access.userObjectId,
            },
          },
          upsert: true,
        },
      });
    }
  }

  await Promise.all([
    objectOps.length ? SlideObject.bulkWrite(objectOps) : Promise.resolve(),
    strokeOps.length ? InkStroke.bulkWrite(strokeOps) : Promise.resolve(),
  ]);

  res.json({ success: true, saved: elements.length });
}));

router.put('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { data, position, size } = req.body;
  const object = await SlideObject.findById(req.params.id);
  const stroke = object ? null : await InkStroke.findById(req.params.id);
  const doc = object || stroke;

  if (!doc) {
    res.status(404).json({ error: 'Element not found', code: 'ELEMENT_NOT_FOUND' });
    return;
  }

  const access = await getBoardAccess(doc.board_id.toString(), req.userId!);
  if (access.error) {
    res.status(access.error.status).json(access.error.body);
    return;
  }
  if (!access.canEdit) {
    res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    return;
  }

  if (stroke) {
    if (data?.points && !assertPointsInHardWorld(data.points)) {
      res.status(400).json({ error: 'Stroke is outside the board world', code: 'OUT_OF_BOUNDS' });
      return;
    }
    if (data?.points) stroke.points = data.points;
    if (data?.color) stroke.color = data.color;
    if (data?.strokeWidth) stroke.strokeWidth = data.strokeWidth;
    await stroke.save();
    const serialized = serializeInkStroke(stroke);
    await upsertLiveItem(stroke.board_id.toString(), { ...serialized, type: 'drawing' }, 'update', req.userId!);
    res.json(strokeToLegacy(serialized));
    return;
  }

  if (position && !isInHardWorld(position.x, position.y)) {
    res.status(400).json({ error: 'Object is outside the board world', code: 'OUT_OF_BOUNDS' });
    return;
  }
  if (position || size) {
    object!.transform = {
      ...object!.transform,
      x: position?.x ?? object!.transform.x,
      y: position?.y ?? object!.transform.y,
      width: size?.width ?? object!.transform.width,
      height: size?.height ?? object!.transform.height,
    };
  }
  if (data) object!.props = { ...object!.props, ...data };
  await object!.save();
  const serialized = serializeSlideObject(object!);
  await upsertLiveItem(object!.board_id.toString(), serialized, 'update', req.userId!);
  res.json(objectToLegacy(serialized));
}));

router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const object = await SlideObject.findById(req.params.id);
  const stroke = object ? null : await InkStroke.findById(req.params.id);
  const doc = object || stroke;

  if (!doc) {
    res.status(404).json({ error: 'Element not found', code: 'ELEMENT_NOT_FOUND' });
    return;
  }

  const boardId = doc.board_id.toString();
  const access = await getBoardAccess(boardId, req.userId!);
  if (access.error) {
    res.status(access.error.status).json(access.error.body);
    return;
  }
  if (!access.canEdit) {
    res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    return;
  }

  await (object ? SlideObject.findByIdAndDelete(doc._id) : InkStroke.findByIdAndDelete(doc._id));
  await deleteLiveItem(boardId, doc._id.toString(), req.userId!);
  res.json({ message: 'Element deleted successfully' });
}));

export default router;
