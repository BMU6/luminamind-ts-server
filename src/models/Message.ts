import { Schema, model } from "mongoose";
import { encrypted, fieldEncryption } from "#utils";

const messageSchema = new Schema(
  {
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Sender reference footprint is required"],
      index: true,
    },
    receiverId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Receiver reference footprint is required"],
      index: true,
    },
    text: {
      type: String,
      required: [true, "Message text content cannot be blank"],
      trim: true,
      ...encrypted,
    },
  },
  {
    // Tracks only the creation time to keep linear chat transcripts light and clean
    timestamps: { createdAt: true, updatedAt: false },
  },
);

// Compiles a compound index for fast, chronological chat message history fetching
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: 1 });

messageSchema.plugin(fieldEncryption); // text is stored encrypted

export default model("Message", messageSchema);
