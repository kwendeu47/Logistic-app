import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import * as messageService from "../services/message.service";

export const messageRouter = Router();

messageRouter.post(
  "/:id/messages",
  requireAuth,
  validate(messageService.createMessageSchema),
  async (req, res) => {
    const message = await messageService.createMessage(String(req.params.id), req.user!.id, req.body);
    res.status(201).json({ message });
  },
);

messageRouter.get(
  "/:id/messages",
  requireAuth,
  validate(messageService.listMessagesSchema, "query"),
  async (req, res) => {
    const { cursor } = req.query as unknown as messageService.ListMessagesQuery;
    const result = await messageService.getMessages(String(req.params.id), req.user!.id, cursor);
    res.json(result);
  },
);
