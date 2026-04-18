import { Router } from 'express';
import type { ApprovalController } from '../controllers/ApprovalController';

export function createApprovalRouter(controller: ApprovalController): Router {
  const router = Router();

  // Frontend fetches appointment details to render the approval UI
  router.get('/details/:token', controller.getDetails);

  // Admin submits decision via the frontend approval page (POST prevents CSRF from email links)
  router.post('/confirm', controller.confirm);
  router.post('/decline', controller.decline);

  // n8n callback endpoints — called by n8n HTTP Request nodes after processing
  // Accept both GET and POST so n8n can use either method
  router.get('/approve/:id',  controller.approveById);
  router.post('/approve/:id', controller.approveById);
  router.get('/reject/:id',   controller.rejectById);
  router.post('/reject/:id',  controller.rejectById);

  // Short links embedded in admin email buttons
  // Admin clicks → server fires n8n webhook → returns success HTML immediately
  router.get('/a/:id', controller.shortApprove);
  router.get('/r/:id', controller.shortReject);

  // User cancellation link (embedded in confirmation email by n8n)
  router.get('/cancel/:token', controller.cancelAppointment);

  return router;
}
