import { Schema, model } from "mongoose";

const medicationSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Medication name is required"],
      trim: true,
      default: "New Medication Entry",
    },
    dosage: {
      type: String,
      required: [true, "Dosage is required"],
      trim: true,
      default: "0 mg",
    },
    schedule: {
      morning: { type: Boolean, default: false },
      noon: { type: Boolean, default: false },
      evening: { type: Boolean, default: false },
      night: { type: Boolean, default: false },
    },
    effect: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

export default model("Medication", medicationSchema);
