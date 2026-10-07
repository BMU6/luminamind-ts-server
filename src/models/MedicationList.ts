import { Schema, model, type InferSchemaType, type Types } from "mongoose";
import { encrypted, fieldEncryption } from "#utils";

const medicationSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Medication name is required"],
      trim: true,
      default: "New Medication Entry",
      ...encrypted,
    },
    dosage: {
      type: String,
      required: [true, "Dosage is required"],
      trim: true,
      default: "0 mg",
      ...encrypted,
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
      ...encrypted,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required to link medication logs"],
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// export type MedicationRecord = InferSchemaType<typeof medicationSchema> & { _id: Types.ObjectId };

medicationSchema.plugin(fieldEncryption); // name, dosage, effect are stored encrypted

export default model("Medication", medicationSchema);
