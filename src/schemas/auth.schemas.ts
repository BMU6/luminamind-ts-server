import { z } from "zod";

const emailSchema = z
  .email({ error: "Please provide a valid email address." })
  .toLowerCase()
  .trim();

const basePasswordSchema = z
  .string({ error: "Password must be a string" })
  .min(12, { error: "Password must be at least 12 characters." })
  .max(512, { error: "The length of this Password is excessive." });

export const registerSchema = z
  .strictObject(
    {
      email: emailSchema,
      password: basePasswordSchema
        .regex(/[a-z]/, {
          error: "Password must include at least one lowercase letter.",
        })
        .regex(/[A-Z]/, {
          error: "Password must include at least one uppercase letter.",
        })
        .regex(/[0-9]/, { error: "Password must include at least one number." })
        .regex(/[!@#$%^&*()_+\-=\[\]{}|;:'",.<>/?`~]/, {
          error: "Password must include at least one special character",
        }),
      confirmPassword: z.string(),

      // NEW: Explicitly registers the chosen user category payload
      // from your frontend onboarding dropdown selection forms
      role: z.enum(["patient", "doctor"], {
        message: "Please select a valid account category.",
      }),
    },
    { error: "Please provide a valid email and a secure password." },
  )
  .refine((data) => data.password === data.confirmPassword, {
    error: "Passwords don't match",
  })
  // with this registerSchema.safeParse() will include confirmPassword as a required field, but remove it from the output
  .transform(({ confirmPassword, ...rest }) => rest);

export const loginSchema = z.strictObject({
  email: emailSchema,
  password: basePasswordSchema,
});
