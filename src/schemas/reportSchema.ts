// import { z } from "zod";

// export const reportInputSchema = z.object({
//   userId: z
//     .string()
//     .regex(/^[0-9a-fA-F]{24}$/, "Invalid User ID format template"),

//   mood: z
//     .number()
//     .min(0, "Mood cannot be below 0")
//     .max(5, "Mood cannot exceed 5"),

//   concentration: z
//     .number()
//     .min(0, "Anxiety cannot be below 0")
//     .max(5, "Anxiety cannot exceed 5"),

//   energy: z
//     .number()
//     .min(0, "Energy cannot be below 0")
//     .max(5, "Energy cannot exceed 5"),
//   irritability: z
//     .number()
//     .min(0, "Energy cannot be below 0")
//     .max(5, "Energy cannot exceed 5"),

//   sleep: z
//     .number()
//     .min(0, "Sleep cannot be below 0")
//     .max(5, "Sleep cannot exceed 5"),

//   message: z.string().trim().default(""),

//   activeMedications: z
//     .array(
//       z.object({
//         medicationId: z
//           .string()
//           .regex(/^[0-9a-fA-F]{24}$/, "Invalid Medication ID format template"),
//         name: z.string().min(1, "Medication name cannot be empty").trim(),
//         dosage: z.string().min(1, "Dosage cannot be empty").trim(),
//       }),
//     )
//     .default([]),
// });

// export type ReportInputDTO = z.infer<typeof reportInputSchema>;
import { z } from "zod";

export const reportInputSchema = z.object({
  userId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid User ID format template"),

  mood: z
    .number()
    .min(0, "Mood cannot be below 0")
    .max(5, "Mood cannot exceed 5"),

  concentration: z
    .number()
    .min(0, "Concentration cannot be below 0")
    .max(5, "Concentration cannot exceed 5"),

  energy: z
    .number()
    .min(0, "Energy cannot be below 0")
    .max(5, "Energy cannot exceed 5"),

  irritability: z
    .number()
    .min(0, "Irritability cannot be below 0")
    .max(5, "Irritability cannot exceed 5"),

  sleep: z
    .number()
    .min(0, "Sleep cannot be below 0")
    .max(5, "Sleep cannot exceed 5"),

  message: z.string().trim().default(""),

  // CHANGE THIS BLOCK: Enforce optional or default array structure parsing safely
  activeMedications: z
    .array(
      z.object({
        medicationId: z
          .string()
          .regex(/^[0-9a-fA-F]{24}$/, "Invalid Medication ID format template"),
        name: z.string().min(1, "Medication name cannot be empty").trim(),
        dosage: z.string().min(1, "Dosage cannot be empty").trim(),
      }),
    )
    .nullish() // Safely catches null/undefined from empty forms
    .transform((val) => val ?? []), // Converts them to a clean array before saving to MongoDB
});

export type ReportInputDTO = z.infer<typeof reportInputSchema>;
