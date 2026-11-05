import { Router } from "express";
import { sendMessage, getChatHistory } from "../controllers/chatController.ts";
import { authorize, validateBody, validateIdParam } from "#middleware";
import { sendMessageSchema } from "#schemas";

const chatRouter = Router();

// Both roles possess clinical permission clearance to exchange messages
chatRouter.use(authorize("patient", "doctor"));
chatRouter.param("contactId", validateIdParam); // malformed id -> 400

chatRouter.post("/send", validateBody(sendMessageSchema), sendMessage);

chatRouter.get("/history/:contactId", getChatHistory);

export default chatRouter;
