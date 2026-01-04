import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  name: string;
  password: string;
  avatar_url?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    avatar_url: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Note: email field already has an index created by unique: true

export const User = mongoose.model<IUser>('User', UserSchema);

