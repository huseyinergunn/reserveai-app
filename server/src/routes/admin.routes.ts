import { Router } from 'express';
import type { AdminController } from '../controllers/AdminController';
import { requireAdminAuth } from '../middleware/auth.middleware';
import { analyzeLimiter } from '../middleware/rateLimiter';

export function createAdminRouter(controller: AdminController): Router {
  const router = Router();

  // Public — no JWT required
  router.post('/login',  controller.login);
  router.post('/logout', controller.logout);

  // All routes below require a valid admin JWT
  router.use(requireAdminAuth);

  router.get('/appointments',                   controller.getAppointments);
  router.get('/stats',                          controller.getStats);
  router.post('/analyze',        analyzeLimiter, controller.analyzeData);
  router.post('/appointments/bulk',             controller.bulkAction);
  router.post('/appointments/:id/approve',      controller.approveAppointment);
  router.post('/appointments/:id/reject',       controller.rejectAppointment);
  router.post('/appointments/:id/cancel',       controller.cancelAppointment);
  router.post('/appointments/:id/complete',     controller.completeAppointment);

  return router;
}
