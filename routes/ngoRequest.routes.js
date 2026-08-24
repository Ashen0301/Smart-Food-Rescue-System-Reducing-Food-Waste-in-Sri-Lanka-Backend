import express from 'express';
import {
  createNgoRequest,
  getNgoRequests,
  fulfillNgoRequest,
  cancelNgoRequest,
} from '../controllers/ngoRequest.controller.js';
import { protect, authorizeRoles } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.post('/', authorizeRoles('NGO', 'ADMIN'), createNgoRequest);
router.get('/', getNgoRequests);
router.post('/:id/fulfill', authorizeRoles('VENDOR', 'ADMIN'), fulfillNgoRequest);
router.put('/:id/cancel', authorizeRoles('NGO', 'ADMIN'), cancelNgoRequest);

export default router;
