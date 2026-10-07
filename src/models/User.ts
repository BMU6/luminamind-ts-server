import { Schema, model } from "mongoose";

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    roles: {
      type: [String],
      // UPDATED: Restricts roles strictly to valid clinical platform states
      enum: ["user", "patient", "doctor"],
      default: ["patient"],
    },
    // NEW: Handles the bidirectional digital handshake pointers between roles
    connectedUsers: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        index: true, // Keeps list queries fast when populating the doctor directory panel
      },
    ],
    inviteCode: { type: String, default: null, index: true },
  },
  {
    timestamps: true,
  },
);

export default model("User", userSchema);
