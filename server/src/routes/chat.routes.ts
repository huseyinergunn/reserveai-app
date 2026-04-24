import { Router } from 'express';
import type { ChatController } from '../controllers/ChatController';

export function createChatRouter(controller: ChatController): Router {
  const router = Router();
  router.post('/message', controller.message);
  return router;
}
