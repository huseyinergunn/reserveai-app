import { Router } from 'express';
import type { AdminController } from '../controllers/AdminController';

export function createAdminRouter(controller: AdminController): Router {
  const router = Router();

  router.get('/appointments',         controller.getAppointments);
  router.get('/stats',                controller.getStats);
  router.post('/appointments/bulk',        controller.bulkAction);
  router.post('/appointments/:id/approve', controller.approveAppointment);
  router.post('/appointments/:id/reject',  controller.rejectAppointment);
  router.post('/appointments/:id/cancel',  controller.cancelAppointment);
  router.post('/appointments/:id/complete',controller.completeAppointment);

  return router;
}
