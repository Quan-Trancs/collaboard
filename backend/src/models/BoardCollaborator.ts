import mongoose, { Schema, Document } from 'mongoose';

export interface IBoardCollaborator extends Document {
  board_id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
  permission: 'view' | 'edit' | 'admin';
  createdAt: Date;
  updatedAt: Date;
}

const BoardCollaboratorSchema = new Schema<IBoardCollaborator>(
  {
    board_id: {
      type: Schema.Types.ObjectId,
      ref: 'Board',
      required: true,
      index: true,
    },
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    permission: {
      type: String,
      required: true,
      enum: ['view', 'edit', 'admin'],
      default: 'view',
    },
  },
  {
    timestamps: true,
  }
);

// Unique constraint: one user can only have one permission per board
BoardCollaboratorSchema.index({ board_id: 1, user_id: 1 }, { unique: true });
BoardCollaboratorSchema.index({ user_id: 1 }); // For finding user's collaborations
BoardCollaboratorSchema.index({ board_id: 1, permission: 1 }); // For permission checks

export const BoardCollaborator = mongoose.model<IBoardCollaborator>(
  'BoardCollaborator',
  BoardCollaboratorSchema
);

