import express, { Response } from 'express';
import { BoardElement } from '../models/BoardElement.js';
import { Board } from '../models/Board.js';
import { BoardCollaborator } from '../models/BoardCollaborator.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get elements for a board
router.get('/board/:boardId', asyncHandler(async (req: AuthRequest, res: Response) => {
  const boardId = req.params.boardId;
  const userId = req.userId!;

  // Check if user has access
  const board = await Board.findById(boardId).lean();
  if (!board) {
    res.status(404).json({ error: 'Board not found', code: 'BOARD_NOT_FOUND' });
    return;
  }

  const isOwner = board.owner_id.toString() === userId;
  const collaboration = await BoardCollaborator.findOne({
    board_id: boardId,
    user_id: userId,
  }).lean();

  if (!isOwner && !collaboration && !board.is_public) {
    res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    return;
  }

  const elements = await BoardElement.find({ board_id: boardId })
    .sort({ createdAt: 1 })
    .lean()
    .limit(1000);

  res.json(
    elements.map(el => ({
      id: el._id.toString(),
      board_id: el.board_id.toString(),
      type: el.type,
      data: el.data,
      position: el.position,
      size: el.size,
      created_by: el.created_by.toString(),
      created_at: el.createdAt.toISOString(),
      updated_at: el.updatedAt.toISOString(),
    }))
  );
}));

// Create element
router.post('/', validate(schemas.createElement), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { board_id, type, data, position, size } = req.body;
  const userId = req.userId!;

  // Check if user has edit access
  const board = await Board.findById(board_id);
  if (!board) {
    res.status(404).json({ error: 'Board not found', code: 'BOARD_NOT_FOUND' });
    return;
  }

  const isOwner = board.owner_id.toString() === userId;
  const collaboration = await BoardCollaborator.findOne({
    board_id,
    user_id: userId,
    permission: { $in: ['edit', 'admin'] },
  });

  if (!isOwner && !collaboration) {
    res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    return;
  }

  const element = await BoardElement.create({
    board_id,
    type,
    data,
    position,
    size,
    created_by: userId,
  });

  res.status(201).json({
    id: element._id.toString(),
    board_id: element.board_id.toString(),
    type: element.type,
    data: element.data,
    position: element.position,
    size: element.size,
    created_by: element.created_by.toString(),
    created_at: element.createdAt.toISOString(),
    updated_at: element.updatedAt.toISOString(),
  });
}));

// Batch save elements
router.post('/batch-save', validate(schemas.batchSaveElements), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { boardId, elements } = req.body;
  const userId = req.userId!;

  // Check if user has edit access
  const board = await Board.findById(boardId);
  if (!board) {
    res.status(404).json({ error: 'Board not found', code: 'BOARD_NOT_FOUND' });
    return;
  }

  const isOwner = board.owner_id.toString() === userId;
  const collaboration = await BoardCollaborator.findOne({
    board_id: boardId,
    user_id: userId,
    permission: { $in: ['edit', 'admin'] },
  });

  if (!isOwner && !collaboration) {
    res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    return;
  }

    // Batch upsert elements
    const operations = elements.map((el: any) => {
      const updateDoc: any = {
        board_id: boardId,
        type: el.type,
        data: el.data,
        position: el.position,
        created_by: userId,
      };
      
      if (el.size) {
        updateDoc.size = el.size;
      }

      return {
        updateOne: {
          filter: { _id: el.id },
          update: { $set: updateDoc },
          upsert: true,
        },
      };
    });

  await BoardElement.bulkWrite(operations);

  res.json({ success: true, saved: elements.length });
}));

// Update element
router.put('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const elementId = req.params.id;
  const userId = req.userId!;
  const { data, position, size } = req.body;

  const element = await BoardElement.findById(elementId);
  if (!element) {
    res.status(404).json({ error: 'Element not found', code: 'ELEMENT_NOT_FOUND' });
    return;
  }

  // Check if user has edit access
  const board = await Board.findById(element.board_id);
  if (!board) {
    res.status(404).json({ error: 'Board not found', code: 'BOARD_NOT_FOUND' });
    return;
  }

  const isOwner = board.owner_id.toString() === userId;
  const collaboration = await BoardCollaborator.findOne({
    board_id: element.board_id.toString(),
    user_id: userId,
    permission: { $in: ['edit', 'admin'] },
  });

  if (!isOwner && !collaboration) {
    res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (data !== undefined) updates.data = data;
  if (position !== undefined) updates.position = position;
  if (size !== undefined) updates.size = size;

  const updatedElement = await BoardElement.findByIdAndUpdate(elementId, updates, {
    new: true,
    runValidators: true,
  });

  res.json({
    id: updatedElement!._id.toString(),
    board_id: updatedElement!.board_id.toString(),
    type: updatedElement!.type,
    data: updatedElement!.data,
    position: updatedElement!.position,
    size: updatedElement!.size,
    created_by: updatedElement!.created_by.toString(),
    created_at: updatedElement!.createdAt.toISOString(),
    updated_at: updatedElement!.updatedAt.toISOString(),
  });
}));

// Delete element
router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const elementId = req.params.id;
  const userId = req.userId!;

  const element = await BoardElement.findById(elementId);
  if (!element) {
    res.status(404).json({ error: 'Element not found', code: 'ELEMENT_NOT_FOUND' });
    return;
  }

  // Check if user has edit access
  const board = await Board.findById(element.board_id);
  if (!board) {
    res.status(404).json({ error: 'Board not found', code: 'BOARD_NOT_FOUND' });
    return;
  }

  const isOwner = board.owner_id.toString() === userId;
  const collaboration = await BoardCollaborator.findOne({
    board_id: element.board_id.toString(),
    user_id: userId,
    permission: { $in: ['edit', 'admin'] },
  });

  if (!isOwner && !collaboration) {
    res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    return;
  }

  await BoardElement.findByIdAndDelete(elementId);

  res.json({ message: 'Element deleted successfully' });
}));

export default router;

