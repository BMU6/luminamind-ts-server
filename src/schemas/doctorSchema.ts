import { z } from "zod";

/**
 * Validates real-time patient-doctor text message entries at your API gateway
 */
export const sendMessageSchema = z.strictObject({
  receiverId: z.string().regex(/^[0-9a-fA-F]{24}$/, {
    message: "Invalid MongoDB reference string layout format.",
  }),
  text: z
    .string()
    .min(1, { message: "Message content cannot be blank." })
    .max(2000, { message: "Message length cannot exceed 2000 characters." })
    .trim(),
});

/**
 * Validates temporary invitation tokens typed by the patient during a handshake
 */
export const redeemInviteCodeSchema = z.strictObject({
  code: z
    .string()
    .min(6, {
      message:
        "Handshake invitation token code must be exactly 6 characters long.",
    })
    .max(6, {
      message:
        "Handshake invitation token code must be exactly 6 characters long.",
    })
    .toUpperCase()
    .trim(),
});
