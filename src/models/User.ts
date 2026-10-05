import { Schema, model } from 'mongoose';

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true
    },
    password: {
      type: String,
      required: true,
      select: false
    },
    roles: {
      type: [String],
      default: ['patient']
    }
  },
  {
    timestamps: true
  }
);

export default model('User', userSchema);
