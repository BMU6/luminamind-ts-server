import { Schema, model, type Document } from "mongoose";

const reportSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID context tracking parameter is required"],
      index: true,
    },
    date: {
      type: Date,
      default: Date.now,
      index: true,
    },
    // activeMedications: [
    //   {
    //     name: { type: String, required: true },
    //     dosage: { type: String, required: true },
    //   },
    // ],
    activeMedications: [
      {
        medicationId: {
          type: Schema.Types.ObjectId,
          ref: "Medication", // <-- Explicitly references your Medication model
          required: [true, "Medication link identifier is required"],
        },
        name: { type: String, required: true },
        dosage: { type: String, required: true },
      },
    ],
    mood: {
      type: Number,
      required: [true, "Mood metric tracking entry is required"],
      min: [0, "Value cannot be below 0"],
      max: [5, "Value cannot exceed 5"],
    },
    concentration: {
      type: Number,
      required: [true, "Mood metric tracking entry is required"],
      min: [0, "Value cannot be below 0"],
      max: [5, "Value cannot exceed 5"],
    },
    irritability: {
      type: Number,
      required: [true, "Anxiety metric tracking entry is required"],
      min: [0, "Value cannot be below 0"],
      max: [5, "Value cannot exceed 5"],
    },
    energy: {
      type: Number,
      required: [true, "Energy metric tracking entry is required"],
      min: [0, "Value cannot be below 0"],
      max: [5, "Value cannot exceed 5"],
    },
    sleep: {
      type: Number,
      required: [true, "Sleep metric tracking entry is required"],
      min: [0, "Value cannot be below 0"],
      max: [5, "Value cannot exceed 5"],
    },
    message: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

// Every Home query is "reports of ONE user in a time range"
reportSchema.index({ userId: 1, date: 1 });

export default model("Report", reportSchema);
