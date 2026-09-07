import express, { Response } from 'express';
import mongoose from 'mongoose';
import { Board } from '../models/Board.js';
import { BoardElement } from '../models/BoardElement.js';
import { SlideObject } from '../models/SlideObject.js';
import { InkStroke } from '../models/InkStroke.js';
import { BoardCollaborator } from '../models/BoardCollaborator.js';
import { User } from '../models/User.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { serializeBoard, serializeInkStroke, serializeSlideObject } from '../lib/serializers.js';
import { migrateLegacyElements } from '../lib/migrateElements.js';
import { clearBoardLiveState } from '../lib/boardState.js';
import { listBoardPeople, serializePerson } from '../lib/boardAccess.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all boards for current user
router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  // Optimize: Use aggregation pipeline for better performance
  const collaborations = await BoardCollaborator.find({ user_id: userId }).select('board_id permission');
  const boardIds = collaborations.map(c => c.board_id);
  const permissionByBoard = new Map(
    collaborations.map((collaboration) => [collaboration.board_id.toString(), collaboration.permission])
  );

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
    uniqueBoards.map(board => {
      const ownerId = board.owner_id.toString();
      const isOwner = ownerId === userId;
      return {
        id: board._id.toString(),
        title: board.title,
        description: board.description,
        owner_id: ownerId,
        thumbnail_url: board.thumbnail_url,
        is_public: board.is_public,
        permission: isOwner ? 'owner' : permissionByBoard.get(board._id.toString()) || 'view',
        created_at: board.createdAt.toISOString(),
        updated_at: board.updatedAt.toISOString(),
      };
    })
  );
}));

// List people with access — registered before /:id so it cannot be swallowed
router.get('/:id/collaborators', asyncHandler(async (req: AuthRequest, res: Response) => {
  const boardId = req.params.id;
  const userId = req.userId!;

  if (!boardId || !mongoose.Types.ObjectId.isValid(boardId)) {
    res.status(400).json({ error: 'Invalid board ID', code: 'INVALID_BOARD_ID' });
    return;
  }

  const board = await Board.findById(boardId);
  if (!board) {
    res.status(404).json({ error: 'Board not found', code: 'BOARD_NOT_FOUND' });
    return;
  }

  const isOwner = board.owner_id.toString() === userId;
  const collaboration = await BoardCollaborator.findOne({
    board_id: board._id,
    user_id: userId,
  });
  if (!isOwner && !collaboration && !board.is_public) {
    res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    return;
  }

  const people = await listBoardPeople(board);
  res.json({
    owner: people.owner,
    collaborators: people.collaborators,
    is_public: board.is_public,
    can_manage: isOwner || collaboration?.permission === 'admin',
  });
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

    await migrateLegacyElements(boardId);
    const [objects, drawings, people] = await Promise.all([
      SlideObject.find({ board_id: boardObjectId }).sort({ zIndex: 1, createdAt: 1 }).lean(),
      InkStroke.find({ board_id: boardObjectId }).sort({ createdAt: 1 }).lean(),
      listBoardPeople(board),
    ]);
    const permission = isOwner ? 'owner' : collaboration?.permission || 'view';
    const canEdit = isOwner || permission === 'edit' || permission === 'admin';

    res.json({
      ...serializeBoard(board),
      permission,
      can_edit: canEdit,
      owner: people.owner,
      collaborators: people.collaborators,
      objects: objects.map(serializeSlideObject),
      drawings: drawings.map(serializeInkStroke),
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

  res.status(201).json(serializeBoard(board));
}));

// Update board
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const boardId = req.params.id;
    const userId = req.userId!;
    const { title, description, is_public, background, viewport } = req.body;

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
    if (background !== undefined) updates.background = background;
    if (viewport !== undefined) updates.viewport = viewport;

    const updatedBoard = await Board.findByIdAndUpdate(boardObjectId, updates, {
      new: true,
      runValidators: true,
    });

    res.json(serializeBoard(updatedBoard!));
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
    SlideObject.deleteMany({ board_id: boardObjectId }),
    InkStroke.deleteMany({ board_id: boardObjectId }),
    BoardCollaborator.deleteMany({ board_id: boardObjectId }),
    clearBoardLiveState(boardId),
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

  const board = await Board.findById(boardObjectId);
  if (!board) {
    res.status(404).json({ error: 'Board not found', code: 'BOARD_NOT_FOUND' });
    return;
  }

  const isOwner = board.owner_id.toString() === userId;
  const manager = await BoardCollaborator.findOne({
    board_id: boardObjectId,
    user_id: userObjectId,
    permission: 'admin',
  });

  if (!isOwner && !manager) {
    res.status(403).json({ error: 'Only the owner or an admin can invite people', code: 'ACCESS_DENIED' });
    return;
  }

  const collaboratorUser = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (!collaboratorUser) {
    res.status(404).json({ error: 'No Collaboard account uses that email. They need to sign up first.', code: 'USER_NOT_FOUND' });
    return;
  }

  if (collaboratorUser._id.toString() === userId) {
    res.status(400).json({ error: 'You already have access to this board', code: 'CANNOT_INVITE_SELF' });
    return;
  }

  if (collaboratorUser._id.toString() === board.owner_id.toString()) {
    res.status(400).json({ error: 'The owner already has access', code: 'CANNOT_INVITE_OWNER' });
    return;
  }

  await BoardCollaborator.findOneAndUpdate(
    { board_id: boardObjectId, user_id: collaboratorUser._id },
    { permission },
    { upsert: true, new: true }
  );

  res.status(201).json(serializePerson(collaboratorUser, permission));
}));

