import express from 'express';
import { getVendorNotifications, markNotificationsRead } from '../controllers/notification.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/vendor/me', protect, getVendorNotifications);
router.put('/mark-read', protect, markNotificationsRead);

export default router;
