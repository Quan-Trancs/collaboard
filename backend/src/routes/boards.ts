import express, { Response } from 'express';
import mongoose from 'mongoose';
import { Board } from '../models/Board.js';
import { BoardElement } from '../models/BoardElement.js';
import { BoardCollaborator } from '../models/BoardCollaborator.js';
import { User } from '../models/User.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all boards for current user
router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  // Optimize: Use aggregation pipeline for better performance
  const collaborations = await BoardCollaborator.find({ user_id: userId }).select('board_id');
  const boardIds = collaborations.map(c => c.board_id);

  // Single query with $or for better performance
  const boards = await Board.find({
    $or: [
      { owner_id: userId },
      { _id: { $in: boardIds } },
    ],
  })
    .sort({ updatedAt: -1 })
    .limit(100) // Limit to prevent huge responses
    .lean(); // Use lean() for better performance

  // Deduplicate (in case user is both owner and collaborator)
  const uniqueBoards = Array.from(
    new Map(boards.map(board => [board._id.toString(), board])).values()
  );

  res.json(
    uniqueBoards.map(board => ({
      id: board._id.toString(),
      title: board.title,
      description: board.description,
      owner_id: board.owner_id.toString(),
      thumbnail_url: board.thumbnail_url,
      is_public: board.is_public,
      created_at: board.createdAt.toISOString(),
      updated_at: board.updatedAt.toISOString(),
    }))
  );
}));

// Get single board with elements
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const boardId = req.params.id;
    const userId = req.userId!;

    if (!boardId || !mongoose.Types.ObjectId.isValid(boardId)) {
      res.status(400).json({ error: 'Invalid board ID' });
      return;
    }

    const boardObjectId = new mongoose.Types.ObjectId(boardId);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Check if user has access
    const board = await Board.findById(boardObjectId);
    if (!board) {
      res.status(404).json({ error: 'Board not found' });
      return;
    }

    const isOwner = board.owner_id.toString() === userId;
    const collaboration = await BoardCollaborator.findOne({
      board_id: boardObjectId,
      user_id: userObjectId,
    });

    if (!isOwner && !collaboration && !board.is_public) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Get elements
    const elements = await BoardElement.find({ board_id: boardObjectId }).sort({ createdAt: 1 });

    res.json({
      id: board._id.toString(),
      title: board.title,
      description: board.description,
      owner_id: board.owner_id.toString(),
      thumbnail_url: board.thumbnail_url,
      is_public: board.is_public,
      created_at: board.createdAt.toISOString(),
      updated_at: board.updatedAt.toISOString(),
      elements: elements.map(el => ({
        id: el._id.toString(),
        board_id: el.board_id.toString(),
        type: el.type,
        data: el.data,
        position: el.position,
        size: el.size,
        created_by: el.created_by.toString(),
        created_at: el.createdAt.toISOString(),
        updated_at: el.updatedAt.toISOString(),
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch board' });
  }
});

// Create board
router.post('/', validate(schemas.createBoard), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { title, description, is_public } = req.body;
  const userId = req.userId!;

  const board = await Board.create({
    title,
    description: description || '',
    owner_id: userId,
    is_public: is_public || false,
  });

  res.status(201).json({
    id: board._id.toString(),
    title: board.title,
    description: board.description,
    owner_id: board.owner_id.toString(),
    thumbnail_url: board.thumbnail_url,
    is_public: board.is_public,
    created_at: board.createdAt.toISOString(),
    updated_at: board.updatedAt.toISOString(),
  });
}));

// Update board
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const boardId = req.params.id;
    const userId = req.userId!;
    const { title, description, is_public } = req.body;

    if (!boardId || !mongoose.Types.ObjectId.isValid(boardId)) {
      res.status(400).json({ error: 'Invalid board ID' });
      return;
    }

    const boardObjectId = new mongoose.Types.ObjectId(boardId);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const board = await Board.findById(boardObjectId);
    if (!board) {
      res.status(404).json({ error: 'Board not found' });
      return;
    }

    // Check if user is owner or admin collaborator
    const isOwner = board.owner_id.toString() === userId;
    const collaboration = await BoardCollaborator.findOne({
      board_id: boardObjectId,
      user_id: userObjectId,
      permission: 'admin',
    });

    if (!isOwner && !collaboration) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const updates: any = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (is_public !== undefined) updates.is_public = is_public;

    const updatedBoard = await Board.findByIdAndUpdate(boardObjectId, updates, {
      new: true,
      runValidators: true,
    });

    res.json({
      id: updatedBoard!._id.toString(),
      title: updatedBoard!.title,
      description: updatedBoard!.description,
      owner_id: updatedBoard!.owner_id.toString(),
      thumbnail_url: updatedBoard!.thumbnail_url,
      is_public: updatedBoard!.is_public,
      created_at: updatedBoard!.createdAt.toISOString(),
      updated_at: updatedBoard!.updatedAt.toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update board' });
  }
});

