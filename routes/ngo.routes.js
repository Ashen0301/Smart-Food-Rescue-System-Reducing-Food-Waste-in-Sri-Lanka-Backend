import express from 'express';
import {
  getNgoBulkDonations,
  getNgoImpactStats,
  getNgoCertificates,
  getVendorCertificates,
} from '../controllers/ngo.controller.js';
import { protect, authorizeRoles } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.get('/donations', getNgoBulkDonations);
router.get('/impact', authorizeRoles('NGO', 'ADMIN'), getNgoImpactStats);
router.get('/certificates', authorizeRoles('NGO', 'ADMIN'), getNgoCertificates);
router.get('/vendor-certificates', authorizeRoles('VENDOR', 'ADMIN'), getVendorCertificates);

export default router;
