import express from 'express';
import {
  getPlatformSustainabilityImpact,
  getMonthlyImpactReport,
} from '../controllers/sustainability.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public Platform-Wide Sustainability & Impact Metrics
router.get('/impact', getPlatformSustainabilityImpact);

// Private Monthly CSR & Impact Report Generator for Vendors & NGOs
router.get('/monthly-report', protect, getMonthlyImpactReport);

export default router;
