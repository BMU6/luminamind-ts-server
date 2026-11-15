import type { RequestHandler } from "express";
import { User, Message } from "#models";
import type { SendMessageInput } from "#schemas";
import { isConnectedTo } from "../utils/connections.ts";

/**
 * 1. POST /chat/send
 * Submits a new text message entry into the linear conversation timeline channel
 */
export const sendMessage: RequestHandler<
  unknown,
  unknown,
  SendMessageInput
> = async (req, res, next) => {
  try {
    const senderId = req.user?.id;
    if (!senderId)
      return res
        .status(401)
        .json({ error: "Authentication verified footprint is missing." });

    // The body was already validated and trimmed by validateBody in chatRoute
    const { receiverId, text } = req.body;

    if (receiverId === senderId) {
      return res
        .status(400)
        .json({ error: "You cannot send a message to yourself." });
    }

    // Verify that the destination contact footprint actually exists in MongoDB
    const recipientExists = await User.findById(receiverId);
    if (!recipientExists) {
      return res
        .status(404)
        .json({ error: "Target messaging contact profile not found." });
    }

    // Chat is only allowed between connected users (patient <-> doctor)
    if (!(await isConnectedTo(senderId, receiverId))) {
      return res
        .status(403)
        .json({ error: "You are not connected with this user." });
    }

    const newMessage = await Message.create({
      senderId,
      receiverId,
      text,
    });

    res.status(201).json(newMessage);
  } catch (error) {
    next(error);
  }
};

/**
 * 2. GET /chat/history/:contactId
 * Retrieves the chronological message log tracks shared between two endpoints
 */
export const getChatHistory: RequestHandler = async (req, res, next) => {
  try {
    const activeUserId = req.user?.id;
    const { contactId } = req.params;

    if (!activeUserId)
      return res.status(401).json({ error: "Authentication required." });
    if (!contactId)
      return res
        .status(400)
        .json({ error: "Contact reference identifier is required." });

    // Queries text rows where either participant acted as sender or receiver
    const chatLogs = await Message.find({
      $or: [
        { senderId: activeUserId, receiverId: contactId },
        { senderId: contactId, receiverId: activeUserId },
      ],
    })
      .sort({ createdAt: 1 }) // Chronological order matching your client chat log layout grids
      .lean();

    res.status(200).json(chatLogs);
  } catch (error) {
    next(error);
  }
};
