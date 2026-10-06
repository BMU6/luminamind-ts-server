import { z } from "zod";
import { Types } from "mongoose";

// The owner (userId) is NOT part of the input: the server takes it from the access token.
// z.object (not strictObject) so an old client that still sends a userId is simply ignored.
export const medicationInputSchema = z.object({
  name: z.string().min(1, "Medication name cannot be empty").trim(),

  dosage: z.string().min(1, "Dosage cannot be empty").trim(),

  schedule: z.object({
    morning: z.boolean(),
    noon: z.boolean(),
    evening: z.boolean(),
    night: z.boolean(),
  }),

  // optional, an empty effect is allowed
  effect: z.string().trim().default(""),
});

export const medicationOutputSchema = medicationInputSchema.extend({
  _id: z.instanceof(Types.ObjectId),
  userId: z.string(),
  createdAt: z.date(),
});