router.patch('/:id/collaborators/:userId', validate(schemas.updateCollaborator), asyncHandler(async (req: AuthRequest, res: Response) => {
  const boardId = req.params.id;
  const userId = req.userId!;
  const collaboratorUserId = req.params.userId;
  const { permission } = req.body;

  if (!boardId || !mongoose.Types.ObjectId.isValid(boardId) || !collaboratorUserId || !mongoose.Types.ObjectId.isValid(collaboratorUserId)) {
    res.status(400).json({ error: 'Invalid board or user ID', code: 'INVALID_ID' });
    return;
  }

  const board = await Board.findById(boardId);
  if (!board) {
    res.status(404).json({ error: 'Board not found', code: 'BOARD_NOT_FOUND' });
    return;
  }

  const isOwner = board.owner_id.toString() === userId;
  const manager = await BoardCollaborator.findOne({
    board_id: board._id,
    user_id: userId,
    permission: 'admin',
  });
  if (!isOwner && !manager) {
    res.status(403).json({ error: 'Only the owner or an admin can change permissions', code: 'ACCESS_DENIED' });
    return;
  }

  if (collaboratorUserId === board.owner_id.toString()) {
    res.status(400).json({ error: 'Cannot change the owner permission', code: 'CANNOT_CHANGE_OWNER' });
    return;
  }

  const collaboratorUser = await User.findById(collaboratorUserId);
  if (!collaboratorUser) {
    res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
    return;
  }

  await BoardCollaborator.findOneAndUpdate(
    { board_id: board._id, user_id: collaboratorUser._id },
    { permission },
    { upsert: true, new: true }
  );

  res.json(serializePerson(collaboratorUser, permission));
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
  const isSelf = collaboratorUserId === userId;
  const manager = await BoardCollaborator.findOne({
    board_id: boardObjectId,
    user_id: userId,
    permission: 'admin',
  });
  if (!isOwner && !manager && !isSelf) {
    res.status(403).json({ error: 'Only the owner or an admin can remove people', code: 'ACCESS_DENIED' });
    return;
  }

  if (collaboratorUserId === board.owner_id.toString()) {
    res.status(400).json({ error: 'Cannot remove the owner', code: 'CANNOT_REMOVE_OWNER' });
    return;
  }

  await BoardCollaborator.findOneAndDelete({
    board_id: boardObjectId,
    user_id: collaboratorUserObjectId,
  });

  res.json({ message: 'Collaborator removed successfully' });
}));

export default router;

