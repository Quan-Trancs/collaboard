import express, { Response } from 'express';
import { SlideObject } from '../models/SlideObject.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getBoardAccess } from '../lib/boardAccess.js';
import { serializeSlideObject } from '../lib/serializers.js';
import { isInHardWorld } from '../lib/canvasBounds.js';
import { upsertLiveItem, deleteLiveItem } from '../lib/boardState.js';

const router = express.Router();
router.use(authenticate);

router.get('/board/:boardId', asyncHandler(async (req: AuthRequest, res: Response) => {
  const access = await getBoardAccess(req.params.boardId!, req.userId!);
  if (access.error) {
    res.status(access.error.status).json(access.error.body);
    return;
  }

  const objects = await SlideObject.find({ board_id: access.boardObjectId })
    .sort({ zIndex: 1, createdAt: 1 })
    .limit(2000)
    .lean();

  res.json(objects.map(serializeSlideObject));
}));

router.post('/', validate(schemas.createSlideObject), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { board_id, type, transform, zIndex, locked, visible, props } = req.body;
  const access = await getBoardAccess(board_id, req.userId!);
  if (access.error) {
    res.status(access.error.status).json(access.error.body);
    return;
  }
  if (!access.canEdit) {
    res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    return;
  }
  if (!isInHardWorld(transform.x, transform.y)) {
    res.status(400).json({ error: 'Object is outside the board world', code: 'OUT_OF_BOUNDS' });
    return;
  }

  const object = await SlideObject.create({
    board_id: access.boardObjectId,
    type,
    transform: { rotation: 0, ...transform },
    zIndex: zIndex ?? 0,
    locked: locked ?? false,
    visible: visible ?? true,
    props: props || {},
    created_by: access.userObjectId,
  });

  const serialized = serializeSlideObject(object);
  await upsertLiveItem(board_id, serialized, 'add', req.userId!);
  res.status(201).json(serialized);
}));

router.put('/:id', validate(schemas.updateSlideObject), asyncHandler(async (req: AuthRequest, res: Response) => {
  const object = await SlideObject.findById(req.params.id);
  if (!object) {
    res.status(404).json({ error: 'Object not found', code: 'OBJECT_NOT_FOUND' });
    return;
  }

  const access = await getBoardAccess(object.board_id.toString(), req.userId!);
  if (access.error) {
    res.status(access.error.status).json(access.error.body);
    return;
  }
  if (!access.canEdit) {
    res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    return;
  }

  if (req.body.transform) {
    const next = { ...object.transform, ...req.body.transform };
    if (!isInHardWorld(next.x, next.y)) {
      res.status(400).json({ error: 'Object is outside the board world', code: 'OUT_OF_BOUNDS' });
      return;
    }
    object.transform = next;
  }
  if (req.body.zIndex !== undefined) object.zIndex = req.body.zIndex;
  if (req.body.locked !== undefined) object.locked = req.body.locked;
  if (req.body.visible !== undefined) object.visible = req.body.visible;
  if (req.body.props !== undefined) object.props = req.body.props;

  await object.save();
  const serialized = serializeSlideObject(object);
  await upsertLiveItem(object.board_id.toString(), serialized, 'update', req.userId!);
  res.json(serialized);
}));

router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const object = await SlideObject.findById(req.params.id);
  if (!object) {
    res.status(404).json({ error: 'Object not found', code: 'OBJECT_NOT_FOUND' });
    return;
  }

  const boardId = object.board_id.toString();
  const access = await getBoardAccess(boardId, req.userId!);
  if (access.error) {
    res.status(access.error.status).json(access.error.body);
    return;
  }
  if (!access.canEdit) {
    res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    return;
  }

  await SlideObject.findByIdAndDelete(object._id);
  await deleteLiveItem(boardId, object._id.toString(), req.userId!);
  res.json({ message: 'Object deleted successfully' });
}));

export default router;
