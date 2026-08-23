import express from 'express';
import { submitVendorReview, getVendorReviews } from '../controllers/review.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/vendor/:vendorId', getVendorReviews);
router.post('/', protect, submitVendorReview);

export default router;
