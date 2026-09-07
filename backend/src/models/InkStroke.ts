import mongoose, { Schema, Document } from 'mongoose';

export interface IInkStroke extends Document {
  board_id: mongoose.Types.ObjectId;
  client_id?: string;
  points: Array<{ x: number; y: number }>;
  color: string;
  strokeWidth: number;
  created_by: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const InkStrokeSchema = new Schema<IInkStroke>(
  {
    board_id: {
      type: Schema.Types.ObjectId,
      ref: 'Board',
      required: true,
      index: true,
    },
    client_id: {
      type: String,
      index: true,
    },
    points: {
      type: [
        {
          x: { type: Number, required: true },
          y: { type: Number, required: true },
        },
      ],
      required: true,
      default: [],
    },
    color: {
      type: String,
      required: true,
      default: '#000000',
    },
    strokeWidth: {
      type: Number,
      required: true,
      default: 2,
    },
    created_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

InkStrokeSchema.index({ board_id: 1, createdAt: 1 });
InkStrokeSchema.index({ board_id: 1, client_id: 1 }, { unique: true, sparse: true });

export const InkStroke = mongoose.model<IInkStroke>('InkStroke', InkStrokeSchema);
