import mongoose, { Schema, Document } from 'mongoose';

export interface IChatMessage extends Document {
  board_id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
  user_name: string;
  text: string;
  client_id?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>(
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
    user_name: {
      type: String,
      required: true,
      trim: true,
    },
    text: {
      type: String,
      required: true,
    },
    client_id: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

ChatMessageSchema.index({ board_id: 1, createdAt: -1 });
ChatMessageSchema.index({ board_id: 1, client_id: 1 }, { unique: true, sparse: true });

export const ChatMessage = mongoose.model<IChatMessage>('ChatMessage', ChatMessageSchema);
