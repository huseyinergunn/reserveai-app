import { Router } from 'express';
import type { FormController } from '../controllers/FormController';

export function createFormRouter(controller: FormController): Router {
  const router = Router();

  // Step 1 — Submit enquiry + AI classification
  router.post('/submit', controller.submitEnquiry);

  // Step 2 — Accept Terms & Conditions
  router.post('/terms', controller.acceptTerms);

  // Step 3 — Date/time selection → kicks off async approval flow
  router.post('/schedule', controller.scheduleAppointment);

  // Utility — return available date & time dropdown options
  router.get('/date-options', controller.getDateOptions);

  // Public status lookup — customer queries by email (no auth)
  router.get('/status', controller.getStatusByEmail);

  return router;
}
