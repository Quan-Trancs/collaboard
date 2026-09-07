import mongoose, { Schema, Document } from 'mongoose';

export interface IBoard extends Document {
  title: string;
  description?: string;
  owner_id: mongoose.Types.ObjectId;
  thumbnail_url?: string;
  is_public: boolean;
  background: {
    color?: string;
    image?: string;
  };
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const BoardSchema = new Schema<IBoard>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    owner_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    thumbnail_url: {
      type: String,
      default: null,
    },
    is_public: {
      type: Boolean,
      default: false,
    },
    background: {
      color: { type: String, default: '#ffffff' },
      image: { type: String, default: null },
    },
    viewport: {
      x: { type: Number, default: -2000 },
      y: { type: Number, default: -2000 },
      zoom: { type: Number, default: 1 },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
BoardSchema.index({ owner_id: 1, updatedAt: -1 }); // Compound index for user's boards
BoardSchema.index({ createdAt: -1 });
BoardSchema.index({ updatedAt: -1 });
BoardSchema.index({ is_public: 1, updatedAt: -1 }); // For public boards

export const Board = mongoose.model<IBoard>('Board', BoardSchema);

