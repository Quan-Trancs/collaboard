import mongoose from 'mongoose';
import { Board } from '../models/Board.js';
import { BoardCollaborator } from '../models/BoardCollaborator.js';
import { User } from '../models/User.js';

export type SharePermission = 'owner' | 'view' | 'edit' | 'admin';

export function serializePerson(user: { _id: any; name: string; email: string; avatar_url?: string | null }, permission: SharePermission) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    avatar_url: user.avatar_url || null,
    permission,
  };
}

export async function listBoardPeople(board: { _id: any; owner_id: any }) {
  const ownerId = board.owner_id.toString();
  const boardOid = typeof board._id === 'string' ? new mongoose.Types.ObjectId(board._id) : board._id;
  const [owner, rows] = await Promise.all([
    User.findById(board.owner_id).select('name email avatar_url'),
    BoardCollaborator.find({ board_id: boardOid }).populate('user_id', 'name email avatar_url').lean(),
  ]);
  const collaborators = rows
    .map((row) => {
      const populated = row.user_id as { _id?: any; name?: string; email?: string; avatar_url?: string | null } | null;
      if (!populated?._id || populated._id.toString() === ownerId) return null;
      return serializePerson(
        {
          _id: populated._id,
          name: populated.name || 'Unknown',
          email: populated.email || '',
          avatar_url: populated.avatar_url ?? null,
        },
        row.permission
      );
    })
    .filter((person): person is NonNullable<typeof person> => Boolean(person));

  return {
    owner: owner ? serializePerson(owner, 'owner') : null,
    collaborators,
  };
}

export async function getBoardAccess(boardId: string, userId: string) {
  if (!mongoose.Types.ObjectId.isValid(boardId)) {
    return { error: { status: 400, body: { error: 'Invalid board ID', code: 'INVALID_BOARD_ID' } } };
  }

  const boardObjectId = new mongoose.Types.ObjectId(boardId);
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const board = await Board.findById(boardObjectId);

  if (!board) {
    return { error: { status: 404, body: { error: 'Board not found', code: 'BOARD_NOT_FOUND' } } };
  }

  const isOwner = board.owner_id.toString() === userId;
  const collaboration = await BoardCollaborator.findOne({
    board_id: boardObjectId,
    user_id: userObjectId,
  }).lean();

  if (!isOwner && !collaboration && !board.is_public) {
    return { error: { status: 403, body: { error: 'Access denied', code: 'ACCESS_DENIED' } } };
  }

  const canEdit =
    isOwner ||
    collaboration?.permission === 'edit' ||
    collaboration?.permission === 'admin';

  return { board, boardObjectId, userObjectId, isOwner, collaboration, canEdit };
}
