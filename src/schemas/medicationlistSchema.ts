import { z } from "zod";
import { Types } from "mongoose";

export const medicationInputSchema = z.strictObject({
  name: z.string().min(1, "Medication name cannot be empty").trim(),

  dosage: z.string().min(1, "Dosage cannot be empty").trim(),

  schedule: z.object({
    morning: z.boolean(),
    noon: z.boolean(),
    evening: z.boolean(),
    night: z.boolean(),
  }),

  effect: z.string().trim().default(""),
});

export const medicationOutputSchema = medicationInputSchema.extend({
  _id: z.instanceof(Types.ObjectId),
  ...medicationInputSchema.shape,
  createdAt: z.date(),
});
