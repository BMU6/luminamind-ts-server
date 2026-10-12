import { z } from "zod";

const MAX_RANGE_DAYS = 31;

// Query string ?from=...&to=... (ISO dates). 'from' is included, 'to' is excluded.
export const reportRangeSchema = z
  .object({
    from: z.coerce.date({ message: "'from' must be a valid date" }),
    to: z.coerce.date({ message: "'to' must be a valid date" }),
  })
  .refine(({ from, to }) => from < to, {
    message: "'from' must be before 'to'",
    path: ["to"],
  })
  .refine(({ from, to }) => to.getTime() - from.getTime() <= MAX_RANGE_DAYS * 24 * 60 * 60 * 1000, {
    message: `The range must not be longer than ${MAX_RANGE_DAYS} days`,
    path: ["to"],
  });
