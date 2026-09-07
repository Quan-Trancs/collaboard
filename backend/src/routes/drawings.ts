import express, { Response } from 'express';
import mongoose from 'mongoose';
import { InkStroke } from '../models/InkStroke.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getBoardAccess } from '../lib/boardAccess.js';
import { serializeInkStroke } from '../lib/serializers.js';
import { assertPointsInHardWorld } from '../lib/canvasBounds.js';
import { upsertLiveItem, deleteLiveItem } from '../lib/boardState.js';

const router = express.Router();
router.use(authenticate);

router.get('/board/:boardId', asyncHandler(async (req: AuthRequest, res: Response) => {
  const access = await getBoardAccess(req.params.boardId!, req.userId!);
  if (access.error) {
    res.status(access.error.status).json(access.error.body);
    return;
  }

  const strokes = await InkStroke.find({ board_id: access.boardObjectId })
    .sort({ createdAt: 1 })
    .limit(5000)
    .lean();

  res.json(strokes.map(serializeInkStroke));
}));

router.post('/', validate(schemas.createInkStroke), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { board_id, points, color, strokeWidth } = req.body;
  const access = await getBoardAccess(board_id, req.userId!);
  if (access.error) {
    res.status(access.error.status).json(access.error.body);
    return;
  }
  if (!access.canEdit) {
    res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    return;
  }
  if (!assertPointsInHardWorld(points)) {
    res.status(400).json({ error: 'Stroke is outside the board world', code: 'OUT_OF_BOUNDS' });
    return;
  }

  const stroke = await InkStroke.create({
    board_id: access.boardObjectId,
    points,
    color,
    strokeWidth,
    created_by: access.userObjectId,
  });

  const serialized = serializeInkStroke(stroke);
  await upsertLiveItem(board_id, { ...serialized, type: 'drawing' }, 'add', req.userId!);
  res.status(201).json(serialized);
}));

router.post('/batch-save', validate(schemas.batchSaveDrawings), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { boardId, strokes } = req.body;
  const access = await getBoardAccess(boardId, req.userId!);
  if (access.error) {
    res.status(access.error.status).json(access.error.body);
    return;
  }
  if (!access.canEdit) {
    res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    return;
  }

  if (strokes.some((stroke: any) => !assertPointsInHardWorld(stroke.points))) {
    res.status(400).json({ error: 'Stroke is outside the board world', code: 'OUT_OF_BOUNDS' });
    return;
  }

  const operations = strokes.map((stroke: any) => {
    const strokeId = stroke.id && mongoose.Types.ObjectId.isValid(stroke.id)
      ? new mongoose.Types.ObjectId(stroke.id)
      : new mongoose.Types.ObjectId();

    return {
      updateOne: {
        filter: { _id: strokeId },
        update: {
          $set: {
            board_id: access.boardObjectId,
            points: stroke.points,
            color: stroke.color,
            strokeWidth: stroke.strokeWidth,
            created_by: access.userObjectId,
          },
        },
        upsert: true,
      },
    };
  });

  await InkStroke.bulkWrite(operations);
  res.json({ success: true, saved: strokes.length });
}));

router.put('/:id', validate(schemas.updateInkStroke), asyncHandler(async (req: AuthRequest, res: Response) => {
  const stroke = await InkStroke.findById(req.params.id);
  if (!stroke) {
    res.status(404).json({ error: 'Stroke not found', code: 'STROKE_NOT_FOUND' });
    return;
  }

  const access = await getBoardAccess(stroke.board_id.toString(), req.userId!);
  if (access.error) {
    res.status(access.error.status).json(access.error.body);
    return;
  }
  if (!access.canEdit) {
    res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    return;
  }

  if (req.body.points) {
    if (!assertPointsInHardWorld(req.body.points)) {
      res.status(400).json({ error: 'Stroke is outside the board world', code: 'OUT_OF_BOUNDS' });
      return;
    }
    stroke.points = req.body.points;
  }
  if (req.body.color) stroke.color = req.body.color;
  if (req.body.strokeWidth) stroke.strokeWidth = req.body.strokeWidth;

  await stroke.save();
  const serialized = serializeInkStroke(stroke);
  await upsertLiveItem(stroke.board_id.toString(), { ...serialized, type: 'drawing' }, 'update', req.userId!);
  res.json(serialized);
}));

router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const stroke = await InkStroke.findById(req.params.id);
  if (!stroke) {
    res.status(404).json({ error: 'Stroke not found', code: 'STROKE_NOT_FOUND' });
    return;
  }

  const boardId = stroke.board_id.toString();
  const access = await getBoardAccess(boardId, req.userId!);
  if (access.error) {
    res.status(access.error.status).json(access.error.body);
    return;
  }
  if (!access.canEdit) {
    res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    return;
  }

  await InkStroke.findByIdAndDelete(stroke._id);
  await deleteLiveItem(boardId, stroke._id.toString(), req.userId!);
  res.json({ message: 'Stroke deleted successfully' });
}));

export default router;
