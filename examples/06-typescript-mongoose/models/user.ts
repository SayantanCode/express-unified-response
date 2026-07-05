import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  active: boolean;
  createdAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, minlength: 2 },
    email: { type: String, required: true, unique: true, lowercase: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const UserModel = mongoose.model<IUser>("User", userSchema);
