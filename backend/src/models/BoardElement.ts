import mongoose, { Schema, Document } from 'mongoose';

export interface IBoardElement extends Document {
  board_id: mongoose.Types.ObjectId;
  type: 'drawing' | 'text' | 'shape' | 'image' | 'table' | 'chart' | 'icon';
  data: {
    color?: string;
    strokeWidth?: number;
    points?: Array<{ x: number; y: number }>;
    text?: string;
    src?: string;
    alt?: string;
    opacity?: number;
    borderRadius?: number;
    shapeType?: string;
    fillColor?: string;
    data?: any;
    symbol?: string;
    rows?: number;
    cols?: number;
    chartType?: string;
    colors?: string[];
    [key: string]: any;
  };
  position: {
    x: number;
    y: number;
  };
  size?: {
    width: number;
    height: number;
  };
  created_by: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const BoardElementSchema = new Schema<IBoardElement>(
  {
    board_id: {
      type: Schema.Types.ObjectId,
      ref: 'Board',
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['drawing', 'text', 'shape', 'image', 'table', 'chart', 'icon'],
    },
    data: {
      type: Schema.Types.Mixed,
      required: true,
      default: {},
    },
    position: {
      x: { type: Number, required: true, default: 0 },
      y: { type: Number, required: true, default: 0 },
    },
    size: {
      width: { type: Number, default: null },
      height: { type: Number, default: null },
    },
    created_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
BoardElementSchema.index({ board_id: 1, createdAt: 1 }); // For fetching board elements
BoardElementSchema.index({ board_id: 1, updatedAt: -1 }); // For recent updates
BoardElementSchema.index({ created_by: 1 }); // For user's elements

export const BoardElement = mongoose.model<IBoardElement>('BoardElement', BoardElementSchema);

