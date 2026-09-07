import mongoose, { Schema, Document } from 'mongoose';

export type SlideObjectType = 'text' | 'shape' | 'image' | 'table' | 'chart' | 'icon';

export interface ISlideObject extends Document {
  board_id: mongoose.Types.ObjectId;
  client_id?: string;
  type: SlideObjectType;
  transform: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
  };
  zIndex: number;
  locked: boolean;
  visible: boolean;
  props: Record<string, unknown>;
  created_by: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SlideObjectSchema = new Schema<ISlideObject>(
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
    type: {
      type: String,
      required: true,
      enum: ['text', 'shape', 'image', 'table', 'chart', 'icon'],
    },
    transform: {
      x: { type: Number, required: true, default: 0 },
      y: { type: Number, required: true, default: 0 },
      width: { type: Number, required: true, default: 100 },
      height: { type: Number, required: true, default: 100 },
      rotation: { type: Number, default: 0 },
    },
    zIndex: { type: Number, default: 0 },
    locked: { type: Boolean, default: false },
    visible: { type: Boolean, default: true },
    props: {
      type: Schema.Types.Mixed,
      default: {},
    },
    created_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

SlideObjectSchema.index({ board_id: 1, zIndex: 1 });
SlideObjectSchema.index({ board_id: 1, createdAt: 1 });
SlideObjectSchema.index({ board_id: 1, client_id: 1 }, { unique: true, sparse: true });

export const SlideObject = mongoose.model<ISlideObject>('SlideObject', SlideObjectSchema);