// Delete board
router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const boardId = req.params.id;
  const userId = req.userId!;

  if (!boardId || !mongoose.Types.ObjectId.isValid(boardId)) {
    res.status(400).json({ error: 'Invalid board ID', code: 'INVALID_BOARD_ID' });
    return;
  }

  const boardObjectId = new mongoose.Types.ObjectId(boardId);

  const board = await Board.findById(boardObjectId);
  if (!board) {
    res.status(404).json({ error: 'Board not found', code: 'BOARD_NOT_FOUND' });
    return;
  }

  // Only owner can delete
  if (board.owner_id.toString() !== userId) {
    res.status(403).json({ error: 'Only owner can delete board', code: 'ACCESS_DENIED' });
    return;
  }

  // Delete board, elements, and collaborators in parallel
  await Promise.all([
    Board.findByIdAndDelete(boardObjectId),
    BoardElement.deleteMany({ board_id: boardObjectId }),
    BoardCollaborator.deleteMany({ board_id: boardObjectId }),
  ]);

  res.json({ message: 'Board deleted successfully' });
}));

// Add collaborator
router.post('/:id/collaborators', validate(schemas.addCollaborator), asyncHandler(async (req: AuthRequest, res: Response) => {
  const boardId = req.params.id;
  const userId = req.userId!;
  const { email, permission = 'view' } = req.body;

  if (!boardId || !mongoose.Types.ObjectId.isValid(boardId)) {
    res.status(400).json({ error: 'Invalid board ID', code: 'INVALID_BOARD_ID' });
    return;
  }

  const boardObjectId = new mongoose.Types.ObjectId(boardId);
  const userObjectId = new mongoose.Types.ObjectId(userId);

  // Check if user has permission to add collaborators
  const board = await Board.findById(boardObjectId);
  if (!board) {
    res.status(404).json({ error: 'Board not found', code: 'BOARD_NOT_FOUND' });
    return;
  }

  const isOwner = board.owner_id.toString() === userId;
  const collaboration = await BoardCollaborator.findOne({
    board_id: boardObjectId,
    user_id: userObjectId,
    permission: 'admin',
  });

  if (!isOwner && !collaboration) {
    res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    return;
  }

  // Find user by email
  const collaboratorUser = await User.findOne({ email });
  if (!collaboratorUser) {
    res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
    return;
  }

  // Add collaborator
  await BoardCollaborator.findOneAndUpdate(
    { board_id: boardObjectId, user_id: collaboratorUser._id },
    { permission },
    { upsert: true, new: true }
  );

  res.json({ message: 'Collaborator added successfully' });
}));

// Remove collaborator
router.delete('/:id/collaborators/:userId', asyncHandler(async (req: AuthRequest, res: Response) => {
  const boardId = req.params.id;
  const userId = req.userId!;
  const collaboratorUserId = req.params.userId;

  if (!boardId || !mongoose.Types.ObjectId.isValid(boardId)) {
    res.status(400).json({ error: 'Invalid board ID', code: 'INVALID_BOARD_ID' });
    return;
  }

  if (!collaboratorUserId || !mongoose.Types.ObjectId.isValid(collaboratorUserId)) {
    res.status(400).json({ error: 'Invalid user ID', code: 'INVALID_USER_ID' });
    return;
  }

  const boardObjectId = new mongoose.Types.ObjectId(boardId);
  const collaboratorUserObjectId = new mongoose.Types.ObjectId(collaboratorUserId);

  // Check if user has permission
  const board = await Board.findById(boardObjectId);
  if (!board) {
    res.status(404).json({ error: 'Board not found', code: 'BOARD_NOT_FOUND' });
    return;
  }

  const isOwner = board.owner_id.toString() === userId;
  if (!isOwner) {
    res.status(403).json({ error: 'Only owner can remove collaborators', code: 'ACCESS_DENIED' });
    return;
  }

  await BoardCollaborator.findOneAndDelete({
    board_id: boardObjectId,
    user_id: collaboratorUserObjectId,
  });

  res.json({ message: 'Collaborator removed successfully' });
}));

export default router;

